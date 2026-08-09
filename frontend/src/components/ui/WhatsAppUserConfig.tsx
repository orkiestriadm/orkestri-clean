"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

export default function WhatsAppUserConfig() {
  const [numero,     setNumero]     = useState("");

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [testando,   setTestando]   = useState(false);
  const [msg,        setMsg]        = useState<{text:string;ok:boolean}|null>(null);
  const [orgStatus,  setOrgStatus]  = useState<{connected:boolean;status:string}|null>(null);

  // ── Verificação do número ──────────────────────────────────────────────────
  // Sem esta etapa o número era digitado e usado direto: um dígito errado
  // mandava alerta interno da empresa para um desconhecido, sem ninguém
  // descobrir (não há retorno de entrega no WhatsApp).
  //
  // Importa que exista NA TELA: o despachante recusa enviar para número não
  // verificado, então sem este fluxo ninguém consegue sair do estado inicial e
  // o canal fica inutilizável.
  const [verificado,  setVerificado]  = useState(false);
  const [numeroSalvo, setNumeroSalvo] = useState("");
  const [codigo,      setCodigo]      = useState("");
  const [enviandoCod, setEnviandoCod] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [aguardaCod,  setAguardaCod]  = useState(false);
  /** Módulos que o master liberou para esta pessoa — leitura, não edição. */
  const [meusModulos, setMeusModulos] = useState<any[]>([]);

  const carregar = () => Promise.all([
    api.get("/users/me/whatsapp"),
    api.get("/users/me/whatsapp/org-status"),
    api.get("/notificacoes/preferencias/me").catch(() => ({ data: {} as any })),
  ]).then(([r, s, p]) => {
    setNumero(r.data.whatsapp || "");
    setNumeroSalvo(r.data.whatsapp || "");

    setOrgStatus(s.data);
    setVerificado(!!p.data?.whatsappVerificado);
    const cat = new Map((p.data?.modulos || []).map((m: any) => [m.id, m.label]));
    setMeusModulos((p.data?.preferencias || []).map((x: any) => ({ ...x, label: cat.get(x.modulo) || x.modulo })));
  }).catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => { carregar(); }, []);

  // Mexer no número invalida a verificação anterior — o backend faz o mesmo ao
  // gravar. Refletir aqui evita a tela dizer "verificado" para outro número.
  const numeroMudou = numero !== numeroSalvo;
  const estaVerificado = verificado && !numeroMudou;

  const enviarCodigo = async () => {
    if (!numero) { setMsg({ text: "Informe o número primeiro.", ok: false }); return; }
    setEnviandoCod(true);
    try {
      await api.post("/notificacoes/preferencias/verificar/enviar", { whatsapp: numero });
      setAguardaCod(true);
      setMsg({ text: "Código enviado no seu WhatsApp. Ele expira em 10 minutos.", ok: true });
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Não foi possível enviar o código.", ok: false });
    } finally { setEnviandoCod(false); setTimeout(() => setMsg(null), 6000); }
  };

  const confirmarCodigo = async () => {
    setConfirmando(true);
    try {
      await api.post("/notificacoes/preferencias/verificar/confirmar", { codigo });
      setAguardaCod(false); setCodigo("");
      setMsg({ text: "Número verificado! Agora você pode receber mensagens.", ok: true });
      await carregar();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Código incorreto.", ok: false });
    } finally { setConfirmando(false); setTimeout(() => setMsg(null), 6000); }
  };

  const save = async () => {
    setSaving(true);
    try {
      // Só o número é salvo aqui. `whatsappAlertas` era o interruptor global e
      // deixou de ser consultado no envio quando a permissão passou a ser por
      // módulo — continuar gravando manteria um campo morto parecendo vivo.
      await api.patch("/users/me/whatsapp", { whatsapp: numero });
      setMsg({ text:"Configurações salvas com sucesso!", ok:true });
    } catch { setMsg({ text:"Erro ao salvar.", ok:false }); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 3000); }
  };

  const testar = async () => {
    if (!numero) { setMsg({ text:"Informe o número antes de testar.", ok:false }); return; }
    setTestando(true);
    try {
      await api.post("/users/me/whatsapp/teste");
      setMsg({ text:"Mensagem de teste enviada! Verifique seu WhatsApp.", ok:true });
    } catch { setMsg({ text:"Erro ao enviar. Verifique se o WhatsApp está conectado no sistema.", ok:false }); }
    finally { setTestando(false); setTimeout(() => setMsg(null), 5000); }
  };

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:32 }}><Spin/></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, width:"100%" }}>
      <div className="card" style={{ padding:"20px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, paddingBottom:12, borderBottom:"1px solid var(--border-subtle)" }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="1.5"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Notificações via WhatsApp</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Chamados, eventos, projetos e alertas no seu WhatsApp</div>
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
                — As mensagens ficam na fila até o administrador conectar o aparelho.
              </span>
            )}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>SEU NÚMERO DE WHATSAPP</label>
            <input className="input-o" placeholder="5511999999999" value={numero}
              onChange={e => setNumero(e.target.value.replace(/\D/g, ""))}
              style={{ fontFamily:"var(--font-mono)", fontSize:15, letterSpacing:"0.05em" }}
            />
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:5, lineHeight:1.6 }}>
              Formato: código do país (55) + DDD + número, sem espaços.<br/>
              Exemplo: <span style={{ fontFamily:"var(--font-mono)", color:"var(--accent-violet)" }}>5511987654321</span>
            </p>

            {/* Estado da verificação — sem ela nenhuma mensagem é entregue */}
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600,
                color: estaVerificado ? "var(--accent-green)" : "var(--accent-amber)" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"currentColor" }} />
                {estaVerificado ? "Número verificado" : "Número não verificado"}
              </span>
              {!estaVerificado && (
                <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={enviarCodigo} disabled={enviandoCod || !numero}>
                  {enviandoCod ? <Spin/> : (aguardaCod ? "Reenviar código" : "Verificar número")}
                </button>
              )}
            </div>

            {!estaVerificado && (
              <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:6, lineHeight:1.6 }}>
                Enquanto o número não for confirmado, as mensagens ficam retidas. É o que impede
                um dígito errado enviar aviso interno da empresa para um desconhecido.
              </p>
            )}

            {aguardaCod && !estaVerificado && (
              <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center" }}>
                <input
                  className="input-o" inputMode="numeric" maxLength={6} placeholder="000000"
                  value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ""))}
                  style={{ fontFamily:"var(--font-mono)", fontSize:16, letterSpacing:"0.3em", maxWidth:140, textAlign:"center" }}
                />
                <button className="btn btn-violet" style={{ fontSize:12 }} onClick={confirmarCodigo} disabled={confirmando || codigo.length !== 6}>
                  {confirmando ? <Spin/> : "Confirmar"}
                </button>
              </div>
            )}
          </div>

          {/* O que a pessoa recebe — definido pelo MASTER, aqui só se lê.
              Antes havia um interruptor global e uma lista fixa de quatro itens.
              Os dois passaram a mentir quando a permissão virou por módulo: o
              interruptor deixou de ser consultado no envio (o despachante olha
              a preferência e o número verificado) e a lista mostrava coisas que
              a pessoa podia nem ter direito de receber. */}
          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:10 }}>
              O QUE VOCÊ RECEBE
            </div>

            {meusModulos.length === 0 ? (
              <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.6, margin:0 }}>
                Você ainda não recebe notificação de nenhum módulo.<br/>
                Quem define isso é o administrador, em <strong>Permissões de mensagem</strong>.
              </p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {meusModulos.map(m => (
                  <div key={m.modulo} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent-green)", flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, minWidth:150 }}>{m.label}</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>
                      {[m.sistema && "sistema", m.whatsapp && "WhatsApp", m.email && "e-mail"].filter(Boolean).join(" · ")}
                      {m.severidadeMin !== "info" && ` · ${m.severidadeMin === "critico" ? "só críticos" : "avisos e críticos"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize:10.5, color:"var(--text-faint)", marginTop:10, marginBottom:0, lineHeight:1.6 }}>
              Definido pelo administrador. Para mudar, fale com ele.
            </p>
          </div>

          {msg && (
            <div style={{ padding:"10px 14px", borderRadius:8, fontSize:13,
              background: msg.ok ? "rgba(52,211,153,0.08)" : "rgba(220,38,38,0.08)",
              border: `1px solid ${msg.ok ? "rgba(52,211,153,0.25)" : "rgba(220,38,38,0.25)"}`,
              color: msg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
              {msg.text}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={testar} disabled={testando || !numero}>
              {testando ? <Spin/> : "Testar envio"}
            </button>
            <button className="btn btn-violet" style={{ flex:2 }} onClick={save} disabled={saving}>
              {saving ? <Spin/> : "Salvar número"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}