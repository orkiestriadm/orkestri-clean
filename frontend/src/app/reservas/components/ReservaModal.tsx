import { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, Car, MapPin, AlignLeft } from "lucide-react";
import { format } from "date-fns";

type ReservaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reserva: any) => void;
  initialStart?: Date;
  initialEnd?: Date;
  veiculos: any[]; // Veículos disponíveis
};

export default function ReservaModal({ isOpen, onClose, onSave, initialStart, initialEnd, veiculos }: ReservaModalProps) {
  const [formData, setFormData] = useState({
    veiculoId: "",
    titulo: "",
    descricao: "",
    destino: "",
    dataInicio: "",
    horaInicio: "",
    dataFim: "",
    horaFim: "",
  });

  useEffect(() => {
    if (isOpen) {
      const start = initialStart || new Date();
      const end = initialEnd || new Date(new Date().setHours(new Date().getHours() + 2));
      setFormData({
        veiculoId: "",
        titulo: "",
        descricao: "",
        destino: "",
        dataInicio: format(start, "yyyy-MM-dd"),
        horaInicio: format(start, "HH:mm"),
        dataFim: format(end, "yyyy-MM-dd"),
        horaFim: format(end, "HH:mm"),
      });
    }
  }, [isOpen, initialStart, initialEnd]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.veiculoId || !formData.titulo) {
      alert("Preencha os campos obrigatórios (Veículo e Motivo)");
      return;
    }

    const startDateTime = new Date(`${formData.dataInicio}T${formData.horaInicio}:00`);
    const endDateTime = new Date(`${formData.dataFim}T${formData.horaFim}:00`);

    if (endDateTime <= startDateTime) {
      alert("A data/hora final deve ser maior que a inicial.");
      return;
    }

    onSave({
      veiculoId: formData.veiculoId,
      title: formData.titulo,
      start: startDateTime,
      end: endDateTime,
      destino: formData.destino,
      descricao: formData.descricao,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Nova Reserva</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="reserva-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Veículo <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Car className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  value={formData.veiculoId}
                  onChange={(e) => setFormData({ ...formData, veiculoId: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                >
                  <option value="">Selecione um veículo...</option>
                  {veiculos.map(v => (
                    <option key={v.id} value={v.id}>{v.placa} - {v.modelo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Motivo / Título <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Reunião com Cliente X"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className="block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> Início
                </label>
                <input
                  type="date"
                  value={formData.dataInicio}
                  onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" /> Hora Início
                </label>
                <input
                  type="time"
                  value={formData.horaInicio}
                  onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> Fim
                </label>
                <input
                  type="date"
                  value={formData.dataFim}
                  onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" /> Hora Fim
                </label>
                <input
                  type="time"
                  value={formData.horaFim}
                  onChange={(e) => setFormData({ ...formData, horaFim: e.target.value })}
                  className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-400" /> Destino
              </label>
              <input
                type="text"
                placeholder="Ex: São Paulo, SP"
                value={formData.destino}
                onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                className="block w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <AlignLeft className="w-4 h-4 text-slate-400" /> Observações
              </label>
              <textarea
                rows={3}
                placeholder="Informações adicionais..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="block w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
              ></textarea>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="reserva-form"
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
          >
            Confirmar Reserva
          </button>
        </div>
      </div>
    </div>
  );
}
