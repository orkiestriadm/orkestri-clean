"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Car, PieChart, ChevronLeft, List, BarChart, ArrowLeft } from "lucide-react";

export default function ReservasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-16 lg:w-60 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col transition-all">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center lg:justify-start lg:px-5 border-b border-slate-200 dark:border-slate-800">
          <Car className="h-5 w-5 text-red-600 dark:text-red-500 shrink-0 lg:hidden" />
          <img src="/branding/logo-ttbr-colorida.png" alt="Triunfo TBR" className="h-7 w-auto hidden lg:block dark:hidden" />
          <img src="/branding/logo-ttbr-branca.png" alt="Triunfo TBR" className="h-7 w-auto hidden dark:lg:block" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 lg:px-3">
          <NavItem href="/reservas" icon={<PieChart className="w-[18px] h-[18px]" />} label="Dashboard" />
          <NavItem href="/reservas/calendario" icon={<Calendar className="w-[18px] h-[18px]" />} label="Calendário" />
          <NavItem href="/reservas/lista" icon={<List className="w-[18px] h-[18px]" />} label="Minhas Reservas" />
          <NavItem href="/reservas/veiculos" icon={<Car className="w-[18px] h-[18px]" />} label="Veículos" />
          <NavItem href="/reservas/relatorios" icon={<BarChart className="w-[18px] h-[18px]" />} label="Relatórios" />
        </nav>

        {/* Voltar ao HUB — Modern button */}
        <div className="p-3 lg:px-4 lg:pb-5">
          <Link
            href="/dashboard/frota"
            className="
              relative flex items-center justify-center lg:justify-start gap-2.5
              w-full px-3 py-2.5 lg:py-3
              bg-gradient-to-r from-red-600 to-red-700
              hover:from-red-700 hover:to-red-800
              active:from-red-800 active:to-red-900
              text-white font-semibold text-xs lg:text-sm
              rounded-xl
              shadow-md shadow-red-600/25 hover:shadow-lg hover:shadow-red-600/35
              transition-all duration-200 ease-out
              group overflow-hidden
            "
          >
            {/* Shine effect */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
            <ArrowLeft className="w-4 h-4 shrink-0 group-hover:-translate-x-0.5 transition-transform duration-200" />
            <span className="hidden lg:block relative">Voltar ao HUB</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
        <div className="p-4 md:p-6 lg:p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/reservas" && pathname?.startsWith(href));
  const isExactDashboard = href === "/reservas" && pathname === "/reservas";

  const active = isActive || isExactDashboard;

  return (
    <Link
      href={href}
      className={`
        flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5
        rounded-xl text-sm font-medium
        transition-all duration-150 group relative
        ${active
          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-red-600 rounded-r-full" />
      )}
      <div className={`shrink-0 transition-transform duration-150 ${active ? "text-red-600 dark:text-red-400" : "group-hover:scale-105"}`}>
        {icon}
      </div>
      <span className="hidden lg:block truncate">{label}</span>
    </Link>
  );
}
