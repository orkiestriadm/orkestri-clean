"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import CrudView, { CrudConfig, Badge, fmtMoney } from "../_components/crud";
import { api } from "@/lib/api";
import { Package } from "lucide-react";

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

/**
 * Estoque de pneus avulsos.
 *
 * O KPI "Pneus em Estoque" da dashboard não tinha tela atrás: mostrava 0 com 52
 * pneus em uso, e não havia como saber se a frota realmente não tem sobressalente
 * ou se ninguém cadastrou. Aqui o número passa a ter o que abrir.
 *
 * A quebra por MEDIDA é o ponto: quem vai trocar um pneu não pergunta quantos
 * existem, pergunta se existe **daquela medida**. Um total de 40 pneus não
 * ajuda em nada se nenhum deles serve no caminhão que está parado.
 */
function EstoqueDePneus() {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api.get("/frota/pneus/estoque/resumo", { silent: true })
      .then(r => setD(r.data)).catch(() => setErro(true));
  }, []);

  if (erro || !d) return null;
  const t = d.totais || {};
  const cards = [
    { label: "Disponíveis", valor: t.disponiveis ?? 0, cor: "var(--accent-cyan)", ajuda: "Estoque + reserva, prontos para montar" },
    { label: "Em recapagem", valor: t.recapagem ?? 0, cor: "var(--accent-amber)", ajuda: "Fora, voltam depois" },
    { label: "Descartados", valor: t.descarte ?? 0, cor: "var(--accent-red)", ajuda: "Fim de vida" },
    { label: "Em uso", valor: t.emUso ?? 0, cor: "var(--accent-green)", ajuda: "Montados em veículo" },
    { label: "Valor em estoque", valor: fmtMoney(t.valorEstoque || 0), cor: "#8b5cf6", ajuda: "Só o que dá para montar hoje" },
  ];

  return (
    <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 mb-4">
      <h3 className="text-sm font-bold text-primary-o mb-3 flex items-center gap-2">
        <Package size={15} /> Estoque de pneus avulsos
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {cards.map(c => (
          <div key={c.label} className="surface-sunken rounded-xl p-3" title={c.ajuda}>
            <div className="metric text-lg font-bold" style={{ color: c.cor }}>
              {typeof c.valor === "number" ? c.valor.toLocaleString("pt-BR") : c.valor}
            </div>
            <div className="text-[11px] text-muted-o mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {d.porMedida?.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr>
                {["Medida", "Total", "Estoque", "Reserva", "Recapagem", "Descarte"].map(h => (
                  <th key={h} className="px-3 py-2 font-semibold text-[11px] uppercase tracking-wider text-muted-o">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle-o">
              {d.porMedida.map((m: any) => (
                <tr key={m.medida}>
                  <td className="px-3 py-2 font-mono text-primary-o">{m.medida}</td>
                  <td className="px-3 py-2 num">{m.total}</td>
                  <td className="px-3 py-2 num" style={{ color: m.estoque ? "var(--accent-cyan)" : "var(--text-faint)" }}>{m.estoque}</td>
                  <td className="px-3 py-2 num" style={{ color: m.reserva ? "#8b5cf6" : "var(--text-faint)" }}>{m.reserva}</td>
                  <td className="px-3 py-2 num" style={{ color: m.recapagem ? "var(--accent-amber)" : "var(--text-faint)" }}>{m.recapagem}</td>
                  <td className="px-3 py-2 num" style={{ color: m.descarte ? "var(--accent-red)" : "var(--text-faint)" }}>{m.descarte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Zero avulsos é uma resposta legítima — mas precisa vir escrita, senão o
        // usuário fica sem saber se a tela falhou ou se o estoque está vazio mesmo.
        <p className="text-[12px] text-muted-o">
          Nenhum pneu fora de veículo. Todos os {(t.emUso ?? 0).toLocaleString("pt-BR")} cadastrados
          estão montados — não há sobressalente registrado.
        </p>
      )}
    </div>
  );
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
  return <CrudView config={config} intro={<EstoqueDePneus />} />;
}
