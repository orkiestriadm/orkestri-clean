"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import CrudView, { CrudConfig, Badge } from "../_components/crud";
import PneuTree from "../_components/PneuTree";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

const TIPO_OPTS = [
  { value: "carro", label: "Carro" }, { value: "moto", label: "Moto" },
  { value: "van", label: "Van" }, { value: "caminhao", label: "Caminhão" }, { value: "onibus", label: "Ônibus" },
];

function PneuLayoutConfig() {
  const { user } = useAuthStore();
  const [tipo, setTipo] = useState("carro");
  const [posicoes, setPosicoes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const canConfig = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("frota:configurar");

  useEffect(() => { api.get(`/frota/pneu-layouts/${tipo}`).then(r => setPosicoes(r.data?.posicoes || [])).catch(() => setPosicoes([])); }, [tipo]);

  const setPos = (i: number, k: string, v: any) => setPosicoes(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const addPos = () => setPosicoes(p => [...p, { codigo: "", label: "", x: 50, y: 50 }]);
  const removePos = (i: number) => setPosicoes(p => p.filter((_, j) => j !== i));
  const save = async () => {
    setSaving(true);
    try { await api.put(`/frota/pneu-layouts/${tipo}`, { posicoes }); setMsg("Layout salvo!"); setTimeout(() => setMsg(""), 2500); }
    catch { setMsg("Erro ao salvar"); } finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Posições de pneus por tipo de veículo</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Configure as posições e suas coordenadas (0–100) para a árvore visual.</p>
        </div>
        <select className="input-o" style={{ maxWidth: 180 }} value={tipo} onChange={e => setTipo(e.target.value)}>
          {TIPO_OPTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 56px 56px 32px", gap: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 6 }}>
            <span>CÓDIGO</span><span>LABEL</span><span>X</span><span>Y</span><span></span>
          </div>
          {posicoes.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 56px 56px 32px", gap: 6, marginBottom: 6 }}>
              <input className="input-o" style={{ padding: "6px 8px" }} value={p.codigo || ""} onChange={e => setPos(i, "codigo", e.target.value)} />
              <input className="input-o" style={{ padding: "6px 8px" }} value={p.label || ""} onChange={e => setPos(i, "label", e.target.value)} />
              <input className="input-o" type="number" style={{ padding: "6px 8px" }} value={p.x ?? 50} onChange={e => setPos(i, "x", Number(e.target.value))} />
              <input className="input-o" type="number" style={{ padding: "6px 8px" }} value={p.y ?? 50} onChange={e => setPos(i, "y", Number(e.target.value))} />
              <button className="btn-icon" onClick={() => removePos(i)} style={{ color: "var(--accent-red)" }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button className="btn btn-ghost text-xs" onClick={addPos}>+ Posição</button>
            {canConfig && <button className="btn btn-violet text-xs" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar layout"}</button>}
            {msg && <span className="text-xs font-mono" style={{ color: msg.includes("Erro") ? "var(--accent-red)" : "var(--accent-green)" }}>{msg}</span>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 6 }}>PRÉVIA</div>
          <PneuTree posicoes={posicoes} pneus={[]} height={280} />
        </div>
      </div>
    </div>
  );
}

function BloqueioCnhConfig() {
  const { user } = useAuthStore();
  const [on, setOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const canConfig = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("frota:configurar");

  useEffect(() => { api.get("/frota/config").then(r => setOn(!!r.data?.bloqueioCnhVencida)).catch(() => {}); }, []);

  const toggle = async () => {
    if (!canConfig || saving) return;
    const next = !on; setOn(next); setSaving(true);
    try { await api.put("/frota/config", { bloqueioCnhVencida: next }); }
    catch { setOn(!next); } finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid var(--accent-amber)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Bloqueio por CNH vencida</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Quando ativado, motoristas com CNH vencida são sinalizados como <strong>bloqueados</strong> nas listas e no dashboard.
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={!canConfig || saving}
        title={canConfig ? "" : "Sem permissão (frota:configurar)"}
        style={{
          flexShrink: 0, width: 46, height: 26, borderRadius: 13, border: "none", cursor: canConfig ? "pointer" : "not-allowed",
          background: on ? "var(--accent-green)" : "var(--border-medium)", position: "relative", transition: "background .2s", opacity: canConfig ? 1 : 0.6,
        }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </button>
    </div>
  );
}

const config: CrudConfig = {
  endpoint: "/frota/categorias", tabela: "categorias_veiculo", singular: "categoria", plural: "Categorias de veículo",
  defaults: { ativo: true, cor: "#0ea5e9", icone: "car" },
  columns: [
    { key: "nome", label: "Nome", render: r => <span style={{ fontWeight: 600 }}>{r.nome}</span> },
    { key: "descricao", label: "Descrição", render: r => r.descricao || "—" },
    { key: "cor", label: "Cor", render: r => <Badge color={r.cor}>{r.cor}</Badge> },
    { key: "ativo", label: "Ativa", render: r => r.ativo ? <Badge color="var(--accent-green)">Sim</Badge> : <Badge>Não</Badge> },
  ],
  fields: [
    { key: "nome", label: "Nome", required: true },
    { key: "descricao", label: "Descrição" },
    { key: "cor", label: "Cor (hex)", placeholder: "#0ea5e9" },
    { key: "icone", label: "Ícone", placeholder: "car" },
    { key: "ativo", label: "Ativa", type: "checkbox", placeholder: "Categoria ativa" },
  ],
};

export default function ConfiguracoesPage() {
  const intro = (
    <>
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid var(--accent-cyan)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Configurações da Frota</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Gerencie as categorias de veículos. Os alertas de CNH (90/60/30/15/7 dias e vencida), documentos,
          revisões e manutenções são enviados automaticamente por WhatsApp e notificação interna.
        </p>
      </div>
      <BloqueioCnhConfig />
      <PneuLayoutConfig />
    </>
  );
  return <CrudView config={config} intro={intro} />;
}
