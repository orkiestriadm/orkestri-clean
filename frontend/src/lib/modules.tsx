// Fonte única dos módulos do sistema.
// Usado pelo Sidebar (navegação) e pelo Command Center (launcher "Módulos").
// Manter aqui evita que as duas telas saiam de sincronia.
import {
  LayoutDashboard, CalendarDays, Layers, StickyNote, MessageCircle,
  Building2, GanttChart, Users, History, Settings,
  PiggyBank, Zap, Receipt, CreditCard,
  Wallet, FileSpreadsheet,
  FolderKanban, ShieldCheck, HeartPulse, Bell, Info, CheckCircle2,
} from "lucide-react";

// `permission` como lista significa OU — ver canAccessModule.
//
// `access` restringe o ITEM por nível de conta, e não por permissão concedida.
// Existe porque nem toda restrição cabe no catálogo de permissões: "só quem
// administra a plataforma" não é algo que se conceda a um papel — é o que a
// conta é. Sem isto, esconder um único item exigiria movê-lo para um grupo
// inteiro só dele.
export type NavItem  = {
  href: string;
  label: string;
  icon: any;
  permission: string | string[] | null;
  access?: ItemAccess;
};

/** "master" = master da organização ou Super Admin global. */
export type ItemAccess = "master";
// access controla a visibilidade do grupo INTEIRO (além das permissões por item):
//   undefined  → visível a todos (respeitando a permissão de cada item)
//   "sa"       → só Super Admin global (infra/plataforma)
//   "adminOrg" → só master ou papel "administrador" (área administrativa da empresa)
export type GroupAccess = "sa" | "adminOrg";
// Cada grupo é um "produto": nome de marca (produto) + descritor em português + um
// ícone que representa o produto (usado no cabeçalho do menu e no launcher).
export type NavGroup = { id: string; produto: string | null; descritor: string | null; icon: any; access?: GroupAccess; items: NavItem[] };

/**
 * Escopo do produto a partir de 18/10/2026.
 *
 * O menu tem três produtos — Space, Projects e Finance (com o Orçamento
 * dentro dele) — mais o Core e a Plataforma, que são o que organiza o sistema.
 *
 * Saíram daqui People, Fleet, Compliance, Strategy, Service, Assets,
 * Relations, Supply, Quality e Approvals, e com eles os painéis agregadores
 * (Executivo, IA Operacional, Relatórios e Workforce): todos liam de
 * chamados, ativos, aprovações, capacity e contratos, e sem esses módulos
 * viravam tela vazia. Esses produtos seguem vivos na linha do Hub
 * Transbrasiliana, em outra branch.
 *
 * Automações ficou no Core, e não como tela de Service onde morava: o motor
 * é infraestrutura que o Projects e o Users chamam em `projeto_criado`,
 * `tarefa_criada`, `tarefa_atribuida`, `tarefa_concluida` e `usuario_criado`.
 */
export const NAV: NavGroup[] = [
  {
    id: "pinned", produto: null, descritor: null, icon: LayoutDashboard,
    items: [
      { href: "/dashboard",            label: "Visão Geral", icon: LayoutDashboard, permission: "dashboard:ver" }, // dashboard is available to all
      // Restrito ao master/SA por decisão do produto.
      //
      // Era aberto a todos com um motivo: quem relata um problema precisa saber
      // informar a versão. Esse motivo não desapareceu — quem for atender um
      // chamado agora precisa pedir a versão a um master, ou consultá-la em
      // `GET /api/health`, que continua público.
      { href: "/dashboard/sobre", label: "Sobre", icon: Info, permission: "dashboard:ver", access: "master" },
    ],
  },
  {
    id: "projects", produto: "Projects", descritor: "Projetos", icon: FolderKanban,
    items: [
      { href: "/dashboard/projetos",  label: "Projetos",       icon: Layers,       permission: "projetos:ver" },
      { href: "/dashboard/projetos/concluidos", label: "Concluídos", icon: CheckCircle2, permission: "projetos:ver" },
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
    // O Orçamento passou a viver dentro do Finance em 18/10/2026. Era um
    // produto à parte no menu (grupo "budget"), o que dividia o assunto
    // dinheiro em duas portas para quem administra uma só.
    id: "finance", produto: "Finance", descritor: "Financeiro", icon: Wallet,
    items: [
      { href: "/dashboard/financeiro",                  label: "Dashboard",      icon: Wallet,          permission: "financeiro:ver" },
      { href: "/dashboard/financeiro/gastos",           label: "Meus Gastos",    icon: Receipt,          permission: "gastos:ver" },
      { href: "/dashboard/financeiro/contas-a-pagar",   label: "Contas a Pagar", icon: FileSpreadsheet,  permission: "financeiro:ver" },
      { href: "/dashboard/orcamento",                   label: "Orçamento",      icon: PiggyBank,        permission: "orcamento:ver" },
    ],
  },
  {
    id: "core", produto: "Core", descritor: "Administração", icon: Settings, access: "adminOrg",
    items: [
      { href: "/dashboard/cadastros",              label: "Cadastros",         icon: Users,         permission: "usuarios:ver" },
      { href: "/dashboard/alertas",                label: "Regras de Alertas", icon: Bell,          permission: null },
      { href: "/dashboard/automacoes",             label: "Automações",        icon: Zap,           permission: "automacoes:ver" },
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

/**
 * Nível de conta exigido pelo item, quando há um.
 *
 * Separado de `canAccessModule` de propósito: aquele responde "concederam isto
 * a você?", este responde "você é isto?". Misturar os dois faria uma permissão
 * concedida por engano abrir uma tela que nunca deveria depender de concessão.
 */
export function canAccessItemLevel(user: any, item: { access?: ItemAccess }): boolean {
  if (!item.access) return true;
  if (item.access === "master") return !!user?.isMaster || !!user?.isSuperAdmin;
  return true;
}

// Um item é acessível se não exige permissão, se o usuário é master,
// ou se possui o coringa "*" ou a permissão específica.
/**
 * Uma lista de permissões vale como OU: basta uma para o item aparecer.
 *
 * Existe porque há telas que reúnem assuntos com concessões distintas. Exigir
 * todas esconderia a tela de quem legitimamente administra só uma parte, e a
 * própria tela já resolve o resto: abre na aba que a pessoa pode ver.
 */
export function canAccessModule(user: any, permission: string | string[] | null): boolean {
  if (!permission) return true;
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  if (perms.includes("*")) return true;
  const exigidas = Array.isArray(permission) ? permission : [permission];
  return exigidas.some(p => perms.includes(p));
}

/**
 * Rota inicial pós-login. Quem tem a Visão Geral (dashboard:ver) vai para
 * /dashboard; quem NÃO tem (ex.: acesso de teste) é levado para a 1ª tela que
 * consegue abrir. Sem isso, o trial cai na Visão Geral — que consulta dados de
 * módulos que ele não tem — e a página entra em loop de erro.
 */
export function homeRoute(user: any): string {
  if (!user) return "/dashboard";
  if (user.isMaster || user.isSuperAdmin || canAccessModule(user, "dashboard:ver")) return "/dashboard";
  for (const g of NAV) {
    if (!canAccessGroup(user, g)) continue;
    for (const it of g.items) {
      if (it.href === "/dashboard") continue;
      if (canAccessItemLevel(user, it) && canAccessModule(user, it.permission)) return it.href;
    }
  }
  return "/dashboard/perfil"; // sempre acessível
}
