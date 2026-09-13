import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extrairTextoDocumento, validarArquivoPdf } from "./pdf-texto";
import { MAX_BYTES_PDF } from "./conteudo-material";

// PDF real, com tabela de offsets, para exercitar o parser e a extração de todas as páginas.
function criarPdf(paginas: string[]): Uint8Array {
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const texto of paginas) {
    const stream = `BT /F1 12 Tf 50 750 Td (${texto}) Tj ET`;
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objetos.length + 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((objeto, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

async function ler(paginas: string[]) {
  const tarefa = getDocument({ data: criarPdf(paginas), useSystemFonts: true });
  try {
    return await extrairTextoDocumento(await tarefa.promise);
  } finally {
    await tarefa.destroy();
  }
}

describe("leitura de PDF", () => {
  it("extrai o texto de todas as páginas na ordem", async () => {
    const primeira = "A fotossintese transforma energia luminosa em energia quimica.";
    const ultima = "Na ultima pagina, a clorofila absorve luz para a fotossintese.";
    assert.equal(await ler([primeira, ultima]), `${primeira}\n\n${ultima}`);
  });

  it("orienta o professor quando o PDF não tem texto", async () => {
    await assert.rejects(ler([""]), /OCR/);
  });

  it("rejeita documentos acima do limite de páginas", async () => {
    await assert.rejects(ler(Array.from({ length: 101 }, () => "Texto")), /100 páginas/);
  });

  it("aceita PDF com extensão maiúscula e MIME ausente", async () => {
    const dados = criarPdf(["Texto de exemplo"]);
    const arquivo = new File([new Uint8Array(dados)], "aula.PDF");
    assert.deepEqual(await validarArquivoPdf(arquivo), dados);
  });

  it("rejeita arquivo vazio, arquivo renomeado e arquivo grande", async () => {
    await assert.rejects(validarArquivoPdf(new File([], "aula.pdf")), /vazio/);
    await assert.rejects(validarArquivoPdf(new File(["texto"], "aula.txt")), /Selecione/);
    await assert.rejects(validarArquivoPdf(new File(["texto"], "aula.pdf")), /não é um PDF/);
    await assert.rejects(
      validarArquivoPdf(new File([new Uint8Array(MAX_BYTES_PDF + 1)], "aula.pdf")),
      /10 MB/,
    );
  });
});
