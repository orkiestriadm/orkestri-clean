"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtDate, fmtMoney } from "../_components/crud";

const STATUS: Record<string, string> = { vigente: "var(--accent-green)", vencido: "var(--accent-red)", cancelado: "var(--text-muted)" };
const STATUS_OPTS = [
  { value: "vigente", label: "Vigente" }, { value: "vencido", label: "Vencido" }, { value: "cancelado", label: "Cancelado" },
];
const TIPO_OPTS = [
  { value: "crlv", label: "CRLV" }, { value: "seguro", label: "Seguro" }, { value: "ipva", label: "IPVA" },
  { value: "licenciamento", label: "Licenciamento" }, { value: "multa", label: "Multa" }, { value: "outro", label: "Outro" },
];

function vencendo(d?: string | null) {
  if (!d) return null;
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "var(--accent-red)";
  if (dias <= 30) return "var(--accent-amber)";
  return null;
}

const config: CrudConfig = {
  endpoint: "/frota/documentos", tabela: "documentos_veiculo", singular: "documento", plural: "Documentações",
  defaults: { tipo: "crlv", status: "vigente" },
  filters: [
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
    { key: "status", label: "Status", options: STATUS_OPTS },
  ],
  columns: [
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "tipo", label: "Tipo", render: r => <Badge color="var(--accent-cyan)">{TIPO_OPTS.find(t => t.value === r.tipo)?.label || r.tipo}</Badge> },
    { key: "numero", label: "Número", render: r => r.numero || "—" },
    { key: "dataVencimento", label: "Vencimento", render: r => {
      const cor = vencendo(r.dataVencimento);
      return cor ? <Badge color={cor}>{fmtDate(r.dataVencimento)}</Badge> : fmtDate(r.dataVencimento);
    } },
    { key: "valor", label: "Valor", align: "right", render: r => fmtMoney(r.valor) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "numero", label: "Número" },
    { key: "descricao", label: "Descrição" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "dataEmissao", label: "Data de emissão", type: "date" },
    { key: "dataVencimento", label: "Data de vencimento", type: "date" },
    { key: "valor", label: "Valor (R$)", type: "number", step: 0.01 },
    { key: "arquivoUrl", label: "URL do arquivo", full: true },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function DocumentacoesPage() {
  return <CrudView config={config} />;
}
