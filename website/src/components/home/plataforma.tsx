import Link from "next/link";
import { BellRing, MessageSquareText, Lock, Smartphone } from "lucide-react";
import { Faixa, Cabecalho, LinkTexto } from "./ui";
import { products } from "@/config/products";
import { cn } from "@/lib/utils";

/**
 * O que o Orkiestri organiza.
 *
 * Substitui três seções que diziam a mesma coisa de três jeitos (Plataforma,
 * Produtos e Diferenciais). As aplicações entram como LISTA, não como seis
 * cartões iguais: cartão igual não cria hierarquia, tudo pesa o mesmo e nada
 * pesa.
 *
 * ⚠️ As quatro afirmações de baixo são verificáveis:
 * - os horários dos lembretes estão em `alert.scheduler.ts`;
 * - os comandos, em `whatsapp-inbound.module.ts`;
 * - "cada um só vê o seu" vale para `gastos` (gasto pessoal é por usuário);
 * - o cadastro pelo WhatsApp é o `cadastro-whatsapp.module.ts`.
 */

const comoFunciona = [
  {
    icone: BellRing,
    titulo: "Avisa antes",
    texto:
      "Uma hora antes do compromisso, de novo aos quinze minutos e na hora que começa.",
  },
  {
    icone: MessageSquareText,
    titulo: "Entende o que você escreve",
    texto:
      "“Gasto: mercado 182 no crédito” basta. Sem formulário, sem campo obrigatório.",
  },
  {
    icone: Lock,
    titulo: "O que é seu é só seu",
    texto:
      "Gasto pessoal fica no seu usuário. Nem o administrador da conta vê o seu lançamento.",
  },
  {
    icone: Smartphone,
    titulo: "Começa numa conversa",
    texto:
      "A conta nasce pelo WhatsApp, com os módulos já ligados. Depois você entra pelo navegador se quiser.",
  },
];

export function Plataforma() {
  return (
    <Faixa id="organiza" tom="raise">
      <Cabecalho
        titulo="Seis coisas que você não devia ter que lembrar sozinho."
        texto="Agenda, contas, projetos, pedidos, procedimentos e acessos. Tudo no mesmo lugar, com o mesmo login — e cada um deles sabe te achar no WhatsApp."
        acao={
          <LinkTexto href="/products/orkiestri-one">
            Ver como se encaixam
          </LinkTexto>
        }
      />

      {/* Grade de fios: cada célula se separa das vizinhas por uma linha de
          1px, como uma tabela. Desenho de engenharia, não de catálogo. */}
      <ul className="mt-14 grid gap-px overflow-hidden rounded-(--radius-card) bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const Icone = p.icon;
          return (
            <li key={p.slug} className="bg-ink-raise">
              <Link
                href={`/products/${p.slug}`}
                className={cn(
                  "group flex h-full items-start gap-4 p-6 transition-colors duration-200",
                  "hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-flame",
                )}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-flame/10 text-flame-soft ring-1 ring-inset ring-flame/20 transition-colors duration-200 group-hover:bg-flame/20">
                  <Icone className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-chalk">
                    {p.name}
                  </span>
                  <span className="mt-1 block text-[0.9375rem] leading-relaxed text-chalk-dim">
                    {p.tagline}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Sem cartão: um fio em cima de cada bloco já diz que são quatro itens
          de um mesmo conjunto. A borda completa só acrescentaria desenho. */}
      <div className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {comoFunciona.map((c) => {
          const Icone = c.icone;
          return (
            <div key={c.titulo} className="border-t border-white/[0.09] pt-5">
              <Icone className="h-5 w-5 text-flame-soft" aria-hidden />
              <h3 className="mt-4 font-semibold text-chalk">{c.titulo}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-chalk-dim">
                {c.texto}
              </p>
            </div>
          );
        })}
      </div>
    </Faixa>
  );
}
