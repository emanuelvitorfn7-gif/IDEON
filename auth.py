"""Autenticação, CSRF e permissões (helpers usados pelas rotas)."""

import secrets
from functools import wraps

from flask import abort, g, redirect, request, session, url_for


def csrf_token():
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_hex(16)
        session["csrf_token"] = token
    return token


def validar_csrf():
    esperado = session.get("csrf_token", "")
    recebido = request.form.get("csrf_token", "")
    if not esperado or not recebido or recebido != esperado:
        abort(400, description="Token CSRF inválido.")


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if g.get("usuario") is None:
            return redirect(url_for("login", proximo=request.path))
        return view(*args, **kwargs)

    return wrapped


def perfil_required(*perfis):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.get("usuario") is None:
                return redirect(url_for("login", proximo=request.path))
            if g.usuario["perfil"] not in perfis:
                abort(403, description="Acesso restrito a este perfil.")
            return view(*args, **kwargs)

        return wrapped

    return decorator
