"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  PiggyBank, Plus, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronRight, Edit2, Trash2, X,
  BarChart3, DollarSign, Target, Zap, Filter, Download, Settings,
  Building, Tag, Truck, Package, Eye, EyeOff, Search, Upload, Loader2
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Ciclo { id:string; ano:number; descricao?:string; status:string }
interface Categoria { id:string; tipo:string; codigo:string; nome:string; cor:string; icone?:string; paiId?:string; filhos?:Categoria[] }
interface CentroCusto { id:string; codigo:string; nome:string; cor:string; ativo:boolean }
interface Fornecedor { id:string; nome:string; cnpj?:string; segmento?:string; ativo:boolean }
interface ItemMes { id:string; mes:number; valorPrevisto:number; valorRealizado?:number; status:string }
interface Item {
  id:string; nome:string; descricao?:string; tipo:string; status:string;
  recorrente:boolean; periodicidade:string; observacoes?:string;
  categoria?:Categoria; centroCusto?:CentroCusto; fornecedor?:Fornecedor;
  meses:ItemMes[];
  totais:{ previsto:number; realizado:number; execucao:number };
}
interface DashboardData {
  ciclo: Ciclo;
  kpis: { totalPrevisto:number; totalRealizado:number; execucao:number; estouros:number; alertas:number; pendentesAprovacao:number };
  evolucaoMensal: { mes:number; previsto:number; realizado:number }[];
  topItens: { id:string; nome:string; tipo:string; previsto:number; realizado:number; execucao:number }[];
  alertas: { tipo:string; mensagem:string; itemId?:string }[];
  distribuicao: { categoria:string; cor:string; previsto:number; percentual:number }[];
}
interface Aprovacao { id:string; tipo:string; status:string; observacoes?:string; item?:{ id:string; nome:string; tipo:string }; solicitadoPor?:{ nome:string }; criadoEm:string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBRL = (v:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:0,maximumFractionDigits:0}).format(v);
const fmtPct = (v:number) => `${v.toFixed(1)}%`;
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const execColor = (p:number) => p >= 100 ? "text-red-400" : p >= 80 ? "text-yellow-400" : "text-emerald-400";
const execBg = (p:number) => p >= 100 ? "bg-red-500" : p >= 80 ? "bg-yellow-400" : "bg-emerald-500";

function FL({ l, req }:{ l:string; req?:boolean }) {
  return <label className="block text-[11px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">{l}{req && <span className="text-red-400 ml-0.5">*</span>}</label>;
}

function ExecBar({ pct, height="h-1.5" }:{ pct:number; height?:string }) {
  return (
    <div className={cn("w-full bg-white/5 rounded-full overflow-hidden", height)}>
      <div className={cn("h-full rounded-full transition-all duration-500", execBg(pct))} style={{width:`${Math.min(pct,100)}%`}} />
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
const CHART_COLORS = ["#8b5cf6","#06b6d4","#f59e0b","#ef4444","#10b981","#3b82f6","#ec4899","#14b8a6","#a78bfa","#f97316","#84cc16","#eab308"];
const fmtR0 = (v:number)=> "R$ "+Math.round(v||0).toLocaleString("pt-BR");

// ── Exportações da Dashboard ──────────────────────────────────────────────────
async function exportDashboardExcel(data:any, ano:string) {
  const XLSX:any = await import("xlsx");
  const k = data.kpis || {};
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Orçamento", ano],["Gerado em", new Date().toLocaleString("pt-BR")],[],
    ["Indicador","Valor"],
    ["Total Orçado", k.totalPrevisto],["Total Realizado", k.totalRealizado],
    ["Desvio (R$)", k.desvio],["Desvio (%)", k.desvioPct],
    ["Total OPEX", k.previstoOpex],["Total CAPEX", k.previstoCapex],
    ["Centros de Custo", k.qtdCentrosCusto],["Itens", k.qtdItens],
  ]), "KPIs");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mês","Orçado","Realizado"], ...(data.evolucaoMensal||[]).map((m:any)=>[m.label,m.previsto,m.realizado])]), "Evolução Mensal");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Categoria","Valor","%"], ...(data.distribuicaoCategoria||[]).map((d:any)=>[d.nome,d.valor,d.percentual])]), "Por Categoria");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Centro de Custo","Valor","%"], ...(data.distribuicaoCentroCusto||[]).map((d:any)=>[d.nome,d.valor,d.percentual])]), "Por Centro de Custo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Item","Tipo","Orçado","Realizado","% Execução"], ...(data.topItens||[]).map((i:any)=>[i.nome,i.tipo,i.previsto,i.realizado,i.execucao])]), "Maiores Gastos");
  XLSX.writeFile(wb, `orcamento_${ano}.xlsx`);
}

async function exportDashboardPdf(data:any, ano:string) {
  const { jsPDF }:any = await import("jspdf");
  await import("jspdf-autotable");
  const doc:any = new jsPDF();
  const k = data.kpis || {};
  const R = (v:number)=> "R$ "+Math.round(v||0).toLocaleString("pt-BR");
  doc.setFontSize(16); doc.text(`Orçamento ${ano} — Resumo Executivo`, 14, 18);
  doc.setFontSize(9); doc.setTextColor(130); doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 24);
  doc.autoTable({ startY: 30, head:[["Indicador","Valor"]], theme:"grid", headStyles:{fillColor:[139,92,246]}, body:[
    ["Total Orçado", R(k.totalPrevisto)],["Total Realizado", R(k.totalRealizado)],
    ["Desvio", `${R(k.desvio)} (${k.desvioPct}%)`],["Total OPEX", R(k.previstoOpex)],["Total CAPEX", R(k.previstoCapex)],
    ["Centros de Custo", String(k.qtdCentrosCusto)],["Itens", String(k.qtdItens)],
  ]});
  doc.autoTable({ head:[["Categoria","Valor","%"]], theme:"striped", headStyles:{fillColor:[6,182,212]}, body:(data.distribuicaoCategoria||[]).map((d:any)=>[d.nome, R(d.valor), d.percentual+"%"]) });
  doc.autoTable({ head:[["Maiores Gastos","Orçado","Realizado","% Exec"]], theme:"striped", headStyles:{fillColor:[139,92,246]}, body:(data.topItens||[]).map((i:any)=>[i.nome, R(i.previsto), R(i.realizado), i.execucao+"%"]) });
  doc.save(`orcamento_${ano}.pdf`);
}

function TabDashboard({ cicloId, ano, categorias, centrosCusto }:{ cicloId:string; ano?:number; categorias:Categoria[]; centrosCusto:CentroCusto[] }) {
  const [data, setData] = useState<any|null>(null);
  const [loading, setLoading] = useState(true);
  const [fCentro, setFCentro] = useState("");
  const [fCat, setFCat] = useState("");
  const [mesIni, setMesIni] = useState(1);
  const [mesFim, setMesFim] = useState(12);
  const [exporting, setExporting] = useState<""|"xlsx"|"pdf">("");
  const doExport = async (kind:"xlsx"|"pdf")=>{
    if(!data) return; setExporting(kind);
    try { kind==="xlsx" ? await exportDashboardExcel(data, String(ano||"")) : await exportDashboardPdf(data, String(ano||"")); }
    catch(e){ console.error(e); } finally { setExporting(""); }
  };

  const load = useCallback(()=>{
    if(!cicloId) return;
    setLoading(true);
    const p = new URLSearchParams({ cicloId, mesIni:String(mesIni), mesFim:String(mesFim) });
    if(fCentro) p.set("centroCustoId", fCentro);
    if(fCat) p.set("categoriaId", fCat);
    api.get(`/orcamento/dashboard?${p.toString()}`).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  },[cicloId,fCentro,fCat,mesIni,mesFim]);
  useEffect(()=>{ load(); },[load]);

  if(loading && !data) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Carregando...</div>;
  if(!data?.kpis) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Nenhum dado disponível</div>;
  const k = data.kpis;
  const tt = (v:any)=>fmtR0(Number(v));
  const cats = categorias.filter(c=>!c.paiId);

  const KPIS = [
    { label:"Total Orçado",     value:fmtBRL(k.totalPrevisto),  icon:Target,     color:"text-violet-400" },
    { label:"Total Realizado",  value:fmtBRL(k.totalRealizado), icon:DollarSign, color:"text-cyan-400" },
    { label:"Desvio (R$)",      value:fmtBRL(k.desvio),         icon:k.desvio>0?TrendingUp:TrendingDown, color:k.desvio>0?"text-red-400":"text-emerald-400" },
    { label:"Desvio (%)",       value:`${k.desvioPct>0?"+":""}${k.desvioPct}%`,  icon:BarChart3,  color:k.desvioPct>0?"text-red-400":"text-emerald-400" },
    { label:"Total OPEX",       value:fmtBRL(k.previstoOpex),   icon:Tag,        color:"text-blue-400" },
    { label:"Total CAPEX",      value:fmtBRL(k.previstoCapex),  icon:Building,   color:"text-amber-400" },
    { label:"Centros de Custo", value:String(k.qtdCentrosCusto),icon:Building,   color:"text-foreground" },
    { label:"Itens",            value:String(k.qtdItens),       icon:Package,    color:"text-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-xl p-3">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Filter size={13}/> Filtros</span>
        <select value={fCentro} onChange={e=>setFCentro(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">Todos os centros de custo</option>
          {centrosCusto.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={fCat} onChange={e=>setFCat(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">Todas as categorias</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Período</span>
          <select value={mesIni} onChange={e=>setMesIni(Number(e.target.value))} className="bg-input border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary">
            {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <span>—</span>
          <select value={mesFim} onChange={e=>setMesFim(Number(e.target.value))} className="bg-input border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary">
            {MESES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
        {(fCentro||fCat||mesIni!==1||mesFim!==12) && (
          <button onClick={()=>{setFCentro("");setFCat("");setMesIni(1);setMesFim(12);}} className="text-xs text-muted-foreground hover:text-foreground">Limpar filtros</button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={()=>doExport("xlsx")} disabled={!!exporting} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-input hover:bg-accent disabled:opacity-50 transition-colors">
            {exporting==="xlsx" ? <RefreshCw size={13} className="animate-spin"/> : <Download size={13} className="text-emerald-400"/>} Excel
          </button>
          <button onClick={()=>doExport("pdf")} disabled={!!exporting} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-input hover:bg-accent disabled:opacity-50 transition-colors">
            {exporting==="pdf" ? <RefreshCw size={13} className="animate-spin"/> : <Download size={13} className="text-red-400"/>} PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPIS.map(kp=>(
          <div key={kp.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{kp.label}</span>
              <kp.icon size={15} className={kp.color}/>
            </div>
            <div className={cn("text-lg font-bold font-mono truncate", kp.color)}>{kp.value}</div>
          </div>
        ))}
      </div>

      {/* Evolução + CAPEX×OPEX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Evolução Mensal — Orçado × Realizado</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.evolucaoMensal}>
              <defs>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)"/>
              <XAxis dataKey="label" tick={{fontSize:11,fill:"#94a3b8"}}/>
              <YAxis tickFormatter={(v)=>"R$"+(v/1000).toFixed(0)+"k"} tick={{fontSize:10,fill:"#94a3b8"}} width={56}/>
              <Tooltip formatter={tt}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Area type="monotone" dataKey="previsto" name="Orçado" stroke="#8b5cf6" fill="url(#gP)" strokeWidth={2}/>
              <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#06b6d4" fill="url(#gR)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">CAPEX × OPEX</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.capexOpex}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)"/>
              <XAxis dataKey="tipo" tick={{fontSize:11,fill:"#94a3b8"}}/>
              <YAxis tickFormatter={(v)=>"R$"+(v/1000).toFixed(0)+"k"} tick={{fontSize:10,fill:"#94a3b8"}} width={56}/>
              <Tooltip formatter={tt}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="previsto" name="Orçado" fill="#8b5cf6" radius={[4,4,0,0]}/>
              <Bar dataKey="realizado" name="Realizado" fill="#06b6d4" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribuições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[
          { titulo:"Distribuição por Categoria", arr:data.distribuicaoCategoria },
          { titulo:"Distribuição por Centro de Custo", arr:data.distribuicaoCentroCusto },
        ].map((blk,bi)=>(
          <div key={bi} className="bg-card border border-border rounded-xl p-5">
            <div className="text-sm font-semibold mb-4">{blk.titulo}</div>
            {(!blk.arr || blk.arr.length===0) ? <div className="text-xs text-muted-foreground h-48 flex items-center justify-center">Sem dados</div> : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={blk.arr} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                      {blk.arr.map((_:any,i:number)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={tt}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {blk.arr.slice(0,6).map((d:any,i:number)=>(
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{background:CHART_COLORS[i%CHART_COLORS.length]}}/>
                      <span className="text-foreground truncate flex-1">{d.nome}</span>
                      <span className="text-muted-foreground font-mono shrink-0">{d.percentual}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ranking + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4">Ranking dos Maiores Gastos</div>
          <ResponsiveContainer width="100%" height={Math.max(200,(data.topItens?.length||0)*34+40)}>
            <BarChart data={data.topItens} layout="vertical" margin={{left:8}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false}/>
              <XAxis type="number" tickFormatter={(v)=>"R$"+(v/1000).toFixed(0)+"k"} tick={{fontSize:10,fill:"#94a3b8"}}/>
              <YAxis type="category" dataKey="nome" tick={{fontSize:10,fill:"#94a3b8"}} width={130}/>
              <Tooltip formatter={tt}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="previsto" name="Orçado" fill="#8b5cf6" radius={[0,3,3,0]}/>
              <Bar dataKey="realizado" name="Realizado" fill="#06b6d4" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-yellow-400"/>Alertas {data.alertas?.length?`(${data.alertas.length})`:""}</div>
          {(!data.alertas || data.alertas.length===0) ? (
            <div className="text-xs text-muted-foreground h-40 flex items-center justify-center">Nenhum alerta no mês</div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {data.alertas.map((a:any,i:number)=>(
                <div key={i} className={cn("flex items-start gap-2 p-2.5 rounded-lg text-[11px]", a.tipo==="estouro"?"bg-red-500/10 border border-red-500/20 text-red-200":"bg-yellow-500/10 border border-yellow-500/20 text-yellow-200")}>
                  <AlertTriangle size={11} className={cn("mt-0.5 shrink-0", a.tipo==="estouro"?"text-red-400":"text-yellow-400")}/>
                  <span>{a.mensagem}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Grid de Itens (OPEX ou CAPEX) ───────────────────────────────────────────
function ItemModal({ tipo, categorias, centrosCusto, fornecedores, onClose, onSaved, cicloId, item }:{
  tipo:"OPEX"|"CAPEX"; categorias:Categoria[]; centrosCusto:CentroCusto[]; fornecedores:Fornecedor[];
  onClose:()=>void; onSaved:()=>void; cicloId:string; item?:Item;
}) {
  const editing = !!item;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(()=>({
    nome: item?.nome || "", descricao: item?.descricao || "",
    categoriaId: item?.categoria?.id || "", centroCustoId: item?.centroCusto?.id || "",
    fornecedorId: item?.fornecedor?.id || "",
    recorrente: item?.recorrente || false, periodicidade: item?.periodicidade || "mensal",
    observacoes: item?.observacoes || "",
    valoresMensais: (item ? Object.fromEntries(item.meses.map(m=>[m.mes, m.valorPrevisto])) : {}) as Record<number,number>,
  }));

  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const allCats = categorias.filter(c=>c.tipo===tipo);

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!form.nome||!form.categoriaId) return;
    setSaving(true);
    try {
      if (editing && item) {
        await api.put(`/orcamento/itens/${item.id}`, {
          nome:form.nome, descricao:form.descricao||undefined,
          centroCustoId:form.centroCustoId||null, fornecedorId:form.fornecedorId||null,
          recorrente:form.recorrente, periodicidade:form.periodicidade,
          observacoes:form.observacoes||undefined,
        });
        // atualiza os 12 meses de previsto em paralelo
        await Promise.all(MESES.map(m=>
          api.patch(`/orcamento/itens/${item.id}/previsto`, { mes:m, valorPrevisto: form.valoresMensais[m]||0 })
        ));
      } else {
        await api.post("/orcamento/itens", {
          cicloId, tipo,
          nome:form.nome, descricao:form.descricao||undefined,
          categoriaId:form.categoriaId,
          centroCustoId:form.centroCustoId||undefined,
          fornecedorId:form.fornecedorId||undefined,
          recorrente:form.recorrente, periodicidade:form.periodicidade,
          observacoes:form.observacoes||undefined,
          valoresMensais:Object.fromEntries(Object.entries(form.valoresMensais).filter(([,v])=>v>0))
        });
      }
      onSaved();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="text-sm font-semibold text-foreground">{editing?"Editar":"Novo"} Item {tipo}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FL l="Nome do Item" req />
              <input value={form.nome} onChange={e=>set("nome",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" placeholder="Ex: Microsoft 365 E3" />
            </div>
            <div>
              <FL l="Categoria" req />
              <select value={form.categoriaId} onChange={e=>set("categoriaId",e.target.value)} disabled={editing}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60">
                <option value="">Selecione...</option>
                {allCats.filter(c=>!c.paiId).map(cat=>(
                  <optgroup key={cat.id} label={cat.nome}>
                    {allCats.filter(c=>c.paiId===cat.id).map(sub=>(
                      <option key={sub.id} value={sub.id}>{sub.nome}</option>
                    ))}
                    <option value={cat.id}>{cat.nome} (geral)</option>
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <FL l="Centro de Custo" />
              <select value={form.centroCustoId} onChange={e=>set("centroCustoId",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                <option value="">Nenhum</option>
                {centrosCusto.filter(c=>c.ativo).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <FL l="Fornecedor" />
              <select value={form.fornecedorId} onChange={e=>set("fornecedorId",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                <option value="">Nenhum</option>
                {fornecedores.filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <FL l="Periodicidade" />
              <select value={form.periodicidade} onChange={e=>set("periodicidade",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
                <option value="unico">Único</option>
              </select>
            </div>
            <div className="col-span-2">
              <FL l="Descrição" />
              <input value={form.descricao} onChange={e=>set("descricao",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <FL l="Valores Mensais Previstos (R$)" />
            <div className="grid grid-cols-4 gap-2">
              {MESES.map((m,i)=>(
                <div key={i}>
                  <div className="text-[10px] text-muted-foreground mb-1 text-center">{m}</div>
                  <input
                    type="number" min="0" step="0.01"
                    value={form.valoresMensais[i+1]||""}
                    onChange={e=>setForm(p=>({...p,valoresMensais:{...p.valoresMensais,[i+1]:parseFloat(e.target.value)||0}}))}
                    className="w-full bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary text-center font-mono"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <FL l="Observações" />
            <textarea value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} rows={2}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.recorrente} onChange={e=>set("recorrente",e.target.checked)} className="rounded border-border" />
            <span className="text-xs text-muted-foreground">Item recorrente (repete ano a ano)</span>
          </label>
        </form>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
          <button onClick={submit as any} disabled={saving||!form.nome||!form.categoriaId}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
            {saving?"Salvando...":editing?"Salvar Alterações":"Criar Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LancarModal({ item, mes, onClose, onSaved }:{ item:Item; mes:number; onClose:()=>void; onSaved:()=>void }) {
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const mesData = item.meses.find(m=>m.mes===mes);

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!valor) return;
    setSaving(true);
    try {
      await api.patch(`/orcamento/itens/${item.id}/lancar`, { mes, valorRealizado:parseFloat(valor), observacoes:obs||undefined });
      onSaved();
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-foreground">Lançar Realizado — {MESES[mes-1]}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent"><X size={16}/></button>
        </div>
        <div className="mb-4 p-3 bg-white/3 rounded-lg text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">{item.nome}</div>
          <div>Previsto: <span className="font-mono text-violet-400">{fmtBRL(mesData?.valorPrevisto||0)}</span></div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <FL l="Valor Realizado (R$)" req />
            <input type="number" min="0" step="0.01" value={valor} onChange={e=>setValor(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary font-mono"
              placeholder="0,00" autoFocus />
          </div>
          <div>
            <FL l="Observações" />
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
            <button type="submit" disabled={saving||!valor}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving?"Lançando...":"Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabItens({ tipo, cicloId, categorias, centrosCusto, fornecedores }:{
  tipo:"OPEX"|"CAPEX"; cicloId:string; categorias:Categoria[]; centrosCusto:CentroCusto[]; fornecedores:Fornecedor[];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editItem, setEditItem] = useState<Item|null>(null);
  const [deleting, setDeleting] = useState<Item|null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [lancar, setLancar] = useState<{item:Item;mes:number}|null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const load = useCallback(()=>{
    if(!cicloId) return;
    setLoading(true);
    api.get(`/orcamento/itens?cicloId=${cicloId}&tipo=${tipo}`)
      .then(r=>setItems(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[cicloId,tipo]);

  useEffect(()=>{ load(); },[load]);

  const filtered = items.filter(it=>{
    if(search && !it.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterCat && it.categoria?.id!==filterCat) return false;
    return true;
  });

  const cats = categorias.filter(c=>c.tipo===tipo && !c.paiId);

  const totalPrevisto = filtered.reduce((s,it)=>s+it.totais.previsto,0);
  const totalRealizado = filtered.reduce((s,it)=>s+it.totais.realizado,0);
  const totalExec = totalPrevisto>0?(totalRealizado/totalPrevisto)*100:0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar itens..."
            className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
        </div>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
          <option value="">Todas as categorias</option>
          {cats.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button onClick={()=>setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus size={14}/> Novo Item
        </button>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { l:"Total Previsto", v:fmtBRL(totalPrevisto), c:"text-violet-400" },
          { l:"Total Realizado", v:fmtBRL(totalRealizado), c:execColor(totalExec) },
          { l:"Execução", v:fmtPct(totalExec), c:execColor(totalExec) },
        ].map(k=>(
          <div key={k.l} className="bg-card border border-border rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.l}</div>
            <div className={cn("text-lg font-bold font-mono", k.c)}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Grid header */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border bg-white/3"
          style={{gridTemplateColumns:"1fr repeat(12,56px) 80px 80px 72px 64px"}}>
          <div className="px-4 py-2.5">Item</div>
          {MESES.map(m=><div key={m} className="py-2.5 text-center">{m}</div>)}
          <div className="py-2.5 text-center">Prev.</div>
          <div className="py-2.5 text-center">Real.</div>
          <div className="py-2.5 text-center">%</div>
          <div className="py-2.5"/>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-sm gap-1">
            <Package size={20} className="opacity-40"/>
            <span>Nenhum item {tipo} cadastrado</span>
          </div>
        ) : (
          <div>
            {filtered.map(item=>{
              const isExp = expanded.has(item.id);
              return (
                <div key={item.id} className="border-b border-border last:border-0">
                  {/* Item row */}
                  <div className="grid items-center hover:bg-white/2 text-sm"
                    style={{gridTemplateColumns:"1fr repeat(12,56px) 80px 80px 72px 64px"}}>
                    <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                      <button onClick={()=>setExpanded(s=>{ const n=new Set(s); isExp?n.delete(item.id):n.add(item.id); return n; })}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                        {isExp?<ChevronDown size={12}/>:<ChevronRight size={12}/>}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{item.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{item.categoria?.nome}</div>
                      </div>
                    </div>
                    {MESES.map((_,mi)=>{
                      const mesData = item.meses.find(m=>m.mes===mi+1);
                      const prev = mesData?.valorPrevisto||0;
                      const real = mesData?.valorRealizado;
                      const isEstouro = real!=null && real > prev;
                      return (
                        <div key={mi} className="py-3 text-center">
                          {real!=null ? (
                            <button onClick={()=>setLancar({item,mes:mi+1})}
                              className={cn("text-[10px] font-mono w-full px-1 hover:opacity-80 transition-opacity",
                                isEstouro?"text-red-400":"text-cyan-400")}>
                              {fmtBRL(real).replace("R$","").trim()}
                            </button>
                          ) : prev > 0 ? (
                            <button onClick={()=>setLancar({item,mes:mi+1})}
                              className="text-[10px] font-mono text-violet-400/60 hover:text-violet-400 transition-colors w-full px-1">
                              {fmtBRL(prev).replace("R$","").trim()}
                            </button>
                          ) : (
                            <button onClick={()=>setLancar({item,mes:mi+1})}
                              className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors w-full">—</button>
                          )}
                        </div>
                      );
                    })}
                    <div className="py-3 text-center text-[11px] font-mono text-violet-400">{fmtBRL(item.totais.previsto).replace("R$","").trim()}</div>
                    <div className={cn("py-3 text-center text-[11px] font-mono", execColor(item.totais.execucao))}>{fmtBRL(item.totais.realizado).replace("R$","").trim()}</div>
                    <div className="py-3 px-1">
                      <div className={cn("text-[10px] font-mono text-center mb-1", execColor(item.totais.execucao))}>{fmtPct(item.totais.execucao)}</div>
                      <ExecBar pct={item.totais.execucao} height="h-1" />
                    </div>
                    <div className="py-3 flex justify-center gap-0.5">
                      <button onClick={()=>setEditItem(item)} title="Editar"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Edit2 size={11}/></button>
                      <button onClick={()=>setDeleting(item)} title="Excluir"
                        className="p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400"><Trash2 size={11}/></button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="px-6 py-3 bg-white/2 border-t border-border text-xs text-muted-foreground grid grid-cols-3 gap-3">
                      {item.descricao && <div><span className="font-medium text-foreground">Descrição: </span>{item.descricao}</div>}
                      {item.fornecedor && <div><span className="font-medium text-foreground">Fornecedor: </span>{item.fornecedor.nome}</div>}
                      {item.centroCusto && <div><span className="font-medium text-foreground">Centro de Custo: </span>{item.centroCusto.nome}</div>}
                      <div><span className="font-medium text-foreground">Periodicidade: </span>{item.periodicidade}</div>
                      <div><span className="font-medium text-foreground">Recorrente: </span>{item.recorrente?"Sim":"Não"}</div>
                      {item.observacoes && <div className="col-span-2"><span className="font-medium text-foreground">Obs: </span>{item.observacoes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && <ItemModal tipo={tipo} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}
        cicloId={cicloId} onClose={()=>setShowNew(false)} onSaved={()=>{ setShowNew(false); load(); }} />}
      {editItem && <ItemModal tipo={tipo} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}
        cicloId={cicloId} item={editItem} onClose={()=>setEditItem(null)} onSaved={()=>{ setEditItem(null); load(); }} />}
      {lancar && <LancarModal item={lancar.item} mes={lancar.mes} onClose={()=>setLancar(null)} onSaved={()=>{ setLancar(null); load(); }} />}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={()=>!deletingBusy&&setDeleting(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><Trash2 size={16} className="text-red-400"/><div className="text-sm font-semibold text-foreground">Excluir item?</div></div>
            <p className="text-xs text-foreground mb-1 font-medium">{deleting.nome}</p>
            <p className="text-xs text-muted-foreground mb-5">Remove o item e todos os valores mensais. Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setDeleting(null)} disabled={deletingBusy} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
              <button onClick={async()=>{ setDeletingBusy(true); try{ await api.delete(`/orcamento/itens/${deleting.id}`); setDeleting(null); load(); } catch{} finally{ setDeletingBusy(false); } }}
                disabled={deletingBusy} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50">
                {deletingBusy?"Excluindo...":"Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aprovações Tab ───────────────────────────────────────────────────────────
function TabAprovacoes({ cicloId }:{ cicloId:string }) {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string|null>(null);

  const load = useCallback(()=>{
    if(!cicloId) return;
    setLoading(true);
    api.get(`/orcamento/aprovacoes?cicloId=${cicloId}`)
      .then(r=>setAprovacoes(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[cicloId]);

  useEffect(()=>{ load(); },[load]);

  async function resolver(id:string, decisao:"aprovado"|"rejeitado") {
    setResolving(id);
    try {
      await api.patch(`/orcamento/aprovacoes/${id}`, { decisao });
      load();
    } catch {} finally { setResolving(null); }
  }

  const pendentes = aprovacoes.filter(a=>a.status==="pendente");
  const resolvidas = aprovacoes.filter(a=>a.status!=="pendente");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock size={14} className="text-yellow-400"/>
          Pendentes de Aprovação ({pendentes.length})
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : pendentes.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
            <CheckCircle size={20} className="mx-auto mb-2 text-emerald-400" />
            Sem aprovações pendentes
          </div>
        ) : (
          <div className="space-y-2">
            {pendentes.map(ap=>(
              <div key={ap.id} className="bg-card border border-yellow-500/20 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">{ap.item?.nome}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Tipo: <span className="text-yellow-400">{ap.tipo}</span> · Solicitado por: {ap.solicitadoPor?.nome} · {new Date(ap.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                  {ap.observacoes && <div className="text-[10px] text-muted-foreground mt-1 italic">"{ap.observacoes}"</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={()=>resolver(ap.id,"rejeitado")} disabled={resolving===ap.id}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50">Rejeitar</button>
                  <button onClick={()=>resolver(ap.id,"aprovado")} disabled={resolving===ap.id}
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50">Aprovar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolvidas.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-foreground mb-3">Histórico</div>
          <div className="space-y-2">
            {resolvidas.map(ap=>(
              <div key={ap.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4 opacity-70">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">{ap.item?.nome}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Tipo: {ap.tipo} · {ap.solicitadoPor?.nome} · {new Date(ap.criadoEm).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium",
                  ap.status==="aprovado"?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400")}>
                  {ap.status.charAt(0).toUpperCase()+ap.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Configurações Tab ────────────────────────────────────────────────────────
function TabConfiguracoes({ categorias, centrosCusto, fornecedores, reload }:{
  categorias:Categoria[]; centrosCusto:CentroCusto[]; fornecedores:Fornecedor[]; reload:()=>void;
}) {
  const [showCC, setShowCC] = useState(false);
  const [showForn, setShowForn] = useState(false);
  const [ccForm, setCcForm] = useState({codigo:"",nome:"",cor:"#a78bfa"});
  const [fornForm, setFornForm] = useState({nome:"",cnpj:"",segmento:""});
  const [saving, setSaving] = useState(false);

  async function createCC(e:React.FormEvent) {
    e.preventDefault();
    if(!ccForm.codigo||!ccForm.nome) return;
    setSaving(true);
    try {
      await api.post("/orcamento/centros-custo", ccForm);
      setShowCC(false); setCcForm({codigo:"",nome:"",cor:"#a78bfa"}); reload();
    } catch {} finally { setSaving(false); }
  }

  async function createForn(e:React.FormEvent) {
    e.preventDefault();
    if(!fornForm.nome) return;
    setSaving(true);
    try {
      await api.post("/orcamento/fornecedores", fornForm);
      setShowForn(false); setFornForm({nome:"",cnpj:"",segmento:""}); reload();
    } catch {} finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Centros de Custo */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2"><Building size={14}/>Centros de Custo</div>
          <button onClick={()=>setShowCC(v=>!v)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"><Plus size={14}/></button>
        </div>
        {showCC && (
          <form onSubmit={createCC} className="mb-4 space-y-2 p-3 bg-white/3 rounded-lg border border-border">
            <input value={ccForm.codigo} onChange={e=>setCcForm(p=>({...p,codigo:e.target.value}))} placeholder="Código (ex: TI)" className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"/>
            <input value={ccForm.nome} onChange={e=>setCcForm(p=>({...p,nome:e.target.value}))} placeholder="Nome do centro de custo" className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"/>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={()=>setShowCC(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              <button type="submit" disabled={saving} className="text-xs text-primary hover:underline disabled:opacity-50">Salvar</button>
            </div>
          </form>
        )}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {centrosCusto.map(cc=>(
            <div key={cc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:cc.cor}}/>
              <span className="font-mono text-muted-foreground w-10 shrink-0">{cc.codigo}</span>
              <span className="text-foreground truncate flex-1">{cc.nome}</span>
              <span className={cn("text-[9px]",cc.ativo?"text-emerald-400":"text-red-400")}>{cc.ativo?"Ativo":"Inativo"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fornecedores */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2"><Truck size={14}/>Fornecedores</div>
          <button onClick={()=>setShowForn(v=>!v)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"><Plus size={14}/></button>
        </div>
        {showForn && (
          <form onSubmit={createForn} className="mb-4 space-y-2 p-3 bg-white/3 rounded-lg border border-border">
            <input value={fornForm.nome} onChange={e=>setFornForm(p=>({...p,nome:e.target.value}))} placeholder="Nome do fornecedor" className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"/>
            <input value={fornForm.cnpj} onChange={e=>setFornForm(p=>({...p,cnpj:e.target.value}))} placeholder="CNPJ (opcional)" className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"/>
            <input value={fornForm.segmento} onChange={e=>setFornForm(p=>({...p,segmento:e.target.value}))} placeholder="Segmento (ex: Cloud)" className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-primary"/>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={()=>setShowForn(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
              <button type="submit" disabled={saving} className="text-xs text-primary hover:underline disabled:opacity-50">Salvar</button>
            </div>
          </form>
        )}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {fornecedores.map(f=>(
            <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3 text-xs">
              <span className="text-foreground truncate flex-1">{f.nome}</span>
              {f.segmento && <span className="text-muted-foreground shrink-0">{f.segmento}</span>}
              <span className={cn("text-[9px]",f.ativo?"text-emerald-400":"text-red-400")}>{f.ativo?"Ativo":"Inativo"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Categorias */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4"><Tag size={14}/>Categorias</div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {["OPEX","CAPEX"].map(t=>(
            <div key={t}>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1.5">{t}</div>
              {categorias.filter(c=>c.tipo===t&&!c.paiId).map(cat=>(
                <div key={cat.id}>
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:cat.cor}}/>
                    <span className="font-medium text-foreground">{cat.nome}</span>
                  </div>
                  {categorias.filter(c=>c.paiId===cat.id).map(sub=>(
                    <div key={sub.id} className="flex items-center gap-2 pl-6 py-0.5 text-[11px] text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor:sub.cor}}/>
                      {sub.nome}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Importação da planilha OPEX ──────────────────────────────────────────────
// Layout: linha 0=título, 1=meses, 2=cabeçalho/totais, 3+=despesas.
// Colunas: conta=0, despesa=5, 2025 real=8..19, 2026 v2 previsto=21..32, v1 total=48, 2026 realizado=49..60.
async function parseOpexXlsx(file: File): Promise<any> {
  const XLSX: any = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const num = (r: any[], c: number) => { const v = r?.[c]; return typeof v === "number" ? v : 0; };
  const st  = (r: any[], c: number) => (r?.[c] != null ? String(r[c]).trim() : "");

  const itens2026: any[] = [], itens2025: any[] = [];
  for (let i = 3; i < raw.length; i++) {
    const r = raw[i] || [];
    const conta = st(r, 0), desp = st(r, 5);
    if (!desp) continue;
    // 2026 v2 previsto + realizado
    const prev: Record<number, number> = {}, real: Record<number, number> = {};
    let any26 = false;
    for (let m = 1; m <= 12; m++) {
      const p = num(r, 20 + m), rl = num(r, 48 + m);
      if (p)  { prev[m] = Math.round(p * 100) / 100; any26 = true; }
      if (rl) { real[m] = Math.round(rl * 100) / 100; any26 = true; }
    }
    const v1 = num(r, 48);
    const obs = v1 ? `Orçamento original (v1): R$ ${v1.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : undefined;
    if (any26) itens2026.push({ categoria: conta, despesa: desp, previsto: prev, realizado: real, observacoes: obs });
    // 2025 realizado (previsto = realizado para histórico)
    const p25: Record<number, number> = {}, r25: Record<number, number> = {};
    let any25 = false;
    for (let m = 1; m <= 12; m++) {
      const v = num(r, 7 + m);
      if (v) { const x = Math.round(v * 100) / 100; p25[m] = x; r25[m] = x; any25 = true; }
    }
    if (any25) itens2025.push({ categoria: conta, despesa: desp, previsto: p25, realizado: r25 });
  }
  return { ciclos: [
    { ano: 2026, descricao: "OPEX 2026", itens: itens2026 },
    { ano: 2025, descricao: "OPEX 2025 (realizado)", itens: itens2025 },
  ] };
}

// ─── Comparação Orçamentária ──────────────────────────────────────────────────
function KpiCmp({ label, value, color }:{ label:string; value:string; color:string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">{label}</div>
      <div className={cn("text-lg font-bold font-mono truncate", color)}>{value}</div>
    </div>
  );
}

function TabComparacao({ ciclos, cicloId }:{ ciclos:Ciclo[]; cicloId:string }) {
  const sorted = [...ciclos].sort((a,b)=>a.ano-b.ano);
  const [cicloB, setCicloB] = useState(cicloId || sorted[sorted.length-1]?.id || "");
  const [cicloA, setCicloA] = useState("");
  const [dim, setDim] = useState<"categoria"|"centroCusto"|"item">("categoria");
  const [base, setBase] = useState<"realizado"|"previsto">("realizado");
  const [data, setData] = useState<any|null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(cicloA) return;
    const b = ciclos.find(c=>c.id===cicloB);
    if(b){ const prev = sorted.filter(c=>c.ano<b.ano).pop(); if(prev) setCicloA(prev.id); else { const o = ciclos.find(c=>c.id!==cicloB); if(o) setCicloA(o.id); } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cicloB,ciclos]);

  const load = useCallback(()=>{
    if(!cicloA||!cicloB||cicloA===cicloB){ setData(null); return; }
    setLoading(true);
    const p = new URLSearchParams({ cicloA, cicloB, dimensao:dim, base });
    api.get(`/orcamento/comparacao?${p.toString()}`).then(r=>setData(r.data)).catch(()=>setData(null)).finally(()=>setLoading(false));
  },[cicloA,cicloB,dim,base]);
  useEffect(()=>{ load(); },[load]);

  const anoA = ciclos.find(c=>c.id===cicloA)?.ano;
  const anoB = ciclos.find(c=>c.id===cicloB)?.ano;
  const varColor = (v:number)=> v>0?"text-red-400": v<0?"text-emerald-400":"text-muted-foreground";
  const heatBg = (pct:number)=>{ const a=Math.min(Math.abs(pct)/100,1); return pct>0?`rgba(239,68,68,${0.08+a*0.32})`:pct<0?`rgba(16,185,129,${0.08+a*0.32})`:"transparent"; };
  const dimLabel = dim==="centroCusto"?"centro de custo":dim==="item"?"item":"categoria";

  if(ciclos.length<2) return <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><BarChart3 size={28} className="opacity-30"/>Você precisa de pelo menos 2 ciclos (anos) para comparar.</div>;

  return (
    <div className="space-y-6">
      {/* Seletores */}
      <div className="flex items-center gap-2.5 flex-wrap bg-card border border-border rounded-xl p-3">
        <span className="text-xs text-muted-foreground">Comparar</span>
        <select value={cicloA} onChange={e=>setCicloA(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">Ciclo A...</option>
          {ciclos.map(c=><option key={c.id} value={c.id}>{c.ano}{c.descricao?` — ${c.descricao}`:""}</option>)}
        </select>
        <span className="text-muted-foreground">×</span>
        <select value={cicloB} onChange={e=>setCicloB(e.target.value)} className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">Ciclo B...</option>
          {ciclos.map(c=><option key={c.id} value={c.id}>{c.ano}{c.descricao?` — ${c.descricao}`:""}</option>)}
        </select>
        <div className="h-4 w-px bg-border"/>
        <select value={dim} onChange={e=>setDim(e.target.value as any)} className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-primary">
          <option value="categoria">Por categoria (conta)</option>
          <option value="centroCusto">Por centro de custo</option>
          <option value="item">Por item</option>
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(["realizado","previsto"] as const).map(b=>(
            <button key={b} onClick={()=>setBase(b)} className={cn("px-3 py-1.5", base===b?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-accent")}>{b==="realizado"?"Realizado":"Orçado"}</button>
          ))}
        </div>
      </div>

      {loading && <div className="h-32 flex items-center justify-center text-sm text-muted-foreground"><RefreshCw size={15} className="animate-spin mr-2"/>Carregando...</div>}
      {!loading && (!cicloA||!cicloB||cicloA===cicloB) && <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">Selecione dois ciclos diferentes para comparar.</div>}

      {!loading && data && cicloA!==cicloB && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCmp label={`Total ${anoA}`} value={fmtBRL(data.totais.valorA)} color="text-violet-400"/>
          <KpiCmp label={`Total ${anoB}`} value={fmtBRL(data.totais.valorB)} color="text-cyan-400"/>
          <KpiCmp label="Variação (R$)" value={`${data.totais.variacao>0?"+":""}${fmtBRL(data.totais.variacao)}`} color={varColor(data.totais.variacao)}/>
          <KpiCmp label="Variação (%)" value={`${data.totais.variacaoPct>0?"+":""}${data.totais.variacaoPct}%`} color={varColor(data.totais.variacaoPct)}/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-sm font-semibold mb-4">Comparativo por {dimLabel} (top 10)</div>
            <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.linhas.length,10)*34+50)}>
              <BarChart data={data.linhas.slice(0,10)} layout="vertical" margin={{left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false}/>
                <XAxis type="number" tickFormatter={(v)=>"R$"+(v/1000).toFixed(0)+"k"} tick={{fontSize:10,fill:"#94a3b8"}}/>
                <YAxis type="category" dataKey="nome" tick={{fontSize:10,fill:"#94a3b8"}} width={120}/>
                <Tooltip formatter={(v:any)=>fmtR0(Number(v))}/>
                <Legend wrapperStyle={{fontSize:12}}/>
                <Bar dataKey="valorA" name={String(anoA)} fill="#8b5cf6" radius={[0,3,3,0]}/>
                <Bar dataKey="valorB" name={String(anoB)} fill="#06b6d4" radius={[0,3,3,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-sm font-semibold mb-4">Evolução mensal — {anoA} × {anoB}</div>
            <ResponsiveContainer width="100%" height={Math.max(220, Math.min(data.linhas.length,10)*34+50)}>
              <AreaChart data={data.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)"/>
                <XAxis dataKey="label" tick={{fontSize:11,fill:"#94a3b8"}}/>
                <YAxis tickFormatter={(v)=>"R$"+(v/1000).toFixed(0)+"k"} tick={{fontSize:10,fill:"#94a3b8"}} width={56}/>
                <Tooltip formatter={(v:any)=>fmtR0(Number(v))}/>
                <Legend wrapperStyle={{fontSize:12}}/>
                <Area type="monotone" dataKey="valorA" name={String(anoA)} stroke="#8b5cf6" fill="#8b5cf622" strokeWidth={2}/>
                <Area type="monotone" dataKey="valorB" name={String(anoB)} stroke="#06b6d4" fill="#06b6d422" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-sm font-semibold flex items-center justify-between flex-wrap gap-2">
            <span>Análise de variações ({data.linhas.length})</span>
            <span className="text-[10px] text-muted-foreground font-normal">heatmap: <span className="text-red-400">vermelho = aumento</span> · <span className="text-emerald-400">verde = redução</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="text-left px-5 py-2.5">{dim==="centroCusto"?"Centro de custo":dim==="item"?"Item":"Categoria"}</th>
                  <th className="text-right px-3 py-2.5">{anoA}</th>
                  <th className="text-right px-3 py-2.5">{anoB}</th>
                  <th className="text-right px-3 py-2.5">Variação R$</th>
                  <th className="text-right px-5 py-2.5">Variação %</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((l:any,i:number)=>(
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-5 py-2.5 text-foreground truncate max-w-[260px]">{l.nome}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtBRL(l.valorA).replace("R$","").trim()}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmtBRL(l.valorB).replace("R$","").trim()}</td>
                    <td className={cn("px-3 py-2.5 text-right font-mono", varColor(l.variacao))}>{l.variacao>0?"+":""}{fmtBRL(l.variacao).replace("R$","").trim()}</td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold" style={{background:heatBg(l.variacaoPct), color: l.variacao>0?"#f87171":l.variacao<0?"#34d399":"#94a3b8"}}>{l.variacaoPct>0?"+":""}{l.variacaoPct}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold bg-white/2">
                  <td className="px-5 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtBRL(data.totais.valorA).replace("R$","").trim()}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{fmtBRL(data.totais.valorB).replace("R$","").trim()}</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono", varColor(data.totais.variacao))}>{data.totais.variacao>0?"+":""}{fmtBRL(data.totais.variacao).replace("R$","").trim()}</td>
                  <td className={cn("px-5 py-2.5 text-right font-mono", varColor(data.totais.variacaoPct))}>{data.totais.variacaoPct>0?"+":""}{data.totais.variacaoPct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </>)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ["Dashboard","OPEX","CAPEX","Comparação","Configurações"] as const;
type Tab = typeof TABS[number];

export default function OrcamentoPage() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cicloId, setCicloId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNovoCiclo, setShowNovoCiclo] = useState(false);
  const [novoCicloAno, setNovoCicloAno] = useState(String(new Date().getFullYear()));
  const [criandoCiclo, setCriandoCiclo] = useState(false);
  const [cicloError, setCicloError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const opexFileRef = useRef<HTMLInputElement>(null);

  async function loadConfig(selectId?: string) {
    setLoadError("");
    try {
      const [cRes,catRes,ccRes,fRes] = await Promise.all([
        api.get("/orcamento/ciclos"),
        api.get("/orcamento/categorias"),
        api.get("/orcamento/centros-custo"),
        api.get("/orcamento/fornecedores"),
      ]);
      setCiclos(cRes.data);
      setCategorias(catRes.data);
      setCentrosCusto(ccRes.data);
      setFornecedores(fRes.data);
      if(selectId) {
        setCicloId(selectId);
      } else if(cRes.data.length>0) {
        setCicloId((prev) => prev || cRes.data[0].id);
      }
    } catch(e:any) {
      setLoadError(e?.response?.data?.message || "Erro ao carregar dados do orçamento");
    } finally { setLoading(false); }
  }

  useEffect(()=>{ loadConfig(); },[]);

  async function criarCiclo() {
    if(!novoCicloAno) return;
    setCriandoCiclo(true);
    setCicloError("");
    try {
      const r = await api.post("/orcamento/ciclos", { ano:parseInt(novoCicloAno) });
      setShowNovoCiclo(false);
      setNovoCicloAno(String(new Date().getFullYear()));
      await loadConfig(r.data.id);
    } catch(e:any) {
      setCicloError(e?.response?.data?.message || "Erro ao criar ciclo");
    } finally { setCriandoCiclo(false); }
  }

  async function handleImportOpex(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (opexFileRef.current) opexFileRef.current.value = "";
    if (!file) return;
    setImporting(true); setImportMsg("");
    try {
      const payload = await parseOpexXlsx(file);
      const { data } = await api.post("/orcamento/importar-opex", payload);
      const resumo = (data?.ciclos || []).map((c: any) => `${c.ano}: ${c.itens} itens`).join(" · ");
      setImportMsg(`✓ Importado com sucesso — ${resumo}`);
      await loadConfig();
    } catch (err: any) {
      setImportMsg("⚠ " + (err?.response?.data?.message || "Falha na importação da planilha"));
    } finally { setImporting(false); }
  }

  const cicloAtual = ciclos.find(c=>c.id===cicloId);

  const STATUS_BADGE:Record<string,string> = {
    rascunho:"bg-yellow-500/15 text-yellow-400",
    ativo:"bg-emerald-500/15 text-emerald-400",
    fechado:"bg-white/10 text-muted-foreground",
  };

  const topbarActions = (
    <>
      <input ref={opexFileRef} type="file" accept=".xlsx,.xls" onChange={handleImportOpex} className="hidden" />
      <button onClick={()=>opexFileRef.current?.click()} disabled={importing} title="Importar planilha OPEX (cria ciclos, categorias, itens e meses)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50">
        {importing ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>}
        {importing ? "Importando..." : "Importar OPEX"}
      </button>
      {loading ? (
        <span className="text-xs text-muted-foreground font-mono">Carregando ciclos...</span>
      ) : ciclos.length === 0 ? (
        <button onClick={()=>setShowNovoCiclo(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors">
          <Plus size={13}/> Criar Ciclo {new Date().getFullYear()}
        </button>
      ) : (
        <>
          <select value={cicloId} onChange={e=>setCicloId(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary font-mono">
            {ciclos.map(c=><option key={c.id} value={c.id}>{c.ano}{c.descricao?` — ${c.descricao}`:""}</option>)}
          </select>
          {cicloAtual && (
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", STATUS_BADGE[cicloAtual.status]||"bg-white/10 text-muted-foreground")}>
              {cicloAtual.status}
            </span>
          )}
          <button onClick={()=>setShowNovoCiclo(true)}
            className="p-1.5 rounded-lg border border-border hover:bg-accent text-muted-foreground hover:text-foreground">
            <Plus size={13}/>
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {importMsg && (
        <div className={cn("flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-sm",
          importMsg.startsWith("✓") ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300")}>
          <span>{importMsg}</span>
          <button onClick={()=>setImportMsg("")} className="p-1 rounded hover:bg-white/10"><X size={14}/></button>
        </div>
      )}

      {/* Tabs */}
      {cicloId && (
        <>
          <div className="flex items-center gap-1 border-b border-border">
            {TABS.map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  tab===t?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground")}>
                {t}
              </button>
            ))}
          </div>

          <div>
            {tab==="Dashboard" && <TabDashboard cicloId={cicloId} ano={ciclos.find(c=>c.id===cicloId)?.ano} categorias={categorias} centrosCusto={centrosCusto}/>}
            {tab==="OPEX" && <TabItens tipo="OPEX" cicloId={cicloId} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}/>}
            {tab==="CAPEX" && <TabItens tipo="CAPEX" cicloId={cicloId} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}/>}
            {tab==="Comparação" && <TabComparacao ciclos={ciclos} cicloId={cicloId}/>}
            {tab==="Configurações" && <TabConfiguracoes categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores} reload={loadConfig}/>}
          </div>
        </>
      )}

      {!cicloId && !loading && !loadError && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <PiggyBank size={40} className="text-muted-foreground/30 mb-4"/>
          <div className="text-muted-foreground text-sm mb-1">Nenhum ciclo orçamentário criado</div>
          <div className="text-muted-foreground/60 text-xs mb-4">Crie o ciclo do ano corrente para começar a planejar</div>
          <button onClick={()=>setShowNovoCiclo(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus size={14}/> Criar Ciclo {new Date().getFullYear()}
          </button>
        </div>
      )}

      {loadError && (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
          <AlertTriangle size={28} className="text-red-400"/>
          <div className="text-red-300 text-sm">{loadError}</div>
          <button onClick={()=>loadConfig()} className="text-xs text-primary hover:underline">Tentar novamente</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          <RefreshCw size={16} className="animate-spin mr-2"/>Carregando...
        </div>
      )}

      {/* Modal novo ciclo */}
      {showNovoCiclo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-foreground">Novo Ciclo Orçamentário</div>
              <button onClick={()=>{ setShowNovoCiclo(false); setCicloError(""); }} className="p-1.5 rounded-lg hover:bg-accent"><X size={16}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <FL l="Ano" req />
                <input type="number" value={novoCicloAno} onChange={e=>{ setNovoCicloAno(e.target.value); setCicloError(""); }}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary font-mono"
                  min="2020" max="2035" autoFocus />
              </div>
              {cicloError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  <AlertTriangle size={12}/>{cicloError}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={()=>{ setShowNovoCiclo(false); setCicloError(""); }} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-accent">Cancelar</button>
                <button onClick={criarCiclo} disabled={criandoCiclo||!novoCicloAno}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
                  {criandoCiclo?"Criando...":"Criar Ciclo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
