"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api"; // Assuming Orkiestri has a standard api client setup
import { Car, CheckCircle, Clock, Ban } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Dashboard de Reservas
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Reservas"
          value={stats.totalReservas}
          icon={<Clock className="w-5 h-5 text-red-500" />}
          description="Neste mês"
        />
        <StatCard
          title="Veículos Disponíveis"
          value={stats.disponiveis}
          icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
          description="Agora"
        />
        <StatCard
          title="Em Uso (Ativas)"
          value={stats.ativas}
          icon={<Car className="w-5 h-5 text-indigo-500" />}
          description="Neste momento"
        />
        <StatCard
          title="Em Manutenção"
          value={stats.manutencao}
          icon={<Ban className="w-5 h-5 text-rose-500" />}
          description="Indisponíveis"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="p-6 pb-2">
            <h3 className="font-semibold text-lg">Próximas Reservas</h3>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4 mt-4">
              {proximas.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma reserva futura agendada.</p>
              )}
              {proximas.map(reserva => (
                <div key={reserva.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <Car className="text-red-600 dark:text-red-400 w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {reserva.veiculo?.modelo} ({reserva.veiculo?.placa})
                      </p>
                      <p className="text-sm text-slate-500">{reserva.titulo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(reserva.dataInicio))}
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{reserva.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <div className="p-6 pb-2">
            <h3 className="font-semibold text-lg">Utilização da Frota</h3>
          </div>
          <div className="p-6 pt-0 flex items-center justify-center h-48 text-slate-400">
            [Gráfico de Utilização]
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description }: any) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 hover:shadow-xl transition-shadow">
      <div className="p-6 pb-2 flex flex-row items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm">{icon}</div>
      </div>
      <div className="p-6 pt-0">
        <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  );
}
