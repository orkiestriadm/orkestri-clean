"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import WhatsAppUserConfig from "@/components/ui/WhatsAppUserConfig";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>;
}

function OrgWhatsAppPanel() {
  const [status, setStatus] = useState<{ connected: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/organizations/me/whatsapp/status");
      setStatus(r.data);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshStatus(); }, []);

  const createInstance = async () => {
    setLoading(true);
    try {
      await api.post("/organizations/me/whatsapp/create-instance");
      setMsg({ text: "Instância criada. Aguarde e clique em Ver QR Code.", ok: true });
      await refreshStatus();
    } catch { setMsg({ text: "Erro ao criar instância.", ok: false }); }
    finally { setLoading(false); setTimeout(() => setMsg(null), 5000); }
  };

  const getQrCode = async () => {
    setQrLoading(true); setQr(null);
    try {
      const r = await api.get("/organizations/me/whatsapp/qrcode");
      const b64 = r.data?.base64 || r.data?.qrcode?.base64;
      if (b64) setQr(`data:image/png;base64,${b64}`);
      else setMsg({ text: "QR Code indisponível. Tente novamente.", ok: false });
    } catch { setMsg({ text: "Erro ao buscar QR Code.", ok: false }); }
    finally { setQrLoading(false); setTimeout(() => setMsg(null), 5000); }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await api.post("/organizations/me/whatsapp/disconnect");
      setQr(null);
      await refreshStatus();
      setMsg({ text: "WhatsApp desconectado.", ok: true });
    } catch { setMsg({ text: "Erro ao desconectar.", ok: false }); }
    finally { setLoading(false); setTimeout(() => setMsg(null), 4000); }
  };

  return (
    <div className="card" style={{ padding: "20px 24px", maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>WhatsApp da Organização</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Gerencie a conexão da sua instância Evolution API</div>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 12, background: msg.ok ? "rgba(52,211,153,0.08)" : "rgba(220,38,38,0.08)", border: "1px solid", borderColor: msg.ok ? "rgba(52,211,153,0.25)" : "rgba(220,38,38,0.25)", color: msg.ok ? "var(--accent-green)" : "var(--accent-red)", fontSize: 12 }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12 }}><Spin /> Verificando status...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: status?.connected ? "var(--accent-green)" : "var(--accent-red)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{status?.connected ? "Conectado" : "Desconectado"}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Status: {status?.status || "desconhecido"}</div>
            </div>
          </div>

          {qr && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 16, background: "var(--bg-hover)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>Escaneie com o WhatsApp da empresa</div>
              <img src={qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8 }} />
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={getQrCode} disabled={qrLoading}>Atualizar QR</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!status?.connected && (
              <>
                <button className="btn btn-violet" style={{ fontSize: 11 }} onClick={createInstance}>Criar instância</button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={getQrCode} disabled={qrLoading}>{qrLoading ? <Spin /> : "Ver QR Code"}</button>
              </>
            )}
            {status?.connected && (
              <button className="btn btn-ghost" style={{ fontSize: 11, color: "var(--accent-red)" }} onClick={disconnect}>Desconectar</button>
            )}
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={refreshStatus}>Atualizar status</button>
          </div>

          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.15)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--text-primary)" }}>Como conectar:</strong><br />
            1. Clique em <em>Criar instância</em> para registrar na Evolution API<br />
            2. Clique em <em>Ver QR Code</em> e aguarde o código aparecer<br />
            3. Abra o WhatsApp no celular da empresa → Menu → Dispositivos conectados → Conectar dispositivo<br />
            4. Escaneie o QR Code exibido
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppConfigPage() {
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {user?.isMaster && <OrgWhatsAppPanel />}
          <WhatsAppUserConfig />
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
