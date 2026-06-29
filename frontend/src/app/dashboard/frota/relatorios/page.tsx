"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
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
  Calendar,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  FileText,
  Clock,
  Play
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
  | "disponibilidade";

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
  }
];

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  // Fetch Lookups
  useEffect(() => {
    setMounted(true);
    api.get("/frota/veiculos", { params: { limit: 200 } }).then(r => setVeiculos(r.data?.items || [])).catch(() => {});
    api.get("/frota/motoristas", { params: { limit: 200 } }).then(r => setMotoristas(r.data?.items || [])).catch(() => {});
  }, []);

  const config = REPORTS_CONFIG.find(r => r.id === activeReport)!;

  // Build params
  const getParams = useCallback(() => {
    const params: any = {};
    if (config.filters.includes("date")) {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    if (config.filters.includes("veiculo") && veiculoId) {
      params.veiculoId = veiculoId;
    }
    if (config.filters.includes("motorista") && motoristaId) {
      params.motoristaId = motoristaId;
    }
    if (config.filters.includes("status") && status) {
      params.status = status;
    }
    if (config.filters.includes("statusCnh") && statusCnh) {
      params.statusCnh = statusCnh;
    }
    if (config.filters.includes("tipoPneuEvento") && tipoPneuEvento) {
      params.tipo = tipoPneuEvento;
    }
    if (config.filters.includes("tipoManut") && tipoManut) {
      params.tipo = tipoManut;
    }
    return params;
  }, [config, from, to, veiculoId, motoristaId, status, statusCnh, tipoPneuEvento, tipoManut]);

  // Load report data
  const loadReport = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    try {
      const params = getParams();
      const endpoint = config.endpoint;
      const { data } = await api.get(endpoint, { params });
      setReportData(data);
    } catch (err: any) {
      toast.error("Erro ao carregar dados do relatório");
    } finally {
      setLoading(false);
    }
  }, [config, getParams]);

  useEffect(() => {
    loadReport();
  }, [activeReport, loadReport]);

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
      const filtros = getParams();
      await api.post("/frota/report-schedules", {
        titulo: scheduleTitle,
        tipoRelatorio: activeReport,
        formato: scheduleFormat,
        frequencia: scheduleFreq,
        filtros,
        destinatarios: scheduleDest
      });
      toast.success("Agendamento criado com sucesso!");
      setScheduleTitle("");
      setScheduleDest("");
      setIsCreatingSchedule(false);
      loadSchedules();
    } catch {
      toast.error("Erro ao criar agendamento");
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
      const filtros = getParams();
      await api.post("/frota/relatorios/enviar-email", {
        tipoRelatorio: activeReport,
        filtros,
        destinatarios: emailRecipients,
        formato: "csv"
      });
      toast.success("Relatório enviado por e-mail com sucesso!");
      setIsEmailModalOpen(false);
      setEmailRecipients("");
    } catch {
      toast.error("Erro ao enviar e-mail");
    } finally {
      setSendingEmail(false);
    }
  };

  // Client Side Exporters
  const getExportData = () => {
    if (!reportData || !reportData.linhas) return [];
    return reportData.linhas;
  };

  const exportCSV = () => {
    const lines = getExportData();
    if (!lines.length) return toast.info("Nenhum dado para exportar");

    const title = config.title;
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeReport === "veiculos") {
      headers = ["Placa", "Código", "Marca", "Modelo", "Tipo", "Combustível", "Status", "KM Atual"];
      rows = lines.map((l: any) => [l.placa, l.codigo, l.marca || "", l.modelo || "", l.tipo, l.combustivel, l.status, l.kmAtual]);
    } else if (activeReport === "motoristas") {
      headers = ["Nome", "CPF", "Matrícula", "Departamento", "Cargo", "Status"];
      rows = lines.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.departamento || "", l.cargo || "", l.status]);
    } else if (activeReport === "cnhs") {
      headers = ["Nome", "CPF", "Matrícula", "CNH", "Categoria", "Validade", "Status CNH"];
      rows = lines.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.cnh || "", l.categoriaCnh || "", l.validadeCnh ? new Date(l.validadeCnh).toLocaleDateString("pt-BR") : "", l.statusCnh]);
    } else if (activeReport === "pneus") {
      headers = ["Nº Fogo", "Código", "Marca", "Modelo", "Medida", "Posição", "Veículo", "Status"];
      rows = lines.map((l: any) => [l.numeroFogo || "", l.codigo || "", l.marca || "", l.modelo || "", l.medida || "", l.posicao || "", l.veiculo?.placa || "", l.status]);
    } else if (activeReport === "historico-pneus") {
      headers = ["Nº Fogo", "Pneu", "Veículo", "Tipo Evento", "Data", "KM", "Custo", "Obs"];
      rows = lines.map((l: any) => [l.pneu?.numeroFogo || "", l.pneu?.codigo || "", l.veiculo?.placa || "", l.tipo, new Date(l.data).toLocaleDateString("pt-BR"), l.km || 0, l.custo || 0, l.observacao || ""]);
    } else if (activeReport === "revisoes") {
      headers = ["Veículo", "Tipo", "Descrição", "Data Prev.", "KM Prev.", "Data Realiz.", "KM Realiz.", "Status", "Custo"];
      rows = lines.map((l: any) => [l.veiculo?.placa || "", l.tipo || "", l.descricao || "", l.dataPrevista ? new Date(l.dataPrevista).toLocaleDateString("pt-BR") : "", l.kmPrevisto || 0, l.dataRealizada ? new Date(l.dataRealizada).toLocaleDateString("pt-BR") : "", l.kmRealizado || 0, l.status, l.custo || 0]);
    } else if (activeReport === "manutencoes") {
      headers = ["OS", "Veículo", "Tipo OS", "Descrição", "Data", "KM", "Status", "Custo Total", "Custo Peças", "Custo Serviços"];
      rows = lines.map((l: any) => [l.numeroOs || "", l.veiculo?.placa || "", l.tipo, l.descricao || "", l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "", l.km || 0, l.status, l.custo || 0, l.custoPecas || 0, l.custoServicos || 0]);
    } else if (activeReport === "custos") {
      headers = ["Veículo", "Qtd OS", "Qtd Abast.", "Litros", "Custo OS", "Custo Abast.", "Custo Total"];
      rows = lines.map((l: any) => [l.veiculo?.placa || "", l.totalManutencoes, l.totalAbastecimentos, l.litros, l.custoManutencao, l.custoAbastecimento, l.custoTotal]);
    } else if (activeReport === "abastecimentos") {
      headers = ["Veículo", "Motorista", "Data", "Posto", "Combustível", "Litros", "KM Atual", "Custo Total", "Consumo (km/L)", "Custo/KM"];
      rows = lines.map((l: any) => [l.veiculo?.placa || "", l.motorista?.nome || "", new Date(l.data).toLocaleDateString("pt-BR"), l.posto || "", l.tipoCombustivel || "", l.litros || 0, l.kmAtual || 0, l.valorTotal || 0, l.consumoKmL || 0, l.custoKm || 0]);
    } else if (activeReport === "disponibilidade") {
      headers = ["Veículo", "Dias Totais", "Dias Parado", "Dias Ativo", "Disponibilidade (%)", "Status Atual"];
      rows = lines.map((l: any) => [l.veiculo?.placa || "", l.diasTotais, l.diasParado, l.diasAtivo, `${l.disponibilidade}%`, l.statusAtual]);
    }

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.map(v => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportExcel = async () => {
    const lines = getExportData();
    if (!lines.length) return toast.info("Nenhum dado para exportar");

    try {
      const XLSX: any = await import("xlsx");
      const wb = XLSX.utils.book_new();

      let headers: string[] = [];
      let rows: any[][] = [];

      if (activeReport === "veiculos") {
        headers = ["Placa", "Código", "Marca", "Modelo", "Tipo", "Combustível", "Status", "KM Atual"];
        rows = lines.map((l: any) => [l.placa, l.codigo, l.marca || "", l.modelo || "", l.tipo, l.combustivel, l.status, l.kmAtual]);
      } else if (activeReport === "motoristas") {
        headers = ["Nome", "CPF", "Matrícula", "Departamento", "Cargo", "Status"];
        rows = lines.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.departamento || "", l.cargo || "", l.status]);
      } else if (activeReport === "cnhs") {
        headers = ["Nome", "CPF", "Matrícula", "CNH", "Categoria", "Validade", "Status CNH"];
        rows = lines.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.cnh || "", l.categoriaCnh || "", l.validadeCnh ? new Date(l.validadeCnh).toLocaleDateString("pt-BR") : "", l.statusCnh]);
      } else if (activeReport === "pneus") {
        headers = ["Nº Fogo", "Código", "Marca", "Modelo", "Medida", "Posição", "Veículo", "Status"];
        rows = lines.map((l: any) => [l.numeroFogo || "", l.codigo || "", l.marca || "", l.modelo || "", l.medida || "", l.posicao || "", l.veiculo?.placa || "", l.status]);
      } else if (activeReport === "historico-pneus") {
        headers = ["Nº Fogo", "Pneu", "Veículo", "Tipo Evento", "Data", "KM", "Custo", "Obs"];
        rows = lines.map((l: any) => [l.pneu?.numeroFogo || "", l.pneu?.codigo || "", l.veiculo?.placa || "", l.tipo, new Date(l.data).toLocaleDateString("pt-BR"), l.km || 0, l.custo || 0, l.observacao || ""]);
      } else if (activeReport === "revisoes") {
        headers = ["Veículo", "Tipo", "Descrição", "Data Prev.", "KM Prev.", "Data Realiz.", "KM Realiz.", "Status", "Custo"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.tipo || "", l.descricao || "", l.dataPrevista ? new Date(l.dataPrevista).toLocaleDateString("pt-BR") : "", l.kmPrevisto || 0, l.dataRealizada ? new Date(l.dataRealizada).toLocaleDateString("pt-BR") : "", l.kmRealizado || 0, l.status, l.custo || 0]);
      } else if (activeReport === "manutencoes") {
        headers = ["OS", "Veículo", "Tipo OS", "Descrição", "Data", "KM", "Status", "Custo Total", "Custo Peças", "Custo Serviços"];
        rows = lines.map((l: any) => [l.numeroOs || "", l.veiculo?.placa || "", l.tipo, l.descricao || "", l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "", l.km || 0, l.status, l.custo || 0, l.custoPecas || 0, l.custoServicos || 0]);
      } else if (activeReport === "custos") {
        headers = ["Veículo", "Qtd OS", "Qtd Abast.", "Litros", "Custo OS", "Custo Abast.", "Custo Total"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.totalManutencoes, l.totalAbastecimentos, l.litros, l.custoManutencao, l.custoAbastecimento, l.custoTotal]);
      } else if (activeReport === "abastecimentos") {
        headers = ["Veículo", "Motorista", "Data", "Posto", "Combustível", "Litros", "KM Atual", "Custo Total", "Consumo (km/L)", "Custo/KM"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.motorista?.nome || "", new Date(l.data).toLocaleDateString("pt-BR"), l.posto || "", l.tipoCombustivel || "", l.litros || 0, l.kmAtual || 0, l.valorTotal || 0, l.consumoKmL || 0, l.custoKm || 0]);
      } else if (activeReport === "disponibilidade") {
        headers = ["Veículo", "Dias Totais", "Dias Parado", "Dias Ativo", "Disponibilidade (%)", "Status Atual"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.diasTotais, l.diasParado, l.diasAtivo, l.disponibilidade, l.statusAtual]);
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wscols = headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));
      ws["!cols"] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "Relatório");
      XLSX.writeFile(wb, `relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Erro ao gerar planilha Excel");
    }
  };

  const exportPDF = async () => {
    const lines = getExportData();
    if (!lines.length) return toast.info("Nenhum dado para exportar");

    try {
      const { jsPDF }: any = await import("jspdf");
      await import("jspdf-autotable");
      const doc: any = new jsPDF({ orientation: "landscape" });

      let headers: string[] = [];
      let rows: any[][] = [];

      if (activeReport === "veiculos") {
        headers = ["Placa", "Código", "Marca", "Modelo", "Tipo", "Combustível", "Status", "KM Atual"];
        rows = lines.map((l: any) => [l.placa, l.codigo, l.marca || "", l.modelo || "", l.tipo, l.combustivel, l.status, l.kmAtual]);
      } else if (activeReport === "motoristas") {
        headers = ["Nome", "CPF", "Matrícula", "Departamento", "Cargo", "Status"];
        rows = lines.map((l: any) => [l.nome, l.cpf || "", l.matricula || "", l.departamento || "", l.cargo || "", l.status]);
      } else if (activeReport === "cnhs") {
        headers = ["Nome", "CPF", "CNH", "Cat.", "Validade", "Status CNH"];
        rows = lines.map((l: any) => [l.nome, l.cpf || "", l.cnh || "", l.categoriaCnh || "", l.validadeCnh ? new Date(l.validadeCnh).toLocaleDateString("pt-BR") : "", l.statusCnh]);
      } else if (activeReport === "pneus") {
        headers = ["Nº Fogo", "Código", "Marca", "Modelo", "Medida", "Posição", "Veículo", "Status"];
        rows = lines.map((l: any) => [l.numeroFogo || "", l.codigo || "", l.marca || "", l.modelo || "", l.medida || "", l.posicao || "", l.veiculo?.placa || "", l.status]);
      } else if (activeReport === "historico-pneus") {
        headers = ["Nº Fogo", "Pneu", "Veículo", "Tipo Evento", "Data", "KM", "Custo", "Obs"];
        rows = lines.map((l: any) => [l.pneu?.numeroFogo || "", l.pneu?.codigo || "", l.veiculo?.placa || "", l.tipo, new Date(l.data).toLocaleDateString("pt-BR"), l.km || 0, l.custo || 0, l.observacao || ""]);
      } else if (activeReport === "revisoes") {
        headers = ["Veículo", "Tipo", "Descrição", "Data Prev.", "KM Prev.", "Data Realiz.", "KM Realiz.", "Status", "Custo"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.tipo || "", l.descricao || "", l.dataPrevista ? new Date(l.dataPrevista).toLocaleDateString("pt-BR") : "", l.kmPrevisto || 0, l.dataRealizada ? new Date(l.dataRealizada).toLocaleDateString("pt-BR") : "", l.kmRealizado || 0, l.status, l.custo || 0]);
      } else if (activeReport === "manutencoes") {
        headers = ["OS", "Veículo", "Tipo", "Descrição", "Data", "KM", "Status", "Custo Total"];
        rows = lines.map((l: any) => [l.numeroOs || "", l.veiculo?.placa || "", l.tipo, l.descricao || "", l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "", l.km || 0, l.status, l.custo || 0]);
      } else if (activeReport === "custos") {
        headers = ["Veículo", "Qtd OS", "Qtd Abast.", "Litros", "Custo OS", "Custo Abast.", "Custo Total"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.totalManutencoes, l.totalAbastecimentos, l.litros, l.custoManutencao, l.custoAbastecimento, l.custoTotal]);
      } else if (activeReport === "abastecimentos") {
        headers = ["Veículo", "Motorista", "Data", "Posto", "Combustível", "Litros", "KM", "Custo Total", "Consumo (km/L)", "Custo/KM"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.motorista?.nome || "", new Date(l.data).toLocaleDateString("pt-BR"), l.posto || "", l.tipoCombustivel || "", l.litros || 0, l.kmAtual || 0, l.valorTotal || 0, l.consumoKmL || 0, l.custoKm || 0]);
      } else if (activeReport === "disponibilidade") {
        headers = ["Veículo", "Dias Totais", "Dias Parado", "Dias Ativo", "Disponibilidade (%)", "Status Atual"];
        rows = lines.map((l: any) => [l.veiculo?.placa || "", l.diasTotais, l.diasParado, l.diasAtivo, `${l.disponibilidade}%`, l.statusAtual]);
      }

      // Add report header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(config.title, 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Orkestri Gestão de Frota`, 14, 24);

      doc.autoTable({
        startY: 28,
        head: [headers],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [30, 27, 75], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2.5 },
      });

      doc.save(`relatorio-${activeReport}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    }
  };

  // Render dynamic charts
  const renderChart = () => {
    if (!mounted) return <div style={{ height: 260 }} className="mt-4" />;
    if (!reportData || !reportData.linhas || !reportData.linhas.length) return null;

    const data = reportData.linhas;

    if (activeReport === "custos") {
      const chartData = data.slice(0, 8).map((l: any) => ({
        placa: l.veiculo?.placa || "",
        Manutenção: l.custoManutencao,
        Combustível: l.custoAbastecimento,
        Total: l.custoTotal
      }));
      return (
        <div style={{ height: 260, width: "100%", minWidth: 0, position: "relative" }} className="mt-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip formatter={(value: any) => fmtMoney(value)} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border-subtle)", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="Manutenção" stackId="a" fill="var(--accent-amber)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Combustível" stackId="a" fill="var(--accent-green)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "abastecimentos") {
      const chartData = [...data].reverse().slice(-12).map((l: any) => ({
        data: new Date(l.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        placa: l.veiculo?.placa || "",
        consumo: l.consumoKmL || 0,
        custoKm: l.custoKm || 0
      }));
      return (
        <div style={{ height: 260, width: "100%", minWidth: 0, position: "relative" }} className="mt-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="data" stroke="var(--text-muted)" fontSize={11} />
              <YAxis yAxisId="left" stroke="var(--accent-cyan)" fontSize={11} label={{ value: "Consumo (km/L)", angle: -90, position: "insideLeft", fill: "var(--accent-cyan)" }} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--accent-green)" fontSize={11} label={{ value: "Custo por KM (R$)", angle: 90, position: "insideRight", fill: "var(--accent-green)" }} />
              <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border-subtle)", borderRadius: 8 }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="consumo" name="Consumo (km/L)" stroke="var(--accent-cyan)" activeDot={{ r: 8 }} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="custoKm" name="Custo/KM (R$)" stroke="var(--accent-green)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "disponibilidade") {
      const chartData = data.map((l: any) => ({
        placa: l.veiculo?.placa || "",
        disponibilidade: l.disponibilidade
      })).sort((x: any, y: any) => x.disponibilidade - y.disponibilidade).slice(0, 10);
      return (
        <div style={{ height: 260, width: "100%", minWidth: 0, position: "relative" }} className="mt-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="placa" type="category" stroke="var(--text-muted)" fontSize={11} />
              <Tooltip formatter={(value: any) => `${value}%`} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border-subtle)", borderRadius: 8 }} />
              <Bar dataKey="disponibilidade" fill="var(--accent-cyan)" radius={[0, 4, 4, 0]} name="Disponibilidade (%)">
                {chartData.map((entry: any, index: number) => {
                  const color = entry.disponibilidade >= 90 ? "var(--accent-green)" : entry.disponibilidade >= 75 ? "var(--accent-amber)" : "var(--accent-red)";
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (activeReport === "veiculos") {
      const chartData = data.slice(0, 10).map((l: any) => ({
        placa: l.placa,
        KM: l.kmAtual || 0
      }));
      return (
        <div style={{ height: 260, width: "100%", minWidth: 0, position: "relative" }} className="mt-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="placa" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `${v.toLocaleString()} km`} />
              <Tooltip formatter={(v) => `${v.toLocaleString()} km`} contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border-subtle)", borderRadius: 8 }} />
              <Bar dataKey="KM" fill="var(--accent-violet, #8b5cf6)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Pie chart fallback for classifications (Status / CNH / Tires)
    let pieData: { name: string; value: number }[] = [];
    if (activeReport === "cnhs") {
      pieData = [
        { name: "Vigentes", value: reportData.totais.vigentes || 0 },
        { name: "Vencendo (30d)", value: reportData.totais.vencendo30 || 0 },
        { name: "Vencidas", value: reportData.totais.vencidas || 0 }
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
        <div style={{ height: 260, width: "100%", minWidth: 0, position: "relative" }} className="flex justify-center items-center w-full">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" nameKey="name" label>
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  };

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
              <button
                onClick={exportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Download size={14} className="text-red-500" />
                PDF
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Download size={14} className="text-emerald-500" />
                Excel
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
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
                  <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">DATA DE</label>
                  <input
                    type="date"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">DATA ATÉ</label>
                  <input
                    type="date"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                  />
                </div>
              </>
            )}

            {config.filters.includes("veiculo") && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">VEÍCULO</label>
                <select
                  value={veiculoId}
                  onChange={e => setVeiculoId(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
                  <option value="">Todos os Veículos</option>
                  {veiculos.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.placa} {v.modelo ? `- ${v.modelo}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {config.filters.includes("motorista") && (
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">MOTORISTA</label>
                <select
                  value={motoristaId}
                  onChange={e => setMotoristaId(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
                  <option value="">Todos os Motoristas</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {config.filters.includes("status") && (
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">STATUS</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
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
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">STATUS CNH</label>
                <select
                  value={statusCnh}
                  onChange={e => setStatusCnh(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
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
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">TIPO DE EVENTO</label>
                <select
                  value={tipoPneuEvento}
                  onChange={e => setTipoPneuEvento(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
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
                <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">TIPO DE OS</label>
                <select
                  value={tipoManut}
                  onChange={e => setTipoManut(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-violet)]"
                >
                  <option value="">Todos</option>
                  <option value="preventiva">Preventiva</option>
                  <option value="corretiva">Corretiva</option>
                </select>
              </div>
            )}

            <button
              onClick={loadReport}
              className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold rounded-lg text-[var(--text-primary)] transition-colors flex items-center gap-1.5 h-[34px]"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>

          {/* Report Metadata, Totals & Charts */}
          {loading && (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <RefreshCw size={32} className="animate-spin text-[var(--accent-violet)]" />
              <div className="text-sm font-mono uppercase tracking-widest text-[var(--text-muted)]">Processando Relatório...</div>
            </div>
          )}

          {!loading && reportData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Totals / KPI cards */}
              <div className="flex flex-col gap-4">
                <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
                  Métricas Consolidadas
                </div>

                {/* Veículos KPIs */}
                {activeReport === "veiculos" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE VEÍCULOS</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.total}</div>
                    </div>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">KILOMETRAGEM TOTAL</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--text-primary)]">
                        {reportData.totais.kmTotal?.toLocaleString()} km
                      </div>
                    </div>
                  </>
                )}

                {/* Motoristas KPIs */}
                {activeReport === "motoristas" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE CONDUTORES</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.total}</div>
                    </div>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">MOTORISTAS ATIVOS</div>
                      <div className="text-3xl font-extrabold mt-1 text-emerald-400">{reportData.totais.ativos}</div>
                    </div>
                  </>
                )}

                {/* CNHs KPIs */}
                {activeReport === "cnhs" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">VIGENTES</div>
                        <div className="text-2xl font-extrabold mt-1 text-emerald-400">{reportData.totais.vigentes}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">VENCENDO (30D)</div>
                        <div className="text-2xl font-extrabold mt-1 text-amber-400">{reportData.totais.vencendo30}</div>
                      </div>
                    </div>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">CNHs VENCIDAS</div>
                      <div className="text-3xl font-extrabold mt-1 text-red-500">{reportData.totais.vencidas}</div>
                    </div>
                  </>
                )}

                {/* Pneus KPIs */}
                {activeReport === "pneus" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">TOTAL DE PNEUS</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.total}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">EM USO</div>
                        <div className="text-2xl font-extrabold mt-1 text-emerald-400">{reportData.totais.emUso}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">ESTOQUE</div>
                        <div className="text-2xl font-extrabold mt-1 text-cyan-400">{reportData.totais.estoque}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Histórico de Pneus KPIs */}
                {activeReport === "historico-pneus" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">EVENTOS REGISTRADOS</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.total}</div>
                    </div>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">CUSTO TOTAL COM PNEUS</div>
                      <div className="text-3xl font-extrabold mt-1 text-amber-500">{fmtMoney(reportData.totais.custoTotal)}</div>
                    </div>
                  </>
                )}

                {/* Revisões KPIs */}
                {activeReport === "revisoes" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">CUSTO DE REVISÕES</div>
                      <div className="text-3xl font-extrabold mt-1 text-emerald-400">{fmtMoney(reportData.totais.custoTotal)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">REALIZADAS</div>
                        <div className="text-2xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.realizadas}</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">AGENDADAS</div>
                        <div className="text-2xl font-extrabold mt-1 text-amber-400">{reportData.totais.agendadas}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Manutenções KPIs */}
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

                {/* Custos KPIs */}
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

                {/* Abastecimentos KPIs */}
                {activeReport === "abastecimentos" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">VALOR TOTAL ABASTECIDO</div>
                      <div className="text-3xl font-extrabold mt-1 text-emerald-400">{fmtMoney(reportData.totais.custoTotal)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">CONSUMO MÉDIO</div>
                        <div className="text-2xl font-extrabold mt-1 text-cyan-400">{reportData.totais.consumoMedio} km/L</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)] font-semibold">CUSTO POR KM</div>
                        <div className="text-2xl font-extrabold mt-1 text-[var(--text-primary)]">R$ {reportData.totais.custoKmMedio}</div>
                      </div>
                    </div>
                  </>
                )}

                {/* Disponibilidade KPIs */}
                {activeReport === "disponibilidade" && (
                  <>
                    <div className="card-premium" style={{ padding: 16 }}>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">DISPONIBILIDADE MÉDIA</div>
                      <div className="text-3xl font-extrabold mt-1 text-[var(--accent-violet)]">{reportData.totais.dispMedia}%</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">ATIVOS</div>
                        <div className="text-xl font-bold mt-1 text-emerald-400">{reportData.totais.ativos} veíc.</div>
                      </div>
                      <div className="card-premium" style={{ padding: 16 }}>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">INDISPONÍVEIS (OS)</div>
                        <div className="text-xl font-bold mt-1 text-amber-500">{reportData.totais.indisponiveis} veíc.</div>
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
          )}

          {/* Table Data */}
          {!loading && reportData && (
            <div className="card-premium overflow-hidden">
              <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase border-b border-[var(--border-subtle)] p-4">
                Detalhamento dos Dados
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px] text-[var(--text-secondary)]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      {activeReport === "veiculos" && (
                        <>
                          <th className="text-left p-4">Placa</th>
                          <th className="text-left p-4">Código</th>
                          <th className="text-left p-4">Marca</th>
                          <th className="text-left p-4">Modelo</th>
                          <th className="text-left p-4">Tipo</th>
                          <th className="text-left p-4">Combustível</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">KM Atual</th>
                        </>
                      )}
                      {activeReport === "motoristas" && (
                        <>
                          <th className="text-left p-4">Nome</th>
                          <th className="text-left p-4">CPF</th>
                          <th className="text-left p-4">Matrícula</th>
                          <th className="text-left p-4">Departamento</th>
                          <th className="text-left p-4">Cargo</th>
                          <th className="text-left p-4">Status</th>
                        </>
                      )}
                      {activeReport === "cnhs" && (
                        <>
                          <th className="text-left p-4">Nome</th>
                          <th className="text-left p-4">CPF</th>
                          <th className="text-left p-4">CNH</th>
                          <th className="text-left p-4">Cat.</th>
                          <th className="text-left p-4">Validade</th>
                          <th className="text-left p-4">Situação</th>
                        </>
                      )}
                      {activeReport === "pneus" && (
                        <>
                          <th className="text-left p-4">Nº Fogo</th>
                          <th className="text-left p-4">Código</th>
                          <th className="text-left p-4">Marca/Modelo</th>
                          <th className="text-left p-4">Medida</th>
                          <th className="text-left p-4">Posição</th>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-left p-4">Status</th>
                        </>
                      )}
                      {activeReport === "historico-pneus" && (
                        <>
                          <th className="text-left p-4">Pneu (Fogo/Cód)</th>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-left p-4">Evento</th>
                          <th className="text-left p-4">Data</th>
                          <th className="text-right p-4">KM</th>
                          <th className="text-right p-4">Custo</th>
                          <th className="text-left p-4">Observação</th>
                        </>
                      )}
                      {activeReport === "revisoes" && (
                        <>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-left p-4">Tipo</th>
                          <th className="text-left p-4">Descrição</th>
                          <th className="text-left p-4">Data Prev.</th>
                          <th className="text-right p-4">KM Prev.</th>
                          <th className="text-left p-4">Data Realiz.</th>
                          <th className="text-right p-4">KM Realiz.</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">Custo</th>
                        </>
                      )}
                      {activeReport === "manutencoes" && (
                        <>
                          <th className="text-left p-4">OS</th>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-left p-4">Tipo</th>
                          <th className="text-left p-4">Descrição</th>
                          <th className="text-left p-4">Data</th>
                          <th className="text-right p-4">KM</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">Custo Total</th>
                        </>
                      )}
                      {activeReport === "custos" && (
                        <>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-right p-4">Manutenções (OS)</th>
                          <th className="text-right p-4">Abastecimentos</th>
                          <th className="text-right p-4">Combustível (L)</th>
                          <th className="text-right p-4">Custo OS</th>
                          <th className="text-right p-4">Custo Combustível</th>
                          <th className="text-right p-4">Custo Total</th>
                        </>
                      )}
                      {activeReport === "abastecimentos" && (
                        <>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-left p-4">Motorista</th>
                          <th className="text-left p-4">Data</th>
                          <th className="text-left p-4">Posto</th>
                          <th className="text-left p-4">Combustível</th>
                          <th className="text-right p-4">Litros</th>
                          <th className="text-right p-4">KM</th>
                          <th className="text-right p-4">Valor Total</th>
                          <th className="text-right p-4">Consumo (km/L)</th>
                          <th className="text-right p-4">Custo/KM</th>
                        </>
                      )}
                      {activeReport === "disponibilidade" && (
                        <>
                          <th className="text-left p-4">Veículo</th>
                          <th className="text-right p-4">Dias no Período</th>
                          <th className="text-right p-4">Dias Parado</th>
                          <th className="text-right p-4">Dias Ativo</th>
                          <th className="text-right p-4">Disponibilidade (%)</th>
                          <th className="text-left p-4">Status Atual</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {!reportData.linhas || reportData.linhas.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-[var(--text-muted)]">
                          Nenhum registro encontrado no filtro selecionado.
                        </td>
                      </tr>
                    ) : (
                      reportData.linhas.map((l: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        const rowBg = isEven ? "bg-[var(--bg-secondary)]" : "bg-[var(--bg-primary)]/30";
                        return (
                          <tr key={idx} className={`${rowBg} hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)]`}>
                            {activeReport === "veiculos" && (
                              <>
                                <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{l.placa}</td>
                                <td className="p-4">{l.codigo}</td>
                                <td className="p-4">{l.marca}</td>
                                <td className="p-4">{l.modelo}</td>
                                <td className="p-4 text-[var(--text-muted)] capitalize">{l.tipo}</td>
                                <td className="p-4 text-[var(--text-muted)] capitalize">{l.combustivel}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" :
                                    l.status === "manutencao" ? "bg-amber-500/10 text-amber-400" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                                  }`}>
                                    {l.status === "manutencao" ? "Manutenção" : l.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-mono">{l.kmAtual?.toLocaleString()} km</td>
                              </>
                            )}
                            {activeReport === "motoristas" && (
                              <>
                                <td className="p-4 font-bold text-[var(--text-primary)]">{l.nome}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">{l.cpf}</td>
                                <td className="p-4 font-mono">{l.matricula}</td>
                                <td className="p-4">{l.departamento}</td>
                                <td className="p-4">{l.cargo}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.status === "ativo" ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                                  }`}>
                                    {l.status}
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === "cnhs" && (
                              <>
                                <td className="p-4 font-bold text-[var(--text-primary)]">{l.nome}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">{l.cpf}</td>
                                <td className="p-4 font-mono">{l.cnh}</td>
                                <td className="p-4 font-mono">{l.categoriaCnh}</td>
                                <td className="p-4 font-mono">
                                  {l.validadeCnh ? new Date(l.validadeCnh).toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.statusCnh === "vigente" ? "bg-emerald-500/10 text-emerald-400" :
                                    l.statusCnh === "vencendo_30" ? "bg-amber-500/10 text-amber-400" :
                                    l.statusCnh === "vencida" ? "bg-red-500/10 text-red-400" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                                  }`}>
                                    {l.statusCnh === "vencendo_30" ? "Vence em 30d" : l.statusCnh}
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === "pneus" && (
                              <>
                                <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{l.numeroFogo}</td>
                                <td className="p-4 font-mono">{l.codigo}</td>
                                <td className="p-4">{l.marca} {l.modelo ? `/ ${l.modelo}` : ""}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">{l.medida}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">{l.posicao || "-"}</td>
                                <td className="p-4 font-mono">{l.veiculo?.placa || "-"}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.status === "em_uso" ? "bg-emerald-500/10 text-emerald-400" :
                                    l.status === "estoque" ? "bg-cyan-500/10 text-cyan-400" :
                                    l.status === "recapagem" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                                  }`}>
                                    {l.status === "em_uso" ? "Em Uso" : l.status}
                                  </span>
                                </td>
                              </>
                            )}
                            {activeReport === "historico-pneus" && (
                              <>
                                <td className="p-4">
                                  <div className="font-bold text-[var(--text-primary)]">{l.pneu?.numeroFogo || "-"}</div>
                                  <div className="text-[11px] text-[var(--text-faint)] font-mono">{l.pneu?.codigo}</div>
                                </td>
                                <td className="p-4 font-mono">{l.veiculo?.placa || "-"}</td>
                                <td className="p-4 text-[var(--text-secondary)] uppercase font-semibold text-[11px]">{l.tipo}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">
                                  {new Date(l.data).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="p-4 text-right font-mono">{l.km?.toLocaleString()} km</td>
                                <td className="p-4 text-right font-mono text-amber-500">{fmtMoney(l.custo)}</td>
                                <td className="p-4 text-[var(--text-muted)]">{l.observacao || "-"}</td>
                              </>
                            )}
                            {activeReport === "revisoes" && (
                              <>
                                <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{l.veiculo?.placa || ""}</td>
                                <td className="p-4 capitalize">{l.tipo}</td>
                                <td className="p-4 text-[var(--text-muted)]">{l.descricao}</td>
                                <td className="p-4 font-mono">
                                  {l.dataPrevista ? new Date(l.dataPrevista).toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="p-4 text-right font-mono">{l.kmPrevisto?.toLocaleString()} km</td>
                                <td className="p-4 font-mono">
                                  {l.dataRealizada ? new Date(l.dataRealizada).toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="p-4 text-right font-mono">{l.kmRealizado ? `${l.kmRealizado.toLocaleString()} km` : "-"}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.status === "realizada" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                  }`}>
                                    {l.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-mono text-emerald-400">{fmtMoney(l.custo)}</td>
                              </>
                            )}
                            {activeReport === "manutencoes" && (
                              <>
                                <td className="p-4 font-mono font-bold text-[var(--text-secondary)]">{l.numeroOs || "-"}</td>
                                <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{l.veiculo?.placa || ""}</td>
                                <td className="p-4 capitalize font-semibold text-[var(--text-secondary)] text-[11px]">{l.tipo}</td>
                                <td className="p-4 text-[var(--text-muted)]">{l.descricao}</td>
                                <td className="p-4 font-mono">
                                  {l.data ? new Date(l.data).toLocaleDateString("pt-BR") : "-"}
                                </td>
                                <td className="p-4 text-right font-mono">{l.km?.toLocaleString()} km</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.status === "concluida" ? "bg-emerald-500/10 text-emerald-400" :
                                    l.status === "cancelada" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                                  }`}>
                                    {l.status}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-amber-500">{fmtMoney(l.custo)}</td>
                              </>
                            )}
                            {activeReport === "custos" && (
                              <>
                                <td className="p-4">
                                  <div className="font-mono font-bold text-[var(--text-primary)]">{l.veiculo?.placa || ""}</div>
                                  <div className="text-[11px] text-[var(--text-faint)]">{l.veiculo?.modelo || ""}</div>
                                </td>
                                <td className="p-4 text-right font-mono">{l.totalManutencoes}</td>
                                <td className="p-4 text-right font-mono">{l.totalAbastecimentos}</td>
                                <td className="p-4 text-right font-mono">{l.litros?.toLocaleString("pt-BR")} L</td>
                                <td className="p-4 text-right font-mono text-amber-500">{fmtMoney(l.custoManutencao)}</td>
                                <td className="p-4 text-right font-mono text-emerald-400">{fmtMoney(l.custoAbastecimento)}</td>
                                <td className="p-4 text-right font-mono font-bold text-[#22c55e]">{fmtMoney(l.custoTotal)}</td>
                              </>
                            )}
                            {activeReport === "abastecimentos" && (
                              <>
                                <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{l.veiculo?.placa || ""}</td>
                                <td className="p-4 font-semibold">{l.motorista?.nome || "-"}</td>
                                <td className="p-4 font-mono text-[var(--text-muted)]">
                                  {new Date(l.data).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="p-4 text-[var(--text-secondary)]">{l.posto}</td>
                                <td className="p-4 text-[var(--text-muted)] capitalize">{l.tipoCombustivel}</td>
                                <td className="p-4 text-right font-mono">{l.litros?.toLocaleString("pt-BR")} L</td>
                                <td className="p-4 text-right font-mono">{l.kmAtual?.toLocaleString()} km</td>
                                <td className="p-4 text-right font-mono text-emerald-400 font-bold">{fmtMoney(l.valorTotal)}</td>
                                <td className="p-4 text-right font-mono text-cyan-400 font-semibold">{l.consumoKmL ? `${l.consumoKmL} km/L` : "-"}</td>
                                <td className="p-4 text-right font-mono text-[var(--text-muted)]">{l.custoKm ? `R$ ${l.custoKm}` : "-"}</td>
                              </>
                            )}
                            {activeReport === "disponibilidade" && (
                              <>
                                <td className="p-4">
                                  <div className="font-mono font-bold text-[var(--text-primary)]">{l.veiculo?.placa || ""}</div>
                                  <div className="text-[11px] text-[var(--text-faint)]">{l.veiculo?.modelo || ""}</div>
                                </td>
                                <td className="p-4 text-right font-mono">{l.diasTotais}</td>
                                <td className="p-4 text-right font-mono text-amber-500">{l.diasParado} d</td>
                                <td className="p-4 text-right font-mono text-emerald-400">{l.diasAtivo} d</td>
                                <td className="p-4 text-right font-mono font-bold">
                                  <span className={
                                    l.disponibilidade >= 90 ? "text-emerald-400" :
                                    l.disponibilidade >= 75 ? "text-amber-400" : "text-red-400"
                                  }>
                                    {l.disponibilidade}%
                                  </span>
                                </td>
                                <td className="p-4 capitalize">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                    l.statusAtual === "ativo" ? "bg-emerald-500/10 text-emerald-400" :
                                    l.statusAtual === "manutencao" ? "bg-amber-500/10 text-amber-400" : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                                  }`}>
                                    {l.statusAtual === "manutencao" ? "Em Manutenção" : l.statusAtual}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              <label className="text-[10px] font-mono text-[var(--text-muted)] block uppercase">
                Destinatários (separados por vírgula)
              </label>
              <input
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
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="btn btn-ghost py-1.5 px-4 text-xs"
              >
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

            {/* List of active schedules */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold font-mono text-[var(--text-muted)] uppercase tracking-wider">
                  Agendamentos Ativos
                </h4>
                {!isCreatingSchedule && (
                  <button
                    onClick={() => setIsCreatingSchedule(true)}
                    className="btn btn-ghost py-1 px-3 text-xs flex items-center gap-1"
                  >
                    <Plus size={12} /> Novo Agendamento
                  </button>
                )}
              </div>

              {isCreatingSchedule && (
                <form onSubmit={handleCreateSchedule} className="bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] p-4 rounded-xl flex flex-col gap-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">TÍTULO / IDENTIFICAÇÃO</label>
                      <input
                        type="text"
                        placeholder="Ex: Custo de Frota Semanal"
                        required
                        value={scheduleTitle}
                        onChange={e => setScheduleTitle(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">FREQUÊNCIA</label>
                      <select
                        value={scheduleFreq}
                        onChange={e => setScheduleFreq(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      >
                        <option value="diaria">Diária</option>
                        <option value="semanal">Semanal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">FORMATO DO ANEXO</label>
                      <select
                        value={scheduleFormat}
                        onChange={e => setScheduleFormat(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      >
                        <option value="csv">CSV (Excel)</option>
                        <option value="excel">Planilha Excel (.xlsx)</option>
                        <option value="pdf">Documento PDF</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">DESTINATÁRIOS (COMMA SEPARATED)</label>
                      <input
                        type="text"
                        placeholder="financeiro@empresa.com, diretoria@empresa.com"
                        required
                        value={scheduleDest}
                        onChange={e => setScheduleDest(e.target.value)}
                        className="input-o text-xs bg-[var(--bg-secondary)]"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--text-muted)] italic bg-[var(--bg-secondary)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    * Este agendamento aplicará os filtros atuais selecionados na tela (Veículos, datas ou categorias) ao gerar os dados automaticamente.
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSchedule(false)}
                      className="btn btn-ghost py-1.5 px-3"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3"
                    >
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
                          <td className="p-3 truncate max-w-[160px]" title={s.destinatarios}>{s.destinatarios}</td>
                          <td className="p-3 font-mono text-[var(--text-muted)]">
                            {s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleDateString("pt-BR") : "Nunca"}
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
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="btn btn-ghost py-2 px-4"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
