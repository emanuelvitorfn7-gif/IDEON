"""Gamificação: XP, níveis e dias ativos.

Regras (também resumidas na interface):
  +20 XP pela primeira conclusão de cada atividade;
  +10 XP por acerto na primeira tentativa concluída;
  tentativas posteriores valem revisão, sem XP novo;
  XP creditado somente ao concluir (abrir material não pontua);
  nível = 1 + XP_total // 100.
"""
import sqlite3

XP_CONCLUSAO = 20
XP_ACERTO = 10


def total_xp(db, aluno_id):
    row = db.execute(
        "SELECT COALESCE(SUM(xp), 0) AS t FROM xp_eventos WHERE aluno_id = ?",
        (aluno_id,)).fetchone()
    return row["t"]


def nivel_info(xp_total):
    nivel = 1 + xp_total // 100
    return {"nivel": nivel, "no_nivel": xp_total % 100, "para_proximo": 100}


def dias_ativos_total(db, aluno_id):
    return db.execute(
        "SELECT COUNT(*) AS c FROM dias_ativos WHERE aluno_id = ?",
        (aluno_id,)).fetchone()["c"]


def concluir_tentativa(db, tentativa_id, aluno_id):
    """Conclui a tentativa e credita XP em transação única e idempotente.

    Devolve (acertos, total, xp_ganho). INSERT OR IGNORE + UPDATE
    condicional garantem que recarregamentos ou requisições simultâneas
    não duplicam XP. Levanta ValueError se incompleta ou inválida.
    """
    try:
        db.execute("BEGIN IMMEDIATE")
        tent = db.execute(
            "SELECT * FROM tentativas WHERE id = ? AND aluno_id = ?",
            (tentativa_id, aluno_id)).fetchone()
        if tent is None:
            raise ValueError("Tentativa não encontrada.")
        if tent["concluida_em"] is not None:
            db.execute("COMMIT")
            return tent["acertos"], tent["total"], 0
        feitas = db.execute(
            "SELECT COUNT(*) AS c, COALESCE(SUM(correta), 0) AS a"
            " FROM tentativa_respostas WHERE tentativa_id = ?",
            (tentativa_id,)).fetchone()
        if feitas["c"] < tent["total"]:
            raise ValueError("Responda todas as questões antes de concluir.")
        primeira = db.execute(
            "SELECT id FROM tentativas WHERE atividade_id = ? AND aluno_id = ?"
            " AND concluida_em IS NOT NULL AND id != ?",
            (tent["atividade_id"], aluno_id, tentativa_id)).fetchone() is None
        db.execute(
            "UPDATE tentativas SET concluida_em = datetime('now'), acertos = ?"
            " WHERE id = ? AND concluida_em IS NULL",
            (feitas["a"], tentativa_id))
        ganho = 0
        if primeira:
            cur = db.execute(
                "INSERT OR IGNORE INTO xp_eventos"
                " (aluno_id, atividade_id, questao_id, tipo, xp)"
                " VALUES (?, ?, 0, 'conclusao', ?)",
                (aluno_id, tent["atividade_id"], XP_CONCLUSAO))
            ganho += cur.rowcount * XP_CONCLUSAO
            for r in db.execute(
                    "SELECT questao_id FROM tentativa_respostas"
                    " WHERE tentativa_id = ? AND correta = 1", (tentativa_id,)):
                cur = db.execute(
                    "INSERT OR IGNORE INTO xp_eventos"
                    " (aluno_id, atividade_id, questao_id, tipo, xp)"
                    " VALUES (?, ?, ?, 'acerto', ?)",
                    (aluno_id, tent["atividade_id"], r["questao_id"], XP_ACERTO))
                ganho += cur.rowcount * XP_ACERTO
            db.execute("INSERT OR IGNORE INTO dias_ativos (aluno_id, dia)"
                       " VALUES (?, date('now'))", (aluno_id,))
        db.execute("COMMIT")
        return feitas["a"], tent["total"], ganho
    except ValueError:
        try:
            db.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    except sqlite3.Error as e:
        try:
            db.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise ValueError(f"Falha ao concluir: {e}")
