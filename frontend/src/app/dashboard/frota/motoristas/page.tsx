"use client";
export const dynamic = "force-dynamic";
import CrudView, { CrudConfig, Badge, fmtDate } from "../_components/crud";

const STATUS: Record<string, string> = { ativo: "var(--accent-green)", inativo: "var(--text-muted)", afastado: "var(--accent-amber)" };
const STATUS_OPTS = [
  { value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }, { value: "afastado", label: "Afastado" },
];
const CNH_OPTS = ["A", "B", "AB", "C", "D", "E"].map(v => ({ value: v, label: v }));

function cnhVencendo(d?: string | null) {
  if (!d) return null;
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "var(--accent-red)";
  if (dias <= 30) return "var(--accent-amber)";
  return null;
}

const config: CrudConfig = {
  endpoint: "/frota/motoristas", tabela: "motoristas", singular: "motorista", plural: "Motoristas",
  defaults: { status: "ativo" },
  filters: [{ key: "status", label: "Status", options: STATUS_OPTS }],
  columns: [
    { key: "nome", label: "Nome", render: r => <span style={{ fontWeight: 600 }}>{r.nome}</span> },
    { key: "cnh", label: "CNH", render: r => r.cnh || "—" },
    { key: "categoriaCnh", label: "Cat.", render: r => r.categoriaCnh || "—" },
    { key: "validadeCnh", label: "Validade CNH", render: r => {
      const cor = cnhVencendo(r.validadeCnh);
      return cor ? <Badge color={cor}>{fmtDate(r.validadeCnh)}</Badge> : fmtDate(r.validadeCnh);
    } },
    { key: "telefone", label: "Telefone", render: r => r.telefone || "—" },
    { key: "status", label: "Status", render: r => <Badge color={STATUS[r.status]}>{STATUS_OPTS.find(s => s.value === r.status)?.label || r.status}</Badge> },
  ],
  fields: [
    { key: "nome", label: "Nome", required: true },
    { key: "cpf", label: "CPF" },
    { key: "cnh", label: "Nº da CNH" },
    { key: "categoriaCnh", label: "Categoria CNH", type: "select", options: CNH_OPTS },
    { key: "validadeCnh", label: "Validade da CNH", type: "date" },
    { key: "telefone", label: "Telefone" },
    { key: "email", label: "E-mail" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTS },
    { key: "observacoes", label: "Observações", type: "textarea" },
  ],
};

export default function MotoristasPage() {
  return <CrudView config={config} />;
}
