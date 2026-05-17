"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

type Notif = {
  id: string; tipo: string; titulo: string; mensagem?: string;
  lida: boolean; criadoEm: string;
  referenciaTipo?: string; referenciaId?: string;
};

const INVITE_TIPOS = ["evento_convidado", "task_atribuida", "projeto_prazo"];

const TIPO_META: Record<string, { icon: string; color: string; label: string }> = {
  evento_lembrete:  { icon: "calendar", color: "var(--accent-amber)",  label: "Lembrete"    },
  evento_agora:     { icon: "alert",    color: "var(--accent-red)",    label: "Agora"       },
  evento_convidado: { icon: "users",    color: "var(--accent-cyan)",   label: "Convite"     },
  projeto_prazo:    { icon: "layers",   color: "var(--accent-violet)", label: "Projeto"     },
  task_atribuida:   { icon: "check",    color: "var(--accent-green)",  label: "Task"        },
  resposta_convite: { icon: "reply",    color: "var(--accent-violet)", label: "Resposta"    },
  reset_senha:      { icon: "key",      color: "var(--accent-amber)",  label: "Senha"       },
  teste:            { icon: "bell",     color: "var(--accent-cyan)",   label: "Teste"       },
};

function Icon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    calendar: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>,
    alert:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    users:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round"/></svg>,
    layers:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round"/></svg>,
    check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>,
    reply:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M13 21l8-5-8-5v10z"/></svg>,
    key:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    bell:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
  };
  return icons[name] || icons.bell;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationBell() {
  const { token } = useAuthStore();
  const [notifs,  setNotifs]  = useState<Notif[]>([]);
  const [open,    setOpen]    = useState(false);
  const [responding, setResponding] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } catch {}
  }, [token]);

  // SSE connection for real-time updates; fallback polling if EventSource unsupported
  useEffect(() => {
    if (!token) return;
    load(); // initial load

    const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const url = `${BASE}/notifications/stream?token=${encodeURIComponent(token)}`;

    try {
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.notifs) setNotifs(parsed.notifs);
        } catch {}
      };
      es.onerror = () => {
        es.close();
        esRef.current = null;
      };
    } catch {
      // EventSource not supported, use polling
      const iv = setInterval(load, 15000);
      return () => clearInterval(iv);
    }

    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    setNotifs(p => p.filter(n => n.id !== id));
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    setNotifs([]);
  };

  const respond = async (notif: Notif, status: "aceito" | "recusado") => {
    if (!notif.referenciaTipo || !notif.referenciaId) return;
    setResponding(notif.id + status);
    try {
      await api.patch("/agenda/respond-by-ref", {
        referenciaTipo: notif.referenciaTipo,
        referenciaId: notif.referenciaId,
        status,
      });
      await markRead(notif.id);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Erro ao responder";
      alert(msg);
    } finally {
      setResponding(null);
    }
  };

  const invites  = notifs.filter(n => INVITE_TIPOS.includes(n.tipo));
  const regular  = notifs.filter(n => !INVITE_TIPOS.includes(n.tipo));
  const unread   = notifs.length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-icon"
        style={{ position: "relative", width: 34, height: 34 }}
        title="Notificacoes"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: invites.length > 0 ? "var(--accent-cyan)" : "var(--accent-red)", border: "2px solid var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", padding: "0 3px" }}>
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, background: "var(--modal-bg)", border: "1px solid var(--border-medium)", borderRadius: 14, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", zIndex: 200, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Notificacoes</span>
              {unread > 0 && <span className="badge badge-red" style={{ fontSize: 10 }}>{unread}</span>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: "var(--accent-violet)", background: "none", border: "none", cursor: "pointer" }}>
                Marcar todas lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-medium)" strokeWidth="1" style={{ marginBottom: 8 }}>
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma notificacao</p>
              </div>
            ) : (
              <>
                {/* ── Convites pendentes ─────────────────────────────── */}
                {invites.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", padding: "10px 16px 4px", background: "rgba(34,211,238,0.04)", borderBottom: "1px solid var(--border-subtle)" }}>
                      CONVITES PENDENTES — {invites.length}
                    </div>
                    {invites.map((n, i) => {
                      const meta = TIPO_META[n.tipo] || { icon: "bell", color: "var(--accent-violet)", label: "" };
                      const isAceito   = responding === n.id + "aceito";
                      const isRecusado = responding === n.id + "recusado";
                      const isBusy     = isAceito || isRecusado;
                      const hasRef     = !!(n.referenciaTipo && n.referenciaId);
                      return (
                        <div key={n.id} style={{ padding: "12px 16px", borderBottom: i < invites.length - 1 ? "1px solid var(--border-subtle)" : "none", background: "rgba(34,211,238,0.03)" }}>
                          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${meta.color}18`, border: `1px solid ${meta.color}35`, display: "flex", alignItems: "center", justifyContent: "center", color: meta.color, flexShrink: 0 }}>
                              <Icon name={meta.icon} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: meta.color, background: `${meta.color}18`, padding: "1px 6px", borderRadius: 4 }}>{meta.label.toUpperCase()}</span>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{timeAgo(n.criadoEm)}</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.35 }}>{n.titulo}</div>
                              {n.mensagem && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{n.mensagem}</div>}
                            </div>
                          </div>
                          {hasRef && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                disabled={isBusy}
                                onClick={() => respond(n, "aceito")}
                                style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid rgba(52,211,153,0.4)", background: isAceito ? "rgba(52,211,153,0.25)" : "rgba(52,211,153,0.1)", color: "#34d399", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}
                              >
                                {isAceito ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>
                                )}
                                Aceitar
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => respond(n, "recusado")}
                                style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid rgba(248,113,113,0.4)", background: isRecusado ? "rgba(248,113,113,0.25)" : "rgba(248,113,113,0.1)", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}
                              >
                                {isRecusado ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                )}
                                Recusar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Outras notificacoes ────────────────────────────── */}
                {regular.length > 0 && (
                  <div>
                    {invites.length > 0 && (
                      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", padding: "10px 16px 4px", borderBottom: "1px solid var(--border-subtle)" }}>
                        INFORMACOES
                      </div>
                    )}
                    {regular.map((n, i) => {
                      const meta = TIPO_META[n.tipo] || { icon: "bell", color: "var(--accent-violet)", label: "" };
                      return (
                        <div key={n.id} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: i < regular.length - 1 ? "1px solid var(--border-subtle)" : "none", transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: meta.color, flexShrink: 0, marginTop: 2 }}>
                            <Icon name={meta.icon} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4 }}>{n.titulo}</div>
                            {n.mensagem && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{n.mensagem}</div>}
                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>{timeAgo(n.criadoEm)}</div>
                          </div>
                          <button onClick={() => markRead(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0, padding: 4, display: "flex" }} title="Marcar como lida">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
