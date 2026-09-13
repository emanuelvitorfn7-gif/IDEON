export const DURACAO_MINIMA = 1;
export const DURACAO_MAXIMA = 240;

export function validarDuracao(valor: number): number {
  if (!Number.isInteger(valor) || valor < DURACAO_MINIMA || valor > DURACAO_MAXIMA) {
    throw new Error(`Escolha uma duração entre ${DURACAO_MINIMA} e ${DURACAO_MAXIMA} minutos.`);
  }
  return valor;
}

/** O relógio do servidor é a referência; alterações no relógio local não dão mais tempo. */
export function segundosRestantes(fim: string, agoraServidor: string, decorridoMs: number): number {
  const restante = Date.parse(fim) - Date.parse(agoraServidor) - Math.max(0, decorridoMs);
  return Number.isFinite(restante) ? Math.max(0, Math.ceil(restante / 1000)) : 0;
}

export function formatarContagem(segundos: number): string {
  return `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;
}
