-- Exclusão manual/automática e prazos com hora. Atividades antigas não aderem automaticamente.
BEGIN;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS excluir_ao_vencer boolean NOT NULL DEFAULT false;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS prazo_com_hora boolean NOT NULL DEFAULT false;
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS atividades_exclusao_prazo_check;
ALTER TABLE public.atividades ADD CONSTRAINT atividades_exclusao_prazo_check
  CHECK (NOT excluir_ao_vencer OR (prazo IS NOT NULL AND prazo_com_hora));
CREATE INDEX IF NOT EXISTS atividades_exclusao_prazo_idx ON public.atividades(prazo)
  WHERE excluir_ao_vencer AND publicada;

CREATE SCHEMA IF NOT EXISTS ideon_private;
REVOKE ALL ON SCHEMA ideon_private FROM PUBLIC, anon, authenticated;

-- Somente wrappers autorizados e o agendador chamam esta função.
CREATE OR REPLACE FUNCTION ideon_private.excluir_atividade(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE; ids uuid[]; removidas uuid[];
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  SELECT COALESCE(array_agg(questao_id), ARRAY[]::uuid[]) INTO ids
    FROM public.atividade_questoes WHERE atividade_id = p_id;
  PERFORM id FROM public.questoes WHERE id = ANY(ids) ORDER BY id FOR UPDATE;

  DELETE FROM public.submissoes WHERE atividade_id = p_id;
  DELETE FROM public.atividade_questoes WHERE atividade_id = p_id;
  DELETE FROM public.atividades WHERE id = p_id;
  WITH apagadas AS (
    DELETE FROM public.questoes q WHERE q.id = ANY(ids) AND q.turma_id = a.turma_id
      AND NOT EXISTS (SELECT 1 FROM public.atividade_questoes aq WHERE aq.questao_id = q.id)
    RETURNING q.id
  ) SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO removidas FROM apagadas;
  -- XP/nível/conquistas já recebidos permanecem; os materiais originais também.
  RETURN jsonb_build_object('excluidas', removidas, 'preservadas', cardinality(ids) - cardinality(removidas));
END $$;
REVOKE ALL ON FUNCTION ideon_private.excluir_atividade(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.excluir_atividade_professor(p_atividade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_atividade_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_dono_turma(a.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou sem permissão para excluí-la.';
  END IF;
  RETURN ideon_private.excluir_atividade(a.id);
END $$;
REVOKE ALL ON FUNCTION public.excluir_atividade_professor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_atividade_professor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_prazo_atividade_professor(
  p_atividade_id uuid, p_prazo timestamptz, p_excluir_ao_vencer boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_atividade_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_dono_turma(a.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou sem permissão para alterar o prazo.';
  END IF;
  IF p_prazo IS NOT NULL AND p_prazo <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Escolha uma data e hora futuras.';
  END IF;
  IF p_excluir_ao_vencer AND p_prazo IS NULL THEN
    RAISE EXCEPTION 'Defina uma data e hora para a exclusão automática.';
  END IF;
  UPDATE public.atividades SET prazo = p_prazo, prazo_com_hora = p_prazo IS NOT NULL,
    excluir_ao_vencer = COALESCE(p_excluir_ao_vencer, false) WHERE id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.atualizar_prazo_atividade_professor(uuid, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_prazo_atividade_professor(uuid, timestamptz, boolean) TO authenticated;

-- Atividade e vínculos são publicados juntos, sem intervalo para o agendador apagar uma atividade incompleta.
CREATE OR REPLACE FUNCTION public.criar_atividade_professor(
  p_turma_id uuid, p_titulo text, p_descricao text, p_prazo timestamptz,
  p_xp integer, p_questao_ids uuid[], p_publicada boolean, p_excluir_ao_vencer boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE; quantidade integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dono_turma(p_turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para criar atividades nesta turma.';
  END IF;
  IF COALESCE(length(trim(p_titulo)), 0) = 0 OR p_xp IS NULL OR p_xp < 10 THEN
    RAISE EXCEPTION 'Informe título e XP válidos.';
  END IF;
  IF p_prazo IS NOT NULL AND p_prazo <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'Escolha uma data e hora futuras.'; END IF;
  IF p_excluir_ao_vencer AND p_prazo IS NULL THEN RAISE EXCEPTION 'Defina uma data e hora para a exclusão automática.'; END IF;
  SELECT count(DISTINCT id) INTO quantidade FROM unnest(p_questao_ids) ids(id);
  IF quantidade = 0 OR array_position(p_questao_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos uma questão aprovada.';
  END IF;
  PERFORM id FROM public.questoes WHERE id = ANY(p_questao_ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.questoes WHERE id = ANY(p_questao_ids)
      AND turma_id = p_turma_id AND aprovada AND NOT arquivada) <> quantidade THEN
    RAISE EXCEPTION 'A atividade contém questão arquivada, pendente ou de outra turma.';
  END IF;
  INSERT INTO public.atividades(turma_id, titulo, descricao, prazo, prazo_com_hora, xp, publicada, excluir_ao_vencer)
    VALUES (p_turma_id, trim(p_titulo), COALESCE(p_descricao, ''), p_prazo, p_prazo IS NOT NULL,
      p_xp, COALESCE(p_publicada, false), COALESCE(p_excluir_ao_vencer, false)) RETURNING * INTO a;
  INSERT INTO public.atividade_questoes(atividade_id, questao_id)
    SELECT a.id, id FROM (SELECT DISTINCT unnest(p_questao_ids) id) ids;
  RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.criar_atividade_professor(uuid, text, text, timestamptz, integer, uuid[], boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_atividade_professor(uuid, text, text, timestamptz, integer, uuid[], boolean, boolean) TO authenticated;

-- A proteção é no banco: uma aba já aberta não pode enviar respostas depois do horário.
CREATE OR REPLACE FUNCTION public.get_activity_for_student(p_activity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resultado jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.atividades a WHERE a.id = p_activity_id AND a.publicada
    AND public.is_matriculado(a.turma_id, auth.uid())) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou indisponível';
  END IF;
  SELECT jsonb_build_object('id', a.id, 'titulo', a.titulo, 'descricao', a.descricao,
    'prazo', a.prazo, 'prazo_com_hora', a.prazo_com_hora,
    'questoes', COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
      'assunto', q.assunto, 'dificuldade', q.dificuldade
    ) ORDER BY aq.questao_id) FILTER (WHERE q.id IS NOT NULL), '[]'::jsonb)) INTO resultado
  FROM public.atividades a LEFT JOIN public.atividade_questoes aq ON aq.atividade_id = a.id
  LEFT JOIN public.questoes q ON q.id = aq.questao_id AND q.aprovada
  WHERE a.id = p_activity_id GROUP BY a.id;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.get_activity_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_for_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION ideon_private.validar_prazo_submissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = NEW.atividade_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta atividade foi excluída.'; END IF;
  IF a.prazo_com_hora AND a.prazo <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'O prazo desta atividade encerrou.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ideon_private.validar_prazo_submissao() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validar_prazo_submissao ON public.submissoes;
CREATE TRIGGER validar_prazo_submissao BEFORE INSERT ON public.submissoes
  FOR EACH ROW EXECUTE FUNCTION ideon_private.validar_prazo_submissao();

CREATE OR REPLACE FUNCTION public.excluir_atividades_vencidas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; quantidade integer := 0;
BEGIN
  FOR a IN SELECT id FROM public.atividades
    WHERE publicada AND excluir_ao_vencer AND prazo <= CURRENT_TIMESTAMP
    ORDER BY prazo, id LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM ideon_private.excluir_atividade(a.id);
    quantidade := quantidade + 1;
  END LOOP;
  RETURN quantidade;
END $$;
REVOKE ALL ON FUNCTION public.excluir_atividades_vencidas() FROM PUBLIC, anon, authenticated;

-- Agendamento real no banco: funciona com o navegador fechado. Não usa chaves no frontend.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('ideon-excluir-atividades-vencidas', '* * * * *',
  'SELECT public.excluir_atividades_vencidas()');
NOTIFY pgrst, 'reload schema';
COMMIT;
