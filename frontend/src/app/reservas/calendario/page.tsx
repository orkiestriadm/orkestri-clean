"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus, User, Car } from "lucide-react";
import ReservaModal from "../components/ReservaModal";

// Setup do Localizer do react-big-calendar para Português-BR
const locales = {
  "pt-BR": ptBR,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function CalendarioReservas() {
  const [events, setEvents] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resReservas, resVeiculos] = await Promise.all([
        api.get("/frota/reservas"),
        api.get("/frota/veiculos")
      ]);
      
      const getArray = (data: any) => {
        if (Array.isArray(data)) return data;
        if (data?.linhas && Array.isArray(data.linhas)) return data.linhas;
        if (data?.data && Array.isArray(data.data)) return data.data;
        if (data?.items && Array.isArray(data.items)) return data.items;
        return [];
      };

      const reservasArray = getArray(resReservas?.data);
      const veiculosArray = getArray(resVeiculos?.data);

      const formatedEvents = reservasArray.map((r: any) => ({
        id: r?.id || Math.random().toString(),
        title: `${r?.veiculo?.placa || ''} - ${r?.titulo || r?.motivo || 'Reserva'}`,
        start: r?.dataInicio ? new Date(r.dataInicio) : new Date(),
        end: r?.dataFim ? new Date(r.dataFim) : new Date(),
        resource: r?.veiculoId,
        status: r?.status || 'CONFIRMADA',
      }));

      setEvents(formatedEvents);
      setVeiculos(veiculosArray);
    } catch (e) {
      console.error("Erro ao carregar reservas", e);
      setEvents([]);
      setVeiculos([]);
    } finally {
      setLoading(false);
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState<Date | undefined>(undefined);
  const [modalEnd, setModalEnd] = useState<Date | undefined>(undefined);

  const eventStyleGetter = (event: any) => {
    let backgroundColor = "#dc2626"; // default red (CONFIRMADA)
    if (event.status === "EM_ANDAMENTO") backgroundColor = "#10b981"; // emerald
    if (event.status === "CANCELADA") backgroundColor = "#ef4444"; // red
    if (event.status === "FINALIZADA") backgroundColor = "#64748b"; // slate
    if (event.status === "SOLICITADA") backgroundColor = "#f59e0b"; // amber

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
        padding: "4px 8px",
        fontWeight: 500,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
    };
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    setModalStart(start);
    setModalEnd(end);
    setIsModalOpen(true);
  };

  const handleSaveReserva = async (reservaData: any) => {
    try {
      await api.post("/frota/reservas", {
        veiculoId: reservaData.veiculoId,
        titulo: reservaData.title,
        descricao: reservaData.descricao,
        destino: reservaData.destino,
        dataInicio: reservaData.start.toISOString(),
        dataFim: reservaData.end.toISOString(),
      });
      alert("Reserva criada com sucesso!");
      setIsModalOpen(false);
      loadData();
    } catch (e: any) {
      alert("Erro ao criar reserva: " + (e.response?.data?.message || e.message));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda de Reservas</h1>
          <p className="text-slate-500 text-sm mt-1">Visualize e gerencie a frota como um calendário.</p>
        </div>
        <button
          onClick={() => {
            setModalStart(new Date());
            setModalEnd(new Date(new Date().setHours(new Date().getHours() + 2)));
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-red-600/30"
        >
          <Plus className="w-5 h-5" /> Nova Reserva
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
        {/* Custom CSS overrides to make react-big-calendar look premium & modern */}
        <style dangerouslySetInnerHTML={{__html: `
          .rbc-calendar { font-family: inherit; }
          .rbc-header { padding: 12px 0; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          .dark .rbc-header { color: #94a3b8; border-color: #1e293b; }
          .rbc-today { background-color: #f0fdf4 !important; }
          .dark .rbc-today { background-color: #022c22 !important; }
          .rbc-time-content { border-top: 1px solid #e2e8f0; }
          .dark .rbc-time-content { border-color: #1e293b; }
          .rbc-time-header-content { border-left: 1px solid #e2e8f0; }
          .dark .rbc-time-header-content { border-left-color: #1e293b; }
          .rbc-day-bg { border-left: 1px solid #e2e8f0; }
          .dark .rbc-day-bg { border-color: #1e293b; }
          .rbc-timeslot-group { border-bottom: 1px solid #f1f5f9; }
          .dark .rbc-timeslot-group { border-color: #0f172a; }
          .rbc-time-slot { border-top: 1px dashed #f1f5f9; }
          .dark .rbc-time-slot { border-color: #0f172a; }
          .rbc-time-view, .rbc-month-view, .rbc-agenda-view { border-color: #e2e8f0; border-radius: 8px; overflow: hidden; }
          .dark .rbc-time-view, .dark .rbc-month-view, .dark .rbc-agenda-view { border-color: #1e293b; }
          .rbc-btn-group button { border-color: #e2e8f0; color: #475569; }
          .dark .rbc-btn-group button { border-color: #334155; color: #cbd5e1; background: #0f172a; }
          .rbc-btn-group button.rbc-active { background: #fef2f2; color: #dc2626; font-weight: 600; box-shadow: none; border-color: #fecaca; }
          .dark .rbc-btn-group button.rbc-active { background: #7f1d1d; color: #fecaca; border-color: #991b1b; }
          .rbc-event { transition: transform 0.1s; }
          .rbc-event:hover { transform: scale(1.02); z-index: 50 !important; }
        `}} />
        <Calendar
          culture="pt-BR"
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          view={view}
          onView={(newView) => setView(newView)}
          date={date}
          onNavigate={(newDate) => setDate(newDate)}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => alert("Detalhes da reserva: " + event.title)}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: "Próximo",
            previous: "Anterior",
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
            agenda: "Agenda",
            date: "Data",
            time: "Hora",
            event: "Reserva",
            noEventsInRange: "Não há reservas neste período.",
          }}
          components={{
            event: ({ event }) => (
              <div className="flex items-center text-sm truncate">
                <Car className="w-3 h-3 mr-1 opacity-75" />
                <span className="truncate">{event.title}</span>
              </div>
            ),
          }}
        />
      </div>

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
