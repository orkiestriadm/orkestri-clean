"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Search, RefreshCw, Truck, Edit2, Trash2, MoreHorizontal,
  CheckCircle, XCircle, AlertCircle, Eye, History, ChevronLeft,
  ChevronRight, Building2, Phone, Mail, MapPin, CreditCard, FileText,
  StickyNote, Users, X, Loader2, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supplier {
  id: string; razaoSocial: string; nomeFantasia?: string; cnpj?: string;
  inscricaoEstadual?: string; inscricaoMunicipal?: string; tipoEmpresa: string;
  categorias: string[]; status: string;
  contatoNome?: string; contatoCargo?: string; contatoTelefone?: string;
  contatoTelefone2?: string; contatoWhatsapp?: string; contatoEmail?: string;
  contatoEmailFinanceiro?: string; site?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string; pais?: string;
  banco?: string; agencia?: string; conta?: string; tipoConta?: string;
  pixChave?: string; condicaoPagamento?: string; prazoMedio?: number; moeda?: string;
  observacoes?: string;
  criadoPor?: { id: string; nome: string };
  contacts?: Contact[]; documents?: Document[];
  criadoEm: string; atualizadoEm: string;
}
interface Contact { id: string; nome: string; cargo?: string; telefone?: string; email?: string; principal: boolean }
interface HistoryEntry { id: string; acao: string; detalhes?: any; usuario?: { id: string; nome: string }; criadoEm: string }

const TIPO_EMPRESA_OPTS = ["MEI","LTDA","S/A","EIRELI","Outros"];
const STATUS_OPTS = ["ativo","inativo","bloqueado"];
const CATEGORIAS_OPTS = [
  "Telecom","Infraestrutura","Software","Cloud","Licenciamento",
  "Serviços Técnicos","Obras","Equipamentos","Consultoria","Outros",
];
const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const BANCO_OPTS = ["Banco do Brasil","Bradesco","Caixa Econômica Federal","Itaú","Santander","Nubank","Inter","Sicoob","Sicredi","Outro"];
const TIPO_CONTA_OPTS = ["Corrente","Poupança","Pagamento"];
const COND_PAG_OPTS = ["À vista","7 dias","14 dias","21 dias","28 dias","30 dias","45 dias","60 dias","90 dias"];
const TABS = [
  { id:"geral",     label:"Dados Gerais",     icon:Building2 },
  { id:"contato",   label:"Contato",          icon:Phone },
  { id:"endereco",  label:"Endereço",         icon:MapPin },
  { id:"financeiro",label:"Dados Financeiros",icon:CreditCard },
  { id:"docs",      label:"Documentação",     icon:FileText },
  { id:"obs",       label:"Observações",      icon:StickyNote },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCnpj = (v: string) => {
  const d = v.replace(/\D/g,"").substring(0,14);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,"$1.$2.$3/$4-$5")
          .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/,"$1.$2.$3/$4")
          .replace(/^(\d{2})(\d{3})(\d{3})$/,"$1.$2.$3")
          .replace(/^(\d{2})(\d{3})$/,"$1.$2")
          .replace(/^(\d{2})$/,"$1");
};
const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g,"").substring(0,11);
  if (d.length===11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/,"($1) $2-$3");
  if (d.length===10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/,"($1) $2-$3");
  return d;
};
const fmtCep = (v: string) => {
  const d = v.replace(/\D/g,"").substring(0,8);
  return d.length > 5 ? d.replace(/^(\d{5})(\d+)$/,"$1-$2") : d;
};
const statusColor = (s: string) =>
  s==="ativo" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
  : s==="bloqueado" ? "text-red-400 bg-red-500/10 border-red-500/20"
  : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
const statusLabel = (s: string) =>
  s==="ativo" ? "Ativo" : s==="bloqueado" ? "Bloqueado" : "Inativo";

// ─── Field component ──────────────────────────────────────────────────────────

function FL({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
function Input({ value, onChange, placeholder, type="text", className="" }: any) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={cn(
        "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
        "placeholder:text-muted-foreground/40 transition-colors",
        className
      )}
    />
  );
}
function Select({ value, onChange, children, className="" }: any) {
  return (
    <select
      value={value} onChange={onChange}
      className={cn(
        "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors",
        className
      )}
    >
      {children}
    </select>
  );
}
function Textarea({ value, onChange, placeholder, rows=4 }: any) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/40 transition-colors resize-none"
    />
  );
}

// ─── Multi-select categorias ──────────────────────────────────────────────────

function CategoriasPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (cat: string) =>
    onChange(value.includes(cat) ? value.filter(c=>c!==cat) : [...value, cat]);
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIAS_OPTS.map(cat => (
        <button
          key={cat} type="button" onClick={()=>toggle(cat)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
            value.includes(cat)
              ? "bg-primary/20 border-primary/50 text-primary"
              : "bg-background border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ─── Supplier Modal ───────────────────────────────────────────────────────────

const EMPTY: Partial<Supplier> = {
  razaoSocial:"", nomeFantasia:"", cnpj:"", inscricaoEstadual:"", inscricaoMunicipal:"",
  tipoEmpresa:"LTDA", categorias:[], status:"ativo",
  contatoNome:"", contatoCargo:"", contatoTelefone:"", contatoTelefone2:"",
  contatoWhatsapp:"", contatoEmail:"", contatoEmailFinanceiro:"", site:"",
  cep:"", logradouro:"", numero:"", complemento:"", bairro:"", cidade:"", estado:"", pais:"Brasil",
  banco:"", agencia:"", conta:"", tipoConta:"", pixChave:"", condicaoPagamento:"", prazoMedio:undefined, moeda:"BRL",
  observacoes:"",
};

function SupplierModal({ supplier, onClose, onSaved }: {
  supplier?: Supplier; onClose: () => void; onSaved: (s: Supplier) => void;
}) {
  const [tab, setTab] = useState("geral");
  const [form, setForm] = useState<Partial<Supplier>>(supplier ? { ...supplier } : { ...EMPTY });
  const [contacts, setContacts] = useState<Omit<Contact,"id">[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const isEdit = !!supplier;

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g,"");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm(p => ({
          ...p, logradouro: d.logradouro || "", bairro: d.bairro || "",
          cidade: d.localidade || "", estado: d.uf || "",
        }));
      }
    } catch {} finally { setCepLoading(false); }
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.razaoSocial?.trim()) e.razaoSocial = "Razão Social é obrigatória";
    if (form.cnpj) {
      const digits = form.cnpj.replace(/\D/g,"");
      if (digits.length > 0 && digits.length !== 14) e.cnpj = "CNPJ deve ter 14 dígitos";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { setTab("geral"); return; }
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (payload.cnpj) payload.cnpj = payload.cnpj.replace(/\D/g,"");

      let saved: Supplier;
      if (isEdit) {
        const r = await api.put(`/suppliers/${supplier!.id}`, payload);
        saved = r.data;
      } else {
        const r = await api.post("/suppliers", payload);
        saved = r.data;
        // add extra contacts
        for (const c of contacts) {
          await api.post(`/suppliers/${saved.id}/contacts`, c);
        }
      }
      onSaved(saved);
    } catch (e: any) {
      setErrors({ _global: e?.response?.data?.message || "Erro ao salvar" });
    } finally { setSaving(false); }
  };

  const addContact = () => setContacts(p => [...p, { nome:"", cargo:"", telefone:"", email:"", principal:false }]);
  const setContact = (i: number, f: string, v: any) =>
    setContacts(p => p.map((c,idx) => idx===i ? { ...c, [f]:v } : c));
  const removeContact = (i: number) => setContacts(p => p.filter((_,idx)=>idx!==i));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Truck size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
              </h2>
              {isEdit && <p className="text-[11px] text-muted-foreground">{supplier!.razaoSocial}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-border shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap",
                tab===t.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {errors._global && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {errors._global}
            </div>
          )}

          {/* ── Tab: Dados Gerais ── */}
          {tab==="geral" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <FL label="Razão Social" required />
                  <Input value={form.razaoSocial||""} onChange={(e:any)=>set("razaoSocial",e.target.value)} placeholder="Nome da empresa conforme CNPJ" />
                  {errors.razaoSocial && <p className="text-[11px] text-red-400 mt-1">{errors.razaoSocial}</p>}
                </div>
                <div>
                  <FL label="Nome Fantasia" />
                  <Input value={form.nomeFantasia||""} onChange={(e:any)=>set("nomeFantasia",e.target.value)} placeholder="Como é conhecida no mercado" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="CNPJ" />
                  <Input
                    value={form.cnpj ? fmtCnpj(form.cnpj) : ""}
                    onChange={(e:any)=>set("cnpj",e.target.value.replace(/\D/g,""))}
                    placeholder="00.000.000/0000-00"
                  />
                  {errors.cnpj && <p className="text-[11px] text-red-400 mt-1">{errors.cnpj}</p>}
                </div>
                <div>
                  <FL label="Tipo de Empresa" />
                  <Select value={form.tipoEmpresa||"LTDA"} onChange={(e:any)=>set("tipoEmpresa",e.target.value)}>
                    {TIPO_EMPRESA_OPTS.map(o=><option key={o}>{o}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Inscrição Estadual" />
                  <Input value={form.inscricaoEstadual||""} onChange={(e:any)=>set("inscricaoEstadual",e.target.value)} placeholder="Opcional" />
                </div>
                <div>
                  <FL label="Inscrição Municipal" />
                  <Input value={form.inscricaoMunicipal||""} onChange={(e:any)=>set("inscricaoMunicipal",e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div>
                <FL label="Status" />
                <div className="flex gap-2">
                  {STATUS_OPTS.map(s=>(
                    <button
                      key={s} type="button"
                      onClick={()=>set("status",s)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-medium border transition-all capitalize",
                        form.status===s ? statusColor(s) : "border-border text-muted-foreground hover:border-border hover:bg-accent"
                      )}
                    >
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FL label="Categorias" />
                <CategoriasPicker value={form.categorias||[]} onChange={v=>set("categorias",v)} />
              </div>
            </div>
          )}

          {/* ── Tab: Contato ── */}
          {tab==="contato" && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/30 border border-border rounded-xl">
                <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users size={12} className="text-primary" /> Contato Principal
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FL label="Nome" />
                    <Input value={form.contatoNome||""} onChange={(e:any)=>set("contatoNome",e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div>
                    <FL label="Cargo" />
                    <Input value={form.contatoCargo||""} onChange={(e:any)=>set("contatoCargo",e.target.value)} placeholder="Ex: Diretor Comercial" />
                  </div>
                  <div>
                    <FL label="Telefone Principal" />
                    <Input
                      value={form.contatoTelefone ? fmtPhone(form.contatoTelefone) : ""}
                      onChange={(e:any)=>set("contatoTelefone",e.target.value.replace(/\D/g,""))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <FL label="Telefone Secundário" />
                    <Input
                      value={form.contatoTelefone2 ? fmtPhone(form.contatoTelefone2) : ""}
                      onChange={(e:any)=>set("contatoTelefone2",e.target.value.replace(/\D/g,""))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <FL label="WhatsApp" />
                    <Input
                      value={form.contatoWhatsapp ? fmtPhone(form.contatoWhatsapp) : ""}
                      onChange={(e:any)=>set("contatoWhatsapp",e.target.value.replace(/\D/g,""))}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <FL label="E-mail Principal" />
                    <Input value={form.contatoEmail||""} onChange={(e:any)=>set("contatoEmail",e.target.value)} placeholder="contato@empresa.com" type="email" />
                  </div>
                  <div>
                    <FL label="E-mail Financeiro" />
                    <Input value={form.contatoEmailFinanceiro||""} onChange={(e:any)=>set("contatoEmailFinanceiro",e.target.value)} placeholder="financeiro@empresa.com" type="email" />
                  </div>
                  <div>
                    <FL label="Site" />
                    <Input value={form.site||""} onChange={(e:any)=>set("site",e.target.value)} placeholder="https://empresa.com" />
                  </div>
                </div>
              </div>

              {!isEdit && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-foreground">Contatos Adicionais</p>
                    <button onClick={addContact} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                      <Plus size={12} /> Adicionar contato
                    </button>
                  </div>
                  {contacts.map((c, i) => (
                    <div key={i} className="p-3 bg-accent/20 border border-border rounded-xl mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-muted-foreground font-mono">Contato {i+1}</span>
                        <button onClick={()=>removeContact(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><FL label="Nome" required /><Input value={c.nome} onChange={(e:any)=>setContact(i,"nome",e.target.value)} placeholder="Nome" /></div>
                        <div><FL label="Cargo" /><Input value={c.cargo||""} onChange={(e:any)=>setContact(i,"cargo",e.target.value)} placeholder="Cargo" /></div>
                        <div><FL label="Telefone" /><Input value={c.telefone||""} onChange={(e:any)=>setContact(i,"telefone",e.target.value)} placeholder="(00) 00000-0000" /></div>
                        <div><FL label="E-mail" /><Input value={c.email||""} onChange={(e:any)=>setContact(i,"email",e.target.value)} placeholder="email@empresa.com" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Endereço ── */}
          {tab==="endereco" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FL label="CEP" />
                  <div className="relative">
                    <Input
                      value={form.cep ? fmtCep(form.cep) : ""}
                      onChange={(e:any)=>{
                        const v = e.target.value.replace(/\D/g,"");
                        set("cep",v);
                        if(v.length===8) lookupCep(v);
                      }}
                      placeholder="00000-000"
                    />
                    {cepLoading && <Loader2 size={14} className="absolute right-3 top-2.5 text-muted-foreground animate-spin" />}
                  </div>
                </div>
                <div className="col-span-2">
                  <FL label="Logradouro" />
                  <Input value={form.logradouro||""} onChange={(e:any)=>set("logradouro",e.target.value)} placeholder="Rua, Av., etc." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <FL label="Número" />
                  <Input value={form.numero||""} onChange={(e:any)=>set("numero",e.target.value)} placeholder="000" />
                </div>
                <div className="col-span-2">
                  <FL label="Complemento" />
                  <Input value={form.complemento||""} onChange={(e:any)=>set("complemento",e.target.value)} placeholder="Sala, bloco, andar..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Bairro" />
                  <Input value={form.bairro||""} onChange={(e:any)=>set("bairro",e.target.value)} placeholder="Bairro" />
                </div>
                <div>
                  <FL label="Cidade" />
                  <Input value={form.cidade||""} onChange={(e:any)=>set("cidade",e.target.value)} placeholder="Cidade" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Estado" />
                  <Select value={form.estado||""} onChange={(e:any)=>set("estado",e.target.value)}>
                    <option value="">Selecione...</option>
                    {ESTADOS_BR.map(uf=><option key={uf} value={uf}>{uf}</option>)}
                  </Select>
                </div>
                <div>
                  <FL label="País" />
                  <Input value={form.pais||"Brasil"} onChange={(e:any)=>set("pais",e.target.value)} placeholder="Brasil" />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Dados Financeiros ── */}
          {tab==="financeiro" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Banco" />
                  <Select value={form.banco||""} onChange={(e:any)=>set("banco",e.target.value)}>
                    <option value="">Selecione...</option>
                    {BANCO_OPTS.map(b=><option key={b}>{b}</option>)}
                  </Select>
                </div>
                <div>
                  <FL label="Tipo de Conta" />
                  <Select value={form.tipoConta||""} onChange={(e:any)=>set("tipoConta",e.target.value)}>
                    <option value="">Selecione...</option>
                    {TIPO_CONTA_OPTS.map(t=><option key={t}>{t}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Agência" />
                  <Input value={form.agencia||""} onChange={(e:any)=>set("agencia",e.target.value)} placeholder="0000-0" />
                </div>
                <div>
                  <FL label="Conta" />
                  <Input value={form.conta||""} onChange={(e:any)=>set("conta",e.target.value)} placeholder="00000-0" />
                </div>
              </div>
              <div>
                <FL label="Chave PIX" />
                <Input value={form.pixChave||""} onChange={(e:any)=>set("pixChave",e.target.value)} placeholder="CNPJ, CPF, e-mail, telefone ou chave aleatória" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FL label="Condição de Pagamento" />
                  <Select value={form.condicaoPagamento||""} onChange={(e:any)=>set("condicaoPagamento",e.target.value)}>
                    <option value="">Selecione...</option>
                    {COND_PAG_OPTS.map(c=><option key={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <FL label="Prazo Médio (dias)" />
                  <Input
                    type="number" value={form.prazoMedio||""}
                    onChange={(e:any)=>set("prazoMedio",parseInt(e.target.value)||undefined)}
                    placeholder="30"
                  />
                </div>
              </div>
              <div>
                <FL label="Moeda Padrão" />
                <Select value={form.moeda||"BRL"} onChange={(e:any)=>set("moeda",e.target.value)}>
                  <option value="BRL">BRL — Real Brasileiro</option>
                  <option value="USD">USD — Dólar Americano</option>
                  <option value="EUR">EUR — Euro</option>
                </Select>
              </div>
            </div>
          )}

          {/* ── Tab: Documentação ── */}
          {tab==="docs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center h-40 border-2 border-dashed border-border rounded-xl bg-accent/20">
                <div className="text-center">
                  <FileText size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Upload de documentos disponível após salvar o fornecedor</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Contrato social, Cartão CNPJ, Certidões</p>
                </div>
              </div>
              {isEdit && supplier!.documents && supplier!.documents.length > 0 && (
                <div className="space-y-2">
                  {supplier!.documents.map((d:any) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-accent/30 border border-border rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-primary" />
                        <span className="text-sm text-foreground">{d.nome}</span>
                        {d.tipo && <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{d.tipo}</span>}
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ver</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Observações ── */}
          {tab==="obs" && (
            <div>
              <FL label="Observações Internas" />
              <Textarea
                value={form.observacoes||""} rows={8}
                onChange={(e:any)=>set("observacoes",e.target.value)}
                placeholder="Anotações internas, restrições, histórico operacional, observações financeiras..."
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">Visível apenas para usuários autorizados</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div className="flex gap-2">
            {TABS.map((t,i) => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                className={cn("w-2 h-2 rounded-full transition-all",
                  tab===t.id ? "bg-primary" : "bg-border hover:bg-muted-foreground/50"
                )} title={t.label}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border hover:bg-accent transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> {isEdit ? "Salvar" : "Criar Fornecedor"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [tab, setTab] = useState<"info"|"history">("info");

  useEffect(() => {
    api.get(`/suppliers/${supplier.id}/history`).then(r => setHistory(r.data)).catch(() => {});
  }, [supplier.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-cyan-400/20 border border-primary/20 flex items-center justify-center">
              <Truck size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{supplier.razaoSocial}</h2>
              {supplier.nomeFantasia && <p className="text-[11px] text-muted-foreground">{supplier.nomeFantasia}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize", statusColor(supplier.status))}>
              {statusLabel(supplier.status)}
            </span>
            <button onClick={onEdit} className="px-3 py-1.5 text-xs text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors">Editar</button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3 border-b border-border shrink-0">
          {[{id:"info",label:"Informações"},{id:"history",label:"Histórico"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as any)}
              className={cn("px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                tab===t.id?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab==="info" && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {supplier.cnpj && <InfoRow label="CNPJ" value={fmtCnpj(supplier.cnpj)} />}
                {supplier.tipoEmpresa && <InfoRow label="Tipo" value={supplier.tipoEmpresa} />}
                {supplier.contatoNome && <InfoRow label="Contato" value={supplier.contatoNome} />}
                {supplier.contatoCargo && <InfoRow label="Cargo" value={supplier.contatoCargo} />}
                {supplier.contatoTelefone && <InfoRow label="Telefone" value={fmtPhone(supplier.contatoTelefone)} />}
                {supplier.contatoEmail && <InfoRow label="E-mail" value={supplier.contatoEmail} />}
                {(supplier.cidade||supplier.estado) && <InfoRow label="Cidade/UF" value={[supplier.cidade,supplier.estado].filter(Boolean).join(" / ")} />}
                {supplier.condicaoPagamento && <InfoRow label="Cond. Pagamento" value={supplier.condicaoPagamento} />}
                {supplier.banco && <InfoRow label="Banco" value={supplier.banco} />}
                {supplier.pixChave && <InfoRow label="PIX" value={supplier.pixChave} />}
              </div>
              {supplier.categorias?.length>0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Categorias</p>
                  <div className="flex flex-wrap gap-1.5">
                    {supplier.categorias.map(c=>(
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {supplier.observacoes && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Observações</p>
                  <p className="text-xs text-foreground/80 bg-accent/30 rounded-lg p-3 border border-border whitespace-pre-wrap">{supplier.observacoes}</p>
                </div>
              )}
            </>
          )}
          {tab==="history" && (
            <div className="space-y-2">
              {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum histórico registrado</p>}
              {history.map(h => (
                <div key={h.id} className="flex items-start gap-3 p-3 bg-accent/20 border border-border rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <History size={10} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground capitalize">{h.acao.replace(/_/g," ")}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(h.criadoEm).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                    {h.usuario && <p className="text-[11px] text-muted-foreground">{h.usuario.nome}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmModal({ name, onClose, onConfirm }: { name: string; onClose: () => void; onConfirm: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-400" />
        </div>
        <h3 className="text-sm font-semibold text-foreground text-center mb-2">Excluir Fornecedor</h3>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Tem certeza que deseja excluir <strong className="text-foreground">{name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-accent transition-colors">Cancelar</button>
          <button
            onClick={async()=>{ setLoading(true); await onConfirm(); setLoading(false); }}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meta, setMeta] = useState({ total:0, page:1, limit:20, pages:1 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Supplier|null>(null);
  const [viewing, setViewing] = useState<Supplier|null>(null);
  const [deleting, setDeleting] = useState<Supplier|null>(null);
  const [actionMenuId, setActionMenuId] = useState<string|null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const load = useCallback(async (params?: { q?:string; status?:string; cat?:string; pg?:number }) => {
    setLoading(true);
    try {
      const qv = params?.q ?? q;
      const sv = params?.status ?? statusFilter;
      const cv = params?.cat ?? categoriaFilter;
      const pg = params?.pg ?? page;
      const qs = new URLSearchParams();
      if (qv) qs.set("q", qv);
      if (sv) qs.set("status", sv);
      if (cv) qs.set("categoria", cv);
      qs.set("page", String(pg));
      qs.set("limit", "20");
      const r = await api.get(`/suppliers?${qs}`);
      setSuppliers(r.data.data);
      setMeta(r.data.meta);
    } catch {} finally { setLoading(false); }
  }, [q, statusFilter, categoriaFilter, page]);

  useEffect(() => { load(); }, []);

  const handleSearch = (v: string) => {
    setQ(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setPage(1); load({ q:v, pg:1 }); }, 350);
  };

  const handleFilter = (type: "status"|"categoria", v: string) => {
    if (type==="status") { setStatusFilter(v); setPage(1); load({ status:v, pg:1 }); }
    else { setCategoriaFilter(v); setPage(1); load({ cat:v, pg:1 }); }
  };

  const handleSaved = async (s: Supplier) => {
    setShowCreate(false); setEditing(null);
    await load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await api.delete(`/suppliers/${deleting.id}`);
    setDeleting(null);
    await load();
  };

  const handleStatus = async (id: string, status: string) => {
    await api.patch(`/suppliers/${id}/status`, { status });
    setActionMenuId(null);
    await load();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Topbar />

      <div className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-display text-foreground tracking-tight">Cadastro de Fornecedores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {meta.total} fornecedor{meta.total!==1?"es":""} cadastrado{meta.total!==1?"s":""}
            </p>
          </div>
          <button
            onClick={()=>setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            <Plus size={16} /> Novo Fornecedor
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q} onChange={e=>handleSearch(e.target.value)}
              placeholder="Buscar por razão social, fantasia, CNPJ..."
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>
          <select
            value={statusFilter} onChange={e=>handleFilter("status",e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
          <select
            value={categoriaFilter} onChange={e=>handleFilter("categoria",e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIAS_OPTS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={()=>load()} className="p-2.5 rounded-xl border border-border text-muted-foreground hover:bg-accent transition-colors">
            <RefreshCw size={14} className={loading?"animate-spin":""} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/30">
                {["Razão Social","CNPJ","Categorias","Cidade/UF","Contato","Telefone","Status","Cadastro",""].map(h=>(
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                Array.from({length:5}).map((_,i)=>(
                  <tr key={i} className="border-b border-border">
                    {Array.from({length:9}).map((_,j)=>(
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-accent animate-pulse rounded" style={{width:`${60+Math.random()*40}%`}} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && suppliers.length===0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Truck size={32} className="text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum fornecedor encontrado</p>
                    <button onClick={()=>setShowCreate(true)} className="mt-3 text-xs text-primary hover:underline">Cadastrar primeiro fornecedor</button>
                  </td>
                </tr>
              )}
              {!loading && suppliers.map(s=>(
                <tr key={s.id} className="border-b border-border hover:bg-accent/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground truncate max-w-[180px]">{s.razaoSocial}</div>
                    {s.nomeFantasia && <div className="text-[11px] text-muted-foreground truncate">{s.nomeFantasia}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {s.cnpj ? fmtCnpj(s.cnpj) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[140px]">
                      {s.categorias.slice(0,2).map(c=>(
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20 whitespace-nowrap">{c}</span>
                      ))}
                      {s.categorias.length>2 && <span className="text-[9px] text-muted-foreground">+{s.categorias.length-2}</span>}
                      {s.categorias.length===0 && <span className="text-[11px] text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {[s.cidade,s.estado].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/80 max-w-[120px] truncate">
                    {s.contatoNome || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {s.contatoTelefone ? fmtPhone(s.contatoTelefone) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize whitespace-nowrap", statusColor(s.status))}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={()=>setViewing(s)} title="Visualizar" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <Eye size={14} />
                      </button>
                      <button onClick={()=>setEditing(s)} title="Editar" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={()=>setActionMenuId(actionMenuId===s.id?null:s.id)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {actionMenuId===s.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-30 py-1">
                            {s.status!=="ativo" && (
                              <button onClick={()=>handleStatus(s.id,"ativo")} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-accent transition-colors">
                                <CheckCircle size={12} /> Ativar
                              </button>
                            )}
                            {s.status!=="inativo" && (
                              <button onClick={()=>handleStatus(s.id,"inativo")} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors">
                                <XCircle size={12} /> Inativar
                              </button>
                            )}
                            {s.status!=="bloqueado" && (
                              <button onClick={()=>handleStatus(s.id,"bloqueado")} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-yellow-400 hover:bg-accent transition-colors">
                                <AlertCircle size={12} /> Bloquear
                              </button>
                            )}
                            <div className="border-t border-border my-1" />
                            <button
                              onClick={()=>{ setActionMenuId(null); setDeleting(s); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-accent/20">
              <span className="text-xs text-muted-foreground">
                {(meta.page-1)*meta.limit+1}–{Math.min(meta.page*meta.limit,meta.total)} de {meta.total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={()=>{ setPage(p=>p-1); load({ pg:page-1 }); }}
                  disabled={meta.page<=1}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-foreground px-2">{meta.page}/{meta.pages}</span>
                <button
                  onClick={()=>{ setPage(p=>p+1); load({ pg:page+1 }); }}
                  disabled={meta.page>=meta.pages}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close action menu */}
      {actionMenuId && (
        <div className="fixed inset-0 z-20" onClick={()=>setActionMenuId(null)} />
      )}

      {/* Modals */}
      {showCreate && <SupplierModal onClose={()=>setShowCreate(false)} onSaved={handleSaved} />}
      {editing && <SupplierModal supplier={editing} onClose={()=>setEditing(null)} onSaved={handleSaved} />}
      {viewing && (
        <ViewModal
          supplier={viewing}
          onClose={()=>setViewing(null)}
          onEdit={()=>{ setEditing(viewing); setViewing(null); }}
        />
      )}
      {deleting && <ConfirmModal name={deleting.razaoSocial} onClose={()=>setDeleting(null)} onConfirm={handleDelete} />}
    </div>
  );
}
