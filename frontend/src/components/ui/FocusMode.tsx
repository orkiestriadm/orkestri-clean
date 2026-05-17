"use client";
import { useState, useEffect, useCallback } from "react";

type Phase = "foco" | "pausa" | "pausa_longa";

const PHASES: Record<Phase, { label: string; duration: number; color: string }> = {
  foco:       { label:"Foco",        duration:25*60, color:"var(--accent-violet)" },
  pausa:      { label:"Pausa curta", duration:5*60,  color:"var(--accent-green)"  },
  pausa_longa:{ label:"Pausa longa", duration:15*60, color:"var(--accent-cyan)"   },
};

function pad(n: number) { return String(n).padStart(2,"0"); }
function fmt(s: number) { return `${pad(Math.floor(s/60))}:${pad(s%60)}`; }

export default function FocusMode({ onClose }: { onClose: () => void }) {
  const [phase,      setPhase]      = useState<Phase>("foco");
  const [seconds,    setSeconds]    = useState(PHASES.foco.duration);
  const [running,    setRunning]    = useState(false);
  const [rounds,     setRounds]     = useState(0);
  const [taskName,   setTaskName]   = useState("");
  const [totalFocus, setTotalFocus] = useState(0);

  const phaseCfg = PHASES[phase];
  const pct = ((phaseCfg.duration - seconds) / phaseCfg.duration) * 100;
  const circumference = 2 * Math.PI * 54;

  const next = useCallback(() => {
    const newRounds = phase === "foco" ? rounds + 1 : rounds;
    setRounds(newRounds);
    if (phase === "foco") {
      setTotalFocus(t => t + PHASES.foco.duration);
      const nextPhase: Phase = newRounds % 4 === 0 ? "pausa_longa" : "pausa";
      setPhase(nextPhase);
      setSeconds(PHASES[nextPhase].duration);
    } else {
      setPhase("foco");
      setSeconds(PHASES.foco.duration);
    }
    setRunning(false);
    // Notificacao sonora simples
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, [phase, rounds]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(iv); next(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running, next]);

  const toggle = () => setRunning(r => !r);
  const reset  = () => { setRunning(false); setSeconds(phaseCfg.duration); };
  const switchPhase = (p: Phase) => { setPhase(p); setSeconds(PHASES[p].duration); setRunning(false); };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"var(--bg-secondary)", border:"1px solid var(--border-medium)", borderRadius:24, padding:40, width:360, display:"flex", flexDirection:"column", alignItems:"center", gap:24, boxShadow:"0 40px 80px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%" }}>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:18, fontWeight:700, color:"var(--text-primary)" }}>Modo Foco</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{rounds} rodada{rounds!==1?"s":""} completada{rounds!==1?"s":""}</div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Seletor de fase */}
        <div style={{ display:"flex", gap:4, background:"var(--bg-hover)", borderRadius:10, padding:4, width:"100%" }}>
          {(Object.keys(PHASES) as Phase[]).map(p => (
            <button key={p} onClick={()=>switchPhase(p)} style={{ flex:1, padding:"6px 4px", borderRadius:7, background:phase===p?phaseCfg.color:"transparent", border:"none", color:phase===p?"white":"var(--text-muted)", fontSize:11, cursor:"pointer", fontWeight:phase===p?600:400, transition:"all 0.2s" }}>
              {PHASES[p].label}
            </button>
          ))}
        </div>

        {/* Timer circular */}
        <div style={{ position:"relative", width:140, height:140 }}>
          <svg width="140" height="140" style={{ transform:"rotate(-90deg)" }}>
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
            <circle cx="70" cy="70" r="54" fill="none" stroke={phaseCfg.color} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (pct / 100) * circumference}
              strokeLinecap="round"
              style={{ transition:"stroke-dashoffset 1s linear", filter:`drop-shadow(0 0 8px ${phaseCfg.color})` }}
            />
          </svg>
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:28, fontWeight:700, color:"var(--text-primary)", letterSpacing:2 }}>{fmt(seconds)}</div>
            <div style={{ fontSize:11, color:phaseCfg.color, fontWeight:500 }}>{phaseCfg.label}</div>
          </div>
        </div>

        {/* Task atual */}
        <input className="input-o" placeholder="Em qual task voce esta focado?" value={taskName} onChange={e=>setTaskName(e.target.value)} style={{ width:"100%", textAlign:"center", fontSize:13 }} />

        {/* Controles */}
        <div style={{ display:"flex", gap:10, width:"100%" }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={reset}>Resetar</button>
          <button className="btn" style={{ flex:2, background:running?"var(--accent-red)":"linear-gradient(135deg,#7c3aed,#6d28d9)", border:"none", color:"white", fontWeight:700, fontSize:15, letterSpacing:"0.04em" }} onClick={toggle}>
            {running ? "Pausar" : seconds===phaseCfg.duration ? "Iniciar" : "Continuar"}
          </button>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={next}>Pular</button>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%" }}>
          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:16, fontWeight:700, color:"var(--accent-violet)" }}>{fmt(totalFocus)}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)" }}>Tempo focado</div>
          </div>
          <div style={{ background:"var(--bg-hover)", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:16, fontWeight:700, color:"var(--accent-green)" }}>{rounds}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)" }}>Rodadas</div>
          </div>
        </div>
      </div>
    </div>
  );
}