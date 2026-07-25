"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Car, CheckCircle, Clock, Ban, Calendar, Filter } from "lucide-react";

export default function ReservasDashboard() {
  const [stats, setStats] = useState({
    totalReservas: 0,
    ativas: 0,
    disponiveis: 0,
    manutencao: 0,
  });

  const [loading, setLoading] = useState(true);
  const [proximas, setProximas] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [resReservas, resVeiculos] = await Promise.all([
        api.get("/frota/reservas"),
        api.get("/frota/veiculos")
      ]);

      const getArray = (d: any) => {
        if (Array.isArray(d)) return d;
        if (d?.linhas && Array.isArray(d.linhas)) return d.linhas;
        if (d?.data && Array.isArray(d.data)) return d.data;
        if (d?.items && Array.isArray(d.items)) return d.items;
        return [];
      };

      const reservas = getArray(resReservas.data);
      const veiculos = getArray(resVeiculos.data);

      const ativas = reservas.filter((r: any) => r.status === 'EM_ANDAMENTO').length;
      const manutencao = veiculos.filter((v: any) => v.status === 'Manutenção').length;
      const veiculosDisponiveis = veiculos.length - ativas - manutencao;

      setStats({
        totalReservas: reservas.length,
        ativas,
        disponiveis: veiculosDisponiveis > 0 ? veiculosDisponiveis : 0,
        manutencao,
      });

      // Pega apenas as próximas (ordenadas por dataInicio > agora)
      const agora = new Date();
      const futuras = reservas
        .filter((r: any) => new Date(r.dataInicio) >= agora && r.status === 'CONFIRMADA')
        .sort((a: any, b: any) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
        .slice(0, 3);
      
      setProximas(futuras);
    } catch (e) {
      console.error("Erro ao carregar dashboard", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <Calendar className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-primary-o tracking-tight">
              Dashboard de Reservas
            </h1>
            <p className="text-sm font-medium text-muted-o mt-0.5">
              Visão geral e status da agenda de veículos
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 surface-card border border-subtle-o rounded-xl text-sm font-semibold text-secondary-o hover-surface hover:text-primary-o transition-all shadow-sm">
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="Total de Reservas"
          value={stats.totalReservas}
          icon={<Clock className="w-6 h-6 text-red-500" />}
          textClass="text-red-500"
          bgClass="bg-red-50 dark:bg-red-500/10"
        />
        <StatCard
          title="Veículos Disponíveis"
          value={stats.disponiveis}
          icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
          textClass="text-emerald-500"
          bgClass="bg-emerald-50 dark:bg-emerald-500/10"
        />
        <StatCard
          title="Em Uso (Ativas)"
          value={stats.ativas}
          icon={<Car className="w-6 h-6 accent-text" />}
          textClass="accent-text"
          bgClass="accent-soft"
        />
        <StatCard
          title="Em Manutenção"
          value={stats.manutencao}
          icon={<Ban className="w-6 h-6 text-orange-500" />}
          textClass="text-orange-500"
          bgClass="bg-orange-50 dark:bg-orange-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-2xl border border-subtle-o shadow-sm surface-card overflow-hidden flex flex-col">
          <div className="p-6 border-b border-subtle-o/50 surface-sunken">
            <h3 className="font-bold text-primary-o">Próximas Reservas</h3>
          </div>
          <div className="p-6 flex-1">
            <div className="space-y-4">
              {proximas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="w-10 h-10 text-faint-o mb-3" />
                  <p className="text-sm font-medium text-muted-o">Nenhuma reserva futura agendada.</p>
                </div>
              )}
              {proximas.map(reserva => (
                <div key={reserva.id} className="group flex justify-between items-center p-4 surface-sunken hover-surface rounded-xl transition-colors border border-transparent hover:border-subtle-o">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full surface-card shadow-sm border border-subtle-o flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Car className="text-red-600 dark:text-red-400 w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-primary-o">
                        {reserva.veiculo?.modelo} <span className="text-muted-o font-medium">({reserva.veiculo?.placa})</span>
                      </p>
                      <p className="text-sm font-medium text-muted-o">{reserva.motivo || reserva.titulo || "Reserva"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary-o">
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(reserva.dataInicio))}
                    </p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-wide uppercase">{reserva.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-subtle-o shadow-sm surface-card overflow-hidden flex flex-col">
          <div className="p-6 border-b border-subtle-o/50 surface-sunken">
            <h3 className="font-bold text-primary-o">Utilização da Frota</h3>
          </div>
          <div className="p-6 flex-1 flex items-center justify-center min-h-[250px]">
             <div className="flex flex-col items-center justify-center text-center">
                  <Clock className="w-10 h-10 text-faint-o mb-3" />
                  <p className="text-sm font-medium text-muted-o">Gráfico em desenvolvimento.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, bgClass, textClass }: any) {
  return (
    <div className="kpi-card" style={{ padding: 18 }}>
      <span className="kpi-card__halo" />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className={`kpi-card__icon ${bgClass || ""}`} style={{ width: 46, height: 46 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div className={`metric kpi-card__value ${textClass || ""}`} style={{ fontSize: 25 }}>{value}</div>
          <div className="kpi-card__label" style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        </div>
      </div>
    </div>
  );
}
