import { AureliaCapture } from "./aurelia-capture";

/** Um único monograma decorativo gira atrás da conversa real e estática. */
export function AureliaSignature() {
  return (
    <div className="aurelia-signature">
      <div className="aurelia-signature-backdrop" aria-hidden="true">
        <div className="aurelia-ambient-glow" />
        <svg className="aurelia-background-spin" viewBox="0 0 640 640" fill="none">
          <defs>
            <linearGradient id="aurelia-monogram-light" x1="120" y1="70" x2="530" y2="580" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffc997" stopOpacity=".62" />
              <stop offset=".5" stopColor="#ff8a3d" stopOpacity=".28" />
              <stop offset="1" stopColor="#ff6a1a" stopOpacity=".03" />
            </linearGradient>
          </defs>
          <text x="320" y="446" textAnchor="middle" fontFamily="Georgia, serif" fontStyle="italic" fontSize="500" fill="url(#aurelia-monogram-light)" fillOpacity=".22" stroke="url(#aurelia-monogram-light)" strokeWidth="1.2">a</text>
        </svg>
      </div>
      <div className="aurelia-whatsapp-layer"><AureliaCapture index={1} priority /></div>
    </div>
  );
}
