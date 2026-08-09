"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, useMemo, ReactNode } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Truck,
  Users,
  CreditCard,
  CircleDot,
  History,
  CalendarDays,
  Wrench,
  DollarSign,
  Fuel,
  Activity,
  Download,
  Mail,
  Plus,
  Trash2,
  X,
  RefreshCw,
  AlertTriangle,
  Clock,
  Play,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

type ReportType =
  | "veiculos"
  | "motoristas"
  | "cnhs"
  | "pneus"
  | "historico-pneus"
  | "revisoes"
  | "manutencoes"
  | "custos"
  | "abastecimentos"
  | "disponibilidade"
  | "status-frota";

interface ReportConfig {
  id: ReportType;
  title: string;
  description: string;
  icon: any;
  endpoint: string;
  filters: ("date" | "veiculo" | "motorista" | "status" | "statusCnh" | "tipoPneuEvento" | "tipoManut" | "pneuId")[];
}

const REPORTS_CONFIG: ReportConfig[] = [
  {
    id: "veiculos",
    title: "Veículos",
    description: "Frota cadastrada, especificações técnicas e quilometragem atual.",
    icon: Truck,
    endpoint: "/frota/relatorios/veiculos",
    filters: ["status"]
  },
  {
    id: "motoristas",
    title: "Motoristas",
    description: "Cadastro de condutores autorizados, departamentos e status.",
    icon: Users,
    endpoint: "/frota/relatorios/motoristas",
    filters: ["status"]
  },
  {
    id: "cnhs",
    title: "Vencimento de CNHs",
    description: "Acompanhamento da validade e situação das carteiras de habilitação.",
    icon: CreditCard,
    endpoint: "/frota/relatorios/cnhs",
    filters: ["statusCnh"]
  },
  {
    id: "pneus",
    title: "Pneus",
    description: "Inventário de pneus, posições nos eixos, vidas úteis e status.",
    icon: CircleDot,
    endpoint: "/frota/relatorios/pneus",
    filters: ["status", "veiculo"]
  },
  {
    id: "historico-pneus",
    title: "Histórico de Pneus",
    description: "Registros de rodízio, manutenção, recapagem e descarte de pneus.",
    icon: History,
    endpoint: "/frota/relatorios/historico-pneus",
    filters: ["date", "tipoPneuEvento"]
  },
  {
    id: "revisoes",
    title: "Revisões",
    description: "Cronograma de revisões periódicas por data ou quilometragem.",
    icon: CalendarDays,
    endpoint: "/frota/relatorios/revisoes",
    filters: ["date", "status", "veiculo"]
  },
  {
    id: "manutencoes",
    title: "Manutenções",
    description: "Ordens de serviço corretivas e preventivas, oficinas e custos de peças.",
    icon: Wrench,
    endpoint: "/frota/relatorios/manutencoes",
    filters: ["date", "status", "tipoManut", "veiculo"]
  },
  {
    id: "custos",
    title: "Custos Consolidados",
    description: "Demonstrativo financeiro agrupado por veículo (combustível + serviços).",
    icon: DollarSign,
    endpoint: "/frota/relatorios/custos",
    filters: ["date", "veiculo"]
  },
  {
    id: "abastecimentos",
    title: "Abastecimentos",
    description: "Histórico de abastecimentos, consumo médio de combustível e custo/km.",
    icon: Fuel,
    endpoint: "/frota/relatorios/abastecimentos",
    filters: ["date", "veiculo", "motorista"]
  },
  {
    id: "disponibilidade",
    title: "Disponibilidade de Frota",
    description: "Métricas de tempo ativo vs. tempo parado para manutenção.",
    icon: Activity,
    endpoint: "/frota/relatorios/disponibilidade",
    filters: ["date"]
  },
  {
    id: "status-frota",
    title: "Status da Frota (Farol)",
    // Foto do agora: não aceita filtro de período, ao contrário dos demais.
    description: "Situação atual de cada veículo — operando, com avaria ou parado, com o motivo da parada.",
    icon: Activity,
    endpoint: "/frota/relatorios/status-frota",
    filters: []
  }
];

// ── Formatação ────────────────────────────────────────────────────────────────
const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: any, casas = 0) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtData = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "");
/** Abrevia valores grandes nos eixos: 1.234.567 → "1,2 mi". */
const fmtEixo = (v: number) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString("pt-BR");
};

/** Neutraliza fórmulas (CSV injection) e aplica aspas do CSV. */
const csvCell = (v: any): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

// ── Definição única das colunas ───────────────────────────────────────────────
// `get` alimenta CSV / Excel / PDF (e casa com os headers do backend, usados no
// e-mail); `cell` é o render da tela. Um único lugar para mudar uma coluna.
type Col = {
  header: string;
  get: (l: any) => any;
  cell?: (l: any) => ReactNode;
  align?: "right";
  /** Soma exibida no rodapé da tabela. */
  total?: "sum" | "money";
};

const badge = (texto: ReactNode, classe: string) => (
  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${classe}`}>{texto}</span>
);
const NEUTRO = "bg-[var(--border-subtle)] text-[var(--text-muted)]";

const colVeiculoPlaca = (getV: (l: any) => any): Col => ({
  header: "Veículo",
  get: l => getV(l)?.placa || "",
  cell: l => (
    <div>
      <div className="font-mono font-bold text-[var(--text-primary)]">{getV(l)?.placa || "-"}</div>
      {getV(l)?.modelo ? <div className="text-[11px] text-[var(--text-faint)]">{getV(l).modelo}</div> : null}
    </div>
  ),
});

const REPORT_COLUMNS: Record<ReportType, Col[]> = {
  veiculos: [
    { header: "Placa", get: l => l.placa, cell: l => <span className="font-mono font-bold text-[var(--text-primary)]">{l.placa}</span> },
    { header: "Código", get: l => l.codigo },
    { header: "Marca", get: l => l.marca || "" },
    { header: "Modelo", get: l => l.modelo || "" },
    { header: "Tipo", get: l => l.tipo, cell: l => <span className="text-[var(--text-muted)] capitalize">{l.tipo}</span> },
    { header: "Combustível", get: l => l.combustivel, cell: l => <span className="text-[var(--text-muted)] capitalize">{l.combustivel}</span> },
    {
      header: "Status", get: l => l.status,
      cell: l => badge(
        l.status === "manutencao" ? "Manutenção" : l.status,
        l.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" :
        l.status === "manutencao" ? "bg-amber-500/10 text-amber-400" : NEUTRO
      )
    },
    { header: "KM Atual", get: l => Number(l.kmAtual || 0), align: "right", total: "sum", cell: l => `${fmtNum(l.kmAtual)} km` },
  ],
  motoristas: [
    { header: "Nome", get: l => l.nome, cell: l => <span className="font-bold text-[var(--text-primary)]">{l.nome}</span> },
    { header: "CPF", get: l => l.cpf || "", cell: l => <span className="font-mono text-[var(--text-muted)]">{l.cpf || "-"}</span> },
    { header: "Matrícula", get: l => l.matricula || "", cell: l => <span className="font-mono">{l.matricula || "-"}</span> },
    { header: "Departamento", get: l => l.departamento || "" },
    { header: "Cargo", get: l => l.cargo || "" },
    {
      header: "Status", get: l => l.status,
      cell: l => badge(l.status, l.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" : NEUTRO)
    },
  ],
  cnhs: [
    { header: "Nome", get: l => l.nome, cell: l => <span className="font-bold text-[var(--text-primary)]">{l.nome}</span> },
    { header: "CPF", get: l => l.cpf || "", cell: l => <span className="font-mono text-[var(--text-muted)]">{l.cpf || "-"}</span> },
    { header: "Matrícula", get: l => l.matricula || "", cell: l => <span className="font-mono">{l.matricula || "-"}</span> },
    { header: "CNH", get: l => l.cnh || "", cell: l => <span className="font-mono">{l.cnh || "-"}</span> },
    { header: "Categoria", get: l => l.categoriaCnh || "", cell: l => <span className="font-mono">{l.categoriaCnh || "-"}</span> },
    { header: "Validade", get: l => fmtData(l.validadeCnh), cell: l => <span className="font-mono">{fmtData(l.validadeCnh) || "-"}</span> },
    {
      header: "Status CNH", get: l => l.statusCnh,
      cell: l => badge(
        l.statusCnh === "vencendo_30" ? "Vence em 30d" : l.statusCnh === "sem_cnh" ? "Sem CNH" : l.statusCnh,
        l.statusCnh === "vigente" ? "bg-emerald-500/10 text-emerald-400" :
        l.statusCnh === "vencendo_30" ? "bg-amber-500/10 text-amber-400" :
        l.statusCnh === "vencida" ? "bg-red-500/10 text-red-400" : NEUTRO
      )
    },
  ],
  pneus: [
    { header: "Nº Fogo", get: l => l.numeroFogo || "", cell: l => <span className="font-mono font-bold text-[var(--text-primary)]">{l.numeroFogo || "-"}</span> },
    { header: "Código", get: l => l.codigo || "", cell: l => <span className="font-mono">{l.codigo || "-"}</span> },
    { header: "Marca", get: l => l.marca || "" },
    { header: "Modelo", get: l => l.modelo || "" },
    { header: "Medida", get: l => l.medida || "", cell: l => <span className="font-mono text-[var(--text-muted)]">{l.medida || "-"}</span> },
    { header: "Posição", get: l => l.posicao || "", cell: l => <span className="font-mono text-[var(--text-muted)]">{l.posicao || "-"}</span> },
    { header: "Veículo", get: l => l.veiculo?.placa || "", cell: l => <span className="font-mono">{l.veiculo?.placa || "-"}</span> },
    {
      header: "Status", get: l => l.status,
      cell: l => badge(
        l.status === "em_uso" ? "Em Uso" : l.status,
        l.status === "em_uso" ? "bg-emerald-500/10 text-emerald-400" :
        l.status === "estoque" ? "bg-cyan-500/10 text-cyan-400" :
        l.status === "recapagem" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
      )
    },
  ],
  "historico-pneus": [
    {
      header: "Nº Fogo", get: l => l.pneu?.numeroFogo || "",
      cell: l => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">{l.pneu?.numeroFogo || "-"}</div>
          <div className="text-[11px] text-[var(--text-faint)] font-mono">{l.pneu?.codigo}</div>
        </div>
      )
    },
    { header: "Código Pneu", get: l => l.pneu?.codigo || "" },
    { header: "Veículo", get: l => l.veiculo?.placa || "", cell: l => <span className="font-mono">{l.veiculo?.placa || "-"}</span> },
    { header: "Tipo Evento", get: l => l.tipo, cell: l => <span className="uppercase font-semibold text-[11px]">{l.tipo}</span> },
    { header: "Data", get: l => fmtData(l.data), cell: l => <span className="font-mono text-[var(--text-muted)]">{fmtData(l.data) || "-"}</span> },
    { header: "KM", get: l => Number(l.km || 0), align: "right", cell: l => `${fmtNum(l.km)} km` },
    { header: "Custo", get: l => Number(l.custo || 0), align: "right", total: "money", cell: l => <span className="text-amber-500">{fmtMoney(l.custo)}</span> },
    { header: "Observação", get: l => l.observacao || "", cell: l => <span className="text-[var(--text-muted)]">{l.observacao || "-"}</span> },
  ],
  revisoes: [
    colVeiculoPlaca(l => l.veiculo),
    { header: "Tipo", get: l => l.tipo || "", cell: l => <span className="capitalize">{l.tipo || "-"}</span> },
    { header: "Descrição", get: l => l.descricao || "", cell: l => <span className="text-[var(--text-muted)]">{l.descricao || "-"}</span> },
    { header: "Data Prevista", get: l => fmtData(l.dataPrevista), cell: l => <span className="font-mono">{fmtData(l.dataPrevista) || "-"}</span> },
    { header: "KM Previsto", get: l => Number(l.kmPrevisto || 0), align: "right", cell: l => `${fmtNum(l.kmPrevisto)} km` },
    { header: "Data Realizada", get: l => fmtData(l.dataRealizada), cell: l => <span className="font-mono">{fmtData(l.dataRealizada) || "-"}</span> },
    { header: "KM Realizado", get: l => Number(l.kmRealizado || 0), align: "right", cell: l => l.kmRealizado ? `${fmtNum(l.kmRealizado)} km` : "-" },
    {
      header: "Status", get: l => l.status,
      cell: l => badge(
        l.status,
        l.status === "realizada" ? "bg-emerald-500/10 text-emerald-400" :
        l.status === "atrasada" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
      )
    },
    { header: "Custo", get: l => Number(l.custo || 0), align: "right", total: "money", cell: l => <span className="text-emerald-400">{fmtMoney(l.custo)}</span> },
  ],
  manutencoes: [
    { header: "OS", get: l => l.numeroOs || "", cell: l => <span className="font-mono font-bold text-[var(--text-secondary)]">{l.numeroOs || "-"}</span> },
    colVeiculoPlaca(l => l.veiculo),
    { header: "Tipo OS", get: l => l.tipo, cell: l => <span className="capitalize font-semibold text-[11px]">{l.tipo}</span> },
    { header: "Descrição", get: l => l.descricao || "", cell: l => <span className="text-[var(--text-muted)]">{l.descricao || "-"}</span> },
    // dataEfetiva = data ?? dataAbertura. Sem isso a coluna saía vazia em toda OS
    // que só tem data de abertura preenchida.
    { header: "Data", get: l => fmtData(l.dataEfetiva || l.data || l.dataAbertura), cell: l => <span className="font-mono">{fmtData(l.dataEfetiva || l.data || l.dataAbertura) || "-"}</span> },
    { header: "KM", get: l => Number(l.km || 0), align: "right", cell: l => `${fmtNum(l.km)} km` },
    {
      header: "Status", get: l => l.status,
      cell: l => badge(
        l.status,
        l.status === "concluida" ? "bg-emerald-500/10 text-emerald-400" :
        l.status === "cancelada" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
      )
    },
    { header: "Custo Total", get: l => Number(l.custo || 0), align: "right", total: "money", cell: l => <span className="font-bold text-amber-500">{fmtMoney(l.custo)}</span> },
    { header: "Custo Peças", get: l => Number(l.custoPecas || 0), align: "right", total: "money", cell: l => fmtMoney(l.custoPecas) },
    { header: "Custo Serviços", get: l => Number(l.custoServicos || 0), align: "right", total: "money", cell: l => fmtMoney(l.custoServicos) },
  ],
  abastecimentos: [
    colVeiculoPlaca(l => l.veiculo),
    { header: "Motorista", get: l => l.motorista?.nome || "", cell: l => <span className="font-semibold">{l.motorista?.nome || "-"}</span> },
    { header: "Data", get: l => fmtData(l.data), cell: l => <span className="font-mono text-[var(--text-muted)]">{fmtData(l.data)}</span> },
    { header: "Posto", get: l => l.posto || "", cell: l => l.posto || "-" },
    { header: "Combustível", get: l => l.tipoCombustivel || "", cell: l => <span className="text-[var(--text-muted)] capitalize">{l.tipoCombustivel || "-"}</span> },
    { header: "Litros", get: l => Number(l.litros || 0), align: "right", total: "sum", cell: l => `${fmtNum(l.litros, 2)} L` },
    { header: "KM Atual", get: l => Number(l.kmAtual || 0), align: "right", cell: l => `${fmtNum(l.kmAtual)} km` },
    { header: "Custo Total", get: l => Number(l.valorTotal || 0), align: "right", total: "money", cell: l => <span className="font-bold text-emerald-400">{fmtMoney(l.valorTotal)}</span> },
    { header: "Consumo (km/L)", get: l => Number(l.consumoKmL || 0), align: "right", cell: l => l.consumoKmL ? <span className="text-cyan-400 font-semibold">{fmtNum(l.consumoKmL, 2)} km/L</span> : "-" },
    { header: "Custo/KM", get: l => Number(l.custoKm || 0), align: "right", cell: l => l.custoKm ? <span className="text-[var(--text-muted)]">{fmtMoney(l.custoKm)}</span> : "-" },
  ],
  custos: [
    colVeiculoPlaca(l => l.veiculo),
    { header: "Qtd OS", get: l => Number(l.totalManutencoes || 0), align: "right", total: "sum" },
    { header: "Qtd Abast.", get: l => Number(l.totalAbastecimentos || 0), align: "right", total: "sum" },
    { header: "Litros", get: l => Number(l.litros || 0), align: "right", total: "sum", cell: l => `${fmtNum(l.litros, 2)} L` },
    { header: "Custo OS", get: l => Number(l.custoManutencao || 0), align: "right", total: "money", cell: l => <span className="text-amber-500">{fmtMoney(l.custoManutencao)}</span> },
    { header: "Custo Abast.", get: l => Number(l.custoAbastecimento || 0), align: "right", total: "money", cell: l => <span className="text-emerald-400">{fmtMoney(l.custoAbastecimento)}</span> },
    { header: "Custo Total", get: l => Number(l.custoTotal || 0), align: "right", total: "money", cell: l => <span className="font-bold text-[#22c55e]">{fmtMoney(l.custoTotal)}</span> },
  ],
  disponibilidade: [
    colVeiculoPlaca(l => l.veiculo),
    { header: "Dias Totais", get: l => Number(l.diasTotais || 0), align: "right" },
    { header: "Dias Parado (Manut.)", get: l => Number(l.diasParado || 0), align: "right", total: "sum", cell: l => <span className="text-amber-500">{fmtNum(l.diasParado, 2)} d</span> },
    { header: "Dias Ativo", get: l => Number(l.diasAtivo || 0), align: "right", total: "sum", cell: l => <span className="text-emerald-400">{fmtNum(l.diasAtivo, 2)} d</span> },
    {
      header: "Disponibilidade (%)", get: l => Number(l.disponibilidade || 0), align: "right",
      cell: l => (
        <span className={`font-bold ${l.disponibilidade >= 90 ? "text-emerald-400" : l.disponibilidade >= 75 ? "text-amber-400" : "text-red-400"}`}>
          {l.disponibilidade}%
        </span>
      )
    },
    {
      header: "Status Atual", get: l => l.statusAtual,
      cell: l => badge(
        l.statusAtual === "manutencao" ? "Em Manutenção" : l.statusAtual,
        l.statusAtual === "ativo" ? "bg-emerald-500/10 text-emerald-400" :
        l.statusAtual === "manutencao" ? "bg-amber-500/10 text-amber-400" : NEUTRO
      )
    },
  ],
  "status-frota": [
    {
      header: "Status", get: l => l.statusOperacional,
      cell: l => badge(
        l.statusOperacional,
        l.farol === "operando" ? "bg-emerald-500/10 text-emerald-400" :
        l.farol === "operando_com_avaria" ? "bg-amber-500/10 text-amber-400" :
        l.farol === "parado" ? "bg-red-500/10 text-red-400" : NEUTRO
      )
    },
    { header: "Motivo", get: l => (l.origemFarol && l.origemFarol !== "nenhuma" ? l.motivoFarol : "") },
    colVeiculoPlaca(l => l.veiculo),
    { header: "Identificação", get: l => l.veiculo?.identificacao || "" },
    { header: "Modelo", get: l => [l.veiculo?.marca, l.veiculo?.modelo].filter(Boolean).join(" ") },
    { header: "Setor", get: l => l.setor || "" },
    { header: "Dt Baixa", get: l => l.dataBaixa, cell: l => fmtData(l.dataBaixa) },
    {
      header: "Dias Parado", get: l => Number(l.diasParado || 0), align: "right",
      cell: l => (l.diasParado == null ? "—" : <span className="text-amber-500">{fmtNum(l.diasParado)} d</span>)
    },
    {
      header: "Prev. Liberação", get: l => l.previsaoLiberacao,
      cell: l => (l.previsaoLiberacao
        ? <span className={l.previsaoAtrasada ? "font-bold text-red-400" : ""}>{fmtData(l.previsaoLiberacao)}</span>
        : "—")
    },
    { header: "Localização", get: l => l.localizacao || "" },
    { header: "Tipo Manut.", get: l => l.tipoManutencao || "" },
    { header: "Problema", get: l => l.problema || "" },
    { header: "Prestador", get: l => l.prestador || "" },
  ],
};

const CHART_H = 260;

export default function FrotaRelatoriosPage() {
  const [activeReport, setActiveReport] = useState<ReportType>("custos");

  // Filters state
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [status, setStatus] = useState("");
  const [statusCnh, setStatusCnh] = useState("");
  const [tipoPneuEvento, setTipoPneuEvento] = useState("");
  const [tipoManut, setTipoManut] = useState("");

  // Helpers
  const [veiculos, setVeiculos] = useState<{ id: string; placa: string; modelo?: string }[]>([]);
  const [motoristas, setMotoristas] = useState<{ id: string; nome: string }[]>([]);

  // Report Data
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  // Assinatura dos filtros usados na última carga — habilita o aviso de "filtros
  // alterados" no botão Atualizar.
  const [assinaturaCarregada, setAssinaturaCarregada] = useState("");

  // Email Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Schedule Modal / State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Schedule Form
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleFreq, setScheduleFreq] = useState("semanal");
  const [scheduleFormat, setScheduleFormat] = useState("csv");
  const [scheduleDest, setScheduleDest] = useState("");

  // Sequência de requisição: descarta resposta antiga que chegue depois de uma
  // mais nova (antes uma resposta atrasada sobrescrevia o resultado atual).
  const reqSeq = useRef(0);

  // Fetch Lookups
  useEffect(() => {
    setMounted(true);
    api.get("/frota/veiculos", { params: { limit: 1000 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {});
    api.get("/frota/motoristas", { params: { limit: 1000 } }).then(r => setMotoristas(r.data?.items || [])).catch(() => {});
  }, []);

  const config = REPORTS_CONFIG.find(r => r.id === activeReport)!;
  const colunas = REPORT_COLUMNS[activeReport];

  // Build params
  const getParams = useCallback(() => {
    const params: any = {};
    if (config.filters.includes("date")) {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    if (config.filters.includes("veiculo") && veiculoId) params.veiculoId = veiculoId;
    if (config.filters.includes("motorista") && motoristaId) params.motoristaId = motoristaId;
    if (config.filters.includes("status") && status) params.status = status;
    if (config.filters.includes("statusCnh") && statusCnh) params.statusCnh = statusCnh;
    if (config.filters.includes("tipoPneuEvento") && tipoPneuEvento) params.tipo = tipoPneuEvento;
    if (config.filters.includes("tipoManut") && tipoManut) params.tipo = tipoManut;
    return params;
  }, [config, from, to, veiculoId, motoristaId, status, statusCnh, tipoPneuEvento, tipoManut]);

  const assinaturaAtual = useMemo(
    () => `${activeReport}|${JSON.stringify(getParams())}`,
    [activeReport, getParams]
  );
  const filtrosAlterados = mounted && assinaturaCarregada !== "" && assinaturaCarregada !== assinaturaAtual;

  // Load report data
  const loadReport = useCallback(async (tipo: ReportType, params: any, assinatura: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setErro(null);
    try {
      const endpoint = REPORTS_CONFIG.find(r => r.id === tipo)!.endpoint;
      const { data } = await api.get(endpoint, { params });
      if (seq !== reqSeq.current) return;
      setReportData(data);
      setOrdenacao(null);
      setAssinaturaCarregada(assinatura);
    } catch (err: any) {
      if (seq !== reqSeq.current) return;
      const msg = err?.response?.data?.message || "Erro ao carregar dados do relatório";
      setErro(typeof msg === "string" ? msg : "Erro ao carregar dados do relatório");
      setReportData(null);
      toast.error(typeof msg === "string" ? msg : "Erro ao carregar dados do relatório");
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  // Carrega ao trocar de relatório. Os filtros NÃO disparam requisição: antes
  // cada tecla numa data gerava uma chamada e o botão "Atualizar" era decorativo.
  useEffect(() => {
    loadReport(activeReport, getParams(), assinaturaAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport]);

  const atualizar = () => loadReport(activeReport, getParams(), assinaturaAtual);

  // Fetch schedules
  const loadSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const { data } = await api.get("/frota/report-schedules");
      setSchedules(data);
    } catch {
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoadingSchedules(false);
    }
  };

  const openSchedulesModal = () => {
    setIsScheduleModalOpen(true);
    loadSchedules();
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleTitle || !scheduleDest) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      await api.post("/frota/report-schedules", {
        titulo: scheduleTitle,
        tipoRelatorio: activeReport,
        formato: scheduleFormat,
        frequencia: scheduleFreq,
        filtros: getParams(),
        destinatarios: scheduleDest
      });
      toast.success("Agendamento criado com sucesso!");
      setScheduleTitle("");
      setScheduleDest("");
      setIsCreatingSchedule(false);
      loadSchedules();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao criar agendamento");
    }
  };

  const handleToggleSchedule = async (id: string, active: boolean) => {
    try {
      await api.patch(`/frota/report-schedules/${id}`, { ativo: !active });
      toast.success("Status do agendamento atualizado");
      loadSchedules();
    } catch {
      toast.error("Erro ao atualizar agendamento");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;
    try {
      await api.delete(`/frota/report-schedules/${id}`);
      toast.success("Agendamento excluído");
      loadSchedules();
    } catch {
      toast.error("Erro ao excluir agendamento");
    }
  };

  // Instant Email Dispatch
  const handleSendEmail = async () => {
    if (!emailRecipients) {
      toast.error("Informe pelo menos um e-mail de destino");
      return;
    }
    setSendingEmail(true);
    try {
      const { data } = await api.post("/frota/relatorios/enviar-email", {
        tipoRelatorio: activeReport,
        filtros: getParams(),
        destinatarios: emailRecipients,
        formato: "csv"
      });
      // O backend responde 200 mesmo quando o provedor recusa o envio. Sem olhar
      // `ok`, a tela dava "enviado com sucesso" para e-mail que nunca saiu.
      if (data?.ok) {
        toast.success(data.mensagem || "Relatório enviado por e-mail com sucesso!");
        setIsEmailModalOpen(false);
        setEmailRecipients("");
      } else {
        toast.error(data?.mensagem || "O relatório não pôde ser enviado.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao enviar e-mail");
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Dados derivados ─────────────────────────────────────────────────────────
  const linhas: any[] = reportData?.linhas || [];

  const linhasOrdenadas = useMemo(() => {
    if (!ordenacao) return linhas;
    const col = colunas[ordenacao.col];
    if (!col) return linhas;
    const mult = ordenacao.dir === "asc" ? 1 : -1;
    return [...linhas].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true }) * mult;
    });
  }, [linhas, ordenacao, colunas]);

  const totaisRodape = useMemo(() => {
    return colunas.map(c => {
      if (!c.total) return null;
      const soma = linhas.reduce((s, l) => s + Number(c.get(l) || 0), 0);
      return c.total === "money" ? fmtMoney(soma) : fmtNum(soma, Number.isInteger(soma) ? 0 : 2);
    });
  }, [linhas, colunas]);

  const ordenarPor = (i: number) => {
    setOrdenacao(o => o?.col === i ? { col: i, dir: o.dir === "asc" ? "desc" : "asc" } : { col: i, dir: "asc" });
  };

  // ── Exportadores (todos derivam de REPORT_COLUMNS) ──────────────────────────
  const matriz = () => ({
    headers: colunas.map(c => c.header),
    rows: linhasOrdenadas.map(l => colunas.map(c => c.get(l))),
  });

  const exportCSV = () => {
    if (!linhas.length) return toast.info("Nenhum dado para exportar");
    const { headers, rows } = matriz();
    const csvContent = [
      headers.map(csvCell).join(";"),
      ...rows.map(r => r.map(csvCell).join(";"))
    ].join("\r\n");

    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!linhas.length) return toast.info("Nenhum dado para exportar");
    try {
      const XLSX: any = await import("xlsx");
      const { headers, rows } = matriz();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Relatório");
      XLSX.writeFile(wb, `relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Erro ao gerar planilha Excel");
    }
  };

  const exportPDF = async () => {
    if (!linhas.length) return toast.info("Nenhum dado para exportar");
    try {
      const { jsPDF }: any = await import("jspdf");
      await import("jspdf-autotable");
      const doc: any = new jsPDF({ orientation: "landscape" });
      const { headers, rows } = matriz();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(config.title, 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Orkestri Gestão de Frota`, 14, 24);

      doc.autoTable({
        startY: 28,
        head: [headers],
        body: rows.map(r => r.map(v => typeof v === "number" ? v.toLocaleString("pt-BR") : v)),
        theme: "striped",
        headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2.5 },
      });

      doc.save(`relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    }
  };

  // ── Gráficos ────────────────────────────────────────────────────────────────
  const tooltipStyle = { backgroundColor: "var(--card)", borderColor: "var(--border-subtle)", borderRadius: 8 };

  const renderChart = () => {
    if (!mounted) return <div style={{ height: CHART_H }} className="mt-4" />;
    if (!linhas.length) {
      return (
        <div style={{ height: CHART_H }} className="mt-4 flex items-center justify-center text-xs text-[var(--text-muted)]">
          Sem dados para exibir no gráfico.
        </div>
      );
    }
    const data = linhas;

    if (activeReport === "custos") {
      const chartData = data.slice(0, 8).map((l: any) => ({
        placa: l.veiculo?.placa || "",
        Manutenção: l.custoManutencao,
        Combustível: l.custoAbastecimento,
      }));
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `R$ ${fmtEixo(v)}`} width={72} />
              <Tooltip formatter={(value: any) => fmtMoney(value)} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Manutenção" stackId="a" fill="var(--accent-amber)" />
              <Bar dataKey="Combustível" stackId="a" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "abastecimentos") {
      // Agregado por dia. Antes ligava numa única linha os 12 últimos eventos —
      // que podiam ser de veículos diferentes, produzindo uma curva sem sentido.
      const porDia = new Map<string, { consumo: number[]; custoKm: number[]; ts: number }>();
      for (const l of data) {
        const d = new Date(l.data);
        const chave = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (!porDia.has(chave)) porDia.set(chave, { consumo: [], custoKm: [], ts: d.getTime() });
        const b = porDia.get(chave)!;
        if (l.consumoKmL != null) b.consumo.push(Number(l.consumoKmL));
        if (l.custoKm != null) b.custoKm.push(Number(l.custoKm));
        b.ts = Math.min(b.ts, d.getTime());
      }
      const media = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
      const chartData = [...porDia.entries()]
        .sort((a, b) => a[1].ts - b[1].ts)
        .slice(-30)
        .map(([dia, b]) => ({
          data: dia,
          consumo: Number(media(b.consumo).toFixed(2)),
          custoKm: Number(media(b.custoKm).toFixed(3)),
        }));
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="data" stroke="var(--text-muted)" fontSize={11} />
              <YAxis yAxisId="left" stroke="var(--accent-cyan)" fontSize={11} width={54} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--accent-green)" fontSize={11} width={54} tickFormatter={(v) => `R$ ${fmtNum(v, 2)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => n === "Custo/KM (R$)" ? fmtMoney(v) : `${fmtNum(v, 2)} km/L`} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="consumo" name="Consumo médio (km/L)" stroke="var(--accent-cyan)" activeDot={{ r: 6 }} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="custoKm" name="Custo/KM (R$)" stroke="var(--accent-green)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "disponibilidade") {
      const chartData = data
        .map((l: any) => ({ placa: l.veiculo?.placa || "", disponibilidade: l.disponibilidade }))
        .sort((x: any, y: any) => x.disponibilidade - y.disponibilidade)
        .slice(0, 10);
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="placa" type="category" stroke="var(--text-muted)" fontSize={11} width={80} />
              <Tooltip formatter={(value: any) => `${value}%`} contentStyle={tooltipStyle} />
              <Bar dataKey="disponibilidade" radius={[0, 4, 4, 0]} name="Disponibilidade (%)">
                {chartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.disponibilidade >= 90 ? "var(--accent-green)" : entry.disponibilidade >= 75 ? "var(--accent-amber)" : "var(--accent-red)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "status-frota") {
      // Distribuição do farol por setor: mostra ONDE a frota está parada, que é
      // a pergunta seguinte depois de "quantos estão parados".
      const porSetor = new Map<string, any>();
      for (const l of data) {
        const s = l.setor || "Sem setor";
        if (!porSetor.has(s)) porSetor.set(s, { setor: s, operando: 0, operandoComAvaria: 0, parado: 0 });
        const alvo = porSetor.get(s);
        if (l.farol === "operando") alvo.operando++;
        else if (l.farol === "operando_com_avaria") alvo.operandoComAvaria++;
        else if (l.farol === "parado") alvo.parado++;
      }
      const chartData = [...porSetor.values()]
        .sort((a, b) => (b.parado + b.operandoComAvaria) - (a.parado + a.operandoComAvaria))
        .slice(0, 10);
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis dataKey="setor" stroke="var(--text-muted)" fontSize={11} interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, n: string) => [v, ({ operando: "Operando", operandoComAvaria: "Com avaria", parado: "Parado" } as any)[n] || n]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(n) => ({ operando: "Operando", operandoComAvaria: "Com avaria", parado: "Parado" } as any)[n] || n}
              />
              <Bar dataKey="operando" stackId="f" fill="var(--accent-green)" />
              <Bar dataKey="operandoComAvaria" stackId="f" fill="var(--accent-amber)" />
              <Bar dataKey="parado" stackId="f" fill="var(--accent-red)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "veiculos") {
      // Top 10 por KM. Antes era slice(0,10) sobre a ordem alfabética de placa —
      // parecia ranking e não era.
      const chartData = [...data]
        .sort((a: any, b: any) => (b.kmAtual || 0) - (a.kmAtual || 0))
        .slice(0, 10)
        .map((l: any) => ({ placa: l.placa, KM: l.kmAtual || 0 }));
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={fmtEixo} width={64} />
              <Tooltip formatter={(v: any) => `${fmtNum(v)} km`} contentStyle={tooltipStyle} />
              <Bar dataKey="KM" fill="var(--accent-violet, #8b5cf6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "manutencoes") {
      // Antes este relatório não tinha gráfico: o painel ficava em branco.
      const porVeiculo = new Map<string, { pecas: number; servicos: number }>();
      for (const l of data) {
        const p = l.veiculo?.placa || "-";
        if (!porVeiculo.has(p)) porVeiculo.set(p, { pecas: 0, servicos: 0 });
        const b = porVeiculo.get(p)!;
        b.pecas += Number(l.custoPecas || 0);
        b.servicos += Number(l.custoServicos || 0);
      }
      const chartData = [...porVeiculo.entries()]
        .map(([placa, b]) => ({ placa, Peças: b.pecas, Serviços: b.servicos }))
        .sort((a, b) => (b["Peças"] + b["Serviços"]) - (a["Peças"] + a["Serviços"]))
        .slice(0, 8);
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `R$ ${fmtEixo(v)}`} width={72} />
              <Tooltip formatter={(v: any) => fmtMoney(v)} contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Peças" stackId="a" fill="var(--accent-amber)" />
              <Bar dataKey="Serviços" stackId="a" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "revisoes") {
      const porVeiculo = new Map<string, number>();
      for (const l of data) {
        const p = l.veiculo?.placa || "-";
        porVeiculo.set(p, (porVeiculo.get(p) || 0) + Number(l.custo || 0));
      }
      const chartData = [...porVeiculo.entries()]
        .map(([placa, custo]) => ({ placa, Custo: custo }))
        .sort((a, b) => b.Custo - a.Custo)
        .slice(0, 10);
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `R$ ${fmtEixo(v)}`} width={72} />
              <Tooltip formatter={(v: any) => fmtMoney(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="Custo" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "historico-pneus") {
      const porTipo = new Map<string, number>();
      for (const l of data) porTipo.set(l.tipo || "-", (porTipo.get(l.tipo || "-") || 0) + 1);
      const chartData = [...porTipo.entries()]
        .map(([tipo, qtd]) => ({ tipo, Eventos: qtd }))
        .sort((a, b) => b.Eventos - a.Eventos);
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="mt-4">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="tipo" stroke="var(--text-muted)" fontSize={11} className="capitalize" />
              <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Eventos" fill="var(--accent-violet, #8b5cf6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Pizza para classificações (CNH / pneus / motoristas)
    let pieData: { name: string; value: number }[] = [];
    if (activeReport === "cnhs") {
      pieData = [
        { name: "Vigentes", value: reportData.totais.vigentes || 0 },
        { name: "Vencendo (30d)", value: reportData.totais.vencendo30 || 0 },
        { name: "Vencidas", value: reportData.totais.vencidas || 0 },
        { name: "Sem CNH", value: reportData.totais.semCnh || 0 }
      ].filter(x => x.value > 0);
    } else if (activeReport === "pneus") {
      pieData = [
        { name: "Em Uso", value: reportData.totais.emUso || 0 },
        { name: "Em Estoque", value: reportData.totais.estoque || 0 }
      ].filter(x => x.value > 0);
    } else if (activeReport === "motoristas") {
      pieData = [
        { name: "Ativos", value: reportData.totais.ativos || 0 },
        { name: "Inativos", value: (reportData.totais.total - reportData.totais.ativos) || 0 }
      ].filter(x => x.value > 0);
    }

    const COLORS = ["var(--accent-green)", "var(--accent-amber)", "var(--accent-red)", "var(--accent-cyan)"];

    if (pieData.length > 0) {
      return (
        <div style={{ height: CHART_H, width: "100%", minWidth: 0 }} className="flex justify-center items-center w-full">
          <ResponsiveContainer width="100%" height={CHART_H}>
            <PieChart>
              <Pie
                data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={82}
                paddingAngle={4} dataKey="value" nameKey="name"
                label={({ name, value }: any) => `${name}: ${value}`}
                labelLine={false} fontSize={11}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div style={{ height: CHART_H }} className="mt-4 flex items-center justify-center text-xs text-[var(--text-muted)]">
        Sem gráfico definido para este relatório.
      </div>
    );
  };

  const inputCls = "w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]";
  const labelCls = "text-[10px] font-mono text-[var(--text-muted)] block mb-1";
  const btnExport = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-y-auto flex flex-col p-4 gap-1">
          <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider mb-2 uppercase px-3">
            Tipos de Relatório
          </div>
          {REPORTS_CONFIG.map(r => {
            const Icon = r.icon;
            const active = activeReport === r.id;
            return (
              <button
                key={r.id}
                onClick={() => {
                  setActiveReport(r.id);
                  setStatus("");
                  setStatusCnh("");
                  setTipoPneuEvento("");
                  setTipoManut("");
                }}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all group border ${
                  active
                    ? "bg-[var(--accent-violet-dim)] text-[var(--accent-violet)] border-[var(--accent-violet)]/10"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <Icon size={18} className={`mt-0.5 ${active ? "text-[var(--accent-violet)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`} />
                <div>
                  <div className="text-[13px] font-semibold tracking-wide">{r.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)] line-clamp-2 mt-0.5 leading-tight">{r.description}</div>
                </div>
              </button>
            );
          })}

          <div className="border-t border-[var(--border-subtle)] my-4 pt-4 px-3 flex flex-col gap-2">
            <button
              onClick={openSchedulesModal}
              className="flex items-center justify-center gap-2 w-full py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-xs font-semibold text-[var(--accent-violet)] transition-colors"
            >
              <Clock size={14} />
              Gerenciar Agendamentos
            </button>
          </div>
        </aside>

        {/* Work Area */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Header */}
          <div className="card-premium" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "16px 20px" }}>
            <div>
              <h1 className="text-xl font-bold tracking-wide text-[var(--text-primary)]">{config.title}</h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">{config.description}</p>
            </div>

            {/* Export and Action buttons */}
            <div className="flex items-center gap-2">
              <button onClick={exportPDF} disabled={!linhas.length} className={btnExport}>
                <Download size={14} className="text-red-500" />
                PDF
              </button>
              <button onClick={exportExcel} disabled={!linhas.length} className={btnExport}>
                <Download size={14} className="text-emerald-500" />
                Excel
              </button>
              <button onClick={exportCSV} disabled={!linhas.length} className={btnExport}>
                <Download size={14} className="text-cyan-500" />
                CSV
              </button>
              <span className="w-px h-6 bg-[var(--border-subtle)] mx-1" />
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-violet)] hover:opacity-90 text-white text-xs font-semibold transition-all"
              >
                <Mail size={14} />
                Enviar Email
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="card-premium" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", padding: "16px 20px" }}>
            {config.filters.includes("date") && (
              <>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="f-de" className={labelCls}>DATA DE</label>
                  <input id="f-de" type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="f-ate" className={labelCls}>DATA ATÉ</label>
                  <input id="f-ate" type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
                </div>
              </>
            )}

            {config.filters.includes("veiculo") && (
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="f-veic" className={labelCls}>VEÍCULO</label>
                <select id="f-veic" value={veiculoId} onChange={e => setVeiculoId(e.target.value)} className={inputCls}>
                  <option value="">Todos os Veículos</option>
                  {veiculos.map(v => (
                    <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` - ${v.modelo}` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {config.filters.includes("motorista") && (
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="f-mot" className={labelCls}>MOTORISTA</label>
                <select id="f-mot" value={motoristaId} onChange={e => setMotoristaId(e.target.value)} className={inputCls}>
                  <option value="">Todos os Motoristas</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            )}

            {config.filters.includes("status") && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="f-status" className={labelCls}>STATUS</label>
                <select id="f-status" value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  {activeReport === "veiculos" && (
                    <>
                      <option value="ativo">Ativo</option>
                      <option value="manutencao">Em Manutenção</option>
                      <option value="inativo">Inativo</option>
                      <option value="vendido">Vendido</option>
                    </>
                  )}
                  {activeReport === "motoristas" && (
                    <>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </>
                  )}
                  {activeReport === "pneus" && (
                    <>
                      <option value="em_uso">Em Uso</option>
                      <option value="estoque">Estoque</option>
                      <option value="recapagem">Recapagem</option>
                      <option value="descartado">Descartado</option>
                    </>
                  )}
                  {activeReport === "revisoes" && (
                    <>
                      <option value="agendada">Agendada</option>
                      <option value="realizada">Realizada</option>
                      <option value="atrasada">Atrasada</option>
                    </>
                  )}
                  {activeReport === "manutencoes" && (
                    <>
                      <option value="agendada">Agendada</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {config.filters.includes("statusCnh") && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="f-cnh" className={labelCls}>STATUS CNH</label>
                <select id="f-cnh" value={statusCnh} onChange={e => setStatusCnh(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="vigente">Vigente</option>
                  <option value="vencendo_30">Vence em 30 dias</option>
                  <option value="vencida">Vencida</option>
                  <option value="sem_cnh">Não cadastrada</option>
                </select>
              </div>
            )}

            {config.filters.includes("tipoPneuEvento") && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="f-evt" className={labelCls}>TIPO DE EVENTO</label>
                <select id="f-evt" value={tipoPneuEvento} onChange={e => setTipoPneuEvento(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="instalacao">Instalação</option>
                  <option value="rodizio">Rodízio</option>
                  <option value="recapagem">Recapagem</option>
                  <option value="manutencao">Manutenção/Reparo</option>
                  <option value="descarte">Descarte</option>
                </select>
              </div>
            )}

            {config.filters.includes("tipoManut") && (
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="f-tos" className={labelCls}>TIPO DE OS</label>
                <select id="f-tos" value={tipoManut} onChange={e => setTipoManut(e.target.value)} className={inputCls}>
                  <option value="">Todos</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                </select>
              </div>
            )}

            <button
              onClick={atualizar}
              disabled={loading}
              className={`px-4 py-2 border text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 h-[34px] ${
                filtrosAlterados
                  ? "bg-[var(--accent-violet)] border-[var(--accent-violet)] text-white hover:opacity-90"
                  : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]"
              }`}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              {filtrosAlterados ? "Aplicar filtros" : "Atualizar"}
            </button>
          </div>

          {/* Aviso de truncamento */}
          {!loading && reportData?.truncado && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-500">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                Exibindo as primeiras <strong>{fmtNum(linhas.length)}</strong> de{" "}
                <strong>{fmtNum(reportData.totalLinhas)}</strong> linhas. Os totais e o gráfico
                consideram apenas o que foi carregado — refine o período ou os filtros para um
                resultado completo.
              </span>
            </div>
          )}

          {erro && !loading && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {loading && (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <RefreshCw size={32} className="animate-spin text-[var(--accent-violet)]" />
              <div className="text-sm font-mono uppercase tracking-widest">Processando Relatório...</div>
            </div>
          )}

          {!loading && reportData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Totals / KPI cards */}
                <div className="flex flex-col gap-4">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
                    Métricas Consolidadas
                  </div>

                  {activeReport === "veiculos" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE VEÍCULOS</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{fmtNum(reportData.totais.total)}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">KILOMETRAGEM TOTAL</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--text-primary)]">{fmtNum(reportData.totais.kmTotal)} km</div>
                      </div>
                    </>
                  )}

                  {activeReport === "motoristas" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE CONDUTORES</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{fmtNum(reportData.totais.total)}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">MOTORISTAS ATIVOS</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">{fmtNum(reportData.totais.ativos)}</div>
                      </div>
                    </>
                  )}

                  {activeReport === "cnhs" && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">VIGENTES</div>
                          <div className="text-2xl font-extrabold mt-1 text-emerald-400">{fmtNum(reportData.totais.vigentes)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">VENCENDO (30D)</div>
                          <div className="text-2xl font-extrabold mt-1 text-amber-400">{fmtNum(reportData.totais.vencendo30)}</div>
                        </div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">CNHs VENCIDAS</div>
                        <div className="text-3xl font-extrabold mt-1 text-red-500">{fmtNum(reportData.totais.vencidas)}</div>
                      </div>
                      {statusCnh && (
                        <div className="text-[11px] text-[var(--text-muted)] italic px-1">
                          Filtro ativo — os números acima refletem o subconjunto exibido
                          ({fmtNum(reportData.totais.universo)} condutores no total).
                        </div>
                      )}
                    </>
                  )}

                  {activeReport === "pneus" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE PNEUS</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{fmtNum(reportData.totais.total)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">EM USO</div>
                          <div className="text-2xl font-extrabold mt-1 text-emerald-400">{fmtNum(reportData.totais.emUso)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">ESTOQUE</div>
                          <div className="text-2xl font-extrabold mt-1 text-cyan-400">{fmtNum(reportData.totais.estoque)}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeReport === "historico-pneus" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">EVENTOS REGISTRADOS</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{fmtNum(reportData.totais.total)}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">CUSTO TOTAL COM PNEUS</div>
                        <div className="text-3xl font-extrabold mt-1 text-amber-500">{fmtMoney(reportData.totais.custoTotal)}</div>
                      </div>
                    </>
                  )}

                  {activeReport === "revisoes" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">CUSTO DE REVISÕES</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">{fmtMoney(reportData.totais.custoTotal)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">REALIZADAS</div>
                          <div className="text-2xl font-extrabold mt-1 text-[var(--accent-violet)]">{fmtNum(reportData.totais.realizadas)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">AGENDADAS</div>
                          <div className="text-2xl font-extrabold mt-1 text-amber-400">{fmtNum(reportData.totais.agendadas)}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeReport === "manutencoes" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">CUSTO TOTAL MANUTENÇÃO</div>
                        <div className="text-3xl font-extrabold mt-1 text-amber-500">{fmtMoney(reportData.totais.custoTotal)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">PEÇAS</div>
                          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">{fmtMoney(reportData.totais.pecas)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">SERVIÇOS</div>
                          <div className="text-xl font-bold mt-1 text-[var(--text-primary)]">{fmtMoney(reportData.totais.servicos)}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeReport === "custos" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">CUSTO TOTAL CONSOLIDADO</div>
                        <div className="text-3xl font-extrabold mt-1 text-[#22c55e]">{fmtMoney(reportData.totais.custoTotal)}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">TOTAL EM MANUTENÇÃO</div>
                        <div className="text-2xl font-bold mt-1 text-amber-500">{fmtMoney(reportData.totais.custoManutencao)}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">TOTAL EM ABASTECIMENTO</div>
                        <div className="text-2xl font-bold mt-1 text-emerald-400">{fmtMoney(reportData.totais.custoAbastecimento)}</div>
                      </div>
                    </>
                  )}

                  {activeReport === "abastecimentos" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">VALOR TOTAL ABASTECIDO</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">{fmtMoney(reportData.totais.custoTotal)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">CONSUMO MÉDIO</div>
                          <div className="text-2xl font-extrabold mt-1 text-cyan-400">{fmtNum(reportData.totais.consumoMedio, 2)} km/L</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">CUSTO POR KM</div>
                          <div className="text-2xl font-extrabold mt-1 text-[var(--text-primary)]">{fmtMoney(reportData.totais.custoKmMedio)}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeReport === "disponibilidade" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">DISPONIBILIDADE MÉDIA</div>
                        <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.dispMedia}%</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">ATIVOS</div>
                          <div className="text-xl font-bold mt-1 text-emerald-400">{fmtNum(reportData.totais.ativos)} veíc.</div>
                        </div>
                        <div className="card-premium" style={{ padding: 16 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">INDISPONÍVEIS (OS)</div>
                          <div className="text-xl font-bold mt-1 text-amber-500">{fmtNum(reportData.totais.indisponiveis)} veíc.</div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeReport === "status-frota" && (
                    <>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">FROTA RODANDO</div>
                        <div className="text-3xl font-extrabold mt-1 text-emerald-400">
                          {fmtNum(reportData.totais.percRodando, 1)}%
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1">
                          sobre {fmtNum(reportData.totais.totalFrota)} veículos em operação
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="card-premium" style={{ padding: 14 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">OPERANDO</div>
                          <div className="text-xl font-bold mt-1 text-emerald-400">{fmtNum(reportData.totais.operando)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 14 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">C/ AVARIA</div>
                          <div className="text-xl font-bold mt-1 text-amber-400">{fmtNum(reportData.totais.operandoComAvaria)}</div>
                        </div>
                        <div className="card-premium" style={{ padding: 14 }}>
                          <div className="text-[10px] font-mono text-[var(--text-muted)]">PARADOS</div>
                          <div className="text-xl font-bold mt-1 text-red-400">{fmtNum(reportData.totais.parado)}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Chart graphic */}
                <div className="lg:col-span-2 card-premium flex flex-col" style={{ padding: 16 }}>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-2">
                    Visualização Analítica
                  </div>
                  {renderChart()}
                </div>
              </div>

              {/* Table Data */}
              <div className="card-premium overflow-hidden">
                <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase border-b border-[var(--border-subtle)] p-4 flex justify-between items-center">
                  <span>Detalhamento dos Dados</span>
                  <span className="normal-case">{fmtNum(linhas.length)} registro(s)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px] text-[var(--text-secondary)]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                        {colunas.map((c, i) => (
                          <th
                            key={c.header}
                            onClick={() => ordenarPor(i)}
                            className={`p-4 cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors ${c.align === "right" ? "text-right" : "text-left"}`}
                            title="Clique para ordenar"
                          >
                            <span className={`inline-flex items-center gap-1 ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                              {c.header}
                              {ordenacao?.col === i && (ordenacao.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasOrdenadas.length === 0 ? (
                        <tr>
                          <td colSpan={colunas.length} className="p-8 text-center text-[var(--text-muted)]">
                            Nenhum registro encontrado no filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        linhasOrdenadas.map((l: any, idx: number) => (
                          <tr
                            key={l.id || idx}
                            className={`${idx % 2 === 0 ? "bg-[var(--bg-secondary)]" : "bg-[var(--bg-primary)]/30"} hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)]`}
                          >
                            {colunas.map(c => (
                              <td key={c.header} className={`p-4 ${c.align === "right" ? "text-right font-mono" : ""}`}>
                                {c.cell ? c.cell(l) : (typeof c.get(l) === "number" ? fmtNum(c.get(l)) : (c.get(l) || "-"))}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {linhasOrdenadas.length > 0 && totaisRodape.some(t => t !== null) && (
                      <tfoot>
                        <tr className="border-t-2 border-[var(--border-medium)] bg-[var(--bg-primary)] font-bold text-[var(--text-primary)]">
                          {colunas.map((c, i) => (
                            <td key={c.header} className={`p-4 ${c.align === "right" ? "text-right font-mono" : ""}`}>
                              {i === 0 ? "TOTAL" : totaisRodape[i] ?? ""}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Share by Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-medium)] w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Mail size={18} className="text-[var(--accent-violet)]" />
                Enviar Relatório por E-mail
              </h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="email-dest" className="text-[10px] font-mono text-[var(--text-muted)] block uppercase">
                Destinatários (separados por vírgula)
              </label>
              <input
                id="email-dest"
                type="text"
                placeholder="exemplo@empresa.com, outro@empresa.com"
                value={emailRecipients}
                onChange={e => setEmailRecipients(e.target.value)}
                className="input-o text-xs"
              />
              <p className="text-[11px] text-[var(--text-muted)] italic">
                O relatório será formatado como uma tabela HTML no corpo do e-mail e incluirá um anexo em formato CSV.
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-4 border-t border-[var(--border-subtle)] pt-4">
              <button onClick={() => setIsEmailModalOpen(false)} className="btn btn-ghost py-1.5 px-4 text-xs">
                Cancelar
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="btn btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5"
              >
                {sendingEmail ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                Enviar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduler Management Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="bg-[var(--bg-card)] border border-[var(--border-medium)] w-full max-w-3xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Clock size={18} className="text-[var(--accent-violet)]" />
                Agendamento de Relatórios Automáticos
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  Agendamentos Ativos
                </h4>
                {!isCreatingSchedule && (
                  <button onClick={() => setIsCreatingSchedule(true)} className="btn btn-ghost py-1 px-3 text-xs flex items-center gap-1">
                    <Plus size={12} /> Novo Agendamento
                  </button>
                )}
              </div>

              {isCreatingSchedule && (
                <form onSubmit={handleCreateSchedule} className="bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col gap-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ag-titulo" className={labelCls}>TÍTULO / IDENTIFICAÇÃO</label>
                      <input
                        id="ag-titulo" type="text" placeholder="Ex: Custo de Frota Semanal" required
                        value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="ag-freq" className={labelCls}>FREQUÊNCIA</label>
                      <select id="ag-freq" value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value)} className="input-o text-xs bg-[var(--bg-secondary)]">
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal (segunda-feira)</option>
                        <option value="mensal">Mensal (dia 1º)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ag-fmt" className={labelCls}>FORMATO DO ANEXO</label>
                      <select id="ag-fmt" value={scheduleFormat} onChange={e => setScheduleFormat(e.target.value)} className="input-o text-xs bg-[var(--bg-secondary)]">
                        <option value="csv">CSV (Excel)</option>
                        <option value="excel">Planilha Excel (.xlsx)</option>
                        <option value="pdf">Documento PDF</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ag-dest" className={labelCls}>DESTINATÁRIOS (SEPARADOS POR VÍRGULA)</label>
                      <input
                        id="ag-dest" type="text" placeholder="financeiro@empresa.com, diretoria@empresa.com" required
                        value={scheduleDest} onChange={e => setScheduleDest(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--text-muted)] italic bg-[var(--bg-secondary)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    * Este agendamento aplicará os filtros atuais selecionados na tela (Veículos, datas ou categorias) ao gerar os dados automaticamente.
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsCreatingSchedule(false)} className="btn btn-ghost py-1.5 px-3">
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3">
                      Confirmar Criação
                    </button>
                  </div>
                </form>
              )}

              <div className="card-premium overflow-hidden">
                {loadingSchedules ? (
                  <div className="p-8 text-center text-[var(--text-muted)] flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-[var(--accent-violet)]" />
                    Buscando agendamentos...
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    Nenhum agendamento automatizado cadastrado para este relatório.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase font-mono text-[10px]">
                        <th className="p-3">Título</th>
                        <th className="p-3">Relatório</th>
                        <th className="p-3">Frequência</th>
                        <th className="p-3">Formato</th>
                        <th className="p-3">Destinatários</th>
                        <th className="p-3">Último Envio</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((s: any) => (
                        <tr key={s.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                          <td className="p-3 font-semibold text-[var(--text-primary)]">{s.titulo}</td>
                          <td className="p-3 font-mono text-[var(--text-muted)] uppercase">{s.tipoRelatorio}</td>
                          <td className="p-3 capitalize">{s.frequencia}</td>
                          <td className="p-3 uppercase font-mono text-[var(--text-muted)]">{s.formato}</td>
                          <td className="p-3 truncate max-w-[160px]" title={s.destinatarios}>{s.destinatarios}</td>
                          <td className="p-3 font-mono text-[var(--text-muted)]">
                            {s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleString("pt-BR") : "Nunca"}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSchedule(s.id, s.ativo)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.ativo ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)]"
                              }`}
                            >
                              {s.ativo ? "ATIVO" : "PAUSADO"}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteSchedule(s.id)}
                              className="p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 border-t border-[var(--border-subtle)] pt-4">
              <button onClick={() => setIsScheduleModalOpen(false)} className="btn btn-ghost py-2 px-4">
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
