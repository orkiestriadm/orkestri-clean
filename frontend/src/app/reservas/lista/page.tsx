"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Car, Search, Filter, MoreVertical, Calendar as CalendarIcon, MapPin, CheckCircle, Clock, XCircle, AlertCircle, Eye } from "lucide-react";

export default function ListaReservas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  
  const canCancel = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("reservas:cancelar");

  useEffect(() => {
    loadReservas();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const loadReservas = async () => {
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
      const rawReservas = getArray(data);
      setReservas(rawReservas.map((r: any) => ({
        id: r.id,
        titulo: r.titulo || r.motivo || 'Sem título',
        veiculo: r.veiculo ? `${r.veiculo.modelo} (${r.veiculo.placa})` : "Veículo Desconhecido",
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        destino: r.destino || '-',
        status: r.status,
        criadoEm: r.createdAt || r.dataInicio
      })));
    } catch (e) {
      console.error("Erro ao carregar lista de reservas", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReserva = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return;
    try {
      await api.patch(`/frota/reservas/${id}`, { status: "CANCELADA" });
      setReservas(prev => prev.map(r => r.id === id ? { ...r, status: "CANCELADA" } : r));
    } catch (e) {
      console.error("Erro ao cancelar reserva", e);
      alert("Erro ao cancelar reserva. Tente novamente.");
    }
    setOpenMenuId(null);
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
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium surface-sunken text-secondary-o   border border-subtle-o "><CheckCircle className="w-3.5 h-3.5"/> Finalizada</span>;
      case "CANCELADA":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800"><XCircle className="w-3.5 h-3.5"/> Cancelada</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium surface-sunken text-secondary-o   border border-subtle-o ">{status}</span>;
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
    <div className="flex flex-col min-h-full w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <CalendarIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-o tracking-tight">Minhas Reservas</h1>
            <p className="text-muted-o text-sm mt-0.5">Gerencie suas solicitações e histórico de uso.</p>
          </div>
        </div>
      </div>

      <div className="surface-card rounded-2xl shadow-sm border border-subtle-o overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        {/* Toolbar */}
        <div className="p-5 border-b border-subtle-o flex flex-col sm:flex-row gap-4 justify-between items-center surface-sunken/50 /30">
          <div className="relative w-full sm:w-[400px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-o" />
            </div>
            <input
              type="text"
              placeholder="Buscar por título ou veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-subtle-o  rounded-xl surface-card text-primary-o focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-sm transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 border border-subtle-o  rounded-xl text-sm font-semibold text-secondary-o hover-surface transition-all shadow-sm hover:shadow">
              <Filter className="w-4 h-4" /> Filtros
            </button>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="surface-sunken/80 surface-sunken text-muted-o border-b border-subtle-o">
              <tr>
                <th className="px-6 py-4 font-semibold">Reserva</th>
                <th className="px-6 py-4 font-semibold">Veículo</th>
                <th className="px-6 py-4 font-semibold">Período</th>
                <th className="px-6 py-4 font-semibold">Destino</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle-o/50">
              {filteredReservas.map(reserva => (
                <tr key={reserva.id} className="hover-surface transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-primary-o">{reserva.titulo}</div>
                    <div className="text-xs text-muted-o flex items-center mt-1">
                      <Clock className="w-3 h-3 mr-1" /> Criado em {reserva.criadoEm}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded surface-sunken flex items-center justify-center mr-3 border border-subtle-o ">
                        <Car className="w-4 h-4 text-muted-o" />
                      </div>
                      <span className="font-medium text-secondary-o">{reserva.veiculo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-secondary-o">
                      <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                      <div>
                        <div>{formatDate(reserva.dataInicio)}</div>
                        <div className="text-muted-o text-xs mt-0.5">até {formatDate(reserva.dataFim)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-secondary-o">
                      <MapPin className="w-4 h-4 mr-2 opacity-70 text-rose-500" />
                      {reserva.destino}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(reserva.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block" ref={openMenuId === reserva.id ? menuRef : undefined}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === reserva.id ? null : reserva.id)}
                        className="p-2 text-muted-o hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {openMenuId === reserva.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 surface-card border border-subtle-o  rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                          <button
                            onClick={() => {
                              alert(`Detalhes da reserva: ${reserva.titulo}\nVeículo: ${reserva.veiculo}\nPeríodo: ${formatDate(reserva.dataInicio)} até ${formatDate(reserva.dataFim)}\nDestino: ${reserva.destino}\nStatus: ${reserva.status}`);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-secondary-o hover-surface transition-colors"
                          >
                            <Eye className="w-4 h-4 text-muted-o" />
                            Ver detalhes
                          </button>
                          {canCancel && reserva.status !== "CANCELADA" && reserva.status !== "FINALIZADA" && (
                            <button
                              onClick={() => handleCancelReserva(reserva.id)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancelar reserva
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredReservas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-o">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle className="w-12 h-12 text-faint-o mb-3" />
                      <p className="text-lg font-medium text-primary-o">Nenhuma reserva encontrada</p>
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
