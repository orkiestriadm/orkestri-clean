"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../../_components/crud";
import { ArrowLeft, X, Plus, Trash2, FileText } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  aberta: { label: "Aberta", color: "var(--accent-cyan)" },
  em_andamento: { label: "Em andamento", color: "var(--accent-amber)" },
  aguardando_pecas: { label: "Aguardando peças", color: "#f97316" },
  finalizada: { label: "Finalizada", color: "var(--accent-green)" },
  cancelada: { label: "Cancelada", color: "var(--text-muted)" },
};
const TIPO_LABEL: Record<string, string> = { preventiva: "Preventiva", corretiva: "Corretiva", emergencial: "Emergencial" };
const ANEXO_CATS = [
  { tipo: "nota_fiscal", label: "Notas Fiscais" }, { tipo: "foto", label: "Fotos" }, { tipo: "orcamento", label: "Orçamentos" },
];
const hasPerms = (user: any, ...perms: string[]) => user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

/** Mesma lista de `frota-status.ts`: OS encerrada não segura mais o veículo. */
const OS_ENCERRADAS = ["finalizada", "cancelada", "concluida"];
/** O que o solicitante relatou ao abrir o chamado — relato, não decisão. */
const CONDICAO_RELATADA: Record<string, { rotulo: string; cor: string }> = {
  inoperante: { rotulo: "Inoperante", cor: "var(--accent-red)" },
  operando_com_avaria: { rotulo: "Operando com avaria", cor: "var(--accent-amber)" },
};

/**
 * A decisão do farol, no lugar onde ela é tomada.
 *
 * O farol da frota é derivado das OS abertas, e `imobiliza` é o campo que
 * decide entre vermelho (parado) e amarelo (operando com avaria). Quem abre o
 * chamado relata o que viu; quem ATENDE, aqui na Manutenção, é que determina.
 *
 * Estava só como uma caixinha no formulário de edição — para trocar era preciso
 * abrir "Editar" e achar o campo, e não havia nada na tela dizendo que aquele
 * clique pintava o veículo na dashboard. Aqui a consequência está escrita.
 */
function FarolDaOs({ m, canEdit, onChange }: { m: any; canEdit: boolean; onChange: () => void }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const encerrada = OS_ENCERRADAS.includes(String(m.status || "").toLowerCase());
  const parado = m.imobiliza !== false;
  const relato = CONDICAO_RELATADA[String(m.chamado?.condicaoVeiculo || "")];
  const cor = encerrada ? "var(--text-muted)" : (parado ? "var(--accent-red)" : "var(--accent-amber)");

  const definir = async (v: boolean) => {
    if (v === parado) return;
    setSalvando(true); setErro("");
    try { await api.put(`/frota/manutencoes/${m.id}`, { imobiliza: v }); onChange(); }
    catch (e: any) { setErro(e?.response?.data?.message || "Não foi possível salvar."); }
    finally { setSalvando(false); }
  };

  return (
    <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-6 mb-8">
      <div className="text-[10px] uppercase tracking-wider text-muted-o font-semibold mb-3">
        Situação do veículo no Farol da Frota
      </div>

      <div className="flex items-center gap-3 flex-wrap mb-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: cor }}>
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
          {encerrada ? "Sem efeito — OS encerrada" : (parado ? "Parado" : "Operando com avaria")}
        </span>
        {relato && (
          <span className="text-[11px] text-muted-o">
            Relatado na abertura: <span style={{ color: relato.cor }}>{relato.rotulo}</span>
            {m.chamado?.numero != null && (
              <> · <a className="underline" href={`/dashboard/chamados?chamado=${m.chamado.id}`}>chamado #{m.chamado.numero}</a></>
            )}
          </span>
        )}
      </div>

      {!encerrada && canEdit && (
        <>
          <div className="flex gap-2 mt-3">
            {[
              { v: true, rotulo: "Parado", ajuda: "Não pode operar", cor: "var(--accent-red)" },
              { v: false, rotulo: "Operando com avaria", ajuda: "Roda com defeito", cor: "var(--accent-amber)" },
            ].map(op => {
              const ativo = op.v === parado;
              return (
                <button
                  key={String(op.v)}
                  type="button"
                  disabled={salvando}
                  aria-pressed={ativo}
                  onClick={() => definir(op.v)}
                  className="flex-1 rounded-[10px] border px-3 py-2 text-left transition-colors disabled:opacity-50"
                  style={{
                    borderColor: ativo ? op.cor : "var(--border-subtle)",
                    background: ativo ? `color-mix(in srgb, ${op.cor} 10%, transparent)` : "transparent",
                  }}
                >
                  <span className="block text-[13px] font-semibold" style={{ color: ativo ? op.cor : "var(--text-secondary)" }}>
                    {op.rotulo}
                  </span>
                  <span className="block text-[11px] text-muted-o">{op.ajuda}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-o mt-2">
            Enquanto esta OS estiver aberta, é esta escolha que pinta o veículo na dashboard e
            no Farol da Frota. Ao finalizar a OS, o veículo volta a operar.
          </p>
        </>
      )}
      {encerrada && (
        <p className="text-[11px] text-muted-o mt-1">
          O veículo só é segurado por OS aberta. Reabrir esta OS devolve o efeito no farol.
        </p>
      )}
      {erro && <p className="text-[11px] text-[var(--accent-red)] mt-2">{erro}</p>}
    </div>
  );
}

// ── Modal mão de obra ──────────────────────────────────────────────────────────
function MaoObraModal({ manutencaoId, onSaved, onClose }: { manutencaoId: string; onSaved: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }));
  const custoAuto = (d.horas != null && d.valorHora != null && d.custo == null) ? (Number(d.horas) * Number(d.valorHora)) : null;

  const save = async () => {
    if (!d.descricao?.trim()) { setErr("Descrição obrigatória"); return; }
    setSaving(true); setErr("");
    try { await api.post(`/frota/manutencoes/${manutencaoId}/mao-obra`, d); onSaved(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro"); setSaving(false); }
  };
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="mb-4"><label className="block text-[11px] font-semibold text-muted-o uppercase tracking-wider mb-1.5">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="surface-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-subtle-o">
          <h3 className="font-display text-lg font-bold text-primary-o">Apontar Mão de Obra</h3>
          <button className="p-1.5 text-muted-o hover:text-secondary-o hover-surface rounded-lg transition-colors" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="p-5 flex-1 overflow-y-auto">
          {err && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{err}</div>}
          <L label="DESCRIÇÃO *">
            <input className="w-full surface-sunken border border-subtle-o rounded-xl px-4 py-2.5 text-sm focus-accent outline-none transition-all" value={d.descricao || ""} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Troca de pastilhas" />
          </L>
          <L label="RESPONSÁVEL / MECÂNICO">
            <input className="w-full surface-sunken border border-subtle-o rounded-xl px-4 py-2.5 text-sm focus-accent outline-none transition-all" value={d.responsavel || ""} onChange={e => set("responsavel", e.target.value)} placeholder="Nome do responsável" />
          </L>
          <div className="grid grid-cols-3 gap-4">
            <L label="HORAS">
              <input className="w-full surface-sunken border border-subtle-o rounded-xl px-4 py-2.5 text-sm focus-accent outline-none transition-all" type="number" step={0.5} value={d.horas ?? ""} onChange={e => set("horas", e.target.value === "" ? null : Number(e.target.value))} />
            </L>
            <L label="R$/HORA">
              <input className="w-full surface-sunken border border-subtle-o rounded-xl px-4 py-2.5 text-sm focus-accent outline-none transition-all" type="number" step={0.01} value={d.valorHora ?? ""} onChange={e => set("valorHora", e.target.value === "" ? null : Number(e.target.value))} />
            </L>
            <L label="CUSTO">
              <input className="w-full surface-sunken border border-subtle-o rounded-xl px-4 py-2.5 text-sm focus-accent outline-none transition-all font-semibold" type="number" step={0.01} value={d.custo ?? (custoAuto ?? "")} onChange={e => set("custo", e.target.value === "" ? null : Number(e.target.value))} />
            </L>
          </div>
        </div>
        
        <div className="p-5 border-t border-subtle-o flex justify-end gap-3 surface-sunken/50 /20">
          <button className="px-4 py-2 text-sm font-medium text-secondary-o  hover:text-primary-o surface-card border border-subtle-o  rounded-xl shadow-sm hover:surface-sunken  transition-all" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2 text-sm font-medium text-white accent-solid rounded-xl shadow-sm shadow-none dark:shadow-none  transition-all" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Adicionar Apontamento"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Anexos por categoria ──────────────────────────────────────────────────────────
function AnexoCat({ tipo, label, anexos, manutencaoId, canEdit, onChange }: { tipo: string; label: string; anexos: any[]; manutencaoId: string; canEdit: boolean; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const itens = anexos.filter(a => a.tipo === tipo);
  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("tipo", tipo);
    try { await api.post(`/frota/manutencoes/${manutencaoId}/anexos`, fd); onChange(); }
    catch {} finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const remove = async (anexoId: string) => { if (!confirm("Remover anexo?")) return; try { await api.delete(`/frota/manutencoes/${manutencaoId}/anexos/${anexoId}`); onChange(); } catch {} };

  return (
    <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-primary-o">{label}</span>
        {canEdit && (<>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="flex items-center gap-1.5 text-xs font-medium accent-text   accent-soft    py-1.5 px-3 rounded-lg transition-colors" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Plus size={14} /> {busy ? "Enviando..." : "Anexar"}
          </button>
        </>)}
      </div>
      {itens.length === 0 && <div className="text-sm text-muted-o py-6 text-center border-2 border-dashed border-subtle-o/60 rounded-xl">Nenhum arquivo.</div>}
      <div className="grid grid-cols-2 gap-4">
        {itens.map(a => {
          const isImg = (a.mime || "").startsWith("image/");
          const fileUrl = a.url || "";
          return (
            <div key={a.id} className="relative group border border-subtle-o rounded-xl overflow-hidden surface-sunken hover:border-subtle-o transition-colors">
              <a href={fileUrl} target="_blank" rel="noreferrer" download={a.nomeOriginal} className="block relative z-10">
                <div className="block aspect-[4/3] overflow-hidden">
                  {isImg ? <img src={fileUrl} alt={a.nomeOriginal} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    : <div className="w-full h-full flex items-center justify-center surface-sunken"><FileText size={32} className="text-faint-o" /></div>}
                </div>
                <div className="p-2.5 surface-card border-t border-subtle-o">
                  <div className="text-[10px] text-secondary-o font-medium truncate" title={a.nomeOriginal}>{a.nomeOriginal}</div>
                </div>
              </a>
              {canEdit && (
                <button className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm backdrop-blur-sm z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(a.id); }}>
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

function CustoCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-5 relative overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }}></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-o font-semibold mb-2">{label}</div>
      <div className="metric text-[19px]" style={{ color }}>{fmtMoney(value)}</div>
      <div className="absolute -right-4 -bottom-4 w-16 h-16 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-700" style={{ backgroundColor: color }}></div>
    </div>
  );
}

export default function ManutencaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [m, setM] = useState<any>(null);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moOpen, setMoOpen] = useState(false);
  const canEdit = hasPerms(user, "frota:editar");

  const loadAnexos = useCallback(() => { api.get(`/frota/manutencoes/${id}/anexos`).then(r => setAnexos(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [d] = await Promise.all([api.get(`/frota/manutencoes/${id}`), loadAnexos()]); setM(d.data); }
    catch { setM(null); } finally { setLoading(false); }
  }, [id, loadAnexos]);
  useEffect(() => { load(); }, [load]);

  const delMo = async (moId: string) => { if (!confirm("Remover apontamento?")) return; try { await api.delete(`/frota/manutencoes/${id}/mao-obra/${moId}`); load(); } catch {} };

  if (loading) return <div className="flex flex-col h-full surface-sunken/50 "><Topbar /><main className="flex-1 p-6 text-muted-o text-sm">Carregando...</main></div>;
  if (!m) return <div className="flex flex-col h-full surface-sunken/50 "><Topbar /><main className="flex-1 p-6 text-muted-o text-sm">Ordem de serviço não encontrada.</main></div>;

  const st = STATUS[m.status] || { label: m.status, color: "var(--text-muted)" };
  const maoObra = m.maoObra || [];
  const custoMo = maoObra.reduce((s: number, x: any) => s + (x.custo || 0), 0);
  const total = (m.custoPecas || 0) + (m.custoServicos || 0) + (m.custoTerceiros || 0) + custoMo;
  const INFO: [string, any][] = [
    ["Veículo", m.veiculo?.placa], ["Tipo", TIPO_LABEL[m.tipo] || m.tipo], ["Solicitante", m.solicitante?.nome],
    ["Oficina", m.oficina], ["Fornecedor", m.fornecedor], ["Abertura", fmtDate(m.dataAbertura)],
    ["Fechamento", fmtDate(m.dataFechamento)], ["KM", m.km != null ? Number(m.km).toLocaleString("pt-BR") : null],
  ];

  return (
    <div className="flex flex-col h-full surface-sunken/50  text-primary-o animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar>
        {canEdit && (
          <button className="flex items-center gap-1.5 text-xs font-medium text-white accent-solid py-1.5 px-3 rounded-lg shadow-sm shadow-none dark:shadow-none transition-all" onClick={() => setMoOpen(true)}>
            <Plus size={14} /> Mão de obra
          </button>
        )}
      </Topbar>
      <main className="flex-1 overflow-y-auto page-content">
        <div className="max-w-7xl mx-auto px-6 py-6 pb-16">
          <button className="flex items-center gap-1.5 text-xs font-medium text-muted-o hover:text-primary-o mb-6 transition-colors" onClick={() => router.push("/dashboard/frota/manutencoes")}>
            <ArrowLeft size={14} /> Voltar
          </button>

          {/* Header */}
          <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-6 mb-8 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: st.color }}></div>
            
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <h2 className="text-2xl font-bold font-display tracking-tight text-primary-o">
                {m.numeroOs || "OS"}
              </h2>
              <Badge color={st.color}>{st.label}</Badge>
            </div>
            {m.descricao && <div className="text-sm text-secondary-o mb-6 max-w-3xl leading-relaxed">{m.descricao}</div>}
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4">
              {INFO.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-o font-semibold mb-1">{k}</div>
                  <div className="text-sm font-medium text-primary-o">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <FarolDaOs m={m} canEdit={canEdit} onChange={load} />

          {/* Custos */}
          <div className="text-xs uppercase tracking-widest text-muted-o font-bold mb-3 pl-1">Custos da Manutenção</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
            <CustoCard label="Peças" value={m.custoPecas || 0} color="var(--accent-cyan)" />
            <CustoCard label="Serviços" value={m.custoServicos || 0} color="var(--accent-amber)" />
            <CustoCard label="Terceiros" value={m.custoTerceiros || 0} color="#f97316" />
            <CustoCard label="Mão de Obra" value={custoMo} color="#8b5cf6" />
            <CustoCard label="Total" value={total} color="var(--accent-green)" />
          </div>

          {/* Mão de obra */}
          <div className="text-xs uppercase tracking-widest text-muted-o font-bold mb-3 pl-1">Apontamento de Mão de Obra</div>
          <div className="surface-card rounded-2xl border border-subtle-o shadow-sm overflow-hidden mb-10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="surface-sunken">
                  <tr>
                    {["Descrição", "Responsável", "Horas", "R$/h", "Custo", ""].map(h => (
                      <th key={h} className="px-5 py-4 font-semibold text-[11px] uppercase tracking-wider text-muted-o">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle-o">
                  {maoObra.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-o">Nenhum apontamento registrado.</td></tr>}
                  {maoObra.map((x: any) => (
                    <tr key={x.id} className="hover-surface transition-colors">
                      <td className="px-5 py-4 text-primary-o font-medium">{x.descricao}</td>
                      <td className="px-5 py-4 text-muted-o">{x.responsavel || "—"}</td>
                      <td className="px-5 py-4 text-primary-o">{x.horas ?? "—"}</td>
                      <td className="px-5 py-4 text-muted-o">{fmtMoney(x.valorHora)}</td>
                      <td className="px-5 py-4 font-semibold text-primary-o">{fmtMoney(x.custo)}</td>
                      <td className="px-5 py-4 text-right">
                        {canEdit && (
                          <button className="p-1.5 text-muted-o hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onClick={() => delMo(x.id)} title="Excluir apontamento">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anexos */}
          <div className="text-xs uppercase tracking-widest text-muted-o font-bold mb-3 pl-1">Anexos</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ANEXO_CATS.map(c => <AnexoCat key={c.tipo} tipo={c.tipo} label={c.label} anexos={anexos} manutencaoId={id} canEdit={canEdit} onChange={loadAnexos} />)}
          </div>
        </div>
      </main>

      {moOpen && <MaoObraModal manutencaoId={id} onSaved={() => { setMoOpen(false); load(); }} onClose={() => setMoOpen(false)} />}
    </div>
  );
}
