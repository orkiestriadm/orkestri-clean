"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { BarChart3, TrendingUp, Car, Clock, Download } from "lucide-react";

export default function RelatoriosReservas() {
  const [stats, setStats] = useState({
    totalReservas: 0,
    mediaHorasPorReserva: 0,
    veiculoMaisUsado: "-",
    reservasCanceladas: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRelatorios();
  }, []);

  const loadRelatorios = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/frota/reservas");
      
      const totais = data.length;
      const canceladas = data.filter((r: any) => r.status === 'CANCELADA').length;
      
      // Cálculo básico de estatísticas
      setStats({
        totalReservas: totais,
        mediaHorasPorReserva: 4.5, // Mockado por enquanto
        veiculoMaisUsado: "Toyota Corolla (ABC-1234)", // Mockado por enquanto
        reservasCanceladas: canceladas,
      });

    } catch (e) {
      console.error("Erro ao carregar relatórios", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios de Utilização</h1>
          <p className="text-slate-500 text-sm mt-1">Acompanhe métricas e estatísticas do uso da frota.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Reservas" value={stats.totalReservas} icon={<BarChart3 className="w-5 h-5 text-blue-500" />} />
        <StatCard title="Média de Horas/Reserva" value={`${stats.mediaHorasPorReserva}h`} icon={<Clock className="w-5 h-5 text-emerald-500" />} />
        <StatCard title="Veículo Mais Usado" value={stats.veiculoMaisUsado} icon={<Car className="w-5 h-5 text-indigo-500" />} />
        <StatCard title="Reservas Canceladas" value={stats.reservasCanceladas} icon={<TrendingUp className="w-5 h-5 text-rose-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Uso por Categoria de Veículo</h3>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-slate-400">
            [Gráfico de Pizza]
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg bg-white dark:bg-slate-900">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Reservas ao Longo do Mês</h3>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-slate-400">
            [Gráfico de Barras]
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
      <div className="p-6 pb-2 flex flex-row items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">{icon}</div>
      </div>
      <div className="p-6 pt-0 mt-2">
        <div className="text-2xl font-bold text-slate-900 dark:text-white truncate" title={String(value)}>{value}</div>
      </div>
    </div>
  );
}
