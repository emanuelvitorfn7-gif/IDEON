export const XP_POR_NIVEL = 500;

export type FaixaNivel = {
  nivel: number;
  titulo: string;
  xpAtual: number;
  xpNecessario: number;
  progresso: number;
};

/** Fonte única da verdade para nível, título e progresso exibidos pela aplicação. */
export function getLevelFromXP(valor: number): FaixaNivel {
  const xp = Math.max(0, Math.floor(valor));
  const nivel = Math.floor(xp / XP_POR_NIVEL) + 1;
  const xpAtual = xp % XP_POR_NIVEL;
  return {
    nivel,
    titulo: tituloPorNivel(nivel),
    xpAtual,
    xpNecessario: XP_POR_NIVEL,
    progresso: Math.round((xpAtual / XP_POR_NIVEL) * 100),
  };
}

export function nivelPorXp(xp: number): number {
  return getLevelFromXP(xp).nivel;
}

export function xpNoNivel(xp: number): number {
  return xp % XP_POR_NIVEL;
}

export function progressoNivel(xp: number): number {
  return Math.round((xpNoNivel(xp) / XP_POR_NIVEL) * 100);
}

export function tituloPorNivel(nivel: number): string {
  if (nivel >= 30) return "Mestre";
  if (nivel >= 20) return "Especialista";
  if (nivel >= 10) return "Explorador";
  if (nivel >= 5) return "Aprendiz";
  return "Iniciante";
}

export function xpDaSubmissao(acertos: number, total: number, xpAtividade: number): number {
  if (total === 0) return 0;
  return Math.round((acertos / total) * xpAtividade);
}

export function gerarCodigoTurma(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const parte = Array.from(
    { length: 2 },
    () => letras[Math.floor(Math.random() * letras.length)],
  ).join("");
  const ano = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `${parte}-${ano}-${num}`;
}
