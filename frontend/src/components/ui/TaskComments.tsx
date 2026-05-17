"use client";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

type Comment = { id: string; texto: string; criadoEm: string; user: { id: string; nome: string; }; };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function TaskComments({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { user: me } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text,     setText]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`);
      setComments(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [taskId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [comments]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { conteudo: text });
      setText("");
      load();
    } catch {} finally { setSending(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em" }}>
        COMENTARIOS ({comments.length})
      </div>

      <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, padding:"4px 0" }}>
        {loading && <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:16 }}>Carregando...</div>}
        {!loading && comments.length === 0 && (
          <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", padding:12, fontStyle:"italic" }}>
            Nenhum comentario. Use @ para mencionar alguem.
          </div>
        )}
        {comments.map(c => {
          const isMe = c.user.id === me?.id;
          return (
            <div key={c.id} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,rgba(124,58,237,0.4),rgba(34,211,238,0.3))", border:"1px solid rgba(124,58,237,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"var(--accent-violet)", flexShrink:0 }}>
                {c.user.nome.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:isMe?"var(--accent-violet)":"var(--text-secondary)" }}>{isMe?"Voce":c.user.nome}</span>
                  <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{timeAgo(c.criadoEm)}</span>
                </div>
                <div style={{ fontSize:12, color:"var(--text-primary)", lineHeight:1.5, background:"var(--bg-hover)", borderRadius:8, padding:"6px 10px" }}>
                  {(c as any).conteudo.split(/(@\w+)/g).map((part, i) =>
                    part.startsWith("@")
                      ? <span key={i} style={{ color:"var(--accent-violet)", fontWeight:600 }}>{part}</span>
                      : <span key={i}>{part}</span>
                  )}
                </div>
              </div>
              {isMe && (
                <button onClick={async()=>{ await api.delete(`/projects/${projectId}/tasks/${c.id}/comments/${c.id}`); load(); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:4, flexShrink:0, display:"flex", opacity:0.5 }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.opacity="1"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.opacity="0.5"}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display:"flex", gap:6 }}>
        <input
          className="input-o"
          placeholder="Comentar... use @nome para mencionar"
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
          style={{ flex:1, fontSize:12 }}
        />
        <button className="btn btn-violet" style={{ flexShrink:0, padding:"8px 12px" }} onClick={send} disabled={sending||!text.trim()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
}