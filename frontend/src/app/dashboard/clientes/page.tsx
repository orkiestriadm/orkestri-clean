"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
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
  responsavel?: { id: string; nome: string; avatar?: string } | null;
  projetosAtivos?: number;
  chamadosAbertos?: number;
  mrr?: number;
  valorEstimado?: number | null;
  probabilidade?: number | null;
  dataFechamento?: string | null;
  tenantOrgId?: string | null;
  criadoEm: string;
};

type PipelineData = Record<string, Cliente[]>;

const PIPELINE_STAGES = [
  { key: "lead",        label: "Lead",        cor: "#94a3b8", icon: "●" },
  { key: "prospect",    label: "Prospect",    cor: "#60a5fa", icon: "◎" },
  { key: "oportunidade",label: "Oportunidade",cor: "#a78bfa", icon: "◈" },
  { key: "negociacao",  label: "Negociação",  cor: "#fbbf24", icon: "◆" },
  { key: "ativo",       label: "Cliente",     cor: "#34d399", icon: "✦" },
  { key: "inativo",     label: "Inativo",     cor: "#f87171", icon: "○" },
];

const SEGMENTOS = ["Tecnologia","Varejo","Indústria","Saúde","Educação","Finanças","Serviços","Agronegócio","Outro"];
const ORIGENS   = ["Indicação","Site / Blog","Redes Sociais","Cold Call / Email","Evento / Feiras","Parceria","Outro"];
const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

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
function fmtCurrency(v: number) {
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

function FL({ text }: { text: string }) {
  return <label style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{text}</label>;
}
function SH({ label }: { label: string }) {
  return <div style={{ gridColumn: "1/-1", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8, marginTop: 4 }}>{label}</div>;
}

// ── Modal Novo Cliente ─────────────────────────────────────────────────────────
function ClienteModal({ onClose, onSave, defaultStatus = "lead" }: { onClose: () => void; onSave: () => void; defaultStatus?: string }) {
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
  const [statusLead, setStatus]   = useState(defaultStatus);
  const [valorEstimado, setValor] = useState("");
  const [probabilidade, setProb]  = useState("");
  const [notas, setNotas]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const save = async () => {
    if (!nome.trim()) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/clientes", {
        nome, empresa: empresa || undefined, cnpj: cnpj || undefined,
        segmento: segmento || undefined, email: email || undefined,
        telefone: telefone || undefined, site: site || undefined,
        cidade: cidade || undefined, estado: estado || undefined,
        origem: origem || undefined, notas: notas || undefined,
        statusLead,
        valorEstimado: valorEstimado ? Number(valorEstimado) : undefined,
        probabilidade: probabilidade ? Number(probabilidade) : undefined,
      });
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || "Erro ao salvar");
    } finally { setLoading(false); }
  };

  const stageInfo = PIPELINE_STAGES.find(s => s.key === statusLead);

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Novo cliente no CRM</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SH label="DADOS DA EMPRESA" />
            <div style={{ gridColumn: "1/-1" }}>
              <FL text="NOME DA EMPRESA *" />
              <input className="input-o" placeholder="Ex: Acme Corp" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
            </div>
            <div><FL text="RAZÃO SOCIAL" /><input className="input-o" placeholder="Acme Soluções Ltda." value={empresa} onChange={e => setEmpresa(e.target.value)} /></div>
            <div><FL text="CNPJ" /><input className="input-o" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} /></div>
            <div>
              <FL text="SEGMENTO" />
              <select className="input-o" value={segmento} onChange={e => setSegmento(e.target.value)}>
                <option value="">Selecionar...</option>
                {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><FL text="SITE" /><input className="input-o" placeholder="https://empresa.com.br" value={site} onChange={e => setSite(e.target.value)} /></div>
            <div><FL text="CIDADE" /><input className="input-o" placeholder="São Paulo" value={cidade} onChange={e => setCidade(e.target.value)} /></div>
            <div>
              <FL text="UF" />
              <select className="input-o" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">--</option>
                {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <SH label="CONTATO" />
            <div><FL text="E-MAIL" /><input className="input-o" type="email" placeholder="contato@empresa.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><FL text="TELEFONE / WHATSAPP" /><input className="input-o" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
            <SH label="PIPELINE COMERCIAL" />
            <div>
              <FL text="ETAPA NO PIPELINE" />
              <select className="input-o" value={statusLead} onChange={e => setStatus(e.target.value)}
                style={{ color: stageInfo?.cor, fontWeight: 600 }}>
                {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
              </select>
            </div>
            <div>
              <FL text="ORIGEM" />
              <select className="input-o" value={origem} onChange={e => setOrigem(e.target.value)}>
                <option value="">Selecionar...</option>
                {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><FL text="VALOR ESTIMADO (R$)" /><input className="input-o" type="number" placeholder="Ex: 50000" value={valorEstimado} onChange={e => setValor(e.target.value)} /></div>
            <div>
              <FL text="PROBABILIDADE (%)" />
              <input className="input-o" type="number" min="0" max="100" placeholder="Ex: 60" value={probabilidade} onChange={e => setProb(e.target.value)} />
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

// ── Card do Pipeline ──────────────────────────────────────────────────────────
function PipelineCard({ c, onMoveStage }: { c: Cliente; onMoveStage: (id: string, stage: string) => void }) {
  const stage = PIPELINE_STAGES.find(s => s.key === c.statusLead) || PIPELINE_STAGES[0];
  const [showMove, setShowMove] = useState(false);

  return (
    <div
      className="card"
      style={{ padding: "12px 14px", cursor: "pointer", transition: "all 0.15s", marginBottom: 8, position: "relative" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "translateY(0)"}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <Link href={`/dashboard/clientes/${c.id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `${stage.cor}20`, border: `1px solid ${stage.cor}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: stage.cor,
            }}>
              {initials(c.nome)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.nome}
              </div>
              {c.empresa && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.empresa}
                </div>
              )}
            </div>
          </div>
        </Link>
        <button
          className="btn-icon"
          onClick={() => setShowMove(!showMove)}
          title="Mover etapa"
          style={{ padding: "2px 4px", flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Valor estimado */}
      {c.valorEstimado && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
          {fmtCurrency(c.valorEstimado)}
          {c.probabilidade != null && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
              {c.probabilidade}%
            </span>
          )}
        </div>
      )}

      {/* Tenant provisionado */}
      {c.tenantOrgId && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
          <span style={{ fontSize: 10, color: "#34d399", fontFamily: "var(--font-mono)" }}>Org provisionada</span>
        </div>
      )}

      {/* Move stage dropdown */}
      {showMove && (
        <div style={{
          position: "absolute", top: "100%", right: 0, zIndex: 100,
          background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
          borderRadius: 8, padding: 6, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          {PIPELINE_STAGES.filter(s => s.key !== c.statusLead).map(s => (
            <button
              key={s.key}
              onClick={() => { onMoveStage(c.id, s.key); setShowMove(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "6px 10px", border: "none", cursor: "pointer", borderRadius: 6,
                background: "transparent", color: s.cor, fontSize: 12, fontWeight: 500, textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pipeline View ─────────────────────────────────────────────────────────────
function PipelineView({ onRefresh }: { onRefresh: () => void }) {
  const [pipeline, setPipeline] = useState<PipelineData>({});
  const [loading, setLoading] = useState(true);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/clientes/pipeline");
      setPipeline(res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPipeline(); }, [loadPipeline]);

  const moveStage = async (id: string, newStage: string) => {
    try {
      await api.patch(`/clientes/${id}/status`, { statusLead: newStage });
      await loadPipeline();
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80, gap: 12 }}>
        <Spin />
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando pipeline...</span>
      </div>
    );
  }

  // Stats do pipeline
  const totalValor = PIPELINE_STAGES
    .filter(s => !["ativo", "inativo"].includes(s.key))
    .flatMap(s => pipeline[s.key] || [])
    .reduce((sum, c) => sum + (c.valorEstimado || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Pipeline stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {PIPELINE_STAGES.map(s => {
          const items = pipeline[s.key] || [];
          const valor = items.reduce((sum, c) => sum + (c.valorEstimado || 0), 0);
          return (
            <div key={s.key} style={{
              padding: "8px 14px", borderRadius: 8,
              background: `${s.cor}10`, border: `1px solid ${s.cor}25`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ color: s.cor, fontSize: 14 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.cor }}>{items.length}</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>{s.label.toUpperCase()}</div>
              </div>
              {valor > 0 && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                  {fmtCurrency(valor)}
                </div>
              )}
            </div>
          );
        })}
        {totalValor > 0 && (
          <div style={{
            padding: "8px 14px", borderRadius: 8, marginLeft: "auto",
            background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>PIPELINE TOTAL</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>{fmtCurrency(totalValor)}</div>
          </div>
        )}
      </div>

      {/* Kanban columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, overflowX: "auto" }}>
        {PIPELINE_STAGES.map(stage => {
          const items = pipeline[stage.key] || [];
          return (
            <div key={stage.key} style={{ minWidth: 200 }}>
              {/* Column header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: "8px 8px 0 0",
                background: `${stage.cor}15`, borderBottom: `2px solid ${stage.cor}`,
                marginBottom: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: stage.cor, fontSize: 13 }}>{stage.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: stage.cor }}>{stage.label}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: stage.cor,
                  background: `${stage.cor}20`, padding: "1px 6px", borderRadius: 10,
                  fontFamily: "var(--font-mono)",
                }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ minHeight: 100 }}>
                {items.length === 0 ? (
                  <div style={{
                    padding: "20px 10px", textAlign: "center",
                    border: `1px dashed ${stage.cor}30`, borderRadius: 8,
                    color: "var(--text-muted)", fontSize: 11,
                  }}>
                    Nenhum
                  </div>
                ) : (
                  items.map(c => (
                    <PipelineCard key={c.id} c={c} onMoveStage={moveStage} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Card do Cliente (grid view) ───────────────────────────────────────────────
function ClienteCard({ c }: { c: Cliente }) {
  const color = scoreColor(c.saudeScore);
  const label = scoreLabel(c.saudeScore);
  const stage = PIPELINE_STAGES.find(s => s.key === c.statusLead);
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

        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            padding: "2px 8px", borderRadius: 20,
            background: `${color}18`, border: `1px solid ${color}40`, color,
          }}>
            {label}
          </span>
          {stage && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              padding: "2px 8px", borderRadius: 20,
              background: `${stage.cor}15`, border: `1px solid ${stage.cor}35`, color: stage.cor,
            }}>
              {stage.icon} {stage.label}
            </span>
          )}
          {c.tenantOrgId && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              padding: "2px 8px", borderRadius: 20,
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399",
            }}>
              ✦ Org ativa
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          {[
            { label: "PROJETOS", value: c.projetosAtivos ?? 0, accent: (c.projetosAtivos ?? 0) > 0 ? "var(--accent-cyan)" : "var(--text-muted)" },
            { label: "CHAMADOS", value: c.chamadosAbertos ?? 0, accent: (c.chamadosAbertos ?? 0) > 0 ? "var(--accent-amber)" : "var(--text-muted)" },
            { label: "MRR", value: fmtMrr(c.mrr ?? 0) || "—", accent: (c.mrr ?? 0) > 0 ? "var(--accent-green)" : "var(--text-muted)" },
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

// ── Row do Cliente (list view) ────────────────────────────────────────────────
function ClienteRow({ c, idx, total }: { c: Cliente; idx: number; total: number }) {
  const color = scoreColor(c.saudeScore);
  const stage = PIPELINE_STAGES.find(s => s.key === c.statusLead);
  return (
    <Link href={`/dashboard/clientes/${c.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto auto auto",
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
          {stage && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px",
              borderRadius: 20, background: `${stage.cor}15`, color: stage.cor,
              border: `1px solid ${stage.cor}30`,
            }}>
              {stage.icon} {stage.label}
            </span>
          )}
          {c.responsavel && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{c.responsavel.nome}</div>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.segmento || "—"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <ScoreRing score={c.saudeScore} size={34} />
          <span style={{ fontSize: 10, color, fontFamily: "var(--font-mono)" }}>{scoreLabel(c.saudeScore)}</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: (c.projetosAtivos ?? 0) > 0 ? "var(--accent-cyan)" : "var(--text-muted)" }}>{c.projetosAtivos ?? 0}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>PROJETOS</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: (c.chamadosAbertos ?? 0) > 0 ? "var(--accent-amber)" : "var(--text-muted)" }}>{c.chamadosAbertos ?? 0}</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>CHAMADOS</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {(c.mrr ?? 0) > 0
            ? <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-green)" }}>{fmtMrr(c.mrr ?? 0)}</div>
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
  const [viewMode, setViewMode] = useState<"grid" | "list" | "pipeline">("grid");
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

  const total = clientes.length;
  const saudaveis = clientes.filter(c => c.saudeScore >= 80).length;
  const atencao = clientes.filter(c => c.saudeScore >= 60 && c.saudeScore < 80).length;
  const criticos = clientes.filter(c => c.saudeScore < 60).length;
  const mrrTotal = clientes.reduce((s, c) => s + (c.mrr ?? 0), 0);

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

        {/* Stats Cards */}
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

        {/* Toolbar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {viewMode !== "pipeline" && (
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
          )}

          {viewMode !== "pipeline" && (
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
          )}

          {/* View toggle — inclui Pipeline */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-hover)", borderRadius: 8, padding: 3, marginLeft: "auto" }}>
            {[
              { key: "grid", title: "Grid", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg> },
              { key: "list", title: "Lista", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg> },
              { key: "pipeline", title: "Pipeline", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12H3M6 8l-4 4 4 4M18 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key as any)}
                className="btn-icon"
                title={v.title}
                style={{ background: viewMode === v.key ? "var(--bg-card)" : "transparent", borderRadius: 6 }}
              >
                {v.icon}
              </button>
            ))}
          </div>

          <button className="btn-icon" onClick={load} title="Atualizar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {viewMode === "pipeline" ? (
          <PipelineView onRefresh={load} />
        ) : loading ? (
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
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto auto auto", gap: 16, padding: "10px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
              {["CLIENTE", "ETAPA / RESP.", "SEGMENTO", "SAÚDE", "PROJETOS", "CHAMADOS", "MRR"].map(h => (
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
