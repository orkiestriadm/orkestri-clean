"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtMoney } from "../_components/crud";

const STATUS: Record<string, string> = {
  em_uso: "var(--accent-green)", estoque: "var(--accent-cyan)", reserva: "#8b5cf6",
  recapagem: "var(--accent-amber)", descarte: "var(--accent-red)",
};
const STATUS_OPTS = [
  { value: "estoque", label: "Estoque" }, { value: "em_uso", label: "Em uso" },
  { value: "reserva", label: "Reserva" }, { value: "recapagem", label: "Recapagem" },
  { value: "descarte", label: "Descarte" },
];

function custoKm(r: any): string {
  const ini = r.kmInicial ?? r.kmInstalacao;
  if (r.valorCompra == null || ini == null || r.kmAtual == null) return "—";
  const rodado = r.kmAtual - ini;
  if (rodado <= 0) return "—";
  return (r.valorCompra / rodado).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 });
}

const config: CrudConfig = {
  endpoint: "/frota/pneus", tabela: "pneus", singular: "pneu", plural: "Pneus",
  defaults: { status: "estoque" },
  detailHref: r => `/dashboard/frota/pneus/${r.id}`,
  filters: [{ key: "status", label: "Status", options: STATUS_OPTS }],
  columns: [
    { key: "numeroFogo", label: "Nº Fogo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.numeroFogo || r.codigo || "—"}</span> },
    { key: "marca", label: "Marca/Modelo", render: r => [r.marca, r.modelo].filter(Boolean).join(" ") || "—" },
    { key: "medida", label: "Medida", render: r => r.medida || "—" },
    { key: "veiculo", label: "Veículo / Posição", render: r => r.veiculo ? `${r.veiculo.placa}${r.posicao ? " · " + r.posicao : ""}` : "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "custoKm", label: "Custo/km", align: "right", render: r => custoKm(r) },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "numeroFogo", label: "Número de fogo" },
    { key: "codigo", label: "Código interno" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "medida", label: "Medida", placeholder: "Ex: 175/70 R14" },
    { key: "dot", label: "DOT" },
    { key: "dataFabricacao", label: "Data de fabricação", type: "date" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "valorCompra", label: "Valor de compra (R$)", type: "number", step: 0.01 },
    { key: "vidaUtilKm", label: "Vida útil prevista (km)", type: "number" },
    { key: "kmPrevisto", label: "KM previsto", type: "number" },
    { key: "numeroSerie", label: "Número de série" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function PneusPage() {
  return <CrudView config={config} />;
}
