import { BellRing, CalendarDays, MessageCircle } from "lucide-react";

/** Marca visual da assistente, construída em SVG/CSS; não representa uma pessoa. */
export function AureliaSignature() {
  return (
    <div
      className="aurelia-stage"
      aria-label="Aurélia conecta sua conversa aos compromissos da agenda"
    >
      <div className="aurelia-stage-grid" aria-hidden />
      <svg
        className="aurelia-orbits"
        viewBox="0 0 520 520"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="aurelia-ring"
            x1="60"
            y1="40"
            x2="480"
            y2="500"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffb787" />
            <stop offset=".5" stopColor="#ff6a1a" stopOpacity=".1" />
            <stop offset="1" stopColor="#b0caff" stopOpacity=".6" />
          </linearGradient>
        </defs>
        <circle cx="260" cy="260" r="210" stroke="url(#aurelia-ring)" />
        <circle
          cx="260"
          cy="260"
          r="166"
          stroke="white"
          strokeOpacity=".07"
          strokeDasharray="2 10"
        />
        <ellipse
          cx="260"
          cy="260"
          rx="228"
          ry="107"
          transform="rotate(-32 260 260)"
          stroke="url(#aurelia-ring)"
        />
        <g className="aurelia-orbit-motion">
          <circle cx="260" cy="50" r="5" fill="#ffad77" />
          <circle cx="260" cy="470" r="3" fill="#b0caff" />
        </g>
      </svg>
      <div className="aurelia-core" aria-hidden>
        <div className="aurelia-core-inner">
          <span>a</span>
          <i />
          <i />
          <i />
        </div>
      </div>
      <div
        className="aurelia-float aurelia-float-top premium-surface"
        data-spotlight
      >
        <span className="aurelia-float-icon">
          <MessageCircle size={18} aria-hidden />
        </span>
        <span>
          <small>Você escreve</small>
          <strong>Evento: médico amanhã 14h</strong>
        </span>
      </div>
      <div
        className="aurelia-float aurelia-float-bottom premium-surface"
        data-spotlight
      >
        <span className="aurelia-float-icon">
          <BellRing size={18} aria-hidden />
        </span>
        <span>
          <small>A Aurélia lembra</small>
          <strong>Seu compromisso está chegando.</strong>
        </span>
      </div>
      <span className="aurelia-orbit-label">
        <CalendarDays size={14} aria-hidden /> Conversa → agenda → lembrete
      </span>
    </div>
  );
}
