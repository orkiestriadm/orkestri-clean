"use client";

/**
 * Data UI — primitivas compartilhadas de painéis e listagens.
 *
 * Cada módulo tinha seu próprio cartão de métrica, sua barra de busca e sua
 * tabela, com cores Tailwind cruas (`slate-`, `indigo-`). Aqui a definição é
 * única e sai dos tokens: trocar um token muda todas as telas.
 *
 * Estilos em `styles/globals.css`, seção "Data UI".
 * Regra de ouro: número usa `.metric` (figuras tabulares), para as colunas
 * não "dançarem" ao atualizar.
 */

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, X, Inbox } from "lucide-react";

/* ── Contagem animada ─────────────────────────────────────────
   Sobe até o valor com desaceleração. Respeita prefers-reduced-motion
   e não anima na troca de filtro (só quando o número realmente muda). */
export function useCountUp(value: number, duration = 650) {
  const [display, setDisplay] = useState(value);
  const anterior = useRef(value);

  useEffect(() => {
    const alvo = Number(value) || 0;
    const inicio = anterior.current;
    anterior.current = alvo;

    if (inicio === alvo) { setDisplay(alvo); return; }

    const reduz = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduz) { setDisplay(alvo); return; }

    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(inicio + (alvo - inicio) * eased));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

/* ── Casca da página ──────────────────────────────────────── */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>
      {children}
    </div>
  );
}

export function BackLink({ href = "/dashboard", label = "Voltar" }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="back-link">
      <ChevronLeft size={13} /> {label}
    </Link>
  );
}

/** Cartão de métrica de leitura (não clicável). Para métrica-filtro use StatCard. */
export function KpiCard({
  label, valor, icon, color = "var(--accent-violet)", index = 0, hint,
}: {
  label: string;
  valor: ReactNode;
  icon?: ReactNode;
  color?: string;
  index?: number;
  hint?: string;
}) {
  return (
    <div className="kpi-card" style={{ ["--sc" as any]: color, animationDelay: `${index * 40}ms` }} title={hint}>
      <span className="kpi-card__halo" />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {icon && <span className="kpi-card__icon">{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <div className="metric kpi-card__value">{valor}</div>
          <div className="kpi-card__label">{label}</div>
        </div>
      </div>
    </div>
  );
}

/** Grade padrão de KPIs de leitura. */
export function KpiGrid({ children, min = 180 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14, marginBottom: 20 }}>
      {children}
    </div>
  );
}

/** Navegação em abas padronizada. */
export function Tabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className="tab-btn"
          data-active={active === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Cabeçalho ────────────────────────────────────────────── */
export function PageHeader({
  icon, title, subtitle, accent = "var(--accent-violet)", actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  accent?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head__icon" style={{ ["--sc" as any]: accent }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <h1 className="page-head__title">{title}</h1>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}

/* ── Grade de métricas ────────────────────────────────────── */
export function StatGrid({ children, min = 158 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

/**
 * Cartão-métrica que também é filtro.
 * `total` desenha a barra de participação — passe o universo, não o filtrado.
 * `critical` reserva a pulsação para o que exige ação (vencido, crítico).
 */
export function StatCard({
  label, value, color, active, onClick, total, critical, index = 0,
}: {
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
  total?: number;
  critical?: boolean;
  index?: number;
}) {
  const shown = useCountUp(value);
  const pct = total && total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="stat-card"
      data-active={active ? "true" : "false"}
      data-critical={critical && value > 0 ? "true" : "false"}
      aria-pressed={active}
      title={active ? `Remover filtro: ${label}` : `Filtrar por ${label}`}
      style={{ ["--sc" as any]: color, animationDelay: `${index * 45}ms` }}
    >
      <span className="stat-card__head">
        <span className="stat-card__dot" />
        <span className="mono-cap">{label}</span>
      </span>

      <span className="metric stat-card__value">{fmt(shown)}</span>

      <span className="stat-card__foot">
        {total != null && total > 0 ? (
          <span className="stat-card__bar"><i style={{ width: `${pct}%` }} /></span>
        ) : <span style={{ flex: 1 }} />}
        <span className="stat-card__hint">{active ? "● filtrando" : "filtrar"}</span>
      </span>
    </button>
  );
}

/* ── Barra de ferramentas ─────────────────────────────────── */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar" style={{ marginBottom: 20 }}>{children}</div>;
}

export function SearchInput({
  value, onChange, placeholder = "Pesquisar...",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search-field">
      <Search size={14} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" className="search-field__clear" onClick={() => onChange("")} aria-label="Limpar busca">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  value, onChange, options, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select className="select-field" value={value} onChange={e => onChange(e.target.value)} aria-label={placeholder}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ── Tabela ───────────────────────────────────────────────── */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="table-card">
      <div className="table-scroll-wrapper" style={{ overflowX: "auto" }}>
        <table className="data-table">{children}</table>
      </div>
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="row-actions">{children}</div>;
}

export function RowAction({
  tone = "view", title, onClick, children,
}: {
  tone?: "view" | "edit" | "danger" | "hist";
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="row-action" data-tone={tone} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

export function EmptyState({
  title = "Nenhum registro encontrado", hint, icon, colSpan,
}: { title?: string; hint?: string; icon?: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div className="empty-state">
          <span className="empty-state__icon">{icon || <Inbox size={20} />}</span>
          <span className="empty-state__title">{title}</span>
          {hint && <span className="empty-state__hint">{hint}</span>}
        </div>
      </td>
    </tr>
  );
}

/** Esqueleto com shimmer — evita o salto de layout do "Carregando...". */
export function LoadingRows({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan}>
            <span className="skeleton" style={{ display: "block", height: 14, width: `${88 - i * 7}%`, opacity: 1 - i * 0.13 }} />
          </td>
        </tr>
      ))}
    </>
  );
}
