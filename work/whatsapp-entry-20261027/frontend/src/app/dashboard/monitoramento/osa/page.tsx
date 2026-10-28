"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { ChevronLeft, Pencil, RefreshCw, FolderClock, X, Server, Clock, Activity, Zap, Database, Search, Loader2 } from "lucide-react";

type Osa = {
  id: string; descricao: string; ip: string;
  serie?: string | null; sequencial?: string | null; ultimoArquivo?: string | null;
  valorAtual?: string | null; servicoEstado?: string | null;
  ultimaAtualizacao?: string | null; ultimoCheckEm?: string | null;
  tempoMaxMin: number; intervaloSeg: number; ativo: boolean;
  status: string; ultimoErro?: string | null;
  fonte?: "smb" | "zabbix";
  n1Sequencial?: number | null; atraso?: number | null; n1Atualizado?: string | null;
};

const STATUS: Record<string, { dot: string; fg: string; soft: string; label: string }> = {
  ONLINE:       { dot: "🟢", fg: "#16a34a", soft: "rgba(34,197,94,0.12)",  label: "Online" },
  ATENCAO:      { dot: "🟡", fg: "#b45309", soft: "rgba(245,158,11,0.14)", label: "Atenção" },
  ATRASADO:     { dot: "🔴", fg: "#dc2626", soft: "rgba(239,68,68,0.12)",  label: "Atrasado" },
  ERRO:         { dot: "⚠️", fg: "#dc2626", soft: "rgba(239,68,68,0.12)",  label: "Erro" },
  DESCONHECIDO: { dot: "⚪", fg: "#64748b", soft: "rgba(148,163,184,0.14)",label: "Aguardando" },
};

function tempoDesde(iso?: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}
// Cor do atraso (N1 esperado − processado). Limiar ajustável.
const atrasoCor = (a?: number | null) => {
  if (a == null) return "var(--text-muted)";
  if (a <= 0) return "#16a34a";
  if (a <= 1000) return "#b45309";
  return "#dc2626";
};
const fmtHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function OsaPage() {
  const [lista,    setLista]    = useState<Osa[]>([]);
  const [zabbix,  setZabbix]   = useState<Osa[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [, setTick] = useState(0);
  const [form,    setForm]      = useState<Osa | null>(null);
  const [saving,  setSaving]    = useState(false);

  const load = useCallback(async () => {
    try {
      const [smb, zbx] = await Promise.allSettled([
        api.get("/osa"),
        api.get("/osa/zabbix-live"),
      ]);
      if (smb.status === "fulfilled") setLista(smb.value.data || []);
      if (zbx.status === "fulfilled") setZabbix((zbx.value.data || []).map((m: any) => ({ ...m, fonte: "zabbix" })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t  = setInterval(load, 15000);
    const t2 = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [load]);

  const todos = useMemo(() => [...zabbix, ...lista], [zabbix, lista]);

  const kpis = useMemo(() => ({
    total:    todos.length,
    online:   todos.filter((m) => m.status === "ONLINE").length,
    alerta:   todos.filter((m) => m.status === "ATENCAO").length,
    atrasado: todos.filter((m) => m.status === "ATRASADO" || m.status === "ERRO").length,
  }), [todos]);

  const salvar = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch(`/osa/${form.id}`, {
        descricao: form.descricao, tempoMaxMin: form.tempoMaxMin, intervaloSeg: form.intervaloSeg, ativo: form.ativo,
      });
      setForm(null); load();
    } finally { setSaving(false); }
  };

  return (
    <>
      <Topbar />
      <div className="page-content">
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "20px 22px 60px" }}>
          <Link href="/dashboard/monitoramento" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 8 }}>
            <ChevronLeft size={14} /> Voltar ao Monitoramento
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-red)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(220,38,38,0.6)" }}>
              <FolderClock size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Monitoramento OSA</h1>
              <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: 13 }}>
                Último <code>.tag</code> processado — via Zabbix (Windows) e SMB.
              </p>
            </div>
            <button onClick={load} className="btn btn-ghost" style={{ fontSize: 12, marginLeft: "auto" }}><RefreshCw size={14} /></button>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, margin: "20px 0 22px" }}>
            <Kpi label="Servidores OSA" valor={kpis.total}    cor="var(--text-primary)" icon={Server} />
            <Kpi label="Recebendo"      valor={kpis.online}   cor="#16a34a"              icon={Activity} />
            <Kpi label="Em atenção"     valor={kpis.alerta}   cor="#b45309"              icon={Clock} />
            <Kpi label="Atrasados"      valor={kpis.atrasado} cor={kpis.atrasado ? "#dc2626" : "var(--text-muted)"} icon={Clock} />
          </div>

          {/* Consulta sob demanda do sequencial no N1 */}
          <ConsultaN1 />

          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Carregando…</p>
          ) : todos.length === 0 ? (
            <div className="card-premium" style={{ textAlign: "center", padding: "56px 20px", color: "var(--text-muted)" }}>
              Nenhum host OSA encontrado.<br />
              Configure o Zabbix com <code>fadami.tag.recebido</code> ou adicione um monitor SMB.
            </div>
          ) : (
            <>
              {/* Seção Zabbix */}
              {zabbix.length > 0 && (
                <>
                  <SectionHeader label="Via Zabbix" icon={<Zap size={13} />} cor="var(--accent-violet)" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16, marginBottom: 28 }}>
                    {zabbix.map((m) => <OsaCard key={m.id} m={m} onEdit={undefined} />)}
                  </div>
                </>
              )}

              {/* Seção SMB */}
              {lista.length > 0 && (
                <>
                  <SectionHeader label="Via SMB" icon={<Server size={13} />} cor="var(--accent-cyan)" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
                    {lista.map((m) => <OsaCard key={m.id} m={m} onEdit={() => setForm({ ...m })} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {form && <EditModal form={form} setForm={setForm} salvar={salvar} saving={saving} />}
    </>
  );
}

function SectionHeader({ label, icon, cor }: { label: string; icon: React.ReactNode; cor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 11, fontWeight: 700, color: cor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {icon} {label}
    </div>
  );
}

// Nome de cada OSA por ID_OSA (do N1)
const OSA_NOMES: Record<number, string> = {
  1: "CGMP", 3: "GreenPass", 4: "Movemais", 5: "Veloe", 6: "Conectcar",
};
// Mesmo nome logico, indexado pela SERIE (cada card do Zabbix tem a serie do .tag).
const OSA_NOME_POR_SERIE: Record<number, string> = {
  172: "CGMP", 266: "GreenPass", 99: "Movemais", 138: "Veloe", 263: "Conectcar",
};

function ConsultaN1() {
  const [host, setHost] = useState("10.204.1.6");
  const [user, setUser] = useState("root");
  const [pass, setPass] = useState("");
  const [database, setDatabase] = useState("SGA_N1");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; rows?: any[]; erro?: string } | null>(null);

  const consultar = async () => {
    setLoading(true); setRes(null);
    try {
      const { data } = await api.post("/osa/consultar-n1", { host, user, password: pass, database });
      setRes(data);
    } catch (e: any) {
      setRes({ ok: false, erro: e?.response?.data?.message || "Erro na requisição" });
    } finally { setLoading(false); }
  };

  return (
    <div className="card-premium" style={{ padding: 18, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Database size={18} style={{ color: "var(--accent-violet)" }} />
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Consultar Sequencial (N1)</h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— conecta via SSH no servidor e lê a MTP_LISTAG (login do servidor)</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <N1Field label="IP / Host" v={host} on={setHost} placeholder="10.204.1.6" />
        <N1Field label="Usuário SSH" v={user} on={setUser} placeholder="root" />
        <N1Field label="Senha"     v={pass} on={setPass} type="password" />
        <N1Field label="Banco"     v={database} on={setDatabase} placeholder="SGA_N1" />
        <button onClick={consultar} disabled={loading || !host} className="btn btn-violet" style={{ fontSize: 13, height: 38, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
          {loading ? "Consultando…" : "Consultar Sequencial"}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: 14 }}>
          {res.ok ? (
            <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["ID_OSA", "SERIE", "SEQUENCIAL", "Atualizado"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(res.rows || []).map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        <b>{r.idOsa}</b>{OSA_NOMES[r.idOsa] ? <span style={{ color: "var(--accent-violet)", fontWeight: 700 }}> — {OSA_NOMES[r.idOsa]}</span> : null}
                      </td>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--accent-red)", fontWeight: 700 }}>{r.serie}</td>
                      <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{Number(r.sequencial).toLocaleString("pt-BR")}</td>
                      <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{r.atualizado ? new Date(r.atualizado).toLocaleString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                  {(res.rows || []).length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>Nenhuma linha encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626", fontSize: 12.5 }}>
              ⚠ {res.erro}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function N1Field({ label, v, on, type = "text", placeholder }: { label: string; v: string; on: (s: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} type={type} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
    </div>
  );
}

function OsaCard({ m, onEdit }: { m: Osa; onEdit: (() => void) | undefined }) {
  const s = STATUS[m.status] || STATUS.DESCONHECIDO;
  const svcUp = m.servicoEstado === "RUNNING";
  const temDado = !!(m.serie || m.sequencial);
  const nomeLogico = m.serie != null ? OSA_NOME_POR_SERIE[Number(m.serie)] : undefined;
  return (
    <div className="card-premium" style={{ padding: 0, overflow: "hidden", position: "relative", opacity: m.ativo ? 1 : 0.6 }}>
      <div style={{ height: 4, background: s.fg }} />
      <div style={{ padding: 18 }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeLogico || m.descricao}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nomeLogico ? `${m.descricao} · ${m.ip}` : m.ip}
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: s.soft, color: s.fg, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
            {s.dot} {s.label}
          </span>
        </div>

        {/* hero: série.sequencial */}
        <div style={{ margin: "16px 0 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Último tag processado</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 4 }}>
            {temDado ? (
              <>
                <span style={{ color: "var(--accent-red)" }}>{m.serie || "—"}</span>
                <span style={{ color: "var(--text-muted)" }}>.</span>
                <span style={{ color: "var(--text-primary)" }}>{m.sequencial || ""}</span>
              </>
            ) : <span style={{ color: "var(--text-muted)", fontSize: 22 }}>aguardando…</span>}
          </div>
        </div>

        {/* N1 (esperado) × processado */}
        {m.n1Sequencial != null && (
          <div style={{ display: "flex", alignItems: "stretch", gap: 12, marginBottom: 14, background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Esperado (N1)</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 800, marginTop: 2 }}>{m.n1Sequencial.toLocaleString("pt-BR")}</div>
            </div>
            <div style={{ width: 1, background: "var(--border-subtle)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>Atraso</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 800, marginTop: 2, color: atrasoCor(m.atraso) }}>
                {m.atraso == null ? "—" : m.atraso <= 0 ? "em dia" : m.atraso.toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        )}

        {/* serviços */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.servicoEstado ? (svcUp ? "#16a34a" : "#dc2626") : "#94a3b8", flexShrink: 0 }} />
            <span style={{ color: m.servicoEstado ? (svcUp ? "#16a34a" : "#dc2626") : "var(--text-muted)" }}>
              {m.servicoEstado ? (svcUp ? "Serviço OSA rodando" : "Serviço OSA parado") : "Serviço OSA —"}
            </span>
          </div>
          {m.valorAtual && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", paddingLeft: 16 }}>
              tag.recebido: <span style={{ color: "var(--accent-cyan)" }}>{m.valorAtual}</span>
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", fontSize: 11.5, color: "var(--text-muted)" }}>
          <Clock size={13} />
          <span>{fmtHora(m.ultimaAtualizacao)}</span>
          <span style={{ color: "var(--border-medium)" }}>·</span>
          <span>há {tempoDesde(m.ultimaAtualizacao)}</span>
          {onEdit && (
            <button onClick={onEdit} className="btn btn-ghost" style={{ marginLeft: "auto", padding: "4px 8px", fontSize: 11 }} title="Ajustar descrição / tempo máximo">
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor, cor, icon: Icon }: { label: string; valor: number; cor: string; icon: any }) {
  return (
    <div className="card-premium" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={18} style={{ color: cor }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: cor, lineHeight: 1, letterSpacing: "-0.02em" }}>{valor}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </div>
  );
}

function EditModal({ form, setForm, salvar, saving }: { form: Osa; setForm: (f: Osa | null) => void; salvar: () => void; saving: boolean }) {
  return (
    <div onClick={() => setForm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card-premium" style={{ padding: 22, width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Ajustar OSA</h2>
          <button onClick={() => setForm(null)} className="btn btn-ghost" style={{ marginLeft: "auto", padding: 4 }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>{form.descricao} · {form.ip}</p>
        <div style={{ display: "grid", gap: 12 }}>
          <Campo label="Descrição" v={form.descricao} on={(v) => setForm({ ...form, descricao: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Tempo máx (min)" v={String(form.tempoMaxMin ?? 5)} on={(v) => setForm({ ...form, tempoMaxMin: Number(v) || 5 })} type="number" />
            <Campo label="Intervalo (s)" v={String(form.intervaloSeg ?? 60)} on={(v) => setForm({ ...form, intervaloSeg: Number(v) || 60 })} type="number" />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button onClick={() => setForm(null)} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn btn-violet" style={{ fontSize: 13, minWidth: 100 }}>{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} type={type}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)" }} />
    </div>
  );
}
