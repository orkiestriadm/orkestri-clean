import { AureliaCapture } from "./aurelia-capture";

/**
 * A assinatura do hero: a captura real no celular, com os pontos em órbita.
 *
 * A órbita morava aqui desde 29/10/2026 e era exclusiva do hero. Em
 * 03/11/2026 ela desceu para `ui/celular.tsx`, que é quem desenha o aparelho,
 * de modo que toda amostra do site passou a ter o mesmo tratamento. Este
 * componente ficou só com o palco e o respiro do hero — se ele mantivesse a
 * própria órbita, o hero teria oito pontos em duas elipses.
 */
export function AureliaSignature() {
  return (
    <div className="aurelia-signature">
      <AureliaCapture index={1} />
    </div>
  );
}
