export const MAX_CARACTERES_MATERIAL = 100_000;
export const MAX_BYTES_PDF = 10 * 1024 * 1024;
export const MAX_PAGINAS_PDF = 100;

export function validarConteudoMaterial(conteudo: string): string {
  const texto = conteudo.trim();
  if (texto.length < 50) {
    throw new Error("O material precisa conter pelo menos 50 caracteres de texto.");
  }
  if (texto.length > MAX_CARACTERES_MATERIAL) {
    throw new Error("O material excede 100 mil caracteres. Divida-o em materiais menores.");
  }
  return texto;
}
