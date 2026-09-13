import type { PDFDocumentProxy } from "pdfjs-dist";
import { MAX_BYTES_PDF, MAX_CARACTERES_MATERIAL, MAX_PAGINAS_PDF } from "./conteudo-material";

export async function validarArquivoPdf(arquivo: File): Promise<Uint8Array> {
  if (!/\.pdf$/i.test(arquivo.name)) throw new Error("Selecione um arquivo PDF (.pdf).");
  if (arquivo.size === 0) throw new Error("O PDF está vazio. Selecione outro arquivo.");
  if (arquivo.size > MAX_BYTES_PDF) throw new Error("O PDF deve ter no máximo 10 MB.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  // O filtro do seletor de arquivos não impede arquivos renomeados como .pdf.
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) {
    throw new Error("O arquivo selecionado não é um PDF válido.");
  }
  return bytes;
}

export async function extrairTextoDocumento(documento: PDFDocumentProxy): Promise<string> {
  if (documento.numPages > MAX_PAGINAS_PDF) {
    throw new Error("O PDF deve ter no máximo 100 páginas. Divida-o em arquivos menores.");
  }
  const paginas: string[] = [];
  let total = 0;
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    try {
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .trim();
      total += texto.length + (paginas.length ? 2 : 0);
      if (total > MAX_CARACTERES_MATERIAL) {
        throw new Error("O PDF excede 100 mil caracteres. Divida-o em arquivos menores.");
      }
      paginas.push(texto);
    } finally {
      pagina.cleanup();
    }
  }
  const texto = paginas.join("\n\n").trim();
  if (texto.length < 50) {
    throw new Error(
      "O PDF não contém texto selecionável suficiente (mínimo 50 caracteres). Se for digitalizado, converta-o em texto com OCR ou cole o conteúdo da aula.",
    );
  }
  return texto;
}
