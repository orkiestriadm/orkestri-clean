import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";

/**
 * Abertura das páginas internas.
 *
 * Três decisões, as mesmas do hero da home:
 *
 *   1. **Sem rótulo em caixa alta.** A prop `eyebrow` continua existindo
 *      porque quinze páginas a passam, mas ela NÃO vira mais um
 *      `PRODUTOS` espaçado acima do título — vira a trilha de navegação,
 *      que já diz onde a pessoa está e é informação de verdade. Rótulo que
 *      repete o título é o adereço mais comum de página gerada.
 *   2. **Luz contida e assimétrica**, vinda de cima à esquerda, com vinheta
 *      devolvendo o preto às bordas. Sem isso o topo fica chapado e a página
 *      parece um documento, não um produto.
 *   3. **Tipo display**, com a mesma largura aberta (`font-stretch`) das
 *      manchetes da home, para as páginas internas não parecerem de outro
 *      site.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumb,
  children,
}: {
  /** Mantido por compatibilidade: hoje só serve de rótulo acessível. */
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: { label: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <section
      aria-label={eyebrow}
      className="ink-grain relative isolate overflow-hidden bg-ink pt-28 pb-12 md:pt-36 md:pb-20"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="page-orbit" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <Container className="relative z-10">
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-7" />}
        <div className="max-w-3xl">
          <h1 className="font-display text-[2.25rem] font-bold leading-[1.04] tracking-[-0.035em] text-chalk [font-stretch:110%] sm:text-[2.875rem] lg:text-[3.25rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.65] text-chalk-dim">
              {description}
            </p>
          )}
          {children && <div className="mt-9">{children}</div>}
        </div>
      </Container>
    </section>
  );
}
