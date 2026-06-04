"use client";
import { useState, useEffect, useCallback } from "react";
import {
  PiggyBank, Plus, RefreshCw, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronRight, Edit2, Trash2, X,
  BarChart3, DollarSign, Target, Zap, Filter, Download, Settings,
  Building, Tag, Truck, Package, Eye, EyeOff, Search
} from "lucide-react";
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
function TabDashboard({ cicloId }:{ cicloId:string }) {
  const [data, setData] = useState<DashboardData|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if(!cicloId) return;
    setLoading(true);
    api.get(`/orcamento/dashboard?cicloId=${cicloId}`)
      .then(r=>setData(r.data))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[cicloId]);

  if(loading) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Carregando...</div>;
  if(!data) return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Nenhum dado disponível</div>;

  const { kpis, evolucaoMensal, topItens, alertas, distribuicao } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Total Previsto", value:fmtBRL(kpis.totalPrevisto), icon:Target, color:"text-violet-400", bg:"bg-violet-500/10" },
          { label:"Total Realizado", value:fmtBRL(kpis.totalRealizado), icon:DollarSign, color:"text-cyan-400", bg:"bg-cyan-500/10" },
          { label:"Execução Global", value:fmtPct(kpis.execucao), icon:BarChart3, color:execColor(kpis.execucao), bg:"bg-white/5" },
          { label:"Estouros", value:String(kpis.estouros), icon:AlertTriangle, color:"text-red-400", bg:"bg-red-500/10" },
        ].map(k=>(
          <div key={k.label} className={cn("rounded-xl border border-white/8 p-4", k.bg)}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{k.label}</span>
              <k.icon size={16} className={k.color} />
            </div>
            <div className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução mensal */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Evolução Mensal — Previsto × Realizado</div>
          <div className="space-y-2">
            {evolucaoMensal.map(m=>(
              <div key={m.mes} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-muted-foreground font-mono shrink-0">{MESES[m.mes-1]}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{width:`${m.previsto>0?Math.min((m.previsto/(Math.max(...evolucaoMensal.map(x=>x.previsto))||1))*100,100):0}%`}} />
                    </div>
                    <span className="w-20 text-right text-muted-foreground font-mono">{fmtBRL(m.previsto)}</span>
                  </div>
                  {m.realizado>0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className={cn("h-full rounded-full", m.realizado>m.previsto?"bg-red-500":"bg-cyan-500")} style={{width:`${m.previsto>0?Math.min((m.realizado/(Math.max(...evolucaoMensal.map(x=>x.previsto))||1))*100,100):0}%`}} />
                      </div>
                      <span className={cn("w-20 text-right font-mono", m.realizado>m.previsto?"text-red-400":"text-cyan-400")}>{fmtBRL(m.realizado)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-violet-500 inline-block"/>Previsto</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-cyan-500 inline-block"/>Realizado</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-red-500 inline-block"/>Estouro</span>
          </div>
        </div>

        {/* Distribuição */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Distribuição por Categoria</div>
          <div className="space-y-3">
            {distribuicao.map(d=>(
              <div key={d.categoria}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground truncate max-w-[140px]">{d.categoria}</span>
                  <span className="text-muted-foreground font-mono">{fmtPct(d.percentual)}</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${d.percentual}%`,backgroundColor:d.cor}} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{fmtBRL(d.previsto)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas e Top Itens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {alertas.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" />
              Alertas Ativos ({alertas.length})
            </div>
            <div className="space-y-2">
              {alertas.map((a,i)=>(
                <div key={i} className={cn("flex items-start gap-3 p-3 rounded-lg text-xs",
                  a.tipo==="estouro"?"bg-red-500/10 border border-red-500/20":"bg-yellow-500/10 border border-yellow-500/20"
                )}>
                  <AlertTriangle size={12} className={a.tipo==="estouro"?"text-red-400":"text-yellow-400 mt-0.5"} />
                  <span className={a.tipo==="estouro"?"text-red-200":"text-yellow-200"}>{a.mensagem}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Top 5 Maiores Gastos</div>
          <div className="space-y-3">
            {topItens.map((item,i)=>(
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-muted-foreground font-mono shrink-0">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{item.nome}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ExecBar pct={item.execucao} height="h-1" />
                    <span className={cn("text-[10px] font-mono shrink-0", execColor(item.execucao))}>{fmtPct(item.execucao)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-foreground">{fmtBRL(item.realizado)}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">/ {fmtBRL(item.previsto)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grid de Itens (OPEX ou CAPEX) ───────────────────────────────────────────
function ItemModal({ tipo, categorias, centrosCusto, fornecedores, onClose, onSaved, cicloId }:{
  tipo:"OPEX"|"CAPEX"; categorias:Categoria[]; centrosCusto:CentroCusto[]; fornecedores:Fornecedor[];
  onClose:()=>void; onSaved:()=>void; cicloId:string;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome:"", descricao:"", categoriaId:"", centroCustoId:"", fornecedorId:"",
    recorrente:false, periodicidade:"mensal", observacoes:"",
    valoresMensais:{} as Record<number,number>
  });

  const set = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const allCats = categorias.filter(c=>c.tipo===tipo);

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!form.nome||!form.categoriaId) return;
    setSaving(true);
    try {
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
      onSaved();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="text-sm font-semibold text-foreground">Novo Item {tipo}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FL l="Nome do Item" req />
              <input value={form.nome} onChange={e=>set("nome",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary" placeholder="Ex: Microsoft 365 E3" />
            </div>
            <div>
              <FL l="Categoria" req />
              <select value={form.categoriaId} onChange={e=>set("categoriaId",e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
            {saving?"Salvando...":"Criar Item"}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          style={{gridTemplateColumns:"1fr repeat(12,56px) 80px 80px 72px 36px"}}>
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
                    style={{gridTemplateColumns:"1fr repeat(12,56px) 80px 80px 72px 36px"}}>
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
                    <div className="py-3 flex justify-center">
                      <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"><Edit2 size={11}/></button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="px-4 sm:px-6 py-3 bg-white/2 border-t border-border text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
      {lancar && <LancarModal item={lancar.item} mes={lancar.mes} onClose={()=>setLancar(null)} onSaved={()=>{ setLancar(null); load(); }} />}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const TABS = ["Dashboard","OPEX","CAPEX","Aprovações","Configurações"] as const;
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

  const cicloAtual = ciclos.find(c=>c.id===cicloId);

  const STATUS_BADGE:Record<string,string> = {
    rascunho:"bg-yellow-500/15 text-yellow-400",
    ativo:"bg-emerald-500/15 text-emerald-400",
    fechado:"bg-white/10 text-muted-foreground",
  };

  const topbarActions = (
    <>
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
            {tab==="Dashboard" && <TabDashboard cicloId={cicloId}/>}
            {tab==="OPEX" && <TabItens tipo="OPEX" cicloId={cicloId} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}/>}
            {tab==="CAPEX" && <TabItens tipo="CAPEX" cicloId={cicloId} categorias={categorias} centrosCusto={centrosCusto} fornecedores={fornecedores}/>}
            {tab==="Aprovações" && <TabAprovacoes cicloId={cicloId}/>}
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
