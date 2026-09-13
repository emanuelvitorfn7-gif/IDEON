import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { formatarContagem, segundosRestantes, validarDuracao } from "./duracao-atividade";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const professor = id(1),
  aluno = id(2),
  outroAluno = id(3),
  turma = id(10),
  atividade = id(20),
  antiga = id(21),
  questao = id(30);
const db = new PGlite();
const ler = (arquivo: string) => readFileSync(new URL(`../../${arquivo}`, import.meta.url), "utf8");
const usuario = (uid: string) =>
  db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
async function consultar(funcao = "get_activity_for_student", atividadeId = atividade) {
  const { rows } = await db.query<{
    r: {
      iniciada_em: string | null;
      termina_em: string | null;
      agora_servidor: string;
      questoes: unknown[];
      resultado: { xp_ganho: number } | null;
    };
  }>(`SELECT public.${funcao}($1) r`, [atividadeId]);
  return rows[0]!.r;
}
const iniciar = (atividadeId = atividade) => consultar("iniciar_atividade_aluno", atividadeId);
const enviar = (respostas: unknown = { [questao]: 0 }, atividadeId = atividade) =>
  db.query<{ r: { xp_ganho: number; ja_enviada: boolean } }>(
    "SELECT public.submit_activity($1,$2::jsonb) r",
    [atividadeId, JSON.stringify(respostas)],
  );
const criar = (duracao: number | null) =>
  db.query(
    "SELECT public.criar_atividade_professor($1,'Teste','',NULL,100,$2::uuid[],true,false,$3)",
    [turma, [questao], duracao],
  );
const ajustar = (duracao: number | null, prazo: string | null = null, atividadeId = atividade) =>
  db.query("SELECT public.atualizar_prazo_atividade_professor($1,$2,false,$3)", [
    atividadeId,
    prazo,
    duracao,
  ]);

describe("duração obrigatória e tentativa persistente no PostgreSQL", () => {
  before(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE public.turmas(id uuid PRIMARY KEY, professor_id uuid);
      CREATE TABLE public.matriculas(turma_id uuid, aluno_id uuid);
      CREATE FUNCTION public.is_dono_turma(t uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM turmas WHERE id=t AND professor_id=u) $$;
      CREATE FUNCTION public.is_matriculado(t uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM matriculas WHERE turma_id=t AND aluno_id=u) $$;
      CREATE TABLE public.materiais(id uuid PRIMARY KEY);
      CREATE TABLE public.atividades(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), turma_id uuid REFERENCES turmas(id), titulo text DEFAULT '', descricao text DEFAULT '', prazo timestamptz, publicada boolean DEFAULT false, xp integer DEFAULT 100);
      CREATE TABLE public.questoes(id uuid PRIMARY KEY, turma_id uuid REFERENCES turmas(id), aprovada boolean DEFAULT true, enunciado text DEFAULT 'Questão', alternativas jsonb DEFAULT '["A","B","C","D"]', assunto text DEFAULT '', dificuldade text DEFAULT '', correta integer DEFAULT 0, explicacao text DEFAULT 'Explicação');
      CREATE TABLE public.atividade_questoes(atividade_id uuid REFERENCES atividades(id), questao_id uuid REFERENCES questoes(id) ON DELETE RESTRICT, PRIMARY KEY(atividade_id,questao_id));
      CREATE TABLE public.submissoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atividade_id uuid REFERENCES atividades(id), aluno_id uuid REFERENCES auth.users(id), acertos integer, total integer, xp_ganho integer, detalhes jsonb, UNIQUE(atividade_id,aluno_id));
      CREATE TABLE public.profiles(id uuid PRIMARY KEY, nome text, xp integer DEFAULT 0, nivel integer DEFAULT 1, sequencia integer DEFAULT 0, ultima_atividade date);
      CREATE SCHEMA cron;
      CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
    `);
    await db.exec(ler("drizzle/migrations/0001_secure_mvp.sql"));
    await db.exec(ler("supabase/migrations/20260913010000_arquivar_questoes_em_uso.sql"));
    await db.exec(
      ler("supabase/migrations/20260913020000_exclusao_atividades_prazo.sql").replace(
        "CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;",
        "",
      ),
    );
    await db.exec(`
      INSERT INTO auth.users VALUES ('${professor}'),('${aluno}'),('${outroAluno}');
      INSERT INTO profiles(id) SELECT id FROM auth.users;
      INSERT INTO turmas VALUES ('${turma}','${professor}');
      INSERT INTO matriculas VALUES ('${turma}','${aluno}'),('${turma}','${outroAluno}');
      INSERT INTO atividades(id,turma_id,publicada) VALUES ('${atividade}','${turma}',true),('${antiga}','${turma}',true);
      INSERT INTO questoes(id,turma_id) VALUES ('${questao}','${turma}');
      INSERT INTO atividade_questoes VALUES ('${atividade}','${questao}'),('${antiga}','${questao}');
      INSERT INTO submissoes(atividade_id,aluno_id,acertos,total,xp_ganho,detalhes) VALUES ('${antiga}','${aluno}',1,1,30,'[]');
    `);
    await db.exec(ler("supabase/migrations/20260913030000_duracao_atividades.sql"));
    await db.exec(`UPDATE atividades SET duracao_minutos=30 WHERE id='${atividade}'`);
  });
  beforeEach(async () => {
    await db.exec("BEGIN");
    await usuario(aluno);
  });
  afterEach(async () => {
    await db.exec("ROLLBACK");
  });
  after(async () => {
    await db.close();
  });

  it("exige duração válida na publicação e edição, inclusive inserção direta", async () => {
    await usuario(professor);
    for (const duracao of [null, 0, -1, 241]) {
      await db.exec("SAVEPOINT invalida");
      await assert.rejects(criar(duracao), /duração/);
      await db.exec("ROLLBACK TO invalida");
      await assert.rejects(ajustar(duracao), /duração/);
      await db.exec("ROLLBACK TO invalida");
    }
    for (const duracao of [1, 60, 240]) await criar(duracao);
    await assert.rejects(
      db.query("INSERT INTO atividades(turma_id) VALUES($1)", [turma]),
      /duração/,
    );
  });
  it("não expõe questões nem inicia ao consultar; depois inicia sem gabarito", async () => {
    assert.equal((await consultar()).iniciada_em, null);
    assert.equal((await consultar()).questoes.length, 0);
    const tentativa = await iniciar();
    assert.equal(tentativa.questoes.length, 1);
    assert.equal(JSON.stringify(tentativa).includes('"correta"'), false);
    assert.equal(
      Date.parse(tentativa.termina_em!) - Date.parse(tentativa.iniciada_em!),
      30 * 60_000,
    );
  });
  it("reabrir e iniciar novamente mantêm o início e fim; outro aluno tem tentativa própria", async () => {
    const primeira = await iniciar();
    const repetida = await iniciar();
    assert.equal(repetida.iniciada_em, primeira.iniciada_em);
    assert.equal((await consultar()).termina_em, primeira.termina_em);
    await usuario(outroAluno);
    assert.equal((await consultar()).iniciada_em, null);
    await iniciar();
    assert.equal(
      (await db.query("SELECT * FROM ideon_private.tentativas_atividade")).rows.length,
      2,
    );
  });
  it("recusa envio sem início e não distribui XP", async () => {
    await db.exec("SAVEPOINT envio");
    await assert.rejects(enviar(), /Inicie a atividade/);
    await db.exec("ROLLBACK TO envio");
    assert.equal((await db.query("SELECT * FROM xp_transactions")).rows.length, 0);
  });
  it("corrige no tempo, persiste resultado e não duplica XP ao reenviar", async () => {
    await db.exec("SET LOCAL ROLE authenticated");
    await iniciar();
    assert.equal((await enviar()).rows[0]!.r.xp_ganho, 30);
    assert.equal((await enviar()).rows[0]!.r.ja_enviada, true);
    assert.equal((await consultar()).resultado?.xp_ganho, 30);
    await db.exec("RESET ROLE");
    assert.deepEqual((await db.query("SELECT xp FROM profiles WHERE id=$1", [aluno])).rows, [
      { xp: 30 },
    ]);
    assert.equal((await db.query("SELECT * FROM xp_transactions")).rows.length, 2);
  });
  it("recusa envio após duração; nova chamada de início não renova a tentativa", async () => {
    await iniciar();
    await db.exec(
      "UPDATE ideon_private.tentativas_atividade SET iniciada_em=clock_timestamp()-interval '31 minutes', termina_em=clock_timestamp()-interval '1 minute'",
    );
    const vencida = await iniciar();
    assert.ok(Date.parse(vencida.termina_em!) < Date.parse(vencida.agora_servidor));
    await assert.rejects(enviar(), /tempo.*encerrou/);
  });
  it("limita a duração ao prazo final e não prolonga tentativas ao editar", async () => {
    await usuario(professor);
    await ajustar(30, new Date(Date.now() + 5 * 60_000).toISOString());
    await usuario(aluno);
    const tentativa = await iniciar();
    assert.ok(Date.parse(tentativa.termina_em!) - Date.parse(tentativa.iniciada_em!) <= 5 * 60_000);
    await usuario(professor);
    await ajustar(120);
    await usuario(aluno);
    assert.equal((await iniciar()).termina_em, tentativa.termina_em);
    await db.exec(
      `UPDATE atividades SET prazo=clock_timestamp()-interval '1 second',prazo_com_hora=true WHERE id='${atividade}'`,
    );
    await assert.rejects(enviar(), /tempo.*encerrou/);
  });
  it("não inicia após o prazo final, mesmo sem exclusão automática", async () => {
    await db.exec(
      `UPDATE atividades SET prazo=clock_timestamp(),prazo_com_hora=true WHERE id='${atividade}'`,
    );
    await assert.rejects(iniciar(), /prazo.*encerrou/);
  });
  it("mantém resultados antigos; antigos sem duração aguardam o professor", async () => {
    assert.equal((await consultar("get_activity_for_student", antiga)).resultado?.xp_ganho, 30);
    assert.equal((await enviar({}, antiga)).rows[0]!.r.ja_enviada, true);
    await usuario(outroAluno);
    await db.exec("SAVEPOINT sem_duracao");
    await assert.rejects(iniciar(antiga), /professor.*duração/);
    await db.exec("ROLLBACK TO sem_duracao");
    await usuario(professor);
    await ajustar(45, null, antiga);
    await usuario(outroAluno);
    assert.ok((await iniciar(antiga)).iniciada_em);
  });
  it("bloqueia terceiros e acesso direto ao registro do cronômetro", async () => {
    for (const uid of [professor, id(99), ""]) {
      await usuario(uid);
      await db.exec("SAVEPOINT terceiro");
      await assert.rejects(iniciar(), /indisponível/);
      await db.exec("ROLLBACK TO terceiro");
      await assert.rejects(consultar(), /indisponível/);
      await db.exec("ROLLBACK TO terceiro");
    }
    await usuario(aluno);
    await db.exec("SAVEPOINT acesso");
    await assert.rejects(ajustar(90), /permissão/);
    await db.exec("ROLLBACK TO acesso");
    await db.exec("SET LOCAL ROLE authenticated");
    await assert.rejects(
      db.exec("UPDATE ideon_private.tentativas_atividade SET termina_em=now()+interval '1 day'"),
      /permission denied/,
    );
  });
  it("RLS bloqueia acesso direto mesmo se permissões forem concedidas por engano", async () => {
    await iniciar();
    assert.deepEqual(
      (
        await db.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid='ideon_private.tentativas_atividade'::regclass",
        )
      ).rows,
      [{ relrowsecurity: true }],
    );
    await db.exec(`
      GRANT USAGE ON SCHEMA ideon_private TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ideon_private.tentativas_atividade TO authenticated;
      SET LOCAL ROLE authenticated;
    `);
    assert.equal(
      (await db.query("SELECT * FROM ideon_private.tentativas_atividade")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "UPDATE ideon_private.tentativas_atividade SET termina_em=now()+interval '1 day' RETURNING *",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query("DELETE FROM ideon_private.tentativas_atividade RETURNING *")).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO ideon_private.tentativas_atividade VALUES ($1,$2,now(),now()+interval '1 hour')",
        [antiga, aluno],
      ),
      /row-level security/,
    );
  });

  it("excluir atividade também limpa seus cronômetros", async () => {
    await iniciar();
    await usuario(professor);
    await db.query("SELECT excluir_atividade_professor($1)", [atividade]);
    assert.equal(
      (await db.query("SELECT * FROM ideon_private.tentativas_atividade")).rows.length,
      0,
    );
  });
  it("recusa respostas incompletas ou inválidas sem gravar submissão", async () => {
    await iniciar();
    for (const respostas of [{}, { [questao]: null }, { [questao]: 4 }, { [id(99)]: 0 }, null]) {
      await db.exec("SAVEPOINT respostas");
      await assert.rejects(enviar(respostas), /Resp/);
      await db.exec("ROLLBACK TO respostas");
    }
    assert.equal(
      (await db.query("SELECT * FROM submissoes WHERE atividade_id=$1", [atividade])).rows.length,
      0,
    );
  });
});

it("valida duração e conta até zero usando o horário do servidor", () => {
  assert.equal(validarDuracao(45), 45);
  for (const valor of [0, 241, NaN, 1.5]) assert.throws(() => validarDuracao(valor), /duração/);
  const agora = "2026-09-13T12:00:00Z",
    fim = "2026-09-13T12:01:00Z";
  assert.equal(segundosRestantes(fim, agora, 0), 60);
  assert.equal(segundosRestantes(fim, agora, 30_000), 30);
  assert.equal(segundosRestantes(fim, agora, 61_000), 0);
  assert.equal(segundosRestantes("inválido", agora, 0), 0);
  assert.equal(formatarContagem(90), "01:30");
  assert.equal(formatarContagem(0), "00:00");
});
