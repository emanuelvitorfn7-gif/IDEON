/** O formulário coleta um dia, não um instante: preserve a data mesmo em UTC-3. */
export function formatarPrazo(prazo: string | null | undefined): string {
  if (!prazo) return "Sem prazo";
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(prazo);
  if (!partes) return "Prazo inválido";
  const [, ano, mes, dia] = partes;
  const data = new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== `${ano}-${mes}-${dia}`) {
    return "Prazo inválido";
  }
  return `${dia}/${mes}/${ano}`;
}
