# Ideon

**Problema:** o professor tem PDFs e textos, mas transformá-los em atividades interativas dá trabalho; o aluno decora sem feedback.

**Solução:** plataforma educacional que converte o material do professor em questões de múltipla escolha (com IA ou exemplo pronto), publica para a turma e gamifica o estudo com XP, níveis, ranking e painéis — tudo em português, num tema escuro com destaque violeta.

Fluxo do MVP: criar turma → adicionar material → gerar questões → revisar → publicar → aluno responde e acumula XP → professor acompanha.

## Tecnologias

Python + Flask, SQLite via `sqlite3` (stdlib), Jinja, HTML/CSS/JS simples (sem build, sem libs de frontend). Extração de PDF com `pypdf`. IA via OpenAI (Chat Completions, `urllib` da stdlib). Testes com `unittest` (stdlib).

## Organização

| Arquivo | Papel |
|---|---|
| `app.py` | Flask, rotas e permissões |
| `db.py` | SQLite, `init-db`, migrações sem apagar dados |
| `auth.py` | Sessão, CSRF próprio, decoradores de perfil |
| `materiais.py` | Validação e extração de PDF/texto |
| `ia.py` | Geração via OpenAI, validação estrutural, demo |
| `xp.py` | Tentativas, XP, nível e dias ativos |
| `paineis.py` | Indicadores do aluno e da turma |
| `demo.py` | Dados fictícios (`flask demo`) |
| `tests/` | Suíte `unittest` |
| `templates/`, `static/` | Jinja + CSS escuro responsivo |

## Instalação e execução (Windows PowerShell)

```powershell
python -m venv .venv
python -m pip install -r requirements.txt
Copy-Item .env.example .env
.venv\Scripts\python -m flask --app app init-db
.venv\Scripts\python -m flask --app app run --debug
```

Sem ativar a venv (executa pelo Python dela):

```powershell
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m flask --app app init-db
.\.venv\Scripts\python -m flask --app app run --debug
```

Testes:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests
```

Abra http://127.0.0.1:5000

## IA e modo demonstrativo

Provedor único: OpenAI — `POST /chat/completions` (`response_format: json_object`),
conforme https://platform.openai.com/docs/api-reference/chat/create. No `.env`:

```powershell
OPENAI_API_KEY=sua-chave-aqui
AI_MODEL=gpt-4o-mini
AI_MAX_CHARS=12000
```

A chave fica só no servidor (nunca no navegador nem nos logs). Sem chave, a geração
real desliga e nunca é simulada. Para demonstrar sem API, use o material de exemplo
na página da turma ou o banco demo abaixo.

Banco de demonstração (idempotente, separado do real, tudo marcado como fictício):

```powershell
.\.venv\Scripts\python -m flask --app app demo
$env:DATABASE_URL = "instance/demo.db"
.\.venv\Scripts\python -m flask --app app run --debug
```

Logins demo (senha `demo1234`): `demo.prof@exemplo.com`, `demo.ana@exemplo.com`,
`demo.bruno@exemplo.com`, `demo.carla@exemplo.com`.

## Regras de XP

+20 XP pela primeira conclusão de cada atividade; +10 por acerto nela. Revisões
posteriores não geram XP. Abrir material é só acesso — não pontua nem comprova
aprendizagem. Nível = 1 + XP // 100.

## Roteiro de apresentação (3 minutos, banco demo)

1. **Professor (0:00–1:30):** entre como `demo.prof@exemplo.com` → abra *Ciências 101* →
   mostre material liberado, atividade publicada, conclusão por atividade, acertos por
   assunto e ranking.
2. **Aluna (1:30–2:30):** saia, entre como `demo.carla@exemplo.com` → continue a tentativa
   em andamento → responda e veja feedback com referência ao material.
3. **Evolução (2:30–3:00):** entre como `demo.bruno@exemplo.com` → painel mostra
   evolução 40%→80% (+40 p.p.), XP sem duplicar e recomendação de revisão.

## Roteiro manual no navegador (não verificado aqui)

Não há ferramenta de navegador neste ambiente — só cliente de teste. Verifique à mão:
cadastro professor/aluno, criar turma, enviar PDF, gerar com chave, aprovar e publicar,
responder como aluno, recarregar o resultado (XP estável) e o layout em celular (640px).

## Limitações do MVP

Sem OCR (PDF digitalizado não extrai texto); sem colaboração entre colegas (sem ranking
de ajuda); sem notificações; sem revisão adaptativa avançada (recomendações são regras
simples sobre erros por assunto).

## Git

Fora do versionamento (ver `.gitignore`): `.env` e segredos, `instance/` (bancos locais
`*.db`/`*.sqlite` e `uploads/` privados), `.venv/` e `__pycache__/`.
