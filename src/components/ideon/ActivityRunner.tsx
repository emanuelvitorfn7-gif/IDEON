import { formatarContagem, segundosRestantes } from "@/lib/duracao-atividade";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatarPrazo } from "@/lib/datas";
import {
  carregarAtividadeAluno,
  enviarSubmissao,
  iniciarAtividadeAluno,
} from "@/lib/atividade.functions";

export function ActivityRunner({
  atividadeId,
  aoFechar,
}: {
  atividadeId: string;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["atividade-segura", atividadeId, user?.id];
  const [iniciando, setIniciando] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const [resultadoEnviado, setResultado] = useState<Awaited<
    ReturnType<typeof enviarSubmissao>
  > | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const atividade = await carregarAtividadeAluno({ data: { atividadeId } });
      return { ...atividade, recebidoEm: performance.now() };
    },
    refetchInterval: 30_000,
  });

  const resultado = resultadoEnviado ?? data?.resultado;
  const decorrido = data ? Math.max(0, agora - data.recebidoEm) : 0;
  const restante = data?.termina_em
    ? segundosRestantes(data.termina_em, data.agora_servidor, decorrido)
    : null;
  const prazoEncerrado = Boolean(
    data?.prazo_com_hora &&
    data.prazo &&
    segundosRestantes(data.prazo, data.agora_servidor, decorrido) === 0,
  );
  const tempoEncerrado = !resultado && (prazoEncerrado || restante === 0);

  async function iniciar() {
    if (iniciando || error) return;
    setIniciando(true);
    try {
      // Cancela leituras anteriores para que não sobrescrevam a tentativa recém-iniciada.
      await queryClient.cancelQueries({ queryKey });
      const atividade = await iniciarAtividadeAluno({ data: { atividadeId } });
      queryClient.setQueryData(queryKey, { ...atividade, recebidoEm: performance.now() });
      setAgora(performance.now());
    } catch (erroInicio) {
      toast.error(erroInicio instanceof Error ? erroInicio.message : "Não foi possível iniciar.");
    } finally {
      setIniciando(false);
    }
  }

  async function enviar() {
    if (enviando || !data?.iniciada_em || tempoEncerrado || error) {
      toast.error("Esta atividade não está mais disponível para respostas.");
      return;
    }
    if (
      !data ||
      data.questoes.length === 0 ||
      data.questoes.some((q) => respostas[q.id] === undefined)
    ) {
      toast.error("Responda todas as questões antes de enviar.");
      return;
    }
    setEnviando(true);
    try {
      const resposta = await enviarSubmissao({ data: { atividadeId, respostas } });
      setResultado(resposta);
      await queryClient.invalidateQueries({ queryKey });
      toast.success(
        resposta.ja_enviada
          ? "Esta atividade já havia sido enviada."
          : `Atividade concluída: +${resposta.xp_ganho} XP!`,
      );
      await queryClient.invalidateQueries({ queryKey: ["atividades-aluno"] });
    } catch (erroEnvio) {
      void queryClient.invalidateQueries({ queryKey });
      toast.error(
        erroEnvio instanceof Error ? erroEnvio.message : "Não foi possível enviar a atividade.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 backdrop-blur-md md:p-8">
      <main className="mx-auto max-w-3xl rounded-[2rem] glass-panel p-6 md:p-10">
        <button
          onClick={aoFechar}
          className="float-right grid size-9 place-items-center rounded-full border border-border"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Carregando atividade…
          </p>
        ) : null}
        {error ? <p className="text-sm text-danger">{error.message}</p> : null}
        {data ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-wider text-aura">Atividade</p>
            <h2 className="text-display mt-1 text-3xl">{data.titulo}</h2>
            {data.descricao ? (
              <p className="mt-2 text-sm text-muted-foreground">{data.descricao}</p>
            ) : null}
            {data.prazo ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Prazo: {formatarPrazo(data.prazo, data.prazo_com_hora)} (Brasília)
              </p>
            ) : null}
            {data.iniciada_em && restante !== null && !resultado ? (
              <div className="sticky top-2 z-10 mt-4 rounded-2xl border border-aura/30 bg-background p-4">
                <p className={restante <= 60 ? "font-bold text-warning" : "font-bold text-aura"}>
                  Tempo restante:{" "}
                  <span role="timer" aria-label="Tempo restante" className="tabular-nums">
                    {formatarContagem(restante)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Envie suas respostas antes de o tempo acabar. Sair não pausa o cronômetro.
                </p>
              </div>
            ) : null}
            {!data.iniciada_em && !resultado ? (
              <div className="mt-6 rounded-2xl border border-border p-5">
                {data.duracao_minutos ? (
                  <>
                    <p className="font-semibold">Duração: {data.duracao_minutos} minutos</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      O cronômetro começa ao clicar em iniciar. Fechar ou atualizar a página não
                      reinicia o tempo. Envie todas as respostas antes do fim; não há envio
                      automático.
                      {data.prazo_com_hora && data.prazo
                        ? " Se o prazo final chegar antes, o tempo disponível será menor."
                        : ""}
                    </p>
                    <button
                      onClick={() => void iniciar()}
                      disabled={iniciando || tempoEncerrado || Boolean(error)}
                      className="mt-4 rounded-xl bg-aura px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                    >
                      {iniciando ? "Iniciando…" : "Iniciar atividade"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-warning">
                    O professor precisa definir a duração para liberar esta atividade.
                  </p>
                )}
              </div>
            ) : null}
            {tempoEncerrado ? (
              <p role="status" className="mt-2 text-sm text-warning">
                O tempo para responder encerrou. Não é mais possível enviar respostas.
              </p>
            ) : null}
            <ol className="mt-8 space-y-6">
              {data.questoes.map((q, indice) => {
                const detalhe = resultado?.detalhes.find((d) => d.questao_id === q.id);
                return (
                  <li key={q.id} className="rounded-2xl border border-border bg-background/40 p-5">
                    <p className="font-semibold">
                      {indice + 1}. {q.enunciado}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {q.assunto} · {q.dificuldade}
                    </p>
                    <div className="mt-4 grid gap-2">
                      {q.alternativas.map((alternativa, i) => (
                        <label
                          key={i}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${resultado && i === detalhe?.correta ? "border-success bg-success/10" : respostas[q.id] === i ? "border-aura bg-aura/10" : "border-border"}`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={respostas[q.id] === i}
                            disabled={
                              Boolean(resultado) || enviando || tempoEncerrado || Boolean(error)
                            }
                            onChange={() => setRespostas((r) => ({ ...r, [q.id]: i }))}
                          />
                          {alternativa}
                        </label>
                      ))}
                    </div>
                    {detalhe ? (
                      <p
                        className={`mt-3 text-sm ${detalhe.acertou ? "text-success" : "text-warning"}`}
                      >
                        {detalhe.acertou ? "Resposta correta. " : "Vamos revisar. "}
                        {detalhe.explicacao}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {resultado ? (
              <div className="mt-8 rounded-2xl bg-aura/10 p-5 text-center">
                <strong>
                  {resultado.acertos}/{resultado.total} acertos
                </strong>
                <p className="text-sm text-muted-foreground">
                  {resultado.xp_ganho} XP conquistados
                </p>
              </div>
            ) : data.iniciada_em ? (
              <button
                onClick={() => void enviar()}
                disabled={enviando || tempoEncerrado || Boolean(error)}
                className="mt-8 w-full rounded-2xl bg-aura py-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {enviando ? "Corrigindo com segurança…" : "Enviar respostas"}
              </button>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
