"""Extração de texto de PDFs e divisão de texto colado em seções."""

from pypdf import PdfReader
from pypdf.errors import PdfReadError

LIMITE_PDF_BYTES = 10 * 1024 * 1024
MIN_TEXTO_PAGINA = 20  # abaixo disso a página conta como "sem texto útil"


class ErroMaterial(Exception):
    """Falha de validação/extração com mensagem pronta para o professor."""


def extrair_paginas_pdf(dados: bytes) -> list:
    """Extrai texto página a página. Nunca retorna extração parcial como sucesso."""
    if not dados:
        raise ErroMaterial("Arquivo vazio. Envie um PDF válido.")
    if not dados.startswith(b"%PDF"):
        raise ErroMaterial("Arquivo inválido: não é um PDF legível.")
    try:
        leitor = PdfReader(__import__("io").BytesIO(dados))
        if leitor.is_encrypted:
            raise ErroMaterial("PDF protegido por senha. Envie uma versão sem senha.")
        brutas = list(leitor.pages)
    except ErroMaterial:
        raise
    except (PdfReadError, ValueError, EOFError):
        raise ErroMaterial("PDF corrompido ou ilegível. Envie outro arquivo.")
    except Exception:  # noqa: BLE001
        raise ErroMaterial("Não foi possível ler este PDF. Envie outro arquivo.")
    if not brutas:
        raise ErroMaterial("PDF sem páginas legíveis.")
    paginas = []
    try:
        for i, pagina in enumerate(brutas, start=1):
            texto = (pagina.extract_text() or "").strip()
            paginas.append({"numero": i, "texto": texto})
    except Exception:  # noqa: BLE001
        raise ErroMaterial("Falha ao extrair o texto. Envie outro arquivo.")
    uteis = sum(1 for p in paginas if len(p["texto"]) >= MIN_TEXTO_PAGINA)
    if uteis == 0:
        raise ErroMaterial(
            "Nenhum texto selecionável encontrado. "
            "Se for PDF digitalizado (imagem), o MVP ainda não possui OCR."
        )
    return paginas


def dividir_texto_em_secoes(texto: str, max_chars: int = 2000) -> list:
    """Divide texto colado em seções numeradas a partir de 1."""
    texto = (texto or "").strip()
    if not texto:
        raise ErroMaterial("Cole algum texto para criar o material.")
    blocos = [b.strip() for b in texto.split("\n\n") if b.strip()] or [texto]
    secoes, atual = [], ""
    for bloco in blocos:
        candidato = (atual + "\n\n" + bloco).strip() if atual else bloco
        if len(candidato) > max_chars and atual:
            secoes.append(atual)
            atual = bloco
        else:
            atual = candidato
    if atual:
        secoes.append(atual)
    return [{"numero": i, "texto": s} for i, s in enumerate(secoes, start=1)]
