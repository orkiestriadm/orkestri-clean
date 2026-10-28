"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import MemberSelector from "@/components/ui/MemberSelector";

type User = { id: string; nome: string; email: string; };
type EventSlot = { userId: string; inicio: string; fim: string; titulo: string; diaTodo: boolean; };
type Disponibilidade = { data: string; usuarios: Record<string, EventSlot[]>; };

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 07h - 19h
const HOUR_H = 48; // altura de cada hora em px

function timeToMinutes(timeStr: string): number {
  const d = new Date(timeStr);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToPct(minutes: number): number {
  const start = 7 * 60; // 07:00
  const end   = 19 * 60; // 19:00
  return Math.max(0, Math.min(100, ((minutes - start) / (end - start)) * 100));
}

export default function DisponibilidadePage() {
  const { user: me } = useAuthStore();
  const [users,    setUsers]    = useState<User[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [date,     setDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [data,     setData]     = useState<Disponibilidade | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [suggest,  setSuggest]  = useState<{ hora: string; disponivel: boolean }[]>([]);

  useEffect(() => {
    const canSeeUsers = me?.isMaster || (me?.permissions || []).some(p => p === "*" || p === "usuarios:ver");
    if (!canSeeUsers) return;
    api.get("/users").then(r => setUsers(r.data)).catch(() => {});
  }, [me]);

  const load = useCallback(async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const { data: res } = await api.get("/agenda/disponibilidade", {
        params: { userIds: selected.join(","), data: date },
      });
      setData(res);
      calcSuggestions(res, selected);
    } catch {} finally { setLoading(false); }
  }, [selected, date]);

  useEffect(() => { load(); }, [load]);

  const calcSuggestions = (disp: Disponibilidade, userIds: string[]) => {
    const slots: { hora: string; disponivel: boolean }[] = [];
    for (let h = 7; h < 19; h++) {
      const hStr = String(h).padStart(2, "0") + ":00";
      const slotStart = h * 60;
      const slotEnd   = slotStart + 60;
      let conflict = false;
      for (const uid of userIds) {
        const evs = disp.usuarios[uid] || [];
        for (const ev of evs) {
          if (ev.diaTodo) { conflict = true; break; }
          const evStart = timeToMinutes(ev.inicio);
          const evEnd   = ev.fim ? timeToMinutes(ev.fim) : evStart + 60;
          if (evStart < slotEnd && evEnd > slotStart) { conflict = true; break; }
        }
        if (conflict) break;
      }
      slots.push({ hora: hStr, disponivel: !conflict });
    }
    setSuggest(slots);
  };

  const selectedUsers = users.filter(u => selected.includes(u.id));
  const freeSlots = suggest.filter(s => s.disponivel);

  const COLORS = ["#a78bfa","#22d3ee","#34d399","#fbbf24","#f87171","#60a5fa","#f472b6"];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", justifyContent:"space-between", background:"var(--bg-glass)", backdropFilter:"blur(20px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Link href="/dashboard/agenda" style={{ display:"flex", alignItems:"center", gap:6, color:"var(--text-muted)", textDecoration:"none", fontSize:13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round"/></svg>
            Agenda
          </Link>
          <span style={{ color:"var(--border-subtle)" }}>/</span>
          <h1 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Disponibilidade de Equipe</h1>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-o" style={{ width:"auto" }} />
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex", gap:0 }}>

        {/* Painel esquerdo - config */}
        <div style={{ width:280, borderRight:"1px solid var(--border-subtle)", padding:20, overflowY:"auto", flexShrink:0 }}>
          <div style={{ marginBottom:20 }}>
            <MemberSelector users={users} selected={selected} onChange={setSelected} label="SELECIONAR MEMBROS" />
          </div>

          {/* Horarios livres sugeridos */}
          {selected.length > 0 && suggest.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>
                Horarios livres  -  {freeSlots.length} disponivel{freeSlots.length !== 1 ? "is" : ""}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {suggest.map(s => (
                  <div key={s.hora} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, background:s.disponivel?"rgba(52,211,153,0.08)":"rgba(248,113,113,0.05)", border:`1px solid ${s.disponivel?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.1)"}` }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:s.disponivel?"var(--accent-green)":"var(--accent-red)", flexShrink:0 }} />
                    <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:s.disponivel?"var(--accent-green)":"var(--text-muted)", fontWeight:s.disponivel?600:400 }}>{s.hora}</span>
                    <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:"auto" }}>{s.disponivel?"Livre":"Ocupado"}</span>
                  </div>
                ))}
              </div>

              {freeSlots.length > 0 && (
                <Link href={`/dashboard/agenda?new=true&hora=${freeSlots[0].hora}&data=${date}`}>
                  <button className="btn btn-violet" style={{ width:"100%", marginTop:14, fontSize:12 }}>
                    Criar evento no primeiro horario livre ({freeSlots[0].hora})
                  </button>
                </Link>
              )}
            </div>
          )}

          {selected.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" style={{ marginBottom:10 }}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              <p style={{ fontSize:12, color:"var(--text-muted)" }}>Selecione membros para ver a disponibilidade</p>
            </div>
          )}
        </div>

        {/* Grid de disponibilidade */}
        <div style={{ flex:1, overflowX:"auto", overflowY:"auto", padding:20 }}>
          {selected.length === 0 ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", flexDirection:"column", gap:12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border-medium)" strokeWidth="1"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
              <p style={{ color:"var(--text-muted)", fontSize:14 }}>Selecione membros para visualizar o grid</p>
            </div>
          ) : loading ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", gap:12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
              <span style={{ color:"var(--text-muted)" }}>Carregando disponibilidade...</span>
            </div>
          ) : (
            <div style={{ minWidth: 200 + selectedUsers.length * 160 }}>
              {/* Cabecalho com nomes */}
              <div style={{ display:"grid", gridTemplateColumns:`60px repeat(${selectedUsers.length}, 1fr)`, marginBottom:8, position:"sticky", top:0, background:"var(--bg-primary)", zIndex:2, paddingBottom:8, borderBottom:"1px solid var(--border-subtle)" }}>
                <div />
                {selectedUsers.map((u, i) => (
                  <div key={u.id} style={{ textAlign:"center", padding:"0 8px" }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:`${COLORS[i % COLORS.length]}25`, border:`1px solid ${COLORS[i % COLORS.length]}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:COLORS[i % COLORS.length], margin:"0 auto 4px" }}>
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-primary)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.nome.split(" ")[0]}</div>
                  </div>
                ))}
              </div>

              {/* Grid de horarios */}
              <div style={{ position:"relative" }}>
                {HOURS.map(h => {
                  const hStr = String(h).padStart(2,"0") + ":00";
                  const slotStart = h * 60;
                  const slotEnd   = slotStart + 60;
                  const isAllFree = selectedUsers.every(u => {
                    const evs = data?.usuarios[u.id] || [];
                    return !evs.some(ev => {
                      if (ev.diaTodo) return true;
                      const es = timeToMinutes(ev.inicio);
                      const ee = ev.fim ? timeToMinutes(ev.fim) : es + 60;
                      return es < slotEnd && ee > slotStart;
                    });
                  });

                  return (
                    <div key={h} style={{ display:"grid", gridTemplateColumns:`60px repeat(${selectedUsers.length}, 1fr)`, height:HOUR_H, borderBottom:"1px solid var(--border-subtle)" }}>
                      {/* Hora */}
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"flex-end", paddingRight:12, paddingTop:4 }}>
                        <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{hStr}</span>
                      </div>

                      {/* Celulas por usuario */}
                      {selectedUsers.map((u, i) => {
                        const evs = (data?.usuarios[u.id] || []).filter(ev => {
                          if (ev.diaTodo) return true;
                          const es = timeToMinutes(ev.inicio);
                          const ee = ev.fim ? timeToMinutes(ev.fim) : es + 60;
                          return es < slotEnd && ee > slotStart;
                        });
                        const busy = evs.length > 0;
                        const color = COLORS[i % COLORS.length];

                        return (
                          <div key={u.id} style={{ position:"relative", borderLeft:"1px solid var(--border-subtle)", background:busy?`${color}10`:"transparent", transition:"background 0.15s" }}>
                            {evs.map((ev, ei) => (
                              <div key={ei} title={ev.titulo} style={{ position:"absolute", top:2, left:4, right:4, background:`${color}30`, border:`1px solid ${color}50`, borderRadius:4, padding:"2px 6px", fontSize:10, color:color, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:500 }}>
                                {!ev.diaTodo && <span style={{ opacity:0.7 }}>{new Date(ev.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} </span>}
                                {ev.titulo}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Linha do horario atual */}
                {(() => {
                  const now = new Date();
                  const todayStr = now.toISOString().slice(0,10);
                  if (todayStr !== date) return null;
                  const mins = now.getHours() * 60 + now.getMinutes();
                  const pct = minutesToPct(mins);
                  if (pct <= 0 || pct >= 100) return null;
                  return (
                    <div style={{ position:"absolute", top:`${pct}%`, left:60, right:0, height:2, background:"var(--accent-red)", zIndex:3, pointerEvents:"none" }}>
                      <div style={{ position:"absolute", left:-6, top:-4, width:10, height:10, borderRadius:"50%", background:"var(--accent-red)" }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}