"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Badge, fmtDate, fmtMoney } from "../../_components/crud";
import { ArrowLeft, Plus, Trash2, FileText } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  licenciamento: "Licenciamento", seguro: "Seguro", antt: "ANTT", tacografo: "Tacógrafo",
  crlv: "CRLV", laudo: "Laudos", inspecao: "Inspeções", ipva: "IPVA", outro: "Outro",
};
const STATUS: Record<string, { label: string; color: string }> = {
  vigente: { label: "Vigente", color: "var(--accent-green)" }, vencido: { label: "Vencido", color: "var(--accent-red)" }, cancelado: { label: "Cancelado", color: "var(--text-muted)" },
};
const hasPerms = (user: any, ...perms: string[]) => user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

function vencInfo(d?: string | null) {
  if (!d) return { label: "—", color: "var(--text-muted)" };
  const dias = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (dias < 0) return { label: `Vencido há ${-dias}d`, color: "var(--accent-red)" };
  if (dias <= 7) return { label: `Vence em ${dias}d`, color: "var(--accent-red)" };
  if (dias <= 30) return { label: `Vence em ${dias}d`, color: "var(--accent-amber)" };
  if (dias <= 90) return { label: `Vence em ${dias}d`, color: "#eab308" };
  return { label: "Vigente", color: "var(--accent-green)" };
}

export default function DocumentoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [doc, setDoc] = useState<any>(null);
  const [anexos, setAnexos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = hasPerms(user, "frota:editar");

  const loadAnexos = useCallback(() => { api.get(`/frota/documentos/${id}/anexos`).then(r => setAnexos(r.data || [])).catch(() => {}); }, [id]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [d] = await Promise.all([api.get(`/frota/documentos/${id}`), loadAnexos()]); setDoc(d.data); }
    catch { setDoc(null); } finally { setLoading(false); }
  }, [id, loadAnexos]);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    try { await api.post(`/frota/documentos/${id}/anexos`, fd); loadAnexos(); }
    catch {} finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const removeAnexo = async (anexoId: string) => { if (!confirm("Remover anexo?")) return; try { await api.delete(`/frota/documentos/${id}/anexos/${anexoId}`); loadAnexos(); } catch {} };

  if (loading) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Carregando...</main></div>;
  if (!doc) return <div className="flex flex-col h-full"><Topbar /><main className="flex-1 p-6 text-[var(--text-muted)] text-sm">Documento não encontrado.</main></div>;

  const st = STATUS[doc.status] || { label: doc.status, color: "var(--text-muted)" };
  const venc = vencInfo(doc.dataVencimento);
  const INFO: [string, any][] = [
    ["Veículo", doc.veiculo?.placa], ["Número / Apólice", doc.numero], ["Descrição", doc.descricao],
    ["Emissão", fmtDate(doc.dataEmissao)], ["Vencimento", fmtDate(doc.dataVencimento)], ["Valor", fmtMoney(doc.valor)],
  ];

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {canEdit && (<>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          <button className="btn btn-violet text-xs" disabled={busy} onClick={() => inputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> {busy ? "Enviando..." : "Anexar"}</button>
        </>)}
      </Topbar>
      <main className="flex-1 overflow-y-auto p-6">
        <button className="btn btn-ghost text-xs" onClick={() => router.push("/dashboard/frota/documentacoes")} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}><ArrowLeft size={14} /> Voltar</button>

        <div className="card" style={{ padding: "20px 24px", marginBottom: 18, borderLeft: `3px solid ${venc.color}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)" }}>{TIPO_LABEL[doc.tipo] || doc.tipo}</h2>
            <Badge color={venc.color}>{venc.label}</Badge>
            <Badge color={st.color}>{st.label}</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
            {INFO.filter(([, v]) => v && v !== "—").map(([k, v]) => (
              <div key={k}><div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k}</div><div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v}</div></div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>ANEXOS</div>
        <div className="card" style={{ padding: "14px 16px" }}>
          {anexos.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhum arquivo anexado.</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {anexos.map(a => {
              const isImg = (a.mime || "").startsWith("image/");
              return (
                <div key={a.id} style={{ width: 130, border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                  <a href={a.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
                    {isImg ? <img src={a.url} alt={a.nomeOriginal} style={{ width: "100%", height: 90, objectFit: "cover" }} />
                      : <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)" }}><FileText size={30} style={{ color: "var(--text-muted)" }} /></div>}
                  </a>
                  <div style={{ padding: "4px 6px", fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nomeOriginal}</div>
                  {canEdit && <button className="btn-icon" style={{ position: "absolute", top: 2, right: 2, width: 22, height: 22, background: "rgba(0,0,0,0.4)", color: "#fff" }} onClick={() => removeAnexo(a.id)}><Trash2 size={11} /></button>}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
