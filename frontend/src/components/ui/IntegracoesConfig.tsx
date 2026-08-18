"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { MARCA } from "@/lib/marca";
import { RefreshCw, Link2, Unlink, CheckCircle2, AlertTriangle, Clock, Calendar } from "lucide-react";

/**
 * Integrações → Microsoft 365 / Outlook.
 *
 * Tela simples para o usuário comum: um cartão de status + os botões Conectar /
 * Sincronizar agora / Desconectar. Mensagens amigáveis; nada de stack trace.
 * Lê ?ms=... da querystring (feedback do retorno do OAuth) e limpa a URL.
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
  error?: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  CONNECTED:       { label: "Conectado",              color: "var(--accent-green)",  icon: CheckCircle2 },
  SYNCED:          { label: "Sincronizado",           color: "var(--accent-green)",  icon: CheckCircle2 },
  SYNCING:         { label: "Sincronizando…",         color: "var(--accent-violet)", icon: RefreshCw },
  ERROR:           { label: "Erro de sincronização",  color: "var(--accent-red)",    icon: AlertTriangle },
  REAUTH_REQUIRED: { label: "Reconexão necessária",   color: "var(--accent-amber, #f59e0b)", icon: AlertTriangle },
  DISCONNECTED:    { label: "Não conectado",          color: "var(--text-muted)",    icon: Unlink },
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
}

const MS_FEEDBACK: Record<string, { text: string; ok: boolean }> = {
  connected:     { text: "Conta Microsoft conectada. A sincronização inicial está em andamento.", ok: true },
  cancelled:     { text: "Conexão cancelada — você não autorizou o acesso.", ok: false },
  reauth:        { text: "A autorização expirou. Conecte novamente.", ok: false },
  invalid_state: { text: "O fluxo de conexão expirou. Tente conectar de novo.", ok: false },
  error:         { text: "Não foi possível concluir a conexão. Tente novamente.", ok: false },
};

export default function IntegracoesConfig() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Status>("/integracoes/microsoft/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Feedback do retorno do OAuth (?ms=...), depois limpa a URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ms = params.get("ms");
    if (ms && MS_FEEDBACK[ms]) {
      setMsg(MS_FEEDBACK[ms]);
      params.delete("ms");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      // Após conectar, o status muda em segundo plano; recarrega em instantes.
      if (ms === "connected") setTimeout(load, 2500);
    }
  }, [load]);

  const connect = async () => {
    setBusy("connect");
    try {
      const { data } = await api.get<{ url: string }>("/integracoes/microsoft/connect");
      if (data?.url) window.location.href = data.url; // redireciona o navegador ao login Microsoft
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Integração indisponível no momento.", ok: false });
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      await api.post("/integracoes/microsoft/sync-now");
      setMsg({ text: "Sincronização iniciada.", ok: true });
      setTimeout(load, 2000);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível sincronizar agora.", ok: false });
    } finally { setBusy(null); }
  };

  const disconnect = async () => {
    if (!confirm("Desconectar a conta Microsoft? Os compromissos futuros importados do Outlook serão removidos da agenda (o histórico é mantido).")) return;
    setBusy("disconnect");
    try {
      await api.post("/integracoes/microsoft/disconnect", {});
      setMsg({ text: "Conta desconectada.", ok: true });
      await load();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Falha ao desconectar.", ok: false });
    } finally { setBusy(null); }
  };

  const togglePush = async (enabled: boolean) => {
    setBusy("push");
    try {
      const { data } = await api.patch<Status>("/integracoes/microsoft/push", { enabled });
      setStatus(s => s ? { ...s, pushEnabled: data.pushEnabled } : s);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível alterar a opção.", ok: false });
    } finally { setBusy(null); }
  };

  if (loading) {
    return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando integração…</div>;
  }

  // Administrador ainda não configurou o App Registration.
  if (status && status.configured === false) {
    return (
      <div style={{ maxWidth: 620 }}>
        <Header />
        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-subtle, rgba(255,255,255,0.02))", display: "flex", gap: 12 }}>
          <AlertTriangle size={18} style={{ color: "var(--accent-amber, #f59e0b)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            A integração com o Microsoft 365 ainda não foi configurada pelo administrador do sistema.
            Assim que o registro de aplicativo no Microsoft Entra estiver pronto, o botão de conexão aparecerá aqui.
          </div>
        </div>
      </div>
    );
  }

  const st = status?.status || "DISCONNECTED";
  const meta = STATUS_META[st] || STATUS_META.DISCONNECTED;
  const Icon = meta.icon;
  const isConnected = !!status?.connected && st !== "DISCONNECTED";

  return (
    <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 16 }}>
      <Header />

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${msg.ok ? "var(--accent-green)" : "var(--accent-red)"}`, color: msg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
          {msg.text}
        </div>
      )}

      {/* Cartão de status */}
      <div style={{ padding: 18, borderRadius: 12, border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#0078d41a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={20} style={{ color: "#0078d4" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>Microsoft Outlook</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {isConnected ? (status?.account || "conta conectada") : "Nenhuma conta conectada"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: meta.color, fontSize: 12, fontWeight: 600 }}>
            <Icon size={15} style={st === "SYNCING" ? { animation: "spin 1s linear infinite" } : undefined} />
            {meta.label}
          </div>
        </div>

        {isConnected && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Última sincronização: <strong style={{ color: "var(--text-primary, inherit)" }}>{fmtDateTime(status?.lastSyncAt)}</strong>
            </span>
            {status?.calendarName && <span>Calendário: <strong>{status.calendarName}</strong></span>}
          </div>
        )}

        {status?.error && (
          <div style={{ fontSize: 12, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={13} /> {status.error}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {!isConnected || st === "REAUTH_REQUIRED" ? (
            <button className="btn btn-primary" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }} disabled={busy === "connect"} onClick={connect}>
              <Link2 size={15} /> {st === "REAUTH_REQUIRED" ? "Reconectar Microsoft 365" : "Conectar Microsoft 365"}
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7 }} disabled={busy === "sync"} onClick={syncNow}>
                <RefreshCw size={15} style={busy === "sync" ? { animation: "spin 1s linear infinite" } : undefined} /> Sincronizar agora
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7, color: "var(--accent-red)" }} disabled={busy === "disconnect"} onClick={disconnect}>
                <Unlink size={15} /> Desconectar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Opção de envio: sistema → Outlook */}
      {isConnected && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", color: "var(--text-muted)" }}>
          <input type="checkbox" checked={!!status?.pushEnabled} disabled={busy === "push"} onChange={e => togglePush(e.target.checked)} />
          Enviar para o Outlook os compromissos que eu criar aqui
        </label>
      )}

      {status && status.webhookViable === false && isConnected && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Observação: as alterações do Outlook chegam por sincronização periódica (o servidor não expõe uma URL pública HTTPS para notificações em tempo real).
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-display)", margin: 0 }}>Microsoft 365 / Outlook</h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.6 }}>
        Conecte seu calendário do Outlook para que seus compromissos apareçam na agenda do {MARCA} e sejam considerados na sua disponibilidade.
      </p>
    </div>
  );
}
