"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  X,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from "lucide-react";

type GoogleStatus = {
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
  provider: "google";
  scope: "org" | "platform";
  exists: boolean;
  enabled: boolean;
  clientId: string;
  redirectUri: string;
  webhookUrl: string;
  secretConfigured: boolean;
  redirectUriParaRegistrar: string;
  webhookUrlParaRegistrar: string;
  effectiveSource: "org" | "platform" | "env" | "none";
  effectiveConfigured: boolean;
  vaultReady: boolean;
};

export function GoogleCalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="10" fill="#ffffff" fillOpacity="0.08" />
      <path d="M35 12h-2v-4h-4v4H19v-4h-4v4h-2a4 4 0 00-4 4v20a4 4 0 004 4h22a4 4 0 004-4V16a4 4 0 00-4-4z" fill="#4285F4" />
      <path d="M13 20h22v16a2 2 0 01-2 2H15a2 2 0 01-2-2V20z" fill="#ffffff" />
      <path d="M21 27h6v6h-6z" fill="#EA4335" />
      <path d="M27 27h4v6h-4z" fill="#FBBC05" />
      <path d="M17 27h4v6h-4z" fill="#34A853" />
    </svg>
  );
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function GoogleCalendarModal({
  open,
  onClose,
  onSyncComplete,
}: {
  open: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}) {
  const { user } = useAuthStore();
  const isAdmin = !!(user?.isMaster || user?.isSuperAdmin || user?.permissions?.includes("integracoes:configurar"));

  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Preferências antes de conectar
  const [pushEnabled, setPushEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(true);

  // Configuração avançada (Admin / BYO Credentials)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cfg, setCfg] = useState<ConfigDto | null>(null);
  const [form, setForm] = useState({ clientId: "", clientSecret: "", redirectUri: "" });
  const [copied, setCopied] = useState(false);

  // Confirmação de desconexão
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [purgeAll, setPurgeAll] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get<GoogleStatus>("/integracoes/google/status");
      setStatus(data);
      if (data.pushEnabled !== undefined) setPushEnabled(data.pushEnabled);
      if (data.syncEnabled !== undefined) setSyncEnabled(data.syncEnabled);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get<ConfigDto>("/integracoes/google/config");
      setCfg(data);
      setForm({
        clientId: data.clientId || "",
        clientSecret: "",
        redirectUri: data.redirectUri || data.redirectUriParaRegistrar || "",
      });
    } catch {
      setCfg(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (open) {
      setMsg(null);
      setConfirmDisconnect(false);
      loadStatus();
      loadConfig();
    }
  }, [open, loadStatus, loadConfig]);

  if (!open) return null;

  const handleConnect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const returnTo = window.location.pathname;
      const { data } = await api.get<{ url: string }>(`/integracoes/google/connect?returnTo=${encodeURIComponent(returnTo)}`);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setMsg({
        text: e?.response?.data?.message || "Não foi possível iniciar o login do Google. Verifique se as credenciais estão cadastradas.",
        ok: false,
      });
      setBusy(null);
    }
  };

  const handleSyncNow = async () => {
    setBusy("sync");
    setMsg(null);
    try {
      const { data } = await api.post("/integracoes/google/sync-now");
      await loadStatus();
      setMsg({
        text: `Sincronização concluída: ${data.imported || 0} importados, ${data.updated || 0} atualizados.`,
        ok: true,
      });
      onSyncComplete?.();
    } catch (e: any) {
      setMsg({
        text: e?.response?.data?.message || "Erro ao sincronizar. Tente novamente.",
        ok: false,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleTogglePush = async (checked: boolean) => {
    setPushEnabled(checked);
    if (!status?.connected) return;
    try {
      await api.patch("/integracoes/google/toggle-push", { enabled: checked });
      await loadStatus();
    } catch {}
  };

  const handleToggleSync = async (checked: boolean) => {
    setSyncEnabled(checked);
    if (!status?.connected) return;
    try {
      await api.patch("/integracoes/google/toggle-sync", { enabled: checked });
      await loadStatus();
    } catch {}
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await api.post("/integracoes/google/disconnect", { purgeAll });
      await loadStatus();
      setConfirmDisconnect(false);
      setMsg({ text: "Conta Google desconectada com sucesso.", ok: true });
      onSyncComplete?.();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Erro ao desconectar.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId.trim()) {
      setMsg({ text: "Client ID é obrigatório.", ok: false });
      return;
    }
    setBusy("save_cfg");
    try {
      await api.put("/integracoes/google/config", {
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret.trim() || undefined,
        redirectUri: form.redirectUri.trim() || undefined,
      });
      await loadConfig();
      await loadStatus();
      setMsg({ text: "Credenciais do Google salvas com sucesso!", ok: true });
      setShowAdvanced(false);
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Erro ao salvar credenciais.", ok: false });
    } finally {
      setBusy(null);
    }
  };

  const copyRedirectUri = () => {
    const text = cfg?.redirectUriParaRegistrar || `${window.location.origin}/api/integracoes/google/callback`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 350,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--modal-bg, #14171f)",
          border: "1px solid var(--border-medium, rgba(255,255,255,0.12))",
          borderRadius: 20,
          boxShadow: "0 28px 70px rgba(0,0,0,0.6)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Topo do Modal */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GoogleCalendarIcon size={28} />
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary, #fff)",
                  fontFamily: "var(--font-display, inherit)",
                }}
              >
                Integração Google Agenda
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>
                Sincronize a Space e a Aurélia com o Google Calendar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: 32, height: 32, borderRadius: 8 }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          {msg && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: msg.ok ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${msg.ok ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: msg.ok ? "#4ade80" : "#f87171",
              }}
            >
              {msg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{msg.text}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
              <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13 }}>Verificando conexão com o Google...</p>
            </div>
          ) : status?.connected ? (
            /* ── ESTADO: CONECTADO ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "rgba(66, 133, 244, 0.08)",
                  border: "1px solid rgba(66, 133, 244, 0.25)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#22c55e",
                        boxShadow: "0 0 8px #22c55e",
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                      {status.status === "SYNCING" ? "Sincronizando..." : "Conectado e Sincronizado"}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-mono, monospace)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Google Calendar
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>
                  <div>
                    <strong>Conta:</strong> {status.account || "Conta conectada"}
                  </div>
                  <div>
                    <strong>Calendário:</strong> {status.calendarName || "Principal"}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted, #94a3b8)" }}>
                    Última sincronização: {fmtDateTime(status.lastSyncAt)}
                  </div>
                </div>
              </div>

              {/* Opções de sincronização */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary, #fff)" }}>
                  Opções de Sincronização
                </span>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => handleTogglePush(e.target.checked)}
                    style={{ accentColor: "#4285F4", width: 16, height: 16 }}
                  />
                  <span>Enviar compromissos do Orkiestri/WhatsApp para o Google Agenda</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={syncEnabled}
                    onChange={(e) => handleToggleSync(e.target.checked)}
                    style={{ accentColor: "#4285F4", width: 16, height: 16 }}
                  />
                  <span>Importar reuniões do Google Agenda para a Space</span>
                </label>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={busy === "sync"}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    height: 42,
                    fontSize: 13,
                    background: "#4285F4",
                    borderColor: "#3b82f6",
                  }}
                >
                  <RefreshCw size={14} className={busy === "sync" ? "animate-spin" : ""} />
                  {busy === "sync" ? "Sincronizando..." : "Sincronizar Agora"}
                </button>

                {!confirmDisconnect ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(true)}
                    className="btn btn-ghost"
                    style={{
                      height: 42,
                      fontSize: 13,
                      color: "var(--text-muted, #94a3b8)",
                      border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
                    }}
                  >
                    <Unlink size={14} />
                    Desconectar
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={busy === "disconnect"}
                      className="btn"
                      style={{
                        height: 42,
                        fontSize: 12,
                        background: "#ef4444",
                        color: "#fff",
                        borderColor: "#dc2626",
                      }}
                    >
                      {busy === "disconnect" ? "Saindo..." : "Confirmar saída"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(false)}
                      className="btn btn-ghost"
                      style={{ height: 42, fontSize: 12 }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              {confirmDisconnect && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "#fca5a5",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={purgeAll}
                      onChange={(e) => setPurgeAll(e.target.checked)}
                      style={{ accentColor: "#ef4444" }}
                    />
                    <span>Apagar também os eventos já importados do Google no passado</span>
                  </label>
                </div>
              )}
            </div>
          ) : (
            /* ── ESTADO: NÃO CONECTADO ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                  borderRadius: 16,
                  padding: "18px 20px",
                }}
              >
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary, #e2e8f0)" }}>
                  Conecte sua conta do Google para espelhar sua rotina com o Orkiestri:
                </p>
                <ul
                  style={{
                    margin: "12px 0 0",
                    paddingLeft: 20,
                    fontSize: 13,
                    color: "var(--text-muted, #94a3b8)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <li>
                    O que você marcar pelo <strong>WhatsApp com a Aurélia</strong> vai direto para seu Google Calendar.
                  </li>
                  <li>
                    Reuniões e convites do <strong>Google Meet</strong> aparecem aqui no seu painel.
                  </li>
                  <li>Sua disponibilidade de horários fica sempre atualizada automaticamente.</li>
                </ul>
              </div>

              {/* Preferências de sincronização iniciais */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary, #fff)" }}>
                  Como você quer sincronizar:
                </span>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={pushEnabled}
                    onChange={(e) => handleTogglePush(e.target.checked)}
                    style={{ accentColor: "#4285F4", width: 16, height: 16 }}
                  />
                  <span>Enviar compromissos do Orkiestri/WhatsApp para o Google Agenda</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={syncEnabled}
                    onChange={(e) => handleToggleSync(e.target.checked)}
                    style={{ accentColor: "#4285F4", width: 16, height: 16 }}
                  />
                  <span>Importar reuniões do Google Agenda para a Space</span>
                </label>
              </div>

              {/* Botão de Conexão 1 clique */}
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy === "connect"}
                className="btn btn-primary"
                style={{
                  height: 48,
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  background: "#4285F4",
                  borderColor: "#3b82f6",
                  boxShadow: "0 4px 14px rgba(66, 133, 244, 0.35)",
                }}
              >
                <GoogleCalendarIcon size={20} />
                {busy === "connect" ? "Iniciando conexão..." : "Continuar com o Google"}
                <ArrowRight size={16} />
              </button>

              {/* Accordion Configuração Própria / Avançado */}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                  paddingTop: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: "var(--text-muted, #94a3b8)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Settings size={14} />
                    Usar credenciais próprias da empresa (Google Cloud)
                  </span>
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showAdvanced && (
                  <form onSubmit={handleSaveConfig} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        CLIENT ID (Google Cloud Console)
                      </label>
                      <input
                        className="input-o"
                        placeholder="Ex: 123456789-xxx.apps.googleusercontent.com"
                        value={form.clientId}
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                        style={{ width: "100%", height: 38, fontSize: 12 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        CLIENT SECRET {cfg?.secretConfigured ? "(Já configurado — deixe em branco para manter)" : ""}
                      </label>
                      <input
                        type="password"
                        className="input-o"
                        placeholder={cfg?.secretConfigured ? "••••••••••••••••" : "Cole o segredo do cliente"}
                        value={form.clientSecret}
                        onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                        style={{ width: "100%", height: 38, fontSize: 12 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                        URI DE REDIRECIONAMENTO (Cadastre no Google Cloud)
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          readOnly
                          className="input-o"
                          value={cfg?.redirectUriParaRegistrar || (typeof window !== "undefined" ? `${window.location.origin}/api/integracoes/google/callback` : "")}
                          style={{ flex: 1, height: 38, fontSize: 11, background: "rgba(255,255,255,0.02)" }}
                        />
                        <button
                          type="button"
                          onClick={copyRedirectUri}
                          className="btn btn-ghost"
                          style={{ height: 38, padding: "0 12px", border: "1px solid var(--border-subtle)" }}
                          title="Copiar URI"
                        >
                          {copied ? <Check size={14} style={{ color: "#4ade80" }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <button
                        type="submit"
                        disabled={busy === "save_cfg"}
                        className="btn btn-violet"
                        style={{ height: 36, fontSize: 12 }}
                      >
                        {busy === "save_cfg" ? "Salvando..." : "Salvar Credenciais"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com dicas de segurança */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            background: "rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--text-muted, #94a3b8)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={14} style={{ color: "var(--accent-green, #22c55e)" }} />
            <span>Tokens protegidos com criptografia AES-256 no cofre</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ height: 28, fontSize: 11, padding: "0 10px" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

