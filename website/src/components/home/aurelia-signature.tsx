import { AureliaCapture } from "./aurelia-capture";

/** A marca animada fica atrás da conversa real, sem mover a tela do WhatsApp. */
export function AureliaSignature() {
  return (
    <div className="aurelia-signature">
      <div className="aurelia-signature-backdrop" aria-hidden="true">
        <div className="aurelia-stage-grid" />
        <svg className="aurelia-orbits" viewBox="0 0 520 520" fill="none">
          <defs>
            <linearGradient id="aurelia-ring" x1="60" y1="40" x2="480" y2="500" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffb787" />
              <stop offset=".5" stopColor="#ff6a1a" stopOpacity=".1" />
              <stop offset="1" stopColor="#ffc48a" stopOpacity=".6" />
            </linearGradient>
          </defs>
          <circle cx="260" cy="260" r="210" stroke="url(#aurelia-ring)" />
          <circle cx="260" cy="260" r="166" stroke="white" strokeOpacity=".07" strokeDasharray="2 10" />
          <ellipse cx="260" cy="260" rx="228" ry="107" transform="rotate(-32 260 260)" stroke="url(#aurelia-ring)" />
          <g className="aurelia-orbit-motion">
            <circle cx="260" cy="50" r="5" fill="#ffad77" />
            <circle cx="260" cy="470" r="3" fill="#ffc48a" />
          </g>
        </svg>
        <div className="aurelia-core aurelia-background-spin">
          <div className="aurelia-core-inner"><span>a</span><i /><i /><i /></div>
        </div>
      </div>
      <div className="aurelia-whatsapp-layer site-warm-surface">
        <AureliaCapture index={1} priority />
      </div>
    </div>
  );
}
