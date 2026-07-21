"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, cnhStatus } from "../../_components/crud";
import { ArrowLeft, X, Plus, Trash2, FileText, RefreshCw } from "lucide-react";

const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));
const CNH_OPTS = ["A", "B", "AB", "C", "D", "E"].map(v => ({ value: v, label: v }));
const ANEXO_CATS = [
  { tipo: "cnh_frente", label: "CNH — Frente" },
  { tipo: "cnh_verso", label: "CNH — Verso" },
  { tipo: "exame", label: "Exames" },
  { tipo: "certificado", label: "Certificados" },
];

// ── Modal Renovar CNH ────────────────────────────────────────────────────────────
function RenovarModal({ motorista, onSaved, onClose }: { motorista: any; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>({ numeroNovo: motorista.cnh || "", categoriaNova: motorista.categoriaCnh || "", orgaoEmissor: motorista.orgaoEmissor || "", dataRenovacao: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!d.validadeNova) { setErr("Informe a nova validade"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/motoristas/${motorista.id}/renovar`, d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao renovar"); setSaving(false); }
  };

  const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-[11px] font-medium text-slate-500 mb-1.5 block uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-all" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Renovar CNH</h3>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="p-6 flex flex-col gap-5">
          {err && <div className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">{err}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Novo Número">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.numeroNovo || ""} onChange={e => set("numeroNovo", e.target.value)} />
            </InputField>
            <InputField label="Categoria">
              <select className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.categoriaNova || ""} onChange={e => set("categoriaNova", e.target.value || null)}>
                <option value="">—</option>
                {CNH_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </InputField>
            <InputField label="Nova Validade *">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="date" value={d.validadeNova || ""} onChange={e => set("validadeNova", e.target.value || null)} />
            </InputField>
            <InputField label="Emissão">
              <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" type="date" value={d.dataRenovacao || ""} onChange={e => set("dataRenovacao", e.target.value || null)} />
            </InputField>
            <div className="col-span-2">
              <InputField label="Órgão Emissor">
                <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.orgaoEmissor || ""} onChange={e => set("orgaoEmissor", e.target.value)} />
              </InputField>
            </div>
          </div>
          <InputField label="Observações">
            <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all" value={d.observacoes || ""} onChange={e => set("observacoes", e.target.value)} />
          </InputField>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl">
          <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Renovar"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Bloco de anexos por categoria ────────────────────────────────────────────────
function AnexoCat({ tipo, label, anexos, motoristaId, canEdit, onChange }: { tipo: string; label: string; anexos: any[]; motoristaId: string; canEdit: boolean; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const itens = anexos.filter(a => a.tipo === tipo);

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("tipo", tipo);
    try { await api.post(`/frota/motoristas/${motoristaId}/anexos`, fd); onChange(); }
    catch {} finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async (anexoId: string) => {
    if (!confirm("Remover anexo?")) return;
    try { await api.delete(`/frota/motoristas/${motoristaId}/anexos/${anexoId}`); onChange(); } catch {}
  };

  return (
    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</span>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Plus size={12} /> {busy ? "Enviando..." : "Anexar"}
            </button>
          </>
        )}
      </div>
      
      {itens.length === 0 && <div className="text-[13px] text-slate-500 dark:text-slate-400 italic">Nenhum arquivo.</div>}
      
      <div className="flex flex-wrap gap-4">
        {itens.map(a => {
          const isImg = (a.mime || "").startsWith("image/");
          return (
            <div key={a.id} className="w-28 group relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 transition-all hover:border-indigo-300 hover:shadow-sm">
              <a href={a.url} target="_blank" rel="noreferrer" className="block">
                {isImg
                  ? <img src={a.url} alt={a.nomeOriginal} className="w-full h-20 object-cover transition-transform duration-300 group-hover:scale-105" />
                  : <div className="h-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 group-hover:bg-slate-200 dark:group-hover:bg-slate-800 transition-colors"><FileText size={28} className="text-slate-400" /></div>}
              </a>
              <div className="px-2 py-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">{a.nomeOriginal}</div>
              {canEdit && (
                <button className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 backdrop-blur-sm" onClick={() => remove(a.id)}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MotoristaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [m, setM] = useState<any>(null);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [renovacoes, setRenovacoes] = useState<any[]>([]);
  const [bloqueio, setBloqueio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [renovOpen, setRenovOpen] = useState(false);
  const canEdit = hasPerms(user, "frota:editar");

  const loadAnexos = useCallback(() => { api.get(`/frota/motoristas/${id}/anexos`).then(r => setAnexos(r.data || [])).catch(() => {}); }, [id]);
  const loadRenov = useCallback(() => { api.get(`/frota/motoristas/${id}/renovacoes`).then(r => setRenovacoes(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d] = await Promise.all([api.get(`/frota/motoristas/${id}`), loadAnexos(), loadRenov()]);
      setM(d.data);
      api.get("/frota/motoristas/cnh/dashboard").then(r => setBloqueio(!!r.data?.bloqueioCnhVencida)).catch(() => {});
    } catch { setM(null); } finally { setLoading(false); }
  }, [id, loadAnexos, loadRenov]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex flex-col h-full bg-[var(--bg-primary)]"><Topbar /><main className="flex-1 p-6 text-slate-500 text-sm flex items-center justify-center font-medium animate-pulse">Carregando informações...</main></div>;
  if (!m) return <div className="flex flex-col h-full bg-[var(--bg-primary)]"><Topbar /><main className="flex-1 p-6 text-slate-500 text-sm flex items-center justify-center font-medium">Motorista não encontrado.</main></div>;

  const cnh = cnhStatus(m.validadeCnh, bloqueio);
  const INFO: [string, any][] = [
    ["CPF", m.cpf], ["Matrícula", m.matricula], ["Telefone", m.telefone], ["E-mail", m.email],
    ["Departamento", m.departamento], ["Cargo", m.cargo], ["Vínculo", m.userId ? "Usuário do sistema" : "Externo"],
    ["CNH", m.cnh], ["Categoria", m.categoriaCnh], ["Emissão", fmtDate(m.cnhEmissao)],
    ["Validade", fmtDate(m.validadeCnh)], ["Órgão emissor", m.orgaoEmissor],
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[var(--bg-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar>
        {canEdit && (
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-red-200 dark:shadow-none transition-all" onClick={() => setRenovOpen(true)}>
            <RefreshCw size={14} /> Renovar CNH
          </button>
        )}
      </Topbar>
      
      <main className="flex-1 overflow-y-auto p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <button className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm" onClick={() => router.push("/dashboard/frota/motoristas")}>
          <ArrowLeft size={16} /> Voltar
        </button>

        {/* Header - Motorista */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 lg:p-8 mb-8 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: cnh.color }} />
          
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <h2 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{m.nome}</h2>
            <Badge color={cnh.color}>CNH: {cnh.label}</Badge>
            {m.status !== "ativo" && <Badge>{m.status}</Badge>}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-y-6 gap-x-4">
            {INFO.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{k}</span>
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anexos */}
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-4 pl-1">Documentos e Anexos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {ANEXO_CATS.map(c => <AnexoCat key={c.tipo} tipo={c.tipo} label={c.label} anexos={anexos} motoristaId={id} canEdit={canEdit} onChange={loadAnexos} />)}
        </div>

        {/* Histórico de renovações */}
        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-4 pl-1">Histórico de Renovações</div>
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  {["Data", "Validade anterior", "Validade nova", "Categoria", "Órgão", "Obs."].map(h => (
                    <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {renovacoes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium text-sm">
                      Nenhuma renovação registrada.
                    </td>
                  </tr>
                )}
                {renovacoes.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{fmtDate(r.dataRenovacao)}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{fmtDate(r.validadeAnterior)}</td>
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{fmtDate(r.validadeNova)}</td>
                    <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{r.categoriaNova || "—"}</td>
                    <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300">{r.orgaoEmissor || "—"}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 italic text-xs max-w-[200px] truncate">{r.observacoes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {renovOpen && <RenovarModal motorista={m} onSaved={() => { setRenovOpen(false); load(); }} onClose={() => setRenovOpen(false)} />}
    </div>
  );
}
