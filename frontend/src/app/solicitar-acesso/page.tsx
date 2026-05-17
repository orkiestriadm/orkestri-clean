"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { OrkestriLogo } from "@/components/ui/logo";

interface Organization {
  id: string;
  nome: string;
}

export default function SolicitarAcessoPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [form, setForm] = useState({
    nome: "", email: "", whatsapp: "", motivacao: "", organizationId: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/organizations")
      .then(r => {
        const orgs: Organization[] = r.data || [];
        setOrganizations(orgs);
        if (orgs.length === 1) setForm(f => ({ ...f, organizationId: orgs[0].id }));
      })
      .catch(() => {})
      .finally(() => setLoadingOrgs(false));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) { setError("Nome e e-mail são obrigatórios."); return; }
    if (!form.organizationId) { setError("Selecione a empresa à qual pertence."); return; }
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

  const selectedOrg = organizations.find(o => o.id === form.organizationId);

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
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mb-2">
                Seu pedido foi registrado para <strong className="text-zinc-700 dark:text-zinc-300">{selectedOrg?.nome}</strong>.
              </p>
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500 mb-8">
                Você será notificado quando o administrador aprovar sua solicitação.
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

              {/* Seletor de empresa */}
              <div>
                <label className={labelClass}>
                  Empresa *
                </label>
                {loadingOrgs ? (
                  <div className={inputClass + " flex items-center gap-2 text-zinc-400"}>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Carregando empresas...
                  </div>
                ) : organizations.length === 0 ? (
                  <div className={inputClass + " text-zinc-400 dark:text-zinc-500 italic"}>
                    Nenhuma empresa disponível no momento.
                  </div>
                ) : (
                  <select
                    value={form.organizationId}
                    onChange={e => set("organizationId", e.target.value)}
                    className={inputClass + " cursor-pointer appearance-none bg-[image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_14px_center] pr-10"}
                    required
                  >
                    <option value="">Selecione sua empresa...</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.nome}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Nome completo *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => set("nome", e.target.value)}
                  placeholder="Seu nome completo"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div>
                <label className={labelClass}>E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="nome@empresa.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>WhatsApp</label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => set("whatsapp", e.target.value)}
                  placeholder="(11) 99999-9999"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Motivo do acesso</label>
                <textarea
                  value={form.motivacao}
                  onChange={e => set("motivacao", e.target.value)}
                  placeholder="Por que você precisa de acesso ao sistema?"
                  rows={3}
                  className={inputClass + " resize-none"}
                />
              </div>

              {error && (
                <div className="text-[13px] text-red-600 dark:text-red-400 font-medium text-center bg-red-50 dark:bg-red-950/20 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || loadingOrgs || organizations.length === 0}
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
