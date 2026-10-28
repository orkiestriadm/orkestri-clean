"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";

const STATUS: Record<string, string> = { agendada: "var(--accent-cyan)", realizada: "var(--accent-green)", atrasada: "var(--accent-red)", cancelada: "var(--text-muted)" };
const STATUS_OPTS = [
  { value: "agendada", label: "Agendada" }, { value: "realizada", label: "Realizada" },
  { value: "atrasada", label: "Atrasada" }, { value: "cancelada", label: "Cancelada" },
];

const config: CrudConfig = {
  endpoint: "/frota/revisoes", tabela: "revisoes_veiculo", singular: "revisão", plural: "Revisões",
  defaults: { status: "agendada" },
  filters: [{ key: "status", label: "Status", options: STATUS_OPTS }],
  columns: [
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "tipo", label: "Tipo", render: r => r.tipo || "—" },
    { key: "descricao", label: "Descrição", render: r => r.descricao || "—" },
    { key: "dataPrevista", label: "Prevista", render: r => fmtDate(r.dataPrevista) },
    { key: "kmPrevisto", label: "KM prev.", align: "right", render: r => r.kmPrevisto != null ? r.kmPrevisto.toLocaleString("pt-BR") : "—" },
    { key: "custo", label: "Custo", align: "right", render: r => fmtMoney(r.custo) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", placeholder: "Ex: 10.000 km / Revisão anual" },
    { key: "descricao", label: "Descrição" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "dataPrevista", label: "Data prevista", type: "date" },
    { key: "kmPrevisto", label: "KM previsto", type: "number" },
    { key: "dataRealizada", label: "Data realizada", type: "date" },
    { key: "kmRealizado", label: "KM realizado", type: "number" },
    { key: "custo", label: "Custo (R$)", type: "number", step: 0.01 },
    { key: "oficina", label: "Oficina" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function RevisoesPage() {
  return <CrudView config={config} />;
}
