"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Car, Search, Filter, MoreVertical, Calendar as CalendarIcon, MapPin, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

export default function ListaReservas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservas();
  }, []);

  const loadReservas = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/frota/reservas");
      setReservas(data.map((r: any) => ({
        id: r.id,
        titulo: r.titulo,
        veiculo: r.veiculo ? `${r.veiculo.modelo} (${r.veiculo.placa})` : "Veículo Desconhecido",
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        destino: r.destino,
        status: r.status,
        criadoEm: r.createdAt || r.dataInicio // Fallback se não vier createdAt
      })));
    } catch (e) {
      console.error("Erro ao carregar lista de reservas", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredReservas = reservas.filter(r => 
    r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.veiculo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "CONFIRMADA":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"><CheckCircle className="w-3.5 h-3.5"/> Confirmada</span>;
      case "SOLICITADA":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"><Clock className="w-3.5 h-3.5"/> Solicitada</span>;
      case "FINALIZADA":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"><CheckCircle className="w-3.5 h-3.5"/> Finalizada</span>;
      case "CANCELADA":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><XCircle className="w-3.5 h-3.5"/> Cancelada</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{status}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minhas Reservas</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie suas solicitações e histórico de uso.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por título ou veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              <Filter className="w-4 h-4" /> Filtros
            </button>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Reserva</th>
                <th className="px-6 py-4 font-medium">Veículo</th>
                <th className="px-6 py-4 font-medium">Período</th>
                <th className="px-6 py-4 font-medium">Destino</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredReservas.map(reserva => (
                <tr key={reserva.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{reserva.titulo}</div>
                    <div className="text-xs text-slate-500 flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" /> Criado em {reserva.criadoEm}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-3 border border-slate-200 dark:border-slate-700">
                        <Car className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{reserva.veiculo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                      <div>
                        <div>{formatDate(reserva.dataInicio)}</div>
                        <div className="text-slate-400 text-xs mt-0.5">até {formatDate(reserva.dataFim)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-slate-600 dark:text-slate-400">
                      <MapPin className="w-4 h-4 mr-2 opacity-70 text-rose-500" />
                      {reserva.destino}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(reserva.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredReservas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                      <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhuma reserva encontrada</p>
                      <p className="text-sm">Tente ajustar seus filtros de busca.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
