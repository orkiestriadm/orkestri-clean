import { AureliaCapture } from "./aurelia-capture";

/** Pontos decorativos orbitam a captura real, que permanece fixa e clicável. */
export function AureliaSignature() {
  return (
    <div className="aurelia-signature">
      <div className="aurelia-capture-stage">
        <div className="aurelia-orbit-field" aria-hidden="true">
          <span className="aurelia-planet aurelia-planet-one" />
          <span className="aurelia-planet aurelia-planet-two" />
          <span className="aurelia-planet aurelia-planet-three" />
          <span className="aurelia-planet aurelia-planet-four" />
        </div>
        <div className="aurelia-whatsapp-layer"><AureliaCapture index={1} priority /></div>
      </div>
    </div>
  );
}
