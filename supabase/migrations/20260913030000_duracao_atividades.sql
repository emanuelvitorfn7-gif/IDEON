-- Duração por aluno, obrigatória nas novas atividades. Execute após 20260913020000.
-- As antigas aguardam o professor definir a duração; resultados existentes são preservados.
BEGIN;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS duracao_minutos integer;
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS atividades_duracao_check;
ALTER TABLE public.atividades ADD CONSTRAINT atividades_duracao_check
  CHECK (duracao_minutos BETWEEN 1 AND 240);

CREATE OR REPLACE FUNCTION ideon_private.validar_duracao_atividade()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.duracao_minutos IS NULL AND (TG_OP = 'INSERT' OR OLD.duracao_minutos IS NOT NULL) THEN
    RAISE EXCEPTION 'Escolha a duração da atividade em minutos.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ideon_private.validar_duracao_atividade() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS validar_duracao_atividade ON public.atividades;
CREATE TRIGGER validar_duracao_atividade BEFORE INSERT OR UPDATE ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION ideon_private.validar_duracao_atividade();

CREATE TABLE IF NOT EXISTS ideon_private.tentativas_atividade (
  atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  iniciada_em timestamptz NOT NULL,
  termina_em timestamptz NOT NULL,
  PRIMARY KEY (atividade_id, aluno_id),
  CHECK (termina_em > iniciada_em)
);
-- Sem políticas de acesso direto: somente as funções autorizadas operam o cronômetro.
ALTER TABLE ideon_private.tentativas_atividade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ideon_private.tentativas_atividade FROM PUBLIC, anon, authenticated;

-- Remove as assinaturas antigas para não permitir criar sem duração ou confundir a API.
DROP FUNCTION IF EXISTS public.atualizar_prazo_atividade_professor(uuid, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.criar_atividade_professor(uuid, text, text, timestamptz, integer, uuid[], boolean, boolean);

CREATE OR REPLACE FUNCTION public.atualizar_prazo_atividade_professor(
  p_atividade_id uuid, p_prazo timestamptz, p_excluir_ao_vencer boolean, p_duracao_minutos integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_atividade_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_dono_turma(a.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou sem permissão para alterar o prazo.';
  END IF;
  IF p_duracao_minutos IS NULL OR p_duracao_minutos NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Escolha uma duração entre 1 e 240 minutos.';
  END IF;
  IF p_prazo IS NOT NULL AND p_prazo <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Escolha uma data e hora futuras.';
  END IF;
  IF p_excluir_ao_vencer AND p_prazo IS NULL THEN
    RAISE EXCEPTION 'Defina uma data e hora para a exclusão automática.';
  END IF;
  UPDATE public.atividades SET duracao_minutos = p_duracao_minutos, prazo = p_prazo, prazo_com_hora = p_prazo IS NOT NULL,
    excluir_ao_vencer = COALESCE(p_excluir_ao_vencer, false) WHERE id = a.id;
END $$;
REVOKE ALL ON FUNCTION public.atualizar_prazo_atividade_professor(uuid, timestamptz, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_prazo_atividade_professor(uuid, timestamptz, boolean, integer) TO authenticated;

-- Atividade e vínculos são publicados juntos, sem intervalo para o agendador apagar uma atividade incompleta.
CREATE OR REPLACE FUNCTION public.criar_atividade_professor(
  p_turma_id uuid, p_titulo text, p_descricao text, p_prazo timestamptz,
  p_xp integer, p_questao_ids uuid[], p_publicada boolean, p_excluir_ao_vencer boolean, p_duracao_minutos integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE; quantidade integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dono_turma(p_turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para criar atividades nesta turma.';
  END IF;
  IF COALESCE(length(trim(p_titulo)), 0) = 0 OR p_xp IS NULL OR p_xp < 10 THEN
    RAISE EXCEPTION 'Informe título e XP válidos.';
  END IF;
  IF p_duracao_minutos IS NULL OR p_duracao_minutos NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Escolha uma duração entre 1 e 240 minutos.';
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
  INSERT INTO public.atividades(turma_id, titulo, descricao, prazo, prazo_com_hora, xp, publicada, excluir_ao_vencer, duracao_minutos)
    VALUES (p_turma_id, trim(p_titulo), COALESCE(p_descricao, ''), p_prazo, p_prazo IS NOT NULL,
      p_xp, COALESCE(p_publicada, false), COALESCE(p_excluir_ao_vencer, false), p_duracao_minutos) RETURNING * INTO a;
  INSERT INTO public.atividade_questoes(atividade_id, questao_id)
    SELECT a.id, id FROM (SELECT DISTINCT unnest(p_questao_ids) id) ids;
  RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.criar_atividade_professor(uuid, text, text, timestamptz, integer, uuid[], boolean, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_atividade_professor(uuid, text, text, timestamptz, integer, uuid[], boolean, boolean, integer) TO authenticated;

-- Consultar não inicia o cronômetro nem revela questões antes de iniciar.
CREATE OR REPLACE FUNCTION public.get_activity_for_student(p_activity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.atividades%ROWTYPE;
  t ideon_private.tentativas_atividade%ROWTYPE;
  s public.submissoes%ROWTYPE;
  perguntas jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_activity_id AND publicada;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_matriculado(a.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou indisponível.';
  END IF;
  SELECT * INTO t FROM ideon_private.tentativas_atividade
    WHERE atividade_id = a.id AND aluno_id = auth.uid();
  SELECT * INTO s FROM public.submissoes WHERE atividade_id = a.id AND aluno_id = auth.uid();
  IF t.iniciada_em IS NOT NULL OR s.aluno_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
      'assunto', q.assunto, 'dificuldade', q.dificuldade
    ) ORDER BY q.id), '[]'::jsonb) INTO perguntas
    FROM public.atividade_questoes aq JOIN public.questoes q ON q.id = aq.questao_id
    WHERE aq.atividade_id = a.id AND q.aprovada;
  END IF;
  RETURN jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao,
    'prazo', a.prazo, 'prazo_com_hora', a.prazo_com_hora,
    'duracao_minutos', a.duracao_minutos, 'iniciada_em', t.iniciada_em,
    'termina_em', CASE WHEN t.iniciada_em IS NOT NULL THEN
      LEAST(t.termina_em, CASE WHEN a.prazo_com_hora THEN a.prazo END) END,
    'agora_servidor', clock_timestamp(), 'questoes', perguntas,
    'resultado', CASE WHEN s.aluno_id IS NOT NULL THEN jsonb_build_object(
      'acertos', s.acertos, 'total', s.total, 'xp_ganho', s.xp_ganho,
      'ja_enviada', true, 'detalhes', s.detalhes) END);
END $$;
REVOKE ALL ON FUNCTION public.get_activity_for_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_activity_for_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.iniciar_atividade_aluno(p_activity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE; inicio timestamptz; fim timestamptz;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = p_activity_id AND publicada FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_matriculado(a.turma_id, auth.uid()) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou indisponível.';
  END IF;
  -- Reabrir ou iniciar em outra aba sempre recupera a mesma tentativa, inclusive vencida.
  IF EXISTS (SELECT 1 FROM ideon_private.tentativas_atividade WHERE atividade_id = a.id AND aluno_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.submissoes WHERE atividade_id = a.id AND aluno_id = auth.uid()) THEN
    RETURN public.get_activity_for_student(a.id);
  END IF;
  IF a.duracao_minutos IS NULL THEN
    RAISE EXCEPTION 'O professor precisa definir a duração desta atividade antes do início.';
  END IF;
  inicio := clock_timestamp();
  fim := LEAST(inicio + make_interval(mins => a.duracao_minutos), CASE WHEN a.prazo_com_hora THEN a.prazo END);
  IF fim <= inicio THEN RAISE EXCEPTION 'O prazo desta atividade encerrou.'; END IF;
  INSERT INTO ideon_private.tentativas_atividade(atividade_id, aluno_id, iniciada_em, termina_em)
    VALUES (a.id, auth.uid(), inicio, fim);
  RETURN public.get_activity_for_student(a.id);
END $$;
REVOKE ALL ON FUNCTION public.iniciar_atividade_aluno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_atividade_aluno(uuid) TO authenticated;

-- Esta validação também protege chamadas diretas à correção, fora da interface.
CREATE OR REPLACE FUNCTION ideon_private.validar_prazo_submissao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.atividades%ROWTYPE; fim timestamptz;
BEGIN
  SELECT * INTO a FROM public.atividades WHERE id = NEW.atividade_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta atividade foi excluída.'; END IF;
  SELECT termina_em INTO fim FROM ideon_private.tentativas_atividade
    WHERE atividade_id = a.id AND aluno_id = NEW.aluno_id;
  IF fim IS NULL THEN RAISE EXCEPTION 'Inicie a atividade antes de enviar respostas.'; END IF;
  IF LEAST(fim, CASE WHEN a.prazo_com_hora THEN a.prazo END) <= clock_timestamp() THEN
    RAISE EXCEPTION 'O tempo para responder esta atividade encerrou.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ideon_private.validar_prazo_submissao() FROM PUBLIC, anon, authenticated;

-- Mantém a correção e o XP atômicos, validando as respostas antes de contabilizar.
CREATE OR REPLACE FUNCTION public.submit_activity(p_activity_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); a atividades%ROWTYPE; existente submissoes%ROWTYPE;
  corretas integer := 0; total_q integer := 0; ganho integer := 0;
  detalhes jsonb; xp_total integer; streak_atual integer; ultima date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO a FROM atividades WHERE id = p_activity_id AND publicada FOR UPDATE;
  IF NOT FOUND OR NOT public.is_matriculado(a.turma_id, uid) THEN
    RAISE EXCEPTION 'Atividade não encontrada ou indisponível';
  END IF;
  SELECT * INTO existente FROM submissoes WHERE atividade_id = p_activity_id AND aluno_id = uid;
  IF FOUND THEN
    RETURN jsonb_build_object('acertos', existente.acertos, 'total', existente.total,
      'xp_ganho', existente.xp_ganho, 'ja_enviada', true, 'detalhes', existente.detalhes);
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Respostas inválidas.';
  END IF;
  IF EXISTS (SELECT 1 FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id
    WHERE aq.atividade_id = p_activity_id AND q.aprovada
      AND (NOT p_answers ? q.id::text OR jsonb_typeof(p_answers -> q.id::text) <> 'number'
        OR (p_answers ->> q.id::text) NOT IN ('0','1','2','3'))) THEN
    RAISE EXCEPTION 'Responda todas as questões antes de enviar';
  END IF;
  SELECT count(*), count(*) FILTER (WHERE (p_answers ->> q.id::text)::integer = q.correta),
    COALESCE(jsonb_agg(jsonb_build_object('questao_id', q.id, 'assunto', q.assunto,
      'acertou', (p_answers ->> q.id::text)::integer = q.correta,
      'correta', q.correta, 'explicacao', q.explicacao)), '[]'::jsonb)
  INTO total_q, corretas, detalhes
  FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id
  WHERE aq.atividade_id = p_activity_id AND q.aprovada;
  IF total_q = 0 OR (SELECT count(*) FROM jsonb_object_keys(p_answers)) <> total_q THEN
    RAISE EXCEPTION 'Responda todas as questões antes de enviar';
  END IF;

  ganho := corretas * 10 + 20;
  INSERT INTO submissoes (atividade_id, aluno_id, acertos, total, xp_ganho, detalhes)
    VALUES (p_activity_id, uid, corretas, total_q, ganho, detalhes);
  INSERT INTO xp_transactions (user_id, amount, reason, reference_id)
    SELECT uid, corretas * 10, 'QUESTION_CORRECT', p_activity_id::text WHERE corretas > 0;
  INSERT INTO xp_transactions (user_id, amount, reason, reference_id)
    VALUES (uid, 20, 'ACTIVITY_COMPLETED', p_activity_id::text);
  INSERT INTO study_sessions (user_id, kind, reference_id)
    VALUES (uid, 'ACTIVITY', p_activity_id::text) ON CONFLICT DO NOTHING;

  SELECT ultima_atividade, sequencia INTO ultima, streak_atual FROM profiles WHERE id = uid FOR UPDATE;
  streak_atual := CASE WHEN ultima = CURRENT_DATE THEN streak_atual
    WHEN ultima = CURRENT_DATE - 1 THEN streak_atual + 1 ELSE 1 END;
  SELECT COALESCE(sum(amount), 0) INTO xp_total FROM xp_transactions WHERE user_id = uid;
  UPDATE profiles SET xp = xp_total, nivel = floor(xp_total / 500.0)::integer + 1,
    sequencia = streak_atual, ultima_atividade = CURRENT_DATE WHERE id = uid;
  INSERT INTO user_achievements (user_id, achievement_id) VALUES (uid, 'FIRST_ACTIVITY')
    ON CONFLICT DO NOTHING;
  IF streak_atual >= 7 THEN INSERT INTO user_achievements VALUES (uid, 'STREAK_7', now()) ON CONFLICT DO NOTHING; END IF;
  RETURN jsonb_build_object('acertos', corretas, 'total', total_q, 'xp_ganho', ganho,
    'ja_enviada', false, 'detalhes', detalhes);
END $$;
REVOKE ALL ON FUNCTION public.submit_activity(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_activity(uuid, jsonb) TO authenticated;


NOTIFY pgrst, 'reload schema';
COMMIT;
