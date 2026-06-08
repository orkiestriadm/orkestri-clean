"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type Props = {
  selectedDate: Date;
  /** datas (YYYY-MM-DD) que têm pelo menos 1 evento — mostra pontinho */
  eventDates?: Set<string>;
  onChange: (d: Date) => void;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MiniCalendar({ selectedDate, eventDates, onChange }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const today = new Date();

  const cells = useMemo(() => {
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth  = new Date(year, month + 1, 0);
    const startWeekday = firstOfMonth.getDay();   // 0 = Dom
    const daysInMonth  = lastOfMonth.getDate();

    // calcula células para sempre exibir 6 semanas (42 cells) — visual estável
    const arr: { d: Date; outOfMonth: boolean }[] = [];
    // dias do mês anterior pra preencher início
    for (let i = startWeekday - 1; i >= 0; i--) {
      arr.push({ d: new Date(year, month, -i), outOfMonth: true });
    }
    // dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push({ d: new Date(year, month, i), outOfMonth: false });
    }
    // dias do mês seguinte pra preencher 42 células
    let next = 1;
    while (arr.length < 42) {
      arr.push({ d: new Date(year, month + 1, next++), outOfMonth: true });
    }
    return arr;
  }, [viewMonth]);

  const prevMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button
          onClick={prevMonth}
          aria-label="Mês anterior"
          style={{ background: "transparent", border: "none", padding: 4, borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <button
          onClick={() => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            color: "var(--text-primary)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
          aria-label={`${MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()} — clique para voltar ao mês atual`}
          title="Voltar ao mês atual"
        >
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </button>
        <button
          onClick={nextMonth}
          aria-label="Próximo mês"
          style={{ background: "transparent", border: "none", padding: 4, borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS_SHORT.map((d, i) => (
          <div key={i} style={{
            textAlign: "center",
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            color: i === 0 || i === 6 ? "var(--text-muted)" : "var(--text-secondary)",
            opacity: 0.7,
            padding: "2px 0",
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map(({ d, outOfMonth }, i) => {
          const isToday    = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDate);
          const hasEvent   = eventDates?.has(dateKey(d));
          const isWeekend  = d.getDay() === 0 || d.getDay() === 6;

          let bg = "transparent";
          let color = outOfMonth ? "var(--text-muted)" : isWeekend ? "var(--text-muted)" : "var(--text-primary)";
          let fontWeight: number = 400;
          let border = "1px solid transparent";

          if (isSelected) {
            bg = "var(--accent-violet)";
            color = "white";
            fontWeight = 700;
          } else if (isToday) {
            bg = "rgba(124,58,237,0.12)";
            color = "var(--accent-violet)";
            fontWeight = 700;
            border = "1px solid rgba(124,58,237,0.5)";
          }
          if (outOfMonth) {
            color = "var(--text-muted)";
            fontWeight = 400;
          }

          return (
            <button
              key={i}
              onClick={() => onChange(d)}
              aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]}`}
              aria-current={isToday ? "date" : undefined}
              style={{
                position: "relative",
                aspectRatio: "1",
                minHeight: 26,
                borderRadius: 6,
                background: bg,
                color,
                fontWeight,
                border,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.12s",
                opacity: outOfMonth ? 0.4 : 1,
                padding: 0,
                fontFamily: "var(--font-mono)",
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = isToday ? "rgba(124,58,237,0.12)" : "transparent"; }}
            >
              {d.getDate()}
              {hasEvent && !isSelected && (
                <span style={{
                  position: "absolute",
                  bottom: 2,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: isToday ? "var(--accent-violet)" : "var(--accent-cyan, #22d3ee)",
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
