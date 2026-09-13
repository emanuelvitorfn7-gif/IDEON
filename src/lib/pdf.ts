import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extrairTextoDocumento, validarArquivoPdf } from "./pdf-texto";

// Carregado sob demanda pelo formulário, apenas no navegador. Worker servido pelo próprio app.
GlobalWorkerOptions.workerSrc = workerUrl;

export async function extrairTextoPdf(arquivo: File): Promise<string> {
  const data = await validarArquivoPdf(arquivo);
  const carregamento = getDocument({ data, stopAtErrors: true });
  try {
    const documento = await carregamento.promise;
    return await extrairTextoDocumento(documento);
  } catch (erro) {
    if (erro instanceof Error && erro.name === "PasswordException") {
      throw new Error("O PDF está protegido por senha. Envie uma cópia sem senha.");
    }
    if (erro instanceof Error && erro.name === "InvalidPDFException") {
      throw new Error("O PDF está inválido ou corrompido. Selecione outro arquivo.");
    }
    throw erro;
  } finally {
    await carregamento.destroy();
  }
}
