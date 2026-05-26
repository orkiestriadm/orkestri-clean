"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuspendedContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ? decodeURIComponent(params.get("reason")!) : null;
  const checkoutUrl = params.get("checkout") ? decodeURIComponent(params.get("checkout")!) : null;
  const isTrialExpired = reason?.toLowerCase().includes("trial");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg-primary, #0f0f13)" }}>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{
          background: "var(--bg-card, #1a1a22)",
          borderColor: "var(--border-medium, #2a2a3a)",
        }}>

        {/* Ícone */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary, #f0f0f8)" }}>
          {isTrialExpired ? "Trial Expirado" : "Acesso Suspenso"}
        </h1>

        <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary, #9090b0)" }}>
          {isTrialExpired
            ? "O período de avaliação gratuita da sua organização chegou ao fim. Para continuar usando o Orkiestri, ative sua assinatura."
            : "O acesso da sua organização foi suspenso por inadimplência ou cancelamento. Regularize para voltar a usar a plataforma."}
        </p>

        {/* Ações */}
        <div className="flex flex-col gap-3">
          {checkoutUrl && (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--accent-violet, #7c3aed)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Regularizar Assinatura
            </a>
          )}

          <a
            href="https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20minha%20assinatura%20Orkiestri"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors"
            style={{
              background: "var(--bg-hover, #252532)",
              color: "var(--text-primary, #f0f0f8)",
              border: "1px solid var(--border-subtle, #1e1e2a)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
            </svg>
            Falar com Suporte
          </a>

          <button
            onClick={() => { window.location.href = "/login"; }}
            className="w-full rounded-xl px-4 py-3 text-sm transition-colors"
            style={{ color: "var(--text-muted, #6060808)", background: "transparent" }}
          >
            Voltar ao Login
          </button>
        </div>
      </div>

      {/* Rodapé */}
      <p className="mt-8 text-xs" style={{ color: "var(--text-muted, #60608080)" }}>
        Orkiestri · orkiestri.com
      </p>
    </div>
  );
}

export default function SuspendedPage() {
  return (
    <Suspense>
      <SuspendedContent />
    </Suspense>
  );
}
