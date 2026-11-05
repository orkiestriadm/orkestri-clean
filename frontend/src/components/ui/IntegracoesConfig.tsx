"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { MARCA } from "@/lib/marca";
import { useAuthStore } from "@/lib/store";
import { RefreshCw, Link2, Unlink, CheckCircle2, AlertTriangle, Clock, Calendar, Settings, Copy, Save, Trash2 } from "lucide-react";
import GoogleCalendarModal, { GoogleCalendarIcon } from "@/components/agenda/GoogleCalendarModal";

/**
 * Integrações de Calendário → Google Agenda e Microsoft 365 / Outlook.
 *
 * Tela amigável com status dos provedores, ações de sincronização manual,
 * preferências de envio/recebimento e configuração de credenciais OAuth para administradores.
 */

type Status = {
  configured: boolean;
  webhookViable?: boolean;
  connected: boolean;
  status: string; // CONNECTED | SYNCING | SYNCED | ERROR | DISCONNECTED | REAUTH_REQUIRED
  account?: string | null;
  calendarName?: string | null;
  lastSyncAt?: string | null;
  pushEnabled?: boolean;
  syncEnabled?: boolean;
  error?: string | null;
};

type ConfigDto = {
  scope: "org" | "platform";
  exists: boolean;
  enabled: boolean;
  clientId: string;
  tenantId?: string;
  redirectUri: string;
  webhookUrl: string;
  secretConfigured: boolean;
  redirectUriParaRegistrar: string;
  webhookUrlParaRegistrar: string;
  effectiveSource: "org" | "platform" | "env" | "none";
  effectiveConfigured: boolean;
  vaultReady: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  org: "configuração desta organização",
  platform: "padrão da plataforma",
  env: "variáveis de ambiente do servidor",
  none: "nenhuma — precisa configurar",
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  CONNECTED:       { label: "Conectado",              color: "var(--accent-green, #10b981)",  icon: CheckCircle2 },
  SYNCED:          { label: "Sincronizado",           color: "var(--accent-green, #10b981)",  icon: CheckCircle2 },
  SYNCING:         { label: "Sincronizando…",         color: "var(--accent-violet, #8b5cf6)", icon: RefreshCw },
  ERROR:           { label: "Erro de sincronização",  color: "var(--accent-red, #ef4444)",    icon: AlertTriangle },
  REAUTH_REQUIRED: { label: "Reconexão necessária",   color: "var(--accent-amber, #f59e0b)",  icon: AlertTriangle },
  DISCONNECTED:    { label: "Não conectado",          color: "var(--text-muted, #888)",      icon: Unlink },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
}

const FEEDBACK_MESSAGES: Record<string, { text: string; ok: boolean }> = {
  // Microsoft
  ms_connected:     { text: "Conta Microsoft conectada com sucesso! A sincronização inicial está em andamento.", ok: true },
  ms_cancelled:     { text: "Conexão Microsoft cancelada — você não autorizou o acesso.", ok: false },
  ms_reauth:        { text: "A autorização Microsoft expirou. Conecte novamente.", ok: false },
  ms_invalid_state: { text: "O fluxo de conexão Microsoft expirou. Tente conectar de novo.", ok: false },
  ms_error:         { text: "Não foi possível concluir a conexão Microsoft. Tente novamente.", ok: false },
  // Google
  google_connected:     { text: "Conta Google conectada com sucesso! A sincronização inicial está em andamento.", ok: true },
  google_cancelled:     { text: "Conexão Google cancelada — você não autorizou o acesso.", ok: false },
  google_reauth:        { text: "A autorização Google expirou. Reconecte sua conta.", ok: false },
  google_invalid_state: { text: "O fluxo de conexão Google expirou. Tente conectar de novo.", ok: false },
  google_error:         { text: "Não foi possível concluir a conexão com o Google. Tente novamente.", ok: false },
};

export default function IntegracoesConfig() {
  const [msStatus, setMsStatus] = useState<Status | null>(null);
  const [googleStatus, setGoogleStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

  const { user } = useAuthStore();
  const isAdmin = !!(user?.isMaster || user?.isSuperAdmin || user?.permissions?.includes("integracoes:configurar"));

  // Configuração Microsoft de credenciais (admin).
  const [showMsConfig, setShowMsConfig] = useState(false);
  const [msCfg, setMsCfg] = useState<ConfigDto | null>(null);
  const [msScope, setMsScope] = useState<"org" | "platform">("org");
  const [msForm, setMsForm] = useState({ clientId: "", tenantId: "common", clientSecret: "", redirectUri: "" });

  const loadMs = useCallback(async () => {
    try {
      const { data } = await api.get<Status>("/integracoes/microsoft/status");
      setMsStatus(data);
    } catch {
      setMsStatus(null);
    }
  }, []);

  const loadGoogle = useCallback(async () => {
    try {
      const { data } = await api.get<Status>("/integracoes/google/status");
      setGoogleStatus(data);
    } catch {
      setGoogleStatus(null);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadMs(), loadGoogle()]);
    setLoading(false);
  }, [loadMs, loadGoogle]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Feedback de OAuth (?ms=... ou ?google=...), depois limpa a URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ms = params.get("ms");
    const google = params.get("google");

    if (ms && FEEDBACK_MESSAGES[`ms_${ms}`]) {
      setMsg(FEEDBACK_MESSAGES[`ms_${ms}`]);
      params.delete("ms");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      if (ms === "connected") setTimeout(loadMs, 2500);
    } else if (google && FEEDBACK_MESSAGES[`google_${google}`]) {
      setMsg(FEEDBACK_MESSAGES[`google_${google}`]);
      params.delete("google");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      if (google === "connected") setTimeout(loadGoogle, 2500);
    }
  }, [loadMs, loadGoogle]);

  // ── Ações Google ──────────────────────────────────────────────────────────
  const syncGoogleNow = async () => {
    setBusy("google-sync");
    try {
      await api.post("/integracoes/google/sync-now");
      setMsg({ text: "Sincronização com o Google Agenda iniciada.", ok: true });
      setTimeout(loadGoogle, 2000);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível sincronizar o Google agora.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const toggleGooglePush = async (enabled: boolean) => {
    setBusy("google-push");
    try {
      await api.patch("/integracoes/google/toggle-push", { enabled });
      setGoogleStatus(s => s ? { ...s, pushEnabled: enabled } : s);
      setMsg({ text: enabled ? "Envio de eventos para o Google ativado." : "Envio de eventos para o Google pausado.", ok: true });
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível alterar a opção.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  // ── Ações Microsoft ───────────────────────────────────────────────────────
  const connectMs = async () => {
    setBusy("ms-connect");
    try {
      const { data } = await api.get<{ url: string }>("/integracoes/microsoft/connect");
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Integração Microsoft indisponível no momento.", ok: false });
      setBusy(null);
    }
  };

  const syncMsNow = async () => {
    setBusy("ms-sync");
    try {
      await api.post("/integracoes/microsoft/sync-now");
      setMsg({ text: "Sincronização com o Outlook iniciada.", ok: true });
      setTimeout(loadMs, 2000);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível sincronizar o Outlook agora.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const disconnectMs = async () => {
    if (!confirm("Desconectar a conta Microsoft? Os compromissos futuros importados do Outlook serão removidos da agenda (o histórico é mantido).")) return;
    setBusy("ms-disconnect");
    try {
      await api.post("/integracoes/microsoft/disconnect", {});
      setMsg({ text: "Conta Microsoft desconectada.", ok: true });
      await loadMs();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Falha ao desconectar conta Microsoft.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const toggleMsPush = async (enabled: boolean) => {
    setBusy("ms-push");
    try {
      const { data } = await api.patch<Status>("/integracoes/microsoft/push", { enabled });
      setMsStatus(s => s ? { ...s, pushEnabled: data.pushEnabled } : s);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível alterar a opção.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  // ── Configuração de credenciais Microsoft (admin) ─────────────────────────
  const loadMsConfig = useCallback(async (sc: "org" | "platform") => {
    try {
      const { data } = await api.get<ConfigDto>("/integracoes/microsoft/config", { params: { scope: sc } });
      setMsCfg(data);
      setMsForm({ clientId: data.clientId || "", tenantId: data.tenantId || "common", clientSecret: "", redirectUri: data.redirectUri || "" });
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível carregar a configuração da Microsoft.", ok: false });
    }
  }, []);

  const openMsConfig = async () => {
    setShowMsConfig(true);
    await loadMsConfig(msScope);
  };

  const switchMsScope = async (sc: "org" | "platform") => {
    setMsScope(sc);
    await loadMsConfig(sc);
  };

  const saveMsConfig = async () => {
    if (!msForm.clientId.trim()) { setMsg({ text: "Client ID é obrigatório.", ok: false }); return; }
    setBusy("ms-config-save");
    try {
      const body: any = { clientId: msForm.clientId.trim(), tenantId: msForm.tenantId.trim() || "common", redirectUri: msForm.redirectUri.trim() || undefined };
      if (msForm.clientSecret.trim()) body.clientSecret = msForm.clientSecret.trim();
      const { data } = await api.put<ConfigDto>("/integracoes/microsoft/config", body, { params: { scope: msScope } });
      setMsCfg(data);
      setMsForm(f => ({ ...f, clientSecret: "" }));
      setMsg({ text: "Configuração Microsoft salva com sucesso.", ok: true });
      await loadMs();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Falha ao salvar a configuração Microsoft.", ok: false });
    } finally { setBusy(null); }
  };

  const removeMsConfig = async () => {
    if (!confirm("Remover esta configuração da Microsoft? A integração voltará a usar o padrão da plataforma ou do servidor.")) return;
    setBusy("ms-config-del");
    try {
      await api.delete("/integracoes/microsoft/config", { params: { scope: msScope } });
      await loadMsConfig(msScope);
      setMsg({ text: "Configuração Microsoft removida.", ok: true });
      await loadMs();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Falha ao remover configuração Microsoft.", ok: false });
    } finally { setBusy(null); }
  };

  const copy = (text: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setMsg({ text: "Copiado para a área de transferência.", ok: true });
    } catch {}
  };

  if (loading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando integrações…</div>;
  }

  const googleSt = googleStatus?.status || "DISCONNECTED";
  const googleMeta = STATUS_META[googleSt] || STATUS_META.DISCONNECTED;
  const GoogleMetaIcon = googleMeta.icon;
  const isGoogleConnected = !!googleStatus?.connected && googleSt !== "DISCONNECTED";

  const msSt = msStatus?.status || "DISCONNECTED";
  const msMeta = STATUS_META[msSt] || STATUS_META.DISCONNECTED;
  const MsMetaIcon = msMeta.icon;
  const isMsConnected = !!msStatus?.connected && msSt !== "DISCONNECTED";

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Cabeçalho da página */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-display)", margin: 0 }}>
          Integrações de Calendário
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0 0", lineHeight: 1.6 }}>
          Conecte sua conta do Google Agenda ou Microsoft Outlook para manter seus compromissos sincronizados
          bidirecionalmente com o Space e as notificações da Aurélia no WhatsApp.
        </p>
      </div>

      {msg && (
        <div style={{
          padding: "11px 16px",
          borderRadius: 8,
          fontSize: 13,
          border: `1px solid ${msg.ok ? "var(--accent-green, #10b981)" : "var(--accent-red, #ef4444)"}`,
          color: msg.ok ? "var(--accent-green, #10b981)" : "var(--accent-red, #ef4444)",
          background: msg.ok ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
        }}>
          {msg.text}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          CARD 1: GOOGLE CALENDAR / GOOGLE AGENDA
          ═════════════════════════════════════════════════════════════════════════ */}
      <div style={{
        padding: 20,
        borderRadius: 14,
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
        background: "var(--surface, rgba(255,255,255,0.02))",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(66, 133, 244, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <GoogleCalendarIcon size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)" }}>Google Agenda</span>
              <span style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(66, 133, 244, 0.15)",
                color: "#60a5fa",
                fontWeight: 500,
              }}>Google Calendar</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isGoogleConnected ? (googleStatus?.account || "Conta conectada") : "Nenhuma conta Google conectada"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: googleMeta.color, fontSize: 12, fontWeight: 600 }}>
            <GoogleMetaIcon size={15} style={googleSt === "SYNCING" ? { animation: "spin 1s linear infinite" } : undefined} />
            {googleMeta.label}
          </div>
        </div>

        {isGoogleConnected && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Última sincronização: <strong style={{ color: "var(--text-primary, inherit)" }}>{fmtDateTime(googleStatus?.lastSyncAt)}</strong>
            </span>
            {googleStatus?.calendarName && <span>Agenda principal: <strong>{googleStatus.calendarName}</strong></span>}
          </div>
        )}

        {googleStatus?.error && (
          <div style={{ fontSize: 12, color: "var(--accent-red, #ef4444)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} /> {googleStatus.error}
          </div>
        )}

        {/* Botões de Ação Google */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {!isGoogleConnected || googleSt === "REAUTH_REQUIRED" ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => setGoogleModalOpen(true)}
            >
              <Link2 size={15} /> {googleSt === "REAUTH_REQUIRED" ? "Reconectar Google Agenda" : "Conectar Google Agenda"}
            </button>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}
                disabled={busy === "google-sync"}
                onClick={syncGoogleNow}
              >
                <RefreshCw size={15} style={busy === "google-sync" ? { animation: "spin 1s linear infinite" } : undefined} />
                Sincronizar agora
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}
                onClick={() => setGoogleModalOpen(true)}
              >
                <Settings size={15} /> Preferências & Detalhes
              </button>
            </>
          )}
        </div>

        {/* Opção de Envio Google */}
        {isGoogleConnected && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={!!googleStatus?.pushEnabled}
              disabled={busy === "google-push"}
              onChange={e => toggleGooglePush(e.target.checked)}
            />
            Enviar para o Google Agenda os novos compromissos criados no Orkiestri e no WhatsApp da Aurélia
          </label>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          CARD 2: MICROSOFT 365 / OUTLOOK
          ═════════════════════════════════════════════════════════════════════════ */}
      <div style={{
        padding: 20,
        borderRadius: 14,
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
        background: "var(--surface, rgba(255,255,255,0.02))",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#0078d41a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <Calendar size={22} style={{ color: "#0078d4" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-display)" }}>Microsoft Outlook</span>
              <span style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(0, 120, 212, 0.15)",
                color: "#60a5fa",
                fontWeight: 500,
              }}>Microsoft 365</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isMsConnected ? (msStatus?.account || "Conta conectada") : "Nenhuma conta Microsoft conectada"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: msMeta.color, fontSize: 12, fontWeight: 600 }}>
            <MsMetaIcon size={15} style={msSt === "SYNCING" ? { animation: "spin 1s linear infinite" } : undefined} />
            {msMeta.label}
          </div>
        </div>

        {isMsConnected && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Última sincronização: <strong style={{ color: "var(--text-primary, inherit)" }}>{fmtDateTime(msStatus?.lastSyncAt)}</strong>
            </span>
            {msStatus?.calendarName && <span>Calendário: <strong>{msStatus.calendarName}</strong></span>}
          </div>
        )}

        {msStatus?.error && (
          <div style={{ fontSize: 12, color: "var(--accent-red, #ef4444)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} /> {msStatus.error}
          </div>
        )}

        {/* Botões de Ação Microsoft */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isMsConnected || msSt === "REAUTH_REQUIRED" ? (
            <button className="btn btn-primary" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }} disabled={busy === "ms-connect"} onClick={connectMs}>
              <Link2 size={15} /> {msSt === "REAUTH_REQUIRED" ? "Reconectar Microsoft 365" : "Conectar Microsoft 365"}
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }} disabled={busy === "ms-sync"} onClick={syncMsNow}>
                <RefreshCw size={15} style={busy === "ms-sync" ? { animation: "spin 1s linear infinite" } : undefined} /> Sincronizar agora
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7, color: "var(--accent-red, #ef4444)" }} disabled={busy === "ms-disconnect"} onClick={disconnectMs}>
                <Unlink size={15} /> Desconectar
              </button>
            </>
          )}
        </div>

        {/* Opção de Envio Microsoft */}
        {isMsConnected && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>
            <input type="checkbox" checked={!!msStatus?.pushEnabled} disabled={busy === "ms-push"} onChange={e => toggleMsPush(e.target.checked)} />
            Enviar para o Outlook os compromissos criados aqui no {MARCA}
          </label>
        )}

        {/* Configuração avançada de credenciais Microsoft (admin) */}
        {isAdmin && (
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14, marginTop: 4 }}>
            {!showMsConfig ? (
              <button className="btn btn-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, padding: "6px 10px" }} onClick={openMsConfig}>
                <Settings size={14} /> Configurar credenciais personalizadas (Microsoft Entra)
              </button>
            ) : (
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Settings size={15} /> Credenciais do aplicativo Microsoft Entra
                  </div>
                  {user?.isSuperAdmin && (
                    <div style={{ display: "flex", gap: 4, background: "var(--bg-subtle, rgba(255,255,255,.03))", padding: 3, borderRadius: 8 }}>
                      {(["org", "platform"] as const).map(sc => (
                        <button key={sc} onClick={() => switchMsScope(sc)} style={{
                          fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                          background: msScope === sc ? "var(--accent-violet, #8b5cf6)" : "transparent",
                          color: msScope === sc ? "#fff" : "var(--text-muted)",
                        }}>{sc === "org" ? "Esta organização" : "Padrão da plataforma"}</button>
                      ))}
                    </div>
                  )}
                </div>

                {msCfg && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Em uso agora: <strong style={{ color: "var(--text-primary, inherit)" }}>{SOURCE_LABEL[msCfg.effectiveSource]}</strong>
                    {!msCfg.vaultReady && <span style={{ color: "var(--accent-red)", display: "block", marginTop: 4 }}>⚠ APP_VAULT_KEY não configurada no servidor.</span>}
                  </div>
                )}

                <Field label="Client ID (Application ID)">
                  <input value={msForm.clientId} onChange={e => setMsForm(f => ({ ...f, clientId: e.target.value }))}
                    placeholder="00000000-0000-0000-0000-000000000000" style={inp} />
                </Field>
                <Field label="Tenant ID (Directory ID) — ou 'common' para multitenant">
                  <input value={msForm.tenantId} onChange={e => setMsForm(f => ({ ...f, tenantId: e.target.value }))}
                    placeholder="common" style={inp} />
                </Field>
                <Field label={`Client Secret ${msCfg?.secretConfigured ? "(já configurado — preencha só para trocar)" : ""}`}>
                  <input type="password" value={msForm.clientSecret} onChange={e => setMsForm(f => ({ ...f, clientSecret: e.target.value }))}
                    placeholder={msCfg?.secretConfigured ? "•••••••••• (mantém o atual)" : "Cole o Value do secret"} style={inp} />
                </Field>

                {msCfg && (
                  <div style={{ background: "var(--bg-subtle, rgba(255,255,255,.03))", borderRadius: 8, padding: 10, fontSize: 11, color: "var(--text-muted)" }}>
                    <div style={{ marginBottom: 4 }}>Registre este <b>Redirect URI</b> no Azure Portal / Entra:</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary, inherit)", wordBreak: "break-all" }}>{msCfg.redirectUriParaRegistrar}</code>
                      <button onClick={() => copy(msCfg.redirectUriParaRegistrar)} title="Copiar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-violet)", flexShrink: 0 }}><Copy size={13} /></button>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }} disabled={busy === "ms-config-save"} onClick={saveMsConfig}>
                    <Save size={14} /> Salvar credenciais
                  </button>
                  {msCfg?.exists && (
                    <button className="btn btn-ghost" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "var(--accent-red)" }} disabled={busy === "ms-config-del"} onClick={removeMsConfig}>
                      <Trash2 size={14} /> Remover personalização
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowMsConfig(false)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal oficial do Google Calendar para o fluxo completo */}
      <GoogleCalendarModal
        open={googleModalOpen}
        onClose={() => {
          setGoogleModalOpen(false);
          loadGoogle();
        }}
        onSyncComplete={loadGoogle}
      />
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
  background: "var(--bg-input, var(--surface, rgba(255,255,255,0.03)))",
  color: "var(--text-primary, inherit)",
  fontSize: 13,
  fontFamily: "var(--font-mono, monospace)",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
