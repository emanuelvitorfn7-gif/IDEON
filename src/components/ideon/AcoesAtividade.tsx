import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirAtividade, atualizarPrazoAtividade } from "@/services/ideon";
import { prazoParaFormulario, prazoParaISO } from "@/lib/datas";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function AcoesAtividade({
  atividade,
  aoMudar,
}: {
  atividade: {
    id: string;
    titulo: string;
    prazo: string | null;
    prazo_com_hora: boolean;
    excluir_ao_vencer: boolean;
  };
  aoMudar: (excluidas: string[]) => void;
}) {
  const [modal, setModal] = useState<"excluir" | "prazo" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [prazo, setPrazo] = useState("");
  const [automatico, setAutomatico] = useState(false);

  function abrirPrazo() {
    setPrazo(prazoParaFormulario(atividade.prazo, atividade.prazo_com_hora));
    setAutomatico(Boolean(atividade.excluir_ao_vencer));
    setModal("prazo");
  }

  async function confirmar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      let excluidas: string[] = [];
      if (modal === "excluir") {
        const resultado = await excluirAtividade(atividade.id);
        excluidas = resultado.excluidas;
        toast.success(
          `Atividade excluída. ${excluidas.length} questão(ões) excluída(s); ${resultado.preservadas} compartilhada(s) mantida(s).`,
        );
      } else {
        await atualizarPrazoAtividade(atividade.id, prazoParaISO(prazo), automatico);
        toast.success("Prazo atualizado.");
      }
      setModal(null);
      aoMudar(excluidas);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível atualizar a atividade.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={abrirPrazo}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
        >
          <CalendarClock className="size-3.5" /> Ajustar prazo
        </button>
        <button
          onClick={() => setModal("excluir")}
          aria-label={`Excluir atividade ${atividade.titulo}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger"
        >
          <Trash2 className="size-3.5" /> Excluir
        </button>
      </div>
      <AlertDialog
        open={modal !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !ocupado) setModal(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%_-_2rem)] rounded-3xl sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-display text-2xl">
              {modal === "excluir" ? "Excluir atividade?" : "Ajustar prazo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {modal === "excluir"
                ? `“${atividade.titulo}” e seus resultados serão excluídos, junto com as questões que não estiverem em outras atividades. Questões compartilhadas, materiais e XP já conquistado serão mantidos. Essa ação não pode ser desfeita.`
                : `Defina a data e hora de encerramento de “${atividade.titulo}”. Horário de Brasília (UTC−3).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {modal === "prazo" ? (
            <fieldset disabled={ocupado} className="space-y-4">
              <label className="block text-sm">
                Data e hora
                <input
                  type="datetime-local"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  className="mt-2 block w-full rounded-xl border border-input bg-background px-3 py-2"
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={automatico}
                  onChange={(e) => setAutomatico(e.target.checked)}
                  className="mt-1 accent-aura"
                />
                Excluir automaticamente ao vencer o prazo
              </label>
              <p className="text-xs text-muted-foreground">
                Sem essa opção, a atividade permanece para consulta após encerrar as respostas. Com
                ela, a atividade, seus resultados e questões exclusivas serão apagados. A limpeza
                verifica os prazos a cada minuto e vale para atividades publicadas.
              </p>
            </fieldset>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={ocupado}
              onClick={(e) => {
                e.preventDefault();
                void confirmar();
              }}
              className={
                modal === "excluir"
                  ? "bg-danger text-white hover:bg-danger/90"
                  : "bg-aura text-primary-foreground"
              }
            >
              {ocupado
                ? "Aguarde..."
                : modal === "excluir"
                  ? "Excluir atividade e questões exclusivas"
                  : "Salvar prazo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
