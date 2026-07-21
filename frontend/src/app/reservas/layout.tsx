import { ReactNode } from "react";
import Link from "next/link";
import { Calendar, Car, PieChart, ChevronLeft, List, BarChart } from "lucide-react";

export default function ReservasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col transition-all">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-200 dark:border-slate-800">
          <Car className="h-6 w-6 text-red-600 dark:text-red-500 shrink-0 lg:hidden" />
          <img src="/branding/logo-ttbr-colorida.png" alt="Triunfo TBR" className="h-8 w-auto hidden lg:block dark:hidden" />
          <img src="/branding/logo-ttbr-branca.png" alt="Triunfo TBR" className="h-8 w-auto hidden dark:lg:block" />
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3">
          <NavItem href="/reservas" icon={<PieChart className="w-5 h-5" />} label="Dashboard" />
          <NavItem href="/reservas/calendario" icon={<Calendar className="w-5 h-5" />} label="Calendário" />
          <NavItem href="/reservas/lista" icon={<List className="w-5 h-5" />} label="Minhas Reservas" />
          <NavItem href="/reservas/veiculos" icon={<Car className="w-5 h-5" />} label="Veículos Disponíveis" />
          <NavItem href="/reservas/relatorios" icon={<BarChart className="w-5 h-5" />} label="Relatórios" />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Link href="/dashboard/frota" className="flex items-center p-3 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group">
            <ChevronLeft className="h-5 w-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            <span className="ml-3 hidden lg:block font-medium">Voltar ao HUB</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
        <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center p-3 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all group">
      <div className="shrink-0 group-hover:scale-110 transition-transform">{icon}</div>
      <span className="ml-3 hidden lg:block font-medium">{label}</span>
    </Link>
  );
}
