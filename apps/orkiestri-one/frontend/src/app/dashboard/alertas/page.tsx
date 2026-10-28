"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  Bell, ShieldAlert, RefreshCw, Check, Monitor, Mail, MessageCircle,
  Plus, X, Users, AlertTriangle, CheckCircle2,
} from "lucide-react";

type Regra = { tipo: string; titulo: string; descricao: string; ativo: boolean; canais: string[]; destinatarios: string[] };
type UserLite = { id: string; nome: string; email: string };

const CANAIS = [
  { id: "sistema",  label: "No sistema", Icon: Monitor },
  { id: "email",    label: "E-mail",     Icon: Mail },
  { id: "whatsapp", label: "WhatsApp",   Icon: MessageCircle },
];

function isAdmin(user: any) {
  return !!(user?.isMaster || user?.isSuperAdmin || (user?.roles ?? []).includes("administrador"));
}

export default function AlertasPage() {
  const { user } = useAuthStore();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>("");
  const [okMsg, setOkMsg] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/alertas/regras").then(r => setRegras(r.data)).catch(() => {}),
      api.get("/alertas/usuarios").then(r => setUsers(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const patch = (tipo: string, p: Partial<Regra>) =>
    setRegras(rs => rs.map(r => r.tipo === tipo ? { ...r, ...p } : r));

  const toggleCanal = (tipo: string, canal: string) => {
    const r = regras.find(x => x.tipo === tipo); if (!r) return;
    patch(tipo, { canais: r.canais.includes(canal) ? r.canais.filter(c => c !== canal) : [...r.canais, canal] });
  };
  const toggleDest = (tipo: string, id: string) => {
    const r = regras.find(x => x.tipo === tipo); if (!r) return;
    patch(tipo, { destinatarios: r.destinatarios.includes(id) ? r.destinatarios.filter(d => d !== id) : [...r.destinatarios, id] });
  };

  async function salvar(tipo: string) {
    const r = regras.find(x => x.tipo === tipo); if (!r) return;
    setSaving(tipo); setOkMsg("");
    try {
      await api.put(`/alertas/regras/${tipo}`, { ativo: r.ativo, canais: r.canais, destinatarios: r.destinatarios });
      setOkMsg(`"${r.titulo}" salvo.`);
      setTimeout(() => setOkMsg(""), 2500);
    } catch {} finally { setSaving(""); }
  }

  const nomeDe = (id: string) => users.find(u => u.id === id)?.nome || id;

  if (user && !isAdmin(user)) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)]">
        <Topbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <ShieldAlert size={32} className="text-[var(--text-muted)]" />
          <div className="text-[14px] font-medium text-[var(--text-primary)]">Acesso restrito</div>
          <div className="text-[13px] text-[var(--text-secondary)]">Somente administradores da organização configuram os alertas.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />
      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1000px] mx-auto px-6 lg:px-10 py-8 space-y-6">

          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bell size={14} className="text-[var(--text-muted)]" />
                <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest">Core · Administração</span>
              </div>
              <h2 className="font-display text-[26px] font-bold text-[var(--text-primary)] tracking-tight">Regras de Alertas</h2>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">Escolha quais alertas a organização recebe, por qual canal e para quem.</p>
            </div>
            {okMsg && (
              <span className="flex items-center gap-1.5 text-[12px] text-emerald-500"><CheckCircle2 size={14} /> {okMsg}</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-[13px]">
              <RefreshCw size={15} className="animate-spin mr-2" /> Carregando…
            </div>
          ) : (
            <div className="space-y-4">
              {regras.map(r => (
                <div key={r.tipo} className={cn("card-premium p-5 transition-all", !r.ativo && "opacity-70")}>
                  {/* Cabeçalho + liga/desliga */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        r.ativo ? "bg-red-500/10 text-red-500" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]")}>
                        <AlertTriangle size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-[var(--text-primary)]">{r.titulo}</div>
                        <div className="text-[12px] text-[var(--text-secondary)] mt-0.5">{r.descricao}</div>
                      </div>
                    </div>
                    <button onClick={() => patch(r.tipo, { ativo: !r.ativo })}
                      className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", r.ativo ? "bg-emerald-500" : "bg-[var(--border-subtle)]")}
                      title={r.ativo ? "Ativo" : "Desligado"}>
                      <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", r.ativo ? "left-[22px]" : "left-0.5")} />
                    </button>
                  </div>

                  {r.ativo && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-4">
                      {/* Canais */}
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">Canais</div>
                        <div className="flex flex-wrap gap-2">
                          {CANAIS.map(c => {
                            const on = r.canais.includes(c.id);
                            return (
                              <button key={c.id} onClick={() => toggleCanal(r.tipo, c.id)}
                                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
                                  on ? "border-violet-500/40 bg-violet-500/10 text-violet-500" : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>
                                {on ? <Check size={12} /> : <c.Icon size={12} />} {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Destinatários */}
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center gap-1.5"><Users size={11} /> Destinatários</div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {r.destinatarios.length === 0 && (
                            <span className="text-[12px] text-[var(--text-muted)] italic">Ninguém selecionado — ninguém será avisado.</span>
                          )}
                          {r.destinatarios.map(id => (
                            <span key={id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                              {nomeDe(id)}
                              <button onClick={() => toggleDest(r.tipo, id)} className="text-[var(--text-muted)] hover:text-red-500"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                        <details className="group">
                          <summary className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-dashed border-[var(--border-subtle)] cursor-pointer list-none w-fit">
                            <Plus size={12} /> Adicionar pessoa
                          </summary>
                          <div className="mt-2 border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)] max-h-52 overflow-y-auto">
                            {users.filter(u => !r.destinatarios.includes(u.id)).length === 0 ? (
                              <div className="px-3 py-2 text-[12px] text-[var(--text-muted)]">Todos já foram adicionados.</div>
                            ) : users.filter(u => !r.destinatarios.includes(u.id)).map(u => (
                              <button key={u.id} onClick={() => toggleDest(r.tipo, u.id)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)]">
                                <div className="min-w-0">
                                  <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{u.nome}</div>
                                  <div className="text-[10px] text-[var(--text-muted)] truncate">{u.email}</div>
                                </div>
                                <Plus size={13} className="text-violet-500 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Salvar */}
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => salvar(r.tipo)} disabled={saving === r.tipo}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent-violet,#7c3aed)] text-white text-[12px] font-medium hover:opacity-90 transition-all disabled:opacity-50"
                      style={{ background: "var(--accent-violet)" }}>
                      {saving === r.tipo ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                      {saving === r.tipo ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
