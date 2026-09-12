-- Ideon MVP: submissão/correção atômica, ledger de XP e métricas históricas.
-- Migração incremental: preserva as tabelas e os dados existentes.

CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (reason IN (
    'QUESTION_CORRECT', 'ACTIVITY_COMPLETED', 'MATERIAL_STUDIED',
    'DAILY_CHALLENGE', 'IMPROVEMENT', 'STREAK', 'COLLABORATION'
  )),
  reference_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, reference_id)
);
CREATE INDEX IF NOT EXISTS xp_transactions_user_created_idx
  ON public.xp_transactions (user_id, created_at DESC);
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp proprio leitura" ON public.xp_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('MATERIAL', 'ACTIVITY', 'CHALLENGE')),
  reference_id text NOT NULL,
  study_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, reference_id, study_date)
);
CREATE INDEX IF NOT EXISTS study_sessions_user_date_idx
  ON public.study_sessions (user_id, study_date DESC);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessao propria leitura" ON public.study_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy'
);
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conquistas leitura" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "conquistas proprias leitura" ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.achievements (id, name, description, icon) VALUES
  ('FIRST_ACTIVITY', 'Primeiros passos', 'Complete sua primeira atividade.', 'check'),
  ('STREAK_7', 'Em chamas', 'Estude durante 7 dias consecutivos.', 'flame'),
  ('SHARP_MIND', 'Mente afiada', 'Acerte 50 questões.', 'brain'),
  ('IMPROVEMENT_20', 'Evolução', 'Melhore seu desempenho em 20%.', 'trending-up'),
  ('EXPLORER', 'Explorador', 'Alcance o nível 10.', 'compass')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- A política anterior podia expor correta/explicacao ao aluno via SELECT *.
DROP POLICY IF EXISTS "questoes leitura turma" ON public.questoes;
DROP POLICY IF EXISTS "questoes leitura" ON public.questoes;
CREATE POLICY "questoes professor leitura" ON public.questoes FOR SELECT TO authenticated
  USING (public.is_dono_turma(turma_id, auth.uid()));

-- Alunos recebem somente campos seguros. O gabarito nunca sai desta função.
CREATE OR REPLACE FUNCTION public.get_activity_for_student(p_activity_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resultado jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM atividades a
    WHERE a.id = p_activity_id AND a.publicada
      AND public.is_matriculado(a.turma_id, auth.uid())
  ) THEN RAISE EXCEPTION 'Atividade não encontrada ou indisponível'; END IF;

  SELECT jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'descricao', a.descricao, 'prazo', a.prazo,
    'questoes', COALESCE(jsonb_agg(jsonb_build_object(
      'id', q.id, 'enunciado', q.enunciado, 'alternativas', q.alternativas,
      'assunto', q.assunto, 'dificuldade', q.dificuldade
    ) ORDER BY aq.questao_id) FILTER (WHERE q.id IS NOT NULL), '[]'::jsonb)
  ) INTO resultado
  FROM atividades a
  LEFT JOIN atividade_questoes aq ON aq.atividade_id = a.id
  LEFT JOIN questoes q ON q.id = aq.questao_id AND q.aprovada
  WHERE a.id = p_activity_id GROUP BY a.id;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.get_activity_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_activity_for_student(uuid) TO authenticated;

-- Corrige, registra submissão, XP e sessão numa única transação no banco.
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

  SELECT count(*), count(*) FILTER (WHERE (p_answers ->> q.id::text)::integer = q.correta),
    COALESCE(jsonb_agg(jsonb_build_object('questao_id', q.id, 'assunto', q.assunto,
      'acertou', (p_answers ->> q.id::text)::integer = q.correta,
      'correta', q.correta, 'explicacao', q.explicacao)), '[]'::jsonb)
  INTO total_q, corretas, detalhes
  FROM atividade_questoes aq JOIN questoes q ON q.id = aq.questao_id
  WHERE aq.atividade_id = p_activity_id AND q.aprovada;
  IF total_q = 0 OR jsonb_object_length(p_answers) <> total_q THEN
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

-- O frontend não pode criar submissões, atribuir XP ou editar o próprio total.
DROP POLICY IF EXISTS "submissoes inserir propria" ON public.submissoes;
DROP POLICY IF EXISTS "submissoes atualizar propria" ON public.submissoes;
REVOKE INSERT, UPDATE, DELETE ON public.submissoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.xp_transactions, public.study_sessions, public.user_achievements FROM authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nome) ON public.profiles TO authenticated;
