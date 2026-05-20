"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type Cliente = {
  id: string; nome: string; empresa?: string; email?: string; telefone?: string;
  cnpj?: string; site?: string; cidade?: string; estado?: string;
  segmento?: string; origem?: string; statusLead: string;
  ativo: boolean; saudeScore: number; notas?: string; portalToken?: string;
  tenantOrgId?: string | null;
  responsavel?: { id: string; nome: string } | null;
  criadoEm: string; atualizadoEm?: string;
};
type Workspace = {
  cliente: Cliente;
  stats: { projetosAtivos: number; projetosTotal: number; chamadosAbertos: number; chamadosTotais: number; slaCompliance: number; mrr: number };
  projetos: Projeto[];
  chamadosRecentes: Chamado[];
  proximosMarcos: Marco[];
  alertas: string[];
  timeline: TimelineEvento[];
};
type Projeto = {
  id: string; titulo: string; tipo: string; status: string; prioridade: string;
  valor?: number; dataFim?: string; progressoPct: number; cor: string;
  criadoEm: string; atualizadoEm: string;
  membros: { id: string; nome: string }[];
  totalTasks: number;
};
type Chamado = {
  id: string; numero: number; titulo: string; status: string; prioridade: string;
  slaHoras?: number; criadoEm: string; resolvidoEm?: string;
  atendente?: { id: string; nome: string } | null;
};
type Marco = {
  id: string; titulo: string; dataAlvo?: string; concluido: boolean;
  project: { id: string; titulo: string; cor: string };
};
type TimelineEvento = {
  id: string; tipo: string; titulo: string; descricao?: string;
  referenciaTipo?: string; referenciaId?: string;
  criadoEm: string;
  user?: { id: string; nome: string } | null;
};
type Contrato = {
  id: string; tipo: string; plano?: string; slaHoras?: number;
  vigenciaInicio?: string; vigenciaFim?: string; valor?: number; ativo: boolean; observacoes?: string;
  criadoEm: string;
};

// ── Shared constants ──────────────────────────────────────────────────────────
const SEGMENTOS_LIST  = ["Tecnologia","Varejo","Indústria","Saúde","Educação","Finanças","Serviços","Agronegócio","Outro"];
const ORIGENS_LIST    = ["Indicação","Site / Blog","Redes Sociais","Cold Call / Email","Evento / Feiras","Parceria","Outro"];
const ESTADOS_BR_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const STATUS_LEAD_LIST= [
  { value:"ativo",     label:"Ativo",       cor:"#34d399" },
  { value:"inativo",   label:"Inativo",     cor:"#f87171" },
  { value:"vip",       label:"Cliente VIP", cor:"#fbbf24" },
  { value:"prospecto", label:"Prospecto",   cor:"#94a3b8" },
];

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_PROJ: Record<string, { label: string; color: string }> = {
  PLANEJAMENTO: { label: "Planejamento", color: "#a78bfa" },
  EM_ANDAMENTO: { label: "Em andamento", color: "#22d3ee" },
  PAUSADO: { label: "Pausado", color: "#fbbf24" },
  CONCLUIDO: { label: "Concluído", color: "#34d399" },
  CANCELADO: { label: "Cancelado", color: "#f87171" },
};
const STATUS_CHAMADO: Record<string, { label: string; color: string }> = {
  aberto: { label: "Aberto", color: "#f87171" },
  em_atendimento: { label: "Em atend.", color: "#22d3ee" },
  aguardando: { label: "Aguardando", color: "#fbbf24" },
  resolvido: { label: "Resolvido", color: "#34d399" },
  fechado: { label: "Fechado", color: "#94a3b8" },
};
const PRIO_COLOR: Record<string, string> = {
  BAIXA: "#34d399", MEDIA: "#22d3ee", ALTA: "#fbbf24", URGENTE: "#f87171",
  baixa: "#34d399", media: "#22d3ee", alta: "#fbbf24", urgente: "#f87171",
};
const TIMELINE_ICON: Record<string, string> = {
  criado: "✦", status_change: "⟳", projeto: "◈", chamado: "⌘", contrato: "◉", nota: "✎", default: "•",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) { return s >= 80 ? "#34d399" : s >= 60 ? "#fbbf24" : "#f87171"; }
function scoreLabel(s: number) { return s >= 80 ? "Saudável" : s >= 60 ? "Atenção" : "Crítico"; }
function fmtMrr(v?: number) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const dy = Math.floor(h / 24);
  if (dy < 7) return `${dy}d atrás`;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function initials(nome: string) { return nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

// ── Sub-components ────────────────────────────────────────────────────────────
function Spin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.5s ease" }} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="var(--font-mono)">{score}</text>
    </svg>
  );
}

function Avatar({ nome, size = 28 }: { nome: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))",
      border: "1px solid rgba(124,58,237,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "var(--accent-violet)",
    }}>
      {initials(nome)}
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function FL2({ text }: { text: string }) {
  return <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{text}</label>;
}
function SH2({ label }: { label: string }) {
  return <div style={{ gridColumn: "1/-1", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginTop: 4 }}>{label}</div>;
}

function EditClienteModal({ cliente, onClose, onSave }: { cliente: Cliente; onClose: () => void; onSave: (c: Cliente) => void }) {
  const [nome, setNome]         = useState(cliente.nome);
  const [empresa, setEmpresa]   = useState(cliente.empresa || "");
  const [cnpj, setCnpj]         = useState(cliente.cnpj || "");
  const [segmento, setSegmento] = useState(cliente.segmento || "");
  const [email, setEmail]       = useState(cliente.email || "");
  const [telefone, setTelefone] = useState(cliente.telefone || "");
  const [site, setSite]         = useState(cliente.site || "");
  const [cidade, setCidade]     = useState(cliente.cidade || "");
  const [estado, setEstado]     = useState(cliente.estado || "");
  const [origem, setOrigem]     = useState(cliente.origem || "");
  const [statusLead, setStatus] = useState(cliente.statusLead || "ativo");
  const [notas, setNotas]       = useState(cliente.notas || "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const save = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.put(`/clientes/${cliente.id}`, {
        nome, empresa: empresa || undefined, cnpj: cnpj || undefined,
        segmento: segmento || undefined, email: email || undefined,
        telefone: telefone || undefined, site: site || undefined,
        cidade: cidade || undefined, estado: estado || undefined,
        origem: origem || undefined, statusLead, notas: notas || undefined,
      });
      onSave(res.data); onClose();
    } catch (e: any) { setError(e.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Editar cliente</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SH2 label="DADOS DA EMPRESA" />
            <div style={{ gridColumn: "1/-1" }}>
              <FL2 text="NOME DA EMPRESA *" />
              <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
            </div>
            <div>
              <FL2 text="RAZÃO SOCIAL" />
              <input className="input-o" placeholder="Acme Soluções Ltda." value={empresa} onChange={e => setEmpresa(e.target.value)} />
            </div>
            <div>
              <FL2 text="CNPJ" />
              <input className="input-o" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
            </div>
            <div>
              <FL2 text="SEGMENTO" />
              <select className="input-o" value={segmento} onChange={e => setSegmento(e.target.value)}>
                <option value="">—</option>
                {SEGMENTOS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <FL2 text="SITE" />
              <input className="input-o" placeholder="https://empresa.com.br" value={site} onChange={e => setSite(e.target.value)} />
            </div>
            <div>
              <FL2 text="CIDADE" />
              <input className="input-o" placeholder="São Paulo" value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
            <div>
              <FL2 text="UF" />
              <select className="input-o" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">--</option>
                {ESTADOS_BR_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <SH2 label="CONTATO" />
            <div>
              <FL2 text="E-MAIL" />
              <input className="input-o" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <FL2 text="TELEFONE / WHATSAPP" />
              <input className="input-o" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <SH2 label="INFORMAÇÕES COMERCIAIS" />
            <div>
              <FL2 text="ORIGEM DO CLIENTE" />
              <select className="input-o" value={origem} onChange={e => setOrigem(e.target.value)}>
                <option value="">—</option>
                {ORIGENS_LIST.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FL2 text="STATUS" />
              <select className="input-o" value={statusLead} onChange={e => setStatus(e.target.value)}
                style={{ color: STATUS_LEAD_LIST.find(s => s.value === statusLead)?.cor, fontWeight: 500 }}>
                {STATUS_LEAD_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FL2 text="OBSERVAÇÕES" />
              <textarea className="input-o" value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>
        {error && <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-red)", fontSize: 12, marginTop: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex: 2 }} onClick={save} disabled={loading}>{loading ? <Spin /> : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Nota Modal ────────────────────────────────────────────────────────────────
function NotaModal({ clienteId, onClose, onSave }: { clienteId: string; onClose: () => void; onSave: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!titulo.trim()) { setError("Título é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      await api.post(`/clientes/${clienteId}/timeline/nota`, { titulo, descricao });
      onSave(); onClose();
    } catch (e: any) { setError(e.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>Adicionar nota</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>TÍTULO *</label>
            <input className="input-o" placeholder="Ex: Reunião de alinhamento" value={titulo} onChange={e => setTitulo(e.target.value)} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>DETALHE</label>
            <textarea className="input-o" placeholder="Descreva o que foi discutido, decidido..." value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} style={{ resize: "vertical" }} />
          </div>
          {error && <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-red)", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" style={{ flex: 2 }} onClick={save} disabled={loading}>{loading ? <Spin /> : "Salvar nota"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Contrato Modal ────────────────────────────────────────────────────────────
function ContratoModal({ clienteId, onClose, onSave }: { clienteId: string; onClose: () => void; onSave: () => void }) {
  const [tipo, setTipo] = useState("servico");
  const [plano, setPlano] = useState("");
  const [slaHoras, setSlaHoras] = useState("");
  const [valor, setValor] = useState("");
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setLoading(true); setError("");
    try {
      await api.post(`/clientes/${clienteId}/contratos`, {
        tipo, plano: plano || undefined,
        slaHoras: slaHoras ? parseInt(slaHoras) : undefined,
        valor: valor ? parseFloat(valor.replace(/[^\d,.]/g, "").replace(",", ".")) : undefined,
        vigenciaInicio: vigenciaInicio || undefined,
        vigenciaFim: vigenciaFim || undefined,
        observacoes: observacoes || undefined,
        ativo: true,
      });
      onSave(); onClose();
    } catch (e: any) { setError(e.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>Novo contrato</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>TIPO</label>
            <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="servico">Serviço</option>
              <option value="suporte">Suporte</option>
              <option value="licenca">Licença</option>
              <option value="projeto">Projeto</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>PLANO</label>
            <input className="input-o" placeholder="Ex: Basic, Pro, Enterprise" value={plano} onChange={e => setPlano(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>VALOR MENSAL (R$)</label>
            <input className="input-o" placeholder="R$ 0,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>SLA (horas)</label>
            <input className="input-o" type="number" placeholder="Ex: 8" value={slaHoras} onChange={e => setSlaHoras(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>INÍCIO DA VIGÊNCIA</label>
            <input className="input-o" type="date" value={vigenciaInicio} onChange={e => setVigenciaInicio(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>FIM DA VIGÊNCIA</label>
            <input className="input-o" type="date" value={vigenciaFim} onChange={e => setVigenciaFim(e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>OBSERVAÇÕES</label>
            <textarea className="input-o" value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} style={{ resize: "vertical" }} />
          </div>
        </div>
        {error && <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-red)", fontSize: 12, marginTop: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex: 2 }} onClick={save} disabled={loading}>{loading ? <Spin /> : "Criar contrato"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Visão Geral ──────────────────────────────────────────────────────────
function TabVisaoGeral({ ws, onAddNota, onReload }: { ws: Workspace; onAddNota: () => void; onReload: () => void }) {
  const { stats, projetos, chamadosRecentes, proximosMarcos, alertas, timeline } = ws;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Alertas */}
        {alertas.length > 0 && (
          <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>ALERTAS</span>
            </div>
            {alertas.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: "#fca5a5", paddingLeft: 22, marginBottom: 4, lineHeight: 1.5 }}>• {a}</div>
            ))}
          </div>
        )}

        {/* Projetos ativos */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Projetos ativos</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{stats.projetosAtivos} / {stats.projetosTotal}</span>
          </div>
          {projetos.filter(p => p.status === "EM_ANDAMENTO").length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Sem projetos em andamento</div>
          ) : (
            projetos.filter(p => p.status === "EM_ANDAMENTO").map(p => (
              <div key={p.id} style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.cor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 5 }}>{p.titulo}</div>
                  <div style={{ height: 4, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.progressoPct}%`, background: p.cor, borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{p.progressoPct}%</span>
                {p.dataFim && (
                  <span style={{ fontSize: 11, color: new Date(p.dataFim) < new Date() ? "#f87171" : "var(--text-muted)", flexShrink: 0 }}>
                    {new Date(p.dataFim).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Chamados recentes */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Chamados recentes</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{stats.chamadosAbertos} abertos</span>
          </div>
          {chamadosRecentes.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Sem chamados</div>
          ) : (
            chamadosRecentes.slice(0, 5).map(ch => {
              const st = STATUS_CHAMADO[ch.status] || { label: ch.status, color: "#94a3b8" };
              return (
                <div key={ch.id} style={{ padding: "11px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", flexShrink: 0, minWidth: 32 }}>#{ch.numero}</span>
                  <div style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.titulo}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIO_COLOR[ch.prioridade] || "#94a3b8" }} />
                    <span style={{ fontSize: 10, color: st.color, fontFamily: "var(--font-mono)", background: `${st.color}18`, padding: "2px 7px", borderRadius: 10 }}>{st.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "SLA", value: `${stats.slaCompliance}%`, color: stats.slaCompliance >= 80 ? "#34d399" : stats.slaCompliance >= 60 ? "#fbbf24" : "#f87171" },
            { label: "MRR", value: fmtMrr(stats.mrr) || "—", color: stats.mrr > 0 ? "var(--accent-green)" : "var(--text-muted)" },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Próximos marcos */}
        {proximosMarcos.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>PRÓXIMOS MARCOS</span>
            </div>
            {proximosMarcos.map(m => (
              <div key={m.id} style={{ padding: "11px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.project.cor, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{m.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.project.titulo}</div>
                </div>
                {m.dataAlvo && (
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", flexShrink: 0 }}>
                    {new Date(m.dataAlvo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timeline mini */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>ATIVIDADE RECENTE</span>
            <button
              onClick={onAddNota}
              style={{ fontSize: 10, color: "var(--accent-violet)", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
              + NOTA
            </button>
          </div>
          <div style={{ padding: "8px 0" }}>
            {timeline.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Sem atividade</div>
            ) : (
              timeline.slice(0, 6).map(ev => (
                <div key={ev.id} style={{ display: "flex", gap: 10, padding: "8px 16px", alignItems: "flex-start" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, color: "var(--accent-violet)",
                  }}>
                    {TIMELINE_ICON[ev.tipo] || TIMELINE_ICON.default}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.titulo}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {ev.user?.nome && `${ev.user.nome} · `}{fmtRelative(ev.criadoEm)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Projetos ─────────────────────────────────────────────────────────────
function TabProjetos({ projetos }: { projetos: Projeto[] }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        {["PROJETO", "STATUS", "PROGRESSO", "PRAZO", "MEMBROS"].map(h => (
          <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{h}</span>
        ))}
      </div>
      {projetos.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Nenhum projeto vinculado</div>
      ) : (
        projetos.map((p, i) => {
          const st = STATUS_PROJ[p.status] || { label: p.status, color: "#94a3b8" };
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 16, padding: "13px 20px", borderBottom: i < projetos.length - 1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.cor, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{p.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.totalTasks} tarefas</div>
                </div>
              </div>
              <span style={{ fontSize: 11, color: st.color, background: `${st.color}18`, padding: "3px 9px", borderRadius: 10, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{st.label}</span>
              <div>
                <div style={{ height: 5, background: "var(--bg-hover)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${p.progressoPct}%`, background: p.cor, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{p.progressoPct}%</span>
              </div>
              <span style={{ fontSize: 12, color: p.dataFim && new Date(p.dataFim) < new Date() && p.status === "EM_ANDAMENTO" ? "#f87171" : "var(--text-muted)" }}>
                {p.dataFim ? new Date(p.dataFim).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
              </span>
              <div style={{ display: "flex" }}>
                {p.membros.slice(0, 3).map((m, idx) => (
                  <div key={m.id} style={{ marginLeft: idx > 0 ? -6 : 0 }} title={m.nome}>
                    <Avatar nome={m.nome} size={22} />
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Tab: Chamados ─────────────────────────────────────────────────────────────
function TabChamados({ chamados }: { chamados: Chamado[] }) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 2fr 1fr 1fr 1fr", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        {["Nº", "TÍTULO", "STATUS", "PRIORIDADE", "ABERTO EM"].map(h => (
          <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{h}</span>
        ))}
      </div>
      {chamados.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Nenhum chamado</div>
      ) : (
        chamados.map((ch, i) => {
          const st = STATUS_CHAMADO[ch.status] || { label: ch.status, color: "#94a3b8" };
          return (
            <div key={ch.id} style={{ display: "grid", gridTemplateColumns: "auto 2fr 1fr 1fr 1fr", gap: 16, padding: "12px 20px", borderBottom: i < chamados.length - 1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: 32 }}>#{ch.numero}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{ch.titulo}</div>
                {ch.atendente && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ch.atendente.nome}</div>}
              </div>
              <span style={{ fontSize: 11, color: st.color, background: `${st.color}18`, padding: "3px 9px", borderRadius: 10, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{st.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIO_COLOR[ch.prioridade] || "#94a3b8" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "capitalize" }}>{ch.prioridade.toLowerCase()}</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(ch.criadoEm)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Tab: Contratos ────────────────────────────────────────────────────────────
function TabContratos({ clienteId, onAddContrato }: { clienteId: string; onAddContrato: () => void }) {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clientes/${clienteId}/contratos`);
      setContratos(res.data);
    } catch {} finally { setLoading(false); }
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spin /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={onAddContrato}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Novo contrato
        </button>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
          {["TIPO / PLANO", "VIGÊNCIA", "SLA", "VALOR/MÊS", "STATUS", ""].map(h => (
            <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{h}</span>
          ))}
        </div>
        {contratos.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Nenhum contrato cadastrado</div>
        ) : (
          contratos.map((ct, i) => (
            <div key={ct.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 16, padding: "13px 20px", borderBottom: i < contratos.length - 1 ? "1px solid var(--border-subtle)" : "none", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", textTransform: "capitalize" }}>{ct.tipo}</div>
                {ct.plano && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ct.plano}</div>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {ct.vigenciaInicio ? new Date(ct.vigenciaInicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                {ct.vigenciaFim && ` → ${new Date(ct.vigenciaFim).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}`}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ct.slaHoras ? `${ct.slaHoras}h` : "—"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: ct.valor ? "var(--accent-green)" : "var(--text-muted)" }}>
                {ct.valor ? fmtMrr(ct.valor) : "—"}
              </div>
              <span style={{
                fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 9px", borderRadius: 10,
                background: ct.ativo ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.12)",
                color: ct.ativo ? "#34d399" : "#94a3b8", border: `1px solid ${ct.ativo ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.2)"}`,
              }}>
                {ct.ativo ? "Ativo" : "Inativo"}
              </span>
              <span />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tab: Organização ──────────────────────────────────────────────────────────
function SolicitarProvisionamentoModal({ cliente, onClose, onSaved }: { cliente: Cliente; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nomeOrg: cliente.empresa || cliente.nome,
    contatoEmail: cliente.email || "",
    contatoNome: cliente.nome,
    contatoWhatsapp: cliente.telefone || "",
    planoSolicitado: "starter",
    observacoes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.nomeOrg || !form.contatoEmail) { setError("Nome e e-mail são obrigatórios"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/cadastro-requests", { ...form, clienteId: cliente.id });
      onSaved(); onClose();
    } catch (e: any) { setError(e?.response?.data?.message || "Erro ao criar solicitação"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700 }}>Solicitar Provisionamento</h3>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>NOME DA ORGANIZAÇÃO *</label>
            <input className="input-o" value={form.nomeOrg} onChange={e => setForm(f => ({ ...f, nomeOrg: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>E-MAIL DO CONTATO *</label>
            <input className="input-o" type="email" value={form.contatoEmail} onChange={e => setForm(f => ({ ...f, contatoEmail: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>NOME DO CONTATO</label>
            <input className="input-o" value={form.contatoNome} onChange={e => setForm(f => ({ ...f, contatoNome: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>WHATSAPP</label>
            <input className="input-o" value={form.contatoWhatsapp} onChange={e => setForm(f => ({ ...f, contatoWhatsapp: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>PLANO</label>
            <select className="input-o" value={form.planoSolicitado} onChange={e => setForm(f => ({ ...f, planoSolicitado: e.target.value }))}>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>OBSERVAÇÕES</label>
            <textarea className="input-o" rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} style={{ resize: "vertical" }} />
          </div>
        </div>
        {error && <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-red)", fontSize: 12, marginTop: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex: 2 }} onClick={save} disabled={loading}>{loading ? <Spin /> : "Enviar Solicitação"}</button>
        </div>
      </div>
    </div>
  );
}

function TabOrganizacao({ cliente, isMaster }: { cliente: Cliente; isMaster: boolean }) {
  const [orgData, setOrgData] = useState<any>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);

  useEffect(() => {
    if (cliente.tenantOrgId && isMaster) {
      setLoadingOrg(true);
      api.get(`/superadmin/organizations/${cliente.tenantOrgId}`)
        .then(r => setOrgData(r.data))
        .catch(() => {})
        .finally(() => setLoadingOrg(false));
    }
  }, [cliente.tenantOrgId, isMaster]);

  if (cliente.tenantOrgId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>ORGANIZAÇÃO PROVISIONADA</div>
          {loadingOrg ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 12 }}><Spin /> Carregando...</div>
          ) : orgData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: orgData.ativo ? "var(--accent-green)" : "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>{orgData.nome}</span>
                <code style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/{orgData.slug}</code>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "PLANO", value: orgData.plano || "—" },
                  { label: "STATUS COMERCIAL", value: orgData.statusComercial || "—" },
                  { label: "STATUS OPERACIONAL", value: orgData.statusOperacional || "—" },
                ].map(item => (
                  <div key={item.label} className="card" style={{ padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{orgData.usuarios} usuário{orgData.usuarios !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{orgData.chamados} chamado{orgData.chamados !== 1 ? "s" : ""}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Organização vinculada: <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{cliente.tenantOrgId}</code>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Sem organização provisionada</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.6 }}>
          Este cliente ainda não possui um tenant operacional no Orkiestri.
          {isMaster ? " Crie uma solicitação de provisionamento para iniciar o onboarding." : ""}
        </div>
      </div>
      {isMaster && !solicitacaoEnviada && (
        <button className="btn btn-violet" style={{ fontSize: 13 }} onClick={() => setSolicitarOpen(true)}>
          Solicitar Provisionamento
        </button>
      )}
      {solicitacaoEnviada && (
        <div style={{ fontSize: 12, color: "var(--accent-green)", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 8, padding: "10px 16px" }}>
          Solicitação enviada com sucesso. Aguardando aprovação no painel SA.
        </div>
      )}
      {solicitarOpen && (
        <SolicitarProvisionamentoModal
          cliente={cliente}
          onClose={() => setSolicitarOpen(false)}
          onSaved={() => setSolicitacaoEnviada(true)}
        />
      )}
    </div>
  );
}

// ── Tab: Timeline ─────────────────────────────────────────────────────────────
function TabTimeline({ clienteId, onAddNota }: { clienteId: string; onAddNota: () => void }) {
  const [items, setItems] = useState<TimelineEvento[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/clientes/${clienteId}/timeline`, { params: { page: p } });
      if (p === 1) setItems(res.data.items);
      else setItems(prev => [...prev, ...res.data.items]);
      setTotal(res.data.total);
      setPage(p);
    } catch {} finally { setLoading(false); }
  }, [clienteId]);

  useEffect(() => { load(1); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={onAddNota}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Adicionar nota
        </button>
      </div>

      <div style={{ position: "relative" }}>
        {/* Vertical line */}
        <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 1, background: "var(--border-subtle)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {loading && items.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spin /></div>
          ) : items.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Sem eventos na timeline</div>
          ) : (
            items.map(ev => (
              <div key={ev.id} style={{ display: "flex", gap: 16, paddingBottom: 20, paddingLeft: 0 }}>
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0, zIndex: 1,
                  background: ev.tipo === "nota" ? "rgba(124,58,237,0.1)" : "var(--bg-card)",
                  border: ev.tipo === "nota" ? "1px solid rgba(124,58,237,0.3)" : "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: ev.tipo === "nota" ? "var(--accent-violet)" : "var(--text-muted)",
                }}>
                  {TIMELINE_ICON[ev.tipo] || TIMELINE_ICON.default}
                </div>

                {/* Content */}
                <div className="card" style={{ flex: 1, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: ev.descricao ? 8 : 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{ev.titulo}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginLeft: 12 }}>
                      {fmtRelative(ev.criadoEm)}
                    </div>
                  </div>
                  {ev.descricao && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>{ev.descricao}</div>
                  )}
                  {ev.user && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Avatar nome={ev.user.nome} size={16} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ev.user.nome}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {items.length < total && (
          <div style={{ textAlign: "center", paddingLeft: 54, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => load(page + 1)} disabled={loading}>
              {loading ? <Spin /> : `Carregar mais (${total - items.length} restantes)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
const TABS = [
  { key: "overview",     label: "Visão Geral" },
  { key: "projetos",     label: "Projetos" },
  { key: "chamados",     label: "Chamados" },
  { key: "contratos",    label: "Contratos" },
  { key: "organizacao",  label: "Organização" },
  { key: "timeline",     label: "Timeline" },
];

export default function ClienteWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState("overview");
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [notaOpen, setNotaOpen] = useState(false);
  const [contratoOpen, setContratoOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/clientes/${id}/workspace`);
      setWs(res.data);
    } catch {
      router.replace("/dashboard/clientes");
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading || !ws) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-muted)" }}>
          <Spin /> Carregando workspace...
        </div>
      </div>
    );
  }

  const { cliente, stats } = ws;
  const color = scoreColor(cliente.saudeScore);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar>
        <button className="btn-icon" title="Editar cliente" onClick={() => setEditOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z" /></svg>
        </button>
        <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={() => setNotaOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Nota
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* ── Client Header ── */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 16 }}>
            {/* Avatar large */}
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(34,211,238,0.2))",
              border: "1px solid rgba(124,58,237,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: "var(--accent-violet)",
            }}>
              {initials(cliente.nome)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{cliente.nome}</h1>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 9px", borderRadius: 20,
                  background: `${color}14`, border: `1px solid ${color}35`, color,
                }}>
                  {scoreLabel(cliente.saudeScore)}
                </span>
                {!cliente.ativo && (
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 9px", borderRadius: 20, background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.2)", color: "#94a3b8" }}>
                    INATIVO
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {cliente.empresa && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{cliente.empresa}</span>
                  </span>
                )}
                {cliente.email && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cliente.email}</span>}
                {cliente.telefone && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cliente.telefone}</span>}
                {cliente.segmento && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "1px 8px" }}>{cliente.segmento}</span>}
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <ScoreRing score={cliente.saudeScore} size={56} />
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginTop: 4 }}>SAÚDE</div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { label: "projetos ativos", value: stats.projetosAtivos, color: "var(--accent-cyan)" },
                { label: "chamados abertos", value: stats.chamadosAbertos, color: stats.chamadosAbertos > 0 ? "var(--accent-amber)" : "var(--text-muted)" },
                { label: "SLA", value: `${stats.slaCompliance}%`, color: stats.slaCompliance >= 80 ? "#34d399" : stats.slaCompliance >= 60 ? "#fbbf24" : "#f87171" },
                { label: "MRR", value: fmtMrr(stats.mrr) || "—", color: stats.mrr > 0 ? "#34d399" : "var(--text-muted)" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            {cliente.portalToken && (
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.origin + "/portal/" + cliente.portalToken); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 8,
                  background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc", fontSize: 11, cursor: "pointer", transition: "all 0.15s",
                }}
                title="Copiar link do portal"
              >
                <span>🔗</span>
                <span>Link do Portal</span>
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: -1 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: "10px 18px", background: "none", border: "none", cursor: "pointer",
                  borderBottom: tab === t.key ? "2px solid var(--accent-violet)" : "2px solid transparent",
                  color: tab === t.key ? "var(--accent-violet)" : "var(--text-muted)",
                  fontFamily: "var(--font-display)", fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                  marginBottom: -1, transition: "color 0.12s",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div style={{ padding: 24 }} className="animate-up">
          {tab === "overview"    && <TabVisaoGeral ws={ws} onAddNota={() => setNotaOpen(true)} onReload={load} />}
          {tab === "projetos"    && <TabProjetos projetos={ws.projetos} />}
          {tab === "chamados"    && <TabChamados chamados={ws.chamadosRecentes} />}
          {tab === "contratos"   && <TabContratos clienteId={id} onAddContrato={() => setContratoOpen(true)} />}
          {tab === "organizacao" && <TabOrganizacao cliente={cliente} isMaster={!!user?.isMaster} />}
          {tab === "timeline"    && <TabTimeline clienteId={id} onAddNota={() => setNotaOpen(true)} />}
        </div>
      </div>

      {editOpen && (
        <EditClienteModal
          cliente={cliente}
          onClose={() => setEditOpen(false)}
          onSave={updated => { setWs(prev => prev ? { ...prev, cliente: { ...prev.cliente, ...updated } } : prev); }}
        />
      )}
      {notaOpen && (
        <NotaModal clienteId={id} onClose={() => setNotaOpen(false)} onSave={load} />
      )}
      {contratoOpen && (
        <ContratoModal clienteId={id} onClose={() => setContratoOpen(false)} onSave={load} />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
