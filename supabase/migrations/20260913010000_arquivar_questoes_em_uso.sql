-- Remove questões da revisão sem alterar atividades e resultados existentes.
BEGIN;

ALTER TABLE public.questoes ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.remover_questoes_professor(p_turma_id uuid, p_questao_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  excluidas uuid[];
  arquivadas uuid[];
  solicitadas integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dono_turma(p_turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para remover questões desta turma.';
  END IF;
  IF array_position(p_questao_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Seleção de questões inválida.';
  END IF;
  SELECT count(DISTINCT id) INTO solicitadas FROM unnest(p_questao_ids) AS ids(id);
  IF solicitadas = 0 THEN RAISE EXCEPTION 'Selecione pelo menos uma questão.'; END IF;

  -- Impede novos vínculos enquanto decidimos entre exclusão e arquivamento.
  PERFORM id FROM public.questoes
    WHERE id = ANY(p_questao_ids) AND turma_id = p_turma_id ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.questoes WHERE id = ANY(p_questao_ids) AND turma_id = p_turma_id) <> solicitadas THEN
    RAISE EXCEPTION 'Uma questão não existe mais ou não pertence a esta turma. Atualize a lista.';
  END IF;

  WITH alteradas AS (
    UPDATE public.questoes q SET arquivada = true
    WHERE q.id = ANY(p_questao_ids) AND q.turma_id = p_turma_id
      AND EXISTS (SELECT 1 FROM public.atividade_questoes aq WHERE aq.questao_id = q.id)
    RETURNING q.id
  ) SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO arquivadas FROM alteradas;

  WITH removidas AS (
    DELETE FROM public.questoes q
    WHERE q.id = ANY(p_questao_ids) AND q.turma_id = p_turma_id
      AND NOT (q.id = ANY(arquivadas))
    RETURNING q.id
  ) SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO excluidas FROM removidas;

  RETURN jsonb_build_object('excluidas', excluidas, 'arquivadas', arquivadas);
END $$;

REVOKE ALL ON FUNCTION public.remover_questoes_professor(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remover_questoes_professor(uuid, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
