"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import {
  Search, Filter, Car, Tag, MapPin, Gauge, X, ChevronDown,
  Calendar, ArrowUpDown, Grid3X3, List, Fuel, Clock
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";

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
  const { user } = useAuthStore();
  const canReserve = user?.isMaster || user?.permissions?.includes("*") || user?.permissions?.includes("reservas:criar");

  useEffect(() => { loadVeiculos(); }, []);

  const loadVeiculos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/frota/veiculos?limit=200");
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
    return { bg: "surface-sunken", text: "text-secondary-o", dot: "bg-[var(--text-muted)]" };
  };

  const formatKm = (km: any) => {
    const n = Number(km);
    if (isNaN(n)) return "—";
    return new Intl.NumberFormat("pt-BR").format(n);
  };

  return (
    <div className="flex flex-col min-h-full w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-o tracking-tight">Veículos Disponíveis</h1>
            <p className="text-muted-o text-sm mt-0.5">
              {filteredVeiculos.length} veículo{filteredVeiculos.length !== 1 ? "s" : ""} encontrado{filteredVeiculos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex surface-sunken/80 /80 rounded-xl p-1 backdrop-blur-sm border border-subtle-o/50 ">
            <button
              onClick={() => setViewType("grid")}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewType === "grid" ? "bg-white dark:bg-slate-700 shadow-sm text-red-600" : "text-muted-o hover:text-secondary-o dark:hover:text-primary-o"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType("list")}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewType === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-red-600" : "text-muted-o hover:text-secondary-o dark:hover:text-primary-o"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* Sort */}
          <button
            onClick={() => toggleSort(sortField)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-secondary-o  border border-subtle-o  rounded-xl hover-surface transition-all surface-card shadow-sm"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-o" />
            <span className="hidden sm:inline">{sortAsc ? "A-Z" : "Z-A"}</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH + FILTERS BAR ── */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 relative z-10">
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-o group-focus-within:text-red-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar por placa, modelo, categoria ou localização..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-10 py-3 text-sm border-0 ring-1 ring-slate-200 dark:ring-slate-800 rounded-2xl surface-card text-primary-o focus:ring-2 focus:ring-red-500 shadow-sm hover:shadow-md focus:shadow-md transition-all placeholder:text-muted-o"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
            >
              <X className="h-4 w-4 text-muted-o hover:text-red-500 transition-colors" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-md ${
            showFilters || activeFilterCount > 0
              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800"
              : "surface-card text-secondary-o  ring-1 ring-slate-200 dark:ring-slate-800 hover-surface"
          }`}
        >
          <Filter className={`w-4 h-4 ${showFilters || activeFilterCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-o"}`} />
          Filtros
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full shadow-sm">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div className="mb-4 p-4 surface-sunken border border-subtle-o rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-o">Filtrar por</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 font-medium">
                Limpar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Status filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-o">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-subtle-o  rounded-lg surface-card text-secondary-o outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="todos">Todos</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Categoria filter */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-o">Categoria</label>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="px-3 py-1.5 text-sm border border-subtle-o  rounded-lg surface-card text-secondary-o outline-none focus:ring-2 focus:ring-red-500/30"
              >
                <option value="todas">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {/* Sort by */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-o">Ordenar por</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="px-3 py-1.5 text-sm border border-subtle-o  rounded-lg surface-card text-secondary-o outline-none focus:ring-2 focus:ring-red-500/30"
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
          <span className="text-xs text-muted-o">Filtros ativos:</span>
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
            <p className="text-sm text-muted-o">Carregando veículos...</p>
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
                className="surface-card rounded-2xl border border-subtle-o overflow-hidden hover:shadow-xl hover:-translate-y-1 hover:border-red-200 dark:hover:border-red-900 transition-all duration-300 group cursor-pointer flex flex-col"
              >
                {/* Compact image area */}
                <div className="h-20 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 flex items-center justify-center relative p-3 group-hover:from-red-50 group-hover:to-red-100/50 dark:group-hover:from-red-900/20 dark:group-hover:to-red-900/10 transition-colors duration-300">
                  {veiculo.imagem ? (
                    <img src={veiculo.imagem} alt={veiculo.modelo} className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-12 h-12 rounded-full surface-card shadow-sm flex items-center justify-center group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                      <Car className="w-6 h-6 text-faint-o  group-hover:text-red-500 transition-colors" />
                    </div>
                  )}
                  {/* Status badge */}
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${sc.bg} ${sc.text} shadow-sm backdrop-blur-sm border border-white/20 `}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} animate-pulse`} />
                    {veiculo.status || "—"}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1 surface-card">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col gap-1 w-full">
                      {/* Placa */}
                      <div className="inline-block self-start text-[10px] font-bold font-mono text-secondary-o surface-sunken/80 px-1.5 py-0.5 rounded mb-0.5 border border-subtle-o/50  group-hover:bg-red-50 dark:group-hover:bg-red-900/20 group-hover:text-red-700 dark:group-hover:text-red-400 group-hover:border-red-100 dark:group-hover:border-red-800/50 transition-colors">
                        {veiculo.placa || "—"}
                      </div>
                      {/* Modelo */}
                      {veiculo.modelo && (
                        <p className="text-xs font-semibold text-primary-o line-clamp-1 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" title={veiculo.modelo}>
                          {veiculo.modelo}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 mt-auto">
                    {veiculo.categoria && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-o">
                        <div className="w-4 h-4 rounded surface-sunken flex items-center justify-center shrink-0">
                          <Tag className="w-2.5 h-2.5 text-muted-o" />
                        </div>
                        <span className="truncate">{veiculo.categoria}</span>
                      </div>
                    )}
                    {veiculo.localizacao && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-o">
                        <div className="w-4 h-4 rounded surface-sunken flex items-center justify-center shrink-0">
                          <MapPin className="w-2.5 h-2.5 text-muted-o" />
                        </div>
                        <span className="truncate">{veiculo.localizacao}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-o">
                      <div className="w-4 h-4 rounded surface-sunken flex items-center justify-center shrink-0">
                        <Gauge className="w-2.5 h-2.5 text-muted-o" />
                      </div>
                      <span>{formatKm(veiculo.kmAtual)} km</span>
                    </div>
                  </div>

                  {/* Reserve button */}
                  {canReserve && (
                    <Link
                      href={`/reservas/calendario?veiculo=${veiculo.id}`}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-sm hover:shadow-red-600/20 group-hover:bg-red-700"
                    >
                      <Calendar className="w-3 h-3" />
                      Reservar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && viewType === "list" && (
        <div className="surface-card rounded-xl border border-subtle-o overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="surface-sunken text-muted-o">
              <tr>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-secondary-o" onClick={() => toggleSort("placa")}>
                  <span className="flex items-center gap-1">Placa <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-secondary-o" onClick={() => toggleSort("modelo")}>
                  <span className="flex items-center gap-1">Modelo <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Local</th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-secondary-o" onClick={() => toggleSort("kmAtual")}>
                  <span className="flex items-center gap-1">KM <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider cursor-pointer hover:text-secondary-o" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                {canReserve && <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle-o">
              {filteredVeiculos.map((v) => {
                const sc = getStatusColor(v.status);
                return (
                  <tr key={v.id} className="hover-surface transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-xs text-secondary-o surface-sunken px-1.5 py-0.5 rounded">
                        {v.placa || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-o">{v.modelo || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-o hidden md:table-cell">{v.categoria || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-o hidden lg:table-cell">{v.localizacao || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-o font-mono">{formatKm(v.kmAtual)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {v.status || "—"}
                      </span>
                    </td>
                    {canReserve && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/reservas/calendario?veiculo=${v.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <Calendar className="w-3 h-3" /> Reservar
                        </Link>
                      </td>
                    )}
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
            <div className="w-16 h-16 surface-sunken rounded-2xl flex items-center justify-center mb-4">
              <Car className="w-8 h-8 text-faint-o" />
            </div>
            <p className="text-base font-semibold text-secondary-o ">Nenhum veículo encontrado</p>
            <p className="text-sm text-muted-o mt-1 max-w-xs">
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
