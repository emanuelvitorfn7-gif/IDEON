-- Corrige RLS de public.profiles: a policy original usava USING (true),
-- permitindo que qualquer usuário autenticado lesse o perfil de qualquer
-- outro (inclusive alunos de turmas de outros professores).
-- Agora só é permitido ler: o próprio perfil, o perfil de alunos
-- matriculados em turma(s) que você leciona, ou o perfil de colegas
-- matriculados na(s) mesma(s) turma(s) que você.

DROP POLICY IF EXISTS "perfil proprio leitura" ON public.profiles;

CREATE POLICY "perfil leitura turma" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.aluno_id = profiles.id
        AND (
          public.is_dono_turma(m.turma_id, auth.uid())
          OR public.is_matriculado(m.turma_id, auth.uid())
        )
    )
  );