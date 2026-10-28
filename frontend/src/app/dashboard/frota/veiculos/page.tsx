"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge } from "../_components/crud";

const STATUS: Record<string, string> = { ativo: "var(--accent-green)", manutencao: "var(--accent-amber)", inativo: "var(--text-muted)", vendido: "var(--accent-red)" };
const STATUS_OPTS = [
  { value: "ativo", label: "Ativo" }, { value: "manutencao", label: "Em manutenção" },
  { value: "inativo", label: "Inativo" }, { value: "vendido", label: "Vendido" },
];
const TIPO_OPTS = ["carro", "moto", "caminhao", "van", "onibus"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "eletrico", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

const config: CrudConfig = {
  endpoint: "/frota/veiculos", tabela: "veiculos", singular: "veículo", plural: "Veículos",
  defaults: { tipo: "carro", combustivel: "flex", status: "ativo" },
  filters: [
    { key: "status", label: "Status", options: STATUS_OPTS },
    { key: "tipo", label: "Tipo", options: TIPO_OPTS },
  ],
  columns: [
    { key: "placa", label: "Placa", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.placa}</span> },
    { key: "codigo", label: "Código", render: r => <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{r.codigo}</span> },
    { key: "modelo", label: "Marca/Modelo", render: r => [r.marca, r.modelo].filter(Boolean).join(" ") || "—" },
    { key: "categoria", label: "Categoria", render: r => r.categoria ? <Badge color={r.categoria.cor}>{r.categoria.nome}</Badge> : "—" },
    { key: "motorista", label: "Motorista", render: r => r.motorista?.nome || "—" },
    { key: "kmAtual", label: "KM", align: "right", render: r => (r.kmAtual ?? 0).toLocaleString("pt-BR") },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "placa", label: "Placa", required: true, placeholder: "ABC1D23" },
    { key: "codigo", label: "Código (auto se vazio)", placeholder: "FRT-00001" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "anoFabricacao", label: "Ano fabricação", type: "number" },
    { key: "anoModelo", label: "Ano modelo", type: "number" },
    { key: "cor", label: "Cor" },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS },
    { key: "combustivel", label: "Combustível", type: "select", options: COMB_OPTS },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "categoriaId", label: "Categoria", type: "select", source: "categorias" },
    { key: "motoristaId", label: "Motorista padrão", type: "select", source: "motoristas" },
    { key: "setorId", label: "Setor", type: "select", source: "setores" },
    { key: "kmAtual", label: "KM atual", type: "number" },
    { key: "capacidadeTanque", label: "Capacidade tanque (L)", type: "number", step: 0.1 },
    { key: "renavam", label: "RENAVAM" },
    { key: "chassi", label: "Chassi" },
    { key: "dataAquisicao", label: "Data de aquisição", type: "date" },
    { key: "valorAquisicao", label: "Valor de aquisição (R$)", type: "number", step: 0.01 },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function VeiculosPage() {
  return <CrudView config={config} />;
}
