import { cn } from "@/lib/utils";

/**
 * Moldura de celular, com a órbita em volta.
 *
 * Até 03/11/2026 as amostras do produto eram retângulos soltos na página: um
 * print do WhatsApp com cantos arredondados, sem nada que dissesse "isto
 * acontece no seu telefone".
 *
 * A primeira versão desenhou a carcaça e a ilha, e ainda assim não lia como
 * telefone — faltava o que o olho procura sem perceber: a **barra de status**
 * com hora, sinal, wi-fi e bateria, a **barra de gestos** embaixo e os
 * **botões laterais**. São esses detalhes, e não o raio da borda, que fazem o
 * cérebro reconhecer um aparelho.
 *
 * A carcaça mantém a proporção do aparelho em qualquer largura. Capturas
 * preservam sua proporção e conversas longas rolam dentro da tela.
 *
 * 🔴 Quem já está dentro de um `Celular` NÃO deve trazer a própria moldura:
 * o `Screenshot` entra com `bordered={false}` e `reflection={false}`, senão
 * ficam duas bordas concêntricas e a tela parece um quadro pendurado.
 */
export function Celular({
  children,
  orbita = true,
  largura = 320,
  hora = "9:41",
  className,
}: {
  children: React.ReactNode;
  /** Desligue onde já existe outra órbita por perto. */
  orbita?: boolean;
  /** Largura máxima do aparelho, em px. */
  largura?: number;
  /** A hora da barra de status. 9:41 é a hora que a Apple usa há décadas. */
  hora?: string;
  className?: string;
}) {
  return (
    <div className={cn("celular-palco", className)} style={{ maxWidth: largura }}>
      {orbita && <Orbita />}
      <div className="celular">
        {/* Os botões laterais. Decorativos: ninguém clica neles. */}
        <span className="celular-botao celular-silencioso" aria-hidden />
        <span className="celular-botao celular-vol celular-vol-cima" aria-hidden />
        <span className="celular-botao celular-vol celular-vol-baixo" aria-hidden />
        <span className="celular-botao celular-power" aria-hidden />

        <div className="celular-tela">
          <div className="celular-status" aria-hidden>
            <span className="celular-hora">{hora}</span>
            <span className="celular-sinais">
              <IconeSinal />
              <IconeWifi />
              <IconeBateria />
            </span>
          </div>

          <div className="celular-conteudo">{children}</div>

          {/* A barra de gestos. Some junto com a ilha abaixo de 420px. */}
          <span className="celular-gesto" aria-hidden />
        </div>
      </div>
    </div>
  );
}

/** Quatro barras crescentes, como no iOS. */
function IconeSinal() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="none" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 4.5}
          y={8 - i * 2.4}
          width="3"
          height={3 + i * 2.4}
          rx="1"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

/** Três arcos e o ponto. */
function IconeWifi() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
      <path
        d="M8 10.4 6.1 8.3a2.8 2.8 0 0 1 3.8 0L8 10.4Z"
        fill="currentColor"
      />
      <path
        d="M3.6 5.7a6.6 6.6 0 0 1 8.8 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5.5 7.7a4 4 0 0 1 5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M1.7 3.6a9.4 9.4 0 0 1 12.6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Carcaça, ponta e carga. */
function IconeBateria() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" fill="none" aria-hidden>
      <rect
        x="0.6"
        y="0.6"
        width="22"
        height="10.8"
        rx="3"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.1"
      />
      <rect x="2.2" y="2.2" width="16" height="7.6" rx="1.8" fill="currentColor" />
      <path
        d="M24.2 4.3v3.4a2 2 0 0 0 0-3.4Z"
        fill="currentColor"
        fillOpacity="0.45"
      />
    </svg>
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
