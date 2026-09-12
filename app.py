"""Ideon — plataforma educacional gamificada (MVP)."""

import json
import os
import secrets

from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

import ia
import paineis
import xp
from auth import csrf_token, login_required, perfil_required, validar_csrf
from db import close_db, get_db, init_db
from materiais import (
    LIMITE_PDF_BYTES,
    ErroMaterial,
    dividir_texto_em_secoes,
    extrair_paginas_pdf,
)

load_dotenv()

PERFIS = ("professor", "aluno")


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret")
    app.config["DATABASE_PATH"] = os.environ.get("DATABASE_URL", "instance/ideon.db")
    app.config["UPLOAD_DIR"] = os.environ.get("UPLOAD_DIR", "instance/uploads")
    app.config["MAX_CONTENT_LENGTH"] = LIMITE_PDF_BYTES

    app.teardown_appcontext(close_db)
    app.jinja_env.globals["csrf_token"] = csrf_token

    @app.before_request
    def carregar_usuario():
        g.usuario = None
        uid = session.get("user_id")
        if uid:
            g.usuario = (
                get_db()
                .execute(
                    "SELECT id, nome, email, perfil FROM usuarios WHERE id = ?", (uid,)
                )
                .fetchone()
            )

    @app.cli.command("init-db")
    def init_db_command():
        init_db()
        print(f"Banco pronto em: {app.config['DATABASE_PATH']}")

    @app.cli.command("demo")
    def demo_command():
        """Carrega dados fictícios num banco de demonstração (não toca no real)."""
        import click

        import demo as demo_mod

        caminho = click.prompt("Banco demo", default="instance/demo.db")
        if os.path.abspath(caminho) == os.path.abspath(app.config["DATABASE_PATH"]):
            raise click.ClickException(
                "Recusado: o banco demo não pode ser o banco real."
            )
        info = demo_mod.carregar(caminho)
        print(f"Demo {info['status']} em: {info['caminho']}")
        print(
            "Rode com: $env:DATABASE_URL='instance/demo.db';"
            " .\\.venv\\Scripts\\python -m flask --app app run"
        )

    @app.get("/")
    def index():
        return render_template("index.html", usuario=g.usuario)

    @app.get("/saude")
    def saude():
        return {"status": "ok", "app": "ideon"}

    @app.errorhandler(413)
    def arquivo_grande(_):
        return (
            render_template(
                "erro.html", mensagem="Arquivo maior que 10 MB. Envie um PDF menor."
            ),
            413,
        )

    # ---------- Cadastro / login / logout ----------

    @app.route("/cadastro", methods=["GET", "POST"])
    def cadastro():
        if request.method == "POST":
            validar_csrf()
            nome = request.form.get("nome", "").strip()
            email = request.form.get("email", "").strip().lower()
            senha = request.form.get("senha", "")
            perfil = request.form.get("perfil", "")
            if not nome or not email or not senha or perfil not in PERFIS:
                flash(
                    "Preencha nome, e-mail, senha e escolha professor ou aluno.", "erro"
                )
            elif len(senha) < 6:
                flash("A senha precisa de ao menos 6 caracteres.", "erro")
            else:
                db = get_db()
                existe = db.execute(
                    "SELECT id FROM usuarios WHERE email = ?", (email,)
                ).fetchone()
                if existe:
                    flash("Este e-mail já está cadastrado.", "erro")
                else:
                    db.execute(
                        "INSERT INTO usuarios (nome, email, senha_hash, perfil)"
                        " VALUES (?, ?, ?, ?)",
                        (nome, email, generate_password_hash(senha), perfil),
                    )
                    db.commit()
                    flash("Cadastro feito! Entre com seu e-mail e senha.", "ok")
                    return redirect(url_for("login"))
        return render_template("cadastro.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            validar_csrf()
            email = request.form.get("email", "").strip().lower()
            senha = request.form.get("senha", "")
            db = get_db()
            user = db.execute(
                "SELECT * FROM usuarios WHERE email = ?", (email,)
            ).fetchone()
            if user and check_password_hash(user["senha_hash"], senha):
                session.clear()
                session["user_id"] = user["id"]
                session["csrf_token"] = secrets.token_hex(16)
                proximo = (
                    request.args.get("proximo") or request.form.get("proximo") or ""
                )
                if proximo.startswith("/") and not proximo.startswith("//"):
                    return redirect(proximo)
                return redirect(url_for("painel"))
            flash("E-mail ou senha inválidos.", "erro")
        return render_template("login.html", proximo=request.args.get("proximo", ""))

    @app.post("/logout")
    @login_required
    def logout():
        validar_csrf()
        session.clear()
        flash("Você saiu da conta.", "ok")
        return redirect(url_for("index"))

    @app.get("/painel")
    @login_required
    def painel():
        if g.usuario["perfil"] == "professor":
            return redirect(url_for("painel_professor"))
        return redirect(url_for("painel_aluno"))

    # ---------- Professor ----------

    def gerar_codigo(db):
        for _ in range(20):
            codigo = secrets.token_hex(3).upper()
            if not db.execute(
                "SELECT id FROM turmas WHERE codigo = ?", (codigo,)
            ).fetchone():
                return codigo
        raise RuntimeError("Não foi possível gerar um código único.")

    @app.get("/professor")
    @perfil_required("professor")
    def painel_professor():
        turmas = (
            get_db()
            .execute(
                "SELECT t.*, (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id)"
                " AS total_alunos FROM turmas t WHERE t.professor_id = ? ORDER BY t.id DESC",
                (g.usuario["id"],),
            )
            .fetchall()
        )
        return render_template("professor/painel.html", turmas=turmas)

    @app.route("/professor/turmas/nova", methods=["GET", "POST"])
    @perfil_required("professor")
    def turma_nova():
        if request.method == "POST":
            validar_csrf()
            nome = request.form.get("nome", "").strip()
            descricao = request.form.get("descricao", "").strip()
            if not nome:
                flash("Dê um nome para a turma.", "erro")
            else:
                db = get_db()
                codigo = gerar_codigo(db)
                cur = db.execute(
                    "INSERT INTO turmas (nome, descricao, codigo, professor_id)"
                    " VALUES (?, ?, ?, ?)",
                    (nome, descricao, codigo, g.usuario["id"]),
                )
                db.commit()
                flash(f"Turma criada! Código: {codigo}", "ok")
                return redirect(url_for("turma_professor", turma_id=cur.lastrowid))
        return render_template("professor/turma_nova.html")

    @app.get("/professor/turmas/<int:turma_id>")
    @perfil_required("professor")
    def turma_professor(turma_id):
        db = get_db()
        turma = db.execute(
            "SELECT * FROM turmas WHERE id = ? AND professor_id = ?",
            (turma_id, g.usuario["id"]),
        ).fetchone()
        if turma is None:
            abort(403, description="Você não administra esta turma.")
        alunos = db.execute(
            "SELECT u.nome, u.email, i.inscrita_em FROM inscricoes i"
            " JOIN usuarios u ON u.id = i.aluno_id"
            " WHERE i.turma_id = ? ORDER BY u.nome",
            (turma_id,),
        ).fetchall()
        materiais = db.execute(
            "SELECT m.*, (SELECT COUNT(*) FROM material_paginas p"
            " WHERE p.material_id = m.id) AS total_paginas"
            " FROM materiais m WHERE m.turma_id = ? ORDER BY m.id DESC",
            (turma_id,),
        ).fetchall()
        return render_template(
            "professor/turma_detalhe.html",
            turma=turma,
            alunos=alunos,
            materiais=materiais,
            stats=paineis.stats_turma(db, turma_id),
            ranking=paineis.ranking_turma(db, turma_id),
        )

    def _turma_do_professor(db, turma_id):
        turma = db.execute(
            "SELECT * FROM turmas WHERE id = ? AND professor_id = ?",
            (turma_id, g.usuario["id"]),
        ).fetchone()
        if turma is None:
            abort(403, description="Você não administra esta turma.")
        return turma

    @app.route(
        "/professor/turmas/<int:turma_id>/materiais/novo", methods=["GET", "POST"]
    )
    @perfil_required("professor")
    def material_novo(turma_id):
        db = get_db()
        turma = _turma_do_professor(db, turma_id)
        if request.method == "POST":
            validar_csrf()
            titulo = request.form.get("titulo", "").strip()
            origem = request.form.get("origem", "pdf")
            arquivo = request.files.get("arquivo")
            texto_colado = request.form.get("texto", "").strip()
            if not titulo:
                flash("Dê um título ao material.", "erro")
            elif origem == "texto":
                try:
                    paginas = dividir_texto_em_secoes(texto_colado)
                except ErroMaterial as e:
                    flash(str(e), "erro")
                else:
                    cur = db.execute(
                        "INSERT INTO materiais (turma_id, professor_id, titulo, origem)"
                        " VALUES (?, ?, ?, 'texto')",
                        (turma_id, g.usuario["id"], titulo),
                    )
                    db.executemany(
                        "INSERT INTO material_paginas (material_id, numero, texto)"
                        " VALUES (?, ?, ?)",
                        [(cur.lastrowid, p["numero"], p["texto"]) for p in paginas],
                    )
                    db.commit()
                    flash(
                        f"Material salvo como rascunho ({len(paginas)} seções).", "ok"
                    )
                    return redirect(
                        url_for("material_professor", material_id=cur.lastrowid)
                    )
            else:
                if arquivo is None or not arquivo.filename:
                    flash("Escolha um arquivo PDF de até 10 MB.", "erro")
                elif not arquivo.filename.lower().endswith(".pdf"):
                    flash("Arquivo inválido: envie um PDF (.pdf).", "erro")
                else:
                    dados = arquivo.read()
                    if len(dados) > LIMITE_PDF_BYTES:
                        flash("PDF maior que 10 MB. Envie um arquivo menor.", "erro")
                    else:
                        try:
                            paginas = extrair_paginas_pdf(dados)
                        except ErroMaterial as e:
                            flash(str(e), "erro")
                        else:
                            os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)
                            interno = secrets.token_hex(16) + ".pdf"
                            with open(
                                os.path.join(app.config["UPLOAD_DIR"], interno), "wb"
                            ) as f:
                                f.write(dados)
                            cur = db.execute(
                                "INSERT INTO materiais"
                                " (turma_id, professor_id, titulo, origem, arquivo)"
                                " VALUES (?, ?, ?, 'pdf', ?)",
                                (turma_id, g.usuario["id"], titulo, interno),
                            )
                            db.executemany(
                                "INSERT INTO material_paginas (material_id, numero, texto)"
                                " VALUES (?, ?, ?)",
                                [
                                    (cur.lastrowid, p["numero"], p["texto"])
                                    for p in paginas
                                ],
                            )
                            db.commit()
                            flash(
                                f"Material salvo como rascunho ({len(paginas)} páginas).",
                                "ok",
                            )
                            return redirect(
                                url_for("material_professor", material_id=cur.lastrowid)
                            )
        return render_template("professor/material_novo.html", turma=turma)

    @app.get("/professor/materiais/<int:material_id>")
    @perfil_required("professor")
    def material_professor(material_id):
        db = get_db()
        mat = db.execute(
            "SELECT m.*, t.nome AS turma_nome FROM materiais m"
            " JOIN turmas t ON t.id = m.turma_id"
            " WHERE m.id = ? AND m.professor_id = ?",
            (material_id, g.usuario["id"]),
        ).fetchone()
        if mat is None:
            abort(403, description="Você não administra este material.")
        paginas = db.execute(
            "SELECT numero, texto FROM material_paginas"
            " WHERE material_id = ? ORDER BY numero",
            (material_id,),
        ).fetchall()
        atividades = db.execute(
            "SELECT a.*, (SELECT COUNT(*) FROM questoes q WHERE q.atividade_id = a.id)"
            " AS total FROM atividades a WHERE a.material_id = ? ORDER BY a.id DESC",
            (material_id,),
        ).fetchall()
        return render_template(
            "professor/material_detalhe.html",
            mat=mat,
            paginas=paginas,
            atividades=atividades,
            ia_disponivel=bool(ia.config()["chave"]),
        )

    @app.post("/professor/materiais/<int:material_id>/estado")
    @perfil_required("professor")
    def material_estado(material_id):
        validar_csrf()
        db = get_db()
        mat = db.execute(
            "SELECT * FROM materiais WHERE id = ? AND professor_id = ?",
            (material_id, g.usuario["id"]),
        ).fetchone()
        if mat is None:
            abort(403, description="Você não administra este material.")
        acao = request.form.get("acao", "")
        novo = "liberado" if acao == "liberar" else "rascunho"
        db.execute("UPDATE materiais SET estado = ? WHERE id = ?", (novo, material_id))
        db.commit()
        flash(
            "Material liberado para os alunos."
            if novo == "liberado"
            else "Material voltou a rascunho (oculto dos alunos).",
            "ok",
        )
        return redirect(url_for("material_professor", material_id=material_id))

    @app.get("/materiais/<int:material_id>/arquivo")
    @login_required
    def material_arquivo(material_id):
        db = get_db()
        mat = db.execute(
            "SELECT * FROM materiais WHERE id = ?", (material_id,)
        ).fetchone()
        if mat is None or not mat["arquivo"]:
            abort(404)
        if g.usuario["perfil"] == "professor":
            permitido = mat["professor_id"] == g.usuario["id"]
        else:
            inscrito = db.execute(
                "SELECT id FROM inscricoes WHERE turma_id = ? AND aluno_id = ?",
                (mat["turma_id"], g.usuario["id"]),
            ).fetchone()
            permitido = inscrito and mat["estado"] == "liberado"
        if not permitido:
            abort(403, description="Sem acesso a este arquivo.")
        caminho = os.path.join(app.config["UPLOAD_DIR"], mat["arquivo"])
        if not os.path.isfile(caminho):
            abort(404)
        return send_file(
            caminho, mimetype="application/pdf", download_name=f"{mat['titulo']}.pdf"
        )

    # ---------- Questões com IA (professor) ----------

    def _material_do_professor(db, material_id):
        mat = db.execute(
            "SELECT * FROM materiais WHERE id = ? AND professor_id = ?",
            (material_id, g.usuario["id"]),
        ).fetchone()
        if mat is None:
            abort(403, description="Você não administra este material.")
        return mat

    def _salvar_atividade(db, turma_id, material_id, titulo, Questoes):
        cur = db.execute(
            "INSERT INTO atividades (turma_id, material_id, titulo) VALUES (?, ?, ?)",
            (turma_id, material_id, titulo),
        )
        for q in Questoes:
            db.execute(
                "INSERT INTO questoes (atividade_id, enunciado, resposta, alternativas,"
                " correta, explicacao, assunto, pagina, evidencia)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    cur.lastrowid,
                    q["enunciado"],
                    q["alternativas"][q["correta"]],
                    json.dumps(q["alternativas"], ensure_ascii=False),
                    q["correta"],
                    q["explicacao"],
                    q["assunto"],
                    q["pagina"],
                    q["evidencia"],
                ),
            )
        db.commit()
        return cur.lastrowid

    @app.route(
        "/professor/materiais/<int:material_id>/questoes/gerar", methods=["GET", "POST"]
    )
    @perfil_required("professor")
    def gerar_questoes(material_id):
        db = get_db()
        mat = _material_do_professor(db, material_id)
        paginas = [
            dict(r)
            for r in db.execute(
                "SELECT numero, texto FROM material_paginas"
                " WHERE material_id = ? ORDER BY numero",
                (material_id,),
            ).fetchall()
        ]
        total_chars = sum(len(p["texto"]) for p in paginas)
        cfg = ia.config()
        rotulo = "Página" if mat["origem"] == "pdf" else "Seção"
        if request.method == "POST":
            validar_csrf()
            titulo = (
                request.form.get("titulo", "").strip() or f"Atividade — {mat['titulo']}"
            )
            try:
                quantidade = int(request.form.get("quantidade", "5"))
            except ValueError:
                quantidade = 0
            if quantidade < 5 or quantidade > 10:
                flash("Escolha de 5 a 10 questões.", "erro")
            elif total_chars > cfg["limite_chars"]:
                flash(
                    f"Material com {total_chars} caracteres (limite {cfg['limite_chars']}). "
                    "Reduza o material ou divida em partes — nada foi gerado.",
                    "erro",
                )
            elif not cfg["chave"]:
                flash(
                    "Sem chave de API: a geração real está desligada. "
                    "Use o modo demonstração abaixo.",
                    "erro",
                )
            else:
                try:
                    brutas = ia.gerar_questoes(paginas, quantidade, rotulo)
                    validas, erros = ia.validar_questoes(brutas, paginas)
                except ia.ErroIA as e:
                    flash(str(e), "erro")
                else:
                    if not validas:
                        flash(
                            "A IA não retornou nenhuma questão válida: "
                            + " ".join(erros[:3]),
                            "erro",
                        )
                    else:
                        aid = _salvar_atividade(
                            db, mat["turma_id"], material_id, titulo, validas
                        )
                        msg = f"{len(validas)} questões salvas como rascunho."
                        if erros:
                            msg += " Recusadas na validação: " + " ".join(erros[:3])
                        flash(msg, "ok")
                        return redirect(url_for("revisar_atividade", atividade_id=aid))
        return render_template(
            "professor/gerar_questoes.html",
            mat=mat,
            total_chars=total_chars,
            limite=cfg["limite_chars"],
            modelo=cfg["modelo"],
            ia_disponivel=bool(cfg["chave"]),
        )

    @app.post("/professor/turmas/<int:turma_id>/demo")
    @perfil_required("professor")
    def criar_demo(turma_id):
        """Modo demonstração: material de exemplo + questões pré-cadastradas."""
        validar_csrf()
        db = get_db()
        turma = db.execute(
            "SELECT * FROM turmas WHERE id = ? AND professor_id = ?",
            (turma_id, g.usuario["id"]),
        ).fetchone()
        if turma is None:
            abort(403, description="Você não administra esta turma.")
        ja = db.execute(
            "SELECT id FROM materiais WHERE turma_id = ? AND titulo = ?",
            (turma_id, ia.MATERIAL_DEMO["titulo"]),
        ).fetchone()
        if ja:
            flash("O material de demonstração já existe nesta turma.", "erro")
            return redirect(url_for("material_professor", material_id=ja["id"]))
        cur = db.execute(
            "INSERT INTO materiais (turma_id, professor_id, titulo, origem)"
            " VALUES (?, ?, ?, 'texto')",
            (turma_id, g.usuario["id"], ia.MATERIAL_DEMO["titulo"]),
        )
        mid = cur.lastrowid
        db.executemany(
            "INSERT INTO material_paginas (material_id, numero, texto) VALUES (?, ?, ?)",
            [(mid, p["numero"], p["texto"]) for p in ia.MATERIAL_DEMO["paginas"]],
        )
        validas, erros = ia.validar_questoes(
            ia.QUESTOES_DEMO, ia.MATERIAL_DEMO["paginas"]
        )
        assert len(erros) == 0, erros
        aid = _salvar_atividade(db, turma_id, mid, "Atividade de demonstração", validas)
        flash("Demonstração pronta: revise, edite e aprove as questões.", "ok")
        return redirect(url_for("revisar_atividade", atividade_id=aid))

    def _atividade_do_professor(db, atividade_id, somente_rascunho=False):
        atv = db.execute(
            "SELECT a.*, t.nome AS turma_nome FROM atividades a"
            " JOIN turmas t ON t.id = a.turma_id"
            " WHERE a.id = ? AND t.professor_id = ?",
            (atividade_id, g.usuario["id"]),
        ).fetchone()
        if atv is None:
            abort(403, description="Você não administra esta atividade.")
        if somente_rascunho and atv["estado"] == "publicada":
            abort(
                403, description="Atividade publicada: versão preservada, sem edição."
            )
        return atv

    @app.get("/professor/atividades/<int:atividade_id>")
    @perfil_required("professor")
    def revisar_atividade(atividade_id):
        db = get_db()
        atv = _atividade_do_professor(db, atividade_id)
        questoes = []
        for r in db.execute(
            "SELECT * FROM questoes WHERE atividade_id = ? ORDER BY id", (atividade_id,)
        ).fetchall():
            q = dict(r)
            try:
                q["alts"] = json.loads(q["alternativas"] or "[]")
            except ValueError:
                q["alts"] = []
            questoes.append(q)
        return render_template(
            "professor/atividade_revisao.html", atv=atv, questoes=questoes
        )

    @app.post("/professor/questoes/<int:questao_id>/aprovacao")
    @perfil_required("professor")
    def aprovar_questao(questao_id):
        validar_csrf()
        db = get_db()
        row = db.execute(
            "SELECT q.*, a.estado FROM questoes q JOIN atividades a ON a.id = q.atividade_id"
            " JOIN turmas t ON t.id = a.turma_id"
            " WHERE q.id = ? AND t.professor_id = ?",
            (questao_id, g.usuario["id"]),
        ).fetchone()
        if row is None:
            abort(403, description="Você não administra esta questão.")
        if row["estado"] == "publicada":
            abort(
                403, description="Atividade publicada: versão preservada, sem edição."
            )
        nova = 0 if row["aprovada"] else 1
        db.execute("UPDATE questoes SET aprovada = ? WHERE id = ?", (nova, questao_id))
        db.commit()
        flash("Questão aprovada." if nova else "Aprovação retirada.", "ok")
        return redirect(url_for("revisar_atividade", atividade_id=row["atividade_id"]))

    @app.route("/professor/questoes/<int:questao_id>/editar", methods=["GET", "POST"])
    @perfil_required("professor")
    def editar_questao(questao_id):
        db = get_db()
        row = db.execute(
            "SELECT q.*, a.estado, a.material_id FROM questoes q"
            " JOIN atividades a ON a.id = q.atividade_id"
            " JOIN turmas t ON t.id = a.turma_id"
            " WHERE q.id = ? AND t.professor_id = ?",
            (questao_id, g.usuario["id"]),
        ).fetchone()
        if row is None:
            abort(403, description="Você não administra esta questão.")
        if row["estado"] == "publicada":
            abort(
                403, description="Atividade publicada: versão preservada, sem edição."
            )
        paginas = (
            [
                dict(r)
                for r in db.execute(
                    "SELECT numero FROM material_paginas WHERE material_id = ? ORDER BY numero",
                    (row["material_id"],),
                ).fetchall()
            ]
            if row["material_id"]
            else []
        )
        atual = dict(row)
        atual["alternativas"] = json.loads(row["alternativas"] or "[]")
        if request.method == "POST":
            validar_csrf()
            alts = [request.form.get(f"alt{i}", "").strip() for i in range(4)]
            try:
                pagina = int(request.form.get("pagina", "0"))
                correta = int(request.form.get("correta", "-1"))
            except ValueError:
                pagina, correta = 0, -1
            candidata = [
                {
                    "enunciado": request.form.get("enunciado", ""),
                    "alternativas": alts,
                    "correta": correta,
                    "explicacao": request.form.get("explicacao", ""),
                    "assunto": request.form.get("assunto", ""),
                    "pagina": pagina,
                    "evidencia": request.form.get("evidencia", ""),
                }
            ]
            textos = {}
            if row["material_id"]:
                for p in db.execute(
                    "SELECT numero, texto FROM material_paginas WHERE material_id = ?",
                    (row["material_id"],),
                ).fetchall():
                    textos[p["numero"]] = p["texto"]
            validas, erros = ia.validar_questoes(
                candidata, [{"numero": n, "texto": t} for n, t in textos.items()]
            )
            if erros:
                flash(" ".join(erros), "erro")
            else:
                q = validas[0]
                mudou = (
                    q["enunciado"] != row["enunciado"]
                    or q["alternativas"] != json.loads(row["alternativas"] or "[]")
                    or q["correta"] != row["correta"]
                    or q["pagina"] != row["pagina"]
                )
                db.execute(
                    "UPDATE questoes SET enunciado = ?, resposta = ?, alternativas = ?,"
                    " correta = ?, explicacao = ?, assunto = ?, pagina = ?,"
                    " evidencia = ?, aprovada = ? WHERE id = ?",
                    (
                        q["enunciado"],
                        q["alternativas"][q["correta"]],
                        json.dumps(q["alternativas"], ensure_ascii=False),
                        q["correta"],
                        q["explicacao"],
                        q["assunto"],
                        q["pagina"],
                        q["evidencia"],
                        0 if mudou else row["aprovada"],
                        questao_id,
                    ),
                )
                db.commit()
                flash(
                    "Questão atualizada."
                    + (" Aprovação anterior invalidada." if mudou else ""),
                    "ok",
                )
                return redirect(
                    url_for("revisar_atividade", atividade_id=row["atividade_id"])
                )
        return render_template(
            "professor/questao_editar.html", q=atual, paginas=paginas
        )

    @app.post("/professor/questoes/<int:questao_id>/excluir")
    @perfil_required("professor")
    def excluir_questao(questao_id):
        validar_csrf()
        db = get_db()
        row = db.execute(
            "SELECT q.id, q.atividade_id, a.estado FROM questoes q"
            " JOIN atividades a ON a.id = q.atividade_id"
            " JOIN turmas t ON t.id = a.turma_id"
            " WHERE q.id = ? AND t.professor_id = ?",
            (questao_id, g.usuario["id"]),
        ).fetchone()
        if row is None:
            abort(403, description="Você não administra esta questão.")
        if row["estado"] == "publicada":
            abort(
                403, description="Atividade publicada: versão preservada, sem edição."
            )
        db.execute("DELETE FROM questoes WHERE id = ?", (questao_id,))
        db.commit()
        flash("Questão excluída.", "ok")
        return redirect(url_for("revisar_atividade", atividade_id=row["atividade_id"]))

    @app.post("/professor/atividades/<int:atividade_id>/publicar")
    @perfil_required("professor")
    def publicar_atividade(atividade_id):
        validar_csrf()
        db = get_db()
        atv = _atividade_do_professor(db, atividade_id)
        if atv["estado"] == "publicada":
            flash("Atividade já publicada.", "erro")
            return redirect(url_for("revisar_atividade", atividade_id=atividade_id))
        total = db.execute(
            "SELECT COUNT(*) c, SUM(aprovada) a FROM questoes WHERE atividade_id = ?",
            (atividade_id,),
        ).fetchone()
        if not total["c"] or total["c"] < 5 or total["c"] > 10:
            flash("Publique com 5 a 10 questões.", "erro")
        elif (total["a"] or 0) != total["c"]:
            flash("Aprove todas as questões antes de publicar.", "erro")
        else:
            db.execute(
                "UPDATE atividades SET estado = 'publicada', publicada = 1"
                " WHERE id = ?",
                (atividade_id,),
            )
            db.commit()
            flash("Atividade publicada e congelada para os alunos.", "ok")
        return redirect(url_for("revisar_atividade", atividade_id=atividade_id))

    # ---------- Aluno ----------

    @app.get("/aluno")
    @perfil_required("aluno")
    def painel_aluno():
        db = get_db()
        turmas = db.execute(
            "SELECT t.* FROM inscricoes i JOIN turmas t ON t.id = i.turma_id"
            " WHERE i.aluno_id = ? ORDER BY t.id DESC",
            (g.usuario["id"],),
        ).fetchall()
        return render_template(
            "aluno/painel.html",
            turmas=turmas,
            resumo=paineis.resumo_aluno(db, g.usuario["id"]),
        )

    @app.route("/aluno/entrar", methods=["GET", "POST"])
    @perfil_required("aluno")
    def entrar_turma():
        if request.method == "POST":
            validar_csrf()
            codigo = request.form.get("codigo", "").strip().upper()
            db = get_db()
            turma = db.execute(
                "SELECT * FROM turmas WHERE codigo = ?", (codigo,)
            ).fetchone()
            if turma is None:
                flash("Código não encontrado. Confira com seu professor.", "erro")
            elif db.execute(
                "SELECT id FROM inscricoes WHERE turma_id = ? AND aluno_id = ?",
                (turma["id"], g.usuario["id"]),
            ).fetchone():
                flash("Você já está inscrito nesta turma.", "erro")
            else:
                db.execute(
                    "INSERT INTO inscricoes (turma_id, aluno_id) VALUES (?, ?)",
                    (turma["id"], g.usuario["id"]),
                )
                db.commit()
                flash(f"Inscrição feita na turma {turma['nome']}!", "ok")
                return redirect(url_for("turma_aluno", turma_id=turma["id"]))
        return render_template("aluno/entrar.html")

    @app.get("/aluno/turmas/<int:turma_id>")
    @perfil_required("aluno")
    def turma_aluno(turma_id):
        db = get_db()
        turma = db.execute(
            "SELECT t.* FROM inscricoes i JOIN turmas t ON t.id = i.turma_id"
            " WHERE i.turma_id = ? AND i.aluno_id = ?",
            (turma_id, g.usuario["id"]),
        ).fetchone()
        if turma is None:
            abort(403, description="Turma disponível só para alunos inscritos.")
        publicadas = db.execute(
            "SELECT * FROM atividades WHERE turma_id = ? AND publicada = 1 ORDER BY id DESC",
            (turma_id,),
        ).fetchall()
        materiais = db.execute(
            "SELECT * FROM materiais WHERE turma_id = ? AND estado = 'liberado'"
            " ORDER BY id DESC",
            (turma_id,),
        ).fetchall()
        return render_template(
            "aluno/turma.html",
            turma=turma,
            publicadas=publicadas,
            materiais=materiais,
            ranking=paineis.ranking_turma(db, turma_id),
        )

    @app.get("/aluno/materiais/<int:material_id>")
    @perfil_required("aluno")
    def material_aluno(material_id):
        db = get_db()
        mat = db.execute(
            "SELECT m.*, t.nome AS turma_nome FROM materiais m"
            " JOIN turmas t ON t.id = m.turma_id"
            " JOIN inscricoes i ON i.turma_id = m.turma_id AND i.aluno_id = ?"
            " WHERE m.id = ? AND m.estado = 'liberado'",
            (g.usuario["id"], material_id),
        ).fetchone()
        if mat is None:
            abort(
                403, description="Material disponível só para inscritos após liberação."
            )
        paginas = db.execute(
            "SELECT numero, texto FROM material_paginas"
            " WHERE material_id = ? ORDER BY numero",
            (material_id,),
        ).fetchall()
        return render_template("aluno/material.html", mat=mat, paginas=paginas)

    # ---------- Tentativas do aluno ----------

    def _atividade_do_aluno(db, atividade_id):
        atv = db.execute(
            "SELECT a.*, m.titulo AS material_titulo FROM atividades a"
            " LEFT JOIN materiais m ON m.id = a.material_id"
            " JOIN inscricoes i ON i.turma_id = a.turma_id AND i.aluno_id = ?"
            " WHERE a.id = ? AND a.estado = 'publicada'",
            (g.usuario["id"], atividade_id),
        ).fetchone()
        if atv is None:
            abort(
                403,
                description="Atividade disponível só para inscritos após publicação.",
            )
        return atv

    def _tentativa_aberta(db, tentativa_id):
        tent = db.execute(
            "SELECT * FROM tentativas WHERE id = ? AND aluno_id = ?",
            (tentativa_id, g.usuario["id"]),
        ).fetchone()
        if tent is None:
            abort(403, description="Tentativa não encontrada.")
        return tent

    def _proxima_questao(db, tentativa_id):
        return db.execute(
            "SELECT q.id, q.enunciado, q.alternativas FROM questoes q"
            " LEFT JOIN tentativa_respostas r ON r.questao_id = q.id"
            " AND r.tentativa_id = ?"
            " WHERE q.atividade_id = (SELECT atividade_id FROM tentativas WHERE id = ?)"
            " AND r.id IS NULL ORDER BY q.id LIMIT 1",
            (tentativa_id, tentativa_id),
        ).fetchone()

    @app.get("/aluno/atividades/<int:atividade_id>")
    @perfil_required("aluno")
    def atividade_aluno(atividade_id):
        db = get_db()
        atv = _atividade_do_aluno(db, atividade_id)
        aberta = db.execute(
            "SELECT id FROM tentativas WHERE atividade_id = ? AND aluno_id = ?"
            " AND concluida_em IS NULL ORDER BY id DESC LIMIT 1",
            (atividade_id, g.usuario["id"]),
        ).fetchone()
        historico = db.execute(
            "SELECT id, acertos, total, iniciada_em, concluida_em FROM tentativas"
            " WHERE atividade_id = ? AND aluno_id = ? AND concluida_em IS NOT NULL"
            " ORDER BY id DESC",
            (atividade_id, g.usuario["id"]),
        ).fetchall()
        return render_template(
            "aluno/atividade.html", atv=atv, aberta=aberta, historico=historico
        )

    @app.post("/aluno/atividades/<int:atividade_id>/iniciar")
    @perfil_required("aluno")
    def iniciar_tentativa(atividade_id):
        validar_csrf()
        db = get_db()
        _atividade = _atividade_do_aluno(db, atividade_id)
        aberta = db.execute(
            "SELECT id FROM tentativas WHERE atividade_id = ? AND aluno_id = ?"
            " AND concluida_em IS NULL ORDER BY id DESC LIMIT 1",
            (atividade_id, g.usuario["id"]),
        ).fetchone()
        if aberta:
            return redirect(url_for("responder", tentativa_id=aberta["id"]))
        total = db.execute(
            "SELECT COUNT(*) AS c FROM questoes WHERE atividade_id = ?", (atividade_id,)
        ).fetchone()["c"]
        cur = db.execute(
            "INSERT INTO tentativas (atividade_id, aluno_id, total) VALUES (?, ?, ?)",
            (atividade_id, g.usuario["id"], total),
        )
        db.commit()
        return redirect(url_for("responder", tentativa_id=cur.lastrowid))

    @app.route(
        "/aluno/tentativas/<int:tentativa_id>/responder", methods=["GET", "POST"]
    )
    @perfil_required("aluno")
    def responder(tentativa_id):
        import sqlite3

        db = get_db()
        tent = _tentativa_aberta(db, tentativa_id)
        if tent["concluida_em"] is not None:
            return redirect(url_for("resultado", tentativa_id=tentativa_id))
        if request.method == "POST":
            validar_csrf()
            atual = _proxima_questao(db, tentativa_id)
            try:
                escolha = int(request.form.get("alternativa", "-1"))
                qid = int(request.form.get("questao_id", "0"))
            except ValueError:
                escolha, qid = -1, 0
            if atual is None or qid != atual["id"] or escolha not in (0, 1, 2, 3):
                flash("Resposta inválida.", "erro")
            else:
                gab = db.execute(
                    "SELECT correta FROM questoes WHERE id = ?", (qid,)
                ).fetchone()
                try:
                    db.execute(
                        "INSERT INTO tentativa_respostas"
                        " (tentativa_id, questao_id, alternativa, correta)"
                        " VALUES (?, ?, ?, ?)",
                        (
                            tentativa_id,
                            qid,
                            escolha,
                            1 if escolha == gab["correta"] else 0,
                        ),
                    )
                    db.commit()
                except sqlite3.IntegrityError:
                    flash("Esta questão já foi respondida.", "erro")
                return redirect(
                    url_for("feedback", tentativa_id=tentativa_id, questao_id=qid)
                )
        atual = _proxima_questao(db, tentativa_id)
        if atual is None:
            return redirect(url_for("resultado", tentativa_id=tentativa_id))
        feitas = db.execute(
            "SELECT COUNT(*) AS c FROM tentativa_respostas WHERE tentativa_id = ?",
            (tentativa_id,),
        ).fetchone()["c"]
        return render_template(
            "aluno/responder.html",
            tent=tent,
            q=dict(atual, alts=json.loads(atual["alternativas"])),
            feitas=feitas,
        )

    @app.get("/aluno/tentativas/<int:tentativa_id>/feedback/<int:questao_id>")
    @perfil_required("aluno")
    def feedback(tentativa_id, questao_id):
        db = get_db()
        tent = _tentativa_aberta(db, tentativa_id)
        resp = db.execute(
            "SELECT * FROM tentativa_respostas WHERE tentativa_id = ? AND questao_id = ?",
            (tentativa_id, questao_id),
        ).fetchone()
        if resp is None:
            return redirect(url_for("responder", tentativa_id=tentativa_id))
        q = db.execute("SELECT * FROM questoes WHERE id = ?", (questao_id,)).fetchone()
        return render_template(
            "aluno/feedback.html",
            tent=tent,
            q=q,
            resp=resp,
            alts=json.loads(q["alternativas"]),
        )

    @app.get("/aluno/tentativas/<int:tentativa_id>/resultado")
    @perfil_required("aluno")
    def resultado(tentativa_id):
        db = get_db()
        tent = _tentativa_aberta(db, tentativa_id)
        if tent["concluida_em"] is None:
            feitas = db.execute(
                "SELECT COUNT(*) AS c FROM tentativa_respostas WHERE tentativa_id = ?",
                (tentativa_id,),
            ).fetchone()["c"]
            if feitas < tent["total"]:
                return redirect(url_for("responder", tentativa_id=tentativa_id))
            try:
                _acertos, _total, ganho = xp.concluir_tentativa(
                    db, tentativa_id, g.usuario["id"]
                )
            except ValueError as e:
                flash(str(e), "erro")
                return redirect(url_for("responder", tentativa_id=tentativa_id))
            if ganho:
                flash(f"Atividade concluída! +{ganho} XP.", "ok")
        tent = _tentativa_aberta(db, tentativa_id)
        return render_template("aluno/resultado.html", tent=tent)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
