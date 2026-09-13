# Ideon

> Aprender, evoluir e cuidar de si.

O **Ideon** é uma plataforma educacional gamificada criada para um hackathon. O professor transforma materiais didáticos em atividades com apoio de IA, o aluno recebe feedback e acompanha sua evolução, e os resultados geram indicadores para orientar a turma.

O MVP também oferece um check-in privado de saúde mental com orientações de autocuidado. Essa área não realiza diagnóstico, não salva respostas e não compartilha informações com professores.

## Sumário

- [Problema e objetivo](#problema-e-objetivo)
- [Solução e diferenciais](#solução-e-diferenciais)
- [Público-alvo](#público-alvo)
- [Funcionalidades](#funcionalidades)
- [Fluxos](#fluxos)
- [Arquitetura e tecnologias](#arquitetura-e-tecnologias)
- [Supabase e segurança](#supabase-e-segurança)
- [IA e gamificação](#ia-e-gamificação)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como executar](#como-executar)
- [Banco e migrations](#banco-e-migrations)
- [Testes](#testes)
- [Roteiro para o hackathon](#roteiro-para-o-hackathon)
- [Limitações e próximos passos](#limitações-e-próximos-passos)
- [Equipe e créditos](#equipe-e-créditos)

## Problema e objetivo

Professores gastam tempo criando exercícios, corrigindo respostas e consolidando indicadores. Alunos, por sua vez, frequentemente recebem pouco retorno imediato e têm dificuldade para perceber sua evolução.

O Ideon busca reduzir esse trabalho operacional e aumentar o engajamento por meio de atividades contextualizadas, feedback, dados e gamificação, sem retirar do professor o controle pedagógico.

## Solução e diferenciais

1. O professor cria uma turma e envia texto ou PDF.
2. A IA gera questões baseadas no material.
3. O professor revisa, edita e aprova cada questão.
4. A atividade é publicada com duração e prazo opcional.
5. O aluno responde e recebe correção, explicações e XP.
6. O professor acompanha participação, desempenho e dificuldades.

Os diferenciais do MVP são a geração contextualizada, a revisão humana obrigatória, a correção protegida no banco, a gamificação integrada e a experiência de bem-estar sem coleta clínica.

## Público-alvo

- **Professores:** criação de conteúdo e acompanhamento de turmas.
- **Alunos:** estudo, atividades, feedback e evolução.
- **Escolas e projetos educacionais:** futura aplicação como apoio à aprendizagem ativa.

## Funcionalidades

### Professor

- cadastro e autenticação por perfil;
- criação de turmas com código de entrada;
- envio de texto ou PDF;
- geração de 1 a 30 questões com IA;
- revisão, edição, aprovação, filtro, arquivamento e remoção de questões;
- criação e publicação de atividades;
- duração individual de 1 a 240 minutos e prazo final opcional;
- painel com alunos, conclusão, média, desempenho, dificuldades e pendências;
- exclusão controlada de materiais, questões e atividades.

### Aluno

- entrada em turma por código;
- acesso a materiais e atividades publicadas;
- tentativa com cronômetro persistido;
- correção e feedback após o envio;
- XP, nível, sequência de estudo e conquistas;
- visualização do próprio progresso.

### Saúde mental

- check-in **Bem**, **Mais ou menos**, **Mal** ou **Prefiro não responder**;
- mensagens acolhedoras, dicas e contatos de apoio;
- resposta local, temporária e não compartilhada;
- caráter informativo, sem diagnóstico ou atendimento.

## Fluxos

**Professor:** `Login → Turma → Material → IA → Revisão → Atividade → Publicação → Indicadores`

**Aluno:** `Login → Código da turma → Atividade → Tentativa → Envio → Feedback + XP`

O cronômetro começa no início da tentativa e não reinicia ao atualizar a página. Vale o que terminar primeiro: a duração individual ou o prazo final. O envio exige todas as respostas e uma atividade não concede XP novamente ao ser reenviada.

## Arquitetura e tecnologias

```text
Navegador
  └─ React + TanStack Start/Router + Tailwind CSS
       ├─ Supabase Auth — identidade e sessão
       ├─ Supabase PostgreSQL — dados, RLS e funções RPC
       ├─ PDF.js — extração de texto
       └─ Servidor TanStack
            └─ Gemini API — geração de questões
```

| Camada | Ferramentas |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide, Sonner |
| Aplicação | TanStack Start, TanStack Router, TanStack Query, Vite |
| Backend | Supabase Auth, PostgreSQL, RLS e RPC |
| IA | Google Gemini API |
| Documentos | PDF.js (`pdfjs-dist`) |
| Validação | Zod |
| Testes | Bun Test e PGlite |
| Prototipação | Lovable |

> A aplicação ativa é React/TypeScript. Os arquivos Python/Flask na raiz, em `templates/` e `static/`, pertencem a uma versão anterior e não são executados pelo comando atual.

## Supabase e segurança

O banco reúne os domínios de identidade (`profiles`, `user_roles`), sala (`turmas`, `matriculas`), conteúdo (`materiais`, `questoes`), avaliação (`atividades`, `atividade_questoes`, `submissoes`) e gamificação (`xp_transactions`, `study_sessions`, `achievements`, `user_achievements`). Tentativas ficam no schema privado `ideon_private`.

Controles implementados:

- autenticação e sessão pelo Supabase Auth;
- acesso separado para professor e aluno;
- Row Level Security nas tabelas sensíveis;
- validação de matrícula e propriedade da turma;
- gabarito omitido na leitura da atividade pelo aluno;
- correção, submissão, XP e sessão de estudo em uma transação;
- bloqueio de escrita direta do cliente no ledger de XP e nas submissões;
- funções `SECURITY DEFINER` com permissões e `search_path` controlados;
- uso apenas de chave publicável no navegador.

O gabarito e a explicação são retornados somente após a correção. Como este é um MVP, uma auditoria adicional é necessária antes de produção.

## IA e gamificação

O servidor envia ao Gemini um prompt baseado no material do professor e valida a estrutura das questões retornadas. A chave fica em `GEMINI_API_KEY`, sem prefixo `VITE_`, para não ser exposta ao navegador. Toda questão deve ser revisada pelo professor antes da publicação.

A pontuação atual concede **10 XP por acerto** e **20 XP pela conclusão**. Cada nível corresponde a **500 XP**. O ledger evita duplicidade. As conquistas cadastradas são `FIRST_ACTIVITY`, `STREAK_7`, `SHARP_MIND`, `IMPROVEMENT_20` e `EXPLORER`; no MVP, as regras automáticas já cobrem Primeiros passos e Em chamas.

## Estrutura do projeto

```text
src/
├─ routes/                   # páginas e rotas
├─ components/ideon/         # componentes do produto
├─ components/ui/            # componentes visuais
├─ services/ideon.ts         # operações de domínio
├─ lib/                      # IA, PDF, datas, XP e testes
└─ integrations/supabase/    # clientes e autenticação
supabase/migrations/         # migrations incrementais recentes
drizzle/migrations/          # migrations incrementais anteriores
public/                      # arquivos públicos
.env.example                 # modelo de configuração
package.json                 # scripts e dependências
```

`src/routeTree.gen.ts` é gerado automaticamente e não deve ser editado.

## Como executar

### Pré-requisitos

- Git;
- [Bun](https://bun.sh/) — recomendado para respeitar o lockfile e executar testes;
- projeto Supabase já preparado pela equipe;
- chave Gemini para gerar novas questões;
- internet.

Node.js 22.12 ou superior com npm também pode iniciar e compilar a aplicação.

### Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd ideon-mvp-seguro
bun install --frozen-lockfile
```

Alternativa: `npm install`.

Copie `.env.example` para `.env` e configure:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
GEMINI_API_KEY=SUA_CHAVE_GEMINI
```

- Use a mesma URL e chave publicável nos campos de servidor e navegador.
- Nunca use `service_role`, `sb_secret_` ou chave administrativa no frontend.
- Nunca renomeie a chave Gemini para `VITE_GEMINI_API_KEY`.
- Não versione `.env` nem publique chaves em prints ou commits.

Sem a chave Gemini, atividades já preparadas funcionam, mas novas questões não podem ser geradas.

### Execução local

```bash
bun run dev
```

Abra [http://localhost:8080](http://localhost:8080), ou a URL informada no terminal. Com npm, use `npm run dev`.

### Build

```bash
bun run build
bun run preview
```

## Banco e migrations

Para o hackathon, recomenda-se usar o Supabase preparado pela equipe e contas de teste. Configure também os redirecionamentos de autenticação para a URL local ou publicada.

As migrations do repositório são **incrementais** e pressupõem um schema-base existente. Hoje não há bootstrap completo de um Supabase vazio; `drizzle/schema.ts` está vazio e `drizzle push` não deve ser usado para reconstruir o banco.

| Ordem | Arquivo | Finalidade |
| --- | --- | --- |
| 1 | `drizzle/migrations/0000_ideon_schema.sql` | leitura segura de perfis |
| 2 | `drizzle/migrations/0001_secure_mvp.sql` | correção, XP, sessões e conquistas |
| 3 | `supabase/migrations/20260913000000_exclusao_materiais_questoes.sql` | exclusão de materiais e questões |
| 4 | `supabase/migrations/20260913010000_arquivar_questoes_em_uso.sql` | arquivamento de questões vinculadas |
| 5 | `supabase/migrations/20260913020000_exclusao_atividades_prazo.sql` | exclusão, prazo e agendamento |
| 6 | `supabase/migrations/20260913030000_duracao_atividades.sql` | duração e tentativas persistentes |

Não reaplique migrations antigas sobre um ambiente atualizado: algumas redefinem funções evoluídas depois. A exclusão agendada usa `pg_cron`; consulte `EXCLUSAO_MATERIAIS.md`.

## Testes

Antes da entrega, execute:

```bash
bun run typecheck
bun test
bun run build
```

Opcionalmente, rode `bun run lint`. A suíte cobre datas, prazo e duração, PDF, validação de questões, XP e funções PostgreSQL de exclusão. PGlite executa os testes de banco localmente, sem alterar o Supabase da equipe nem chamar a IA. O `pg_cron` é simulado e deve ser verificado no ambiente remoto.

## Roteiro para o hackathon

1. Apresente o problema e a proposta em 30 segundos.
2. Como professor, crie uma turma, envie um material e gere questões.
3. Edite e aprove uma questão para demonstrar controle humano.
4. Em janela anônima, entre como aluno e conclua a atividade.
5. Mostre feedback, XP e proteção contra pontuação duplicada.
6. Retorne ao painel para destacar desempenho e dificuldades.
7. Finalize com o check-in privado de saúde mental.

Prepare duas contas, um material curto e uma atividade publicada. A demonstração depende de internet, Supabase disponível e cota válida do Gemini.

## Limitações e próximos passos

### Limitações do MVP

- não há instalação automática de um Supabase vazio;
- PDFs escaneados não têm OCR; limite de 10 MB, 100 páginas e 100 mil caracteres;
- respostas não são salvas antes do envio e o tempo zerado não envia automaticamente;
- a qualidade da IA depende do material e da revisão docente;
- parte das conquistas ainda não possui regra automática;
- o check-in de bem-estar não mantém histórico;
- não há modo offline;
- a versão Flask legada ainda está no repositório.

### Próximos passos

- criar migration inicial completa e dados de demonstração;
- adicionar autosave e envio automático;
- implementar OCR;
- completar conquistas e tornar XP configurável;
- ampliar métricas por aluno, assunto e período;
- incluir testes ponta a ponta, acessibilidade e exportação;
- separar a versão Flask legada;
- auditar segurança, privacidade e conformidade.

## Equipe e créditos

> Preencha antes da entrega com os dados oficiais.

| Integrante | Papel | Contato |
| --- | --- | --- |
| Nome | Produto / Desenvolvimento / Design / Dados | GitHub ou LinkedIn |
| Nome | Produto / Desenvolvimento / Design / Dados | GitHub ou LinkedIn |

- Desenvolvido para **[nome do hackathon]**, em **[ano]**.
- Prototipação com apoio do Lovable.
- Dados e autenticação: Supabase.
- Geração de questões: Google Gemini API.
- Bibliotecas open source: consulte `package.json`.

## Aviso

Este é um protótipo de hackathon. O Ideon não substitui avaliação pedagógica, atendimento psicológico ou serviços de emergência. Antes de uso real, são necessárias validações adicionais de segurança, privacidade, acessibilidade, conteúdo e operação.

---

Feito com propósito para transformar conteúdo em aprendizagem ativa.
