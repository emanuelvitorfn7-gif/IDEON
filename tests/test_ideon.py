"""Testes essenciais do MVP (stdlib unittest, sem dependências novas).

Roda com: python -m unittest discover -s tests
Cobre: permissões, bloqueio de rascunhos, correção no servidor,
XP sem duplicação e cálculo dos indicadores.
"""

import json
import os
import sqlite3
import tempfile
import unittest

os.environ["DATABASE_URL"] = os.path.join(tempfile.gettempdir(), "ideon_test.db")

from app import create_app
from db import init_db


def nova_questao(db, atv, i, assunto="Ass"):
    alts = ["Certa", "E1", "E2", "E3"]
    db.execute(
        "INSERT INTO questoes (atividade_id, enunciado, resposta, alternativas,"
        " correta, explicacao, assunto, pagina, evidencia, aprovada)"
        " VALUES (?,?,?,?,?,?,?,?,?,1)",
        (atv, f"Q{i}?", "Certa", json.dumps(alts), 0, f"Exp{i}", assunto, 1, "Base."),
    )


class Base(unittest.TestCase):
    def setUp(self):
        if os.path.exists(os.environ["DATABASE_URL"]):
            os.remove(os.environ["DATABASE_URL"])
        self.app = create_app()
        self.app.config["TESTING"] = True
        with self.app.app_context():
            init_db()
        self.db = sqlite3.connect(os.environ["DATABASE_URL"])
        self.db.row_factory = sqlite3.Row

    def tearDown(self):
        self.db.close()

    def csrf(self, cli, path):
        cli.get(path)
        with cli.session_transaction() as s:
            return s["csrf_token"]

    def conta(self, cli, email, perfil):
        t = self.csrf(cli, "/cadastro")
        cli.post(
            "/cadastro",
            data={
                "csrf_token": t,
                "nome": email.split("@")[0],
                "email": email,
                "senha": "segredo1",
                "perfil": perfil,
            },
        )
        t = self.csrf(cli, "/login")
        cli.post("/login", data={"csrf_token": t, "email": email, "senha": "segredo1"})
        return self.db.execute(
            "SELECT id FROM usuarios WHERE email = ?", (email,)
        ).fetchone()["id"]

    def turma(self, cli_prof, pid):
        t = self.csrf(cli_prof, "/professor/turmas/nova")
        cli_prof.post(
            "/professor/turmas/nova",
            data={"csrf_token": t, "nome": "T", "descricao": ""},
        )
        tid = self.db.execute("SELECT id FROM turmas").fetchone()["id"]
        cod = self.db.execute(
            "SELECT codigo FROM turmas WHERE id = ?", (tid,)
        ).fetchone()["codigo"]
        return tid, cod

    def inscreve(self, cli, cod):
        t = self.csrf(cli, "/aluno/entrar")
        cli.post("/aluno/entrar", data={"csrf_token": t, "codigo": cod})

    def cenario(self, n_q=5):
        """Professor+tuma+material liberado+atividade publicada+n questões; 1 aluno."""
        p, a = self.app.test_client(), self.app.test_client()
        pid = self.conta(p, "prof@x.com", "professor")
        aid = self.conta(a, "a@x.com", "aluno")
        tid, cod = self.turma(p, pid)
        self.inscreve(a, cod)
        self.db.execute(
            "INSERT INTO materiais (turma_id, professor_id, titulo, origem, estado)"
            " VALUES (?, ?, 'M', 'texto', 'liberado')",
            (tid, pid),
        )
        mid = self.db.execute("SELECT id FROM materiais").fetchone()["id"]
        self.db.execute(
            "INSERT INTO material_paginas (material_id, numero, texto)"
            " VALUES (?, 1, 'Base.')",
            (mid,),
        )
        self.db.execute(
            "INSERT INTO atividades (turma_id, material_id, titulo, estado, publicada)"
            " VALUES (?, ?, 'A', 'publicada', 1)",
            (tid, mid),
        )
        atv = self.db.execute("SELECT id FROM atividades").fetchone()["id"]
        for i in range(n_q):
            nova_questao(self.db, atv, i)
        self.db.commit()
        qs = [
            r["id"]
            for r in self.db.execute("SELECT id FROM questoes ORDER BY id").fetchall()
        ]
        return p, a, pid, aid, tid, atv, qs

    def tentativa(self, cli, atv, qs, certas):
        t = self.csrf(cli, f"/aluno/atividades/{atv}")
        cli.post(f"/aluno/atividades/{atv}/iniciar", data={"csrf_token": t})
        tid = self.db.execute("SELECT id FROM tentativas ORDER BY id DESC").fetchone()[
            "id"
        ]
        for i, q in enumerate(qs):
            t = self.csrf(cli, f"/aluno/tentativas/{tid}/responder")
            cli.post(
                f"/aluno/tentativas/{tid}/responder",
                data={
                    "csrf_token": t,
                    "questao_id": q,
                    "alternativa": "0" if i in certas else "1",
                },
            )
        cli.get(f"/aluno/tentativas/{tid}/resultado")
        return tid

    def xp_de(self, aid):
        return self.db.execute(
            "SELECT COALESCE(SUM(xp),0) t FROM xp_eventos WHERE aluno_id = ?", (aid,)
        ).fetchone()["t"]


class TestPermissoes(Base):
    def test_isolamento_professor_e_aluno(self):
        _p1, a, _pid1, _aid, tid, atv, _qs = self.cenario()
        p2 = self.app.test_client()
        self.conta(p2, "p2@x.com", "professor")
        self.assertEqual(p2.get(f"/professor/turmas/{tid}").status_code, 403)
        self.assertEqual(a.get("/professor").status_code, 403)
        self.assertEqual(a.get(f"/professor/atividades/{atv}").status_code, 403)
        anon = self.app.test_client()
        self.assertEqual(anon.get("/painel").status_code, 302)

    def test_aluno_fora_da_turma_bloqueado(self):
        _p, _a, _pid, _aid, tid, atv, _qs = self.cenario()
        b = self.app.test_client()
        self.conta(b, "b@x.com", "aluno")
        self.assertEqual(b.get(f"/aluno/atividades/{atv}").status_code, 403)
        self.assertEqual(b.get(f"/aluno/turmas/{tid}").status_code, 403)


class TestRascunhos(Base):
    def test_rascunho_invisivel_ao_aluno(self):
        _p, a, _pid, _aid, _tid, atv, _qs = self.cenario()
        self.db.execute("UPDATE materiais SET estado = 'rascunho'")
        self.db.execute("UPDATE atividades SET estado = 'rascunho', publicada = 0")
        self.db.commit()
        mid = self.db.execute("SELECT id FROM materiais").fetchone()["id"]
        self.assertEqual(a.get(f"/aluno/materiais/{mid}").status_code, 403)
        self.assertEqual(a.get(f"/aluno/atividades/{atv}").status_code, 403)

    def test_publicar_exige_aprovacao_total(self):
        p, _a, _pid, _aid, tid, _atv, _qs = self.cenario()
        self.db.execute(
            "INSERT INTO atividades (turma_id, titulo) VALUES (?, 'R')", (tid,)
        )
        rid = self.db.execute(
            "SELECT id FROM atividades WHERE titulo = 'R'"
        ).fetchone()["id"]
        for i in range(5):
            nova_questao(self.db, rid, i)
        self.db.execute(
            "UPDATE questoes SET aprovada = 0 WHERE atividade_id = ?", (rid,)
        )
        self.db.commit()
        qids = [
            r["id"]
            for r in self.db.execute(
                "SELECT id FROM questoes WHERE atividade_id = ?", (rid,)
            ).fetchall()
        ]
        t = self.csrf(p, f"/professor/atividades/{rid}")
        p.post(
            f"/professor/atividades/{rid}/publicar",
            data={"csrf_token": t},
            follow_redirects=True,
        )
        self.assertEqual(
            self.db.execute(
                "SELECT estado FROM atividades WHERE id = ?", (rid,)
            ).fetchone()["estado"],
            "rascunho",
        )
        for qid in qids:
            t = self.csrf(p, f"/professor/atividades/{rid}")
            p.post(f"/professor/questoes/{qid}/aprovacao", data={"csrf_token": t})
        t = self.csrf(p, f"/professor/atividades/{rid}")
        p.post(f"/professor/atividades/{rid}/publicar", data={"csrf_token": t})
        self.assertEqual(
            self.db.execute(
                "SELECT estado FROM atividades WHERE id = ?", (rid,)
            ).fetchone()["estado"],
            "publicada",
        )


class TestCorrecaoServidor(Base):
    def test_gabarito_nao_vaza_e_correcao_eh_no_servidor(self):
        _p, a, _pid, _aid, _tid, atv, qs = self.cenario(n_q=2)
        t = self.csrf(a, f"/aluno/atividades/{atv}")
        a.post(f"/aluno/atividades/{atv}/iniciar", data={"csrf_token": t})
        tent = self.db.execute("SELECT id FROM tentativas").fetchone()["id"]
        html = a.get(f"/aluno/tentativas/{tent}/responder").get_data(as_text=True)
        self.assertIn("Q0?", html)
        self.assertNotIn("Exp0", html)
        self.assertNotIn("correta", html)
        t = self.csrf(a, f"/aluno/tentativas/{tent}/responder")
        a.post(
            f"/aluno/tentativas/{tent}/responder",
            data={"csrf_token": t, "questao_id": qs[0], "alternativa": "3"},
        )
        row = self.db.execute(
            "SELECT alternativa, correta FROM tentativa_respostas"
        ).fetchone()
        self.assertEqual((row["alternativa"], row["correta"]), (3, 0))

    def test_sem_alteracao_retroativa(self):
        _p, a, _pid, _aid, _tid, atv, qs = self.cenario(n_q=1)
        self.tentativa(a, atv, qs, {0})
        tent = self.db.execute("SELECT id FROM tentativas").fetchone()["id"]
        t = self.csrf(a, f"/aluno/tentativas/{tent}/responder")
        a.post(
            f"/aluno/tentativas/{tent}/responder",
            data={"csrf_token": t, "questao_id": qs[0], "alternativa": "1"},
        )
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) c FROM tentativa_respostas").fetchone()[
                "c"
            ],
            1,
        )


class TestXP(Base):
    def test_primeira_conclusao_e_recargas_nao_duplicam(self):
        _p, a, _pid, aid, _tid, atv, qs = self.cenario(n_q=5)
        tent = self.tentativa(a, atv, qs, {0, 1})  # 2/5 -> 20 + 20 = 40
        self.assertEqual(self.xp_de(aid), 40)
        a.get(f"/aluno/tentativas/{tent}/resultado")
        a.get(f"/aluno/tentativas/{tent}/resultado")
        self.assertEqual(self.xp_de(aid), 40)
        self.tentativa(a, atv, qs, {0, 1, 2, 3, 4})  # revisão 5/5, sem XP
        self.assertEqual(self.xp_de(aid), 40)


class TestIndicadores(Base):
    def test_evolucao_ranking_e_stats(self):
        import paineis

        _p, a, _pid, aid, tid, atv, qs = self.cenario(n_q=10)
        self.tentativa(a, atv, qs, {0, 1, 2, 3})  # 40%
        self.tentativa(a, atv, qs, {0, 1, 2, 3, 4, 5, 6})  # 70%
        with self.app.app_context():
            from db import get_db

            db = get_db()
            res = paineis.resumo_aluno(db, aid)
            self.assertEqual(res["evolucao"][0]["diff"], 30)
            rank = paineis.ranking_turma(db, tid)
            self.assertEqual(rank[0]["xp"], 60)  # 20 + 4x10
            self.assertEqual(rank[0]["evolucao"], 30.0)
            stats = paineis.stats_turma(db, tid)
            self.assertEqual(stats["n_inscritos"], 1)
            self.assertEqual(stats["por_atividade"][0]["concluintes"], 1)
            self.assertEqual(stats["por_atividade"][0]["media"], 40)


if __name__ == "__main__":
    unittest.main()
