import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const professor = "00000000-0000-0000-0000-000000000001";
const outroProfessor = "00000000-0000-0000-0000-000000000002";
const turma = "00000000-0000-0000-0000-000000000010";
const material = "00000000-0000-0000-0000-000000000020";
const livre = "00000000-0000-0000-0000-000000000030";
const usada = "00000000-0000-0000-0000-000000000031";
const rascunho = "00000000-0000-0000-0000-000000000032";
type Resultado = { excluidas: string[]; preservadas: number };
const db = new PGlite();
const migracaoSupabase = readFileSync(
  new URL(
    "../../supabase/migrations/20260913000000_exclusao_materiais_questoes.sql",
    import.meta.url,
  ),
  "utf8",
);

async function excluirMaterial(apagarQuestoes = false) {
  const { rows } = await db.query<{ resultado: Resultado }>(
    "SELECT public.excluir_material_professor($1, $2) AS resultado",
    [material, apagarQuestoes],
  );
  return rows[0]!.resultado;
}

async function excluirQuestoes(ids: string[]) {
  const { rows } = await db.query<{ resultado: Resultado }>(
    "SELECT public.excluir_questoes_professor($1, $2::uuid[]) AS resultado",
    [turma, ids],
  );
  return rows[0]!.resultado;
}

describe("exclusão opcional de materiais e questões (PostgreSQL)", () => {
  before(async () => {
    // Replica as relações existentes; a migração real é executada sobre elas.
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE public.turmas (id uuid PRIMARY KEY, professor_id uuid NOT NULL);
      CREATE FUNCTION public.is_dono_turma(turma uuid, usuario uuid) RETURNS boolean LANGUAGE sql AS
        $$ SELECT EXISTS (SELECT 1 FROM public.turmas WHERE id = turma AND professor_id = usuario) $$;
      CREATE TABLE public.materiais (id uuid PRIMARY KEY, professor_id uuid NOT NULL,
        turma_id uuid REFERENCES public.turmas(id), status text NOT NULL);
      CREATE TABLE public.questoes (id uuid PRIMARY KEY, turma_id uuid REFERENCES public.turmas(id),
        material_id uuid CONSTRAINT questoes_material_id_fkey REFERENCES public.materiais(id) ON DELETE CASCADE);
      CREATE TABLE public.atividades (id uuid PRIMARY KEY, publicada boolean NOT NULL);
      CREATE TABLE public.atividade_questoes (atividade_id uuid REFERENCES public.atividades(id),
        questao_id uuid CONSTRAINT atividade_questoes_questao_id_fkey REFERENCES public.questoes(id) ON DELETE CASCADE);
      CREATE TABLE public.submissoes (atividade_id uuid REFERENCES public.atividades(id), xp integer);
    `);
    await db.exec(migracaoSupabase);
  });

  beforeEach(async () => {
    await db.exec(`
      RESET ROLE;
      TRUNCATE public.turmas, public.materiais, public.questoes, public.atividades, public.atividade_questoes, public.submissoes;
      SELECT set_config('request.jwt.claim.sub', '${professor}', false);
      INSERT INTO public.turmas VALUES ('${turma}', '${professor}');
      INSERT INTO public.materiais VALUES ('${material}', '${professor}', '${turma}', 'pronto');
      INSERT INTO public.questoes VALUES ('${livre}', '${turma}', '${material}'),
        ('${usada}', '${turma}', '${material}'), ('${rascunho}', '${turma}', '${material}');
      INSERT INTO public.atividades VALUES ('${usada}', true), ('${rascunho}', false);
      INSERT INTO public.atividade_questoes VALUES ('${usada}', '${usada}'), ('${rascunho}', '${rascunho}');
      INSERT INTO public.submissoes VALUES ('${usada}', 100);
    `);
  });

  after(async () => {
    await db.close();
  });

  it("disponibiliza a mesma correção nos diretórios de migração e atualiza o cache da API", () => {
    const migracaoDrizzle = readFileSync(
      new URL("../../drizzle/migrations/0002_exclusao_materiais_questoes.sql", import.meta.url),
      "utf8",
    );
    assert.equal(migracaoSupabase, migracaoDrizzle);
    assert.match(migracaoSupabase, /NOTIFY pgrst, 'reload schema';/);
  });

  it("permite reaplicar a correção sem apagar materiais, questões ou atividades", async () => {
    await db.exec(migracaoSupabase);
    assert.equal((await db.query("SELECT * FROM public.materiais")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM public.questoes")).rows.length, 3);
    assert.equal((await db.query("SELECT * FROM public.atividade_questoes")).rows.length, 2);
    assert.deepEqual((await db.query("SELECT xp FROM public.submissoes")).rows, [{ xp: 100 }]);
    assert.deepEqual(await excluirMaterial(), { excluidas: [], preservadas: 3 });
  });

  it("mantém materiais e questões anteriores ao adicionar outro material", async () => {
    await db.query("INSERT INTO public.materiais VALUES ($1, $2, $3, 'pronto')", [
      outroProfessor,
      professor,
      turma,
    ]);
    assert.equal((await db.query("SELECT * FROM public.materiais")).rows.length, 2);
    assert.equal((await db.query("SELECT * FROM public.questoes")).rows.length, 3);
  });

  it("apaga somente o material por padrão e preserva questões, atividades e XP", async () => {
    await db.exec("SET ROLE authenticated");
    assert.deepEqual(await excluirMaterial(), { excluidas: [], preservadas: 3 });
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM public.materiais")).rows.length, 0);
    assert.equal(
      (await db.query("SELECT * FROM public.questoes WHERE material_id IS NULL")).rows.length,
      3,
    );
    assert.equal((await db.query("SELECT * FROM public.atividade_questoes")).rows.length, 2);
    assert.deepEqual((await db.query("SELECT xp FROM public.submissoes")).rows, [{ xp: 100 }]);
  });

  it("opcionalmente apaga questões sem uso e mantém publicadas e rascunhos", async () => {
    assert.deepEqual(await excluirMaterial(true), { excluidas: [livre], preservadas: 2 });
    assert.equal(
      (await db.query("SELECT * FROM public.questoes WHERE material_id IS NULL")).rows.length,
      2,
    );
  });

  it("exclui em lote sem apagar questões que entraram em uma atividade", async () => {
    assert.deepEqual(await excluirQuestoes([livre, usada, rascunho, livre]), {
      excluidas: [livre],
      preservadas: 2,
    });
    assert.equal((await db.query("SELECT * FROM public.materiais")).rows.length, 1);
  });

  it("não permite excluir questão em uso diretamente pela tabela", async () => {
    await assert.rejects(
      db.query("DELETE FROM public.questoes WHERE id = $1", [usada]),
      /foreign key constraint/,
    );
  });

  it("nega exclusão por outro professor ou sem autenticação", async () => {
    for (const usuario of [outroProfessor, ""]) {
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [usuario]);
      await assert.rejects(excluirMaterial(true), /permissão/);
      await assert.rejects(excluirQuestoes([livre]), /permissão/);
    }
    assert.equal((await db.query("SELECT * FROM public.questoes")).rows.length, 3);
  });

  it("rejeita seleção inválida sem excluir parcialmente o lote", async () => {
    await assert.rejects(excluirQuestoes([livre, outroProfessor]), /não existe mais/);
    await assert.rejects(excluirQuestoes([]), /Selecione/);
    assert.equal((await db.query("SELECT * FROM public.questoes")).rows.length, 3);
  });

  it("não exclui material enquanto a IA está gerando questões", async () => {
    await db.exec("UPDATE public.materiais SET status = 'processando'");
    await assert.rejects(excluirMaterial(true), /Aguarde/);
    assert.equal((await db.query("SELECT * FROM public.materiais")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM public.questoes")).rows.length, 3);
  });
});
