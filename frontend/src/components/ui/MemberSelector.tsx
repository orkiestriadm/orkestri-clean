"use client";
import { useState } from "react";

type User = { id: string; nome: string; email: string; ativo?: boolean; };

export default function MemberSelector({
  users, selected, onChange, label = "MEMBROS"
}: {
  users: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeUsers = users.filter(u => u.ativo !== false);
  const filtered = activeUsers.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const selectedUsers = users.filter(u => selected.includes(u.id));

  return (
    <div>
      <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", display:"block", marginBottom:6 }}>{label}</label>

      {/* Preview dos selecionados */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
        {selectedUsers.map(u => (
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px 3px 6px", borderRadius:20, background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.25)" }}>
            <div style={{ width:18, height:18, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.5),rgba(34,211,238,0.4))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"var(--accent-violet)" }}>
              {u.nome.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize:12, color:"var(--accent-violet)", fontWeight:500 }}>{u.nome.split(" ")[0]}</span>
            <button onClick={() => toggle(u.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(124,58,237,0.6)", fontSize:14, lineHeight:1, padding:0, display:"flex" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
        <button onClick={() => setOpen(true)} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:"var(--bg-hover)", border:"1px dashed var(--border-medium)", cursor:"pointer", fontSize:12, color:"var(--text-muted)", transition:"all 0.15s" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-violet)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--border-medium)"}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
          {selectedUsers.length === 0 ? "Selecionar membros" : "Adicionar mais"}
        </button>
      </div>

      {/* Modal de selecao */}
      {open && (
        <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) setOpen(false); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:400 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h3 style={{ fontFamily:"var(--font-display)", fontSize:15, fontWeight:700, color:"var(--text-primary)" }}>Selecionar membros</h3>
              <button className="btn-icon" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <input className="input-o" placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom:12 }} />

            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:280, overflowY:"auto" }}>
              {filtered.length === 0 ? (
                <p style={{ color:"var(--text-muted)", fontSize:12, textAlign:"center", padding:"20px 0" }}>Nenhum usuario encontrado</p>
              ) : filtered.map(u => {
                const isSel = selected.includes(u.id);
                return (
                  <div key={u.id} onClick={() => toggle(u.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:10, cursor:"pointer", background:isSel?"var(--accent-violet-dim)":"transparent", border:isSel?"1px solid rgba(124,58,237,0.2)":"1px solid transparent", transition:"all 0.15s" }}
                    onMouseEnter={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                    onMouseLeave={e => { if(!isSel)(e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>
                      {u.nome.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--text-primary)" }}>{u.nome}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)" }}>{u.email}</div>
                    </div>
                    <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${isSel?"var(--accent-violet)":"var(--border-medium)"}`, background:isSel?"var(--accent-violet)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                      {isSel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>{selected.length} selecionado{selected.length !== 1 ? "s" : ""}</span>
              <button className="btn btn-violet" style={{ fontSize:13 }} onClick={() => setOpen(false)}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}