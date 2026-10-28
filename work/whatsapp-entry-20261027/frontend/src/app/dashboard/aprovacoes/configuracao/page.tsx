"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Matriz de Aprovadores por Setor — apenas Master/admin
// 1 aprovador primario + 1 backup com vigencia (datas) por setor.
// Sistema usa essa matriz para resolver quem aprova as solicitacoes do tenant.
// ─────────────────────────────────────────────────────────────────────────────

type UsuarioPick = { id: string; nome: string; email: string; avatar?: string | null };
type ConfigItem = {
  setor: { id: string; nome: string; cor: string | null };
  config: null | {
    id: string;
    aprovador: UsuarioPick;
    backupAprovador: UsuarioPick | null;
    backupInicio: string | null;
    backupFim: string | null;
    backupAtivo: boolean;
    configuradoPor: { id: string; nome: string } | null;
    atualizadoEm: string;
  };
  responsavelLegado: { id: string; nome: string } | null;
  aprovadorEfetivo: UsuarioPick | null;
};

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function Avatar({ nome, size=24 }: { nome:string; size?:number }) {
  const i = nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
  return <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.4, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>{i}</div>;
}

function EditModal({ item, users, onClose, onSave }: {
  item: ConfigItem; users: UsuarioPick[]; onClose: () => void; onSave: () => void;
}) {
  const cfg = item.config;
  const [aprovadorId, setAprovadorId] = useState(cfg?.aprovador?.id || "");
  const [backupId, setBackupId] = useState(cfg?.backupAprovador?.id || "");
  const [inicio, setInicio] = useState(cfg?.backupInicio?.slice(0,10) || "");
  const [fim, setFim] = useState(cfg?.backupFim?.slice(0,10) || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!aprovadorId) { setErr("Aprovador primario obrigatorio"); return; }
    if (backupId && backupId === aprovadorId) { setErr("Backup deve ser diferente do primario"); return; }
    if ((inicio && !fim) || (!inicio && fim)) { setErr("Informe ambas as datas da vigencia do backup"); return; }
    if (inicio && fim && inicio > fim) { setErr("Data inicio nao pode ser depois do fim"); return; }
    setLoading(true); setErr("");
    try {
      await api.put(`/workflows/aprovadores-setor/${item.setor.id}`, {
        aprovadorId,
        backupAprovadorId: backupId || undefined,
        backupInicio: inicio || undefined,
        backupFim:    fim    || undefined,
      });
      onSave(); onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Erro ao salvar");
    } finally { setLoading(false); }
  };

  const remove = async () => {
    if (!cfg) return;
    if (!confirm("Remover configuracao deste setor? As novas solicitacoes voltarao a usar a logica padrao (responsavel do setor / gestor direto).")) return;
    setLoading(true);
    try { await api.delete(`/workflows/aprovadores-setor/${item.setor.id}`); onSave(); onClose(); }
    catch (e: any) { setErr(e?.response?.data?.message || "Erro ao remover"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>{ if((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:520 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:4 }}>CONFIGURAR APROVADOR DO SETOR</div>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
              {item.setor.cor && <span style={{ width:8, height:8, borderRadius:"50%", background: item.setor.cor, boxShadow:`0 0 6px ${item.setor.cor}80` }}/>}
              {item.setor.nome}
            </h3>
          </div>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>APROVADOR PRIMARIO *</label>
            <select className="input-o" value={aprovadorId} onChange={e => setAprovadorId(e.target.value)}>
              <option value="">— selecionar —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
            </select>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>Quem recebe as solicitacoes deste setor por padrao.</div>
          </div>

          <div style={{ borderTop:"1px solid var(--border-subtle)", paddingTop:14 }}>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:8 }}>BACKUP (substituto durante ferias / ausencia)</div>

            <select className="input-o" value={backupId} onChange={e => setBackupId(e.target.value)} style={{ marginBottom:10 }}>
              <option value="">— sem backup —</option>
              {users.filter(u => u.id !== aprovadorId).map(u => (
                <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>
              ))}
            </select>

            {backupId && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:4 }}>VIGENCIA — INICIO</label>
                  <input className="input-o" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:4 }}>VIGENCIA — FIM</label>
                  <input className="input-o" type="date" value={fim} onChange={e => setFim(e.target.value)} />
                </div>
                <div style={{ gridColumn:"span 2", fontSize:11, color:"var(--text-muted)" }}>
                  Durante esse periodo, novas solicitacoes vao automaticamente ao backup. Volta ao primario depois.
                </div>
              </div>
            )}
          </div>

          {err && <div style={{ fontSize:12, color:"var(--accent-red)", padding:"8px 10px", background:"rgba(220,38,38,0.08)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:6 }}>{err}</div>}

          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            {cfg && (
              <button className="btn btn-ghost" style={{ color:"var(--accent-red)" }} onClick={remove} disabled={loading}>
                Remover config
              </button>
            )}
            <div style={{ flex:1 }}/>
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-violet" onClick={save} disabled={loading || !aprovadorId}>
              {loading ? <Spin/> : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracaoAprovadoresPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [users, setUsers] = useState<UsuarioPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConfigItem | null>(null);

  // Permissao: master ou aprovacoes:configurar
  const canConfigure = !!user?.isMaster
    || (user?.permissions || []).some((p: string) => p === "*" || p === "aprovacoes:configurar");

  useEffect(() => {
    // Gate front-end: redireciona quem nao pode configurar
    if (user && !canConfigure) router.replace("/dashboard/aprovacoes");
  }, [user, canConfigure, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/workflows/aprovadores-setor");
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch { setItems([]); }
    try {
      const r = await api.get("/users/picklist");
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch { setUsers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!canConfigure) {
    return (
      <div style={{ padding:48, textAlign:"center" }}>
        <div style={{ fontSize:14, color:"var(--text-muted)" }}>Acesso restrito ao Master / admin.</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar>
        <a href="/dashboard/aprovacoes" className="btn btn-ghost" style={{ fontSize:12 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </a>
      </Topbar>
      <div style={{ flex:1, overflowY:"auto", padding:24 }}>
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:22, fontWeight:700, marginBottom:6 }}>Configurar aprovadores por setor</h1>
          <p style={{ fontSize:13, color:"var(--text-muted)", maxWidth:720, lineHeight:1.5 }}>
            Defina quem aprova as solicitacoes de cada setor. Voce pode informar um substituto (backup)
            com vigencia para cobrir ferias ou ausencias — o sistema rotea automaticamente. Se nao houver
            config, o sistema usa o responsavel do setor ou o gestor direto do solicitante.
          </p>
        </div>

        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          {loading ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:48, gap:12 }}>
              <Spin/><span style={{ color:"var(--text-muted)", fontSize:13 }}>Carregando setores...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ padding:48 }}>
              <p style={{ color:"var(--text-secondary)", fontWeight:500, marginBottom:6 }}>Nenhum setor cadastrado</p>
              <p style={{ fontSize:12, color:"var(--text-muted)" }}>Cadastre setores em <a href="/dashboard/cadastros" style={{ color:"var(--accent-violet)" }}>Cadastros &rarr; Setores</a> primeiro.</p>
            </div>
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1.4fr 1.4fr 1.6fr auto", gap:12, padding:"12px 20px", borderBottom:"1px solid var(--border-subtle)", fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em" }}>
                <div>SETOR</div>
                <div>APROVADOR PRIMARIO</div>
                <div>BACKUP</div>
                <div>VIGENCIA / SITUACAO</div>
                <div></div>
              </div>
              {items.map((it, idx) => {
                const cfg = it.config;
                return (
                  <div key={it.setor.id}
                    style={{ display:"grid", gridTemplateColumns:"1.4fr 1.4fr 1.4fr 1.6fr auto", gap:12, padding:"14px 20px",
                      borderBottom: idx < items.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      alignItems:"center", transition:"background 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    {/* Setor */}
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {it.setor.cor && <span style={{ width:8, height:8, borderRadius:"50%", background: it.setor.cor, boxShadow:`0 0 6px ${it.setor.cor}60` }}/>}
                      <span style={{ fontSize:13, fontWeight:600 }}>{it.setor.nome}</span>
                    </div>

                    {/* Aprovador primario */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      {cfg?.aprovador ? (
                        <>
                          <Avatar nome={cfg.aprovador.nome} size={26}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cfg.aprovador.nome}</div>
                            <div style={{ fontSize:10, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cfg.aprovador.email}</div>
                          </div>
                        </>
                      ) : it.responsavelLegado ? (
                        <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>
                          {it.responsavelLegado.nome} <span style={{ fontSize:10 }}>(responsavel do setor)</span>
                        </div>
                      ) : (
                        <span style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>nao configurado</span>
                      )}
                    </div>

                    {/* Backup */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      {cfg?.backupAprovador ? (
                        <>
                          <Avatar nome={cfg.backupAprovador.nome} size={26}/>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cfg.backupAprovador.nome}</div>
                            <div style={{ fontSize:10, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cfg.backupAprovador.email}</div>
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic" }}>—</span>
                      )}
                    </div>

                    {/* Vigencia / situacao */}
                    <div>
                      {cfg?.backupAprovador && cfg.backupInicio && cfg.backupFim ? (
                        <>
                          <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-secondary)" }}>
                            {new Date(cfg.backupInicio).toLocaleDateString("pt-BR")} → {new Date(cfg.backupFim).toLocaleDateString("pt-BR")}
                          </div>
                          {cfg.backupAtivo ? (
                            <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--accent-cyan)", marginTop:2, padding:"1px 6px", display:"inline-block", borderRadius:8, background:"rgba(34,211,238,0.1)", border:"1px solid rgba(34,211,238,0.3)" }}>BACKUP ATIVO HOJE</div>
                          ) : (
                            <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>fora da vigencia</div>
                          )}
                        </>
                      ) : cfg?.backupAprovador ? (
                        <span style={{ fontSize:11, color:"var(--text-muted)", fontStyle:"italic" }}>sem vigencia (nunca ativa)</span>
                      ) : (
                        <span style={{ fontSize:11, color:"var(--text-muted)" }}>—</span>
                      )}
                    </div>

                    {/* Acao */}
                    <button className="btn btn-ghost" style={{ fontSize:11, padding:"6px 12px" }} onClick={()=>setEditing(it)}>
                      {cfg ? "Editar" : "Configurar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && <EditModal item={editing} users={users} onClose={()=>setEditing(null)} onSave={load} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
