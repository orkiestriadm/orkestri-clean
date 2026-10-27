"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { PageBody, PageHeader, Panel } from "@/components/data-ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type Recibo = { id: string; estado: string; contexto: string; tentativas: number; criado_em: string; pode_reprocessar: boolean };
const data = (v?: string) => v ? new Date(v).toLocaleString("pt-BR") : "—";

export default function WhatsAppOperacao() {
  const user = useAuthStore(s => s.user);
  const [painel,setPainel] = useState<any>(null), [metricas,setMetricas] = useState<any>(null);
  const [erro,setErro] = useState(""), [busy,setBusy] = useState(false), [plataforma,setPlataforma] = useState(false);
  const [revisao,setRevisao] = useState<Recibo|null>(null), [motivo,setMotivo] = useState("");
  const carregar = useCallback(async () => {
    setBusy(true); setErro("");
    try {
      const [p,m] = await Promise.all([api.get("/whatsapp-operacao"),api.get("/whatsapp-operacao/metricas",{params:{escopo:plataforma?"plataforma":"usuario"}})]);
      setPainel(p.data); setMetricas(m.data);
    } catch { setErro("Não foi possível atualizar os dados. Tente novamente."); }
    finally { setBusy(false); }
  },[plataforma]);
  useEffect(()=>{carregar();},[carregar]);
  async function revisar(acao: string) {
    if (!revisao || motivo.trim().length<12 || busy) return;
    setBusy(true); setErro("");
    try {
      const res = await api.post(`/whatsapp-operacao/${revisao.id}/revisao`,{acao,motivo:motivo.trim()});
      setRevisao(null); setMotivo(""); await carregar();
      if (res.data.estado==="REVISAR") setErro("A tentativa continua em revisão. Confira os registros antes de uma nova ação.");
    } catch(e:any) { setErro(e.response?.data?.message || "Não foi possível registrar a revisão."); }
    finally { setBusy(false); }
  }
  return <><Topbar/><div className="page-content"><PageBody>
    <PageHeader icon={<MessageCircle size={22}/>} title="Operação do WhatsApp" subtitle={painel?.escopo || "Recibos, filas e atividade"} actions={<button className="btn btn-violet" disabled={busy} onClick={carregar}>{busy?"Atualizando…":"Atualizar"}</button>}/>
    <p><Link href="/dashboard/whatsapp-config">Configuração do WhatsApp</Link></p>
    {erro && <p role="alert" style={{color:"var(--accent-red)"}}>{erro}</p>}
    {user?.isSuperAdmin && <label><input type="checkbox" checked={plataforma} onChange={e=>setPlataforma(e.target.checked)}/> Métricas agregadas da plataforma</label>}
    <Panel title="Atividade e ativação">
      {metricas ? <>
        <p>Escopo: {metricas.escopo}. Coleta observada desde {data(metricas.inicio)}.</p>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",margin:"16px 0"}}>
          {[["Cadastros",metricas.cadastros],["Usuários ativos",metricas.usuarios],["Usuários com ação útil",metricas.usuarios_ativados],["Ações úteis",metricas.acoes_uteis],["Mensagens",metricas.mensagens]].map(([label,value])=><div key={String(label)}><strong style={{fontSize:24}}>{value}</strong><div>{label}</div></div>)}
        </div>
        <p>{metricas.definicoes.ativacao}</p><p>{metricas.definicoes.retorno}</p><p>{metricas.definicoes.historico}</p>
        <div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Semana do cadastro</th><th>Cadastros</th><th>Ativados</th><th>Elegíveis ao retorno</th><th>Retorno na semana 1</th></tr></thead><tbody>
          {metricas.coortes.map((c:any)=><tr key={c.semana}><td>{new Date(c.semana).toLocaleDateString("pt-BR",{timeZone:"UTC"})}</td><td>{c.cadastros}</td><td>{c.ativados}</td><td>{c.elegiveis_retorno}</td><td>{c.elegiveis_retorno?`${c.retornaram_semana_1} (${Math.round(100*c.retornaram_semana_1/c.elegiveis_retorno)}%)`:"Aguardando 14 dias"}</td></tr>)}
        </tbody></table></div>
        {!metricas.coortes.length && <p>Ainda não há cadastros instrumentados neste escopo.</p>}
      </> : <p>Carregando métricas…</p>}
    </Panel>
    <Panel title="Recibos recentes">
      <p>Processado indica que o comando terminou. Não comprova entrega ou leitura no WhatsApp. Resolvido encerra a revisão sem repetir a mensagem.</p>
      <div style={{overflowX:"auto"}}><table className="data-table"><thead><tr><th>Recebido</th><th>Contexto</th><th>Estado</th><th>Tentativas</th><th>Ação</th></tr></thead><tbody>
        {painel?.recibos.map((r:Recibo)=><tr key={r.id}><td>{data(r.criado_em)}</td><td>{r.contexto||"Anterior à instrumentação"}</td><td>{r.estado}</td><td>{r.tentativas}</td><td>{r.estado==="REVISAR" && <button className="btn" onClick={()=>{setRevisao(r);setMotivo("");}}>Revisar</button>}</td></tr>)}
      </tbody></table></div>
      {painel && !painel.recibos.length && <p>Nenhum recibo disponível neste escopo.</p>}
    </Panel>
    {revisao && <Panel title="Revisão do recibo">
      <p>{revisao.pode_reprocessar?"Nenhuma gravação de negócio foi iniciada. A identidade e o contexto serão verificados novamente antes da tentativa.":"Pode haver efeitos parciais. Confira o módulo de origem antes de resolver. A repetição está bloqueada."}</p>
      <label htmlFor="motivo-revisao">Motivo e verificação realizada (12 a 500 caracteres)</label>
      <textarea id="motivo-revisao" value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={500} rows={3} style={{display:"block",width:"100%",margin:"12px 0"}}/>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <button className="btn" disabled={busy||motivo.trim().length<12} onClick={()=>revisar("RESOLVER")}>Resolver sem repetir</button>
        {revisao.pode_reprocessar && <button className="btn btn-violet" disabled={busy||motivo.trim().length<12} onClick={()=>revisar("REPROCESSAR")}>Reprocessar com segurança</button>}
        <button className="btn" disabled={busy} onClick={()=>setRevisao(null)}>Cancelar</button>
      </div>
    </Panel>}
    <Panel title="Suas filas de envio">
      <p>Boas-vindas: {painel?.boasVindas.length?painel.boasVindas.map((b:any)=>`${b.estado} · ${b.tentativas} tentativa(s)`).join(", "):"nenhum envio pendente"}.</p>
      <p>Resumos diários recentes: {painel?.resumo.length?painel.resumo.map((r:any)=>`${new Date(r.dia).toLocaleDateString("pt-BR",{timeZone:"UTC"})}: ${r.estado}`).join(" · "):"nenhum envio registrado"}.</p>
      <p>Aceita significa que o provedor aceitou a solicitação; não comprova leitura.</p>
    </Panel>
  </PageBody></div></>;
}
