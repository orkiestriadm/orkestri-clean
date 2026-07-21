"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Search, Filter, Car, Tag, MapPin, Gauge } from "lucide-react";

export default function VeiculosDisponiveis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVeiculos();
  }, []);

  const loadVeiculos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/frota/veiculos");
      // Formata ou salva os veículos reais retornados
      setVeiculos(data.linhas || data || []);
    } catch (e) {
      console.error("Erro ao carregar lista de veículos", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredVeiculos = veiculos.filter(v => 
    (v.placa && v.placa.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (v.modelo && v.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (v.categoria && v.categoria.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    if (status === "Livre") return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Livre</span>;
    if (status === "Em Uso") return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">Em Uso</span>;
    if (status === "Manutenção") return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800">Manutenção</span>;
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{status}</span>;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Veículos Disponíveis</h1>
          <p className="text-slate-500 text-sm mt-1">Consulte o catálogo da frota para reservas.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por placa, modelo ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVeiculos.map(veiculo => (
          <div key={veiculo.id} className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col">
            <div className="h-40 bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 relative">
              {veiculo.imagem ? (
                <img src={veiculo.imagem} alt={veiculo.modelo} className="w-full h-full object-cover" />
              ) : (
                <Car className="w-16 h-16 text-slate-300 dark:text-slate-700" />
              )}
              <div className="absolute top-3 right-3">
                {getStatusBadge(veiculo.status)}
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{veiculo.modelo}</h3>
                  <div className="text-sm font-medium font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded inline-block mt-1">
                    {veiculo.placa}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 mb-6 flex-1">
                <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                  <Tag className="w-4 h-4 mr-2 text-slate-400" /> {veiculo.categoria}
                </div>
                <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" /> {veiculo.localizacao}
                </div>
                <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                  <Gauge className="w-4 h-4 mr-2 text-slate-400" /> {new Intl.NumberFormat('pt-BR').format(veiculo.kmAtual)} km
                </div>
              </div>

              <button 
                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium rounded-lg transition-colors"
                onClick={() => alert("Na integração real, isso redirecionará para criar a reserva.")}
              >
                Reservar Agora
              </button>
            </div>
          </div>
        ))}

        {filteredVeiculos.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            <Car className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3 mx-auto" />
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Nenhum veículo encontrado</p>
            <p className="text-sm">Tente ajustar seus termos de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
}
