"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";

const STATUS: Record<string, string> = { aberta: "var(--accent-cyan)", em_andamento: "var(--accent-amber)", concluida: "var(--accent-green)", cancelada: "var(--text-muted)" };
const STATUS_OPTS = [
  { value: "aberta", label: "Aberta" }, { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" }, { value: "cancelada", label: "Cancelada" },
];
const TIPO_OPTS = [{ value: "preventiva", label: "Preventiva" }, { value: "corretiva", label: "Corretiva" }];

const config: CrudConfig = {
  endpoint: "/frota/manutencoes", tabela: "manutencoes_veiculo", singular: "manutenção", plural: "Manutenções",
  defaults: { tipo: "corretiva", status: "aberta" },
  filters: [
    { key: "status", label: "Status", options: STATUS_OPTS },
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
  ],
  columns: [
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "tipo", label: "Tipo", render: r => <Badge color={r.tipo === "preventiva" ? "var(--accent-cyan)" : "var(--accent-amber)"}>{TIPO_OPTS.find(t => t.value === r.tipo)?.label || r.tipo}</Badge> },
    { key: "descricao", label: "Descrição", render: r => r.descricao || "—" },
    { key: "data", label: "Data", render: r => fmtDate(r.data || r.dataAgendada) },
    { key: "custo", label: "Custo", align: "right", render: r => fmtMoney(r.custo) },
    { key: "oficina", label: "Oficina", render: r => r.oficina || "—" },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "descricao", label: "Descrição", full: true },
    { key: "data", label: "Data realizada", type: "date" },
    { key: "dataAgendada", label: "Data agendada", type: "date" },
    { key: "km", label: "KM", type: "number" },
    { key: "custo", label: "Custo (R$)", type: "number", step: 0.01 },
    { key: "oficina", label: "Oficina" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function ManutencoesPage() {
  return <CrudView config={config} />;
}
