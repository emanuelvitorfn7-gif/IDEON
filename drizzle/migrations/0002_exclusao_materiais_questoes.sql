-- Exclusão explícita e atômica: materiais nunca são apagados ao adicionar outro.
-- O material pode ser removido mantendo suas questões e as atividades existentes.
BEGIN;

ALTER TABLE public.questoes DROP CONSTRAINT IF EXISTS questoes_material_id_fkey;
ALTER TABLE public.questoes ADD CONSTRAINT questoes_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.materiais(id) ON DELETE SET NULL;

-- Impede que a exclusão de uma questão remova silenciosamente parte de uma atividade.
ALTER TABLE public.atividade_questoes DROP CONSTRAINT IF EXISTS atividade_questoes_questao_id_fkey;
ALTER TABLE public.atividade_questoes ADD CONSTRAINT atividade_questoes_questao_id_fkey
  FOREIGN KEY (questao_id) REFERENCES public.questoes(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.excluir_questoes_professor(p_turma_id uuid, p_questao_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  excluidas uuid[];
  solicitadas integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dono_turma(p_turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para excluir questões desta turma.';
  END IF;
  SELECT count(DISTINCT id) INTO solicitadas FROM unnest(p_questao_ids) AS ids(id);
  IF solicitadas = 0 THEN RAISE EXCEPTION 'Selecione pelo menos uma questão.'; END IF;

  -- O bloqueio também impede novos vínculos enquanto a exclusão está em andamento.
  PERFORM id FROM public.questoes
    WHERE id = ANY(p_questao_ids) AND turma_id = p_turma_id ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.questoes WHERE id = ANY(p_questao_ids) AND turma_id = p_turma_id) <> solicitadas THEN
    RAISE EXCEPTION 'Uma questão não existe mais ou não pertence a esta turma. Atualize a lista.';
  END IF;

  WITH removidas AS (
    DELETE FROM public.questoes q
    WHERE q.id = ANY(p_questao_ids) AND q.turma_id = p_turma_id
      AND NOT EXISTS (SELECT 1 FROM public.atividade_questoes aq WHERE aq.questao_id = q.id)
    RETURNING q.id
  ) SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO excluidas FROM removidas;
  RETURN jsonb_build_object('excluidas', excluidas, 'preservadas', solicitadas - cardinality(excluidas));
END $$;

CREATE OR REPLACE FUNCTION public.excluir_material_professor(p_material_id uuid, p_excluir_questoes boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  material public.materiais%ROWTYPE;
  questao_ids uuid[];
  resultado jsonb := jsonb_build_object('excluidas', ARRAY[]::uuid[], 'preservadas', 0);
BEGIN
  SELECT * INTO material FROM public.materiais WHERE id = p_material_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR material.professor_id <> auth.uid()
    OR NOT public.is_dono_turma(material.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Material não encontrado ou sem permissão para excluí-lo.';
  END IF;
  IF material.status = 'processando' THEN
    RAISE EXCEPTION 'Aguarde a geração de questões terminar antes de excluir o material.';
  END IF;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO questao_ids
    FROM public.questoes WHERE material_id = material.id;
  IF p_excluir_questoes AND cardinality(questao_ids) > 0 THEN
    resultado := public.excluir_questoes_professor(material.turma_id, questao_ids);
  ELSE
    resultado := jsonb_build_object('excluidas', ARRAY[]::uuid[], 'preservadas', cardinality(questao_ids));
  END IF;
  DELETE FROM public.materiais WHERE id = material.id;
  RETURN resultado;
END $$;

REVOKE ALL ON FUNCTION public.excluir_questoes_professor(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_material_professor(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_questoes_professor(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_material_professor(uuid, boolean) TO authenticated;

-- Publica as funções novas no cache da API após o commit.
NOTIFY pgrst, 'reload schema';

COMMIT;
