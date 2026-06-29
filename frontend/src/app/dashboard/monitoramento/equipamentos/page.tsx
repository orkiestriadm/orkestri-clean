"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  Plus, Edit2, Trash2, ChevronLeft, ChevronDown, Radio, Search, X, Filter, ExternalLink,
  Upload, CheckSquare, Power, PowerOff, Link2, Zap,
} from "lucide-react";

// Field helper FORA do componente — se ficar dentro, perde foco a cada tecla (mesmo bug do Ativos)
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

type Asset = {
  id: string; nome: string; ip: string; hostname?: string; categoria: string; tipo: string;
  localizacao?: string; unidadeId?: string; responsavelId?: string; observacoes?: string;
  porta?: number; link?: string | null;
  intervaloSeg: number; timeoutSeg: number; protocolo: string;
  ativo: boolean; abreChamadoAuto?: boolean; ultimoStatus: string; ultimaLatenciaMs?: number | null;
  dependeDeId?: string | null;
  dependeDe?: { id: string; nome: string; ultimoStatus: string } | null;
  supressedByDep?: boolean; latenciaAnomala?: boolean;
};
type Unidade = { id: string; nome: string };

const CAT = [
  { v: "ITS",            label: "ITS",              tipos: ["PMV","CFTV","Radar","Estação Meteorológica","Controladores","Sensores","Outros"] },
  { v: "SERVIDORES",     label: "Servidores",       tipos: ["Servidores físicos","Servidores virtuais","Appliances","Storage","Outros"] },
  { v: "COMPUTADORES",   label: "Computadores",     tipos: ["Desktop","Notebook","Workstation","Outros"] },
  { v: "PRACAS",         label: "Praças",           tipos: ["PC VIA","OCR","VAS","VES","SLM","PLC","ANTENA","RESERVA1","RESERVA2"] },
  { v: "INFRAESTRUTURA", label: "Infraestrutura",   tipos: ["Switches","Roteadores","Firewall","Access Point","Nobreak","Conversores","Equipamentos de telecomunicação","Outros"] },
];

const STATUS_COLOR: Record<string, string> = {
  ONLINE: "#22c55e", OFFLINE: "#ef4444", INSTAVEL: "#f59e0b", NAO_MONITORADO: "#94a3b8",
};

const STATUS_LIST = ["ONLINE","OFFLINE","INSTAVEL","NAO_MONITORADO"] as const;
const STATUS_LABEL: Record<string, string> = {
  ONLINE: "Online", OFFLINE: "Offline", INSTAVEL: "Instável", NAO_MONITORADO: "Não monitorado",
};

// Garante https:// no link se nao tem protocolo
function normalizeLink(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "http://" + t;
}

// ──────────────────────────────────────────────────────────────────────────────
// Form
// ──────────────────────────────────────────────────────────────────────────────
function MonAssetForm({ asset, unidades, assets, onSave, onCancel }: {
  asset?: Asset; unidades: Unidade[]; assets: Asset[];
  onSave: (a: Asset) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<any>(asset || { categoria: "INFRAESTRUTURA", tipo: "Outros", intervaloSeg: 60, timeoutSeg: 3, protocolo: "ICMP", ativo: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const tiposDaCat = (CAT.find(c => c.v === d.categoria)?.tipos) || [];

  const save = async () => {
    if (!d.nome?.trim()) { setErr("Nome obrigatório"); return; }
    if (!d.ip?.trim())   { setErr("IP/Hostname obrigatório"); return; }
    const payload = { ...d, link: d.link ? normalizeLink(String(d.link)) : null };
    setSaving(true); setErr("");
    try {
      const res = asset ? await api.patch(`/monitoramento/assets/${asset.id}`, payload) : await api.post("/monitoramento/assets", payload);
      onSave(res.data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)" }}>{asset ? "Editar equipamento" : "Novo equipamento"}</h2>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <F label="NOME *"><input className="input-o" value={d.nome||""} onChange={e => set("nome", e.target.value)} placeholder="Ex: Switch core Praça A" /></F>
        </div>

        <F label="CATEGORIA *">
          <select className="input-o" value={d.categoria} onChange={e => { set("categoria", e.target.value); set("tipo", "Outros"); }}>
            {CAT.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </F>

        <F label="TIPO *">
          <select className="input-o" value={d.tipo} onChange={e => set("tipo", e.target.value)}>
            {tiposDaCat.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </F>

        <F label="LOCALIZAÇÃO"><input className="input-o" value={d.localizacao||""} onChange={e => set("localizacao", e.target.value)} placeholder="Sala, andar, prédio..." /></F>

        <F label="UNIDADE">
          <select className="input-o" value={d.unidadeId||""} onChange={e => set("unidadeId", e.target.value||null)}>
            <option value="">Sem unidade</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </F>

        <div style={{ gridColumn: "1/-1" }}>
          <F label="DEPENDE DE (uplink — ex: switch/roteador que alimenta este equipamento)">
            <select className="input-o" value={d.dependeDeId||""} onChange={e => set("dependeDeId", e.target.value||null)}>
              <option value="">Sem dependência</option>
              {assets.filter(a => a.id !== asset?.id).map(a => (
                <option key={a.id} value={a.id}>{a.nome} ({a.ip})</option>
              ))}
            </select>
          </F>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
            Se o uplink cair, este equipamento aparece como "indisponível por dependência" (sem alarme/chamado duplicado).
          </div>
        </div>

        {/* ── Bloco Rede ── */}
        <div style={{ gridColumn: "1/-1", padding: "12px 14px", background: "rgba(211,47,47,0.04)", border: "1px solid rgba(211,47,47,0.15)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "#D32F2F", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 10 }}>REDE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="ENDEREÇO IP *"><input className="input-o" value={d.ip||""} onChange={e => set("ip", e.target.value)} placeholder="192.168.1.10" /></F>
            <F label="HOSTNAME"><input className="input-o" value={d.hostname||""} onChange={e => set("hostname", e.target.value)} placeholder="host.local" /></F>
            <F label="PORTA (opcional, futuro TCP)"><input className="input-o" type="number" value={d.porta||""} onChange={e => set("porta", e.target.value ? Number(e.target.value) : null)} /></F>
            <F label="PROTOCOLO">
              <select className="input-o" value={d.protocolo||"ICMP"} onChange={e => set("protocolo", e.target.value)}>
                <option value="ICMP">ICMP (ping)</option>
                <option value="TCP" disabled>TCP (em breve)</option>
                <option value="HTTP" disabled>HTTP (em breve)</option>
                <option value="SNMP" disabled>SNMP (em breve)</option>
              </select>
            </F>
            <F label="INTERVALO (s)"><input className="input-o" type="number" min={10} max={3600} value={d.intervaloSeg||60} onChange={e => set("intervaloSeg", Number(e.target.value)||60)} /></F>
            <F label="TIMEOUT (s)"><input className="input-o" type="number" min={1} max={30} value={d.timeoutSeg||3} onChange={e => set("timeoutSeg", Number(e.target.value)||3)} /></F>
            <div style={{ gridColumn: "1/-1" }}>
              <F label="LINK (URL de acesso web)">
                <input
                  className="input-o"
                  value={d.link||""}
                  onChange={e => set("link", e.target.value)}
                  placeholder="http://192.168.1.10 ou https://camera.local"
                />
              </F>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={10} />
                Se preenchido, duplo-clique no equipamento abre essa URL em nova aba (útil pra câmeras CFTV, switches, NVRs)
              </div>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: "1/-1" }}>
          <F label="OBSERVAÇÕES"><textarea className="input-o" value={d.observacoes||""} onChange={e => set("observacoes", e.target.value)} style={{ minHeight: 80, resize: "vertical" }} /></F>
        </div>

        <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={!!d.ativo} onChange={e => set("ativo", e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Ativo (monitorar este equipamento)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={!!d.abreChamadoAuto} onChange={e => set("abreChamadoAuto", e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Abrir chamado automaticamente quando ficar OFFLINE</span>
          </label>
          {d.abreChamadoAuto && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 24 }}>
              Cria um chamado (categoria "Monitoramento", prioridade alta) ao detectar queda, e comenta quando o equipamento voltar.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────────
export default function EquipamentosPage() {
  const [list, setList] = useState<Asset[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [q, setQ] = useState("");
  const [catFilter, setCat]    = useState<string>("");
  const [statusFilter, setStat] = useState<string>("");
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [showStatMenu, setShowStatMenu] = useState(false);
  const catRef  = useRef<HTMLDivElement | null>(null);
  const statRef = useRef<HTMLDivElement | null>(null);
  // Bulk + import
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, u] = await Promise.all([
        api.get("/monitoramento/assets"),
        api.get("/monitoramento/unidades"),
      ]);
      setList(a.data); setUnidades(u.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (catRef.current  && !catRef.current.contains(e.target as Node))  setShowCatMenu(false);
      if (statRef.current && !statRef.current.contains(e.target as Node)) setShowStatMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const del = async (a: Asset) => {
    if (!confirm(`Remover ${a.nome}?`)) return;
    await api.delete(`/monitoramento/assets/${a.id}`);
    load();
  };

  const toggleSel = (id: string) => setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulk = async (acao: string, valor?: any) => {
    const ids = [...sel];
    if (!ids.length) return;
    if (acao === "excluir" && !confirm(`Remover ${ids.length} equipamento(s)?`)) return;
    setBusy(true);
    try {
      await api.post("/monitoramento/assets/bulk", { ids, acao, valor });
      setSel(new Set());
      await load();
    } finally { setBusy(false); }
  };

  // Parser CSV simples: 1a linha = header. Aceita ; ou ,. Colunas reconhecidas:
  // nome, ip, categoria, tipo, localizacao, hostname, link, intervaloseg
  const parseCsv = (text: string) => {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const delim = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
    const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const map: Record<string,string> = { nome:"nome", ip:"ip", categoria:"categoria", tipo:"tipo", localizacao:"localizacao", localizao:"localizacao", hostname:"hostname", link:"link", intervaloseg:"intervaloSeg", intervalo:"intervaloSeg" };
    return lines.slice(1).map(l => {
      const cols = l.split(delim);
      const row: any = {};
      headers.forEach((h, i) => { const k = map[h]; if (k) row[k] = (cols[i]||"").trim(); });
      return row;
    }).filter(r => r.ip && r.nome);
  };

  const doImport = async () => {
    const linhas = parseCsv(csvText);
    if (!linhas.length) { setImportResult({ erro: "Nenhuma linha válida. Verifique cabeçalho (nome;ip;categoria;tipo)." }); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/monitoramento/assets/import", { linhas });
      setImportResult(data);
      await load();
    } catch (e: any) {
      setImportResult({ erro: e?.response?.data?.message || "Erro ao importar" });
    } finally { setBusy(false); }
  };

  const visiveis = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return list.filter(a => {
      if (catFilter && a.categoria !== catFilter) return false;
      if (statusFilter && a.ultimoStatus !== statusFilter) return false;
      if (ql) {
        const hay = `${a.nome} ${a.ip} ${a.tipo} ${a.localizacao||""} ${a.hostname||""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [list, q, catFilter, statusFilter]);

  const openLink = (a: Asset) => {
    if (!a.link) return;
    window.open(normalizeLink(a.link), "_blank", "noopener,noreferrer");
  };

  const catSel  = CAT.find(c => c.v === catFilter);
  const statSel = STATUS_LABEL[statusFilter];

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Link href="/dashboard/monitoramento" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
              <ChevronLeft size={12} style={{ display: "inline" }} /> Monitoramento
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>Equipamentos</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Cadastro de ativos monitorados · duplo-clique abre o Link (se cadastrado)</p>
          </div>
          {!showForm && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setShowImport(true); setImportResult(null); setCsvText(""); }}>
                <Upload size={14} style={{ marginRight: 4 }} /> Importar CSV
              </button>
              <button className="btn btn-violet" onClick={() => { setEditing(null); setShowForm(true); }}>
                <Plus size={14} style={{ marginRight: 4 }} /> Novo equipamento
              </button>
            </div>
          )}
        </div>

        {showForm && (
          <div className="card" style={{ padding: 20, marginBottom: 18 }}>
            <MonAssetForm asset={editing||undefined} unidades={unidades} assets={list}
              onSave={() => { setShowForm(false); setEditing(null); load(); }}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        )}

        {/* ── Barra de busca + filtros ── */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flex: 1, minWidth: 280, alignItems: "stretch", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "var(--text-muted)" }}>
              <Search size={14} />
            </div>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nome, IP, tipo, localização ou hostname..."
              style={{ flex: 1, padding: "10px 4px", background: "transparent", border: 0, color: "var(--text-primary)", fontSize: 13, outline: "none", minWidth: 0 }}
            />
            {q && (
              <button onClick={() => setQ("")} className="btn-icon" style={{ width: 32, height: 32, margin: 3 }} title="Limpar"><X size={14}/></button>
            )}
          </div>

          {/* Categoria dropdown */}
          <div ref={catRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setShowCatMenu(s => !s); setShowStatMenu(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", height: "100%",
                background: catFilter ? "rgba(211,47,47,0.08)" : "var(--bg-secondary)",
                border: `1px solid ${catFilter ? "rgba(211,47,47,0.30)" : "var(--border-subtle)"}`,
                borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: catFilter ? "#D32F2F" : "var(--text-secondary)",
                minWidth: 180, justifyContent: "space-between",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Filter size={13} />
                {catSel ? catSel.label : "Todas categorias"}
              </span>
              <ChevronDown size={14} style={{ transform: showCatMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
            </button>
            {showCatMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 240, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, boxShadow: "var(--shadow-elevated)", overflow: "hidden", zIndex: 50 }}>
                <DropItem label="Todas categorias" count={list.length} active={!catFilter} onClick={() => { setCat(""); setShowCatMenu(false); }} />
                <div style={{ height: 1, background: "var(--border-subtle)" }} />
                {CAT.map(c => {
                  const cnt = list.filter(x => x.categoria === c.v).length;
                  return <DropItem key={c.v} label={c.label} count={cnt} active={catFilter === c.v} onClick={() => { setCat(c.v); setShowCatMenu(false); }} />;
                })}
              </div>
            )}
          </div>

          {/* Status dropdown */}
          <div ref={statRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setShowStatMenu(s => !s); setShowCatMenu(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", height: "100%",
                background: statusFilter ? "rgba(211,47,47,0.08)" : "var(--bg-secondary)",
                border: `1px solid ${statusFilter ? "rgba(211,47,47,0.30)" : "var(--border-subtle)"}`,
                borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: statusFilter ? "#D32F2F" : "var(--text-secondary)",
                minWidth: 160, justifyContent: "space-between",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {statusFilter && <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR[statusFilter] }} />}
                {statSel || "Todos status"}
              </span>
              <ChevronDown size={14} style={{ transform: showStatMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
            </button>
            {showStatMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, boxShadow: "var(--shadow-elevated)", overflow: "hidden", zIndex: 50 }}>
                <DropItem label="Todos status" count={list.length} active={!statusFilter} onClick={() => { setStat(""); setShowStatMenu(false); }} />
                <div style={{ height: 1, background: "var(--border-subtle)" }} />
                {STATUS_LIST.map(s => {
                  const cnt = list.filter(x => x.ultimoStatus === s).length;
                  return (
                    <DropItem key={s}
                      label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR[s] }}/> {STATUS_LABEL[s]}</span> as any}
                      count={cnt}
                      active={statusFilter === s}
                      onClick={() => { setStat(s); setShowStatMenu(false); }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {(q || catFilter || statusFilter) && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setQ(""); setCat(""); setStat(""); }}>
              <X size={12} style={{ marginRight: 4 }} /> Limpar filtros
            </button>
          )}
        </div>

        {/* Contador */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <span>
            <b style={{ color: "var(--text-primary)" }}>{visiveis.length}</b> de {list.length}{" "}
            {(q || catFilter || statusFilter) && <span style={{ color: "#D32F2F" }}>· filtrados</span>}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={11} />
            ícone = tem link cadastrado
          </span>
        </div>

        {/* Barra de ações em lote */}
        {sel.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", marginBottom: 10, borderRadius: 10, background: "rgba(211,47,47,0.06)", border: "1px solid rgba(211,47,47,0.20)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#D32F2F" }}>{sel.size} selecionado(s)</span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => bulk("ativar")}><Power size={12} style={{ marginRight: 4 }} /> Ativar</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => bulk("desativar")}><PowerOff size={12} style={{ marginRight: 4 }} /> Desativar</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => bulk("auto_chamado", true)}><Zap size={12} style={{ marginRight: 4 }} /> Auto-chamado ON</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => bulk("link_auto")}><Link2 size={12} style={{ marginRight: 4 }} /> Gerar links</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => {
              const ipPai = prompt("IP do uplink (switch/roteador) que alimenta os selecionados — vazio remove a dependência:");
              if (ipPai === null) return;
              if (!ipPai.trim()) { bulk("uplink", null); return; }
              const pai = list.find(x => x.ip === ipPai.trim());
              if (!pai) { alert(`Nenhum equipamento com IP ${ipPai.trim()}`); return; }
              bulk("uplink", pai.id);
            }}><Link2 size={12} style={{ marginRight: 4 }} /> Definir uplink</button>
            <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => { const v = prompt("Intervalo em segundos (10-3600):", "60"); if (v) bulk("intervalo", Number(v)); }}>Intervalo…</button>
            <button className="btn btn-ghost" style={{ fontSize: 11, color: "#ef4444" }} disabled={busy} onClick={() => bulk("excluir")}><Trash2 size={12} style={{ marginRight: 4 }} /> Excluir</button>
            <button className="btn-icon" onClick={() => setSel(new Set())} title="Limpar seleção"><X size={14}/></button>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)" }}>
                <th style={{ ...th, width: 36 }}>
                  <input type="checkbox"
                    checked={visiveis.length > 0 && visiveis.every(a => sel.has(a.id))}
                    onChange={e => setSel(e.target.checked ? new Set(visiveis.map(a => a.id)) : new Set())}
                    style={{ width: 15, height: 15, cursor: "pointer" }} />
                </th>
                <th style={th}>Nome</th>
                <th style={th}>IP</th>
                <th style={th}>Categoria</th>
                <th style={th}>Tipo</th>
                <th style={th}>Status</th>
                <th style={th}>Latência</th>
                <th style={th}>Intervalo</th>
                <th style={{ ...th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ ...td, color: "var(--text-muted)", textAlign: "center" }}>Carregando…</td></tr>}
              {!loading && visiveis.length === 0 && (
                <tr><td colSpan={9} style={{ ...td, color: "var(--text-muted)", textAlign: "center" }}>
                  {list.length === 0 ? "Nenhum equipamento. Use \"Novo equipamento\" pra começar." : "Nenhum equipamento no filtro atual."}
                </td></tr>
              )}
              {visiveis.map(a => {
                const hasLink = !!a.link;
                return (
                  <tr key={a.id}
                      style={{ borderTop: "1px solid var(--border-subtle)", cursor: hasLink ? "alias" : "default", userSelect: "none", background: sel.has(a.id) ? "rgba(211,47,47,0.05)" : undefined }}
                      onDoubleClick={() => openLink(a)}
                      title={hasLink ? "Duplo-clique abre: " + a.link : ""}
                  >
                    <td style={td} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggleSel(a.id)} style={{ width: 15, height: 15, cursor: "pointer" }} />
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Radio size={12} style={{ color: STATUS_COLOR[a.ultimoStatus] || "#94a3b8" }} />
                        <span style={{ fontWeight: 600 }}>{a.nome}</span>
                        {hasLink && <ExternalLink size={11} style={{ color: "#D32F2F", opacity: 0.7 }} />}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12 }}>{a.ip}</td>
                    <td style={td}>{(CAT.find(c => c.v === a.categoria)?.label) || a.categoria}</td>
                    <td style={td}>{a.tipo}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[a.ultimoStatus] || "#94a3b8" }}>
                        {a.ultimoStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12 }}>{a.ultimaLatenciaMs != null ? `${a.ultimaLatenciaMs}ms` : "—"}</td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 12 }}>{a.intervaloSeg}s</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {hasLink && (
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openLink(a); }} title={"Abrir: " + a.link}>
                          <ExternalLink size={14}/>
                        </button>
                      )}
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditing(a); setShowForm(true); }} title="Editar"><Edit2 size={14}/></button>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); del(a); }} title="Remover"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de importação CSV */}
      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
             onClick={() => !busy && setShowImport(false)}>
          <div className="card" style={{ padding: 22, maxWidth: 620, width: "100%", maxHeight: "90vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)" }}>Importar equipamentos (CSV)</h2>
              <button className="btn-icon" onClick={() => setShowImport(false)}><X size={16}/></button>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              Cole o CSV abaixo. Primeira linha = cabeçalho. Colunas reconhecidas:
              <code style={{ background: "var(--bg-hover)", padding: "1px 5px", borderRadius: 4, marginLeft: 4 }}>nome;ip;categoria;tipo;localizacao;hostname;link;intervaloseg</code>.
              Categorias: ITS, SERVIDORES, COMPUTADORES, PRACAS, INFRAESTRUTURA. IPs duplicados são ignorados.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <label className="btn btn-ghost" style={{ fontSize: 11, cursor: "pointer" }}>
                Carregar arquivo .csv
                <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setCsvText(String(r.result||"")); r.readAsText(f); } }} />
              </label>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setCsvText("nome;ip;categoria;tipo;localizacao\nSwitch Teste;10.0.0.1;INFRAESTRUTURA;Switches;Sala TI")}>Exemplo</button>
            </div>
            <textarea className="input-o" value={csvText} onChange={e => setCsvText(e.target.value)}
              placeholder={"nome;ip;categoria;tipo\nCFTV 01;10.153.40.1;ITS;CFTV"}
              style={{ minHeight: 180, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12, width: "100%" }} />
            {importResult && (
              <div style={{ marginTop: 10, fontSize: 12, padding: "8px 12px", borderRadius: 6,
                background: importResult.erro ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                color: importResult.erro ? "var(--accent-red)" : "#16a34a" }}>
                {importResult.erro
                  ? importResult.erro
                  : `✓ ${importResult.criados} criados · ${importResult.ignorados} ignorados (duplicados/inválidos)`}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setShowImport(false)} disabled={busy}>Fechar</button>
              <button className="btn btn-violet" onClick={doImport} disabled={busy || !csvText.trim()}>
                {busy ? "Importando..." : `Importar (${parseCsv(csvText).length} linhas)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DropItem({ label, count, active, onClick }: { label: React.ReactNode; count: number; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: active ? "var(--bg-hover)" : "transparent", border: 0, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{count}</span>
    </button>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 14px" };
