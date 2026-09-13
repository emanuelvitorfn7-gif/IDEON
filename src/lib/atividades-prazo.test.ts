import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const professor = id(1),
  turma = id(10),
  atividade = id(20),
  outra = id(21),
  exclusiva = id(30),
  compartilhada = id(31);
const db = new PGlite();
const sql = readFileSync(
  new URL(
    "../../supabase/migrations/20260913020000_exclusao_atividades_prazo.sql",
    import.meta.url,
  ),
  "utf8",
);
// PGlite executa PostgreSQL, mas não o processo pg_cron. Somente a instalação/registro
// do agendador é substituída; os comandos agendados e todas as funções reais são executados.
const migracao = sql.replace("CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;", "");

async function apagar() {
  return db.query<{ resultado: { excluidas: string[]; preservadas: number } }>(
    "SELECT public.excluir_atividade_professor($1) resultado",
    [atividade],
  );
}
async function criar(prazo: string | null, auto = false, questoes = [exclusiva]) {
  return db.query<{ resultado: { id: string; prazo: string; prazo_com_hora: boolean } }>(
    "SELECT public.criar_atividade_professor($1, 'Revisão', '', $2, 100, $3::uuid[], true, $4) resultado",
    [turma, prazo, questoes, auto],
  );
}

describe("atividades: exclusão, prazo e agendamento", () => {
  before(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE public.turmas(id uuid PRIMARY KEY, professor_id uuid);
      CREATE FUNCTION public.is_dono_turma(t uuid, u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM turmas WHERE id=t AND professor_id=u) $$;
      CREATE FUNCTION public.is_matriculado(t uuid, u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT u = '${id(2)}'::uuid $$;
      CREATE TABLE public.materiais(id uuid PRIMARY KEY);
      CREATE TABLE public.atividades(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turma_id uuid REFERENCES turmas(id), titulo text DEFAULT '', descricao text DEFAULT '', prazo timestamptz, publicada boolean DEFAULT false, xp integer DEFAULT 100);
      CREATE TABLE public.questoes(id uuid PRIMARY KEY, turma_id uuid REFERENCES turmas(id), material_id uuid REFERENCES materiais(id), arquivada boolean DEFAULT false, aprovada boolean DEFAULT true, enunciado text DEFAULT 'Questão', alternativas jsonb DEFAULT '[]', assunto text DEFAULT '', dificuldade text DEFAULT '', correta integer DEFAULT 0);
      CREATE TABLE public.atividade_questoes(atividade_id uuid REFERENCES atividades(id), questao_id uuid REFERENCES questoes(id) ON DELETE RESTRICT, PRIMARY KEY(atividade_id, questao_id));
      CREATE TABLE public.submissoes(atividade_id uuid REFERENCES atividades(id), xp integer);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, xp integer);
      CREATE TABLE public.xp_transactions(reference_id text, amount integer);
      CREATE SCHEMA cron;
      CREATE TABLE cron.job(jobname text PRIMARY KEY, schedule text, command text);
      CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
        INSERT INTO cron.job VALUES (n,s,c) ON CONFLICT(jobname) DO UPDATE SET schedule=EXCLUDED.schedule, command=EXCLUDED.command;
        RETURN 1; END $$;
    `);
    await db.exec(migracao);
  });
  beforeEach(async () => {
    await db.exec(`RESET ROLE;
      TRUNCATE turmas, materiais, atividades, questoes, atividade_questoes, submissoes, profiles, xp_transactions;
      SELECT set_config('request.jwt.claim.sub', '${professor}', false);
      INSERT INTO turmas VALUES ('${turma}', '${professor}');
      INSERT INTO materiais VALUES ('${id(40)}');
      INSERT INTO atividades(id,turma_id,publicada) VALUES ('${atividade}','${turma}',true),('${outra}','${turma}',true);
      INSERT INTO questoes(id,turma_id,material_id) VALUES ('${exclusiva}','${turma}','${id(40)}'),('${compartilhada}','${turma}','${id(40)}');
      INSERT INTO atividade_questoes VALUES ('${atividade}','${exclusiva}'),('${atividade}','${compartilhada}'),('${outra}','${compartilhada}');
      INSERT INTO submissoes VALUES ('${atividade}',100),('${outra}',50);
      INSERT INTO profiles VALUES ('${id(2)}',150);
      INSERT INTO xp_transactions VALUES ('${atividade}',100),('${outra}',50);
    `);
  });
  after(async () => {
    await db.close();
  });

  it("exclui atividade e questões exclusivas, preservando compartilhadas, material e XP", async () => {
    await db.exec("SET ROLE authenticated");
    assert.deepEqual((await apagar()).rows[0]!.resultado, {
      excluidas: [exclusiva],
      preservadas: 1,
    });
    await db.exec("RESET ROLE");
    assert.deepEqual((await db.query("SELECT id FROM atividades")).rows, [{ id: outra }]);
    assert.deepEqual((await db.query("SELECT id FROM questoes")).rows, [{ id: compartilhada }]);
    assert.deepEqual((await db.query("SELECT xp FROM submissoes")).rows, [{ xp: 50 }]);
    assert.deepEqual((await db.query("SELECT xp FROM profiles")).rows, [{ xp: 150 }]);
    assert.equal((await db.query("SELECT * FROM xp_transactions")).rows.length, 2);
    assert.equal((await db.query("SELECT * FROM materiais")).rows.length, 1);
  });

  it("nega exclusão por terceiros e acesso às funções administrativas", async () => {
    for (const usuario of [id(2), ""]) {
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [usuario]);
      await assert.rejects(apagar(), /permissão/);
    }
    await db.exec("SET ROLE authenticated");
    await assert.rejects(
      db.exec("SELECT public.excluir_atividades_vencidas()"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("SELECT ideon_private.excluir_atividade($1)", [atividade]),
      /permission denied/,
    );
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM atividades")).rows.length, 2);
  });

  it("executa o comando do cron apenas para publicadas, vencidas e com a opção marcada", async () => {
    await db.exec(`UPDATE atividades SET prazo = now() - interval '1 second', prazo_com_hora = true, excluir_ao_vencer = true WHERE id='${atividade}';
      UPDATE atividades SET prazo=now()-interval '1 day', prazo_com_hora=true WHERE id='${outra}';
      INSERT INTO atividades(id,turma_id,prazo,prazo_com_hora,publicada,excluir_ao_vencer) VALUES
        ('${id(22)}','${turma}',now()+interval '1 day',true,true,true),
        ('${id(23)}','${turma}',now()-interval '1 day',true,false,true),
        ('${id(24)}','${turma}',NULL,false,true,false);`);
    const job = (
      await db.query<{ command: string; schedule: string }>("SELECT command,schedule FROM cron.job")
    ).rows[0]!;
    assert.equal(job.schedule, "* * * * *");
    await db.exec(job.command);
    assert.equal(
      (await db.query("SELECT * FROM atividades WHERE id=$1", [atividade])).rows.length,
      0,
    );
    assert.equal((await db.query("SELECT * FROM atividades")).rows.length, 4);
    assert.deepEqual(
      (await db.query("SELECT public.excluir_atividades_vencidas() AS total")).rows,
      [{ total: 0 }],
    );
  });

  it("bloqueia respostas no horário mesmo sem exclusão automática", async () => {
    await db.exec(
      `UPDATE atividades SET prazo = now(), prazo_com_hora = true WHERE id='${atividade}'`,
    );
    await assert.rejects(
      db.query("INSERT INTO submissoes VALUES($1,10)", [atividade]),
      /prazo.*encerrou/,
    );
    await db.exec(`UPDATE atividades SET prazo = now()+interval '1 day' WHERE id='${atividade}'`);
    await db.query("INSERT INTO submissoes VALUES($1,10)", [atividade]);
  });

  it("salva atividade e questões juntas, com data e hora e opção automática", async () => {
    const prazo = "2099-02-15T02:59:00Z";
    const nova = (await criar(prazo, true)).rows[0]!.resultado;
    assert.equal(nova.prazo_com_hora, true);
    assert.equal(new Date(nova.prazo).toISOString(), new Date(prazo).toISOString());
    assert.equal(
      (await db.query("SELECT * FROM atividade_questoes WHERE atividade_id=$1", [nova.id])).rows
        .length,
      1,
    );
    await assert.rejects(criar(null, true), /Defina uma data/);
    await assert.rejects(criar("2000-01-01T00:00:00Z"), /futuras/);
    await assert.rejects(criar(null, false, [id(99)]), /questão/);
    assert.equal((await db.query("SELECT * FROM atividades")).rows.length, 3);
  });

  it("permite ajustar ou desligar a exclusão automática de atividades existentes", async () => {
    await db.query("SELECT atualizar_prazo_atividade_professor($1,$2,true)", [
      atividade,
      "2099-02-15T02:59:00Z",
    ]);
    await db.query("SELECT atualizar_prazo_atividade_professor($1,$2,false)", [atividade, null]);
    assert.deepEqual(
      (await db.query("SELECT prazo,excluir_ao_vencer FROM atividades WHERE id=$1", [atividade]))
        .rows,
      [{ prazo: null, excluir_ao_vencer: false }],
    );
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(2)]);
    await assert.rejects(
      db.query("SELECT atualizar_prazo_atividade_professor($1,NULL,false)", [atividade]),
      /permissão/,
    );
  });

  it("fornece prazo com hora ao aluno sem expor gabarito", async () => {
    await db.query("SELECT atualizar_prazo_atividade_professor($1,$2,false)", [
      atividade,
      "2099-02-15T02:59:00Z",
    ]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(2)]);
    const aluno = (
      await db.query<{ resultado: { prazo_com_hora: boolean; questoes: unknown[] } }>(
        "SELECT get_activity_for_student($1) resultado",
        [atividade],
      )
    ).rows[0]!.resultado;
    assert.equal(aluno.prazo_com_hora, true);
    assert.equal(aluno.questoes.length, 2);
    assert.equal(JSON.stringify(aluno).includes("correta"), false);
  });

  it("reaplicar a migração mantém os dados e não duplica o agendamento", async () => {
    await db.exec(migracao);
    assert.equal((await db.query("SELECT * FROM cron.job")).rows.length, 1);
    assert.equal(
      (await db.query("SELECT * FROM atividades WHERE excluir_ao_vencer")).rows.length,
      0,
    );
    assert.equal((await db.query("SELECT * FROM atividades")).rows.length, 2);
  });
});
