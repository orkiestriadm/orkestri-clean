"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  Plus, Search, X, Send, Tag, Building2, Star, Loader2, RefreshCw,
  MessageSquare, ExternalLink, BookOpen, Hand, Inbox, User as UserIcon,
  Globe2, History, AlertCircle, CheckCircle2, Download, Clock, Truck, Users,
  SlidersHorizontal, ChevronDown,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";

// ── Types ──────────────────────────────────────────────────────────────────────
/** Ordem de serviço aberta a partir do chamado, no módulo de Frotas. */
type OsVinculada = {
  id: string; numeroOs?: string; status: string; tipo?: string;
  imobiliza?: boolean; dataAbertura?: string; dataFechamento?: string;
};
type VeiculoLite = { id: string; placa: string; identificacao?: string; marca?: string; modelo?: string };
type Chamado = {
  id: string; numero: number; titulo: string; descricao: string;
  status: string; prioridade: string; categoria?: string; tags?: string;
  solicitanteId: string; atendenteId?: string; clienteId?: string;
  slaHoras?: number; slaStatus?: "ok" | "risco" | "violado";
  resolvidoEm?: string; fechadoEm?: string;
  avaliacao?: number; avaliacaoNota?: string;
  criadoEm: string; atualizadoEm: string;
  solicitante: { id: string; nome: string; email: string };
  atendente?: { id: string; nome: string; email: string };
  cliente?: { id: string; nome: string; empresa?: string };
  aguardandoMotivo?: string | null;
  aguardandoDesde?: string | null;
  atribuidoPorId?: string | null;
  atribuidoPor?: { id: string; nome: string; email?: string } | null;
  veiculoId?: string | null;
  veiculo?: { id: string; placa: string; identificacao?: string; marca?: string; modelo?: string } | null;
  manutencoes?: OsVinculada[];
  comentarios?: Comentario[];
};
type Comentario = {
  id: string; userId: string; texto: string;
  interno: boolean; criadoEm: string;
  user: { id: string; nome: string };
};
type Stats = {
  total: number; aberto: number; em_atendimento: number;
  aguardando: number; resolvido: number; fechado: number;
  slaViolados: number; slaEmRisco: number;
  fila?: number; meus?: number;
};
type AuditoriaEntry = {
  id: string; acao: string; de?: string | null; para?: string | null;
  metadata?: any; criadoEm: string;
  user: { id: string; nome: string; avatar?: string } | null;
};
type Scope = "fila" | "meus" | "todos";
type Usuario = { id: string; nome: string; email: string };
type Cliente = { id: string; nome: string; empresa?: string };

// ── Constants ──────────────────────────────────────────────────────────────────
const STATUS_COLS = [
  { key: "aberto",         label: "Aberto",         color: "#94a3b8", bg: "surface-sunken",   border: "border-subtle-o"  },
  { key: "em_atendimento", label: "Em Atendimento", color: "#60a5fa", bg: "bg-blue-500/10",    border: "border-blue-500/30"   },
  { key: "aguardando",     label: "Aguardando",     color: "#fbbf24", bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  { key: "resolvido",      label: "Resolvido",      color: "#34d399", bg: "bg-emerald-500/10", border: "border-emerald-500/30"},
  { key: "fechado",        label: "Fechado",        color: "#a78bfa", bg: "bg-violet-500/10",  border: "border-violet-500/30" },
];
/** Colunas do quadro pessoal. "Aberto" fica de fora: um chamado aberto só
 *  existe sem atendente — e esse é exatamente o conjunto da fila pública,
 *  logo acima na mesma tela. A coluna era duplicata. */
const COLS_KANBAN = STATUS_COLS.filter(c => c.key !== "aberto");

/** Colunas terminais: o chamado já saiu do fluxo e só continua ali para o caso
 *  de precisar reabrir ou conferir. Passado esse prazo, isso não acontece mais
 *  — e o quadro fica ocupado por trabalho morto. */
const COLS_TERMINAIS = ["resolvido", "fechado"];
const DIAS_TERMINAL = 5;
const TETO_TERMINAL = 6;

/** Recorta uma coluna terminal ao que ainda é recente.
 *  Devolve o que mostrar E quanto ficou de fora — o corte precisa ser dito. */
function recorteTerminal(itens: Chamado[]) {
  const limite = Date.now() - DIAS_TERMINAL * 86400000;
  const quando = (c: Chamado) => new Date(c.fechadoEm || c.resolvidoEm || c.atualizadoEm).getTime();
  const recentes = itens
    .filter(c => quando(c) >= limite)
    .sort((a, b) => quando(b) - quando(a));
  return { visiveis: recentes.slice(0, TETO_TERMINAL), ocultos: itens.length - Math.min(recentes.length, TETO_TERMINAL) };
}
const PRIORIDADE_MAP: Record<string, { label: string; color: string; dot: string }> = {
  baixa:   { label: "Baixa",   color: "text-muted-o",  dot: "bg-[var(--text-muted)]"  },
  media:   { label: "Média",   color: "text-blue-400",   dot: "bg-blue-400"   },
  alta:    { label: "Alta",    color: "text-orange-400", dot: "bg-orange-400" },
  critica: { label: "Crítica", color: "text-red-400",    dot: "bg-red-400"    },
};
const SLA_STATUS_MAP = {
  risco:   { label: "SLA em Risco", cls: "text-yellow-400" },
  violado: { label: "SLA Violado",  cls: "text-red-400"    },
};
/** "Frotas" não é uma categoria qualquer: escolhê-la habilita o veículo no
 *  formulário, e é o veículo que permite o chamado virar ordem de serviço. */
const CATEGORIA_FROTAS = "Frotas";

/**
 * Condição do veículo relatada por quem abre o chamado.
 *
 * Serve a UMA pergunta de quem vai atender: dá para esperar? Um veículo parado
 * na estrada e um veículo rodando com barulho no freio geram o mesmo chamado no
 * sistema e exigem reações completamente diferentes.
 *
 * NÃO é estado do veículo. O farol em Frotas continua vindo do módulo de
 * Frotas — isto é o relato de quem abriu, e misturar as duas coisas faria um
 * chamado mal preenchido mudar a operação da frota.
 */
const CONDICOES_VEICULO = [
  {
    valor: "inoperante",
    // Rótulos viraram RESPOSTA a uma pergunta. "Inoperante" e "operando com
    // avaria" são termos de quem já conhece a regra; um chamado real chegou
    // marcado como "operando com avaria" com o texto dizendo "TRATOR NÃO
    // FUNCIONA". "Não, está parado" ninguém marca por engano num trator que
    // não liga.
    rotulo: "Não, está parado",
    // `rotulo` responde à pergunta do formulário; `estado` nomeia a situação
    // onde ela é só exibida. "Sim, mas com defeito" como legenda de painel não
    // quer dizer nada fora da pergunta que a originou.
    estado: "Parado",
    ajuda: "Não sai do lugar, ou não pode rodar assim",
    cor: "var(--accent-red)",
  },
  {
    valor: "operando_com_avaria",
    rotulo: "Sim, mas com defeito",
    estado: "Operando com avaria",
    ajuda: "Continua rodando, com o problema relatado",
    cor: "var(--accent-amber)",
  },
] as const;

/**
 * Sinais, no texto do chamado, de veículo que NÃO roda.
 *
 * Serve para um único aviso: o relato diz que parou e a escolha diz que anda.
 * É dica, não trava — quem abre pode ter escrito "não funciona o ar" num
 * caminhão que roda perfeitamente, e bloquear por causa disso trocaria um erro
 * ocasional por um atrito diário.
 */
const TEXTO_DE_PARADO = [
  "nao funciona", "não funciona", "nao liga", "não liga", "nao pega", "não pega",
  "nao anda", "não anda", "nao sai", "não sai", "nao roda", "não roda",
  "parado", "quebrado", "quebrou", "guincho", "rebocad", "fundiu", "travou",
];

function textoSugereParado(...partes: string[]): string | null {
  const t = partes.join(" ").toLowerCase();
  return TEXTO_DE_PARADO.find(p => t.includes(p)) || null;
}
const CATEGORIAS = ["Suporte Técnico","Financeiro","Comercial","RH","TI","Infraestrutura",CATEGORIA_FROTAS,"Dúvida","Solicitação","Reclamação","Outro"];

/** Rótulos das OS do módulo de Frotas. */
const OS_STATUS: Record<string, { label: string; cor: string }> = {
  aberta:           { label: "Aberta",           cor: "var(--accent-red)" },
  em_andamento:     { label: "Em andamento",     cor: "var(--accent-amber)" },
  aguardando_pecas: { label: "Aguardando peças", cor: "var(--accent-amber)" },
  finalizada:       { label: "Finalizada",       cor: "var(--accent-green)" },
  cancelada:        { label: "Cancelada",        cor: "var(--text-muted)" },
};
const PRIORIDADES = ["baixa","media","alta","critica"];
const NEXT_STATUS: Record<string, string[]> = {
  aberto:         ["em_atendimento", "fechado"],
  em_atendimento: ["aguardando", "resolvido"],
  aguardando:     ["em_atendimento", "resolvido"],
  resolvido:      ["fechado", "em_atendimento"],
  fechado:        [],
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(nome: string) {
  return nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}
function relTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Age Badge ─────────────────────────────────────────────────────────────────
function AgeBadge({ atualizadoEm, status }: { atualizadoEm: string; status: string }) {
  if (["resolvido","fechado","cancelado"].includes(status)) return null;
  const h = (Date.now() - new Date(atualizadoEm).getTime()) / 3600000;
  if (h < 24) return null;
  const d = Math.floor(h / 24);
  const cls = d >= 3
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-amber-400 bg-amber-500/10 border-amber-500/20";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cls}`}>
      <Clock size={8} /> {d}d sem resposta
    </span>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(chamados: Chamado[]) {
  const headers = ["#","Título","Status","Prioridade","Categoria","Solicitante","Atendente","SLA","Criado em","Atualizado em"];
  const rows = chamados.map(c => [
    c.numero,
    `"${c.titulo.replace(/"/g,'""')}"`,
    c.status,
    c.prioridade,
    c.categoria || "",
    `"${c.solicitante.nome}"`,
    c.atendente ? `"${c.atendente.nome}"` : "",
    c.slaStatus || "ok",
    new Date(c.criadoEm).toLocaleString("pt-BR"),
    new Date(c.atualizadoEm).toLocaleString("pt-BR"),
  ].join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `chamados-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-card__halo" />
      <span className="mono-cap">{label}</span>
      <div className={`metric kpi-card__value ${color || ""}`} style={{ marginTop: 8 }}>
        {Number(value || 0).toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const p = PRIORIDADE_MAP[prioridade] || PRIORIDADE_MAP.media;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${p.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
      {p.label}
    </span>
  );
}

function SlaBadge({ slaStatus }: { slaStatus?: string }) {
  if (!slaStatus || slaStatus === "ok") return null;
  const s = SLA_STATUS_MAP[slaStatus as keyof typeof SLA_STATUS_MAP];
  if (!s) return null;
  return <span className={`text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

function Avatar({ nome, size = 6 }: { nome: string; size?: number }) {
  // `w-${size}` era classe dinâmica: o Tailwind só gera o que enxerga no
  // código-fonte, então essas classes sumiam no build e o avatar ficava sem
  // tamanho definido. Em estilo inline o valor sempre chega.
  const px = size * 4;
  return (
    <div
      style={{ width: px, height: px, fontSize: Math.max(9, px * 0.42) }}
      className="rounded-full bg-gradient-to-br from-primary/40 to-cyan-400/30 border border-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0"
    >
      {initials(nome)}
    </div>
  );
}

// ── Ordenação da fila ─────────────────────────────────────────────────────────
/** Numa fila de triagem o que importa é o que está apodrecendo. A ordem padrão
 *  é essa: SLA estourado primeiro, depois em risco, e dentro de cada grupo o
 *  mais antigo na frente. Ordem de chegada crua deixava um crítico de três dias
 *  abaixo de um trivial de hoje. */
const PESO_SLA: Record<string, number> = { violado: 0, risco: 1, ok: 2 };
const PESO_PRIO: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
type ColunaOrdem = "urgencia" | "numero" | "titulo" | "prioridade" | "solicitante" | "idade" | "sla";

function ordenarFila(lista: Chamado[], coluna: ColunaOrdem, desc: boolean): Chamado[] {
  const idade = (c: Chamado) => new Date(c.criadoEm).getTime();
  const cmp: Record<ColunaOrdem, (a: Chamado, b: Chamado) => number> = {
    urgencia: (a, b) => (PESO_SLA[a.slaStatus || "ok"] ?? 2) - (PESO_SLA[b.slaStatus || "ok"] ?? 2) || idade(a) - idade(b),
    numero: (a, b) => a.numero - b.numero,
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"),
    prioridade: (a, b) => (PESO_PRIO[a.prioridade] ?? 9) - (PESO_PRIO[b.prioridade] ?? 9),
    solicitante: (a, b) => (a.solicitante?.nome || "").localeCompare(b.solicitante?.nome || "", "pt-BR"),
    idade: (a, b) => idade(a) - idade(b),
    sla: (a, b) => (PESO_SLA[a.slaStatus || "ok"] ?? 2) - (PESO_SLA[b.slaStatus || "ok"] ?? 2),
  };
  const ordenada = [...lista].sort(cmp[coluna]);
  return desc ? ordenada.reverse() : ordenada;
}

/** Há quanto tempo o chamado está travado, e por quê.
 *
 *  Espera sem prazo é o que faz chamado sumir por semanas: ninguém lembra do
 *  que estava esperando. A cor esquenta com o tempo porque 2 dias e 3 semanas
 *  não são o mesmo problema. */
function EsperaBadge({ desde, motivo }: { desde?: string | null; motivo?: string | null }) {
  if (!desde) return null;
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86400000);
  const cor = dias >= 7 ? "var(--accent-red)" : dias >= 3 ? "var(--accent-amber)" : "var(--text-muted)";
  const rotulo = dias === 0 ? "hoje" : dias === 1 ? "1 dia" : `${dias} dias`;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium"
      style={{ color: cor }}
      title={motivo ? `Aguardando ${motivo} — parado há ${rotulo}` : `Parado há ${rotulo}`}
    >
      <Clock size={10} />
      {rotulo}
      {motivo && <span className="text-[var(--text-muted)] font-normal truncate max-w-[14ch]">· {motivo}</span>}
    </span>
  );
}

/** Os dois relógios do SLA: resposta e resolução.
 *
 *  O backend sempre calculou os dois; a tela mostrava só o de resolução. Um
 *  chamado pode estar dentro do prazo de resolução e já ter estourado o de
 *  primeira resposta — que é a reclamação que chega antes. */
function SlaDuplo({ resposta, resolucao }: { resposta?: string; resolucao?: string }) {
  const cor = (e?: string) =>
    e === "violado" ? "var(--accent-red)"
    : e === "risco" ? "var(--accent-amber)"
    : e === "cumprido" || e === "ok" ? "var(--accent-green)"
    : "var(--border-medium)";
  const texto = (e?: string) =>
    e === "violado" ? "estourado" : e === "risco" ? "em risco"
    : e === "cumprido" ? "cumprido" : e === "ok" ? "no prazo" : "sem prazo";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor(resposta) }}
        title={`Resposta: ${texto(resposta)}`} />
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor(resolucao) }}
        title={`Resolução: ${texto(resolucao)}`} />
    </span>
  );
}

// ── Preview ───────────────────────────────────────────────────────────────────
/** Lê o chamado sem abrir nada.
 *
 *  Triar era 20 aberturas de drawer para 20 chamados. Aqui o relato aparece ao
 *  lado da lista e acompanha a navegação pelas setas — decidir "é meu?" deixa
 *  de custar dois cliques e um fechamento.
 *
 *  Tudo vem do que a lista já carregou: nenhuma consulta extra por chamado. */
function PreviewChamado({ chamado, podeAssumir, onAssumir, onAbrir, onFechar }: {
  chamado: Chamado; podeAssumir: boolean;
  onAssumir: (c: Chamado) => void; onAbrir: (c: Chamado) => void; onFechar: () => void;
}) {
  const col = STATUS_COLS.find(x => x.key === chamado.status);
  return (
    <aside className="w-[340px] shrink-0 border-l border-[var(--border-subtle)] flex flex-col overflow-hidden bg-[var(--bg-card)]">
      <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center gap-2 shrink-0">
        <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums">#{chamado.numero}</span>
        <PrioridadeBadge prioridade={chamado.prioridade} />
        <span className="ml-auto flex items-center gap-1">
          <button onClick={() => onAbrir(chamado)} title="Abrir completo (Enter)"
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <ExternalLink size={13} />
          </button>
          <button onClick={onFechar} title="Fechar preview (Esc)"
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X size={13} />
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug">{chamado.titulo}</h3>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5" style={{ color: col?.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: col?.color }} />
            {col?.label || chamado.status}
          </span>
          {chamado.categoria && <span>· {chamado.categoria}</span>}
          <span>· aberto há {relTime(chamado.criadoEm)}</span>
        </div>

        {/* O relato inteiro: é por ele que se decide pegar ou não. */}
        <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
          {chamado.descricao || <span className="text-[var(--text-muted)] italic">Sem descrição.</span>}
        </p>

        <div className="pt-1 space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] w-20 shrink-0">Solicitante</span>
            <span className="flex items-center gap-1.5 min-w-0">
              <Avatar nome={chamado.solicitante?.nome || "?"} size={4.5} />
              <span className="text-[var(--text-secondary)] truncate">{chamado.solicitante?.nome}</span>
            </span>
          </div>
          {chamado.atendente && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] w-20 shrink-0">Atendente</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <Avatar nome={chamado.atendente.nome} size={4.5} />
                <span className="text-[var(--text-secondary)] truncate">{chamado.atendente.nome}</span>
              </span>
            </div>
          )}
          {chamado.veiculo && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] w-20 shrink-0">Veículo</span>
              <span className="font-mono text-[var(--text-secondary)]">{chamado.veiculo.placa}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] w-20 shrink-0">SLA</span>
            <span className="flex items-center gap-2">
              <SlaDuplo resposta={(chamado as any).slaRespostaStatus} resolucao={chamado.slaStatus} />
              {chamado.slaStatus && chamado.slaStatus !== "ok" && <SlaBadge slaStatus={chamado.slaStatus} />}
            </span>
          </div>
          {!!(chamado as any).totalComentarios && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] w-20 shrink-0">Comentários</span>
              <span className="text-[var(--text-secondary)]">{(chamado as any).totalComentarios}</span>
            </div>
          )}
        </div>
      </div>

      {podeAssumir && (
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] shrink-0">
          <button onClick={() => onAssumir(chamado)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[var(--accent-violet)] hover:opacity-90 transition-opacity">
            <Hand size={12} /> Assumir chamado
          </button>
        </div>
      )}
    </aside>
  );
}

// ── Carga da equipe ───────────────────────────────────────────────────────────
/** Quem está com o quê, e o que está travado em cada um.
 *
 *  O quadro pessoal responde "o que eu tenho para fazer". Esta responde a
 *  pergunta que não tinha tela: como está o time. A barra existe porque volume
 *  se compara de relance melhor que número lido um a um. */
function CargaEquipe({ dados, loading }: { dados: any; loading: boolean }) {
  if (loading && !dados) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /></div>;
  }
  const pessoas: any[] = dados?.pessoas || [];
  if (!pessoas.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-center px-4">
        <CheckCircle2 size={20} className="text-emerald-400" />
        <p className="text-[13px] text-[var(--text-secondary)]">Nenhum chamado em aberto</p>
        <p className="text-[11px] text-[var(--text-muted)]">Ninguém do time tem trabalho pendente.</p>
      </div>
    );
  }

  const maior = Math.max(...pessoas.map(p => p.total), 1);

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse table-auto">
        <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
          <tr className="text-left">
            {["Pessoa", "Carga", "Em atendimento", "Aguardando", "SLA estourado", "Crítico", "Mais antigo", "Espera mais longa"].map((h, i) => (
              <th key={h} className={`${i === 1 ? "w-full" : "w-px"} px-3 py-1.5 border-b border-[var(--border-subtle)] whitespace-nowrap
                font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pessoas.map(p => {
            const semDono = !p.userId;
            return (
              <tr key={p.userId || "fila"}
                className={`border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors
                  ${semDono ? "bg-[var(--accent-violet)]/5" : ""}`}>
                <td className="w-px px-3 py-1.5 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {semDono
                      ? <Globe2 size={14} className="text-[var(--accent-violet)]" />
                      : <Avatar nome={p.nome} size={5} />}
                    <span className={`text-[12.5px] ${semDono ? "text-[var(--accent-violet)] font-semibold" : "text-[var(--text-primary)] font-medium"}`}>
                      {p.nome}
                    </span>
                  </span>
                </td>
                <td className="w-full px-3 py-1.5 min-w-[120px]">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden min-w-[60px]">
                      <span className="block h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((p.total / maior) * 100)}%`,
                          background: semDono ? "var(--accent-violet)" : "var(--accent-green)",
                        }} />
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[var(--text-secondary)] tabular-nums w-6 text-right">{p.total}</span>
                  </span>
                </td>
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">{p.emAtendimento || "—"}</td>
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">{p.aguardando || "—"}</td>
                {/* Colorir só o que não é zero: marcar o normal é o que
                    transforma tabela em ruído. */}
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums"
                  style={{ color: p.slaViolado ? "var(--accent-red)" : "var(--text-muted)", fontWeight: p.slaViolado ? 700 : 400 }}>
                  {p.slaViolado || "—"}
                </td>
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums"
                  style={{ color: p.criticos ? "var(--accent-red)" : "var(--text-muted)", fontWeight: p.criticos ? 700 : 400 }}>
                  {p.criticos || "—"}
                </td>
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums"
                  style={{ color: p.maisAntigoDias >= 7 ? "var(--accent-amber)" : "var(--text-muted)" }}>
                  {p.maisAntigoDias ? `${p.maisAntigoDias}d` : "—"}
                </td>
                <td className="w-px px-3 py-1.5 text-center font-mono text-[12px] tabular-nums"
                  style={{ color: p.esperaMaisLongaDias >= 7 ? "var(--accent-red)" : p.esperaMaisLongaDias >= 3 ? "var(--accent-amber)" : "var(--text-muted)" }}>
                  {p.esperaMaisLongaDias ? `${p.esperaMaisLongaDias}d` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Histórico em grade ────────────────────────────────────────────────────────
/** O passado responde outras perguntas que o quadro: quem atendeu, quanto
 *  tempo levou, quando encerrou. Por isso a grade é outra — não reaproveita a
 *  da fila, que existe para triagem. */
function HistoricoGrid({ chamados, loading, onOpen }: {
  chamados: Chamado[]; loading: boolean; onOpen: (c: Chamado) => void;
}) {
  if (loading && !chamados.length) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /></div>;
  }
  if (!chamados.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-center px-4">
        <History size={20} className="text-[var(--text-muted)]" />
        <p className="text-[13px] text-[var(--text-secondary)]">Nenhum chamado no período</p>
        <p className="text-[11px] text-[var(--text-muted)]">Ajuste o recorte, a busca ou as datas.</p>
      </div>
    );
  }

  const encerrado = (c: Chamado) => c.fechadoEm || c.resolvidoEm || null;
  // Duração real do atendimento: da abertura ao encerramento. Em aberto, conta
  // até agora — é o que diz se está demorando.
  const duracao = (c: Chamado) => {
    const fim = encerrado(c) ? new Date(encerrado(c)!).getTime() : Date.now();
    const h = Math.max(0, Math.round((fim - new Date(c.criadoEm).getTime()) / 3600000));
    return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
  };

  const ordenados = [...chamados].sort((a, b) => {
    const ta = new Date(encerrado(a) || a.atualizadoEm).getTime();
    const tb = new Date(encerrado(b) || b.atualizadoEm).getTime();
    return tb - ta;
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse table-auto">
        <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
          <tr className="text-left">
            {["Nº", "Chamado", "Status", "Prioridade", "Solicitante", "Atendente", "Duração", "Encerrado"].map((h, i) => (
              <th key={h} className={`${i === 1 ? "w-full" : "w-px"} px-3 py-1.5 border-b border-[var(--border-subtle)] whitespace-nowrap
                font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenados.map(c => {
            const col = STATUS_COLS.find(x => x.key === c.status);
            return (
              <tr key={c.id} onClick={() => onOpen(c)}
                className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                <td className="w-px px-3 py-1 font-mono text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">{c.numero}</td>
                <td className="w-full px-3 py-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate" title={c.titulo}>{c.titulo}</span>
                    {c.categoria && <span className="shrink-0 text-[10px] px-1.5 py-px rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{c.categoria}</span>}
                  </div>
                </td>
                <td className="w-px px-3 py-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: col?.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: col?.color }} />
                    {col?.label || c.status}
                  </span>
                </td>
                <td className="w-px px-3 py-1 whitespace-nowrap"><PrioridadeBadge prioridade={c.prioridade} /></td>
                <td className="w-px px-3 py-1 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Avatar nome={c.solicitante?.nome || "?"} size={4.5} />
                    <span className="text-[12px] text-[var(--text-secondary)] truncate max-w-[14ch]">{c.solicitante?.nome}</span>
                  </span>
                </td>
                <td className="w-px px-3 py-1 whitespace-nowrap">
                  {c.atendente ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar nome={c.atendente.nome} size={4.5} />
                      <span className="text-[12px] text-[var(--text-secondary)] truncate max-w-[14ch]">{c.atendente.nome}</span>
                    </span>
                  ) : <span className="text-[11px] text-[var(--text-muted)]">—</span>}
                </td>
                <td className="w-px px-3 py-1 text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">{duracao(c)}</td>
                <td className="w-px px-3 py-1 text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                  {encerrado(c) ? formatDate(encerrado(c)!) : <span className="text-[var(--accent-amber)]">em aberto</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Fila pública em grade ─────────────────────────────────────────────────────
/**
 * A fila é uma lista de triagem, não um quadro. O gesto que importa é um só —
 * "isso é meu" — e ele está no duplo clique na linha, sem abrir modal.
 *
 * Um clique abre o chamado para ler antes de decidir.
 */
function FilaGrid({ chamados, loading, onOpen, onAssumir, onAssumirVarios, podeAssumir, preview, onPreview }: {
  chamados: Chamado[]; loading: boolean;
  onOpen: (c: Chamado) => void;
  onAssumir: (id: string) => void;
  onAssumirVarios: (ids: string[]) => void;
  podeAssumir: boolean;
  preview: string | null;
  onPreview: (c: Chamado | null) => void;
}) {
  const [assumindo, setAssumindo] = useState<string | null>(null);
  const [coluna, setColuna] = useState<ColunaOrdem>("urgencia");
  const [desc, setDesc] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const ordenados = useMemo(() => ordenarFila(chamados, coluna, desc), [chamados, coluna, desc]);

  // A seleção não pode sobreviver a um chamado que saiu da fila.
  useEffect(() => {
    setSel(prev => {
      const vivos = new Set(chamados.map(c => c.id));
      const next = new Set([...prev].filter(id => vivos.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [chamados]);

  function ordenarPor(c: ColunaOrdem) {
    if (c === coluna) { setDesc(d => !d); return; }
    setColuna(c); setDesc(false);
  }

  async function assumir(c: Chamado) {
    if (!podeAssumir || assumindo) return;
    setAssumindo(c.id);
    try { await onAssumir(c.id); } finally { setAssumindo(null); }
  }

  // Clique simples abre o PREVIEW, não o drawer.
  //
  // Antes ele montava um modal em cima da lista, o segundo clique do duplo caía
  // no fundo desse modal e o `dblclick` — que exige o mesmo alvo nos dois
  // cliques — nunca disparava. Eu tinha resolvido com um temporizador de 240ms;
  // com o preview o modal não entra mais no caminho, os dois cliques caem na
  // linha e o remendo pôde sair.
  function aoClicar(c: Chamado) { onPreview(c); }
  function aoDuploClicar(c: Chamado) { assumir(c); }

  // Setas descem pela fila com o preview acompanhando; Enter abre inteiro,
  // Esc fecha. É o que torna a triagem contínua em vez de um clique por vez.
  useEffect(() => {
    if (!preview) return;
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      const i = ordenados.findIndex(c => c.id === preview);
      if (i < 0) return;
      if (e.key === "ArrowDown" && i < ordenados.length - 1) { e.preventDefault(); onPreview(ordenados[i + 1]); }
      else if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); onPreview(ordenados[i - 1]); }
      else if (e.key === "Enter") { e.preventDefault(); onOpen(ordenados[i]); }
      else if (e.key === "Escape") { e.preventDefault(); onPreview(null); }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [preview, ordenados, onPreview, onOpen]);

  function alternar(id: string) {
    setSel(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading && chamados.length === 0) {
    return <div className="flex items-center justify-center h-full"><Loader2 size={22} className="animate-spin text-[var(--text-muted)]" /></div>;
  }
  if (chamados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-center px-4">
        <Globe2 size={20} className="text-[var(--text-muted)]" />
        <p className="text-[13px] text-[var(--text-secondary)]">A fila está vazia</p>
        <p className="text-[11px] text-[var(--text-muted)]">Chamados abertos sem responsável aparecem aqui.</p>
      </div>
    );
  }

  // `w-full` só no título: ele absorve a sobra e as demais colunas encolhem
  // até o conteúdo. Sem isso o navegador reparte o espaço entre todas e a
  // linha vira um campo de futebol com seis ilhas de texto.
  const COLS: Array<{ k: ColunaOrdem | null; label: string; largura: string }> = [
    { k: "numero", label: "Nº", largura: "w-px" },
    { k: "titulo", label: "Chamado", largura: "w-full" },
    { k: "prioridade", label: "Prioridade", largura: "w-px" },
    { k: "solicitante", label: "Solicitante", largura: "w-px" },
    { k: "idade", label: "Idade", largura: "w-px" },
    { k: "sla", label: "SLA", largura: "w-px" },
    { k: null, label: "", largura: "w-px" },
  ];

  // Trilho colorido na borda esquerda: o estado do SLA é o que decide a ordem
  // de ataque, e um risco de 3px varre a lista mais rápido que ler coluna.
  const TRILHO: Record<string, string> = {
    violado: "var(--accent-red)",
    risco: "var(--accent-amber)",
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {sel.size > 0 && podeAssumir && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-[var(--accent-violet)]/10 border-b border-[var(--accent-violet)]/25 flex-shrink-0">
          <span className="text-[12px] text-[var(--text-secondary)]">{sel.size} selecionado(s)</span>
          <button
            onClick={() => { onAssumirVarios([...sel]); setSel(new Set()); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white bg-[var(--accent-violet)] hover:opacity-90 transition-opacity"
          >
            <Hand size={11} /> Assumir todos
          </button>
          <button onClick={() => setSel(new Set())}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Limpar
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]">
            <tr className="text-left">
              {podeAssumir && <th className="w-px pl-4 pr-2 py-1.5 border-b border-[var(--border-subtle)]" />}
              {COLS.map(col => (
                <th key={col.label}
                  className={`${col.largura} px-3 py-1.5 border-b border-[var(--border-subtle)] whitespace-nowrap`}>
                  {col.k ? (
                    <button onClick={() => ordenarPor(col.k!)}
                      className={`font-mono text-[9px] font-medium uppercase tracking-[0.14em] inline-flex items-center gap-1 transition-colors
                        ${coluna === col.k ? "text-[var(--accent-violet)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                      {col.label}
                      {coluna === col.k && <ChevronDown size={10} className={desc ? "rotate-180" : ""} />}
                    </button>
                  ) : <span className="sr-only">Ações</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.map(c => (
              <tr
                key={c.id}
                onClick={() => aoClicar(c)}
                onDoubleClick={() => aoDuploClicar(c)}
                title={podeAssumir ? "Duplo clique assume o chamado" : undefined}
                className={`linha-fila group border-b border-[var(--border-subtle)] transition-colors cursor-pointer
                  ${preview === c.id ? "bg-[var(--accent-violet)]/10" : "hover:bg-[var(--bg-hover)]"}`}
                style={{ opacity: assumindo === c.id ? 0.45 : 1 }}
              >
                {podeAssumir && (
                  <td className="w-px pl-4 pr-2 py-1" onClick={e => e.stopPropagation()}
                    style={{ boxShadow: TRILHO[c.slaStatus || ""] ? `inset 3px 0 0 ${TRILHO[c.slaStatus || ""]}` : undefined }}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)}
                      aria-label={`Selecionar chamado ${c.numero}`} className="align-middle" />
                  </td>
                )}
                <td className="w-px px-3 py-1 font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap tabular-nums"
                  style={!podeAssumir && TRILHO[c.slaStatus || ""] ? { boxShadow: `inset 3px 0 0 ${TRILHO[c.slaStatus || ""]}` } : undefined}>
                  {c.numero}
                </td>

                {/* Único com peso tipográfico: é por ele que se lê a lista. */}
                <td className="w-full px-3 py-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate" title={c.titulo}>
                      {c.titulo}
                    </span>
                    {c.categoria && (
                      <span className="shrink-0 text-[10px] px-1.5 py-px rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                        {c.categoria}
                      </span>
                    )}
                  </div>
                </td>

                <td className="w-px px-3 py-1 whitespace-nowrap"><PrioridadeBadge prioridade={c.prioridade} /></td>

                <td className="w-px px-3 py-1 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Avatar nome={c.solicitante?.nome || "?"} size={4.5} />
                    <span className="text-[12px] text-[var(--text-secondary)] truncate max-w-[14ch]">
                      {c.solicitante?.nome}
                    </span>
                  </span>
                </td>

                <td className="w-px px-3 py-1 text-[11px] text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                  {relTime(c.criadoEm)}
                </td>

                {/* "No prazo" não vira selo: a maioria está no prazo, e marcar
                    o normal é o que transforma lista em ruído. */}
                <td className="w-px px-3 py-1 whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <SlaDuplo resposta={(c as any).slaRespostaStatus} resolucao={c.slaStatus} />
                    {c.slaStatus && c.slaStatus !== "ok" && <SlaBadge slaStatus={c.slaStatus} />}
                  </span>
                </td>

                <td className="w-px pl-2 pr-4 py-1 text-right whitespace-nowrap">
                  {podeAssumir && (
                    <button
                      onClick={e => { e.stopPropagation(); assumir(c); }}
                      disabled={assumindo === c.id}
                      title={`Assumir chamado ${c.numero}`}
                      // Só some onde existe hover. Em toque continua visível —
                      // esconder ação atrás de hover quebra no celular.
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[var(--border-subtle)]
                        text-[11px] font-medium text-[var(--text-secondary)]
                        hover:bg-[var(--accent-violet)] hover:text-white hover:border-transparent
                        focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-violet)]
                        transition-all duration-150 disabled:opacity-40
                        [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
                    >
                      <Hand size={11} /> Assumir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview && (() => {
        const c = ordenados.find(x => x.id === preview);
        return c ? (
          <PreviewChamado
            chamado={c}
            podeAssumir={podeAssumir}
            onAssumir={assumir}
            onAbrir={onOpen}
            onFechar={() => onPreview(null)}
          />
        ) : null;
      })()}
      </div>
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────────
function ChamadoCard({ chamado, onClick, selected, onSelect, onAssumir, canAssumir }: {
  chamado: Chamado; onClick: () => void;
  selected?: boolean; onSelect?: (e: React.MouseEvent) => void;
  onAssumir?: (id: string) => void; canAssumir?: boolean;
}) {
  // Chamado é "fila pública" quando status=aberto e ninguém o assumiu ainda.
  const isPublicQueue = chamado.status === "aberto" && !chamado.atendenteId;
  const showAssumir = canAssumir && isPublicQueue;
  const [assumindo, setAssumindo] = useState(false);

  async function handleAssumir(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onAssumir || assumindo) return;
    setAssumindo(true);
    try { await onAssumir(chamado.id); }
    finally { setAssumindo(false); }
  }

  const cor = PRIORIDADE_MAP[chamado.prioridade]?.dot || "bg-[var(--text-muted)]";

  return (
    <div
      onClick={onClick}
      className={`card-chamado group relative rounded-lg border bg-[var(--bg-card)] px-2.5 py-1.5 cursor-pointer
        transition-colors duration-150
        ${selected
          ? "border-[var(--accent-violet)] bg-[var(--accent-violet-dim)]"
          : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-hover)]"}`}
      style={{ opacity: assumindo ? 0.45 : 1 }}
    >
      {/* Linha 1 — identidade. Título em UMA linha: card de altura previsível
          é o que faz cinco colunas parecerem alinhadas. */}
      <div className="flex items-center gap-1.5 min-w-0">
        {onSelect && (
          <span onClick={onSelect}
            className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
              ${selected ? "bg-[var(--accent-violet)] border-[var(--accent-violet)]" : "border-[var(--border-strong)] hover:border-[var(--accent-violet)]"}`}>
            {selected && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3"><path d="M2 6l3 3 5-5" /></svg>}
          </span>
        )}
        <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)] tabular-nums">#{chamado.numero}</span>
        <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate flex-1 min-w-0" title={chamado.titulo}>
          {chamado.titulo}
        </span>
        {showAssumir && (
          <button
            onClick={handleAssumir}
            disabled={assumindo}
            title="Assumir este chamado"
            aria-label={`Assumir chamado ${chamado.numero}`}
            // Ocupava a largura inteira do card e somava ~34px de altura.
            // Só some onde existe hover — em toque continua visível.
            className="shrink-0 p-0.5 rounded text-[var(--accent-violet)] hover:bg-[var(--accent-violet)]/15
              focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-violet)]
              transition-opacity duration-150
              [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
          >
            {assumindo ? <Loader2 size={12} className="animate-spin" /> : <Hand size={12} />}
          </button>
        )}
      </div>

      {/* Linha 2 — contexto. Prioridade em texto, nunca só cor. */}
      <div className="flex items-center gap-1.5 mt-1 min-w-0 text-[10px]">
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${cor}`} />
        <span className={`shrink-0 font-semibold uppercase tracking-wide ${PRIORIDADE_MAP[chamado.prioridade]?.color || "text-[var(--text-muted)]"}`}>
          {PRIORIDADE_MAP[chamado.prioridade]?.label || chamado.prioridade}
        </span>
        {chamado.categoria && (
          <span className="shrink-0 truncate max-w-[10ch] text-[var(--text-muted)]" title={chamado.categoria}>
            · {chamado.categoria}
          </span>
        )}
        <span className="flex-1" />
        <span className="shrink-0 flex items-center gap-1">
          <Avatar nome={chamado.solicitante.nome} size={4} />
          {chamado.atendente && (
            <>
              <span className="text-[var(--text-muted)]">→</span>
              <Avatar nome={chamado.atendente.nome} size={4} />
            </>
          )}
        </span>
        {chamado.status === "aguardando" && (
          <EsperaBadge desde={chamado.aguardandoDesde} motivo={chamado.aguardandoMotivo} />
        )}
        {chamado.slaStatus && chamado.slaStatus !== "ok" && <SlaBadge slaStatus={chamado.slaStatus} />}
        <span className="shrink-0 text-[var(--text-muted)] tabular-nums">{relTime(chamado.criadoEm)}</span>
      </div>
    </div>
  );
}

// ── New Chamado Modal ──────────────────────────────────────────────────────────
type Template = { id: string; nome: string; titulo: string; descricao?: string; prioridade: string; categoria?: string };

type KbSugestao = { id: string; titulo: string; slug: string; resumo?: string; categoria?: { nome: string; cor: string } };

function NovoChamadoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ titulo: "", descricao: "", prioridade: "media", categoria: "", veiculoId: "", condicaoVeiculo: "" });
  // Frota da organização, carregada só quando a categoria pede.
  const [veiculos, setVeiculos] = useState<VeiculoLite[]>([]);
  // Atribuição na abertura: quem já sabe de quem é o assunto não precisa
  // passar pela fila. Fechado por padrão — o caminho normal continua sendo
  // abrir sem dono.
  const [showAtribuir, setShowAtribuir] = useState(false);
  const [buscaUser, setBuscaUser] = useState("");
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string; email?: string }[]>([]);
  const [atendente, setAtendente] = useState<{ id: string; nome: string; email?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateNome, setTemplateNome] = useState("");
  const [kbSugestoes, setKbSugestoes] = useState<KbSugestao[]>([]);
  const [kbArtigo, setKbArtigo] = useState<KbSugestao & { conteudo?: string } | null>(null);

  useEffect(() => {
    api.get("/chamado-templates").then(r => setTemplates(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.titulo.length < 3) { setKbSugestoes([]); return; }
    const t = setTimeout(() => {
      api.get("/conhecimento/artigos", { params: { status: "publicado", search: form.titulo, limit: 3 } })
        .then(r => setKbSugestoes(Array.isArray(r.data) ? r.data.slice(0, 3) : []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [form.titulo]);

  // A lista da frota só é buscada quando o chamado é de frota — não faz
  // sentido pagar essa consulta em todo chamado de TI.
  useEffect(() => {
    if (form.categoria !== CATEGORIA_FROTAS || veiculos.length) return;
    api.get("/frota/veiculos", { params: { limit: 500 }, silent: true })
      .then(r => setVeiculos(r.data?.items ?? r.data ?? []))
      .catch(() => setVeiculos([]));
  }, [form.categoria, veiculos.length]);

  // Lista carregada só quando o campo é aberto — a maioria dos chamados nasce
  // sem dono e não precisa dessa consulta.
  useEffect(() => {
    if (!showAtribuir || usuarios.length) return;
    api.get("/users", { silent: true })
      .then(r => setUsuarios(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])))
      .catch(() => setUsuarios([]));
  }, [showAtribuir, usuarios.length]);

  // Sem excluir quem abre: abrir e já assumir é um caso legítimo.
  const usuariosFiltrados = useMemo(() => {
    const q = buscaUser.trim().toLowerCase();
    if (!q) return usuarios.slice(0, 8);
    return usuarios.filter(u =>
      u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [usuarios, buscaUser]);

  function applyTemplate(t: Template) {
    setForm(f => ({ ...f, titulo: t.titulo, descricao: t.descricao || f.descricao, prioridade: t.prioridade, categoria: t.categoria || f.categoria }));
  }
  async function saveAsTemplate() {
    if (!templateNome.trim() || !form.titulo) return;
    try {
      const { data } = await api.post("/chamado-templates", {
        nome: templateNome.trim(),
        titulo: form.titulo,
        descricao: form.descricao,
        veiculoId: form.categoria === CATEGORIA_FROTAS ? (form.veiculoId || undefined) : undefined,
        atendenteId: atendente?.id,
        prioridade: form.prioridade,
        categoria: form.categoria || undefined,
      });
      setTemplates(prev => [...prev.filter(t => t.nome !== templateNome.trim()), data]);
    } catch {}
    setShowSaveTemplate(false);
    setTemplateNome("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.categoria === CATEGORIA_FROTAS && !form.veiculoId) {
      setError("Selecione o veículo do chamado de frotas.");
      return;
    }
    // Obrigatória: era opcional, e "não informado" chegava na oficina sem
    // dizer se o veículo parou — que é justamente o que decide atender agora
    // ou depois. São dois cliques para quem abre e um turno de diferença para
    // quem atende.
    if (form.categoria === CATEGORIA_FROTAS && form.veiculoId && !form.condicaoVeiculo) {
      setError("Responda se o veículo consegue rodar.");
      return;
    }
    if (!form.titulo.trim() || !form.descricao.trim()) {
      setError("Título e descrição são obrigatórios");
      return;
    }
    setSaving(true); setError("");
    try {
      // A condição só faz sentido com veículo — mandar em chamado de outra
      // categoria sujaria o registro com dado que não se aplica.
      await api.post("/chamados", {
        ...form,
        condicaoVeiculo:
          form.categoria === CATEGORIA_FROTAS && form.veiculoId
            ? form.condicaoVeiculo || undefined
            : undefined,
      });
      onCreated(); onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao criar chamado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="card-premium rounded-2xl w-full max-w-lg shadow-premium-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-semibold text-[var(--text-primary)] font-display text-lg">Novo Chamado</h2>
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <select onChange={e => { if (e.target.value) applyTemplate(templates.find(t => t.id === e.target.value)!); e.target.value = ""; }}
                className="input-o text-xs py-1.5 w-auto">
                <option value="">Usar template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
            <button type="button" onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={18} /></button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
          {/* Artigo KB selecionado */}
          {kbArtigo && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BookOpen size={12} className="text-blue-400 shrink-0" />
                    <span className="text-[10px] text-blue-400 font-medium">Artigo relacionado</span>
                  </div>
                  <div className="text-[12px] font-medium text-foreground truncate">{kbArtigo.titulo}</div>
                  {kbArtigo.resumo && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{kbArtigo.resumo}</div>}
                </div>
                <button type="button" onClick={() => setKbArtigo(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X size={14} /></button>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Título *</label>
            <input
              className="input-o"
              placeholder="Descreva brevemente o problema..."
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
            {kbSugestoes.length > 0 && !kbArtigo && (
              <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-premium-sm overflow-hidden">
                <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center gap-1.5 bg-[var(--bg-hover)]">
                  <BookOpen size={11} className="text-[var(--text-muted)]" />
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">Artigos relacionados na base de conhecimento</span>
                </div>
                {kbSugestoes.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setKbArtigo(a)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {a.categoria && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{ background: a.categoria.cor + "20", color: a.categoria.cor }}>
                          {a.categoria.nome}
                        </span>
                      )}
                      <span className="text-[12px] text-[var(--text-primary)] font-medium truncate">{a.titulo}</span>
                    </div>
                    {a.resumo && <div className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{a.resumo}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Descrição *</label>
            <textarea
              rows={4}
              className="input-o resize-y min-h-[80px]"
              placeholder="Detalhe o problema ou solicitação..."
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prioridade</label>
              <select
                className="input-o"
                value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
              >
                {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Categoria</label>
              <select
                className="input-o"
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                <option value="">Selecionar...</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {form.categoria === CATEGORIA_FROTAS && (
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">
                Veículo *
              </label>
              <select
                className="input-o"
                value={form.veiculoId}
                onChange={e => setForm(f => ({ ...f, veiculoId: e.target.value }))}
              >
                <option value="">Selecionar veículo...</option>
                {veiculos.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.placa}{v.identificacao ? ` · ${v.identificacao}` : ""}
                    {v.marca || v.modelo ? ` — ${[v.marca, v.modelo].filter(Boolean).join(" ")}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                Com o veículo definido, este chamado pode abrir uma ordem de serviço em Frotas.
              </p>

              {/* Condição do veículo.
                  Existe para quem PEGA o chamado saber, antes de abrir, se o
                  veículo parou ou ainda roda — a diferença entre atender agora
                  e atender depois.
                  NÃO altera o farol em Fleet: o estado operacional do veículo
                  continua sendo o que o módulo de Frotas registra. Isto é o
                  relato de quem abriu, não uma medição. */}
              <div className="mt-3">
                <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">
                  O veículo consegue rodar? *
                </label>
                <div className="flex gap-2">
                  {CONDICOES_VEICULO.map(c => {
                    const ativo = form.condicaoVeiculo === c.valor;
                    return (
                      <button
                        key={c.valor}
                        type="button"
                        // Sem alternar de volta para vazio: a resposta é
                        // obrigatória, e um segundo clique que apagava a escolha
                        // era um jeito silencioso de mandar "não informado".
                        onClick={() => setForm(f => ({ ...f, condicaoVeiculo: c.valor }))}
                        aria-pressed={ativo}
                        className="flex-1 rounded-[10px] border px-3 py-2 text-left transition-colors"
                        style={{
                          borderColor: ativo ? c.cor : "var(--border-subtle)",
                          background: ativo ? `color-mix(in srgb, ${c.cor} 12%, transparent)` : "transparent",
                        }}
                      >
                        <span className="block text-[12.5px] font-semibold" style={{ color: ativo ? c.cor : "var(--text-primary)" }}>
                          {c.rotulo}
                        </span>
                        <span className="block text-[10.5px] text-[var(--text-muted)] mt-0.5">{c.ajuda}</span>
                      </button>
                    );
                  })}
                </div>

                {/* O relato diz que parou e a resposta diz que anda. Avisa, não
                    trava: "não funciona o ar" num caminhão que roda todo dia é
                    um chamado legítimo, e bloquear trocaria um erro ocasional
                    por um atrito diário. */}
                {form.condicaoVeiculo === "operando_com_avaria" && (() => {
                  const pista = textoSugereParado(form.titulo, form.descricao);
                  if (!pista) return null;
                  return (
                    <div
                      className="mt-2 rounded-[10px] border px-3 py-2 text-[11px]"
                      style={{ borderColor: "var(--accent-amber)", background: "color-mix(in srgb, var(--accent-red) 8%, transparent)", color: "var(--text-secondary)" }}
                    >
                      O relato menciona <b>&ldquo;{pista}&rdquo;</b>, que soa como veículo parado — confira se
                      ele realmente continua rodando.
                    </div>
                  );
                })()}

                <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                  Orienta quem vai atender e vira a sugestão do farol quando a ordem de serviço
                  for aberta em Frotas. Quem decide o farol é quem atende, no módulo de Frotas.
                </p>
              </div>
            </div>
          )}
          {showSaveTemplate ? (
            <div className="flex gap-2 pt-1 items-center">
              <input value={templateNome} onChange={e => setTemplateNome(e.target.value)}
                placeholder="Nome do template..." autoFocus
                className="input-o flex-1" />
              <button type="button" onClick={saveAsTemplate}
                className="btn btn-ghost text-xs py-2 px-3 text-[var(--accent-violet)]">Salvar</button>
              <button type="button" onClick={() => setShowSaveTemplate(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowSaveTemplate(true)}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-violet)] transition-colors self-start block">
              + Salvar como template
            </button>
          )}

          {/* Atribuir na abertura. Sem usar, o chamado segue para a fila — e,
              sendo de frota, avisa quem cuida de frota. */}
          {atendente ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[var(--text-muted)]">Atribuído a</span>
              <span className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--accent-violet)]/12 text-[var(--accent-violet)] text-xs font-medium">
                {atendente.nome}
                <button type="button" onClick={() => { setAtendente(null); setShowAtribuir(false); setBuscaUser(""); }}
                  className="hover:opacity-70" title="Remover atribuição"><X size={12} /></button>
              </span>
            </div>
          ) : showAtribuir ? (
            <div className="pt-1">
              <div className="flex items-center gap-2 mb-2">
                <input value={buscaUser} onChange={e => setBuscaUser(e.target.value)} autoFocus
                  placeholder="Buscar pessoa por nome ou e-mail..." className="input-o flex-1" />
                <button type="button" onClick={() => { setShowAtribuir(false); setBuscaUser(""); }}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"><X size={14} /></button>
              </div>
              <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)] max-h-44 overflow-y-auto">
                {usuariosFiltrados.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-[var(--text-muted)]">Ninguém encontrado</div>
                ) : usuariosFiltrados.map(u => (
                  <button key={u.id} type="button"
                    onClick={() => { setAtendente(u); setShowAtribuir(false); setBuscaUser(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="text-xs font-medium text-[var(--text-primary)]">{u.nome}</div>
                    {u.email && <div className="text-[10px] text-[var(--text-muted)]">{u.email}</div>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAtribuir(true)}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent-violet)] transition-colors self-start block">
              + Atribuir para...
            </button>
          )}

          <p className="text-[11px] text-[var(--text-muted)] pt-1">
            {atendente
              ? `Vai direto para ${atendente.nome}, sem passar pela fila.`
              : form.categoria === CATEGORIA_FROTAS
                ? "Sem atribuir, entra na fila e avisa quem cuida de frota."
                : "Sem atribuir, entra na fila pública para quem estiver disponível."}
          </p>
          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn btn-violet flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Abrir Chamado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
/** Painel de frota do chamado: mostra o veículo, abre a ordem de serviço e
 *  lista as OS já geradas.
 *
 *  `imobiliza` decide a cor do veículo no Farol da Frota — parado (vermelho) ou
 *  operando com avaria (amarelo). Só quem abre a OS sabe qual é o caso, por
 *  isso a escolha fica aqui e não num padrão silencioso. */
function PainelFrota({ detail, canEditar, onUpdated }: {
  detail: Chamado; canEditar: boolean; onUpdated: () => void;
}) {
  const [abrindo, setAbrindo] = useState(false);
  // Começa no que o solicitante relatou. Ele não decide o farol — quem atende
  // decide, aqui ou depois na OS — mas partir de "parado" com um chamado aberto
  // como "operando com avaria" fazia a decisão contrariar o relato por descuido.
  const [imobiliza, setImobiliza] = useState((detail as any).condicaoVeiculo !== "operando_com_avaria");
  const [erro, setErro] = useState("");
  const os = detail.manutencoes || [];
  const emAberto = os.filter(o => !["finalizada", "cancelada"].includes(o.status));

  async function abrir() {
    setAbrindo(true); setErro("");
    try {
      await api.post(`/chamados/${detail.id}/abrir-manutencao`, { imobiliza });
      onUpdated();
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não foi possível abrir a manutenção.");
    } finally { setAbrindo(false); }
  }

  const v = detail.veiculo!;
  return (
    <div className="px-6 py-6 border-b border-[var(--border-subtle)]">
      <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3 flex items-center gap-2">
        <Truck size={13} /> Frota
      </h3>

      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[14px] font-bold text-[var(--text-primary)]">{v.placa}</span>
        {v.identificacao && <span className="font-mono text-[12px] text-[var(--text-muted)]">{v.identificacao}</span>}
        <span className="text-[13px] text-[var(--text-secondary)]">
          {[v.marca, v.modelo].filter(Boolean).join(" ")}
        </span>
      </div>

      {/* A condição relatada, em destaque: é a primeira coisa que quem pega o
          chamado precisa saber para decidir se atende agora ou depois.
          Vem com a ressalva de que é relato, não o estado oficial — quem for
          agir na frota tem que olhar o módulo de Frotas. */}
      {(() => {
        const c = CONDICOES_VEICULO.find(x => x.valor === (detail as any).condicaoVeiculo);
        if (!c) return null;
        return (
          <div
            className="mb-4 rounded-[10px] border px-3 py-2"
            style={{
              borderColor: c.cor,
              background: `color-mix(in srgb, ${c.cor} 10%, transparent)`,
            }}
          >
            <span className="block text-[13px] font-semibold" style={{ color: c.cor }}>
              {c.estado}
            </span>
            <span className="block text-[11px] text-[var(--text-muted)] mt-0.5">
              Relatado na abertura. Não reflete o farol do veículo em Frotas.
            </span>
          </div>
        );
      })()}

      {os.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {os.map(o => {
            const st = OS_STATUS[o.status] || { label: o.status, cor: "var(--text-muted)" };
            return (
              <a
                key={o.id}
                href={`/dashboard/frota/manutencoes?os=${o.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)]">{o.numeroOs || "OS"}</span>
                <span className="flex items-center gap-2">
                  {o.imobiliza === false && (
                    <span className="text-[10px] text-[var(--text-muted)]">segue operando</span>
                  )}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: st.cor, background: `color-mix(in srgb, ${st.cor} 13%, transparent)` }}>
                    {st.label}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      )}

      {emAberto.length === 0 && canEditar && (
        <>
          <label className="flex items-center gap-2 mb-1 text-[12px] text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={imobiliza} onChange={e => setImobiliza(e.target.checked)} />
            Veículo está parado (sem o marcar, entra como operando com avaria)
          </label>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            É esta escolha que pinta o veículo no Farol da Frota — vermelho quando marcada,
            amarelo quando não. Pode ser revista a qualquer momento na própria OS, no módulo
            de Manutenção.
          </p>
          <button onClick={abrir} disabled={abrindo} className="btn btn-violet text-[12px] disabled:opacity-50">
            {abrindo ? "Abrindo..." : "Abrir manutenção"}
          </button>
          {erro && <p className="text-[11px] text-[var(--accent-red)] mt-2">{erro}</p>}
        </>
      )}
      {emAberto.length > 0 && (
        <p className="text-[11px] text-[var(--text-muted)]">
          Encerrar este chamado finaliza {emAberto.length > 1 ? "as ordens de serviço abertas" : "a ordem de serviço aberta"}.
        </p>
      )}
    </div>
  );
}

function ChamadoDrawer({ chamado, isMaster, userId, canEditar, onClose, onUpdated }: {
  chamado: Chamado; isMaster: boolean; userId: string; canEditar: boolean;
  onClose: () => void; onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<Chamado>(chamado);
  const [comment, setComment] = useState("");
  const [interno, setInterno] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [assumirErro, setAssumirErro] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingNota, setRatingNota] = useState("");
  const [savingRating, setSavingRating] = useState(false);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaEntry[]>([]);
  const [showAuditoria, setShowAuditoria] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/chamados/${chamado.id}`);
      setDetail(data);
    } catch {}
  }, [chamado.id]);

  const loadAuditoria = useCallback(async () => {
    try {
      const { data } = await api.get(`/chamados/${chamado.id}/auditoria`);
      setAuditoria(Array.isArray(data) ? data : []);
    } catch { setAuditoria([]); }
  }, [chamado.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showAuditoria) loadAuditoria(); }, [showAuditoria, loadAuditoria]);

  useEffect(() => {
    if (!isMaster) return;
    api.get("/users").then(r => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [isMaster]);

  async function sendComment() {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.post(`/chamados/${chamado.id}/comentarios`, { texto: comment, interno });
      setComment("");
      load();
      onUpdated();
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(newStatus: string) {
    setChangingStatus(true);
    try {
      await api.patch(`/chamados/${chamado.id}/status`, { status: newStatus });
      load();
      onUpdated();
    } finally {
      setChangingStatus(false);
    }
  }

  async function atribuir(atendenteId: string) {
    setAtribuindo(true);
    try {
      await api.patch(`/chamados/${chamado.id}/atribuir`, { atendenteId: atendenteId || null });
      load();
      onUpdated();
    } finally {
      setAtribuindo(false);
    }
  }

  async function assumir() {
    setAssumindo(true); setAssumirErro("");
    try {
      await api.patch(`/chamados/${chamado.id}/assumir`);
      await load();
      onUpdated();
    } catch (err: any) {
      // 409 = outro usuário assumiu primeiro. Recarrega pra UI mostrar o atendente atual.
      setAssumirErro(err?.response?.data?.message || "Nao foi possivel assumir o chamado");
      await load();
      onUpdated();
    } finally {
      setAssumindo(false);
    }
  }

  async function loadSuggestions() {
    setShowSuggest(true);
    setLoadingSuggest(true);
    try {
      const params: any = { limit: 5 };
      if ((detail as any)?.skillRequeridaId) params.skillId = (detail as any).skillRequeridaId;
      if ((detail as any)?.nivelMinimo)      params.nivelMinimo = (detail as any).nivelMinimo;
      const r = await api.get("/skills/suggest", { params });
      setSuggestions(r.data);
    } catch { setSuggestions([]); }
    finally { setLoadingSuggest(false); }
  }

  // Devolver: a atribuição vale na hora, e a recusa é a saída — com motivo,
  // porque quem recebe de volta precisa saber o que fazer diferente.
  const [showDevolver, setShowDevolver] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [devolvendo, setDevolvendo] = useState(false);
  const [erroDevolucao, setErroDevolucao] = useState("");

  async function devolver() {
    if (motivoDevolucao.trim().length < 5) {
      setErroDevolucao("Explique o motivo em pelo menos 5 caracteres.");
      return;
    }
    setDevolvendo(true); setErroDevolucao("");
    try {
      await api.patch(`/chamados/${chamado.id}/devolver`, { motivo: motivoDevolucao.trim() });
      setShowDevolver(false); setMotivoDevolucao("");
      load(); onUpdated();
    } catch (e: any) {
      setErroDevolucao(e?.response?.data?.message || "Não foi possível devolver o chamado.");
    } finally { setDevolvendo(false); }
  }

  async function avaliar() {
    if (!rating) return;
    setSavingRating(true);
    try {
      await api.patch(`/chamados/${chamado.id}/avaliar`, { avaliacao: rating, avaliacaoNota: ratingNota });
      load();
      onUpdated();
    } finally {
      setSavingRating(false);
    }
  }

  const col = STATUS_COLS.find(c => c.key === detail.status) || STATUS_COLS[0];
  const nextStatuses = NEXT_STATUS[detail.status] || [];
  const isSolicitante = detail.solicitanteId === userId;
  const canEvaluate = isSolicitante && detail.status === "resolvido" && !detail.avaliacao;
  // Pode assumir: status=aberto, sem atendente, usuário tem permissão de editar,
  // e não é o solicitante (evita auto-atribuição passiva — mas mantemos como
  // possibilidade já que a regra de negócio permite). Para Jira-likeness: o
  // solicitante também pode assumir o próprio (útil em times pequenos).
  const inPublicQueue = detail.status === "aberto" && !detail.atendenteId;
  const showAssumirBtn = inPublicQueue && canEditar;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="w-full max-w-2xl bg-[var(--bg-glass)] backdrop-blur-3xl border-l border-[var(--border-subtle)] flex flex-col overflow-hidden shadow-premium-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--text-muted)] font-mono">#{detail.numero}</span>
              <span
                className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: col.color + "20", color: col.color, border: `1px solid ${col.color}40` }}
              >
                {col.label}
              </span>
              <PrioridadeBadge prioridade={detail.prioridade} />
              <SlaBadge slaStatus={detail.slaStatus} />
            </div>
            <h2 className="font-display font-bold text-[var(--text-primary)] text-xl leading-snug">{detail.titulo}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <button
              onClick={() => setShowAuditoria(s => !s)}
              title="Histórico do chamado"
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showAuditoria ? "bg-[var(--accent-violet)]/15 text-[var(--accent-violet)]" : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
            >
              <History size={16} />
            </button>
            <a href={`/dashboard/chamados/${detail.id}`} title="Abrir página completa"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Banner "Assumir chamado" — só na fila pública */}
        {showAssumirBtn && (
          <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent-violet)]/8 flex items-center gap-3 flex-shrink-0">
            <Globe2 size={16} className="text-[var(--accent-violet)] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-[var(--text-primary)]">Este chamado está na fila pública</div>
              <div className="text-[11px] text-[var(--text-muted)]">Assuma para que ele apareça apenas no seu painel.</div>
              {assumirErro && (
                <div className="mt-1 text-[11px] text-[var(--accent-red)] flex items-center gap-1">
                  <AlertCircle size={11} /> {assumirErro}
                </div>
              )}
            </div>
            <button
              onClick={assumir}
              disabled={assumindo}
              className="btn btn-violet text-xs px-4 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
            >
              {assumindo ? <Loader2 size={13} className="animate-spin" /> : <Hand size={13} />}
              Assumir Chamado
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Meta info */}
          <div className="px-6 py-5 space-y-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/40">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Solicitante</span>
                <div className="flex items-center gap-2">
                  <Avatar nome={detail.solicitante.nome} size={6} />
                  <span className="text-[var(--text-primary)] font-medium">{detail.solicitante.nome}</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Atendente</span>
                {isMaster ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="input-o text-xs py-1.5 flex-1"
                      value={detail.atendenteId || ""}
                      onChange={e => atribuir(e.target.value)}
                      disabled={atribuindo}
                    >
                      <option value="">Não atribuído</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                    <button
                      onClick={loadSuggestions}
                      className="btn btn-ghost text-xs py-1.5 px-3"
                      title="Sugerir atendente com base em skill + carga + senioridade"
                      style={{ whiteSpace:"nowrap" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display:"inline-block", verticalAlign:"middle", marginRight:4 }}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      Sugerir
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {detail.atendente
                      ? <><Avatar nome={detail.atendente.nome} size={6} /><span className="text-[var(--text-primary)] font-medium">{detail.atendente.nome}</span></>
                      : <span className="text-[var(--text-muted)] italic">Não atribuído</span>}
                  </div>
                )}
              </div>
              {/* Cliente saiu do módulo de Chamados em 11/08/2026 — não era
                  usado. A COLUNA no banco continua: chamado antigo que tenha
                  cliente preenchido não perde o dado, e voltar a exibir é
                  descomentar isto. Apagar seria irreversível. */}
              {detail.categoria && (
                <div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-1.5 block">Categoria</span>
                  <div className="flex items-center gap-1.5">
                    <Tag size={14} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-primary)] font-medium">{detail.categoria}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status actions */}
            {nextStatuses.length > 0 && (isMaster || detail.atendenteId === userId || isSolicitante) && (
              <div className="flex items-center gap-2 flex-wrap pt-2 mt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)] font-medium">Mover para:</span>
                {nextStatuses.map(s => {
                  const c = STATUS_COLS.find(x => x.key === s)!;
                  return (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      disabled={changingStatus}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all hover:opacity-90 disabled:opacity-50 uppercase tracking-wider"
                      style={{ borderColor: c.color + "40", color: c.color, background: c.color + "15" }}
                    >
                      {changingStatus ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-6 py-6 border-b border-[var(--border-subtle)]">
            <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-3">Descrição</h3>
            <p className="text-[14px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{detail.descricao}</p>
          </div>

          {/* Devolução. Só aparece para quem ESTÁ com o chamado e o recebeu de
              alguém — quem pegou da fila sozinho não tem a quem devolver. */}
          {detail.atendenteId === userId && detail.atribuidoPor && !["resolvido", "fechado"].includes(detail.status) && (
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/40">
              {!showDevolver ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Atribuído a você por <span className="text-[var(--text-secondary)] font-medium">{detail.atribuidoPor.nome}</span>.
                  </p>
                  <button onClick={() => setShowDevolver(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
                    Devolver
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] text-[var(--text-muted)] font-mono block uppercase tracking-wider">
                    Por que está devolvendo? *
                  </label>
                  <textarea
                    value={motivoDevolucao}
                    onChange={e => setMotivoDevolucao(e.target.value)}
                    rows={2} autoFocus
                    placeholder="Ex.: não é da minha área, estou sem acesso ao sistema, já existe chamado igual..."
                    className="input-o text-[13px]"
                  />
                  {erroDevolucao && <p className="text-[11px] text-[var(--accent-red)]">{erroDevolucao}</p>}
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Volta para {detail.atribuidoPor.nome}, não para a fila pública.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={devolver} disabled={devolvendo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[var(--accent-violet)] hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {devolvendo && <Loader2 size={12} className="animate-spin" />}
                      Confirmar devolução
                    </button>
                    <button onClick={() => { setShowDevolver(false); setErroDevolucao(""); }}
                      className="px-3 py-1.5 rounded-md text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Frotas: o chamado é onde o problema é relatado; a OS é onde ele é
              trabalhado. O botão evita redigitar o relato no outro módulo. */}
          {detail.veiculo && (
            <PainelFrota detail={detail} canEditar={canEditar} onUpdated={() => { load(); onUpdated(); }} />
          )}

          {/* Auditoria / Histórico */}
          {showAuditoria && (
            <div className="px-6 py-6 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/30">
              <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4 flex items-center gap-2">
                <History size={13} /> Histórico ({auditoria.length})
              </h3>
              {auditoria.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] italic text-center py-3 bg-[var(--bg-hover)] rounded-lg border border-dashed border-[var(--border-subtle)]">Nenhuma ação registrada ainda.</p>
              ) : (
                <ol className="space-y-3">
                  {auditoria.map(e => {
                    const labelMap: Record<string, { txt: string; icon: any; color: string }> = {
                      criado:               { txt: "Chamado criado",                icon: Plus,        color: "var(--text-secondary)" },
                      assumido:             { txt: "Assumiu o chamado",             icon: Hand,        color: "var(--accent-violet)" },
                      atribuicao:           { txt: "Atribuído",                     icon: UserIcon,    color: "#60a5fa" },
                      atribuicao_removida:  { txt: "Atribuição removida",           icon: X,           color: "#94a3b8" },
                      transferencia:        { txt: "Transferido",                   icon: UserIcon,    color: "#fbbf24" },
                      status:               { txt: "Status alterado",               icon: CheckCircle2,color: "#34d399" },
                      prioridade:           { txt: "Prioridade alterada",           icon: AlertCircle, color: "#fbbf24" },
                    };
                    const meta = labelMap[e.acao] || { txt: e.acao, icon: History, color: "var(--text-muted)" };
                    const Icon = meta.icon;
                    return (
                      <li key={e.id} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: meta.color + "20", color: meta.color, border: `1px solid ${meta.color}40` }}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-[var(--text-primary)]">{meta.txt}</span>
                            {(e.de || e.para) && (e.acao === "status" || e.acao === "prioridade") && (
                              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                {e.de || "—"} <span className="opacity-50">→</span> {e.para || "—"}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {e.user?.nome || "Sistema"} • {formatDate(e.criadoEm)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="px-6 py-6 bg-[var(--bg-primary)]/20">
            <h3 className="text-[11px] font-mono font-bold text-[var(--text-muted)] tracking-widest uppercase mb-4 flex items-center gap-2">
              <MessageSquare size={13} /> Comentários ({detail.comentarios?.length || 0})
            </h3>
            <div className="space-y-4">
              {(detail.comentarios || []).map(c => (
                <div key={c.id} className={`flex gap-3 ${c.interno ? "opacity-80" : ""}`}>
                  <Avatar nome={c.user.nome} size={8} />
                  <div className="flex-1 min-w-0 bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-xl shadow-premium-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">{c.user.nome}</span>
                      {c.interno && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 px-1.5 py-0.5 rounded">interno</span>
                      )}
                      <span className="text-[10px] text-[var(--text-muted)] ml-auto font-mono">{relTime(c.criadoEm)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{c.texto}</p>
                  </div>
                </div>
              ))}
              {(!detail.comentarios || detail.comentarios.length === 0) && (
                <p className="text-[13px] text-[var(--text-muted)] italic text-center py-4 bg-[var(--bg-hover)] rounded-xl border border-dashed border-[var(--border-subtle)]">Nenhum comentário ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Comment input */}
        {detail.status !== "fechado" && (
          <div className="border-t border-[var(--border-subtle)] p-4 flex-shrink-0 bg-[var(--bg-card)]">
            {isMaster && (
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] mb-3 cursor-pointer select-none w-fit hover:text-[var(--text-primary)] transition-colors">
                <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} className="rounded border-[var(--border-strong)] bg-transparent w-4 h-4 text-[var(--accent-violet)] focus:ring-[var(--accent-violet)]" />
                Comentário interno (não visível ao solicitante)
              </label>
            )}
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="input-o flex-1 min-h-[50px] resize-none"
                placeholder="Escreva um comentário..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment(); }}
              />
              <button
                onClick={sendComment}
                disabled={!comment.trim() || sending}
                className="btn btn-violet px-4 flex items-center justify-center disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Smart Suggest Drawer */}
      {showSuggest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={()=>setShowSuggest(false)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-2xl w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display">Sugestão de atendente</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Top 5 colaboradores ordenados por: skill + carga + senioridade</p>
              </div>
              <button onClick={()=>setShowSuggest(false)} className="btn-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              {loadingSuggest ? (
                <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-sm text-[var(--text-muted)]">
                  Nenhum colaborador qualificado encontrado.<br/>
                  <span className="text-xs">Verifique se há colaboradores ativos cadastrados{(detail as any)?.skillRequeridaId ? " com a skill requerida" : ""}.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {suggestions.map((s,i)=>{
                    const utilColor = s.carga.utilizacao > 90 ? "var(--accent-red)" : s.carga.utilizacao > 70 ? "#fbbf24" : "var(--accent-green)";
                    return (
                      <div key={s.collaborator.id} className="card-premium p-4" style={{ borderLeft: i===0 ? "3px solid var(--accent-violet)" : "3px solid var(--border-subtle)" }}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <Avatar nome={s.collaborator.nome} size={10} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-[13px] font-semibold text-[var(--text-primary)]">{s.collaborator.nome}</div>
                                <div className="text-[11px] text-[var(--text-muted)]">{s.collaborator.cargo || "—"} {s.collaborator.setor?.nome ? `• ${s.collaborator.setor.nome}` : ""}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider">SCORE</div>
                                <div className="text-base font-bold" style={{ color: i===0 ? "var(--accent-violet)" : "var(--text-secondary)" }}>{s.score}</div>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 items-center text-[10px]">
                              {s.skillMatch && (
                                <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.12)", color: "var(--accent-violet)", border: "1px solid rgba(124,58,237,0.2)" }}>
                                  Skill {s.skillMatch.nivel}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full font-mono" style={{ background: utilColor + "20", color: utilColor, border: `1px solid ${utilColor}40` }}>
                                {s.carga.utilizacao}% util
                              </span>
                              <span className="text-[var(--text-muted)] font-mono">
                                {s.carga.ticketsAbertos} chamados • {s.carga.horasAlocadas}h / {s.carga.jornadaMes}h
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-[var(--text-secondary)] italic">{s.motivo}</div>
                          </div>
                        </div>
                        <button
                          className="btn btn-violet w-full mt-3 text-xs"
                          onClick={()=>{ atribuir(s.collaborator.userId); setShowSuggest(false); }}
                        >
                          Atribuir a {s.collaborator.nome.split(" ")[0]}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk Action Bar ────────────────────────────────────────────────────────────
function BulkActionBar({ ids, users, onDone, onCancel }: {
  ids: string[]; users: Usuario[];
  onDone: () => void; onCancel: () => void;
}) {
  const [status, setStatus] = useState("");
  const [atendente, setAtendente] = useState("");
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (!status && !atendente) return;
    setSaving(true);
    try {
      if (status)    await api.patch("/chamados/bulk/status",   { ids, status });
      if (atendente) await api.patch("/chamados/bulk/atribuir", { ids, atendenteId: atendente || null });
      onDone();
    } catch { } finally { setSaving(false); }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3 card-premium rounded-full shadow-premium-xl border-[var(--accent-violet)]/30 backdrop-blur-xl animate-in slide-in-from-bottom-8">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-violet)]/20 text-[var(--accent-violet)] font-bold text-xs">
        {ids.length}
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">selecionados</span>
      <div className="w-px h-5 bg-[var(--border-medium)] mx-1" />
      <select value={status} onChange={e => setStatus(e.target.value)}
        className="input-o text-xs py-1.5 min-w-[140px] rounded-full px-4 border-transparent bg-[var(--bg-hover)]">
        <option value="">Alterar status...</option>
        {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <select value={atendente} onChange={e => setAtendente(e.target.value)}
        className="input-o text-xs py-1.5 min-w-[140px] rounded-full px-4 border-transparent bg-[var(--bg-hover)]">
        <option value="">Atribuir para...</option>
        <option value="__none__">Remover atribuição</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <button onClick={apply} disabled={saving || (!status && !atendente)}
        className="btn btn-violet text-xs py-1.5 px-5 rounded-full disabled:opacity-50 font-bold ml-2">
        {saving ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
      </button>
      <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ChamadosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Duas listas ao mesmo tempo: triar (fila) e tocar (meus) são o mesmo
  // trabalho em momentos diferentes, e alternar aba escondia metade dele.
  const [chamadosFila, setChamadosFila] = useState<Chamado[]>([]);
  const [chamadosMeus, setChamadosMeus] = useState<Chamado[]>([]);

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Chamado | null>(null);
  const [showNew, setShowNew] = useState(false);
  // Filtros inicializados da URL
  const [search, setSearch] = useState(() => searchParams?.get("q") || "");
  const [filterStatus, setFilterStatus] = useState(() => searchParams?.get("status") || "");
  const [filterPrio, setFilterPrio] = useState(() => searchParams?.get("prioridade") || "");
  const [filterCat, setFilterCat] = useState(() => searchParams?.get("categoria") || "");
  const [scope, setScope] = useState<Scope>(() => (searchParams?.get("scope") as Scope) || "meus");
  // Filtros recolhidos por padrão: são três campos que quase nunca mudam e
  // custavam uma faixa inteira da tela.
  const [aba, setAba] = useState<"chamados" | "equipe" | "historico" | "filtros">("chamados");
  // Id do chamado em preview. Guardado na pagina, nao no grid, para o painel
  // sobreviver a recarga da lista depois de assumir.
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Carga do time. Só carrega quando a aba abre — é agregação e não faz
  // sentido pagá-la em toda visita à tela.
  const [cargaEscopo, setCargaEscopo] = useState<"equipe" | "todos">("equipe");
  const [carga, setCarga] = useState<any>(null);
  const [cargaLoading, setCargaLoading] = useState(false);
  // Histórico: recorte, período e resultado. Carrega só quando a aba abre —
  // é consulta ampla e não faz sentido pagá-la em toda visita à tela.
  const [histEscopo, setHistEscopo] = useState<"meus" | "equipe" | "todos">("meus");
  const [histDesde, setHistDesde] = useState("");
  const [histAte, setHistAte] = useState("");
  const [histBusca, setHistBusca] = useState("");
  const [histItens, setHistItens] = useState<Chamado[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkUsers, setBulkUsers] = useState<Usuario[]>([]);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  // Drag-and-drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  // Arrastar para "aguardando" pergunta de que o chamado depende. O atrito é
  // o ponto: sem essa resposta o estado vira buraco negro.
  const [perguntaEspera, setPerguntaEspera] = useState<{ id: string; numero: number } | null>(null);
  const [motivoEspera, setMotivoEspera] = useState("");

  // Quem pode editar/assumir chamado: master OU permissão chamados:editar/*
  const canEditar = !!(user?.isMaster
    || user?.permissions?.includes("*")
    || user?.permissions?.includes("chamados:editar"));

  // Master pode ver "Todos" (sem filtro de propriedade). Demais: fila ∪ meus.
  useEffect(() => {
    if (!user?.isMaster && scope === "todos") setScope("meus");
  }, [user?.isMaster, scope]);

  // Sync filtros → URL (preserva compartilhamento e refresh)
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (filterStatus) p.set("status", filterStatus);
    if (filterPrio) p.set("prioridade", filterPrio);
    if (filterCat) p.set("categoria", filterCat);
    if (scope !== "meus") p.set("scope", scope);
    const q = p.toString();
    router.replace(`/dashboard/chamados${q ? "?" + q : ""}`, { scroll: false });
  }, [search, filterStatus, filterPrio, filterCat, scope]);

  // Drag-and-drop: muda status ao soltar em outra coluna
  const handleDrop = useCallback(async (newStatus: string) => {
    if (!dragId || !newStatus) return;
    const chamado = chamadosMeus.find(c => c.id === dragId);
    if (!chamado || chamado.status === newStatus) { setDragId(null); setDragOver(null); return; }
    // Antes de mover para a espera, pergunta o motivo — depois o chamado some
    // do radar e ninguém lembra do que dependia.
    if (newStatus === "aguardando") {
      setPerguntaEspera({ id: chamado.id, numero: chamado.numero });
      setMotivoEspera("");
      setDragId(null); setDragOver(null);
      return;
    }
    // Otimista: atualiza localmente primeiro
    setChamadosMeus(prev => prev.map(c => c.id === dragId ? { ...c, status: newStatus } : c));
    setDragId(null); setDragOver(null);
    try {
      await api.patch(`/chamados/${dragId}/status`, { status: newStatus });
      setToast({ type: "ok", msg: `#${chamado.numero} movido para ${newStatus.replace("_"," ")}` });
    } catch {
      // Reverte em caso de erro
      setChamadosMeus(prev => prev.map(c => c.id === dragId ? { ...c, status: chamado.status } : c));
      setToast({ type: "err", msg: "Não foi possível mover o chamado." });
    }
  }, [dragId, chamadosMeus]);

  async function confirmarEspera() {
    if (!perguntaEspera) return;
    const alvo = perguntaEspera;
    setPerguntaEspera(null);
    // Otimista, igual ao arrastar normal: a coluna reage na hora.
    setChamadosMeus(prev => prev.map(c => c.id === alvo.id
      ? { ...c, status: "aguardando", aguardandoDesde: new Date().toISOString(), aguardandoMotivo: motivoEspera.trim() || null }
      : c));
    try {
      await api.patch(`/chamados/${alvo.id}/status`, {
        status: "aguardando",
        aguardandoMotivo: motivoEspera.trim() || undefined,
      });
      setToast({ type: "ok", msg: `#${alvo.numero} em espera.` });
      load();
    } catch {
      setToast({ type: "err", msg: "Não foi possível mover o chamado." });
      load();
    }
  }

  function toggleBulk(id: string) {
    setBulkIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPrio) params.set("prioridade", filterPrio);
      if (filterCat) params.set("categoria", filterCat);
      if (search) params.set("q", search);
      const pFila = new URLSearchParams(params); pFila.set("scope", "fila");
      const pMeus = new URLSearchParams(params); pMeus.set("scope", scope === "todos" ? "todos" : "meus");
      const [fRes, mRes] = await Promise.all([
        api.get(`/chamados?${pFila}`),
        api.get(`/chamados?${pMeus}`),
      ]);
      setChamadosFila(Array.isArray(fRes.data) ? fRes.data : []);
      setChamadosMeus(Array.isArray(mRes.data) ? mRes.data : []);
    } catch {
      setChamadosFila([]); setChamadosMeus([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPrio, filterCat, search, scope]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Handler: assumir chamado da fila pública (atômico no backend; trata 409).
  const handleAssumir = useCallback(async (id: string) => {
    // Quem tentou pegar é quem precisa saber POR QUE não conseguiu — em
    // fila compartilhada, "erro ao assumir" quase sempre significa que alguém
    // chegou primeiro, e dizer isso evita a segunda tentativa inútil.
    const alvo = chamadosFila.find(c => c.id === id);
    try {
      await api.patch(`/chamados/${id}/assumir`);
      setToast({ type: "ok", msg: `#${alvo?.numero ?? ""} agora é seu.` });
      if (previewId === id) setPreviewId(null);
      load();
    } catch (err: any) {
      const status = err?.response?.status;
      const dono = err?.response?.data?.atendente?.nome;
      const msg = status === 409 || status === 400
        ? (dono ? `${dono} assumiu este chamado antes de você.` : "Outra pessoa assumiu este chamado antes de você.")
        : (err?.response?.data?.message || "Não foi possível assumir o chamado.");
      setToast({ type: "err", msg });
      load(); // revalida pra remover da fila se outra pessoa pegou
    }
  }, [load, chamadosFila]);

  /** Assume vários de uma vez. Sequencial de propósito: o backend resolve a
   *  disputa um a um, e em paralelo o relato de quem falhou se perde. */
  const handleAssumirVarios = useCallback(async (ids: string[]) => {
    let pegos = 0, perdidos = 0;
    for (const id of ids) {
      try { await api.patch(`/chamados/${id}/assumir`); pegos++; }
      catch { perdidos++; }
    }
    setToast(
      perdidos === 0
        ? { type: "ok", msg: `${pegos} chamado(s) assumido(s).` }
        : { type: "err", msg: `${pegos} assumido(s); ${perdidos} já tinham dono.` },
    );
    load();
  }, [load]);

  useEffect(() => { load(); }, [load]);

  const carregarHistorico = useCallback(async () => {
    setHistLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("scope", histEscopo);
      if (histBusca.trim()) p.set("q", histBusca.trim());
      if (histDesde) p.set("desde", histDesde);
      if (histAte) p.set("ate", histAte);
      const r = await api.get(`/chamados?${p}`);
      setHistItens(Array.isArray(r.data) ? r.data : []);
    } catch { setHistItens([]); } finally { setHistLoading(false); }
  }, [histEscopo, histBusca, histDesde, histAte]);

  useEffect(() => { if (aba === "historico") carregarHistorico(); }, [aba, carregarHistorico]);

  const carregarCarga = useCallback(async () => {
    setCargaLoading(true);
    try {
      const r = await api.get(`/chamados/carga-equipe?escopo=${cargaEscopo}`);
      setCarga(r.data);
    } catch { setCarga(null); } finally { setCargaLoading(false); }
  }, [cargaEscopo]);

  useEffect(() => { if (aba === "equipe") carregarCarga(); }, [aba, carregarCarga]);

  useEffect(() => {
    if (user?.isMaster) api.get("/users").then(r => setBulkUsers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [user?.isMaster]);

  // Mesma regra do backend: distribuir trabalho e o sinal de supervisao.
  const podeVerTudo = !!user?.isMaster
    || (user as any)?.permissions?.includes("*")
    || (user as any)?.permissions?.includes("chamados:atribuir");
  const qtdFiltros = [filterStatus, filterPrio, filterCat].filter(Boolean).length;

  // Proporção elástica entre fila e quadro. Era 50/50 fixo: com a fila vazia,
  // metade da tela exibia um aviso de "nada aqui" enquanto o quadro se
  // espremia. O peso acompanha o volume, com piso e teto para nenhum dos dois
  // engolir o outro.
  const filaVazia = chamadosFila.length === 0;
  const pesoFila = Math.min(6, Math.max(3, chamadosFila.length));
  const pesoMeus = Math.min(7, Math.max(4, chamadosMeus.length || 4));

  // Derivado das listas em tela, não de uma consulta paralela: é o que garante
  // que o número nunca discorde do que está logo abaixo dele.
  const resumo = useMemo(() => {
    const todos = [...chamadosFila, ...chamadosMeus];
    return {
      violados: todos.filter(c => c.slaStatus === "violado").length,
      risco: todos.filter(c => c.slaStatus === "risco").length,
    };
  }, [chamadosFila, chamadosMeus]);

  // Quanto tempo o mais paciente da fila está esperando. É a pergunta da
  // triagem, e não aparecia em lugar nenhum da tela.
  const maisAntigoFila = useMemo(() => {
    if (!chamadosFila.length) return null;
    return chamadosFila.reduce((a, b) =>
      new Date(a.criadoEm).getTime() <= new Date(b.criadoEm).getTime() ? a : b);
  }, [chamadosFila]);

  const byCols = COLS_KANBAN.map(col => {
    const todos = chamadosMeus.filter(c => c.status === col.key);
    if (!COLS_TERMINAIS.includes(col.key)) return { ...col, items: todos, ocultos: 0, total: todos.length };
    const { visiveis, ocultos } = recorteTerminal(todos);
    return { ...col, items: visiveis, ocultos, total: todos.length };
  });

  const topbarActions = (
    <>
      <button onClick={load}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors">
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
      </button>
      {(chamadosFila.length + chamadosMeus.length) > 0 && (
        <button onClick={() => exportCSV([...chamadosFila, ...chamadosMeus])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Exportar chamados em CSV">
          <Download size={13} /> CSV
        </button>
      )}
      {/* A ação principal da tela, com a cor da ação principal.
          Estava com as MESMAS classes de "Atualizar" e "CSV" — borda cinza,
          texto apagado, fundo transparente — e sumia no meio delas. Quem chega
          para abrir um chamado tem que achar o botão sem procurar. */}
      <button onClick={() => setShowNew(true)} className="btn btn-violet" style={{ fontSize: 12, padding: "6px 14px" }}>
        <Plus size={13} /> Novo Chamado
      </button>
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <Topbar>{topbarActions}</Topbar>

      {/* Abas. Chamados mostra as duas listas juntas; Filtros é só ajuste. */}
      <div className="px-6 pt-2 border-b border-[var(--border-subtle)] flex-shrink-0 bg-[var(--bg-primary)]">
        <div className="flex items-center gap-1">
          {([
            { k: "chamados" as const, label: "Chamados", icon: Inbox, count: chamadosFila.length + chamadosMeus.length },
            { k: "equipe" as const, label: "Equipe", icon: Users, count: undefined },
            { k: "historico" as const, label: "Histórico", icon: History, count: undefined },
            { k: "filtros" as const,  label: "Filtros",  icon: SlidersHorizontal, count: qtdFiltros || undefined },
          ]).map(t => {
            const ativo = aba === t.k;
            const Icon = t.icon;
            return (
              <button key={t.k} onClick={() => setAba(t.k)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 -mb-px
                  ${ativo ? "text-[var(--accent-violet)] border-[var(--accent-violet)]"
                          : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]"}`}>
                <Icon size={14} />
                {t.label}
                {typeof t.count === "number" && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border
                    ${ativo ? "bg-[var(--accent-violet)]/15 text-[var(--accent-violet)] border-[var(--accent-violet)]/30"
                            : "bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-subtle)]"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {aba === "equipe" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--border-subtle)] flex-shrink-0 flex items-center gap-3 bg-[var(--bg-primary)]">
            <div className="flex gap-1">
              {([["equipe","Minha equipe"],["todos","Toda a organização"]] as const)
                .filter(([k]) => k !== "todos" || podeVerTudo)
                .map(([k, rotulo]) => (
                <button key={k} onClick={() => setCargaEscopo(k)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors
                    ${cargaEscopo === k ? "border-[var(--accent-violet)] bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]"
                                       : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}>
                  {rotulo}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">
              {cargaLoading ? "calculando..." : `${carga?.totalAtivos ?? 0} chamado(s) em aberto`}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CargaEquipe dados={carga} loading={cargaLoading} />
          </div>
        </div>
      ) : aba === "historico" ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--border-subtle)] flex-shrink-0 flex items-end gap-3 flex-wrap bg-[var(--bg-primary)]">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] font-mono block mb-1 uppercase tracking-wider">Recorte</label>
              <div className="flex gap-1">
                {([["meus","Meus"],["equipe","Minha equipe"],["todos","Todos"]] as const)
                  .filter(([k]) => k !== "todos" || podeVerTudo)
                  .map(([k, rotulo]) => (
                  <button key={k} onClick={() => setHistEscopo(k)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors
                      ${histEscopo === k ? "border-[var(--accent-violet)] bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]"
                                         : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}>
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <label className="text-[10px] text-[var(--text-muted)] font-mono block mb-1 uppercase tracking-wider">Buscar</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input className="input-o pl-9 py-1.5 text-[13px]" placeholder="Título, descrição ou número (ex.: 38)..."
                  value={histBusca} onChange={e => setHistBusca(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] font-mono block mb-1 uppercase tracking-wider">De</label>
              <input type="date" className="input-o py-1.5 w-auto text-[13px]" value={histDesde} onChange={e => setHistDesde(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] font-mono block mb-1 uppercase tracking-wider">Até</label>
              <input type="date" className="input-o py-1.5 w-auto text-[13px]" value={histAte} onChange={e => setHistAte(e.target.value)} />
            </div>
            {(histBusca || histDesde || histAte) && (
              <button onClick={() => { setHistBusca(""); setHistDesde(""); setHistAte(""); }}
                className="btn btn-ghost py-1.5 px-3 text-[12px] text-[var(--accent-red)] hover:bg-red-500/10">
                Limpar
              </button>
            )}
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">
              {histLoading ? "buscando..." : `${histItens.length} chamado(s)`}
              {histItens.length >= 500 && " (teto de 500 — refine o período)"}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <HistoricoGrid chamados={histItens} loading={histLoading} onOpen={c => setSelected(c)} />
          </div>
        </div>
      ) : aba === "filtros" ? (
        /* Tela de ajuste: sem lista e sem "assumir". Quem veio filtrar não veio
           agir — misturar as duas coisas foi o que encheu a tela antes. */
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-2xl space-y-5">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Buscar</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input className="input-o pl-9 py-2" placeholder="Título, descrição ou número..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Status</label>
                <select className="input-o py-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Todos</option>
                  {STATUS_COLS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Prioridade</label>
                <select className="input-o py-2" value={filterPrio} onChange={e => setFilterPrio(e.target.value)}>
                  <option value="">Todas</option>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_MAP[p].label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-mono block mb-1.5 uppercase tracking-wider">Categoria</label>
                <select className="input-o py-2" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="">Todas</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button onClick={() => setAba("chamados")} className="btn btn-violet text-[12px] py-2 px-4">
                Ver {chamadosFila.length + chamadosMeus.length} resultado(s)
              </button>
              {(filterStatus || filterPrio || filterCat || search) && (
                <button onClick={() => { setFilterStatus(""); setFilterPrio(""); setFilterCat(""); setSearch(""); }}
                  className="btn btn-ghost text-[12px] py-2 px-3 text-[var(--accent-red)] hover:bg-red-500/10 inline-flex items-center gap-1.5">
                  <X size={13} /> Limpar filtros
                </button>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {chamadosFila.length} na fila pública · {chamadosMeus.length} seus. Os filtros valem para as duas listas.
            </p>
          </div>
        </div>
      ) : (
        /* Fila em cima, meus embaixo. As duas são o mesmo trabalho em momentos
           diferentes — triar e tocar — e alternar aba escondia metade dele. */
        <div className="flex-1 flex flex-col overflow-hidden">
          <section
            className="flex flex-col overflow-hidden border-b-2 border-[var(--border-subtle)] transition-[flex-grow] duration-300"
            style={filaVazia ? { flex: "0 0 auto" } : { flex: `${pesoFila} 1 0` }}
          >
            {/* alertas-no-cabecalho: o que era uma barra própria acima das abas
                mora aqui. SLA e tempo de espera são assunto DESTA lista, e como
                título de seção eles custam zero altura extra. */}
            <div className="px-6 py-2 flex items-center gap-2 flex-shrink-0 bg-[var(--bg-primary)]">
              <Globe2 size={13} className="text-[var(--text-muted)]" />
              <span className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Fila pública</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                {chamadosFila.length}
              </span>
              {canEditar && chamadosFila.length > 0 && (
                <span className="text-[11px] text-[var(--text-muted)] ml-1">duplo clique assume</span>
              )}
              {/* Contagem explícita: evita a dúvida de "será que tem mais?". */}
              {chamadosFila.length > 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  · exibindo {chamadosFila.length}
                </span>
              )}
              {chamadosFila.length > 0 && (
                <button
                  onClick={() => setPreviewId(previewId ? null : chamadosFila[0].id)}
                  title="Ler o chamado ao lado da lista, sem abrir"
                  className={`ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors
                    ${previewId ? "border-[var(--accent-violet)] bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]"
                                : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
                >
                  <BookOpen size={11} /> Preview
                </button>
              )}

              <span className="flex-1" />

              <div className="flex items-center gap-1.5 text-[11px]">
                {resumo.violados > 0 && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10">
                    <AlertCircle size={11} className="text-red-400" />
                    <span className="text-[var(--text-muted)]">SLA violado</span>
                    <span className="font-mono font-bold text-red-400 tabular-nums">{resumo.violados}</span>
                  </span>
                )}
                {resumo.risco > 0 && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-yellow-500/30 bg-yellow-500/10">
                    <Clock size={11} className="text-yellow-400" />
                    <span className="text-[var(--text-muted)]">em risco</span>
                    <span className="font-mono font-bold text-yellow-400 tabular-nums">{resumo.risco}</span>
                  </span>
                )}
                {maisAntigoFila && (
                  <button
                    onClick={() => setSelected(maisAntigoFila)}
                    title={`Abrir o chamado que espera há mais tempo: ${maisAntigoFila.titulo}`}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <span className="text-[var(--text-muted)]">espera há</span>
                    <span className="font-mono font-bold text-[var(--text-secondary)] tabular-nums">
                      {relTime(maisAntigoFila.criadoEm)}
                    </span>
                  </button>
                )}
                {resumo.violados === 0 && resumo.risco === 0 && chamadosFila.length === 0 && (
                  <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                    tudo em dia
                  </span>
                )}
              </div>
            </div>
            {/* Fila vazia não precisa de área de conteúdo: o cabeçalho já diz
                que está vazia, e a altura volta para o quadro. */}
            {!filaVazia && (
            <div className="flex-1 overflow-hidden">
              <FilaGrid
                chamados={chamadosFila}
                loading={loading}
                onOpen={c => setSelected(c)}
                onAssumir={handleAssumir}
                onAssumirVarios={handleAssumirVarios}
                podeAssumir={canEditar}
                preview={previewId}
                onPreview={c => setPreviewId(c ? c.id : null)}
              />
            </div>
            )}
          </section>

          <section className="flex flex-col overflow-hidden" style={{ flex: `${pesoMeus} 1 0` }}>
            <div className="px-6 py-2 flex items-center gap-2 flex-shrink-0 bg-[var(--bg-primary)]">
              <UserIcon size={13} className="text-[var(--text-muted)]" />
              <span className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">Meus chamados</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                {chamadosMeus.length}
              </span>
            </div>
            <div className="flex-1 overflow-hidden px-4 pb-3">
              {loading && chamadosMeus.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : (
                /* `flex-1` em vez de largura fixa: as colunas dividem a tela
                   e o quadro inteiro fica visível. Arrastar só é previsível
                   quando o destino não está fora do campo de visão. */
                <div className="flex gap-3 h-full">
                  {byCols.map(col => (
                    <div key={col.key} className="flex-1 min-w-0 flex flex-col"
                      onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={() => handleDrop(col.key)}
                    >
                      <div className="px-1 mb-2 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: col.color, boxShadow: `0 0 8px ${col.color}80` }} />
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wide uppercase">{col.label}</span>
                        </div>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-full px-1.5">
                            {(col as any).ocultos > 0 ? `${col.items.length} de ${(col as any).total}` : col.items.length}
                          </span>
                          {/* O corte precisa ser dito. Chamado que some sem
                              explicação faz desconfiar da tela inteira. */}
                          {(col as any).ocultos > 0 && (
                            <button onClick={() => setAba("historico")}
                              title={`${(col as any).ocultos} fora deste período — ver no histórico`}
                              className="text-[10px] text-[var(--accent-violet)] hover:underline">
                              +{(col as any).ocultos}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className={`flex-1 overflow-y-auto space-y-2 px-1 pb-2 rounded-lg transition-all ${dragOver === col.key && dragId ? "bg-[var(--bg-hover)] ring-2 ring-inset ring-[var(--border-medium)]" : ""}`}>
                        {col.items.length === 0 && dragOver !== col.key && (
                          // Faixa discreta em vez de caixa: coluna vazia não pode
                          // ter mais presença visual que coluna com trabalho.
                          <p className="text-[10px] text-[var(--text-muted)] text-center py-2 opacity-60">vazio</p>
                        )}
                        {col.items.map(c => (
                          <div key={c.id}
                            draggable={canEditar}
                            onDragStart={() => setDragId(c.id)}
                            onDragEnd={() => { setDragId(null); setDragOver(null); }}
                            style={{ opacity: dragId === c.id ? 0.4 : 1, cursor: canEditar ? "grab" : "default" }}
                          >
                            <ChamadoCard chamado={c} onClick={() => setSelected(c)}
                              selected={bulkIds.has(c.id)}
                              onSelect={user?.isMaster ? e => { e.stopPropagation(); toggleBulk(c.id); } : undefined}
                              onAssumir={handleAssumir}
                              canAssumir={canEditar}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Bulk action bar */}
      {bulkIds.size > 0 && (
        <BulkActionBar
          ids={[...bulkIds]}
          users={bulkUsers}
          onDone={() => { setBulkIds(new Set()); load(); }}
          onCancel={() => setBulkIds(new Set())}
        />
      )}

      {/* Espera: o motivo é o que impede o chamado de virar buraco negro. */}
      {perguntaEspera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPerguntaEspera(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <div className="text-sm font-semibold text-foreground">Colocar #{perguntaEspera.numero} em espera</div>
              <div className="text-[11px] text-[var(--text-muted)]">Do que este chamado depende para continuar?</div>
            </div>
            <div className="p-6 space-y-3">
              <input
                value={motivoEspera}
                onChange={e => setMotivoEspera(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmarEspera(); }}
                autoFocus
                placeholder="Ex.: retorno do fornecedor, aprovação de compra, peça em trânsito..."
                className="input-o text-[13px]"
              />
              <p className="text-[11px] text-[var(--text-muted)]">
                Fica visível no card e o contador começa agora. Sem isso, daqui a três semanas ninguém lembra do que se esperava.
              </p>
              <div className="flex gap-2 pt-1">
                <button onClick={confirmarEspera}
                  className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[var(--accent-violet)] hover:opacity-90 transition-opacity">
                  Colocar em espera
                </button>
                <button onClick={() => setPerguntaEspera(null)}
                  className="px-3 py-1.5 rounded-md text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals / Drawers */}
      {showNew && <NovoChamadoModal onClose={() => setShowNew(false)} onCreated={load} />}
      {selected && user && (
        <ChamadoDrawer
          chamado={selected}
          isMaster={!!user.isMaster}
          userId={user.id}
          canEditar={canEditar}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}

      {/* Toast (assumir chamado / conflitos) */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[80] flex items-center gap-2 px-4 py-3 rounded-xl shadow-premium-lg border backdrop-blur-xl animate-in slide-in-from-bottom-4
          ${toast.type === "ok"
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
            : "bg-red-500/15 border-red-500/30 text-red-300"}`}>
          {toast.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
