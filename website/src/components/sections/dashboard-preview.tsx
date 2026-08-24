import {
  LayoutDashboard,
  Headset,
  KanbanSquare,
  Truck,
  Wallet,
  Activity,
  Search,
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Headset, label: "Desk" },
  { icon: KanbanSquare, label: "Projects" },
  { icon: Truck, label: "Fleet" },
  { icon: Wallet, label: "Finance" },
  { icon: Activity, label: "Observe" },
];

const kpis = [
  { label: "Chamados abertos", value: "128", trend: "-12%", good: true },
  { label: "SLA no prazo", value: "98,4%", trend: "+2,1%", good: true },
  { label: "Projetos ativos", value: "34", trend: "+5", good: true },
];

const bars = [42, 68, 55, 80, 62, 90, 74];

/**
 * Abstract preview of the Orkiestri One platform.
 * Placeholder for a real product screenshot (doc 07 — Dashboard Preview).
 */
export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[--radius-image] border border-gray-200 bg-white shadow-soft-lg">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-gray-200" />
        <span className="h-3 w-3 rounded-full bg-gray-200" />
        <span className="h-3 w-3 rounded-full bg-gray-200" />
        <div className="ml-3 flex flex-1 items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-400">
          <Search className="h-3.5 w-3.5" aria-hidden />
          Buscar em toda a plataforma…
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-40 shrink-0 flex-col gap-1 border-r border-gray-100 p-3 sm:flex">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium ${
                  item.active
                    ? "bg-primary-soft text-primary-hover"
                    : "text-gray-500"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </div>
            );
          })}
        </div>

        {/* Main */}
        <div className="flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-dark">Overview</div>
              <div className="text-xs text-gray-400">Operação · hoje</div>
            </div>
            <div className="rounded-lg bg-dark px-3 py-1.5 text-xs font-medium text-white">
              Exportar
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-gray-100 bg-white p-3"
              >
                <div className="truncate text-[0.6875rem] text-gray-400">
                  {k.label}
                </div>
                <div className="mt-1 text-lg font-bold text-dark">
                  {k.value}
                </div>
                <div className="mt-0.5 text-[0.6875rem] font-medium text-success">
                  {k.trend}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="mt-3 rounded-xl border border-gray-100 p-4">
            <div className="mb-3 text-xs font-medium text-gray-500">
              Volume por dia
            </div>
            <div className="flex h-24 items-end gap-2">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-primary/70 to-primary"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
