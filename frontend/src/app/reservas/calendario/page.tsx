"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import {
  Plus, Search, Calendar as CalendarIcon, Car, ChevronLeft, ChevronRight,
  Clock, Printer, Eye, Filter, X
} from "lucide-react";
import ReservaModal from "../components/ReservaModal";

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

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState<Date | undefined>();
  const [modalEnd, setModalEnd] = useState<Date | undefined>();

  const today = useMemo(() => new Date(), []);

  /* ── data loading ── */
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resR, resV] = await Promise.all([
        api.get("/frota/reservas"),
        api.get("/frota/veiculos"),
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
        titulo: d.title,
        descricao: d.descricao,
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

  const openNewReserva = (start?: Date) => {
    const s = start || new Date();
    const e = new Date(s.getTime() + 2 * 60 * 60 * 1000);
    setModalStart(s);
    setModalEnd(e);
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
    if (s === "FINALIZADA") return "bg-slate-400";
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
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full -m-2 md:-m-4">
      {/* ── TOP HEADER ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Agenda</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500">eventos e compromissos</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Disponibilidade */}
          <button className="hidden md:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Eye className="w-4 h-4" /> Disponibilidade
          </button>
          {/* Print */}
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Printer className="w-4 h-4" />
          </button>
          {/* Novo evento */}
          <button
            onClick={() => openNewReserva()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo evento
          </button>
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Search className="w-4 h-4" /> Buscar
            </button>
            {searchOpen && (
              <div className="absolute right-0 top-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 w-72 z-50">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar evento..."
                    className="flex-1 text-sm bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchTerm(""); }}>
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Filter */}
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden bg-white dark:bg-slate-950">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-44 lg:w-52 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto hidden md:flex">
          {/* Mini calendar */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAYS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 py-1">
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
                      ${cell.current ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" : "text-slate-300 dark:text-slate-600"}
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
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex-1">
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              <CalendarIcon className="w-3.5 h-3.5 text-red-500" />
              Próximos Eventos
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhum evento próximo</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="group cursor-pointer">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusColor(ev.status)}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                          {ev.veiculoPlaca ? `${ev.veiculoPlaca} — ` : ""}{ev.title}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
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
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-slate-500" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                {MONTHS[month]} {year}
                <CalendarIcon className="w-4 h-4 text-slate-400" />
              </h2>
              <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* View toggles */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md transition-colors">
                Hoje
              </button>
              {(["month", "week", "day"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    viewMode === v
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
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
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                  {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((d) => (
                    <div key={d} className="py-2.5 text-center text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
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
                          border-b border-r border-slate-100 dark:border-slate-800 p-1.5 min-h-[80px] cursor-pointer
                          hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors
                          ${!cell.current ? "bg-slate-50/50 dark:bg-slate-900/30" : ""}
                        `}
                      >
                        <div className="flex justify-between items-start">
                          <span
                            className={`
                              inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full
                              ${isToday ? "bg-red-600 text-white font-bold" : ""}
                              ${cell.current && !isToday ? "text-slate-700 dark:text-slate-300" : ""}
                              ${!cell.current ? "text-slate-300 dark:text-slate-600" : ""}
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
                              className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${statusColor(ev.status)}`}
                            >
                              {ev.veiculoPlaca ? `${ev.veiculoPlaca} ` : ""}{ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-slate-400 font-medium pl-1">
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
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
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
                    <div key={ev.id} className="flex items-center gap-4 p-3 mb-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${statusColor(ev.status)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {ev.veiculoPlaca ? `${ev.veiculoPlaca} — ` : ""}{ev.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {ev.start.toLocaleDateString("pt-BR")} • {formatTime(ev.start)} — {formatTime(ev.end)}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full text-white ${statusColor(ev.status)}`}>
                        {ev.status}
                      </span>
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
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                      Nenhum evento {viewMode === "day" ? "neste dia" : "nesta semana"}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Comece criando seu primeiro evento — clique em qualquer dia ou no botão acima.
                    </p>
                    <button
                      onClick={() => openNewReserva()}
                      className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Criar evento agora
                    </button>
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
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    Nenhum evento neste mês
                  </p>
                  <p className="text-sm text-slate-400 mt-1 text-center max-w-sm">
                    Comece criando seu primeiro evento — clique em qualquer dia ou no botão acima.
                  </p>
                  <button
                    onClick={() => openNewReserva()}
                    className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Criar evento agora
                  </button>
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
        veiculos={veiculos}
      />
    </div>
  );
}
