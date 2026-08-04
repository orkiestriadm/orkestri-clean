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
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Search, X, Inbox,
  AlertTriangle, Lock, RotateCw,
} from "lucide-react";

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

/* ── Estados obrigatórios ─────────────────────────────────────
   FRONTEND.md §20 exige loading, vazio, erro, sucesso e sem-permissão
   em toda tela. Vazio e loading já existem acima; faltavam estes dois,
   e cada tela improvisava o seu. */

/**
 * Falha de carregamento — sempre com caminho de saída.
 *
 * Erro sem ação deixa o usuário travado; `onRetry` é a diferença entre
 * informar e resolver.
 */
export function ErrorState({
  title = "Não foi possível carregar",
  detail,
  onRetry,
  colSpan,
}: { title?: string; detail?: string; onRetry?: () => void; colSpan?: number }) {
  const conteudo = (
    <div className="state-block" data-tone="error">
      <span className="state-block__icon"><AlertTriangle size={20} /></span>
      <span className="state-block__title">{title}</span>
      {detail && <span className="state-block__hint">{detail}</span>}
      {onRetry && (
        <button type="button" className="state-block__action" onClick={onRetry}>
          <RotateCw size={13} /> Tentar novamente
        </button>
      )}
    </div>
  );
  // Dentro de tabela precisa de <tr>/<td>; fora, é bloco solto.
  if (colSpan == null) return conteudo;
  return <tr><td colSpan={colSpan} style={{ padding: 0 }}>{conteudo}</td></tr>;
}

/**
 * Acesso negado.
 *
 * Estado distinto de "vazio": o dado existe, o usuário é que não alcança.
 * Confundir os dois faz o usuário procurar um registro que nunca vai ver.
 */
export function PermissionDenied({
  title = "Você não tem acesso a esta informação",
  hint = "Fale com o administrador da sua organização se precisar deste acesso.",
  colSpan,
}: { title?: string; hint?: string; colSpan?: number }) {
  const conteudo = (
    <div className="state-block" data-tone="denied">
      <span className="state-block__icon"><Lock size={20} /></span>
      <span className="state-block__title">{title}</span>
      <span className="state-block__hint">{hint}</span>
    </div>
  );
  if (colSpan == null) return conteudo;
  return <tr><td colSpan={colSpan} style={{ padding: 0 }}>{conteudo}</td></tr>;
}

/* ── Paginação ────────────────────────────────────────────────
   Server-side: a lista de colaboradores pode passar de milhares, e
   trazer tudo para filtrar no cliente não escala. */
export function Pagination({
  pagina, paginas, total, onChange,
}: { pagina: number; paginas: number; total: number; onChange: (p: number) => void }) {
  if (paginas <= 1) return null;

  return (
    <nav className="pagination" aria-label="Paginação">
      <span className="pagination__info num">
        {total.toLocaleString("pt-BR")} {total === 1 ? "registro" : "registros"}
        {" · "}página {pagina} de {paginas}
      </span>
      <span className="pagination__controls">
        <button
          type="button" className="pagination__btn"
          onClick={() => onChange(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button" className="pagination__btn"
          onClick={() => onChange(pagina + 1)}
          disabled={pagina >= paginas}
          aria-label="Próxima página"
        >
          <ChevronRight size={14} />
        </button>
      </span>
    </nav>
  );
}

/* ── Selo de situação ─────────────────────────────────────────
   Cada módulo desenhava o seu; aqui a cor sai de token e o mapa de
   tons é único. `tone` é semântico, não cor — quem chama não escolhe
   hexadecimal. */
export type BadgeTone = "ok" | "neutro" | "atencao" | "critico" | "info";

const TOM_BADGE: Record<BadgeTone, string> = {
  ok: "var(--accent-green)",
  neutro: "var(--text-muted)",
  atencao: "var(--accent-amber)",
  critico: "var(--accent-red)",
  info: "var(--accent-cyan)",
};

export function StatusBadge({ label, tone = "neutro" }: { label: string; tone?: BadgeTone }) {
  return (
    <span className="status-badge" style={{ ["--sc" as any]: TOM_BADGE[tone] }}>
      <span className="status-badge__dot" />
      {label}
    </span>
  );
}

/* ── Página de detalhe ────────────────────────────────────────
   DETAIL_PAGE_BLUEPRINT.md: identidade e ações no topo, conteúdo em
   abas, contexto secundário à direita. */

export function DetailHeader({
  avatar, titulo, subtitulo, selo, meta, actions,
}: {
  avatar?: ReactNode;
  titulo: string;
  subtitulo?: ReactNode;
  selo?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="detail-head">
      {avatar && <div className="detail-head__avatar">{avatar}</div>}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="detail-head__title">{titulo}</h1>
          {selo}
        </div>
        {subtitulo && <p className="detail-head__sub">{subtitulo}</p>}
        {meta && <div className="detail-head__meta">{meta}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}

/** Bloco de campos rotulados. Use para dado de leitura, não para formulário. */
export function FieldGrid({ children, min = 220 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 16 }}>
      {children}
    </div>
  );
}

/** Campo de leitura. Valor ausente vira travessão — nunca string vazia. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  const vazio = value == null || value === "";
  return (
    <div className="field">
      <span className="field__label mono-cap">{label}</span>
      <span className="field__value" data-empty={vazio ? "true" : "false"}>
        {vazio ? "—" : value}
      </span>
    </div>
  );
}

export function Panel({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel__head">
          {title && <span className="panel__title mono-cap">{title}</span>}
          {actions}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </section>
  );
}

/* ── Modal ────────────────────────────────────────────────────
   A casca (.modal-overlay / .modal-box) já existia no globals.css e cada
   tela reimplementava o comportamento — Esc, clique fora, foco. Aqui é
   uma vez só. */
export function Modal({
  aberto, titulo, subtitulo, onFechar, largura = 560, children,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  largura?: number;
  children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  // Renderiza em `document.body`, não no lugar onde foi declarada.
  //
  // POR QUÊ: `.main-area` tem `position: relative; z-index: 1`, o que cria um
  // contexto de empilhamento. Uma modal declarada dentro dela fica presa lá:
  // o `z-index: 1000` do overlay só vale DENTRO do contexto, e quem disputa
  // com o menu lateral (`z-index: 20`) é a `.main-area` inteira, com z-index 1.
  // Resultado: a barra lateral pinta por cima da modal.
  //
  // O sintoma só aparecia em modal larga o bastante para alcançar a lateral —
  // com a largura padrão de 520px numa tela grande, a caixa ficava toda dentro
  // da área de conteúdo e o defeito passava despercebido. Numa janela estreita,
  // ou numa modal de 620px, o título aparecia cortado ao meio.
  //
  // Portar para o body tira a modal de qualquer contexto de empilhamento, que
  // é o comportamento que uma sobreposição de tela cheia sempre deveria ter.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  // Esc fecha, e o scroll do fundo trava: sem isso a página de trás rola
  // quando o cursor sai da caixa.
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Leva o foco para dentro — leitor de tela e teclado ficam presos no
    // conteúdo certo em vez de continuarem na página de trás.
    caixa.current?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onFechar]);

  // `montado` também cobre o SSR: `document` não existe no servidor.
  if (!aberto || !montado) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}
      role="presentation"
    >
      <div
        ref={caixa}
        className="modal-box"
        style={{ maxWidth: largura }}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
      >
        <div className="modal-box__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal-box__title">{titulo}</h2>
            {subtitulo && <p className="modal-box__sub">{subtitulo}</p>}
          </div>
          <button type="button" className="btn-icon" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ── Formulário ───────────────────────────────────────────────
   Rótulo, obrigatoriedade, dica e erro num lugar só. FORM_BLUEPRINT.md
   pede que o formulário comunique o que é exigido, o que está inválido
   e o que aconteceu depois de enviar. */
export function FormGrid({ children, min = 200 }: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 14 }}>
      {children}
    </div>
  );
}

export function FormField({
  label, obrigatorio, erro, dica, children, largura,
}: {
  label: string;
  obrigatorio?: boolean;
  erro?: string | null;
  dica?: string;
  children: ReactNode;
  /** "total" faz o campo ocupar a linha inteira da grade. */
  largura?: "total";
}) {
  return (
    <div className="form-field" style={largura === "total" ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-field__label">
        {label}
        {obrigatorio && <span className="form-field__req" aria-hidden> *</span>}
      </label>
      {children}
      {erro
        ? <span className="form-field__erro" role="alert">{erro}</span>
        : dica ? <span className="form-field__dica">{dica}</span> : null}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}

/* ── Linha do tempo ───────────────────────────────────────────
   Histórico funcional do colaborador. Ordem: mais recente primeiro. */
export type TimelineItem = {
  id: string;
  titulo: string;
  descricao?: string | null;
  data: string | Date;
  tone?: BadgeTone;
};

export function Timeline({ itens }: { itens: TimelineItem[] }) {
  if (itens.length === 0) {
    return (
      <div className="state-block">
        <span className="state-block__icon"><Inbox size={20} /></span>
        <span className="state-block__title">Nenhum evento registrado</span>
      </div>
    );
  }

  return (
    <ol className="timeline">
      {itens.map(item => (
        <li key={item.id} className="timeline__item" style={{ ["--sc" as any]: TOM_BADGE[item.tone ?? "info"] }}>
          <span className="timeline__dot" />
          <div style={{ minWidth: 0 }}>
            <div className="timeline__title">{item.titulo}</div>
            {item.descricao && <div className="timeline__desc">{item.descricao}</div>}
            <time className="timeline__date num">
              {new Date(item.data).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
