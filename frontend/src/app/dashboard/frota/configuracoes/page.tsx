"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge } from "../_components/crud";

const config: CrudConfig = {
  endpoint: "/frota/categorias", tabela: "categorias_veiculo", singular: "categoria", plural: "Categorias de veículo",
  defaults: { ativo: true, cor: "#0ea5e9", icone: "car" },
  columns: [
    { key: "nome", label: "Nome", render: r => <span style={{ fontWeight: 600 }}>{r.nome}</span> },
    { key: "descricao", label: "Descrição", render: r => r.descricao || "—" },
    { key: "cor", label: "Cor", render: r => <Badge color={r.cor}>{r.cor}</Badge> },
    { key: "ativo", label: "Ativa", render: r => r.ativo ? <Badge color="var(--accent-green)">Sim</Badge> : <Badge>Não</Badge> },
  ],
  fields: [
    { key: "nome", label: "Nome", required: true },
    { key: "descricao", label: "Descrição" },
    { key: "cor", label: "Cor (hex)", placeholder: "#0ea5e9" },
    { key: "icone", label: "Ícone", placeholder: "car" },
    { key: "ativo", label: "Ativa", type: "checkbox", placeholder: "Categoria ativa" },
  ],
};

export default function ConfiguracoesPage() {
  const intro = (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 16, borderLeft: "3px solid var(--accent-cyan)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Configurações da Frota</div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Gerencie as categorias de veículos. Os alertas de CNH, documentos, revisões e manutenções
        são enviados automaticamente por WhatsApp e notificação interna quando o vencimento se aproxima.
      </p>
    </div>
  );
  return <CrudView config={config} intro={intro} />;
}
