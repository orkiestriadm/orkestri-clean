"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { ChevronLeft, Plus, MapPin, Trash2 } from "lucide-react";

type Map = { id: string; nome: string; tipo: "GEO" | "INFRA"; backgroundUrl?: string; _count?: { positions: number } };

export default function MapasPage() {
  const [list, setList] = useState<Map[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"GEO" | "INFRA">("INFRA");

  const load = () => api.get("/monitoramento/mapas").then(r => setList(r.data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!nome.trim()) return;
    const { data } = await api.post("/monitoramento/mapas", { nome: nome.trim(), tipo });
    setShowNew(false); setNome(""); load();
    window.location.href = `/dashboard/monitoramento/mapas/${data.id}`;
  };

  const del = async (m: Map) => {
    if (!confirm(`Remover mapa "${m.nome}"?`)) return;
    await api.delete(`/monitoramento/mapas/${m.id}`);
    load();
  };

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24 }}>
        <Link href="/dashboard/monitoramento" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          <ChevronLeft size={12} style={{ display: "inline" }} /> Monitoramento
        </Link>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>Mapas Operacionais</h1>
          <button className="btn btn-violet" onClick={() => setShowNew(true)}>
            <Plus size={14} style={{ marginRight: 4 }} /> Novo mapa
          </button>
        </div>

        {showNew && (
          <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>NOME</label>
              <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Praça do Km 50" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>TIPO</label>
              <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value as any)}>
                <option value="INFRA">Infraestrutura (imagem custom)</option>
                <option value="GEO" disabled>Geográfico (em breve)</option>
              </select>
            </div>
            <button className="btn btn-violet" onClick={create}>Criar</button>
            <button className="btn btn-ghost" onClick={() => { setShowNew(false); setNome(""); }}>Cancelar</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {list.length === 0 && <div style={{ color: "var(--text-muted)", gridColumn: "1/-1", padding: 24, textAlign: "center" }}>Nenhum mapa. Clique em "Novo mapa".</div>}
          {list.map(m => (
            <div key={m.id} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={16} style={{ color: "#D32F2F" }} />
                <Link href={`/dashboard/monitoramento/mapas/${m.id}`} style={{ fontWeight: 700, fontSize: 14, textDecoration: "none", color: "inherit" }}>{m.nome}</Link>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {m.tipo === "GEO" ? "Geográfico" : "Infraestrutura"} · {m._count?.positions || 0} equipamentos
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <Link href={`/dashboard/monitoramento/mapas/${m.id}`} className="btn btn-ghost" style={{ fontSize: 11 }}>Abrir editor</Link>
                <button className="btn-icon" onClick={() => del(m)} title="Remover"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
