import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

/**
 * Peças comuns às seções escuras da home.
 *
 * Elas vivem aqui, e não em `components/ui`, de propósito: a home é a única
 * página escura do site (26/10/2026). Misturar estes componentes com os
 * compartilhados faria as outras trinta páginas herdarem um tema que não é
 * o delas.
 */

/** Faixa de conteúdo. `tom` alterna o degrau de escuro entre seções. */
export function Faixa({
  id,
  tom = "ink",
  className,
  children,
}: {
  id?: string;
  tom?: "ink" | "raise";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-16 md:py-24",
        tom === "ink" ? "bg-ink" : "bg-ink-raise",
        className,
      )}
    >
      <Container className="relative">{children}</Container>
    </section>
  );
}

/**
 * Cabeçalho de seção.
 *
 * Sem rótulo em caixa alta acima do título. A página inteira tinha nove
 * deles — `QUEM SOMOS`, `SOLUÇÕES`, `PRODUTOS`… — e é a marca mais clara de
 * página de template: o rótulo repete o que o próprio título já diz.
 *
 * O título fica à esquerda e o texto de apoio à direita, em vez de ambos
 * centrados: a leitura ganha duas colunas e a seção deixa de parecer um
 * slide.
 */
export function Cabecalho({
  titulo,
  texto,
  acao,
}: {
  titulo: React.ReactNode;
  texto?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  const tituloEl = (
    <h2 className="font-display text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-chalk [font-stretch:108%] md:text-[2.5rem]">
      {titulo}
    </h2>
  );

  /* Sem texto de apoio não há duas colunas. Mantendo a grade, a segunda
     coluna ficava vazia e o título era espremido à metade da largura — era
     o que quebrava a manchete da seção do WhatsApp em três linhas curtas. */
  if (!texto && !acao) return tituloEl;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
      {tituloEl}
      <div className="flex flex-col items-start gap-6 lg:pt-1.5">
        {texto && (
          <p className="text-[1.0625rem] leading-[1.65] text-chalk-dim">
            {texto}
          </p>
        )}
        {acao}
      </div>
    </div>
  );
}

/** Superfície padrão do escuro: fio a 8% e aresta de luz no topo. */
export function Painel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "hairline rounded-(--radius-card) border bg-panel",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Link de texto das seções escuras.
 *
 * Sem a seta "→" no fim do rótulo: ela aparecia em todo link e todo botão do
 * site e tinha virado enfeite, não sinal de direção. Aqui o que marca o link
 * é o sublinhado deslocado, que acende no hover.
 */
export function LinkTexto({
  href,
  children,
  externo = false,
}: {
  href: string;
  children: React.ReactNode;
  externo?: boolean;
}) {
  return (
    <a
      href={href}
      {...(externo
        ? { target: "_blank", rel: "noopener noreferrer" }
        : undefined)}
      className="inline-flex text-[0.9375rem] font-semibold text-flame-soft underline decoration-flame/40 decoration-1 underline-offset-[6px] transition-colors duration-200 hover:text-ember hover:decoration-ember/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flame"
    >
      {children}
    </a>
  );
}
