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

export function ConfirmarRemocaoQuestoes({
  aberto,
  quantidade,
  emUso,
  ocupado,
  aoAbrir,
  aoConfirmar,
}: {
  aberto: boolean;
  quantidade: number;
  emUso: number;
  ocupado: boolean;
  aoAbrir: (aberto: boolean) => void;
  aoConfirmar: () => void;
}) {
  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(valor) => {
        if (!ocupado) aoAbrir(valor);
      }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-3xl border-border bg-background p-6 sm:rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-display text-2xl">
            Remover {quantidade === 1 ? "questão" : `${quantidade} questões`} da revisão?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Questões sem vínculo com atividades serão excluídas permanentemente. Questões em
            atividades serão arquivadas e sairão desta lista, mantendo as atividades e os resultados
            dos alunos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {emUso > 0 ? (
          <p className="rounded-xl bg-aura/10 p-3 text-sm text-aura">
            {emUso} questão(ões) selecionada(s) está(ão) em atividades e será(ão) arquivada(s).
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ocupado} className="rounded-xl">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={ocupado || quantidade === 0}
            onClick={(e) => {
              e.preventDefault();
              aoConfirmar();
            }}
            className="rounded-xl bg-danger text-white hover:bg-danger/90"
          >
            {ocupado ? "Removendo..." : "Remover da revisão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
