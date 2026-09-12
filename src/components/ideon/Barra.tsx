export function Barra({
  valor,
  tom = "aura",
}: {
  valor: number;
  tom?: "aura" | "nova" | "success" | "warning" | "danger";
}) {
  const cores: Record<string, string> = {
    aura: "bg-aura",
    nova: "bg-nova",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
      <div
        className={`h-full origin-left rounded-full fill-bar ${cores[tom]}`}
        style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
      />
    </div>
  );
}
