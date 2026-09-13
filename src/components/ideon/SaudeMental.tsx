import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  HeartHandshake,
  HeartPulse,
  Leaf,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Smile,
  Meh,
  Frown,
  Sun,
  Users,
} from "lucide-react";

const estados = [
  {
    id: "bem",
    rotulo: "Bem",
    legenda: "Hoje me sinto bem",
    cor: "Verde",
    icone: Smile,
    ponto: "bg-success",
    destaque: "border-success/50 bg-success/10",
    titulo: "Que bom ter um dia assim.",
    mensagem:
      "Reserve um momento para perceber o que está fazendo bem a você. Não precisa transformar essa disposição em mais tarefas.",
    passos: [
      "Separe espaço para algo de que você gosta.",
      "Mantenha seus momentos de descanso e conexão com outras pessoas.",
    ],
    sinal: "Continue cuidando de você",
  },
  {
    id: "mais-ou-menos",
    rotulo: "Mais ou menos",
    legenda: "Hoje preciso de uma pausa",
    cor: "Amarelo",
    icone: Meh,
    ponto: "bg-warning",
    destaque: "border-warning/50 bg-warning/10",
    titulo: "Você pode diminuir o ritmo.",
    mensagem:
      "Dias mistos também merecem cuidado. Tente perceber do que você precisa agora, sem se cobrar para resolver tudo de uma vez.",
    passos: [
      "Se puder, faça uma pausa breve e escolha uma tarefa pequena por vez.",
      "Converse com alguém de confiança. Se o desconforto persistir ou atrapalhar sua rotina, procure uma UBS ou um profissional de saúde.",
    ],
    sinal: "Dê atenção às suas necessidades",
  },
  {
    id: "mal",
    rotulo: "Mal",
    legenda: "Hoje está difícil",
    cor: "Vermelho",
    icone: Frown,
    ponto: "bg-danger",
    destaque: "border-danger/50 bg-danger/10",
    titulo: "Você merece acolhimento hoje.",
    mensagem:
      "Sinto muito que o dia esteja difícil. Você não precisa lidar com isso sem apoio, nem explicar tudo de uma vez para pedir ajuda.",
    passos: [
      "Se puder, procure alguém de confiança e diga que precisa conversar. Pode ser um amigo, familiar ou adulto de confiança.",
      "Para apoio profissional, procure uma UBS ou CAPS. Para conversar com alguém agora, o CVV atende pelo 188.",
    ],
    sinal: "Busque apoio e acolhimento",
  },
] as const;

const dicas = [
  {
    titulo: "Descanso também faz parte",
    icone: Moon,
    texto:
      "Tente manter horários regulares para dormir e acordar, dentro do que sua rotina permite. Reserve um tempo para desacelerar antes de deitar.",
    fonte:
      "https://bibliosus.saude.gov.br/o-sono-e-essencial-para-a-saude-17-3-dia-mundial-do-sono/",
  },
  {
    titulo: "Uma pausa no seu dia",
    icone: Sun,
    texto:
      "Entre as tarefas, experimente uma pausa longe da tela: ouvir uma música ou olhar pela janela. Você pode escolher o que for confortável agora.",
    fonte:
      "https://www.gov.br/secom/pt-br/assuntos/uso-de-telas-por-criancas-e-adolescentes/guia/destaques-do-guia/em-busca-do-bem-estar-nas-experiencias-digitais",
  },
  {
    titulo: "Movimente-se no seu ritmo",
    icone: Leaf,
    texto:
      "Uma caminhada, uma dança ou um movimento adaptado às suas possibilidades pode fazer parte do cuidado. Respeite seus limites e as orientações de saúde que você já recebeu.",
    fonte:
      "https://www.gov.br/servidor/pt-br/assuntos/contecomigo/paginas/paginas-dos-hyperlinks/bem-estar-e-saude-1/exercicios-fisicos-em-casa",
  },
  {
    titulo: "Cultive sua rede de apoio",
    icone: Users,
    texto:
      "Separe um momento para conversar com alguém de confiança. Pedir companhia ou ajuda é uma forma de cuidar de si.",
    fonte:
      "https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/c/covid-19/publicacoes-tecnicas/capacitacao/cuidados-com-a-saude-mental",
  },
];

const linkExterno =
  "inline-flex items-center gap-1 text-xs font-semibold text-aura underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-aura";
const botao =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-aura";

export function SaudeMental() {
  const [escolha, setEscolha] = useState<string | null>(null);
  const estado = estados.find((item) => item.id === escolha);

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-aura/20 bg-aura/10 px-3 py-1 text-xs font-semibold text-aura">
            <HeartPulse className="size-4" aria-hidden="true" /> Seu espaço de cuidado
          </p>
          <h1 className="text-display text-4xl md:text-5xl">Saúde mental</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Como você se sente importa. Tire um momento para olhar para si, sem cobrança.
          </p>
        </div>
        <a href="#apoio" className={`${botao} border border-aura/30 bg-aura/10 text-aura`}>
          <HeartHandshake className="size-4" aria-hidden="true" /> Quero encontrar ajuda{" "}
          <ArrowDown className="size-4" aria-hidden="true" />
        </a>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section
          className="rounded-[2rem] glass-panel p-6 md:p-8"
          aria-labelledby="check-in-titulo"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-aura">
            Um momento para você
          </p>
          <fieldset className="mt-3">
            <legend id="check-in-titulo" className="text-display text-2xl md:text-3xl">
              Como você está hoje?
            </legend>
            <p id="check-in-descricao" className="mt-2 text-sm text-muted-foreground">
              Escolha o que mais se aproxima de como você se sente agora. Você pode mudar sua
              resposta.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {estados.map((item) => {
                const Icone = item.icone;
                return (
                  <label key={item.id} className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="bem-estar"
                      value={item.id}
                      checked={escolha === item.id}
                      onChange={() => setEscolha(item.id)}
                      aria-describedby="check-in-descricao"
                      className="peer sr-only"
                    />
                    <span
                      className={`flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-aura ${escolha === item.id ? item.destaque : "border-border bg-background/40 hover:bg-secondary/50"}`}
                    >
                      <Icone className="size-7" aria-hidden="true" />
                      <span className="text-sm font-semibold">{item.rotulo}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`size-2 rounded-full ${item.ponto}`} aria-hidden="true" />
                        {item.cor}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => setEscolha("prefiro-nao-responder")}
            className="mt-3 min-h-11 rounded-lg px-2 text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-aura"
          >
            Prefiro não responder
          </button>

          <div role="status" aria-live="polite" aria-atomic="true">
            {estado ? (
              <div className={`mt-5 rounded-2xl border p-5 ${estado.destaque}`}>
                <h2 className="text-display text-xl">{estado.titulo}</h2>
                <p className="mt-2 text-sm leading-relaxed">{estado.mensagem}</p>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                  {estado.passos.map((passo) => (
                    <li key={passo}>{passo}</li>
                  ))}
                </ul>
              </div>
            ) : escolha === "prefiro-nao-responder" ? (
              <p className="mt-4 rounded-2xl border border-border p-5 text-sm">
                Tudo bem. As dicas e os contatos de apoio continuam disponíveis para você.
              </p>
            ) : null}
          </div>
          {estado?.id === "mal" ? (
            <a href="#apoio" className={`${botao} mt-4 bg-aura text-primary-foreground`}>
              Ver opções de apoio <ArrowDown className="size-4" aria-hidden="true" />
            </a>
          ) : null}
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Sua resposta fica apenas nesta página e é apagada ao sair ou atualizar. Não é enviada ao
            professor nem salva no seu perfil.
          </p>
        </section>

        <aside className="rounded-[2rem] glass-panel p-6 md:p-8" aria-labelledby="semaforo-titulo">
          <h2 id="semaforo-titulo" className="text-display text-2xl">
            Semáforo do bem-estar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Um jeito de visualizar sua resposta de hoje. As cores não são um diagnóstico nem uma
            avaliação de risco.
          </p>
          <ol className="mt-6 space-y-3">
            {estados.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${estado?.id === item.id ? item.destaque : "border-border bg-background/30"}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-6 shrink-0 rounded-full ${item.ponto} ${estado?.id === item.id ? "ring-4 ring-foreground/15" : "opacity-40"}`}
                />
                <div>
                  <p className="text-sm font-semibold">
                    {item.cor} · {item.rotulo}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.sinal}</p>
                  {estado?.id === item.id ? (
                    <p className="mt-1 text-xs font-semibold">Sua escolha agora</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Você pode buscar apoio em qualquer cor. Este espaço oferece acolhimento e informação;
            não substitui atendimento profissional.
          </p>
        </aside>
      </div>

      <section className="mt-10" aria-labelledby="dicas-titulo">
        <h2 id="dicas-titulo" className="text-display text-2xl">
          Pequenos cuidados no dia a dia
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha o que cabe no seu momento. Você não precisa fazer tudo hoje.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dicas.map((dica) => {
            const Icone = dica.icone;
            return (
              <article
                key={dica.titulo}
                className="flex flex-col rounded-3xl border border-border bg-background/40 p-6"
              >
                <Icone className="mb-4 size-6 text-aura" aria-hidden="true" />
                <h3 className="font-semibold">{dica.titulo}</h3>
                <p className="mt-2 mb-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {dica.texto}
                </p>
                <a
                  href={dica.fonte}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkExterno}
                  aria-label={`Fonte sobre ${dica.titulo} (abre em nova aba)`}
                >
                  Saiba mais <ArrowUpRight className="size-3" aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="apoio"
        tabIndex={-1}
        className="mt-10 scroll-mt-6 rounded-[2rem] glass-panel p-6 focus-visible:outline-2 focus-visible:outline-aura md:p-8"
        aria-labelledby="apoio-titulo"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-aura">
          Contatos no Brasil
        </p>
        <h2 id="apoio-titulo" className="text-display mt-2 text-2xl">
          Você pode contar com apoio
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Não é preciso responder ao check-in para procurar ajuda.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-border bg-background/40 p-5">
            <MessageCircle className="size-5 text-aura" aria-hidden="true" />
            <h3 className="mt-3 font-semibold">CVV · Apoio emocional</h3>
            <p className="mt-2 mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Converse com um voluntário. Ligação gratuita para o 188, 24 horas por dia, com sigilo.
              É um serviço de escuta, não de atendimento de emergência.
            </p>
            <a href="tel:188" className={`${botao} bg-aura text-primary-foreground`}>
              <Phone className="size-4" aria-hidden="true" />
              Ligar 188
            </a>
            <a
              href="https://cvv.org.br/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkExterno} mt-4`}
            >
              Site e outras formas de contato do CVV{" "}
              <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
            </a>
          </article>
          <article className="flex flex-col rounded-2xl border border-danger/30 bg-danger/5 p-5">
            <HeartPulse className="size-5 text-danger" aria-hidden="true" />
            <h3 className="mt-3 font-semibold">SAMU · Urgência</h3>
            <p className="mt-2 mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Se houver risco imediato à vida ou você não conseguir se manter em segurança, ligue
              192 ou procure uma UPA/pronto-socorro. Peça a alguém de confiança para ficar com você.
            </p>
            <a
              href="tel:192"
              className={`${botao} border border-danger/40 bg-danger/15 text-foreground`}
            >
              <Phone className="size-4" aria-hidden="true" />
              Ligar 192
            </a>
            <a
              href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/suicidio-prevencao"
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkExterno} mt-4`}
            >
              Orientações do Ministério da Saúde{" "}
              <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
            </a>
          </article>
          <article className="flex flex-col rounded-2xl border border-border bg-background/40 p-5">
            <MapPin className="size-5 text-aura" aria-hidden="true" />
            <h3 className="mt-3 font-semibold">UBS e CAPS · Cuidado no SUS</h3>
            <p className="mt-2 mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              Procure uma Unidade Básica de Saúde para acolhimento e orientação. Os CAPS também
              recebem pessoas que buscam apoio em saúde mental; o primeiro acolhimento pode ser
              procurado diretamente.
            </p>
            <a
              href="https://www.gov.br/saude/pt-br/composicao/saes/desmad/raps/caps"
              target="_blank"
              rel="noopener noreferrer"
              className={`${botao} border border-border text-foreground`}
            >
              Conhecer os CAPS <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
            </a>
          </article>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Esta página não é monitorada por uma equipe de atendimento e não aciona serviços de ajuda
          automaticamente. Use os contatos acima para falar com um serviço.
        </p>
      </section>
    </div>
  );
}
