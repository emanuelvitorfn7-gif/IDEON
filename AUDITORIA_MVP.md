# Auditoria do MVP Ideon

> Registro histórico de uma etapa anterior do desenvolvimento. As limitações e
> próximas etapas abaixo descrevem aquele momento; o envio de PDF, por exemplo,
> já foi implementado depois. Consulte o [README principal](README.md) para as
> funcionalidades atuais e as instruções de instalação e avaliação.

## O que já existia e foi preservado

- React 19, TypeScript, TanStack Start/Router/Query e Supabase.
- Autenticação com papéis de professor e aluno.
- Criação e ingresso em turmas, materiais em texto, geração de questões via IA, revisão e dashboards.
- Identidade visual, componentes e responsividade existentes.

## Bloqueios encontrados

- O aluno não possuía tela para responder atividades.
- O frontend consultava `questoes` com `select(*)`, expondo `correta` e `explicacao`.
- Correção, XP e streak eram calculados no cliente; um reload/reenvio acumulava XP novamente.
- Publicação não revalidava no banco se todas as questões estavam aprovadas.
- A saída da IA era convertida por cast, sem validação estrutural efetiva.
- PDF não é processado; a interface já informa corretamente a limitação. Extração/OCR exige função backend e storage configurados.
- Não havia ledger de XP, sessões de estudo ou conquistas.
- Havia erros TypeScript de busca opcional, casing de rota e relação Supabase.

## Implementado nesta entrega

- RPCs `get_activity_for_student` e `submit_activity`: payload seguro, correção server-side e transação idempotente.
- `xp_transactions`, `study_sessions`, `achievements` e `user_achievements`, com índices, chaves e RLS.
- Bloqueio de leitura direta de questões por alunos e remoção de escrita direta em XP.
- Tela responsiva de resolução com feedback somente após envio.
- Regras iniciais de XP: +10 por acerto e +20 por atividade concluída.
- Streak com no máximo um avanço diário e conquista inicial/7 dias.
- Validação Zod rigorosa da resposta da IA e edição que remove aprovação automaticamente.
- Rascunho/publicação e validação de questões aprovadas.
- Função central `getLevelFromXP` e testes unitários.

## Próximas fatias recomendadas

1. Processamento de PDF em Edge Function com storage privado e detecção de PDF sem texto.
2. Evolução temporal, ranking por consistência/evolução e análise agregada por aluno/turma/assunto.
3. Missões de recuperação, catálogo visual completo de conquistas e seed de demonstração.
4. Testes de integração das policies/RPCs contra um projeto Supabase local.
