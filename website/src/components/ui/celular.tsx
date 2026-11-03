import { cn } from "@/lib/utils";

/**
 * Moldura de celular, com a órbita em volta.
 *
 * Até 03/11/2026 as amostras do produto eram retângulos soltos na página: um
 * print do WhatsApp com cantos arredondados, sem nada que dissesse "isto
 * acontece no seu telefone". O concorrente põe tudo dentro de um aparelho
 * desenhado, e é por isso que a página dele parece um produto e a nossa
 * parecia uma apresentação.
 *
 * A órbita já existia — nasceu no hero em 29/10 (`aurelia-signature.tsx`) e
 * era o único movimento contínuo do site. Aqui ela deixa de ser exclusiva do
 * hero e passa a acompanhar toda amostra de celular, que é o que o usuário
 * pediu em 03/11. As classes continuam as mesmas (`aurelia-orbit-field`,
 * `aurelia-planet`) para não duplicar o ajuste fino de tamanho, velocidade e
 * ponto de partida de cada ponto.
 *
 * 🔴 Quem já está dentro de um `Celular` NÃO deve trazer a própria moldura:
 * o `Screenshot` entra com `bordered={false}` e `reflection={false}`, senão
 * ficam duas bordas concêntricas e a tela parece um quadro pendurado.
 */
export function Celular({
  children,
  orbita = true,
  largura = 320,
  className,
}: {
  children: React.ReactNode;
  /** Desligue onde já existe outra órbita por perto. */
  orbita?: boolean;
  /** Largura máxima do aparelho, em px. */
  largura?: number;
  className?: string;
}) {
  return (
    <div className={cn("celular-palco", className)} style={{ maxWidth: largura }}>
      {orbita && <Orbita />}
      <div className="celular">
        <div className="celular-tela">{children}</div>
      </div>
    </div>
  );
}

/**
 * Os quatro pontos em órbita.
 *
 * Decorativos: `aria-hidden`, sem conteúdo e sem foco. Param sozinhos quando
 * o sistema pede movimento reduzido — a regra vive no globals.css, junto da
 * animação.
 */
export function Orbita({ className }: { className?: string }) {
  return (
    <div className={cn("aurelia-orbit-field", className)} aria-hidden="true">
      <span className="aurelia-planet aurelia-planet-one" />
      <span className="aurelia-planet aurelia-planet-two" />
      <span className="aurelia-planet aurelia-planet-three" />
      <span className="aurelia-planet aurelia-planet-four" />
    </div>
  );
}
