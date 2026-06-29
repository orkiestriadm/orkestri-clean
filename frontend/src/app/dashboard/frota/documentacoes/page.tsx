"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";
import { api } from "@/lib/api";

const STATUS: Record<string, string> = { vigente: "var(--accent-green)", vencido: "var(--accent-red)", cancelado: "var(--text-muted)" };
const STATUS_OPTS = [
  { value: "vigente", label: "Vigente" }, { value: "vencido", label: "Vencido" }, { value: "cancelado", label: "Cancelado" },
];
const TIPO_OPTS = [
  { value: "licenciamento", label: "Licenciamento" }, { value: "seguro", label: "Seguro" }, { value: "antt", label: "ANTT" },
  { value: "tacografo", label: "Tacógrafo" }, { value: "crlv", label: "CRLV" }, { value: "laudo", label: "Laudos" },
  { value: "inspecao", label: "Inspeções" }, { value: "ipva", label: "IPVA" }, { value: "outro", label: "Outro" },
];
const tipoLabel = (t: string) => TIPO_OPTS.find(o => o.value === t)?.label || t;

function vencColor(d?: string | null) {
  if (!d) return null;
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "var(--accent-red)";
  if (dias <= 7) return "var(--accent-red)";
  if (dias <= 30) return "var(--accent-amber)";
  if (dias <= 90) return "#eab308";
  return null;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: "12px 14px", borderLeft: `3px solid ${color}`, minWidth: 110 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function VencimentosDashboard() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/frota/documentos/vencimentos/dashboard").then(r => setD(r.data)).catch(() => {}); }, []);
  if (!d) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>DASHBOARD DE VENCIMENTOS</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Stat label="Vencidos" value={d.vencido} color="var(--accent-red)" />
        <Stat label="≤ 7 dias" value={d.vence7} color="var(--accent-red)" />
        <Stat label="≤ 15 dias" value={d.vence15} color="var(--accent-amber)" />
        <Stat label="≤ 30 dias" value={d.vence30} color="var(--accent-amber)" />
        <Stat label="≤ 60 dias" value={d.vence60} color="#eab308" />
        <Stat label="≤ 90 dias" value={d.vence90} color="#eab308" />
        <Stat label="Vigentes" value={d.vigentes} color="var(--accent-green)" />
        <Stat label="Sem data" value={d.semData} color="var(--text-muted)" />
      </div>
    </div>
  );
}

const config: CrudConfig = {
  endpoint: "/frota/documentos", tabela: "documentos_veiculo", singular: "documento", plural: "Documentações",
  defaults: { tipo: "licenciamento", status: "vigente" },
  detailHref: r => `/dashboard/frota/documentacoes/${r.id}`,
  filters: [
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
    { key: "status", label: "Status", options: STATUS_OPTS },
  ],
  columns: [
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "tipo", label: "Tipo", render: r => <Badge color="var(--accent-cyan)">{tipoLabel(r.tipo)}</Badge> },
    { key: "numero", label: "Número", render: r => r.numero || "—" },
    { key: "dataVencimento", label: "Vencimento", render: r => {
      const cor = vencColor(r.dataVencimento);
      return cor ? <Badge color={cor}>{fmtDate(r.dataVencimento)}</Badge> : fmtDate(r.dataVencimento);
    } },
    { key: "valor", label: "Valor", align: "right", render: r => fmtMoney(r.valor) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "numero", label: "Número / Apólice" },
    { key: "descricao", label: "Descrição" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "dataEmissao", label: "Data de emissão", type: "date" },
    { key: "dataVencimento", label: "Data de vencimento", type: "date" },
    { key: "valor", label: "Valor (R$)", type: "number", step: 0.01 },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function DocumentacoesPage() {
  return <CrudView config={config} intro={<VencimentosDashboard />} />;
}
