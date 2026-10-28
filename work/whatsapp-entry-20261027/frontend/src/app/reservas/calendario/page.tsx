"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import {
  Plus, Search, Calendar as CalendarIcon, Car, ChevronLeft, ChevronRight,
  Clock, Printer, Eye, Filter, X
} from "lucide-react";
import ReservaModal from "../components/ReservaModal";
import { useAuthStore } from "@/lib/store";

/* ── helpers ── */
const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

type ViewMode = "month" | "week" | "day";

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  veiculoPlaca?: string;
};

const getArray = (data: any) => {
  if (Array.isArray(data)) return data;
  if (data?.linhas && Array.isArray(data.linhas)) return data.linhas;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  return [];
};

/* ══════════════════════════════════════════════════════════════════════ */

export default function CalendarioReservas() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuthStore();
  const canReserve = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("reservas:criar");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState<Date | undefined>();
  const [modalEnd, setModalEnd] = useState<Date | undefined>();
  const [modalInitialVeiculo, setModalInitialVeiculo] = useState<string>("");

  const today = useMemo(() => new Date(), []);

  /* ── data loading ── */
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resR, resV] = await Promise.all([
        api.get("/frota/reservas?limit=1000"),
        api.get("/frota/veiculos?limit=1000"),
      ]);
      const reservasArr = getArray(resR?.data);
      const veiculosArr = getArray(resV?.data);

      setEvents(
        reservasArr.map((r: any) => ({
          id: r?.id || String(Math.random()),
          title: r?.titulo || r?.motivo || "Reserva",
          start: r?.dataInicio ? new Date(r.dataInicio) : new Date(),
          end: r?.dataFim ? new Date(r.dataFim) : new Date(),
          status: r?.status || "CONFIRMADA",
          veiculoPlaca: r?.veiculo?.placa || "",
        }))
      );
      setVeiculos(veiculosArr);
      
      const searchParams = new URLSearchParams(window.location.search);
      const vId = searchParams.get("veiculo");
      if (vId) {
        setModalInitialVeiculo(vId);
        setIsModalOpen(true);
      }
    } catch {
      setEvents([]);
      setVeiculos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReserva = async (d: any) => {
    try {
      await api.post("/frota/reservas", {
        veiculoId: d.veiculoId,
        motivo: d.title,
        observacoes: d.descricao,
        destino: d.destino,
        dataInicio: d.start.toISOString(),
        dataFim: d.end.toISOString(),
      });
      alert("Reserva criada com sucesso!");
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      alert("Erro ao criar reserva: " + (e.response?.data?.message || e.message));
    }
  };

  const openNewReserva = (start?: Date, veiculoId?: string) => {
    const s = start || new Date();
    const e = new Date(s.getTime() + 2 * 60 * 60 * 1000);
    setModalStart(s);
    setModalEnd(e);
    if (veiculoId) setModalInitialVeiculo(veiculoId);
    setIsModalOpen(true);
  };

  /* ── navigation ── */
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  /* ── upcoming events ── */
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => e.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5);
  }, [events]);

  /* ── events for current month ── */
  const eventsInMonth = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    return events.filter((e) => {
      const es = e.start;
      return es.getFullYear() === y && es.getMonth() === m;
    });
  }, [events, viewDate]);

  const eventsForDay = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return events.filter((e) => isSameDay(e.start, d));
  };

  /* ── status color ── */
  const statusColor = (s: string) => {
    if (s === "CONFIRMADA") return "bg-red-500";
    if (s === "EM_ANDAMENTO") return "bg-emerald-500";
    if (s === "SOLICITADA") return "bg-amber-500";
    if (s === "FINALIZADA") return "bg-[var(--text-muted)]";
    if (s === "CANCELADA") return "bg-rose-400";
    return "bg-red-500";
  };

  /* ── mini calendar grid ── */
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const calendarCells: { day: number; current: boolean }[] = [];
  // previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, current: false });
  }
  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, current: true });
  }
  // next month fill
  const remaining = 7 - (calendarCells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calendarCells.push({ day: i, current: false });
    }
  }

  /* ── main calendar grid (month view) ── */
  const mainGridCells = [...calendarCells];

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const formatDateShort = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full -m-2 md:-m-4 animate-in fade-in duration-500">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-subtle-o surface-card gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
            <CalendarIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-primary-o tracking-tight">Agenda</h1>
            <p className="text-sm font-medium text-muted-o mt-0.5">Visão geral dos eventos e compromissos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Disponibilidade */}
          <button className="hidden md:flex items-center gap-2 px-4 py-2 surface-card border border-subtle-o rounded-xl text-sm font-semibold text-secondary-o hover-surface hover:text-primary-o transition-all shadow-sm">
            <Eye className="w-4 h-4" /> Disponibilidade
          </button>
          {/* Print */}
          <button className="p-2 text-muted-o hover:text-secondary-o dark:hover:text-primary-o border border-subtle-o rounded-xl hover-surface transition-all shadow-sm">
            <Printer className="w-4 h-4" />
          </button>
          {/* Novo evento */}
          {canReserve && (
            <button
              onClick={() => openNewReserva()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" /> Novo evento
            </button>
          )}
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex items-center gap-2 px-4 py-2 surface-card border border-subtle-o rounded-xl text-sm font-semibold text-secondary-o hover-surface hover:text-primary-o transition-all shadow-sm"
            >
              <Search className="w-4 h-4" /> Buscar
            </button>
            {searchOpen && (
              <div className="absolute right-0 top-14 surface-card border border-subtle-o rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none p-3 w-80 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-muted-o shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar evento por título ou veículo..."
                    className="flex-1 text-sm bg-transparent outline-none text-primary-o placeholder:text-muted-o font-medium"
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchTerm(""); }}>
                    <X className="w-4 h-4 text-muted-o hover:text-secondary-o" />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Filter */}
          <button className="p-2 text-muted-o hover:text-secondary-o dark:hover:text-primary-o border border-subtle-o  rounded-lg hover-surface transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden surface-card">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-44 lg:w-52 flex-shrink-0 border-r border-subtle-o flex flex-col overflow-y-auto hidden md:flex">
          {/* Mini calendar */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 hover-surface rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-muted-o" />
              </button>
              <span className="text-sm font-semibold text-secondary-o">
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1 hover-surface rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-muted-o" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAYS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-o py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0">
              {calendarCells.map((cell, i) => {
                const isToday = cell.current && isSameDay(new Date(year, month, cell.day), today);
                const hasEvents = cell.current && eventsForDay(cell.day).length > 0;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (cell.current) {
                        setViewDate(new Date(year, month, cell.day));
                        setViewMode("day");
                      }
                    }}
                    className={`
                      relative w-full aspect-square flex items-center justify-center text-xs rounded-full transition-all
                      ${cell.current ? "text-secondary-o hover-surface" : "text-faint-o"}
                      ${isToday ? "bg-red-600 text-white hover:bg-red-700 font-bold" : ""}
                    `}
                  >
                    {cell.day}
                    {hasEvents && !isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-red-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Próximos Eventos */}
          <div className="border-t border-subtle-o p-4 flex-1">
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-o mb-3">
              <CalendarIcon className="w-3.5 h-3.5 text-red-500" />
              Próximos Eventos
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-muted-o italic">Nenhum evento próximo</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="group cursor-pointer">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColor(ev.status)}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-secondary-o truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {ev.veiculoPlaca ? `${ev.veiculoPlaca} — ` : ""}{ev.title}
                        </p>
                        <p className="text-[10px] text-muted-o">
                          {formatDateShort(ev.start)} • {formatTime(ev.start)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CALENDAR ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle-o">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-1.5 hover-surface rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-muted-o" />
              </button>
              <h2 className="text-lg font-bold text-primary-o dark:text-white flex items-center gap-2">
                {MONTHS[month]} {year}
                <CalendarIcon className="w-4 h-4 text-muted-o" />
              </h2>
              <button onClick={nextMonth} className="p-1.5 hover-surface rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-muted-o" />
              </button>
            </div>

            {/* View toggles */}
            <div className="flex items-center surface-sunken rounded-lg p-0.5">
              <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-secondary-o  hover:text-primary-o rounded-md transition-colors">
                Hoje
              </button>
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                    viewMode === v
                      ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                      : "text-muted-o hover:text-primary-o dark:hover:text-primary-o hover:bg-slate-200 "
                  }`}
                >
                  {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-y-auto relative">
            {viewMode === "month" && (
              <div className="h-full flex flex-col">
                {/* Day of week headers */}
                <div className="grid grid-cols-7 border-b border-subtle-o">
                  {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((d) => (
                    <div key={d} className="py-2.5 text-center text-[11px] font-semibold tracking-wider text-muted-o">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                  {mainGridCells.map((cell, i) => {
                    const isToday = cell.current && isSameDay(new Date(year, month, cell.day), today);
                    const dayEvents = cell.current ? eventsForDay(cell.day) : [];
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (cell.current) {
                            openNewReserva(new Date(year, month, cell.day, 9, 0));
                          }
                        }}
                        className={`
                          group border-b border-r border-subtle-o/60 p-2 min-h-[90px] cursor-pointer
                          hover:bg-white dark:hover:bg-slate-900 transition-all hover:shadow-[inset_0_0_15px_rgba(0,0,0,0.03)] dark:hover:shadow-[inset_0_0_15px_rgba(255,255,255,0.02)]
                          ${!cell.current ? "surface-sunken/50 /50" : "bg-transparent"}
                        `}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className={`
                              inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-transform
                              ${isToday ? "bg-red-600 text-white font-bold shadow-md shadow-red-500/30 scale-110" : ""}
                              ${cell.current && !isToday ? "text-secondary-o hover:bg-slate-200 " : ""}
                              ${!cell.current ? "text-faint-o" : ""}
                            `}
                          >
                            {cell.day}
                          </span>
                        </div>
                        {/* Events in day */}
                        <div className="mt-1 space-y-0.5">
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              onClick={(e) => { e.stopPropagation(); alert(`${ev.title}\n${formatTime(ev.start)} - ${formatTime(ev.end)}\nStatus: ${ev.status}`); }}
                              className={`text-[10px] font-medium text-white px-2 py-0.5 rounded-md shadow-sm truncate cursor-pointer hover:scale-[1.02] hover:shadow-md hover:brightness-110 transition-all ring-1 ring-black/5 ${statusColor(ev.status)}`}
                            >
                              {ev.veiculoPlaca ? `${ev.veiculoPlaca} ` : ""}{ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-muted-o font-medium pl-1">
                              +{dayEvents.length - 2} mais
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* WEEK / DAY — simplified view */}
            {(viewMode === "week" || viewMode === "day") && (
              <div className="p-6">
                <p className="text-sm text-muted-o mb-4">
                  {viewMode === "week" ? "Semana de" : "Dia"}{" "}
                  {viewDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
                {events
                  .filter((e) => {
                    if (viewMode === "day") return isSameDay(e.start, viewDate);
                    const start = new Date(viewDate);
                    start.setDate(start.getDate() - start.getDay());
                    const end = new Date(start);
                    end.setDate(end.getDate() + 7);
                    return e.start >= start && e.start < end;
                  })
                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                  .map((ev) => (
                    <div key={ev.id} className="group flex items-start gap-3 p-2.5 mb-2 surface-card rounded-xl border border-subtle-o shadow-sm hover:shadow-md hover:border-red-200 dark:hover:border-red-900/50 transition-all">
                      <div className="flex flex-col items-center mt-1">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${statusColor(ev.status)} ring-[3px] ring-white dark:ring-slate-950 z-10`} />
                        <div className="w-0.5 h-7 surface-sunken -my-0.5 -z-0 group-last:hidden" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-sm font-bold text-primary-o dark:text-white truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {ev.veiculoPlaca ? `${ev.veiculoPlaca} — ` : ""}{ev.title}
                          </p>
                          <span className={`text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded text-white shadow-sm ${statusColor(ev.status)}`}>
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-muted-o flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-o" />
                          {ev.start.toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: 'short' })} • {formatTime(ev.start)} às {formatTime(ev.end)}
                        </p>
                      </div>
                    </div>
                  ))}
                {events.filter((e) => {
                  if (viewMode === "day") return isSameDay(e.start, viewDate);
                  const start = new Date(viewDate);
                  start.setDate(start.getDate() - start.getDay());
                  const end = new Date(start);
                  end.setDate(end.getDate() + 7);
                  return e.start >= start && e.start < end;
                }).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
                      <CalendarIcon className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-base font-semibold text-secondary-o ">
                      Nenhum evento {viewMode === "day" ? "neste dia" : "nesta semana"}
                    </p>
                    <p className="text-sm text-muted-o mt-1">
                      {canReserve ? "Comece criando seu primeiro evento — clique em qualquer dia ou no botão acima." : ""}
                    </p>
                    {canReserve && (
                      <button
                        onClick={() => openNewReserva()}
                        className="mt-5 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/20 hover:shadow-lg hover:-translate-y-0.5"
                      >
                        <Plus className="w-5 h-5" /> Criar evento agora
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty state for month view */}
            {viewMode === "month" && eventsInMonth.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "50%", transform: "translateY(-30%)" }}>
                <div className="pointer-events-auto flex flex-col items-center">
                  <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-5">
                    <CalendarIcon className="w-10 h-10 text-red-400" />
                  </div>
                  <p className="text-lg font-bold text-secondary-o ">
                    Nenhum evento neste mês
                  </p>
                  <p className="text-sm text-muted-o mt-1 text-center max-w-sm">
                    {canReserve ? "Comece criando seu primeiro evento — clique em qualquer dia ou no botão acima." : ""}
                  </p>
                  {canReserve && (
                    <button
                      onClick={() => openNewReserva()}
                      className="mt-6 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-600/20 hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <Plus className="w-5 h-5" /> Criar evento agora
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL ── */}
      <ReservaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveReserva}
        initialStart={modalStart}
        initialEnd={modalEnd}
        initialVeiculoId={modalInitialVeiculo}
        veiculos={veiculos}
      />
    </div>
  );
}
