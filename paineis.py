"""Painéis calculados exclusivamente sobre dados persistidos.

Sem valores inventados: turmas vazias ou sem tentativas devolvem
listas vazias / None, e os templates exibem "Dados insuficientes".
"""

import xp


def _pct(acertos, total):
    return round(acertos / total * 100) if total else 0


def concluidas(db, aluno_id, turma_id=None):
    q = (
        "SELECT t.* FROM tentativas t JOIN atividades a ON a.id = t.atividade_id"
        " WHERE t.aluno_id = ? AND t.concluida_em IS NOT NULL"
    )
    args = [aluno_id]
    if turma_id is not None:
        q += " AND a.turma_id = ?"
        args.append(turma_id)
    return db.execute(q + " ORDER BY t.concluida_em", args).fetchall()


def resumo_aluno(db, aluno_id):
    """XP, nível, concluídas, dias, histórico, evolução e recomendações."""
    concl = concluidas(db, aluno_id)
    ativs = {}
    for t in concl:
        ativs.setdefault(t["atividade_id"], []).append(t)
    historico = db.execute(
        "SELECT t.id, t.acertos, t.total, t.concluida_em, a.titulo, a.turma_id,"
        " tm.nome AS turma_nome FROM tentativas t"
        " JOIN atividades a ON a.id = t.atividade_id"
        " JOIN turmas tm ON tm.id = a.turma_id"
        " WHERE t.aluno_id = ? AND t.concluida_em IS NOT NULL"
        " ORDER BY t.concluida_em DESC",
        (aluno_id,),
    ).fetchall()
    evolucao = []
    for aid, tents in ativs.items():
        if len(tents) < 2:
            continue
        p0 = _pct(tents[0]["acertos"], tents[0]["total"])
        p1 = _pct(tents[-1]["acertos"], tents[-1]["total"])
        titulo = db.execute(
            "SELECT titulo FROM atividades WHERE id = ?", (aid,)
        ).fetchone()["titulo"]
        evolucao.append({"atividade": titulo, "de": p0, "para": p1, "diff": p1 - p0})
    recomend = []
    for aid, tents in ativs.items():
        ultima = tents[-1]["id"]
        erros = db.execute(
            "SELECT q.assunto, q.pagina, a.material_id, m.estado AS mat_estado,"
            " COUNT(*) AS n FROM tentativa_respostas r"
            " JOIN questoes q ON q.id = r.questao_id"
            " JOIN atividades a ON a.id = q.atividade_id"
            " LEFT JOIN materiais m ON m.id = a.material_id"
            " WHERE r.tentativa_id = ? AND r.correta = 0"
            " GROUP BY q.assunto, q.pagina ORDER BY n DESC",
            (ultima,),
        ).fetchall()
        titulo = db.execute(
            "SELECT titulo FROM atividades WHERE id = ?", (aid,)
        ).fetchone()["titulo"]
        for e in erros:
            recomend.append(
                {
                    "atividade": titulo,
                    "assunto": e["assunto"],
                    "pagina": e["pagina"],
                    "erros": e["n"],
                    "material_id": e["material_id"]
                    if e["mat_estado"] == "liberado"
                    else None,
                }
            )
    total = xp.total_xp(db, aluno_id)
    return {
        "xp_total": total,
        "nivel": xp.nivel_info(total),
        "dias": xp.dias_ativos_total(db, aluno_id),
        "concluidas": len(ativs),
        "historico": historico,
        "evolucao": evolucao,
        "recomendacoes": recomend,
    }


def ranking_turma(db, turma_id):
    """XP na turma, dias com conclusão, evolução média. Só nomes de exibição."""
    alunos = db.execute(
        "SELECT u.id, u.nome FROM inscricoes i JOIN usuarios u ON u.id = i.aluno_id"
        " WHERE i.turma_id = ? ORDER BY u.nome",
        (turma_id,),
    ).fetchall()
    linhas = []
    for a in alunos:
        xp_turma = db.execute(
            "SELECT COALESCE(SUM(e.xp), 0) AS t FROM xp_eventos e"
            " JOIN atividades at ON at.id = e.atividade_id"
            " WHERE e.aluno_id = ? AND at.turma_id = ?",
            (a["id"], turma_id),
        ).fetchone()["t"]
        dias = db.execute(
            "SELECT COUNT(DISTINCT date(t.concluida_em)) AS c FROM tentativas t"
            " JOIN atividades at ON at.id = t.atividade_id"
            " WHERE t.aluno_id = ? AND at.turma_id = ? AND t.concluida_em IS NOT NULL",
            (a["id"], turma_id),
        ).fetchone()["c"]
        diffs = []
        for at in db.execute(
            "SELECT id FROM atividades WHERE turma_id = ? AND estado = 'publicada'",
            (turma_id,),
        ):
            tents = [
                t for t in concluidas(db, a["id"]) if t["atividade_id"] == at["id"]
            ]
            if len(tents) >= 2:
                diffs.append(
                    _pct(tents[-1]["acertos"], tents[-1]["total"])
                    - _pct(tents[0]["acertos"], tents[0]["total"])
                )
        linhas.append(
            {
                "nome": a["nome"],
                "xp": xp_turma,
                "dias": dias,
                "evolucao": round(sum(diffs) / len(diffs), 1) if diffs else None,
                "n_comp": len(diffs),
            }
        )
    linhas.sort(key=lambda l: (-l["xp"], -l["dias"], l["nome"]))
    pos, anterior = 0, None  # empates mantêm a mesma posição
    for l in linhas:
        chave = (l["xp"], l["dias"])
        if chave != anterior:
            pos += 1
            anterior = chave
        l["pos"] = pos
    return linhas


def stats_turma(db, turma_id):
    """Indicadores do professor sobre o desempenho no aplicativo."""
    inscritos = db.execute(
        "SELECT u.id, u.nome FROM inscricoes i JOIN usuarios u ON u.id = i.aluno_id"
        " WHERE i.turma_id = ? ORDER BY u.nome",
        (turma_id,),
    ).fetchall()
    por_atividade, assuntos = [], {}
    medias_primeira = {}
    for at in db.execute(
        "SELECT id, titulo FROM atividades WHERE turma_id = ? AND estado = 'publicada'"
        " ORDER BY id",
        (turma_id,),
    ):
        concluintes, somas = 0, []
        for al in inscritos:
            tents = [
                t
                for t in concluidas(db, al["id"], turma_id)
                if t["atividade_id"] == at["id"]
            ]
            if not tents:
                continue
            concluintes += 1
            p = tents[0]["acertos"] / tents[0]["total"] if tents[0]["total"] else 0
            somas.append(p)
            medias_primeira.setdefault(al["id"], []).append(p)
            for r in db.execute(
                "SELECT r.correta, q.assunto FROM tentativa_respostas r"
                " JOIN questoes q ON q.id = r.questao_id"
                " WHERE r.tentativa_id = ?",
                (tents[0]["id"],),
            ):
                ag = assuntos.setdefault(r["assunto"] or "Geral", [0, 0])
                ag[1] += 1
                ag[0] += r["correta"]
        por_atividade.append(
            {
                "titulo": at["titulo"],
                "concluintes": concluintes,
                "inscritos": len(inscritos),
                "media": round(sum(somas) / len(somas) * 100) if somas else None,
            }
        )
    sem_conclusao, abaixo = [], []
    for al in inscritos:
        meds = medias_primeira.get(al["id"], [])
        if not meds:
            sem_conclusao.append(al["nome"])
        elif sum(meds) / len(meds) < 0.6:
            abaixo.append(
                {"nome": al["nome"], "media": round(sum(meds) / len(meds) * 100)}
            )
    return {
        "n_inscritos": len(inscritos),
        "por_atividade": por_atividade,
        "assuntos": [
            {"assunto": k, "pct": round(v[0] / v[1] * 100), "n": v[1]}
            for k, v in sorted(assuntos.items())
        ],
        "sem_conclusao": sem_conclusao,
        "abaixo": abaixo,
    }
