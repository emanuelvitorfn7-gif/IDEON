"""Dados fictícios para demonstração (nunca toca no banco real).

Uso: flask --app app demo [--db instance/demo.db]
Depois: DATABASE_URL=instance/demo.db flask --app app run
Login: demo.prof@exemplo.com, demo.ana@exemplo.com, demo.bruno@exemplo.com,
demo.carla@exemplo.com — senha demo1234 para todos.
"""

import json
import os
import sqlite3

from werkzeug.security import generate_password_hash

import ia
import xp
from db import SCHEMA, migrar

SENHA = "demo1234"


def carregar(caminho):
    """Cria o banco demo. Idempotente: se já carregado, não duplica nada."""
    os.makedirs(os.path.dirname(caminho) or ".", exist_ok=True)
    db = sqlite3.connect(caminho)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(SCHEMA)
    migrar(db)
    if db.execute(
        "SELECT id FROM usuarios WHERE email = ?", ("demo.prof@exemplo.com",)
    ).fetchone():
        db.close()
        return {"status": "existente", "caminho": caminho}

    prof = db.execute(
        "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
        (
            "Prof. Demo (fictício)",
            "demo.prof@exemplo.com",
            generate_password_hash(SENHA),
            "professor",
        ),
    ).lastrowid
    alunos = {}
    for nome, email in (
        ("Ana Demo (fictícia)", "demo.ana@exemplo.com"),
        ("Bruno Demo (fictício)", "demo.bruno@exemplo.com"),
        ("Carla Demo (fictícia)", "demo.carla@exemplo.com"),
    ):
        alunos[email] = db.execute(
            "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, 'aluno')",
            (nome, email, generate_password_hash(SENHA)),
        ).lastrowid
    turma = db.execute(
        "INSERT INTO turmas (nome, descricao, codigo, professor_id)"
        " VALUES (?, ?, ?, ?)",
        (
            "Ciências 101 (demonstração)",
            "Turma fictícia para demonstração.",
            "DEMO01",
            prof,
        ),
    ).lastrowid
    for email, uid in alunos.items():
        db.execute(
            "INSERT INTO inscricoes (turma_id, aluno_id) VALUES (?, ?)", (turma, uid)
        )
    mat = db.execute(
        "INSERT INTO materiais (turma_id, professor_id, titulo, origem, estado)"
        " VALUES (?, ?, ?, 'texto', 'liberado')",
        (turma, prof, ia.MATERIAL_DEMO["titulo"]),
    ).lastrowid
    db.executemany(
        "INSERT INTO material_paginas (material_id, numero, texto) VALUES (?, ?, ?)",
        [(mat, p["numero"], p["texto"]) for p in ia.MATERIAL_DEMO["paginas"]],
    )
    validas, erros = ia.validar_questoes(ia.QUESTOES_DEMO, ia.MATERIAL_DEMO["paginas"])
    assert not erros, erros
    atv = db.execute(
        "INSERT INTO atividades (turma_id, material_id, titulo, estado, publicada)"
        " VALUES (?, ?, ?, 'publicada', 1)",
        (turma, mat, "Atividade demonstrativa (fictícia)"),
    ).lastrowid
    qids = []
    for q in validas:
        qids.append(
            db.execute(
                "INSERT INTO questoes (atividade_id, enunciado, resposta, alternativas,"
                " correta, explicacao, assunto, pagina, evidencia, aprovada)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
                (
                    atv,
                    q["enunciado"],
                    q["alternativas"][q["correta"]],
                    json.dumps(q["alternativas"], ensure_ascii=False),
                    q["correta"],
                    q["explicacao"],
                    q["assunto"],
                    q["pagina"],
                    q["evidencia"],
                ),
            ).lastrowid
        )
    db.commit()

    def tentativa(uid, respostas):
        tid = db.execute(
            "INSERT INTO tentativas (atividade_id, aluno_id, total) VALUES (?, ?, ?)",
            (atv, uid, len(qids)),
        ).lastrowid
        for qid, alt in zip(qids, respostas):
            correta = db.execute(
                "SELECT correta FROM questoes WHERE id = ?", (qid,)
            ).fetchone()["correta"]
            db.execute(
                "INSERT INTO tentativa_respostas (tentativa_id, questao_id,"
                " alternativa, correta) VALUES (?, ?, ?, ?)",
                (tid, qid, alt, 1 if alt == correta else 0),
            )
        db.commit()
        xp.concluir_tentativa(db, tid, uid)
        return tid

    # Resultados variados: Ana 5/5 de primeira; Bruno 2/5 depois 4/5; Carla incompleta.
    tentativa(alunos["demo.ana@exemplo.com"], [0, 2, 1, 1, 1])
    tentativa(alunos["demo.bruno@exemplo.com"], [0, 2, 0, 0, 0])
    tentativa(alunos["demo.bruno@exemplo.com"], [0, 2, 1, 1, 0])
    aberta = db.execute(
        "INSERT INTO tentativas (atividade_id, aluno_id, total) VALUES (?, ?, ?)",
        (atv, alunos["demo.carla@exemplo.com"], len(qids)),
    ).lastrowid
    for qid, alt in zip(qids[:2], [0, 0]):
        db.execute(
            "INSERT INTO tentativa_respostas (tentativa_id, questao_id,"
            " alternativa, correta) VALUES (?, ?, ?, 1)",
            (aberta, qid, alt),
        )
    db.commit()
    db.close()
    return {"status": "criado", "caminho": caminho}
