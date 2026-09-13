/** O formulário coleta um dia, não um instante: preserve a data mesmo em UTC-3. */
export function formatarPrazo(prazo: string | null | undefined, comHora = false): string {
  if (!prazo) return "Sem prazo";
  if (comHora) {
    const data = new Date(prazo);
    if (Number.isNaN(data.getTime())) return "Prazo inválido";
    const partes = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Recife",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(data);
    const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
    return `${campo("day")}/${campo("month")}/${campo("year")} ${campo("hour")}:${campo("minute")}h`;
  }
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(prazo);
  if (!partes) return "Prazo inválido";
  const [, ano, mes, dia] = partes;
  const data = new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== `${ano}-${mes}-${dia}`) {
    return "Prazo inválido";
  }
  return `${dia}/${mes}/${ano}`;
}

/** O datetime-local representa o horário de Brasília, independentemente do computador. */
export function prazoParaISO(valor: string): string | null {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor))
    throw new Error("Informe uma data e hora válidas.");
  const data = new Date(`${valor}:00-03:00`);
  if (Number.isNaN(data.getTime()) || prazoParaFormulario(data.toISOString(), true) !== valor) {
    throw new Error("Informe uma data e hora válidas.");
  }
  return data.toISOString();
}

export function prazoParaFormulario(prazo: string | null | undefined, comHora = false): string {
  if (!prazo) return "";
  if (!comHora) return `${prazo.slice(0, 10)}T23:59`;
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return "";
  return new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
