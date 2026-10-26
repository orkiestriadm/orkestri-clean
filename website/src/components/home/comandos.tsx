import { Faixa, Cabecalho } from "./ui";
import { cn } from "@/lib/utils";

/**
 * O que VOCÊ manda — a outra metade da conversa.
 *
 * ⚠️ Cada comando abaixo é reconhecido pelo backend hoje. Conferidos em
 * `backend/src/modules/agenda/whatsapp-inbound.module.ts`: `ajudaAgenda`,
 * `ajudaKeep`, `ajudaProjetos`, `ajudaChamados`, `ajudaConhecimento` e
 * `ajudaFinanceiro`, mais os parsers de gasto, de conta e de relatório.
 * Prometer um comando que não existe é a pior coisa que esta seção pode
 * fazer: a pessoa testa na hora.
 */

type Fala = { de: "pessoa" | "sistema"; texto: string };

const conversa: Fala[] = [
  { de: "pessoa", texto: "Gasto: mercado 182 no crédito" },
  { de: "sistema", texto: "Anotado: R$ 182,00 em mercado, no crédito." },
  { de: "pessoa", texto: "Conta: energia 350 vence 10/11" },
  { de: "sistema", texto: "Lancei. Vence em 10/11 e eu te lembro antes." },
  { de: "pessoa", texto: "quanto gastei esse mês" },
  {
    de: "sistema",
    texto: "R$ 1.284,30 em 9 lançamentos. No crédito: R$ 940,00.",
  },
];

const tambem = [
  { comando: "Evento: médico amanhã 14h", efeito: "marca na agenda" },
  { comando: "Nota: comprar pilha do controle", efeito: "guarda no Keep" },
  { comando: "Projeto: reforma da loja", efeito: "cria o projeto" },
  { comando: "minhas tarefas", efeito: "lista o que está com você" },
  { comando: "Chamado: a impressora não liga", efeito: "abre e te dá o número" },
  { comando: "Buscar: como configurar a VPN", efeito: "procura nos artigos" },
  { comando: "corrige o último pra 150", efeito: "conserta o que você errou" },
];

export function Comandos() {
  return (
    <Faixa id="whatsapp">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-20">
        <div>
          <Cabecalho titulo="E quando você precisa anotar, é só escrever." />
          <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
            Sem abrir o navegador, sem achar o botão, sem lembrar em que tela
            fica. Você escreve como falaria com alguém, e o sistema entende,
            executa e responde — com o seu usuário e as suas permissões.
          </p>

          {/* Tabela de sintaxe: o comando em fonte de código à esquerda, o
              efeito em prosa à direita. A estrutura É a informação — isto é
              literalmente uma referência de comandos. */}
          <dl className="mt-10 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] text-[0.9375rem]">
            {tambem.map((t) => (
              <div
                key={t.comando}
                className="flex flex-col gap-1 bg-ink px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="font-mono text-[0.8125rem] text-ember sm:w-[30ch] sm:shrink-0">
                  {t.comando}
                </dt>
                <dd className="text-chalk-dim">{t.efeito}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="flex flex-col gap-3"
          role="img"
          aria-label="Exemplo de conversa: a pessoa escreve 'Gasto: mercado 182 no crédito' e o sistema confirma o lançamento; depois lança uma conta de energia com vencimento e consulta quanto gastou no mês."
        >
          {conversa.map((f, i) => (
            <div
              key={i}
              aria-hidden
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed",
                f.de === "pessoa"
                  ? /* O verde da mensagem enviada é o mesmo do botão de
                       cadastro, rebaixado: liga a conversa ao clique que
                       leva até ela. */
                    "self-end rounded-br-md bg-signal/[0.14] text-chalk ring-1 ring-inset ring-signal/25"
                  : "hairline self-start rounded-bl-md border bg-panel text-chalk-dim",
              )}
            >
              {f.texto}
            </div>
          ))}
        </div>
      </div>
    </Faixa>
  );
}
