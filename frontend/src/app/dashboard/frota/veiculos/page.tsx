"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge } from "../_components/crud";

// `operando_com_avaria` é a porta de entrada MANUAL do farol amarelo: o veículo
// roda, mas tem defeito conhecido. É como a planilha FORFT_0005 sempre tratou o
// estado do meio — uma coluna digitada. Quando existir OS aberta, ela tem
// precedência sobre este campo (ver backend/.../frota-status.ts).
const STATUS: Record<string, string> = {
  ativo: "var(--accent-green)", operando_com_avaria: "var(--accent-amber)",
  manutencao: "var(--accent-amber)",
  inativo: "var(--text-muted)", vendido: "var(--accent-red)", sinistrado: "var(--accent-red)",
};
const STATUS_OPTS = [
  { value: "ativo", label: "Ativo" },
  { value: "operando_com_avaria", label: "Operando com avaria" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "inativo", label: "Inativo" }, { value: "vendido", label: "Vendido" },
  { value: "sinistrado", label: "Sinistrado" },
];
const TIPO_OPTS = ["carro", "moto", "caminhao", "van", "onibus"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
const COMB_OPTS = ["gasolina", "etanol", "diesel", "flex", "eletrico", "gnv"].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

const config: CrudConfig = {
  endpoint: "/frota/veiculos", tabela: "veiculos", singular: "veículo", plural: "Veículos", limit: 200,
  defaults: { tipo: "carro", combustivel: "flex", status: "ativo" },
  detailHref: r => `/dashboard/frota/veiculos/${r.id}`,
  columns: [
    { key: "placa", label: "Placa", render: r => <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{r.placa}</span> },
    // As duas convivem: `codigo` é o patrimônio interno (auto, FRT-00001) e
    // `identificacao` é o apelido operacional (GL1, TR04). Ao introduzir a
    // segunda eu havia SUBSTITUÍDO a primeira, tirando o código da listagem.
    { key: "identificacao", label: "Identificação", render: r => <span style={{ fontFamily: "var(--font-mono)", color: r.identificacao ? "var(--text-primary)" : "var(--text-faint)" }}>{r.identificacao || "—"}</span> },
    { key: "codigo", label: "Código", render: r => <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{r.codigo}</span> },
    { key: "modelo", label: "Marca/Modelo", render: r => [r.marca, r.modelo].filter(Boolean).join(" ") || "—" },
    { key: "descricao", label: "Descrição", render: r => <span title={r.descricao || ""} style={{ display: "inline-block", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom", color: r.descricao ? "var(--text-primary)" : "var(--text-muted)" }}>{r.descricao || "—"}</span> },
    { key: "setor", label: "Setor", render: r => r.setor ? <Badge color={r.setor.cor}>{r.setor.nome}</Badge> : "—" },
    { key: "kmAtual", label: "Hodômetro", align: "right", render: r => (r.kmAtual ?? 0).toLocaleString("pt-BR") },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    // ── O que identifica o veículo. É por aqui que se procura. ──────────────
    { key: "placa", label: "Placa", required: true, placeholder: "ABC1D23", secao: "Identificação" },
    { key: "identificacao", label: "Identificação", placeholder: "GL1, TR04, IT08...", secao: "Identificação",
      ajuda: "Apelido que a operação usa no dia a dia" },
    { key: "codigo", label: "Código interno", placeholder: "gerado se vazio", secao: "Identificação",
      ajuda: "Patrimônio. Deixe em branco para o sistema numerar" },
    { key: "tipo", label: "Tipo", type: "select", options: TIPO_OPTS, secao: "Identificação" },

    // ── A ficha do veículo: o que ele é, e não muda. ────────────────────────
    { key: "marca", label: "Marca", secao: "Veículo" },
    { key: "modelo", label: "Modelo", secao: "Veículo" },
    { key: "cor", label: "Cor", secao: "Veículo" },
    { key: "anoFabricacao", label: "Ano de fabricação", type: "number", secao: "Veículo" },
    { key: "anoModelo", label: "Ano do modelo", type: "number", secao: "Veículo" },
    { key: "renavam", label: "RENAVAM", secao: "Veículo" },
    { key: "chassi", label: "Chassi", secao: "Veículo" },

    // ── Onde está e como está. Muda com o uso. ──────────────────────────────
    { key: "status", label: "Situação", type: "select", options: STATUS_OPTS, secao: "Operação" },
    { key: "setorId", label: "Setor", type: "select", source: "setores", secao: "Operação" },
    { key: "centroCusto", label: "Centro de custo", secao: "Operação" },
    { key: "kmAtual", label: "Hodômetro (km)", type: "number", secao: "Operação" },
    { key: "horimetroAtual", label: "Horímetro (h)", type: "number", secao: "Operação",
      ajuda: "Para máquina que conta hora, não quilômetro" },

    // ── Abastecimento: separado porque alimenta o cálculo de consumo. ───────
    { key: "combustivel", label: "Combustível", type: "select", options: COMB_OPTS, secao: "Abastecimento" },
    { key: "capacidadeTanque", label: "Capacidade do tanque (L)", type: "number", step: 0.1, secao: "Abastecimento" },

    // ── Aquisição: preenchido uma vez, quase nunca revisitado. ──────────────
    { key: "dataAquisicao", label: "Data de aquisição", type: "date", secao: "Aquisição" },
    { key: "valorAquisicao", label: "Valor de aquisição (R$)", type: "number", step: 0.01, secao: "Aquisição" },

    // ── Texto livre, por último: ocupa a linha inteira e não compete. ───────
    { key: "descricao", label: "Descrição", type: "textarea", full: true, secao: "Anotações" },
    { key: "observacoes", label: "Observações", type: "textarea", full: true, secao: "Anotações" },
  ],
};

export default function VeiculosPage() {
  return <CrudView config={config} />;
}
