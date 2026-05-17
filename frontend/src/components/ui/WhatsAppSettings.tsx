"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import AlertConfigPage from "./AlertConfigPage";

export default function WhatsAppSettings({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!user?.isMaster) return;
    try {
      const { data } = await api.get("/notifications/whatsapp/status");
      setWaStatus(data);
      if (data.connected) { setQrData(null); setPolling(false); }
    } catch {}
  }, [user]);

  useEffect(() => {
    api.get("/notifications/profile/whatsapp")
      .then(r => { setPhone(r.data.whatsapp || ""); setEnabled(r.data.whatsappAlertas || false); })
      .catch(() => {});
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(loadStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, loadStatus]);

  const connectWa = async () => {
    setConnecting(true); setQrData(null);
    try {
      await api.post("/notifications/whatsapp/connect");
      await new Promise(r => setTimeout(r, 2000));
      const { data } = await api.get("/notifications/whatsapp/qrcode");
      let qr = null;
      if (data?.qrcode?.base64) qr = data.qrcode.base64;
      else if (data?.base64) qr = data.base64;
      else if (data?.code) { setQrData("text:" + data.code); setPolling(true); setConnecting(false); return; }
      if (qr) { setQrData("base64:" + qr.replace(/^data:image\/[a-z]+;base64,/, "")); setPolling(true); }
    } catch {}
    setConnecting(false);
  };

  const disconnect = async () => { await api.post("/notifications/whatsapp/disconnect"); setWaStatus({ connected: false }); setQrData(null); setPolling(false); };

  const save = async () => {
    setLoading(true);
    try { await api.post("/notifications/profile/whatsapp", { whatsapp: phone, whatsappAlertas: enabled }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch {} finally { setLoading(false); }
  };

  const renderQR = () => {
    if (!qrData) return null;
    if (qrData.startsWith("base64:")) return <img src={"data:image/png;base64," + qrData.replace("base64:", "")} alt="QR Code" style={{ width:220, height:220, borderRadius:8, border:"2px solid var(--border-medium)" }} />;
    if (qrData.startsWith("text:")) return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData.replace("text:", ""))}`} alt="QR Code" style={{ width:220, height:220, borderRadius:8, border:"2px solid var(--border-medium)" }} />;
    return null;
  };

  if (showAlertConfig) return <AlertConfigPage onClose={() => setShowAlertConfig(false)} />;

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700 }}>Alertas WhatsApp</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        {user?.isMaster && (
          <div style={{ background:"var(--bg-hover)", border:"1px solid var(--border-subtle)", borderRadius:12, padding:16, marginBottom:20 }}>
            <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:12 }}>STATUS DO SISTEMA</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:waStatus?.connected?"var(--accent-green)":"var(--accent-red)", boxShadow:"0 0 8px "+(waStatus?.connected?"var(--accent-green)":"var(--accent-red)") }} />
                <span style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>{waStatus?.connected?"Conectado":"Desconectado"}</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {user?.isMaster && (
                  <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={() => setShowAlertConfig(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                    Configurar mensagens
                  </button>
                )}
                {!waStatus?.connected && <button className="btn btn-violet" style={{ fontSize:12 }} onClick={connectWa} disabled={connecting}>{connecting ? "Aguarde..." : "Conectar"}</button>}
                {waStatus?.connected && <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={disconnect}>Desconectar</button>}
              </div>
            </div>

            {qrData && !waStatus?.connected && (
              <div style={{ textAlign:"center", marginTop:16 }}>
                <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:12 }}>WhatsApp â†' Dispositivos vinculados â†' Vincular dispositivo:</p>
                <div style={{ display:"inline-block", padding:10, background:"white", borderRadius:10 }}>{renderQR()}</div>
                <p style={{ fontSize:11, color:"var(--accent-violet)", marginTop:8, fontFamily:"var(--font-mono)" }}>Aguardando escaneamento...</p>
              </div>
            )}
            {waStatus?.connected && (
              <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:8, padding:"8px 12px" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span style={{ fontSize:12, color:"var(--accent-green)" }}>Pronto! Mensagens serao enviadas automaticamente.</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>SEU NUMERO WHATSAPP</label>
            <input className="input-o" placeholder="Ex: 11987654321" value={phone} onChange={e => setPhone(e.target.value)} />
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>Somente numeros com DDD. Ex: 11987654321</p>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding:"12px 14px", borderRadius:10, background:"var(--bg-hover)", border:"1px solid var(--border-subtle)" }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ accentColor:"var(--accent-violet)", width:16, height:16 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>Ativar alertas no WhatsApp</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>Avisos 60min, 15min e 5min antes dos eventos</div>
            </div>
          </label>
          {saved && <div style={{ textAlign:"center", color:"var(--accent-green)", fontSize:13 }}>Configuracoes salvas!</div>}
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Fechar</button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={loading}>{loading?"Salvando...":"Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}