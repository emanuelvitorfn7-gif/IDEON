# Exclusão opcional de materiais e questões

Na turma do professor, cada material tem um botão **Excluir**. A confirmação
mantém as questões por padrão. A opção de apagar também as questões remove
apenas as que não estão vinculadas a atividades, incluindo rascunhos.
Adicionar outro material não remove nenhum material ou questão anterior.

Em **Revisão de questões**, filtre pelo material e use **Selecionar para excluir**.
É possível marcar algumas questões ou todas as questões sem uso exibidas pelo filtro.
A exclusão exige confirmação. A seleção para excluir é independente da seleção
para publicar uma atividade. Trocar o filtro limpa as seleções; questões cujo
material foi apagado continuam acessíveis em **Sem material**.

## Aplicação no Supabase

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
