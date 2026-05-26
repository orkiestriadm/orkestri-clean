"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/logo";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

type SessionStatus = "pending" | "redirected" | "paid" | "completed" | "failed" | "expired";

function StatusContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? (typeof window !== "undefined" ? sessionStorage.getItem("signup_token") : null) ?? "";
  const isDirect = params.get("direct") === "1"; // MP não configurado, conta já criada

  const [status, setStatus] = useState<SessionStatus>(isDirect ? "completed" : "pending");
  const [plano, setPlano] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/billing/public/status/${token}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      if (data.plano) setPlano(data.plano);
      if (data.orgSlug) setOrgSlug(data.orgSlug);

      if (data.status === "completed" || data.status === "failed" || data.status === "expired") {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch { /* silent */ }
    setAttempts(a => a + 1);
  };

  useEffect(() => {
    if (isDirect || status === "completed") return;

    poll();
    intervalRef.current = setInterval(() => {
      setAttempts(a => {
        if (a >= 40) {
          // 40 tentativas × 5s = 3min20s — desiste
          if (intervalRef.current) clearInterval(intervalRef.current!);
        }
        return a;
      });
      poll();
    }, 5000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDirect]);

  const PLAN_LABELS: Record<string, string> = {
    business_cloud: "Business Cloud",
    business_plus: "Business Plus",
  };

  // ── Completed ──────────────────────────────────────────────────────────────
  if (status === "completed") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.3)" }}>
          <CheckCircle2 size={36} color="#22c55e" />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Conta criada com sucesso!
        </h1>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {plano ? `Seu plano ${PLAN_LABELS[plano] || plano} está ativo.` : "Sua conta está pronta."}{" "}
          Enviamos um e-mail de boas-vindas com as instruções de acesso.
        </p>

        <Link
          href="/login"
          className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-violet, #7c3aed)" }}
        >
          Acessar o sistema agora →
        </Link>

        {orgSlug && (
          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            Sua organização: <span className="font-mono font-semibold" style={{ color: "var(--text-secondary)" }}>{orgSlug}</span>
          </p>
        )}
      </div>
    );
  }

  // ── Failed ─────────────────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)" }}>
          <XCircle size={36} color="#ef4444" />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Erro ao criar a conta
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          Houve um problema ao processar seu pagamento ou ao provisionar a conta. Nenhuma cobrança foi efetuada.
        </p>
        <Link
          href="/signup"
          className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-violet, #7c3aed)" }}
        >
          Tentar novamente
        </Link>
        <a
          href="https://wa.me/5511999999999?text=Tive%20um%20problema%20no%20cadastro%20do%20Orkiestri"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Falar com suporte
        </a>
      </div>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (status === "expired") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(107,114,128,0.1)", border: "2px solid rgba(107,114,128,0.3)" }}>
          <Clock size={36} color="#6b7280" />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Sessão expirada
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
          O link expirou. Faça um novo cadastro — seus dados anteriores foram descartados.
        </p>
        <Link
          href="/signup"
          className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent-violet, #7c3aed)" }}
        >
          Novo cadastro
        </Link>
      </div>
    );
  }

  // ── Pending / Processing ───────────────────────────────────────────────────
  const isLong = attempts > 12; // > 1 minuto esperando
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: "rgba(124,58,237,0.1)", border: "2px solid rgba(124,58,237,0.3)" }}>
        <Loader2 size={36} color="#7c3aed" className="animate-spin" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
        {status === "paid" ? "Pagamento confirmado!" : "Aguardando confirmação de pagamento"}
      </h1>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {status === "paid"
          ? "Estamos criando sua conta. Isso leva alguns instantes..."
          : "Aguardando a confirmação do Mercado Pago. Não feche esta janela."}
      </p>

      <div className="flex justify-center gap-1.5 mb-6">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: "#7c3aed", animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {isLong && (
        <div className="rounded-xl p-4 text-sm mb-4"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
          <p className="font-semibold mb-1">Demorando mais que o esperado?</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            O pagamento pode levar alguns minutos para ser confirmado. Se já pagou, sua conta será criada automaticamente e você receberá um e-mail.
          </p>
        </div>
      )}

      <a
        href="https://wa.me/5511999999999?text=Fiz%20o%20pagamento%20mas%20minha%20conta%20n%C3%A3o%20foi%20criada"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        Problemas com o pagamento? Falar com suporte
      </a>
    </div>
  );
}

export default function SignupSuccessPage() {
  return (
    <Suspense>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary, #0f0f13)" }}>
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--border-subtle, #1e1e2a)" }}>
          <Link href="/">
            <BrandLogo size="md" />
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border p-8"
            style={{ background: "var(--bg-card, #1a1a22)", borderColor: "var(--border-medium, #2a2a3a)" }}>
            <StatusContent />
          </div>
        </div>

        <footer className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Orkiestri · orkiestri.com
        </footer>
      </div>
    </Suspense>
  );
}
