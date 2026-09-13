# Exclusão opcional de materiais e questões

Na turma do professor, cada material tem um botão **Excluir**. A confirmação
mantém as questões por padrão. A opção de apagar também as questões remove
apenas as que não estão vinculadas a atividades, incluindo rascunhos.
Adicionar outro material não remove nenhum material ou questão anterior.

Em **Revisão de questões**, filtre pelo material e use **Selecionar para remover**.
É possível marcar algumas questões ou todas as questões exibidas pelo filtro, inclusive
as antigas que já estão em atividades. A ação usa o modal do sistema. Questões sem
vínculo são excluídas; questões em atividades ou rascunhos são arquivadas e deixam
a revisão, mantendo seus vínculos e os resultados dos alunos. A seleção para excluir é independente da seleção
para publicar uma atividade. Trocar o filtro limpa as seleções; questões cujo
material foi apagado continuam acessíveis em **Sem material**.

## Atualização: questões antigas e modais

A remoção individual e em lote usa o mesmo modal visual do sistema. Não há
`window.confirm`, `alert` ou `prompt`; o ESLint impede reintroduzir essas chamadas.

Se a primeira migração já foi aplicada, execute somente o arquivo novo no SQL Editor:

`supabase/migrations/20260913010000_arquivar_questoes_em_uso.sql`

Ele adiciona o estado de arquivamento e a função `remover_questoes_professor`.
Executar a migração não remove nem arquiva questões existentes. As mudanças só
ocorrem após a confirmação do professor na aplicação. Não altere a migração antiga.
Depois de executar com sucesso, recarregue a aplicação.

Valide: cancelar o modal não muda a lista; confirmar um lote misto exclui questões
sem uso e arquiva as vinculadas; recarregar mantém as antigas fora da revisão;
a atividade original continua com as mesmas questões e resultados.

Essa migração ainda precisa ser aplicada no Supabase: o ambiente local não tem
credenciais administrativas para executar o SQL remoto.

## Atualização: exclusão de atividades e prazo com hora

Depois das migrações anteriores, execute o conteúdo completo de:

`supabase/migrations/20260913020000_exclusao_atividades_prazo.sql`

O arquivo `20260913010000_arquivar_questoes_em_uso.sql` trata de questões; ele não
instala a exclusão de atividades. Se a mensagem aparecer ao clicar em **Excluir**
numa atividade, a etapa necessária é o arquivo novo com final `atividades_prazo.sql`.
Você pode reutilizar a mesma aba do SQL Editor: substitua o texto pelo arquivo novo
e clique em **Run**. Após sucesso, atualize a aplicação com F5.

Esta atualização instala a criação atômica de atividades, edição do prazo,
exclusão manual e agendamento de limpeza. Ela não exclui registros durante a
instalação e mantém a exclusão automática desativada nas atividades existentes.

- **Excluir** abre o modal do sistema. Apaga a atividade, seus resultados e as
  questões sem vínculo com outras atividades, inclusive questões arquivadas.
  Questões compartilhadas, materiais e XP já conquistado permanecem.
- **Ajustar prazo** permite mudar a data e a hora e ligar/desligar a exclusão
  automática. O formulário de criação oferece a mesma opção, desmarcada por padrão.
- O horário é de Brasília (UTC−3); `14/02/2026 23:59h` é salvo como
  `2026-02-15T02:59:00Z`. Datas antigas sem hora mantêm sua apresentação até a edição.
- Para prazos novos com hora, o banco recusa respostas após o encerramento,
  mesmo se o aluno tiver deixado uma aba aberta. Sem exclusão automática,
  a atividade permanece disponível para consulta.
- Com a opção marcada, somente atividades publicadas vencidas são excluídas.
  O agendamento verifica os prazos a cada minuto, em lotes de até 100 atividades.
  As listas na aplicação consultam atualizações a cada 30 segundos.

A migração usa [Supabase Cron](https://supabase.com/docs/guides/cron), com `pg_cron`,
para executar a limpeza mesmo sem navegadores abertos. Para conferir a instalação,
execute estas consultas de leitura no SQL Editor:

```sql
SELECT to_regprocedure('public.excluir_atividade_professor(uuid)') AS excluir_atividade;
SELECT jobname, schedule, active
FROM cron.job WHERE jobname = 'ideon-excluir-atividades-vencidas';
```

A função deve existir e o agendamento deve estar ativo, com `* * * * *`.
Se a instalação falhar ao habilitar `pg_cron`, confira em **Integrations → Cron**
ou **Database → Extensions** se a extensão está disponível/habilitada e envie o
erro exato. A migração é transacional; não execute apenas trechos dela para
contornar um erro.

Os testes executam as funções de exclusão, autorização, publicação e vencimento
em PostgreSQL via PGlite. O registro do cron é simulado e seu comando real é
executado nos testes; o processo agendador do Supabase precisa ser conferido no
ambiente remoto. A migração ainda não foi aplicada remotamente pelo agente,
pois não há credenciais administrativas disponíveis.

## Atualização: duração obrigatória por aluno

Após a migração de exclusão de atividades e prazo, execute **todo o conteúdo** de:

`supabase/migrations/20260913030000_duracao_atividades.sql`

No SQL Editor do mesmo projeto, substitua o texto da aba por esse arquivo, clique
em **Run** e aguarde o sucesso. Depois atualize a aplicação. Salvar o arquivo no
VS Code não aplica a mudança no Supabase. Execute as migrações em ordem; não
reaplique uma migração antiga depois desta, pois ela substituiria as funções atuais.

- O professor deve escolher de **1 a 240 minutos**, tanto para publicar quanto
  para salvar um rascunho. O campo não vem preenchido automaticamente.
- Nas atividades existentes, use **Ajustar prazo e duração**. Nenhum tempo é
  atribuído automaticamente: alunos que ainda não responderam aguardam essa
  configuração. Resultados já enviados permanecem disponíveis.
- Abrir a atividade mostra as instruções. **Iniciar atividade** registra o início
  individual no servidor e libera as questões. Consultar a atividade não inicia
  o tempo. Fechar, atualizar a página ou iniciar em outra aba recupera o mesmo
  horário de término, sem renová-lo.
- A contagem usa o horário do servidor e encerra na duração ou no prazo final,
  o que chegar primeiro. O banco também recusa envios atrasados. **Não há envio
  automático**: o aluno deve enviar todas as respostas antes de o tempo terminar.
- Alterar a duração vale para alunos que ainda não iniciaram. O prazo final pode
  encerrar tentativas em andamento antes do tempo individual; estender o prazo
  não prolonga o término já registrado para a tentativa.
- A exclusão automática continua sendo uma opção independente por atividade,
  baseada na data e hora final. O fim do cronômetro de um aluno não exclui a
  atividade da turma.

Verifique com uma atividade de 1 minuto: abra como aluno, confira que as questões
só aparecem após iniciar, atualize a página e veja que o tempo continua. Tente
enviar depois de zerar. Em outra atividade, envie antes do limite e confirme que
o resultado e o XP permanecem ao consultar novamente.

Os testes locais executam as funções reais de início e correção no PostgreSQL
via PGlite, incluindo autorização, vencimento, retomada e não duplicação de XP.
A aplicação desta migração no banco remoto continua sendo necessária.

## Aplicação inicial no Supabase

Se aparecer **“A exclusão ainda não está disponível”**, a API retornou `PGRST202`:
ela não encontrou a função de exclusão com os parâmetros usados pela aplicação.
Isso ocorre quando a migração não foi aplicada no banco correto ou o cache da API
ainda não foi atualizado. Salvar o arquivo SQL no código ou recompilar o frontend
não executa a migração no banco remoto.

Para ativar:

1. Abra o projeto Supabase correspondente ao endereço `VITE_SUPABASE_URL` do `.env`.
   No ambiente verificado, a referência é `axrupgwpvomafyuhicsn`.
2. No **SQL Editor → New query**, cole o conteúdo completo de
   `supabase/migrations/20260913000000_exclusao_materiais_questoes.sql`.
3. Clique em **Run**. Aguarde o sucesso da execução.
4. Recarregue a aplicação e tente excluir o material novamente.

A migração também mantém uma cópia em
`drizzle/migrations/0002_exclusao_materiais_questoes.sql` para compatibilidade.
Execute apenas uma das cópias. A pasta `supabase/migrations` permite que ferramentas
de migração do Supabase encontrem o arquivo; a aplicação no banco continua necessária.

A migração é transacional e não apaga registros existentes. Ela configura a
preservação das questões ao remover um material, impede a exclusão de questões
vinculadas a atividades e cria duas funções com validação do professor responsável.
O arquivo pode ser executado novamente. Não execute `drizzle push`: o schema local
não representa todas as tabelas existentes no Supabase.

A última instrução antes do commit é `NOTIFY pgrst, 'reload schema'`, que solicita
a [atualização do cache da API](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema).
Se o SQL já foi aplicado no projeto correto e apenas o cache está desatualizado,
essa instrução também pode ser executada sozinha no SQL Editor.

Para conferir a instalação, execute esta consulta de leitura no mesmo SQL Editor:

```sql
SELECT
  to_regprocedure('public.excluir_material_professor(uuid,boolean)') AS excluir_material,
  to_regprocedure('public.excluir_questoes_professor(uuid,uuid[])') AS excluir_questoes;
```

As duas colunas devem exibir o nome de suas funções, em vez de `NULL`.

Esta migração não foi aplicada ao banco remoto pelo agente: o ambiente só possui
as chaves públicas do Supabase, sem conexão administrativa para migrações.

## Verificação

`bun test` executa a migração em PostgreSQL temporário com PGlite, verifica exclusão
individual/em lote, autorização, preservação de atividades e dados de submissão,
e bloqueio de exclusão de material durante geração.

Após aplicar a migração, confira com uma conta de professor: cancelar a exclusão,
excluir material mantendo questões, excluir material com questões sem uso,
filtrar por material e excluir um lote. Confira também que uma atividade já
publicada continua disponível ao aluno com suas questões e resultado anteriores.
