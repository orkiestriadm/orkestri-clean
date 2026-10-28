"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import {
  ChevronLeft, Plus, Edit2, Trash2, Save, X, GripVertical, Tag,
  Type, AlignLeft, Hash, Calendar, List, ToggleLeft,
} from "lucide-react";

// Field helper FORA do componente (evita perda de foco a cada tecla)
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

type CustomField = {
  id: string; categoria?: string | null; label: string; tipo: string;
  obrigatorio: boolean; ordem: number; opcoesJson?: any; ativo: boolean;
};

const TIPOS = [
  { v: "TEXT",     label: "Texto curto",  icon: Type },
  { v: "TEXTAREA", label: "Texto longo",  icon: AlignLeft },
  { v: "NUMBER",   label: "Número",       icon: Hash },
  { v: "DATE",     label: "Data",         icon: Calendar },
  { v: "SELECT",   label: "Lista (select)", icon: List },
  { v: "BOOLEAN",  label: "Sim/Não",      icon: ToggleLeft },
];

// Categorias de chamado conhecidas (alinha com o módulo). null = todas.
const CATEGORIAS = ["Suporte Técnico", "Infraestrutura", "Solicitação", "Incidente", "Dúvida", "Melhoria"];

function FieldForm({ field, onSave, onCancel }: {
  field?: CustomField; onSave: () => void; onCancel: () => void;
}) {
  const [d, setD] = useState<any>(field || { tipo: "TEXT", obrigatorio: false, ordem: 0, categoria: "", ativo: true });
  const [opcoesText, setOpcoesText] = useState<string>(() => {
    const o = field?.opcoesJson;
    const arr = Array.isArray(o) ? o : (o?.options || []);
    return arr.join("\n");
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!d.label?.trim()) { setErr("Label obrigatório"); return; }
    setSaving(true); setErr("");
    try {
      const payload: any = {
        label: d.label.trim(),
        tipo: d.tipo,
        categoria: d.categoria || null,
        obrigatorio: !!d.obrigatorio,
        ordem: Number(d.ordem) || 0,
        ativo: d.ativo !== false,
      };
      if (d.tipo === "SELECT") {
        payload.opcoes = opcoesText.split("\n").map(s => s.trim()).filter(Boolean);
      }
      if (field) await api.patch(`/chamados/custom-fields/${field.id}`, { ...payload, opcoesJson: payload.opcoes || field.opcoesJson });
      else       await api.post(`/chamados/custom-fields`, payload);
      onSave();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)" }}>{field ? "Editar campo" : "Novo campo customizado"}</h2>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <F label="NOME DO CAMPO (LABEL) *"><input className="input-o" value={d.label||""} onChange={e => set("label", e.target.value)} placeholder="Ex: Número do patrimônio" /></F>
        </div>

        <F label="TIPO *">
          <select className="input-o" value={d.tipo} onChange={e => set("tipo", e.target.value)}>
            {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </F>

        <F label="CATEGORIA (vazio = todas)">
          <select className="input-o" value={d.categoria||""} onChange={e => set("categoria", e.target.value)}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>

        {d.tipo === "SELECT" && (
          <div style={{ gridColumn: "1/-1" }}>
            <F label="OPÇÕES (uma por linha)">
              <textarea className="input-o" value={opcoesText} onChange={e => setOpcoesText(e.target.value)} style={{ minHeight: 100, resize: "vertical", fontFamily: "var(--font-mono)" }} placeholder={"Opção A\nOpção B\nOpção C"} />
            </F>
          </div>
        )}

        <F label="ORDEM"><input className="input-o" type="number" value={d.ordem||0} onChange={e => set("ordem", Number(e.target.value)||0)} /></F>

        <div style={{ display: "flex", alignItems: "end", gap: 16, paddingBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={!!d.obrigatorio} onChange={e => set("obrigatorio", e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Obrigatório</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={d.ativo !== false} onChange={e => set("ativo", e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Ativo</span>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </div>
  );
}

export default function CamposCustomizadosPage() {
  const [list, setList] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);

  const load = useCallback(async () => {
    try {
      // sem categoria → backend retorna todos da org
      const { data } = await api.get(`/chamados/custom-fields`);
      setList(Array.isArray(data) ? data : []);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (f: CustomField) => {
    if (!confirm(`Remover o campo "${f.label}"? Os valores já preenchidos nos chamados serão apagados.`)) return;
    await api.delete(`/chamados/custom-fields/${f.id}`);
    load();
  };

  const tipoLabel = (t: string) => TIPOS.find(x => x.v === t)?.label || t;
  const TipoIcon = (t: string) => TIPOS.find(x => x.v === t)?.icon || Type;

  return (
    <>
      <Topbar />
      <div className="page-content" style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <Link href="/dashboard/chamados" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
              <ChevronLeft size={12} style={{ display: "inline" }} /> Chamados
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>Campos customizados</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Campos extras que aparecem no detalhe do chamado, por categoria</p>
          </div>
          {!showForm && (
            <button className="btn btn-violet" onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={14} style={{ marginRight: 4 }} /> Novo campo
            </button>
          )}
        </div>

        {showForm && (
          <div className="card" style={{ padding: 20, marginBottom: 18 }}>
            <FieldForm field={editing || undefined}
              onSave={() => { setShowForm(false); setEditing(null); load(); }}
              onCancel={() => { setShowForm(false); setEditing(null); }} />
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-hover)" }}>
                <th style={th}>Campo</th>
                <th style={th}>Tipo</th>
                <th style={th}>Categoria</th>
                <th style={th}>Obrigatório</th>
                <th style={th}>Ordem</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</td></tr>}
              {!loading && list.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--text-muted)" }}>
                  Nenhum campo customizado. Use "Novo campo" pra criar o primeiro.
                </td></tr>
              )}
              {list.map(f => {
                const Icon = TipoIcon(f.tipo);
                return (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon size={13} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontWeight: 600 }}>{f.label}</span>
                      </div>
                    </td>
                    <td style={td}>{tipoLabel(f.tipo)}</td>
                    <td style={td}>{f.categoria || <span style={{ color: "var(--text-muted)" }}>Todas</span>}</td>
                    <td style={td}>{f.obrigatorio ? <span style={{ color: "#D32F2F", fontWeight: 600 }}>Sim</span> : <span style={{ color: "var(--text-muted)" }}>Não</span>}</td>
                    <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{f.ordem}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: f.ativo ? "#22c55e" : "var(--text-muted)" }}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button className="btn-icon" onClick={() => { setEditing(f); setShowForm(true); }} title="Editar"><Edit2 size={14}/></button>
                      <button className="btn-icon" onClick={() => del(f)} title="Remover"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Tag size={12} />
          Campos com categoria aparecem só em chamados daquela categoria. Sem categoria = aparecem em todos.
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 14px" };
