import { Faixa, Cabecalho } from "./ui";
import { cn } from "@/lib/utils";

/**
 * O que o sistema MANDA — a metade que ninguém mais tem.
 *
 * ⚠️ Nenhuma mensagem aqui é inventada. Os lembretes de agenda (1h, 15min,
 * 5min e "acontecendo agora") e os avisos de prazo de chamado estão em
 * `backend/src/modules/notifications/alert.scheduler.ts`; o resumo de
 * domingo às 20h, com o opt-out "parar resumo", está em
 * `backend/src/modules/gastos/gastos.module.ts` (`GastosScheduler`).
 * Antes de acrescentar um aviso a esta seção, ache o cron que o dispara.
 *
 * O desenho é uma LINHA DO TEMPO, não uma lista de cartões: o que torna
 * esses avisos diferentes de "notificação de app" é a hora em que cada um
 * chega, então a hora é o elemento estrutural.
 */

type Aviso = {
  quando: string;
  texto: string;
  /** Marca o aviso como o mais forte da sequência. */
  destaque?: boolean;
};

const avisos: Aviso[] = [
  {
    quando: "13:00",
    texto:
      "Lembrete 1 hora\n\nReunião com o fornecedor\nhoje às 14:00",
  },
  {
    quando: "13:45",
    texto:
      "Atenção! Seu evento começa em 15 minutos:\n\nReunião com o fornecedor\nhoje às 14:00",
  },
  {
    quando: "13:55",
    texto: "URGENTE! Faltam apenas 5 minutos:\n\nReunião com o fornecedor",
    destaque: true,
  },
  {
    quando: "domingo, 20:00",
    texto:
      "Resumo da semana\n\nVocê lançou 9 gastos, somando R$ 1.284,30.\nMaior categoria: mercado.",
  },
];

/* Gatilhos reais, um por módulo. Cada linha corresponde a um cron ou a um
   disparo no backend — não a uma intenção de produto. */
const gatilhos = [
  {
    modulo: "Agenda",
    quando: "1 hora, 15 minutos e 5 minutos antes — e na hora que começa",
  },
  { modulo: "Contas e gastos", quando: "todo domingo às 20h, se houve gasto na semana" },
  { modulo: "Chamados", quando: "quando o prazo entra em risco, estoura ou é escalado" },
  { modulo: "Acessos", quando: "você escolhe, módulo por módulo, o que quer receber" },
];

export function Avisos() {
  return (
    <Faixa id="avisos" tom="raise">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
        <div>
          <Cabecalho titulo="Você não abre o sistema. Ele te procura." />
          <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
            De nada adianta estar anotado se ninguém lembra. O Orkiestri manda
            no seu WhatsApp — no número que você já usa, sem instalar aplicativo
            nenhum — e manda na hora em que ainda dá tempo de agir.
          </p>

          <dl className="mt-10 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] text-[0.9375rem]">
            {gatilhos.map((g) => (
              <div
                key={g.modulo}
                className="flex flex-col gap-1 bg-ink-raise px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="font-semibold text-chalk sm:w-[17ch] sm:shrink-0">
                  {g.modulo}
                </dt>
                <dd className="text-chalk-dim">{g.quando}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-chalk-faint">
            Cansou do resumo de domingo? Responda{" "}
            <span className="font-mono text-ember">parar resumo</span> e ele
            para. Sem menu de configuração, sem descadastro por e-mail.
          </p>
        </div>

        {/* ── A linha do tempo ───────────────────────────────────────────
            O fio vertical à esquerda amarra as mensagens como horas de um
            mesmo dia; sem ele seriam quatro balões soltos. */}
        <ol
          className="relative flex flex-col gap-5 pl-20 sm:pl-24"
          aria-label="Exemplos de avisos que o sistema envia pelo WhatsApp"
        >
          <span
            aria-hidden
            className="absolute bottom-3 left-[4.25rem] top-3 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent sm:left-[5.25rem]"
          />
          {avisos.map((a, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-20 top-3 w-[3.5rem] text-right text-[0.75rem] leading-tight tabular-nums text-chalk-faint sm:-left-24 sm:w-[4.5rem]">
                {a.quando}
              </span>
              {/* O ponto na linha: fica aceso só no aviso mais urgente. */}
              <span
                aria-hidden
                className={cn(
                  /* O ponto fica EM CIMA do fio: o fio está a 0,75rem da
                     borda do item, e o ponto tem 0,5rem. */
                  "absolute -left-[0.875rem] top-[1.15rem] h-2 w-2 rounded-full",
                  a.destaque
                    ? "bg-flame shadow-[0_0_10px_2px_rgba(255,106,26,0.7)]"
                    : "bg-white/25",
                )}
              />
              <p
                className={cn(
                  "hairline whitespace-pre-line rounded-2xl rounded-bl-md border bg-panel px-4 py-3 text-[0.9375rem] leading-relaxed",
                  a.destaque
                    ? "border-flame/25 text-chalk"
                    : "text-chalk-dim",
                )}
              >
                {a.texto}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Faixa>
  );
}
