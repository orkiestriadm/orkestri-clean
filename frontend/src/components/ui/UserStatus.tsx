"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

const STATUS_OPTIONS = [
  { value:"disponivel", label:"Disponivel",  color:"var(--accent-green)" },
  { value:"ocupado",    label:"Ocupado",     color:"var(--accent-amber)" },
  { value:"reuniao",    label:"Em reuniao",  color:"var(--accent-red)" },
  { value:"foco",       label:"Modo foco",   color:"var(--accent-violet)" },
  { value:"ausente",    label:"Ausente",     color:"var(--text-muted)" },
];

export function StatusDot({ status, size=8 }: { status: string; size?: number }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:opt.color, boxShadow:`0 0 ${size}px ${opt.color}80`, flexShrink:0 }} />
  );
}

export default function UserStatus({ compact = false }: { compact?: boolean }) {
  const [status,  setStatus]  = useState("disponivel");
  const [open,    setOpen]    = useState(false);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get("/users/me/status").then(r => setStatus(r.data.status)).catch(() => {});
  }, []);

  const update = async (val: string) => {
    setSaving(true);
    setStatus(val);
    setOpen(false);
    try { await api.patch("/users/me/status", { status: val }); }
    catch { }
    finally { setSaving(false); }
  };

  const current = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"none", cursor:"pointer", padding:0 }} title="Alterar status">
        <StatusDot status={status} size={8} />
        {!compact && <span style={{ fontSize:10, color:current.color, fontFamily:"var(--font-mono)", letterSpacing:"0.04em" }}>{current.label.toUpperCase()}</span>}
      </button>

      {open && (
        <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, width:180, background:"var(--modal-bg)", border:"1px solid var(--border-medium)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.2)", zIndex:200, overflow:"hidden" }}>
          <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--border-subtle)" }}>
            <span style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em" }}>MEU STATUS</span>
          </div>
          {STATUS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => update(opt.value)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 14px", background:status===opt.value?"var(--bg-hover)":"transparent", border:"none", cursor:"pointer", textAlign:"left", transition:"background 0.15s" }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--bg-hover)"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=status===opt.value?"var(--bg-hover)":"transparent"}
            >
              <div style={{ width:8, height:8, borderRadius:"50%", background:opt.color, flexShrink:0 }} />
              <span style={{ fontSize:13, color:status===opt.value?opt.color:"var(--text-secondary)", fontWeight:status===opt.value?500:400 }}>{opt.label}</span>
              {status===opt.value && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={opt.color} strokeWidth="2.5" style={{ marginLeft:"auto" }}><path d="M20 6L9 17l-5-5" strokeLinecap="round"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}