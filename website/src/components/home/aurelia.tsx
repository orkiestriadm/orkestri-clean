import { Faixa, Cabecalho } from "./ui";
import { cn } from "@/lib/utils";

/**
 * O que o sistema faz por mensagem.
 *
 * É o argumento mais forte que a Orkiestri tem e não estava na página: dá
 * para abrir chamado, marcar compromisso, criar projeto e lançar gasto sem
 * abrir o navegador. Também é o que justifica o botão verde do hero — sem
 * esta seção, o visitante não entende por que o cadastro é por WhatsApp.
 *
 * ⚠️ As mensagens abaixo NÃO são inventadas. Cada uma é um comando que o
 * backend realmente reconhece hoje em produção — conferidas em
 * `backend/src/modules/agenda/whatsapp-inbound.module.ts` (funções
 * `ajudaAgenda`, `ajudaKeep`, `ajudaProjetos`, `ajudaChamados`,
 * `ajudaConhecimento`) e no parser de gastos. Ao mexer aqui, confira lá
 * antes: prometer um comando que não existe é a pior coisa que esta seção
 * pode fazer.
 */

type Fala = { de: "pessoa" | "sistema"; texto: string };

const conversa: Fala[] = [
  { de: "pessoa", texto: "Chamado: a impressora da recepção não liga" },
  {
    de: "sistema",
    texto: "Abri o chamado #184 e avisei o time de TI. Te aviso quando andar.",
  },
  { de: "pessoa", texto: "Evento: reunião com o fornecedor amanhã 14h" },
  { de: "sistema", texto: "Marcado para amanhã, 14:00. Já está na sua agenda." },
  { de: "pessoa", texto: "minhas tarefas" },
  {
    de: "sistema",
    texto: "Você tem 3 tarefas em aberto. A mais próxima vence sexta.",
  },
];

const tambem = [
  { comando: "Projeto: Reforma da loja", efeito: "cria o projeto" },
  { comando: "Nota: comprar pilha do controle", efeito: "guarda no Keep" },
  { comando: "Gasto: mercado 150 crédito 12x", efeito: "lança a despesa" },
  { comando: "Buscar: como configurar a VPN", efeito: "procura no Conhecimento" },
];

export function Aurelia() {
  return (
    <Faixa id="whatsapp">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-20">
        <div>
          <Cabecalho titulo="O sistema também atende no WhatsApp." />
          <p className="mt-6 max-w-[54ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
            Abrir um chamado, marcar um compromisso, criar um projeto ou lançar
            uma despesa não exige abrir o navegador. A pessoa manda a mensagem,
            o sistema executa e responde — com o mesmo usuário, as mesmas
            permissões e o registro no lugar certo.
          </p>

          {/* Os outros comandos entram como tabela de duas colunas: o comando
              em fonte de código à esquerda, o efeito em prosa à direita. A
              estrutura carrega a informação — é literalmente uma referência
              de sintaxe, e ler como tal é o ponto. */}
          <dl className="mt-10 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] text-[0.9375rem]">
            {tambem.map((t) => (
              <div
                key={t.comando}
                className="flex flex-col gap-1 bg-ink px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="font-mono text-[0.8125rem] text-ember sm:w-[28ch] sm:shrink-0">
                  {t.comando}
                </dt>
                <dd className="text-chalk-dim">{t.efeito}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── A conversa ──────────────────────────────────────────────────
            Sem moldura de celular: o aparelho desenhado em volta é adereço,
            e a conversa já se explica sozinha. */}
        <div
          className="flex flex-col gap-3"
          role="img"
          aria-label="Exemplo de conversa: a pessoa escreve 'Chamado: a impressora da recepção não liga' e o sistema responde que abriu o chamado 184; depois marca um compromisso e consulta as tarefas em aberto."
        >
          {conversa.map((f, i) => (
            <div
              key={i}
              aria-hidden
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed",
                f.de === "pessoa"
                  ? /* O verde da mensagem enviada é o mesmo do botão de
                       cadastro, rebaixado: liga visualmente a conversa ao
                       clique que leva até ela. */
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
