import Link from "next/link";
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

export function Plataforma() {
  return (
    <Faixa id="organiza" tom="raise">
      <Cabecalho
        titulo="Comece pela agenda. Conheça o que vem além."
        texto="Agenda, contas, projetos, pedidos, conhecimento e acessos no mesmo lugar. Seu cadastro é no Orkiestri; os recursos disponíveis seguem o plano e as permissões da conta."
        acao={
          <LinkTexto href="/products/orkiestri-one">
            Ver como se encaixam
          </LinkTexto>
        }
      />

      {/* Grade de fios: cada célula se separa das vizinhas por uma linha de
          1px, como uma tabela. Desenho de engenharia, não de catálogo. */}
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const Icone = p.icon;
          return (
            <li key={p.slug} className="min-w-0">
              <Link
                data-spotlight
                href={`/products/${p.slug}`}
                className={cn(
                  "premium-surface group flex h-full items-start gap-4 rounded-2xl p-6 transition-colors duration-200",
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
    </Faixa>
  );
}
