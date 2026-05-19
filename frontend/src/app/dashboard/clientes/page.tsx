"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import CsvImportModal from "@/components/ui/CsvImportModal";

// ── Types ─────────────────────────────────────────────────────────────────────
type Cliente = {
  id: string;
  nome: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  origem?: string;
  statusLead: string;
  ativo: boolean;
  saudeScore: number;
  responsavel?: { id: string; nome: string } | null;
  projetosAtivos: number;
  chamadosAbertos: number;
  mrr: number;
  criadoEm: string;
};

const SEGMENTOS = ["Tecnologia","Varejo","Indústria","Saúde","Educação","Finanças","Serviços","Agronegócio","Outro"];
const ORIGENS   = ["Indicação","Site / Blog","Redes Sociais","Cold Call / Email","Evento / Feiras","Parceria","Outro"];
const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const STATUS_LEAD = [
  { value:"ativo",     label:"Ativo",       cor:"#34d399" },
  { value:"inativo",   label:"Inativo",     cor:"#f87171" },
  { value:"vip",       label:"Cliente VIP", cor:"#fbbf24" },
  { value:"prospecto", label:"Prospecto",   cor:"#94a3b8" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 80) return "#34d399";
  if (s >= 60) return "#fbbf24";
  return "#f87171";
}
function scoreLabel(s: number) {
  if (s >= 80) return "Saudável";
  if (s >= 60) return "Atenção";
  return "Crítico";
}
function fmtMrr(v: number) {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function initials(nome: string) {
  return nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function Spin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="var(--font-mono)">
        {score}
      </text>
    </svg>
  );
}

// ── Shared label helper ───────────────────────────────────────────────────────
function FL({ text }: { text: string }) {
  return <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{text}</label>;
}
function SH({ label }: { label: string }) {
  return <div style={{ gridColumn: "1/-1", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginTop: 4 }}>{label}</div>;
}

// ── Modal Novo Cliente ─────────────────────────────────────────────────────────
function ClienteModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [nome, setNome]           = useState("");
  const [empresa, setEmpresa]     = useState("");
  const [cnpj, setCnpj]           = useState("");
  const [segmento, setSegmento]   = useState("");
  const [email, setEmail]         = useState("");
  const [telefone, setTelefone]   = useState("");
  const [site, setSite]           = useState("");
  const [cidade, setCidade]       = useState("");
  const [estado, setEstado]       = useState("");
  const [origem, setOrigem]       = useState("");
  const [statusLead, setStatus]   = useState("ativo");
  const [notas, setNotas]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const save = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/clientes", {
        nome,
        empresa: empresa || undefined,
        cnpj: cnpj || undefined,
        segmento: segmento || undefined,
        email: email || undefined,
        telefone: telefone || undefined,
        site: site || undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        origem: origem || undefined,
        notas: notas || undefined,
        statusLead,
      });
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || "Erro ao salvar");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Novo cliente</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SH label="DADOS DA EMPRESA" />
            <div style={{ gridColumn: "1/-1" }}>
              <FL text="NOME DA EMPRESA *" />
              <input className="input-o" placeholder="Ex: Acme Corp" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
            </div>
            <div>
              <FL text="RAZÃO SOCIAL" />
              <input className="input-o" placeholder="Acme Soluções Ltda." value={empresa} onChange={e => setEmpresa(e.target.value)} />
            </div>
            <div>
              <FL text="CNPJ" />
              <input className="input-o" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} />
            </div>
            <div>
              <FL text="SEGMENTO" />
              <select className="input-o" value={segmento} onChange={e => setSegmento(e.target.value)}>
                <option value="">Selecionar...</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <FL text="SITE" />
              <input className="input-o" placeholder="https://empresa.com.br" value={site} onChange={e => setSite(e.target.value)} />
            </div>
            <div>
              <FL text="CIDADE" />
              <input className="input-o" placeholder="São Paulo" value={cidade} onChange={e => setCidade(e.target.value)} />
            </div>
            <div>
              <FL text="UF" />
              <select className="input-o" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">--</option>
                {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <SH label="CONTATO" />
            <div>
              <FL text="E-MAIL" />
              <input className="input-o" type="email" placeholder="contato@empresa.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <FL text="TELEFONE / WHATSAPP" />
              <input className="input-o" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <SH label="INFORMAÇÕES COMERCIAIS" />
            <div>
              <FL text="ORIGEM DO CLIENTE" />
              <select className="input-o" value={origem} onChange={e => setOrigem(e.target.value)}>
                <option value="">Selecionar...</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FL text="STATUS" />
              <select className="input-o" value={statusLead} onChange={e => setStatus(e.target.value)}
                style={{ color: STATUS_LEAD.find(s => s.value === statusLead)?.cor, fontWeight: 500 }}>
                {STATUS_LEAD.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <FL text="OBSERVAÇÕES" />
              <textarea className="input-o" placeholder="Contexto inicial, origem do cliente..." value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "10px 14px", color: "var(--accent-red)", fontSize: 12, marginTop: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-violet" style={{ flex: 2 }} onClick={save} disabled={loading}>
            {loading ? <Spin /> : "Cadastrar cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card do Cliente ───────────────────────────────────────────────────────────
function ClienteCard({ c }: { c: Cliente }) {
  const color = scoreColor(c.saudeScore);
  const label = scoreLabel(c.saudeScore);
  return (
    <Link href={`/dashboard/clientes/${c.id}`} style={{ textDecoration: "none" }}>
      <div
        className="card"
        style={{
          padding: "16px 18px",
          cursor: "pointer",
          transition: "all 0.15s",
          borderColor: c.saudeScore < 60 ? "rgba(248,113,113,0.25)" : c.saudeScore < 80 ? "rgba(251,191,36,0.2)" : "var(--border-subtle)",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "translateY(0)"}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,rgba(124,58,237,0.25),rgba(34,211,238,0.2))",
              border: "1px solid rgba(124,58,237,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "var(--accent-violet)",
            }}>
              {initials(c.nome)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.nome}
              </div>
              {c.empresa && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.empresa}
                </div>
              )}
            </div>
          </div>
          <ScoreRing score={c.saudeScore} size={42} />
        </div>

        {/* Status badge + segmento */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            padding: "2px 8px", borderRadius: 20,
            background: `${color}18`, border: `1px solid ${color}40`, color,
          }}>
            {label}
          </span>
          {c.segmento && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              padding: "2px 8px", borderRadius: 20,
              background: "var(--bg-glass)", border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
            }}>
              {c.segmento}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          {[
            { label: "PROJETOS", value: c.projetosAtivos, accent: c.projetosAtivos > 0 ? "var(--accent-cyan)" : "var(--text-muted)" },
            { label: "CHAMADOS", value: c.chamadosAbertos, accent: c.chamadosAbertos > 0 ? "var(--accent-amber)" : "var(--text-muted)" },
            { label: "MRR", value: fmtMrr(c.mrr) || "—", accent: c.mrr > 0 ? "var(--accent-green)" : "var(--text-muted)" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: stat.accent, fontFamily: "var(--font-mono)" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Responsável */}
        {c.responsavel && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(34,211,238,0.2))",
              border: "1px solid rgba(124,58,237,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 700, color: "var(--accent-violet)",
            }}>
              {initials(c.responsavel.nome)}
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.responsavel.nome}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Row do Cliente (view lista) ───────────────────────────────────────────────
function ClienteRow({ c, idx, total }: { c: Cliente; idx: number; total: number }) {
  const color = scoreColor(c.saudeScore);
  return (
    <Link href={`/dashboard/clientes/${c.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "2fr 1.2fr auto auto auto auto",
          gap: 16, padding: "13px 20px", alignItems: "center",
          borderBottom: idx < total - 1 ? "1px solid var(--border-subtle)" : "none",
          transition: "background 0.12s", cursor: "pointer",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(34,211,238,0.15))",
            border: "1px solid rgba(124,58,237,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "var(--accent-violet)",
          }}>
            {initials(c.nome)}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{c.nome}</div>
            {c.empresa && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.empresa}</div>}
          </div>
        </div>
        <div>
          {c.segmento && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.segmento}</span>}
          {c.responsavel && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.responsavel.nome}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <ScoreRing score={c.saudeScore} size={34} />
          <span style={{ fontSize: 10, color, fontFamily: "var(--font-mono)" }}>{scoreLabel(c.saudeScore)}</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.projetosAtivos > 0 ? "var(--accent-cyan)" : "var(--text-muted)" }}>{c.projetosAtivos}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>PROJETOS</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: c.chamadosAbertos > 0 ? "var(--accent-amber)" : "var(--text-muted)" }}>{c.chamadosAbertos}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CHAMADOS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {c.mrr > 0
            ? <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}>{fmtMrr(c.mrr)}</div>
            : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>MRR</div>
        </div>
      </div>
    </Link>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "saudavel" | "atencao" | "critico">("todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/clientes", { params: { includeStats: true } });
      setClientes(res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total = clientes.length;
  const saudaveis = clientes.filter(c => c.saudeScore >= 80).length;
  const atencao = clientes.filter(c => c.saudeScore >= 60 && c.saudeScore < 80).length;
  const criticos = clientes.filter(c => c.saudeScore < 60).length;
  const mrrTotal = clientes.reduce((s, c) => s + c.mrr, 0);

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = clientes.filter(c => {
    const matchSearch = !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.empresa || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.segmento || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filtroStatus === "todos" ? true :
      filtroStatus === "saudavel" ? c.saudeScore >= 80 :
      filtroStatus === "atencao" ? (c.saudeScore >= 60 && c.saudeScore < 80) :
      c.saudeScore < 60;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar>
        <button className="btn" style={{ fontSize: 12 }} onClick={() => setImportOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Importar CSV
        </button>
        <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={() => setModalOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Novo cliente
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Stats Cards ── */}
        <div className="animate-up" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[
            { label: "TOTAL CLIENTES", value: total, sub: "carteira ativa", color: "var(--accent-violet)" },
            { label: "SAUDÁVEIS", value: saudaveis, sub: "score ≥ 80", color: "#34d399" },
            { label: "ATENÇÃO", value: atencao, sub: "score 60–79", color: "#fbbf24" },
            { label: "MRR TOTAL", value: fmtMrr(mrrTotal) || "R$ 0", sub: `${criticos} críticos`, color: "var(--accent-cyan)" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              className="input-o"
              placeholder="Buscar cliente ou empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>

          {/* Filtros de saúde */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-hover)", borderRadius: 8, padding: 3 }}>
            {[
              { key: "todos", label: "Todos" },
              { key: "saudavel", label: "Saudável" },
              { key: "atencao", label: "Atenção" },
              { key: "critico", label: "Crítico" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroStatus(f.key as any)}
                style={{
                  padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12,
                  background: filtroStatus === f.key ? "var(--bg-card)" : "transparent",
                  color: filtroStatus === f.key ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: filtroStatus === f.key ? 600 : 400,
                  transition: "all 0.12s",
                  boxShadow: filtroStatus === f.key ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-hover)", borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setViewMode("grid")}
              className="btn-icon"
              title="Grid"
              style={{ background: viewMode === "grid" ? "var(--bg-card)" : "transparent", borderRadius: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="btn-icon"
              title="Lista"
              style={{ background: viewMode === "list" ? "var(--bg-card)" : "transparent", borderRadius: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          <button className="btn-icon" onClick={load} title="Atualizar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80, gap: 12 }}>
            <Spin />
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando clientes...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            <p style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </p>
            {!search && (
              <button className="btn btn-violet" style={{ marginTop: 16, fontSize: 12 }} onClick={() => setModalOpen(true)}>
                Cadastrar primeiro cliente
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="animate-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map(c => <ClienteCard key={c.id} c={c} />)}
          </div>
        ) : (
          <div className="animate-up card" style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr auto auto auto auto", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              {["CLIENTE", "SEGMENTO / RESP.", "SAÚDE", "PROJETOS", "CHAMADOS", "MRR"].map(h => (
                <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "var(--text-muted)" }}>{h}</span>
              ))}
            </div>
            {filtered.map((c, i) => <ClienteRow key={c.id} c={c} idx={i} total={filtered.length} />)}
          </div>
        )}
      </div>

      {modalOpen && <ClienteModal onClose={() => setModalOpen(false)} onSave={load} />}
      {importOpen && <CsvImportModal type="clientes" onClose={() => setImportOpen(false)} onDone={load} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
