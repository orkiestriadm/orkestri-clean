"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { OrkestriLogo } from "@/components/ui/logo";

export default function SolicitarAcessoPage() {
  const [tenantNome, setTenantNome] = useState("Orkestri");
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "", motivacao: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/tenant-info").then(r => setTenantNome(r.data?.nome || "Orkestri")).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) { setError("Nome e e-mail são obrigatórios."); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/solicitar-acesso", form);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao enviar solicitação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-black/5 dark:bg-black/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-zinc-900 dark:text-white text-[15px] focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-black transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600";
  const labelClass = "text-[13px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1.5";

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center py-12 font-display">
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[800px] h-[800px] bg-black/[0.02] dark:bg-white/[0.02] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[480px] px-8">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-5 shadow-xl rounded-[30px] overflow-hidden">
            <OrkestriLogo size={48} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white mb-1">
            Solicitar Acesso
          </h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400 text-center">
            O administrador revisará sua solicitação.
          </p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Solicitação enviada!</h2>
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-8">
                Seu pedido foi registrado. Você será notificado via WhatsApp quando for aprovado.
              </p>
              <Link
                href="/login"
                className="inline-block w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors text-center shadow-md"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Empresa (read-only, from tenant config) */}
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400 shrink-0">
                  <path d="M3 21h18M3 7v14M21 7v14M6 3h12l3 4H3L6 3zM9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wide">Empresa</p>
                  <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">{tenantNome}</p>
                </div>
              </div>

              <div>
                <label className={labelClass}>Nome completo *</label>
                <input type="text" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Seu nome completo" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>E-mail *</label>
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="nome@empresa.com" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>WhatsApp</label>
                <input type="tel" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="(11) 99999-9999" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Motivo do acesso</label>
                <textarea value={form.motivacao} onChange={e => set("motivacao", e.target.value)} placeholder="Por que você precisa de acesso ao sistema?" rows={3} className={inputClass + " resize-none"} />
              </div>

              {error && (
                <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1 shadow-md"
              >
                {loading ? "Enviando..." : "Enviar solicitação"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-[14px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
