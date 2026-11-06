import { Scale, Baby, Pill, Briefcase, Wallet, Stethoscope, Ruler, Calculator, Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Faixa, Cabecalho } from "./ui";
import { negrito } from "@/components/aurelia/markup";
import { PARA_QUEM } from "@/config/aurelia";

/**
 * "Para quem é o Orkiestri."
 *
 * 🔴 Esta seção NÃO é depoimento, e não vira um. Depoimento fabricado — nome,
 * foto, citação de um cliente que não existe — engana o visitante e reprova o
 * anúncio no Meta e no Google. Aqui não há pessoa nomeada: são cenários de uso,
 * e cada exemplo é um pedido que a Aurélia entende de verdade (ver o comentário
 * de PARA_QUEM no config). O subtítulo diz, em voz alta, que são exemplos.
 *
 * O dia em que houver clientes reais com o nome autorizado, a seção de
 * depoimentos é outro componente — e aí sim se chama prova social.
 */

/** Um ícone por perfil, na ordem de PARA_QUEM. */
const ICONE: Record<string, LucideIcon> = {
  advogados: Scale,
  familia: Baby,
  saude: Pill,
  gestores: Briefcase,
  pessoal: Wallet,
  medicos: Stethoscope,
  arquitetos: Ruler,
  contadores: Calculator,
  fotografos: Camera,
};

export function ParaQuem() {
  return (
    <Faixa id="para-quem" tom="raise">
      <Cabecalho
        titulo="Para quem é o Orkiestri."
        texto="Rotinas diferentes, a mesma conversa. Cada exemplo abaixo é um pedido que a Aurélia entende de verdade — não é depoimento de cliente, é o produto funcionando."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PARA_QUEM.map((p) => {
          const Icon = ICONE[p.id] ?? Wallet;
          return (
            <article
              key={p.id}
              className="premium-surface flex flex-col gap-4 rounded-(--radius-card) p-6"
              data-spotlight
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-flame/12">
                  <Icon className="text-flame-soft" size={20} aria-hidden />
                </span>
                <span className="section-kicker">{p.publico}</span>
              </div>

              <div>
                <h3 className="text-[1.0625rem] font-semibold leading-snug text-chalk">
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
                  {p.texto}
                </p>
              </div>

              {/* O exemplo, nos balões da conversa. Marcado como demonstração
                  no rótulo do grupo, para ninguém ler como mensagem real de um
                  cliente. */}
              <div
                className="hairline mt-auto flex flex-col gap-2 rounded-2xl border bg-ink/50 p-3.5"
                role="group"
                aria-label="Exemplo de conversa"
              >
                {p.conversa.map((l, i) => (
                  <p
                    key={i}
                    className={
                      l.de === "voce"
                        ? "max-w-[92%] self-end rounded-2xl bg-signal/15 px-3.5 py-2 text-[0.8125rem] leading-relaxed text-chalk"
                        : "hairline max-w-[92%] self-start rounded-2xl border bg-panel px-3.5 py-2 text-[0.8125rem] leading-relaxed text-chalk-dim"
                    }
                  >
                    {l.texto.map((t, j) => (
                      <span key={j} className={j > 0 ? "mt-0.5 block" : "block"}>
                        {negrito(t)}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </Faixa>
  );
}
