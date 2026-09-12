"""Conexão SQLite e inicialização do banco (sem apagar dados existentes)."""
import os
import sqlite3

from flask import current_app, g

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('professor', 'aluno')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS turmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    criada_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS inscricoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    inscrita_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (turma_id, aluno_id)
);
CREATE TABLE IF NOT EXISTS materiais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    professor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    origem TEXT NOT NULL CHECK (origem IN ('pdf', 'texto')),
    arquivo TEXT,
    estado TEXT NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho', 'liberado')),
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS material_paginas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    texto TEXT NOT NULL,
    UNIQUE (material_id, numero)
);
CREATE TABLE IF NOT EXISTS atividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materiais(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'rascunho' CHECK (estado IN ('rascunho', 'publicada')),
    publicada INTEGER NOT NULL DEFAULT 0,
    criada_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS questoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    enunciado TEXT NOT NULL,
    resposta TEXT NOT NULL,
    alternativas TEXT NOT NULL DEFAULT '[]',
    correta INTEGER NOT NULL DEFAULT 0,
    explicacao TEXT NOT NULL DEFAULT '',
    assunto TEXT NOT NULL DEFAULT '',
    pagina INTEGER,
    evidencia TEXT NOT NULL DEFAULT '',
    aprovada INTEGER NOT NULL DEFAULT 0
);CREATE TABLE IF NOT EXISTS respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    aluno TEXT NOT NULL,
    correta INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0,
    respondida_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tentativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    total INTEGER NOT NULL DEFAULT 0,
    acertos INTEGER NOT NULL DEFAULT 0,
    iniciada_em TEXT NOT NULL DEFAULT (datetime('now')),
    concluida_em TEXT
);
CREATE TABLE IF NOT EXISTS tentativa_respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tentativa_id INTEGER NOT NULL REFERENCES tentativas(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL REFERENCES questoes(id) ON DELETE CASCADE,
    alternativa INTEGER NOT NULL,
    correta INTEGER NOT NULL DEFAULT 0,
    respondida_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tentativa_id, questao_id)
);
CREATE TABLE IF NOT EXISTS xp_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    atividade_id INTEGER NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    questao_id INTEGER NOT NULL DEFAULT 0,
    tipo TEXT NOT NULL CHECK (tipo IN ('conclusao', 'acerto')),
    xp INTEGER NOT NULL,
    criada_em TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (aluno_id, atividade_id, questao_id, tipo)
);
CREATE TABLE IF NOT EXISTS dias_ativos (
    aluno_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dia TEXT NOT NULL,
    UNIQUE (aluno_id, dia)
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE_PATH"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(_=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def migrar(db):
    """Acrescenta colunas de etapas anteriores sem apagar dados."""
    colunas = {r[1] for r in db.execute("PRAGMA table_info(turmas)").fetchall()}
    if "descricao" not in colunas:
        db.execute("ALTER TABLE turmas ADD COLUMN descricao TEXT NOT NULL DEFAULT ''")
    if "professor_id" not in colunas:
        db.execute("ALTER TABLE turmas ADD COLUMN professor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL")
    col_at = {r[1] for r in db.execute("PRAGMA table_info(atividades)").fetchall()}
    if "material_id" not in col_at:
        db.execute("ALTER TABLE atividades ADD COLUMN material_id INTEGER REFERENCES materiais(id) ON DELETE SET NULL")
    if "estado" not in col_at:
        db.execute("ALTER TABLE atividades ADD COLUMN estado TEXT NOT NULL DEFAULT 'rascunho'")
    col_q = {r[1] for r in db.execute("PRAGMA table_info(questoes)").fetchall()}
    for nome, ddl in {
        "alternativas": "TEXT NOT NULL DEFAULT '[]'",
        "correta": "INTEGER NOT NULL DEFAULT 0",
        "explicacao": "TEXT NOT NULL DEFAULT ''",
        "assunto": "TEXT NOT NULL DEFAULT ''",
        "pagina": "INTEGER",
        "evidencia": "TEXT NOT NULL DEFAULT ''",
        "aprovada": "INTEGER NOT NULL DEFAULT 0",
    }.items():
        if nome not in col_q:
            db.execute(f"ALTER TABLE questoes ADD COLUMN {nome} {ddl}")


def init_db():
    os.makedirs(os.path.dirname(current_app.config["DATABASE_PATH"]), exist_ok=True)
    db = sqlite3.connect(current_app.config["DATABASE_PATH"])
    db.executescript(SCHEMA)
    migrar(db)
    db.commit()
    db.close()
