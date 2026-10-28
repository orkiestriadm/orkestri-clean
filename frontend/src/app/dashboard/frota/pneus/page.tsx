"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge } from "../_components/crud";

const STATUS: Record<string, string> = { em_uso: "var(--accent-green)", estoque: "var(--accent-cyan)", recapagem: "var(--accent-amber)", descartado: "var(--accent-red)" };
const STATUS_OPTS = [
  { value: "em_uso", label: "Em uso" }, { value: "estoque", label: "Estoque" },
  { value: "recapagem", label: "Recapagem" }, { value: "descartado", label: "Descartado" },
];
const POSICAO_OPTS = ["DE", "DD", "TE", "TD", "estepe"].map(v => ({ value: v, label: v }));

const config: CrudConfig = {
  endpoint: "/frota/pneus", tabela: "pneus", singular: "pneu", plural: "Pneus",
  defaults: { status: "em_uso" },
  filters: [{ key: "status", label: "Status", options: STATUS_OPTS }],
  columns: [
    { key: "numeroSerie", label: "Nº Série", render: r => <span style={{ fontFamily: "var(--font-mono)" }}>{r.numeroSerie || "—"}</span> },
    { key: "marca", label: "Marca/Modelo", render: r => [r.marca, r.modelo].filter(Boolean).join(" ") || "—" },
    { key: "medida", label: "Medida", render: r => r.medida || "—" },
    { key: "posicao", label: "Posição", render: r => r.posicao || "—" },
    { key: "veiculo", label: "Veículo", render: r => r.veiculo?.placa || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos" },
    { key: "numeroSerie", label: "Número de série" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "medida", label: "Medida", placeholder: "Ex: 175/70 R14" },
    { key: "posicao", label: "Posição", type: "select", options: POSICAO_OPTS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "dataInstalacao", label: "Data de instalação", type: "date" },
    { key: "kmInstalacao", label: "KM na instalação", type: "number" },
    { key: "kmAtual", label: "KM atual", type: "number" },
    { key: "vidaUtilKm", label: "Vida útil (km)", type: "number" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function PneusPage() {
  return <CrudView config={config} />;
}
