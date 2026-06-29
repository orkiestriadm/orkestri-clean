"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";

const STATUS: Record<string, string> = {
  aberta: "var(--accent-cyan)", em_andamento: "var(--accent-amber)", aguardando_pecas: "#f97316",
  finalizada: "var(--accent-green)", cancelada: "var(--text-muted)",
};
const STATUS_OPTS = [
  { value: "aberta", label: "Aberta" }, { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_pecas", label: "Aguardando peças" }, { value: "finalizada", label: "Finalizada" },
  { value: "cancelada", label: "Cancelada" },
];
const TIPO_OPTS = [
  { value: "preventiva", label: "Preventiva" }, { value: "corretiva", label: "Corretiva" }, { value: "emergencial", label: "Emergencial" },
];
const TIPO_COLOR: Record<string, string> = { preventiva: "var(--accent-cyan)", corretiva: "var(--accent-amber)", emergencial: "var(--accent-red)" };

const config: CrudConfig = {
  endpoint: "/frota/manutencoes", tabela: "manutencoes_veiculo", singular: "ordem de serviço", plural: "Manutenções (OS)",
  defaults: { tipo: "corretiva", status: "aberta" },
  detailHref: r => `/dashboard/frota/manutencoes/${r.id}`,
  filters: [
    { key: "status", label: "Status", options: STATUS_OPTS },
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
  ],
  columns: [
    { key: "numeroOs", label: "OS", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.numeroOs || "—"}</span> },
    { key: "veiculo", label: "Veículo", render: r => r.veiculo?.placa || "—" },
    { key: "tipo", label: "Tipo", render: r => <Badge color={TIPO_COLOR[r.tipo]}>{TIPO_OPTS.find(t => t.value === r.tipo)?.label || r.tipo}</Badge> },
    { key: "solicitante", label: "Solicitante", render: r => r.solicitante?.nome || "—" },
    { key: "dataAbertura", label: "Abertura", render: r => fmtDate(r.dataAbertura) },
    { key: "custo", label: "Custo total", align: "right", render: r => fmtMoney(r.custo) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "numeroOs", label: "Número OS (auto se vazio)", placeholder: "OS-00001" },
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "solicitanteId", label: "Solicitante", type: "select", source: "users" },
    { key: "oficina", label: "Oficina" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "dataAbertura", label: "Data de abertura", type: "date" },
    { key: "dataFechamento", label: "Data de fechamento", type: "date" },
    { key: "km", label: "KM", type: "number" },
    { key: "custoPecas", label: "Custo peças (R$)", type: "number", step: 0.01 },
    { key: "custoServicos", label: "Custo serviços (R$)", type: "number", step: 0.01 },
    { key: "custoTerceiros", label: "Custo terceiros (R$)", type: "number", step: 0.01 },
    { key: "descricao", label: "Descrição", full: true },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function ManutencoesPage() {
  return <CrudView config={config} />;
}
