import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { excluirMaterial } from "@/services/ideon";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function ExcluirMaterial({
  material,
  bloqueado,
  aoExcluir,
}: {
  material: { id: string; titulo: string };
  bloqueado: boolean;
  aoExcluir: (questoesExcluidas: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [excluirQuestoes, setExcluirQuestoes] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function confirmar() {
    if (excluindo || bloqueado) return;
    setExcluindo(true);
    try {
      const resultado = await excluirMaterial(material.id, excluirQuestoes);
      toast.success(
        `Material excluído. ${resultado.excluidas.length} questão(ões) excluída(s) e ${resultado.preservadas} preservada(s).`,
      );
      setAberto(false);
      aoExcluir(resultado.excluidas);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir o material.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(valor) => {
        if (excluindo) return;
        setAberto(valor);
        if (valor) setExcluirQuestoes(false);
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          disabled={bloqueado}
          aria-label={`Excluir material ${material.titulo}`}
          title={bloqueado ? "Aguarde a geração terminar" : "Excluir material"}
          className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:text-danger disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Excluir
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir material?</AlertDialogTitle>
          <AlertDialogDescription>
            “{material.titulo}” será apagado. Por padrão, suas questões serão mantidas e aparecerão
            em “Sem material”. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={excluirQuestoes}
            disabled={excluindo}
            onChange={(e) => setExcluirQuestoes(e.target.checked)}
            className="mt-1 accent-aura"
          />
          Apagar também as questões deste material que não estão em atividades.
        </label>
        <p className="text-xs text-muted-foreground">
          Questões vinculadas a atividades ou rascunhos serão preservadas.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={excluindo || bloqueado}
            onClick={(e) => {
              e.preventDefault();
              void confirmar();
            }}
            className="bg-danger text-white hover:bg-danger/90"
          >
            {excluindo ? "Excluindo..." : "Excluir material"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
