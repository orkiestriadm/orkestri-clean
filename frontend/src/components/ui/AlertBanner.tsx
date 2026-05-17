"use client";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { playAlertSound } from "@/lib/soundEngine";
import { OrkestriLogo } from "@/components/ui/logo";
import { Clock, X } from "lucide-react";

type UpcomingEvent = { id: string; titulo: string; inicio: string; cor: string; tipo: string; minutosRestantes: number; };

export default function AlertBanner() {
  const { token } = useAuthStore();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [criticalAck, setCriticalAck] = useState<Set<string>>(new Set());
  const alertedRef = useRef<Set<string>>(new Set());
  const [volume] = useState(0.5);

  useEffect(() => {
    if (!token) return;
    const check = async () => {
      try {
        const { data } = await api.get("/notifications/upcoming-events");
        setEvents(data);

        for (const ev of data) {
          const thresholdKey = ev.minutosRestantes <= 1 ? "0" : ev.minutosRestantes <= 7 ? "5" : ev.minutosRestantes <= 20 ? "15" : "60";
          const alertKey = `${ev.id}-${thresholdKey}`;
          if (!alertedRef.current.has(alertKey)) {
            alertedRef.current.add(alertKey);
            playAlertSound(ev.minutosRestantes, volume);
            if (Notification.permission === "granted") {
              const title = ev.minutosRestantes <= 0 ? "Evento agora!" : `em ${ev.minutosRestantes} min`;
              new Notification(`Orkestri - ${title}`, {
                body: ev.titulo,
                icon: "/icon-192.png",
                tag: alertKey,
                requireInteraction: ev.minutosRestantes <= 5,
              });
            }
          }
        }
      } catch {}
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, [token, volume]);

  const visible = events.filter(e => !dismissed.has(e.id));
  const critical = visible.filter(e => e.minutosRestantes <= 5 && !criticalAck.has(e.id));
  const warnings = visible.filter(e => e.minutosRestantes > 5 && e.minutosRestantes <= 15);
  const reminders = visible.filter(e => e.minutosRestantes > 15);

  if (visible.length === 0) return null;

  return (
    <>
      {/* 🚨 CRITICAL ALERTS (MODAL) */}
      {critical.map(ev => (
        <div key={ev.id} className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-3xl p-10 max-w-[440px] w-[90%] text-center shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ boxShadow: `0 20px 80px -20px ${ev.cor}40` }}
          >
            <div className="flex justify-center mb-6 animate-pulse">
              <OrkestriLogo size={64} />
            </div>
            
            <div className="font-mono text-[11px] tracking-widest font-bold mb-2 uppercase" style={{ color: ev.cor }}>
              {ev.minutosRestantes <= 0 ? "Acontecendo Agora" : `Faltam ${ev.minutosRestantes} minuto${ev.minutosRestantes > 1 ? "s" : ""}`}
            </div>
            
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              {ev.titulo}
            </h2>
            
            <p className="text-[14px] text-muted-foreground font-medium mb-8">
              {new Date(ev.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} • {ev.tipo}
            </p>
            
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => { setCriticalAck(s => new Set([...s,ev.id])); playAlertSound(-1, 0); }} 
                className="px-8 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-md"
              >
                Estou ciente
              </button>
              <button 
                onClick={() => { setCriticalAck(s => new Set([...s,ev.id])); setDismissed(s => new Set([...s,ev.id])); }} 
                className="px-5 py-3 rounded-xl bg-transparent border border-border text-foreground font-semibold text-[15px] hover:bg-accent transition-colors"
              >
                Dispensar
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* ⚠️ WARNINGS (TOP BANNER) */}
      {warnings.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-2">
          {warnings.map(ev => (
            <div key={ev.id} className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-xl animate-in slide-in-from-top-10 duration-400 min-w-[360px]">
              <Clock style={{ color: ev.cor }} size={20} />
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-foreground leading-tight">{ev.titulo}</div>
                <div className="text-[12px] font-mono font-medium mt-0.5" style={{ color: ev.cor }}>
                  em {ev.minutosRestantes} minutos • {new Date(ev.inicio).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                </div>
              </div>
              <button onClick={() => setDismissed(s => new Set([...s,ev.id]))} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 🗓️ REMINDERS (BOTTOM RIGHT TOASTS) */}
      {reminders.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[500] flex flex-col gap-2">
          {reminders.slice(0,3).map(ev => (
            <div key={ev.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-right-10 duration-400 min-w-[280px]">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: ev.cor, boxShadow: `0 0 8px ${ev.cor}` }} />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-foreground leading-tight">{ev.titulo}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">em {ev.minutosRestantes} min</div>
              </div>
              <button onClick={() => setDismissed(s => new Set([...s,ev.id]))} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}