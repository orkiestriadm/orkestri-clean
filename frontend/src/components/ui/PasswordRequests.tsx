"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

type Request = { id: string; titulo: string; mensagem: string; criadoEm: string; };

export default function PasswordRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<Request[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user?.isMaster) return;
    try { const { data } = await api.get("/auth/password-requests"); setRequests(data); } catch {}
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [user]);

  const resolve = async (id: string) => {
    await api.post("/auth/password-requests/" + id + "/resolve");
    setRequests(p => p.filter(r => r.id !== id));
  };

  if (!user?.isMaster || requests.length === 0) return null;

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ position:"relative", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:8, padding:"8px 12px", color:"var(--accent-amber)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontFamily:"var(--font-body)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
        {requests.length} solicitacao{requests.length > 1 ? "s" : ""} de senha
        <div style={{ position:"absolute", top:-4, right:-4, width:8, height:8, borderRadius:"50%", background:"var(--accent-amber)", animation:"glowPulse 2s infinite" }} />
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, width:340, background:"var(--modal-bg)", border:"1px solid var(--border-medium)", borderRadius:12, boxShadow:"0 20px 40px rgba(0,0,0,0.3)", zIndex:100, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", fontFamily:"var(--font-display)" }}>Solicitacoes de senha</span>
            <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:16 }}>x</button>
          </div>
          {requests.map(r => (
            <div key={r.id} style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-subtle)", display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ fontSize:13, color:"var(--text-primary)", fontWeight:500 }}>{r.titulo}</div>
              <div style={{ fontSize:12, color:"var(--text-secondary)" }}>{r.mensagem}</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{new Date(r.criadoEm).toLocaleString("pt-BR")}</span>
                <button onClick={() => resolve(r.id)} style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:6, padding:"4px 10px", color:"var(--accent-green)", fontSize:11, cursor:"pointer" }}>Marcar resolvido</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes glowPulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>
    </div>
  );
}