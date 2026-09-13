# Ideon — aprender e cuidar de si

O Ideon é um protótipo educacional para o hackathon. Ele ajuda o professor a transformar o conteúdo de uma aula em atividades e oferece ao aluno um espaço para estudar, acompanhar seus resultados e cuidar do bem-estar.

O professor envia um texto ou PDF, pede à inteligência artificial que crie questões, revisa o conteúdo e publica uma atividade. O aluno entra na turma com um código, responde dentro do tempo escolhido pelo professor e recebe feedback e pontos de experiência, chamados **XP**.

A aba **Saúde mental** oferece um check-in de sentimentos, um semáforo de bem-estar, dicas de autocuidado e contatos de ajuda. As respostas dessa aba não são salvas nem enviadas ao professor.

**Este é o guia principal para executar e avaliar a aplicação atual.** Você não precisa saber programar para seguir a instalação.

## Por onde começar

- [O que é necessário](#o-que-é-necessário)
- [Passo a passo para rodar no computador](#passo-a-passo-para-rodar-no-computador)
- [Roteiro para conhecer o protótipo](#roteiro-para-conhecer-o-protótipo)
- [Se algo não funcionar](#se-algo-não-funcionar)
- [Informações para a avaliação técnica](#informações-para-a-avaliação-técnica)

## O que é necessário

| Você vai precisar de… | Para que serve |
| --- | --- |
| Um computador com Windows, macOS ou Linux e internet | A aplicação usa serviços online, mesmo quando aberta no seu computador. |
| [Node.js 24](https://nodejs.org/en/download) | Executa a aplicação. O instalador inclui o npm, que baixa os componentes necessários. |
| Um editor de texto, como o [VS Code](https://code.visualstudio.com/) | Permite abrir a pasta e preencher as configurações. |
| As configurações do Supabase fornecidas pela equipe | O Supabase guarda contas, turmas, materiais e atividades. |
| Uma chave da API Gemini, para gerar questões novas | Autoriza o uso da inteligência artificial do Google. |

**Para os instrutores:** solicitem à equipe as configurações do ambiente de avaliação e, se preferirem, contas de teste de professor e aluno. Não há senha de demonstração embutida nesta versão. Sem a chave de IA, ainda é possível usar atividades que já estejam preparadas no banco.

**Sobre o banco de dados:** este passo a passo usa um projeto Supabase já configurado pela equipe. Os arquivos SQL disponíveis são atualizações de uma estrutura existente; o repositório ainda não contém a instalação completa de um banco vazio. Criar uma conta nova no Supabase, por si só, não prepara o Ideon. Essa é uma limitação atual de reprodução do protótipo.

## Passo a passo para rodar no computador

### 1. Instale o Node.js

Abra o [site oficial do Node.js](https://nodejs.org/en/download), escolha a versão **24** para seu sistema e siga a instalação. Se o VS Code já estiver aberto, feche-o e abra novamente depois.

A versão usada na verificação local deste guia foi **24.14.1**. As dependências atuais exigem pelo menos Node.js **22.12**.

### 2. Baixe e abra o projeto

1. Na página deste repositório no GitHub, clique em **Code → Download ZIP**.
2. Extraia o arquivo ZIP. É necessário trabalhar na pasta extraída, não dentro do ZIP.
3. No VS Code, escolha **Arquivo → Abrir Pasta** e abra a pasta do projeto.
4. Confira se você consegue ver o arquivo `package.json` nessa pasta.
5. Abra **Terminal → Novo Terminal**. O terminal é a área em que você vai digitar os comandos abaixo.

Se você já tem o projeto aberto, não precisa baixá-lo novamente.

Digite um comando por vez e pressione **Enter**:

```sh
node --version
```

```sh
npm --version
```

Os dois devem mostrar números de versão. Se aparecer “comando não encontrado” ou “não é reconhecido”, confira a instalação do Node.js e reabra o terminal.

### 3. Preencha as configurações

Na lista de arquivos do VS Code:

1. Localize [.env.example](.env.example).
2. Faça uma cópia desse arquivo na mesma pasta.
3. Renomeie a cópia para **`.env`**, exatamente assim, sem `.txt` no final.
4. Preencha os valores depois do sinal `=` e salve.

Se já existe um `.env` configurado, preserve-o. Não substitua suas configurações pelo arquivo de exemplo vazio.

O conteúdo terá este formato. Os textos abaixo são exemplos, não credenciais válidas:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=COLE_A_CHAVE_PUBLICAVEL
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=COLE_A_MESMA_CHAVE_PUBLICAVEL
GEMINI_API_KEY=COLE_A_CHAVE_DA_API_GEMINI
```

- As duas linhas terminadas em `URL` recebem **o mesmo endereço**.
- As duas linhas terminadas em `PUBLISHABLE_KEY` recebem **a mesma chave publicável**.
- `GEMINI_API_KEY` recebe a chave da API Gemini. Pode ficar vazia para uma avaliação com questões já geradas; gerar questões novas exigirá uma chave válida.

**Onde encontrar esses valores:**

- **Supabase:** peça à equipe os dados do projeto de avaliação. Quem administra o projeto pode encontrá-los em **Connect** ou na área de chaves da configuração do projeto. Use a chave **publishable**, ou a antiga chave **anon**; não use `service_role` nem `sb_secret_`. Consulte a [documentação oficial de chaves](https://supabase.com/docs/guides/getting-started/api-keys).
- **Gemini:** a chave pode ser criada no [Google AI Studio](https://aistudio.google.com/apikey). As [instruções oficiais](https://ai.google.dev/gemini-api/docs/api-key) explicam a configuração e as restrições de uso. O acesso depende da disponibilidade do serviço, do modelo e da cota da conta; não há promessa de uso ilimitado ou gratuito.

O `.env` contém configurações privadas: não o publique no GitHub nem inclua suas chaves em capturas de tela. A chave Gemini deve permanecer em `GEMINI_API_KEY`, sem o prefixo `VITE_`.

### 4. Instale os componentes da aplicação

No terminal, dentro da pasta que contém `package.json`, execute:

```sh
npm install
```

Aguarde até o terminal terminar e permitir digitar novamente. Esse comando baixa os componentes necessários e cria uma pasta chamada `node_modules`. Na primeira execução, pode demorar alguns minutos.

### 5. Inicie o Ideon

Execute:

```sh
npm run dev
```

Deixe esse terminal aberto enquanto estiver usando a aplicação. Ele deve informar um endereço local, normalmente:

**http://localhost:8080**

Abra esse endereço no navegador. Se o terminal mostrar outra porta, use o endereço que ele informar. `localhost` significa “este computador”; não é um site público.

A tela inicial do Ideon deve aparecer. Cadastro, login, turmas e atividades dependem da conexão com o Supabase configurado no passo 3.

### 6. Pare e abra novamente quando quiser

Para desligar a aplicação, clique no terminal e pressione **Ctrl + C**.

Para abrir em outro momento, volte à pasta e execute novamente:

```sh
npm run dev
```

Não é necessário copiar o `.env` ou instalar tudo de novo a cada uso. Depois de alterar o `.env`, pare e reinicie a aplicação para que ela leia os novos valores.

## Roteiro para conhecer o protótipo

### Como professor

1. Na tela inicial, crie uma conta escolhendo **Professor**, ou entre com a conta de avaliação.
2. Se o ambiente pedir confirmação de e-mail, abra a mensagem recebida e confirme o cadastro antes de entrar.
3. Crie uma turma e anote o código de entrada.
4. Abra a turma e adicione um material: um texto com pelo menos 50 caracteres ou um PDF com texto selecionável.
5. Escolha de **1 a 30 questões** e clique para gerar. Essa etapa usa a chave Gemini configurada.
6. Revise as perguntas e as respostas corretas. Edite o que for necessário e aprove as questões.
7. Selecione as questões aprovadas que entrarão na atividade e clique em **+ Nova**, na área de atividades.
8. Preencha o título e a **duração por aluno**, entre **1 e 240 minutos**. O prazo final com data e hora é opcional e usa o horário de Brasília.
9. Publique a atividade para a turma.

Para testar sem IA, a equipe precisa deixar questões ou atividades preparadas no ambiente de avaliação. A aplicação atual não gera questões fictícias automaticamente quando a chave está ausente.

### Como aluno

1. Use uma janela anônima ou outro navegador para manter professor e aluno conectados ao mesmo tempo.
2. Crie uma conta escolhendo **Aluno**, ou use uma conta de avaliação.
3. Entre na turma com o código recebido do professor.
4. Abra uma atividade e leia as instruções.
5. Clique em **Iniciar atividade**. O cronômetro começa nesse momento.
6. Responda todas as questões e clique em **Enviar respostas** antes do tempo terminar.
7. Veja os acertos, as explicações e o XP recebido.

O tempo é individual e continua ao fechar ou atualizar a página. Vale o que terminar primeiro: a duração da tentativa ou o prazo final da atividade. **Não há envio automático ao zerar o cronômetro.** As alternativas marcadas e ainda não enviadas não são salvas ao fechar ou atualizar a página.

### Saúde mental

Abra **Saúde mental** no menu, disponível para ambos os perfis. Escolha **Bem**, **Mais ou menos** ou **Mal** e observe a mensagem de acolhimento e o semáforo. Também é possível escolher **Prefiro não responder**.

As dicas e os contatos de apoio ficam disponíveis independentemente da resposta. O semáforo representa a escolha da pessoa, não um diagnóstico. Essa página não faz atendimento nem aciona ajuda automaticamente. A resposta é apagada ao sair ou atualizar a página.

### Outras funções para demonstrar

- Filtrar questões por material e remover várias de uma vez.
- Excluir um material escolhendo se deseja remover também suas questões sem uso.
- Arquivar questões que já fazem parte de atividades, preservando esses vínculos.
- Excluir uma atividade e suas questões exclusivas; questões compartilhadas com outras atividades permanecem.
- Ajustar prazo e duração. A mudança de duração vale para quem ainda não iniciou.
- Marcar, opcionalmente, a exclusão automática da atividade no prazo final. Essa opção também remove seus resultados e questões exclusivas. A limpeza verifica os prazos a cada minuto.

Adicionar um material novo não apaga os anteriores. As confirmações de exclusão usam o visual do sistema.

## Se algo não funcionar

| O que apareceu | O que fazer |
| --- | --- |
| `npm` ou `node` não é reconhecido | Instale o Node.js e reabra o VS Code e o terminal. |
| O PowerShell bloqueou `npm.ps1` | No menu do terminal do VS Code, abra **Prompt de Comando** e execute o comando por lá. Não é necessário mudar a política de segurança do Windows. |
| Erro mencionando `package.json` não encontrado | Abra o terminal na pasta principal extraída do projeto, onde esse arquivo está. |
| Falha ao baixar componentes | Confira a internet e a versão do Node.js. Guarde a mensagem de erro para a equipe identificar o problema. |
| O navegador não abre o endereço local | Confira se `npm run dev` continua aberto e copie o endereço mostrado no terminal. |
| Porta 8080 em uso | Confira se o Ideon já está aberto em outro terminal. Você pode usar essa execução ou encerrá-la antes de abrir outra. |
| `Missing Supabase environment variable` | Confira o nome `.env` e preencha os quatro campos de URL/chave Supabase. Reinicie a aplicação. |
| Login não funciona após o cadastro | Confira e-mail e senha, a confirmação de e-mail e se o projeto Supabase está disponível. |
| Cadastro funciona, mas o painel fica carregando | Peça à equipe para conferir o perfil e o papel da conta no Supabase. Esses registros dependem da configuração inicial do banco. |
| “Chave de IA indisponível” | Preencha `GEMINI_API_KEY` com uma chave válida e reinicie. |
| Erro 429 ou limite da IA | Aguarde a liberação da cota ou peça à equipe para conferir a conta Gemini. |
| Outra falha da IA, como 403 ou 404 | A equipe deve conferir as permissões da chave e a disponibilidade do modelo usado em `src/lib/ia.functions.ts`. |
| PDF não gera texto | Use um PDF com texto selecionável, até 10 MB e 100 páginas. Fotos e páginas escaneadas precisam ser convertidas em texto antes. |
| “Configuração ainda não foi concluída” ou função não encontrada | A equipe precisa conferir as atualizações SQL do projeto Supabase. Reinstalar o aplicativo não atualiza o banco. |
| Atividade antiga pede duração | O professor deve abrir **Ajustar prazo e duração** e escolher os minutos. |

## Informações para a avaliação técnica

Esta seção é complementar. Não é necessário executar seus comandos para experimentar o protótipo em um ambiente já preparado.

### Aplicação atual e arquivos antigos

A aplicação deste guia usa **React, TypeScript, TanStack Start e Supabase**, com IA pela **API Gemini**. A interface usa Tailwind CSS e componentes Radix; a leitura de PDFs usa PDF.js.

Também existem arquivos de uma versão anterior em **Python/Flask**, como `app.py`, `db.py`, `requirements.txt`, `templates/` e `static/`. Eles foram preservados como código anterior e não são executados por `npm run dev`. As contas e os dados de demonstração de `demo.py` pertencem à versão Python, não ao aplicativo atual.

| Local | O que contém |
| --- | --- |
| `src/routes/` | Páginas de entrada, professor, aluno, turma e saúde mental. |
| `src/components/ideon/` | Telas e componentes próprios do Ideon. |
| `src/components/ui/` | Componentes visuais reutilizáveis, como botões e modais. |
| `src/services/ideon.ts` | Operações de turmas, materiais, questões e atividades. |
| `src/lib/` | Geração por IA, leitura de PDF, duração, datas, XP e testes. |
| `src/integrations/supabase/` | Conexão e autenticação no Supabase. |
| `supabase/migrations/` | Atualizações de materiais, questões, atividades e cronômetro. |
| `drizzle/migrations/` | Atualizações anteriores de permissões e correção de atividades. |
| `.env.example` | Modelo de configuração, sem chaves reais. |
| `package.json` | Comandos e dependências da aplicação atual. |
| `bun.lock` | Versões de dependências registradas pelo Bun. |

As páginas seguem a convenção de rotas por arquivo do TanStack: `src/routes/saude-mental.tsx`, por exemplo, corresponde a `/saude-mental`. O layout principal está em `src/routes/__root.tsx`; `src/routeTree.gen.ts` é gerado automaticamente. Não crie uma segunda estrutura de páginas em `src/pages/` ou `app/`, nem edite o arquivo de rotas gerado manualmente.

### Preparação do Supabase — responsável pelo ambiente

O avaliador que recebeu um ambiente pronto pode pular esta seção. Não execute novamente migrações antigas em um projeto atualizado.

A estrutura inicial deve ter sido preparada pela equipe, incluindo tabelas como `profiles`, `user_roles`, `turmas`, `matriculas`, `materiais`, `questoes`, `atividades`, `atividade_questoes` e `submissoes`, as funções de permissão e a criação de perfis no cadastro. **O SQL dessa instalação inicial completa ainda não está neste repositório.** `drizzle/schema.ts` está vazio e não serve para reconstruí-la.

Sobre essa estrutura existente, o histórico de atualizações é:

| Ordem | Arquivo | Finalidade |
| --- | --- | --- |
| 1 | [0000_ideon_schema.sql](drizzle/migrations/0000_ideon_schema.sql) | Ajustar quem pode consultar perfis. Apesar do nome, não cria as tabelas iniciais. |
| 2 | [0001_secure_mvp.sql](drizzle/migrations/0001_secure_mvp.sql) | Correção de atividades no servidor, registro de XP e permissões. |
| 3 | [20260913000000_exclusao_materiais_questoes.sql](supabase/migrations/20260913000000_exclusao_materiais_questoes.sql) | Exclusão opcional de materiais e questões. |
| 4 | [20260913010000_arquivar_questoes_em_uso.sql](supabase/migrations/20260913010000_arquivar_questoes_em_uso.sql) | Arquivamento de questões vinculadas a atividades. |
| 5 | [20260913020000_exclusao_atividades_prazo.sql](supabase/migrations/20260913020000_exclusao_atividades_prazo.sql) | Exclusão de atividades, prazos e agendamento automático. |
| 6 | [20260913030000_duracao_atividades.sql](supabase/migrations/20260913030000_duracao_atividades.sql) | Duração obrigatória, tentativas individuais e proteção do cronômetro. |

Para uma atualização pendente, abra o **SQL Editor** do projeto correto, cole o arquivo inteiro, execute e confirme o resultado. Respeite a ordem e aplique apenas o que falta. Não reaplique a etapa 2 ou a etapa 5 depois da etapa 6: elas contêm versões anteriores das funções. A cópia `drizzle/migrations/0002_exclusao_materiais_questoes.sql` equivale à etapa 3 e não precisa ser executada além dela.

A limpeza automática depende de `pg_cron`, instalado pela etapa 5. Há explicações e consultas de conferência em [EXCLUSAO_MATERIAIS.md](EXCLUSAO_MATERIAIS.md). Não use `drizzle push` para preparar o banco: o schema local não representa a estrutura em uso. Confira também o projeto antes de usar a CLI; o identificador em `supabase/config.toml` não é lido pela aplicação e pode divergir do ambiente configurado no `.env`.

Para confirmar cadastros por e-mail no ambiente local, o administrador deve autorizar o endereço local usado pela aplicação nas configurações de redirecionamento do Supabase. Veja a [documentação de redirecionamentos de autenticação](https://supabase.com/docs/guides/auth/redirect-urls).

### Verificações do código

Com as dependências instaladas, execute:

```sh
npm run typecheck
```

Verifica os tipos e as conexões entre partes do código.

```sh
npm run build
```

Gera a versão compilada da aplicação. Isso não publica o projeto na internet nem aplica SQL no Supabase.

Os testes da aplicação atual usam **Bun**, que é uma ferramenta separada do Node.js. Para executá-los, instale-o pelas [instruções oficiais do Bun](https://bun.sh/docs/installation) e use:

```sh
bun test
```

Os testes incluem datas, PDF, validação de questões, XP e funções SQL de exclusão e duração. O PostgreSQL temporário dos testes usa PGlite; eles não apagam dados do Supabase da equipe nem fazem chamadas pagas à IA. O agendador `pg_cron` é simulado: seu funcionamento remoto deve ser conferido no projeto Supabase.

Para instalar exatamente as versões registradas no `bun.lock`, use **`bun install --frozen-lockfile` no lugar de `npm install`**. O caminho com npm é oferecido para facilitar a execução, mas não usa o lockfile do Bun.

Também existe `npm run lint`. Ele verifica o repositório inteiro e pode apontar pendências de formatação em arquivos anteriores; não deve ser interpretado como garantia de que todo o código está sem pendências.

### Regras e limites do protótipo

- A correção registra **10 XP por acerto e 20 XP pela conclusão**, sem duplicar pontos ao reenviar a mesma atividade. Cada nível corresponde a **500 XP**. O campo de XP exibido na criação da atividade não muda essa regra de correção nesta versão.
- PDFs precisam conter texto selecionável. O limite é de **10 MB**, **100 páginas** e **100 mil caracteres** de conteúdo; não há reconhecimento de texto em imagens (OCR).
- A IA usa o material como base, mas o professor deve conferir e aprovar as questões antes de publicar. O uso depende de chave, cota e acesso ao modelo configurado.
- A duração é validada no banco. O cronômetro não reinicia ao atualizar a página; as respostas ainda não enviadas, porém, não têm salvamento automático.
- A exclusão de atividades remove seus resultados e questões exclusivas, mas preserva o XP já recebido e as questões usadas em outras atividades.
- O check-in de saúde mental não é um registro clínico, não usa IA e não mantém histórico. As orientações e os contatos têm links para suas fontes na própria página.
- Não há modo offline completo nem instalação automatizada de um Supabase vazio nesta entrega.

O arquivo [AUDITORIA_MVP.md](AUDITORIA_MVP.md) registra uma etapa anterior do desenvolvimento. Para comportamento e instruções atuais, use este README.

O projeto é conectado ao Lovable. Quem contribuir com código deve preservar o histórico de commits já publicado, conforme [AGENTS.md](AGENTS.md).
