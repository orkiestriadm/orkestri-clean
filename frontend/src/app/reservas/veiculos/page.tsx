"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import {
  Search, Filter, Car, Tag, MapPin, Gauge, X, ChevronDown,
  Calendar, ArrowUpDown, Grid3X3, List, Fuel, Clock
} from "lucide-react";
import Link from "next/link";

const getArray = (d: any) => {
  if (Array.isArray(d)) return d;
  if (d?.linhas && Array.isArray(d.linhas)) return d.linhas;
  if (d?.data && Array.isArray(d.data)) return d.data;
  if (d?.items && Array.isArray(d.items)) return d.items;
  return [];
};

type SortField = "placa" | "modelo" | "kmAtual" | "status";
type ViewType = "grid" | "list";

export default function VeiculosDisponiveis() {
  const [searchTerm, setSearchTerm] = useState("");
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("placa");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("grid");

  useEffect(() => { loadVeiculos(); }, []);

  const loadVeiculos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/frota/veiculos");
      setVeiculos(getArray(data));
    } catch (e) {
      console.error("Erro ao carregar lista de veículos", e);
      setVeiculos([]);
    } finally {
      setLoading(false);
    }
  };

  /* ── derived data ── */
  const categorias = useMemo(() => {
    const set = new Set(veiculos.map((v) => v.categoria).filter(Boolean));
    return Array.from(set).sort();
  }, [veiculos]);

  const statuses = useMemo(() => {
    const set = new Set(veiculos.map((v) => v.status).filter(Boolean));
    return Array.from(set).sort();
  }, [veiculos]);

  const filteredVeiculos = useMemo(() => {
    let result = veiculos;

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          (v.placa && v.placa.toLowerCase().includes(q)) ||
          (v.modelo && v.modelo.toLowerCase().includes(q)) ||
          (v.categoria && v.categoria.toLowerCase().includes(q)) ||
          (v.localizacao && v.localizacao.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (filterStatus !== "todos") {
      result = result.filter((v) => v.status === filterStatus);
    }

    // Filter by category
    if (filterCategoria !== "todas") {
      result = result.filter((v) => v.categoria === filterCategoria);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let va = a[sortField] ?? "";
      let vb = b[sortField] ?? "";
      if (sortField === "kmAtual") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [veiculos, searchTerm, filterStatus, filterCategoria, sortField, sortAsc]);

  const activeFilterCount = [filterStatus !== "todos", filterCategoria !== "todas"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus("todos");
    setFilterCategoria("todas");
    setSearchTerm("");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  /* ── status badge ── */
  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "livre" || s === "ativo" || s === "disponível" || s === "disponivel") return { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
    if (s === "em uso" || s === "ocupado") return { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    if (s === "manutenção" || s === "manutencao") return { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" };
    return { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
  };

  const formatKm = (km: any) => {
    const n = Number(km);
    if (isNaN(n)) return "—";
    return new Intl.NumberFormat("pt-BR").format(n);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Veículos Disponíveis</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {filteredVeiculos.length} veículo{filteredVeiculos.length !== 1 ? "s" : ""} encontrado{filteredVeiculos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewType("grid")}
              className={`p-1.5 rounded-md transition-all ${viewType === "grid" ? "bg-white dark:bg-slate-700 shadow-sm text-red-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType("list")}
              className={`p-1.5 rounded-md transition-all ${viewType === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-red-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* Sort */}
          <button
            onClick={() => toggleSort(sortField)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{sortAsc ? "A-Z" : "Z-A"}</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH + FILTERS BAR ── */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por placa, modelo, categoria ou localização..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-9 pr-9 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-all ${
            showFilters || activeFilterCount > 0
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtrar por</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 font-medium">
                Limpar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Status filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="todos">Todos</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Categoria filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categoria</label>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="todas">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {/* Sort by */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ordenar por</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="placa">Placa</option>
                <option value="modelo">Modelo</option>
                <option value="kmAtual">Quilometragem</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE FILTER CHIPS ── */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">Filtros ativos:</span>
          {filterStatus !== "todos" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800">
              {filterStatus}
              <button onClick={() => setFilterStatus("todos")}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterCategoria !== "todas" && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800">
              {filterCategoria}
              <button onClick={() => setFilterCategoria("todas")}><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Carregando veículos...</p>
          </div>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && viewType === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredVeiculos.map((veiculo) => {
            const sc = getStatusColor(veiculo.status);
            return (
              <div
                key={veiculo.id}
                className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-pointer"
              >
                {/* Compact image area */}
                <div className="h-24 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center relative">
                  {veiculo.imagem ? (
                    <img src={veiculo.imagem} alt={veiculo.modelo} className="w-full h-full object-cover" />
                  ) : (
                    <Car className="w-10 h-10 text-slate-300 dark:text-slate-600 group-hover:text-red-300 dark:group-hover:text-red-800 transition-colors" />
                  )}
                  {/* Status badge */}
                  <div className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {veiculo.status || "—"}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  {/* Placa */}
                  <div className="inline-block text-xs font-bold font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mb-1.5">
                    {veiculo.placa || "—"}
                  </div>

                  {/* Details */}
                  <div className="space-y-1 mt-1">
                    {veiculo.modelo && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={veiculo.modelo}>
                        {veiculo.modelo}
                      </p>
                    )}
                    {veiculo.categoria && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                        <Tag className="w-3 h-3 shrink-0" />
                        <span className="truncate">{veiculo.categoria}</span>
                      </div>
                    )}
                    {veiculo.localizacao && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{veiculo.localizacao}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                      <Gauge className="w-3 h-3 shrink-0" />
                      <span>{formatKm(veiculo.kmAtual)} km</span>
                    </div>
                  </div>

                  {/* Reserve button */}
                  <Link
                    href="/reservas/calendario"
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                  >
                    <Calendar className="w-3 h-3" />
                    Reservar
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && viewType === "list" && (
        <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700" onClick={() => toggleSort("placa")}>
                  <span className="flex items-center gap-1">Placa <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700" onClick={() => toggleSort("modelo")}>
                  <span className="flex items-center gap-1">Modelo <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Local</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700" onClick={() => toggleSort("kmAtual")}>
                  <span className="flex items-center gap-1">KM <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-slate-700" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredVeiculos.map((v) => {
                const sc = getStatusColor(v.status);
                return (
                  <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {v.placa || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{v.modelo || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{v.categoria || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{v.localizacao || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{formatKm(v.kmAtual)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {v.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/reservas/calendario"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <Calendar className="w-3 h-3" /> Reservar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!loading && filteredVeiculos.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-16">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Nenhum veículo encontrado</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              Tente ajustar seus termos de busca ou remover os filtros aplicados.
            </p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
