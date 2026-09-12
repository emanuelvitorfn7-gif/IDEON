export function Logo({ legenda = "Inteligência Educacional" }: { legenda?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl brand-gradient shadow-[var(--shadow-aura)]">
        <span className="text-display text-lg italic text-background">i</span>
      </div>
      <div>
        <p className="text-display text-lg leading-none">Ideon</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{legenda}</p>
      </div>
    </div>
  );
}
