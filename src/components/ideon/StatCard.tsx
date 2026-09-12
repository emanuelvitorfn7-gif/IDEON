import type { LucideIcon } from "lucide-react";

export function StatCard({
  rotulo,
  valor,
  detalhe,
  icone: Icone,
  tom = "aura",
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
  icone?: LucideIcon;
  tom?: "aura" | "nova" | "mist";
}) {
  const cor = tom === "aura" ? "text-aura" : tom === "nova" ? "text-nova" : "text-foreground";
  return (
    <div className="rise-in rounded-2xl glass-panel px-6 py-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        {Icone ? <Icone className={`size-4 ${cor}`} /> : null}
      </div>
      <p className={`text-display mt-2 text-3xl ${cor}`}>{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
