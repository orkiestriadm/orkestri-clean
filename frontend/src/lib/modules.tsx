// Fonte única dos módulos do sistema.
// Usado pelo Sidebar (navegação) e pelo Command Center (launcher "Módulos").
// Manter aqui evita que as duas telas saiam de sincronia.
import {
  LayoutDashboard, CalendarDays, Layers, StickyNote, MessageCircle,
  Building2, GanttChart, BarChart2, Users, History, Settings,
  Headphones, PiggyBank, Truck, BookOpen, Package, Zap, Clock, FileText, Activity, CheckSquare,
  SmilePlus, TrendingUp, Receipt, LayoutGrid, CreditCard, Brain,
  GitBranch, Network, ShoppingBag, Radio, Wallet, FileSpreadsheet, Wrench,
  ClipboardCheck, FolderKanban, Boxes, ShieldCheck, HeartPulse, Bell,
  Briefcase, CalendarClock, Library, BarChart3, CalendarX, UsersRound, Inbox,
} from "lucide-react";

// `permission` como lista significa OU — ver canAccessModule.
export type NavItem  = { href: string; label: string; icon: any; permission: string | string[] | null };
// access controla a visibilidade do grupo INTEIRO (além das permissões por item):
//   undefined  → visível a todos (respeitando a permissão de cada item)
//   "sa"       → só Super Admin global (infra/plataforma)
//   "adminOrg" → só master ou papel "administrador" (área administrativa da empresa)
export type GroupAccess = "sa" | "adminOrg";
// Cada grupo é um "produto": nome de marca (produto) + descritor em português + um
// ícone que representa o produto (usado no cabeçalho do menu e no launcher).
export type NavGroup = { id: string; produto: string | null; descritor: string | null; icon: any; access?: GroupAccess; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    id: "pinned", produto: null, descritor: null, icon: LayoutDashboard,
    items: [
      { href: "/dashboard",            label: "Visão Geral", icon: LayoutDashboard, permission: null }, // dashboard is available to all
      { href: "/dashboard/executivo",  label: "Executivo",   icon: TrendingUp,      permission: "relatorios:ver" },
      { href: "/dashboard/ia",         label: "IA Operacional", icon: Brain,        permission: "relatorios:ver" },
      { href: "/dashboard/relatorios", label: "Relatórios",  icon: BarChart2,       permission: "relatorios:ver" },
      { href: "/dashboard/workforce",  label: "Workforce",   icon: LayoutGrid,      permission: "colaboradores:ver" },
    ],
  },
  {
    // Orkiestri People — gestão de pessoas. As abas de colaboradores, ausências,
    // skills e organograma saem de Cadastros e passam a viver aqui (Fase 3).
    // Permissão legada `colaboradores:ver` continua valendo: o guard do backend
    // a traduz para `people.employee.view`.
    id: "people", produto: "People", descritor: "Pessoas", icon: Users,
    items: [
      { href: "/dashboard/people",             label: "Colaboradores", icon: Users,         permission: "colaboradores:ver" },
      { href: "/dashboard/people/cargos",      label: "Cargos",        icon: Briefcase,     permission: "people.cargo:ver" },
      { href: "/dashboard/people/ausencias",   label: "Ausências",     icon: CalendarX,     permission: "colaboradores:ver" },
      { href: "/dashboard/people/organograma", label: "Organograma",   icon: Network,       permission: "colaboradores:ver" },
      { href: "/dashboard/people/equipes",     label: "Equipes",       icon: UsersRound,    permission: "colaboradores:ver" },
      // Autosserviço: qualquer pessoa com login abre solicitação ao RH.
      { href: "/dashboard/people/solicitacoes", label: "Solicitações", icon: Inbox,        permission: null },
      // O passivo é visão do quadro inteiro: o backend o protege com
      // relatorio:ver, não com ferias:ver. Espelhar evita um link que dá 403.
      { href: "/dashboard/people/ferias",      label: "Férias",        icon: CalendarClock, permission: "people.relatorio:ver" },
      { href: "/dashboard/people/catalogos",   label: "Catálogos",     icon: Library,       permission: ["people.beneficio:ver", "people.treinamento:ver"] },
      { href: "/dashboard/people/indicadores", label: "Indicadores",   icon: BarChart3,     permission: "people.relatorio:ver" },
    ],
  },
  {
    id: "service", produto: "Service", descritor: "Chamados", icon: Headphones,
    items: [
      { href: "/dashboard/catalogo",      label: "Catálogo",     icon: ShoppingBag,  permission: "chamados:criar" },
      { href: "/dashboard/chamados",     label: "Chamados",     icon: Headphones,   permission: "chamados:ver" },
      { href: "/dashboard/apontamentos", label: "Horas",        icon: Clock,        permission: "chamados:ver" },
      { href: "/dashboard/csat",         label: "CSAT",         icon: SmilePlus,    permission: "chamados:ver" },
      { href: "/dashboard/automacoes",   label: "Automações",   icon: Zap,          permission: "automacoes:ver" },
    ],
  },
  {
    id: "quality", produto: "Quality", descritor: "Procedimentos", icon: ClipboardCheck,
    items: [
      { href: "/dashboard/conhecimento", label: "Conhecimento", icon: BookOpen,     permission: "conhecimento:ver" },
      { href: "/dashboard/processos",    label: "Processos",    icon: GitBranch,    permission: "projetos:ver" },
      { href: "/dashboard/capacity",     label: "Capacidade",   icon: Activity,     permission: "projetos:ver" },
    ],
  },
  {
    id: "projects", produto: "Projects", descritor: "Projetos", icon: FolderKanban,
    items: [
      { href: "/dashboard/projetos",  label: "Projetos",       icon: Layers,       permission: "projetos:ver" },
      { href: "/dashboard/gantt",     label: "Linha do Tempo", icon: GanttChart,   permission: "gantt:ver" },
    ],
  },
  {
    id: "space", produto: "Space", descritor: "Agenda", icon: CalendarDays,
    items: [
      { href: "/dashboard/agenda",    label: "Agenda",         icon: CalendarDays, permission: "agenda:ver" },
      { href: "/dashboard/keep",      label: "Keep",           icon: StickyNote,   permission: "keep:ver" },
    ],
  },
  {
    id: "approvals", produto: "Approvals", descritor: "Aprovações", icon: CheckSquare,
    items: [
      { href: "/dashboard/aprovacoes",label: "Aprovações",     icon: CheckSquare,  permission: "solicitacoes:aprovar" },
    ],
  },
  {
    id: "assets", produto: "Assets", descritor: "Ativos", icon: Package,
    items: [
      { href: "/dashboard/ativos",    label: "Ativos",         icon: Package,      permission: "ativos:ver" },
      { href: "/dashboard/cmdb",      label: "CMDB",           icon: Network,      permission: "ativos:ver" },
      { href: "/dashboard/monitoramento", label: "Monitoramento", icon: Radio,     permission: "monitoramento:ver" },
    ],
  },
  {
    id: "finance", produto: "Finance", descritor: "Financeiro", icon: Wallet,
    items: [
      { href: "/dashboard/financeiro",                  label: "Dashboard",      icon: Wallet,          permission: "financeiro:ver" },
      { href: "/dashboard/financeiro/contas-a-pagar",   label: "Contas a Pagar", icon: FileSpreadsheet,  permission: "financeiro:ver" },
    ],
  },
  {
    id: "budget", produto: "Budget", descritor: "Orçamento", icon: PiggyBank,
    items: [
      { href: "/dashboard/orcamento",                   label: "Orçamento",      icon: PiggyBank,        permission: "orcamento:ver" },
    ],
  },
  {
    id: "fleet", produto: "Fleet", descritor: "Frotas", icon: Truck,
    items: [
      { href: "/dashboard/frota",                label: "Dashboard",      icon: LayoutDashboard, permission: "frota:ver" },
      { href: "/dashboard/frota/veiculos",       label: "Veículos",       icon: Truck,           permission: "frota:ver" },
      { href: "/dashboard/frota/motoristas",     label: "Motoristas",     icon: Users,           permission: "frota:ver" },
      { href: "/dashboard/frota/pneus",          label: "Pneus",          icon: Package,         permission: "frota:ver" },
      { href: "/dashboard/frota/revisoes",       label: "Revisões",       icon: CalendarDays,    permission: "frota:ver" },
      { href: "/dashboard/frota/manutencoes",    label: "Manutenções",    icon: Wrench,          permission: "frota:ver" },
      { href: "/dashboard/frota/documentacoes",  label: "Documentações",  icon: FileText,        permission: "frota:ver" },
      { href: "/dashboard/frota/abastecimentos", label: "Abastecimentos", icon: Zap,             permission: "frota:ver" },
      { href: "/reservas",                       label: "Reserva de Carros", icon: CalendarDays, permission: "reservas:ver" },
      { href: "/dashboard/frota/relatorios",     label: "Relatórios",     icon: BarChart2,       permission: "frota:relatorios" },
      { href: "/dashboard/frota/configuracoes",  label: "Configurações",  icon: Settings,        permission: "frota:configurar" },
    ],
  },
  {
    id: "relations", produto: "Relations", descritor: "Clientes", icon: Building2,
    items: [
      { href: "/dashboard/clientes",  label: "Clientes",  icon: Building2, permission: "crm:ver" },
      { href: "/dashboard/contratos", label: "Contratos", icon: FileText,  permission: "crm:ver" },
      { href: "/dashboard/faturas",   label: "Faturas",   icon: Receipt,   permission: "crm:ver" },
    ],
  },
  {
    id: "supply", produto: "Supply", descritor: "Suprimentos", icon: Boxes,
    items: [
      { href: "/dashboard/cadastros/fornecedores", label: "Fornecedores",  icon: Truck,         permission: "fornecedores:ver" },
    ],
  },
  {
    id: "core", produto: "Core", descritor: "Administração", icon: Settings, access: "adminOrg",
    items: [
      { href: "/dashboard/cadastros",              label: "Cadastros",         icon: Users,         permission: "usuarios:ver" },
      { href: "/dashboard/alertas",                label: "Regras de Alertas", icon: Bell,          permission: null },
      { href: "/dashboard/whatsapp-config",        label: "WhatsApp",          icon: MessageCircle, permission: "whatsapp:ver" },
      { href: "/dashboard/historico",              label: "Histórico",     icon: History,       permission: "historico:ver" },
      { href: "/dashboard/configuracoes",          label: "Configurações", icon: Settings,      permission: "configuracoes:ver" },
      { href: "/dashboard/billing/me",             label: "Assinatura",    icon: CreditCard,    permission: "configuracoes:ver" },
    ],
  },
  {
    id: "platform", produto: "Plataforma", descritor: "Super Admin", icon: ShieldCheck, access: "sa",
    items: [
      { href: "/dashboard/plataforma", label: "Saúde da Plataforma", icon: HeartPulse, permission: null },
      { href: "/dashboard/superadmin", label: "Organizações",        icon: Building2,  permission: null },
    ],
  },
];

// Um grupo é acessível se o access bater com o nível do usuário.
export function canAccessGroup(user: any, group: NavGroup): boolean {
  if (!group.access) return true;
  if (group.access === "sa") return !!user?.isSuperAdmin;
  if (group.access === "adminOrg") {
    return !!user?.isMaster || (user?.roles ?? []).includes("administrador");
  }
  return true;
}

// Um item é acessível se não exige permissão, se o usuário é master,
// ou se possui o coringa "*" ou a permissão específica.
/**
 * Uma lista de permissões vale como OU: basta uma para o item aparecer.
 *
 * Existe porque há telas que reúnem assuntos com concessões distintas —
 * Catálogos junta benefícios e cursos. Exigir as duas esconderia a tela de
 * quem legitimamente administra só uma metade, e a própria tela já resolve o
 * resto: abre na aba que a pessoa pode ver.
 */
export function canAccessModule(user: any, permission: string | string[] | null): boolean {
  if (!permission) return true;
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  if (perms.includes("*")) return true;
  const exigidas = Array.isArray(permission) ? permission : [permission];
  return exigidas.some(p => perms.includes(p));
}
