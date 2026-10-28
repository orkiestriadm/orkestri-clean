"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, fmtDate, fmtMoney } from "../_components/crud";

const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

const config: CrudConfig = {
  endpoint: "/frota/abastecimentos", tabela: "abastecimentos", singular: "abastecimento", plural: "Abastecimentos",
  defaults: { tanqueCheio: true },
  columns: [
    { key: "data", label: "Data", render: r => fmtDate(r.data) },
    { key: "veiculo", label: "Veículo", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.veiculo?.placa || "—"}</span> },
    { key: "motorista", label: "Motorista", render: r => r.motorista?.nome || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => r.kmAtual != null ? r.kmAtual.toLocaleString("pt-BR") : "—" },
    { key: "litros", label: "Litros", align: "right", render: r => r.litros != null ? r.litros.toLocaleString("pt-BR") : "—" },
    { key: "valorTotal", label: "Total", align: "right", render: r => fmtMoney(r.valorTotal) },
    { key: "consumoKmL", label: "km/L", align: "right", render: r => r.consumoKmL != null ? r.consumoKmL.toLocaleString("pt-BR") : "—" },
  ],
  fields: [
    { key: "veiculoId", label: "Veículo", type: "select", source: "veiculos", required: true },
    { key: "motoristaId", label: "Motorista", type: "select", source: "motoristas" },
    { key: "data", label: "Data", type: "date" },
    { key: "kmAtual", label: "KM atual", type: "number" },
    { key: "litros", label: "Litros", type: "number", step: 0.01 },
    { key: "valorLitro", label: "Valor por litro (R$)", type: "number", step: 0.001 },
    { key: "valorTotal", label: "Valor total (R$) — auto se vazio", type: "number", step: 0.01 },
    { key: "tipoCombustivel", label: "Combustível", type: "select", options: COMB_OPTS },
    { key: "posto", label: "Posto" },
    { key: "tanqueCheio", label: "Tanque cheio", type: "checkbox", placeholder: "Encheu o tanque" },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function AbastecimentosPage() {
  return <CrudView config={config} />;
}
