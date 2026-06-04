"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

export default function WhatsAppUserConfig() {
  const [numero,     setNumero]     = useState("");
  const [ativo,      setAtivo]      = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testando,   setTestando]   = useState(false);
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);
  const [orgStatus,  setOrgStatus]  = useState<{connected:boolean;status:string}|null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/users/me/whatsapp"),
      api.get("/users/me/whatsapp/org-status"),
    ]).then(([r, s]) => {
      setNumero(r.data.whatsapp || "");
      setAtivo(r.data.whatsappAlertas || false);
      setOrgStatus(s.data);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me/whatsapp", { whatsapp: numero, whatsappAlertas: ativo });
      setMsg({ text:"Configuracoes salvas com sucesso!", ok:true });
    } catch { setMsg({ text:"Erro ao salvar.", ok:false }); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  };

  const testar = async () => {
    if (!numero) { setMsg({ text:"Informe o numero antes de testar.", ok:false }); return; }
    setTestando(true);
    try {
      await api.post("/users/me/whatsapp/teste");
      setMsg({ text:"Mensagem de teste enviada! Verifique seu WhatsApp.", ok:true });
    } catch { setMsg({ text:"Erro ao enviar. Verifique se o WhatsApp esta conectado no sistema.", ok:false }); }
    finally { setTestando(false); setTimeout(() => setMsg(null), 5000); }
  };

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spin/></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:560 }}>
      <div className="card" style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Notificacoes via WhatsApp</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Receba chamados, eventos, projetos e alertas no seu WhatsApp</div>
          </div>
        </div>

        {/* Status da instância da organização */}
        {orgStatus && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:8, marginBottom:14,
            background: orgStatus.connected ? "rgba(52,211,153,0.06)" : "rgba(220,38,38,0.06)",
            border: `1px solid ${orgStatus.connected ? "rgba(52,211,153,0.2)" : "rgba(220,38,38,0.2)"}` }}>
            <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
              background: orgStatus.connected ? "var(--accent-green)" : "var(--accent-red)" }} />
            <span style={{ fontSize:12, color: orgStatus.connected ? "var(--accent-green)" : "var(--accent-red)", fontWeight:500 }}>
              WhatsApp da organização: {orgStatus.connected ? "Conectado" : "Desconectado"}
            </span>
            {!orgStatus.connected && (
              <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:4 }}>
                — As notificacoes nao serao enviadas ate que o administrador conecte a instancia.
              </span>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>SEU NUMERO DE WHATSAPP</label>
            <input className="input-o" placeholder="5511999999999" value={numero}
              onChange={e => setNumero(e.target.value.replace(/\D/g, ""))}
              style={{ fontFamily:"var(--font-mono)", fontSize:15, letterSpacing:"0.05em" }}
            />
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:5, lineHeight:1.6 }}>
              Formato: codigo do pais (55) + DDD + numero, sem espacos.<br/>
              Exemplo: <span style={{ fontFamily:"var(--font-mono)", color:"var(--accent-violet)" }}>5511987654321</span>
            </p>
          </div>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderRadius:10, background:"var(--bg-hover)", border:"1px solid var(--border-subtle)" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>Receber notificacoes via WhatsApp</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Chamados, eventos, projetos e alertas de SLA</div>
            </div>
            <div onClick={() => setAtivo(a => !a)} style={{ width:40, height:22, borderRadius:11, background:ativo?"var(--accent-green)":"var(--border-medium)", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
              <div style={{ position:"absolute", width:18, height:18, borderRadius:"50%", background:"white", top:2, left:ativo?20:2, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
            </div>
          </div>

          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:10 }}>NOTIFICACOES QUE VOCE RECEBERA</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { tempo:"Chamados",      desc:"Abertura, atribuicao e resolucao",  color:"var(--accent-violet)" },
                { tempo:"Eventos",       desc:"60 min, 15 min, 5 min e na hora",   color:"var(--accent-green)"  },
                { tempo:"SLA",           desc:"Alertas de risco e violacao",        color:"var(--accent-amber)"  },
                { tempo:"Workflows",     desc:"Aprovacoes pendentes",               color:"var(--accent-red)"    },
              ].map((a, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:ativo?a.color:"var(--border-medium)", flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:500, color:ativo?"var(--text-primary)":"var(--text-muted)", minWidth:100 }}>{a.tempo}</span>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{a.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {msg && (
            <div style={{ padding:"10px 14px", borderRadius:8, background:msg.ok?"rgba(52,211,153,0.08)":"rgba(220,38,38,0.08)", border:"1px solid", borderColor:msg.ok?"rgba(52,211,153,0.25)":"rgba(220,38,38,0.25)", color:msg.ok?"var(--accent-green)":"var(--accent-red)", fontSize:13 }}>
              {msg.text}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={testar} disabled={testando || !numero}>
              {testando ? <Spin/> : "Testar envio"}
            </button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={saving}>
              {saving ? <Spin/> : "Salvar configuracoes"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}