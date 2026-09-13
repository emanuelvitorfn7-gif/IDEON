import { useState } from "react";
import { toast } from "sonner";
import { QuestaoCard } from "./QuestaoCard";
import { atualizarQuestao, excluirQuestoes, type Questao } from "@/services/ideon";

export function RevisaoQuestoes({
  turmaId,
  materiais,
  questoes,
  selecionadas,
  aoSelecionar,
  aoLimparSelecao,
  aoMudar,
}: {
  turmaId: string;
  materiais: Array<{ id: string; titulo: string }>;
  questoes: Questao[];
  selecionadas: Set<string>;
  aoSelecionar: (id: string, valor: boolean) => void;
  aoLimparSelecao: () => void;
  aoMudar: () => void;
}) {
  const [filtro, setFiltro] = useState("todos");
  const [modoExclusao, setModoExclusao] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // Se um material for excluído, suas questões ficam disponíveis em "Sem material".
  const filtroAtual =
    filtro === "todos" || filtro === "sem-material" || materiais.some((m) => m.id === filtro)
      ? filtro
      : "sem-material";
  const visiveis = questoes.filter(
    (q) =>
      filtroAtual === "todos" ||
      (filtroAtual === "sem-material" ? !q.material_id : q.material_id === filtroAtual),
  );
  const removiveis = visiveis.filter((q) => !q.em_uso);
  const idsExclusao = removiveis.filter((q) => marcadas.has(q.id)).map((q) => q.id);
  const pendentes = visiveis.filter((q) => !q.aprovada);

  function marcar(id: string, valor: boolean) {
    setMarcadas((atual) => {
      const proxima = new Set(atual);
      if (valor) proxima.add(id);
      else proxima.delete(id);
      return proxima;
    });
  }

  async function excluirLote() {
    if (ocupado || idsExclusao.length === 0) return;
    if (
      !window.confirm(
        `Excluir ${idsExclusao.length} questão(ões) selecionada(s)? Essa ação não pode ser desfeita. Questões em atividades serão preservadas.`,
      )
    )
      return;
    setOcupado(true);
    try {
      const resultado = await excluirQuestoes(turmaId, idsExclusao);
      resultado.excluidas.forEach((id) => aoSelecionar(id, false));
      setMarcadas(new Set());
      toast.success(
        `${resultado.excluidas.length} questão(ões) excluída(s).${resultado.preservadas ? ` ${resultado.preservadas} em atividade foram preservadas.` : ""}`,
      );
      aoMudar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir as questões.");
    } finally {
      setOcupado(false);
    }
  }

  async function aprovarVisiveis() {
    setOcupado(true);
    try {
      await Promise.all(pendentes.map((q) => atualizarQuestao(q.id, { aprovada: true })));
      toast.success("Questões exibidas aprovadas.");
    } catch {
      toast.error("Não foi possível aprovar todas as questões. Confira a lista atualizada.");
    } finally {
      aoMudar();
      setOcupado(false);
    }
  }

  return (
    <>
      <h2 className="text-display mt-10 text-2xl">Revisão de questões</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Filtre por material para revisar as questões. Só as questões aprovadas que você selecionar
        entram na nova atividade.
      </p>
      <label className="mt-4 block text-xs font-semibold">
        Material das questões
        <select
          value={filtroAtual}
          disabled={ocupado}
          onChange={(e) => {
            setFiltro(e.target.value);
            setMarcadas(new Set());
            aoLimparSelecao();
          }}
          className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="todos">Todos os materiais</option>
          {materiais.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titulo}
            </option>
          ))}
          <option value="sem-material">Sem material (material removido)</option>
        </select>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!modoExclusao && pendentes.length > 0 ? (
          <button
            disabled={ocupado}
            onClick={() => void aprovarVisiveis()}
            className="rounded-xl border border-success/30 bg-success/10 px-4 py-2 text-xs font-bold text-success disabled:opacity-40"
          >
            Aprovar exibidas ({pendentes.length})
          </button>
        ) : null}
        <button
          disabled={ocupado}
          onClick={() => {
            setModoExclusao(!modoExclusao);
            setMarcadas(new Set());
          }}
          className="rounded-xl border border-border px-4 py-2 text-xs font-bold disabled:opacity-40"
        >
          {modoExclusao ? "Concluir seleção para excluir" : "Selecionar para excluir"}
        </button>
        {modoExclusao ? (
          <>
            <button
              disabled={ocupado || removiveis.length === 0}
              onClick={() =>
                setMarcadas(
                  new Set(
                    idsExclusao.length === removiveis.length ? [] : removiveis.map((q) => q.id),
                  ),
                )
              }
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              {removiveis.length > 0 && idsExclusao.length === removiveis.length
                ? "Desmarcar todas"
                : "Selecionar todas sem uso"}
            </button>
            <button
              disabled={ocupado || idsExclusao.length === 0}
              onClick={() => void excluirLote()}
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-xs font-bold text-danger disabled:opacity-40"
            >
              {ocupado ? "Aguarde..." : `Excluir selecionadas (${idsExclusao.length})`}
            </button>
          </>
        ) : null}
      </div>
      {modoExclusao ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Questões em atividades ou rascunhos são preservadas. A seleção para excluir é independente
          da seleção para a nova atividade.
        </p>
      ) : null}
      {visiveis.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhuma questão neste filtro. Adicione um material e clique em "Gerar questões".
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {visiveis.map((q) => (
            <QuestaoCard
              key={q.id}
              questao={q}
              selecionavel={modoExclusao ? !q.em_uso : q.aprovada}
              selecionada={modoExclusao ? marcadas.has(q.id) : selecionadas.has(q.id)}
              aoSelecionar={modoExclusao ? marcar : aoSelecionar}
              rotuloSelecao={
                modoExclusao
                  ? "Selecionar questão para excluir"
                  : "Selecionar questão para atividade"
              }
              bloqueada={ocupado}
              aoMudar={aoMudar}
            />
          ))}
        </ul>
      )}
    </>
  );
}
