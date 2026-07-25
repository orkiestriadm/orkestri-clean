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
      const getArray = (d: any) => {
        if (Array.isArray(d)) return d;
        if (d?.linhas && Array.isArray(d.linhas)) return d.linhas;
        if (d?.data && Array.isArray(d.data)) return d.data;
        if (d?.items && Array.isArray(d.items)) return d.items;
        return [];
      };
      const reservasArr = getArray(data);
      
      const totais = reservasArr.length;
      const canceladas = reservasArr.filter((r: any) => r.status === 'CANCELADA').length;
      
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-o tracking-tight">Relatórios de Utilização</h1>
            <p className="text-muted-o text-sm mt-0.5">Acompanhe métricas e estatísticas do uso da frota.</p>
          </div>
        </div>
        <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-red-600/20">
          <Download className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Reservas" value={stats.totalReservas} icon={<BarChart3 className="w-5 h-5 text-red-500" />} />
        <StatCard title="Média de Horas/Reserva" value={`${stats.mediaHorasPorReserva}h`} icon={<Clock className="w-5 h-5 text-emerald-500" />} />
        <StatCard title="Veículo Mais Usado" value={stats.veiculoMaisUsado} icon={<Car className="w-5 h-5 accent-text" />} />
        <StatCard title="Reservas Canceladas" value={stats.reservasCanceladas} icon={<TrendingUp className="w-5 h-5 text-rose-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="rounded-2xl border border-subtle-o shadow-sm hover:shadow-md transition-shadow surface-card">
          <div className="p-6 border-b border-subtle-o">
            <h3 className="font-bold text-lg text-primary-o">Uso por Categoria de Veículo</h3>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-muted-o">
            [Gráfico de Pizza]
          </div>
        </div>

        <div className="rounded-2xl border border-subtle-o shadow-sm hover:shadow-md transition-shadow surface-card">
          <div className="p-6 border-b border-subtle-o">
            <h3 className="font-bold text-lg text-primary-o">Reservas ao Longo do Mês</h3>
          </div>
          <div className="p-6 h-64 flex items-center justify-center text-muted-o">
            [Gráfico de Barras]
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: any) {
  return (
    <div className="kpi-card" style={{ padding: 18 }}>
      <span className="kpi-card__halo" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 className="mono-cap">{title}</h3>
        <span className="kpi-card__icon" style={{ width: 38, height: 38 }}>{icon}</span>
      </div>
      <div className="metric" style={{ fontSize: 29, marginTop: 12, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={String(value)}>
        {value}
      </div>
    </div>
  );
}
