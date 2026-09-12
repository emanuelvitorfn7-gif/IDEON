import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { Questao } from "@/services/ideon";
import { atualizarQuestao, excluirQuestao } from "@/services/ideon";

const DIFICULDADES = ["Fácil", "Médio", "Difícil"] as const;

export function QuestaoCard({
  questao,
  selecionavel,
  selecionada,
  aoSelecionar,
  aoMudar,
}: {
  questao: Questao;
  selecionavel?: boolean;
  selecionada?: boolean;
  aoSelecionar?: (id: string, valor: boolean) => void;
  aoMudar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enunciado, setEnunciado] = useState(questao.enunciado);
  const [alternativas, setAlternativas] = useState<string[]>(
    questao.alternativas.length === 4
      ? questao.alternativas
      : [...questao.alternativas, "", "", "", ""].slice(0, 4),
  );
  const [correta, setCorreta] = useState(questao.correta);
  const [dificuldade, setDificuldade] = useState(questao.dificuldade);
  const [assunto, setAssunto] = useState(questao.assunto);

  async function salvar() {
    if (
      enunciado.trim().length < 10 ||
      alternativas.some((a) => !a.trim()) ||
      new Set(alternativas.map((a) => a.trim())).size !== 4 ||
      !assunto.trim()
    ) {
      toast.error("Preencha enunciado, assunto e quatro alternativas diferentes.");
      return;
    }
    setSalvando(true);
    try {
      await atualizarQuestao(questao.id, {
        enunciado: enunciado.trim(),
        alternativas: alternativas.map((a) => a.trim()),
        correta,
        dificuldade,
        assunto: assunto.trim(),
        aprovada: false,
      });
      toast.success("Questão atualizada.");
      setEditando(false);
      aoMudar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a questão.");
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    try {
      await atualizarQuestao(questao.id, { aprovada: !questao.aprovada });
      toast.success(questao.aprovada ? "Aprovação removida." : "Questão aprovada.");
      aoMudar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar a questão.");
    }
  }

  async function excluir() {
    if (!window.confirm("Excluir esta questão? Essa ação não pode ser desfeita.")) return;
    try {
      await excluirQuestao(questao.id);
      toast.success("Questão excluída.");
      aoMudar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir a questão.");
    }
  }

  if (editando) {
    return (
      <li className="rounded-2xl border border-aura/30 bg-background/40 p-4">
        <textarea
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-aura/50"
        />
        <div className="mt-3 space-y-2">
          {alternativas.map((alt, i) => (
            <label key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correta-${questao.id}`}
                checked={correta === i}
                onChange={() => setCorreta(i)}
                className="accent-aura"
              />
              <input
                value={alt}
                onChange={(e) => {
                  const novas = [...alternativas];
                  novas[i] = e.target.value;
                  setAlternativas(novas);
                }}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-aura/50"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 py-1.5 text-sm outline-none"
          />
          <select
            value={dificuldade}
            onChange={(e) => setDificuldade(e.target.value)}
            className="rounded-lg border border-input bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-aura/50"
          >
            {DIFICULDADES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => setEditando(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => void salvar()}
              disabled={salvando}
              className="rounded-lg bg-aura px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {selecionavel ? (
            <input
              type="checkbox"
              checked={Boolean(selecionada)}
              onChange={(e) => aoSelecionar?.(questao.id, e.target.checked)}
              className="mt-1 accent-aura"
            />
          ) : null}
          <p className="text-sm">{questao.enunciado}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          <span className="rounded-full bg-aura/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-aura">
            Gerada por IA
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              questao.aprovada ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
            }`}
          >
            {questao.aprovada ? "Aprovada" : "Pendente"}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 pl-1">
        {questao.alternativas.map((alt, i) => (
          <li
            key={i}
            className={`text-xs ${i === questao.correta ? "font-semibold text-success" : "text-muted-foreground"}`}
          >
            {i === questao.correta ? "✓ " : "· "}
            {alt}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {questao.assunto} · {questao.dificuldade}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setEditando(true)}
            aria-label="Editar"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => void aprovar()}
            aria-label={questao.aprovada ? "Remover aprovação" : "Aprovar"}
            className={`grid size-8 place-items-center rounded-lg border transition ${
              questao.aprovada
                ? "border-success/40 text-success hover:bg-success/10"
                : "border-border text-muted-foreground hover:text-success"
            }`}
          >
            {questao.aprovada ? <X className="size-3.5" /> : <Check className="size-3.5" />}
          </button>
          <button
            onClick={() => void excluir()}
            aria-label="Excluir"
            className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground transition hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
