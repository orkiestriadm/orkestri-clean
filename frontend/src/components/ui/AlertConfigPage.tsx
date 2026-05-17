"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type AlertConfig = {
  id: string; minutos: number; ativo: boolean;
  emoji: string; titulo: string; mensagem: string;
};

const VARIAVEIS = [
  { var: "{evento}", desc: "Nome do evento" },
  { var: "{horario}", desc: "Horario (ex: 18:00)" },
  { var: "{url}", desc: "Link do sistema" },
];

function ConfigCard({ cfg, onChange }: { cfg: AlertConfig; onChange: (updated: AlertConfig) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(cfg);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tempoLabel = cfg.minutos === 0 ? "Na hora exata" :
    cfg.minutos < 60 ? `${cfg.minutos} minutos antes` : `${cfg.minutos / 60} hora antes`;

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/alert-configs/" + cfg.id, {
        ativo: local.ativo, emoji: local.emoji,
        titulo: local.titulo, mensagem: local.mensagem,
      });
      onChange(local);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } catch {}
    finally { setSaving(false); }
  };

  const toggleAtivo = async () => {
    const updated = { ...local, ativo: !local.ativo };
    setLocal(updated);
    await api.put("/alert-configs/" + cfg.id, { ativo: updated.ativo });
    onChange(updated);
  };

  const urgColor = cfg.minutos <= 0 ? "var(--accent-red)" : cfg.minutos <= 5 ? "#f97316" : cfg.minutos <= 15 ? "var(--accent-amber)" : "var(--accent-violet)";

  return (
    <div className="card" style={{ padding:"20px 24px", borderLeft:`3px solid ${urgColor}`, opacity: local.ativo ? 1 : 0.5, transition:"opacity 0.2s" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: editing ? 16 : 0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:28 }}>{local.emoji}</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
              <span style={{ fontFamily:"var(--font-display)", fontSize:14, fontWeight:600, color:"var(--text-primary)" }}>{local.titulo}</span>
              <span className="badge" style={{ fontSize:10, background: urgColor+"15", color: urgColor, border:`1px solid ${urgColor}30` }}>{tempoLabel}</span>
            </div>
            {!editing && <p style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5, maxWidth:400, whiteSpace:"pre-line" }}>{local.mensagem.split("\n")[0]}...</p>}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {saved && <span style={{ fontSize:11, color:"var(--accent-green)" }}>Salvo!</span>}
          <button className={`btn ${local.ativo ? "btn-ghost" : "btn-violet"}`} style={{ fontSize:11, padding:"5px 12px" }} onClick={toggleAtivo}>
            {local.ativo ? "Desativar" : "Ativar"}
          </button>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"5px 12px" }} onClick={() => setEditing(e => !e)}>
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ display:"flex", flexDirection:"column", gap:14, marginTop:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>EMOJI</label>
              <input className="input-o" value={local.emoji} onChange={e => setLocal(p => ({ ...p, emoji: e.target.value }))} style={{ textAlign:"center", fontSize:20 }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>TITULO DO ALERTA</label>
              <input className="input-o" value={local.titulo} onChange={e => setLocal(p => ({ ...p, titulo: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)", display:"block", marginBottom:6 }}>MENSAGEM WHATSAPP</label>
            <textarea className="input-o" value={local.mensagem} onChange={e => setLocal(p => ({ ...p, mensagem: e.target.value }))} style={{ minHeight:100, resize:"vertical", fontFamily:"var(--font-mono)", fontSize:12 }} />
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
              {VARIAVEIS.map(v => (
                <button key={v.var} onClick={() => setLocal(p => ({ ...p, mensagem: p.mensagem + v.var }))} style={{ background:"var(--accent-violet-dim)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:6, padding:"3px 8px", fontSize:11, color:"var(--accent-violet)", cursor:"pointer", fontFamily:"var(--font-mono)" }} title={v.desc}>
                  {v.var}
                </button>
              ))}
            </div>
            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>Clique nas variaveis acima para inserir na mensagem</p>
          </div>

          <div style={{ background:"rgba(34,211,238,0.05)", border:"1px solid rgba(34,211,238,0.15)", borderRadius:8, padding:"10px 14px" }}>
            <div style={{ fontSize:11, color:"var(--accent-cyan)", fontWeight:500, marginBottom:6 }}>Previa da mensagem:</div>
            <div style={{ fontSize:12, color:"var(--text-secondary)", fontFamily:"var(--font-mono)", lineHeight:1.7, whiteSpace:"pre-line" }}>
              {local.emoji} Orkestri{"\n"}{local.mensagem.replace(/{evento}/g,"Reuniao de Alinhamento").replace(/{horario}/g,"18:00").replace(/{url}/g,"http://orkestri.local")}
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
            <button className="btn btn-ghost" onClick={() => { setLocal(cfg); setEditing(false); }}>Cancelar</button>
            <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alteracoes"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AlertConfigPage({ onClose }: { onClose: () => void }) {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/alert-configs").then(r => setConfigs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="modal-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains("modal-overlay")) onClose(); }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:620 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div>
            <h3 style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:700, color:"var(--text-primary)" }}>Configurar Alertas</h3>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>Personalize os textos e emojis de cada alerta</p>
          </div>
          <button className="btn-icon" onClick={onClose}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        <div style={{ background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:8, padding:"10px 14px", marginBottom:20 }}>
          <div style={{ fontSize:12, color:"var(--accent-amber)", lineHeight:1.6 }}>
            <strong>Variaveis disponiveis:</strong> use <code style={{ background:"rgba(251,191,36,0.15)", padding:"1px 5px", borderRadius:4 }}>{"{evento}"}</code>, <code style={{ background:"rgba(251,191,36,0.15)", padding:"1px 5px", borderRadius:4 }}>{"{horario}"}</code> e <code style={{ background:"rgba(251,191,36,0.15)", padding:"1px 5px", borderRadius:4 }}>{"{url}"}</code> nas mensagens.
          </div>
        </div>

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:32 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {configs.map(cfg => (
              <ConfigCard key={cfg.id} cfg={cfg} onChange={updated => setConfigs(p => p.map(c => c.id === updated.id ? updated : c))} />
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}