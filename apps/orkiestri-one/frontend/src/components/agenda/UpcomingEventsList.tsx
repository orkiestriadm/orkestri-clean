"use client";
import { Users, CalendarDays, Briefcase, Bell, ClipboardList, CalendarRange } from "lucide-react";

type AgendaEvent = {
  id: string;
  titulo: string;
  inicio: string;
  fim?: string;
  tipo: string;
  cor: string;
  diaTodo: boolean;
  confirmado: boolean;
  local?: string;
};

type Props = {
  events: AgendaEvent[];
  /** quantos eventos no máximo (default 5) */
  limit?: number;
  onPick: (ev: AgendaEvent) => void;
};

const ICONS: Record<string, any> = {
  REUNIAO: Users,
  COMPROMISSO: CalendarDays,
  PROJETO: Briefcase,
  LEMBRETE: Bell,
  PESSOAL: ClipboardList,
};

function fmtRelDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  let day = "";
  if (diffDays === 0) day = "Hoje";
  else if (diffDays === 1) day = "Amanhã";
  else if (diffDays > 1 && diffDays < 7) day = d.toLocaleDateString("pt-BR", { weekday: "short" });
  else day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

export default function UpcomingEventsList({ events, limit = 5, onPick }: Props) {
  const now = Date.now();
  const upcoming = events
    .filter(e => new Date(e.inicio).getTime() >= now - 3600_000) // tolera evento começou há 1h
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio))
    .slice(0, limit);

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: 12,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: "1px solid var(--border-subtle)",
      }}>
        <CalendarRange size={12} style={{ color: "var(--accent-violet)" }} aria-hidden="true" />
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          PRÓXIMOS EVENTOS
        </span>
      </div>

      {upcoming.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "12px 4px", textAlign: "center", opacity: 0.7 }}>
          Nenhum evento próximo
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {upcoming.map(ev => {
            const Icon = ICONS[ev.tipo] || CalendarDays;
            const rel = fmtRelDate(ev.inicio);
            return (
              <button
                key={ev.id}
                onClick={() => onPick(ev)}
                aria-label={`${ev.titulo} — ${rel.day} ${rel.time}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderLeft: `3px solid ${ev.cor}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s",
                  opacity: ev.confirmado ? 1 : 0.7,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <div style={{
                  marginTop: 2,
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  background: ev.cor + "22",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={11} style={{ color: ev.cor }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {!ev.confirmado && <span style={{ marginRight: 4 }}>⏳</span>}
                    {ev.titulo}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 2,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}>
                    <span style={{ fontWeight: 600, color: ev.cor }}>{rel.day}</span>
                    {!ev.diaTodo && <span>·</span>}
                    {!ev.diaTodo && <span>{rel.time}</span>}
                    {ev.local && <>
                      <span>·</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.local}</span>
                    </>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
