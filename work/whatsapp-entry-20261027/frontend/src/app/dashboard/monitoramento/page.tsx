"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { connectMonitoringSocket, disconnectMonitoringSocket, type ProbeTick, type StatusChange } from "@/lib/monitoringSocket";
import {
  Activity, AlertTriangle, CheckCircle2, CircleSlash, Radio, ChevronDown, ChevronRight,
  MapPin, Tv2, BarChart3, Search, X, Filter, Zap, Cpu, Camera, Server, Building, Network,
  ExternalLink, FolderClock,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// Types & constants
// ──────────────────────────────────────────────────────────────────────────────
type Status = "ONLINE" | "OFFLINE" | "INSTAVEL" | "NAO_MONITORADO";
type Asset = {
  id: string; nome: string; ip: string; hostname?: string; categoria: string; tipo: string;
  link?: string | null;
  ultimoStatus: Status; ultimaLatenciaMs: number | null; ultimoCheckEm: string | null;
  /** Desde quando está neste estado. Vem do backend, só para não-ONLINE. */
  desdeEm?: string | null;
  unidade?: { id: string; nome: string };
  supressedByDep?: boolean; latenciaAnomala?: boolean; latenciaBaseMs?: number | null;
  dependeDe?: { id: string; nome: string; ultimoStatus: string } | null;
};

function normalizeLink(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "http://" + t;
}
// Deriva a URL da IMAGEM (snapshot) a partir do link da camera.
// Se o link ja aponta pra um endpoint de imagem, usa direto; senao tenta o caminho padrao.
function snapshotUrl(link: string): string {
  const base = normalizeLink(link).replace(/\/+$/, "");
  if (/(snapshot|\.cgi|\.jpe?g|\.mjpe?g)/i.test(base)) return base;
  return base + "/cgi-bin/snapshot.cgi";
}
type Summary = { total: number; monitorados: number; online: number; offline: number; instavel: number; naoMon: number; disponPct: number };

/**
 * Estado → token. Nenhum hex aqui.
 *
 * Os valores eram literais (`#22c55e`, `rgba(34,197,94,0.10)`) repetidos nas
 * três telas do módulo. Fora do sistema de tokens, o monitoramento parecia
 * outro produto — e no tema escuro usava um verde calibrado para fundo claro.
 * Ver `--mon-*` em globals.css.
 */
const STATUS: Record<Status, { dot: string; bg: string; fg: string; label: string; ring: string }> = {
  ONLINE:         { dot: "var(--mon-ok)",   bg: "var(--mon-ok-soft)",   fg: "var(--mon-ok)",   label: "Online",         ring: "var(--mon-ok-line)"   },
  OFFLINE:        { dot: "var(--mon-down)", bg: "var(--mon-down-soft)", fg: "var(--mon-down)", label: "Offline",        ring: "var(--mon-down-line)" },
  INSTAVEL:       { dot: "var(--mon-warn)", bg: "var(--mon-warn-soft)", fg: "var(--mon-warn)", label: "Instável",       ring: "var(--mon-warn-line)" },
  NAO_MONITORADO: { dot: "var(--mon-idle)", bg: "var(--mon-idle-soft)", fg: "var(--mon-idle)", label: "Não monitorado", ring: "var(--mon-idle-line)" },
};

const CATEGORIAS = [
  { v: "ITS",            label: "ITS",            icon: Camera,   tag: "Câmeras, PMV, radar" },
  { v: "SERVIDORES",     label: "Servidores",     icon: Server,   tag: "Físicos, virtuais, storage" },
  { v: "COMPUTADORES",   label: "Computadores",   icon: Cpu,      tag: "Desktops, notebooks" },
  { v: "PRACAS",         label: "Praças",         icon: Building, tag: "Pedágio, cabines" },
  { v: "INFRAESTRUTURA", label: "Infraestrutura", icon: Network,  tag: "Switches, roteadores, nobreak" },
] as const;

const fmtAgo = (s: string | null) => {
  if (!s) return "—";
  const diff = Date.now() - new Date(s).getTime();
  if (diff < 60_000)    return `${Math.round(diff/1000)}s`;
  if (diff < 3_600_000) return `${Math.round(diff/60_000)}m`;
  return `${Math.round(diff/3_600_000)}h`;
};

/**
 * Duração escrita por extenso, para o tempo de queda.
 *
 * `fmtAgo` responde "quando foi o último ping" — e num equipamento OFFLINE esse
 * número continua andando de 30 em 30 segundos, porque o probe segue tentando.
 * "28s" ao lado de um card vermelho lê como "caiu agora", quando pode estar fora
 * do ar há três dias. Aqui o eixo é o INÍCIO da queda, que vem do evento de
 * mudança de status.
 */
const fmtDuracao = (s: string | null | undefined) => {
  if (!s) return null;
  const diff = Date.now() - new Date(s).getTime();
  if (diff < 60_000)     return "há menos de 1 min";
  if (diff < 3_600_000)  return `há ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    const m = Math.round((diff % 3_600_000) / 60_000);
    return m ? `há ${h}h ${m}min` : `há ${h}h`;
  }
  const d = Math.floor(diff / 86_400_000);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
};

const latencyColor = (ms: number | null) => {
  if (ms == null) return "var(--mon-idle)";
  if (ms < 50)  return "var(--mon-ok)";
  if (ms < 200) return "var(--mon-warn)";
  return "var(--mon-down)";
};

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────
export default function MonitoramentoDashboard() {
  const [assets, setAssets]       = useState<Asset[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [porCategoria, setPorCat] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);

  const [q, setQ]               = useState("");
  const [statusFilter, setStat] = useState<Status | "">("");
  const [catFilter, setCat]     = useState<string>("");
  const [showCatMenu, setShowCatMenu] = useState(false);
  const catMenuRef = useRef<HTMLDivElement | null>(null);
  const [incidentes, setIncidentes] = useState<any>(null);
  const [snapshots, setSnapshots] = useState(false); // miniaturas de camera (opt-in)
  const [snapTick, setSnapTick] = useState(0);
  useEffect(() => {
    if (!snapshots) return;
    const t = setInterval(() => setSnapTick(x => x + 1), 30000); // refresca miniaturas a cada 30s
    return () => clearInterval(t);
  }, [snapshots]);

  /**
   * Início do estado atual, por ativo.
   *
   * O valor de partida é o `desdeEm` que o backend calcula — a primeira versão
   * disto lia os 500 eventos mais recentes aqui no cliente e cobria só 34 dos
   * 474 ativos, deixando 44 dos 54 offline sem duração. Este mapa agora serve
   * para uma coisa só: registrar as mudanças que chegam pelo WebSocket sem
   * esperar o próximo carregamento.
   */
  const [desdeMap, setDesde] = useState<Record<string, string>>({});


  const load = useCallback(async () => {
    try {
      const [a, s, c, inc] = await Promise.all([
        api.get("/monitoramento/assets"),
        api.get("/monitoramento/dashboard/summary"),
        api.get("/monitoramento/dashboard/por-categoria"),
        api.get("/monitoramento/dashboard/incidentes").catch(() => ({ data: null })),
      ]);
      setAssets(a.data); setSummary(s.data); setPorCat(c.data); setIncidentes(inc.data);
      // Recarregar zera o que o WebSocket acumulou: o `desdeEm` que acabou de
      // chegar nos ativos é mais confiável que o registro local.
      setDesde({});
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // recarrega incidentes a cada mudança de status (via WS) com debounce leve
  const recarregaIncidentes = useCallback(() => {
    api.get("/monitoramento/dashboard/incidentes").then(r => setIncidentes(r.data)).catch(() => {});
  }, []);

  // WebSocket — atualizacao ao vivo
  useEffect(() => {
    const sock = connectMonitoringSocket();
    const onStatus = (ev: StatusChange) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId
        ? { ...a, ultimoStatus: ev.novo as Status, ultimoCheckEm: ev.ts } : a));
      // Mudou de estado agora: o relógio da queda reinicia neste instante, sem
      // esperar o próximo carregamento de eventos.
      setDesde(prev => ({ ...prev, [ev.assetId]: ev.ts }));
      api.get("/monitoramento/dashboard/summary").then(r => setSummary(r.data)).catch(() => {});
      recarregaIncidentes();
    };
    const onTick = (ev: ProbeTick) => {
      setAssets(prev => prev.map(a => a.id === ev.assetId
        ? { ...a, ultimoStatus: ev.status as Status, ultimaLatenciaMs: ev.latenciaMs, ultimoCheckEm: ev.ts } : a));
    };
    sock.on("status_change", onStatus);
    sock.on("probe_tick",    onTick);
    return () => { sock.off("status_change", onStatus); sock.off("probe_tick", onTick); disconnectMonitoringSocket(); };
  }, []);

  // Fecha dropdown de categoria ao clicar fora
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) setShowCatMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Filtragem
  const visiveis = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return assets.filter(a => {
      if (statusFilter && a.ultimoStatus !== statusFilter) return false;
      if (catFilter    && a.categoria   !== catFilter)    return false;
      if (ql) {
        if (!a.nome.toLowerCase().includes(ql) && !(a.ip||"").toLowerCase().includes(ql) && !(a.tipo||"").toLowerCase().includes(ql)) return false;
      }
      return true;
    });
  }, [assets, q, statusFilter, catFilter]);

  /**
   * A tela é organizada por SEVERIDADE, não por ordem de cadastro.
   *
   * Antes a lista saía na ordem que a API devolvia, e com 55 offline entre 474 o
   * que estava quebrado ficava espalhado no meio de centenas de cartões verdes —
   * o operador só achava o problema clicando no filtro. Num painel de operação a
   * exceção tem que subir sozinha; o que está bem pode ficar somado.
   */
  // Mudança recebida ao vivo tem precedência sobre o valor que veio na carga.
  const desdeDe = useCallback(
    (a: Asset) => desdeMap[a.id] || a.desdeEm || null,
    [desdeMap],
  );

  const grupos = useMemo(() => {
    const inicio = (a: Asset) => { const d = desdeMap[a.id] || a.desdeEm; return d ? new Date(d).getTime() : 0; };
    const b: Record<Status, Asset[]> = { OFFLINE: [], INSTAVEL: [], NAO_MONITORADO: [], ONLINE: [] };
    for (const a of visiveis) (b[a.ultimoStatus] || b.NAO_MONITORADO).push(a);
    // Queda mais recente primeiro: incidente novo é o que ainda dá para agir.
    // Sem evento registrado o ativo vai para o fim, não para o topo.
    const porQueda = (x: Asset, y: Asset) => inicio(y) - inicio(x);
    b.OFFLINE.sort(porQueda);
    b.INSTAVEL.sort(porQueda);
    const porNome = (x: Asset, y: Asset) => x.nome.localeCompare(y.nome, "pt-BR");
    b.ONLINE.sort(porNome);
    b.NAO_MONITORADO.sort(porNome);
    return b;
  }, [visiveis, desdeMap]);

  /**
   * Urgência DENTRO do que está quebrado.
   *
   * Pôr o problema em primeiro lugar resolveu metade; a outra metade foi um
   * erro meu, visto na tela: 57 cartões vermelhos de peso idêntico, 19
   * fileiras de alarme. Medido na base real, 44 desses 57 estão fora do ar há
   * 66 dias — a câmera que caiu há um minuto e a que morreu em junho gritavam
   * igual, e a tela virou uma parede vermelha que não se lê.
   *
   * Três faixas, com peso decrescente:
   *   agora   (< 2h)   cartão, ordenado pela queda mais recente
   *   hoje    (2–24h)  linha simples, sem fundo tingido
   *   antigos (> 24h)  recolhido: contagem e o mais antigo
   *
   * O corte de 24 horas é da operação, não do código: passou o dia, deixou de
   * ser incidente e virou pendência de campo.
   */
  const faixas = useMemo(() => {
    const agoraMs = Date.now();
    const idade = (a: Asset) => {
      const d = desdeMap[a.id] || a.desdeEm;
      // Sem evento registrado não dá para afirmar que é recente: trata como antigo.
      return d ? agoraMs - new Date(d).getTime() : Number.MAX_SAFE_INTEGER;
    };
    const agora: Asset[] = [], hoje: Asset[] = [], antigos: Asset[] = [];
    for (const a of grupos.OFFLINE) {
      const ms = idade(a);
      if (ms < 2 * 3_600_000) agora.push(a);
      else if (ms < 86_400_000) hoje.push(a);
      else antigos.push(a);
    }
    const maisAntigo = antigos.length
      ? antigos.reduce((pior, a) => (idade(a) > idade(pior) ? a : pior), antigos[0])
      : null;
    return { agora, hoje, antigos, maisAntigo };
  }, [grupos.OFFLINE, desdeMap]);

  const [verAntigos, setVerAntigos] = useState(false);

  /**
   * Online somado — por unidade quando existe, senão por categoria.
   *
   * O agrupamento nasceu só por unidade e não servia para nada: medido em
   * homologação, `unidade` é null em 408 de 408 ativos online, então o resumo
   * inteiro virava um chip único dizendo "Sem unidade · 408". Categoria está
   * sempre preenchida, então é ela que sustenta a leitura enquanto as unidades
   * não estiverem cadastradas — e quando estiverem, elas assumem sozinhas.
   */
  const onlineAgrupado = useMemo(() => {
    const temUnidade = grupos.ONLINE.some(a => a.unidade?.nome);
    const rotulo = (a: Asset) => temUnidade
      ? (a.unidade?.nome || "Sem unidade")
      : (CATEGORIAS.find(c => c.v === a.categoria)?.label || a.categoria);
    const m = new Map<string, number>();
    for (const a of grupos.ONLINE) {
      const k = rotulo(a);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return { por: temUnidade ? "unidade" : "categoria", grupos: [...m.entries()].sort((x, y) => y[1] - x[1]) };
  }, [grupos.ONLINE]);

  // Offline e instável abrem por padrão; o que está saudável fica somado.
  const [aberto, setAberto] = useState<Record<string, boolean>>({
    OFFLINE: true, INSTAVEL: true, NAO_MONITORADO: false, ONLINE: false,
  });
  const alterna = (k: string) => setAberto(p => ({ ...p, [k]: !p[k] }));

  /**
   * Detalhe fino só de quem está instável: forma da oscilação e perda de pacote.
   *
   * É uma requisição por ativo, então NÃO vem no carregamento da página — só
   * quando a seção está aberta, e com teto. Instável costuma ser um punhado; se
   * um dia for a frota inteira, o teto evita disparar 400 requisições para
   * enfeitar uma tela.
   */
  const [micro, setMicro] = useState<Record<string, Micro>>({});
  // Quem já foi pedido, num ref. Depender de `micro` aqui faria o efeito
  // re-rodar a cada resposta e disparar a mesma requisição de novo.
  const microPedidos = useRef<Set<string>>(new Set());
  const TETO_MICRO = 24;

  useEffect(() => {
    if (!aberto.INSTAVEL) return;
    const alvo = grupos.INSTAVEL.slice(0, TETO_MICRO).filter(a => !microPedidos.current.has(a.id));
    if (!alvo.length) return;
    alvo.forEach(a => microPedidos.current.add(a.id));

    let vivo = true;
    (async () => {
      for (const a of alvo) {
        if (!vivo) return;
        try {
          const { data } = await api.get(`/monitoramento/events/${a.id}/historico`, { params: { horas: 2 }, silent: true } as any);
          const serie: any[] = data?.serie || [];
          if (!vivo || !serie.length) continue;
          const total = serie.reduce((s, r) => s + Number(r.total || 0), 0);
          const ok    = serie.reduce((s, r) => s + Number(r.ok || 0), 0);
          setMicro(prev => ({
            ...prev,
            [a.id]: {
              serie: serie.slice(-30).map(r => Number(r.avg_lat_ms || 0)),
              perdaPct: total ? Math.max(0, (1 - ok / total) * 100) : null,
            },
          }));
        } catch { /* ativo sem rollup ainda: a linha só não mostra o detalhe */ }
      }
    })();
    return () => { vivo = false; };
  }, [grupos.INSTAVEL, aberto.INSTAVEL]);

  // Relógio de 30s só para as durações ("caído há 14 min") não congelarem.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const catSelecionada = CATEGORIAS.find(c => c.v === catFilter);

  // KPI ring (disponibilidade) — visual
  const disponPct = summary?.disponPct ?? 0;
  const ringDash = (disponPct / 100) * 188.5; // perimeter of r=30

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Topbar />
      <div className="page-content mon-console" style={{ padding: "24px 28px 60px", maxWidth: 1600, margin: "0 auto" }}>
        {/* ── Hero ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 22, flexWrap: "wrap" }}>
          <div>
            {/* Chip neutro, de propósito. Ele era vermelho da marca, e nesta tela
                vermelho tem UM significado: equipamento fora do ar. Com o chip,
                o botão do NOC e o alarme todos vermelhos, a cor parava de avisar.
                Aqui quem carrega o estado é o dot — verde quando a rede está de
                pé, vermelho quando não. */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 8px", borderRadius: 999, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", marginBottom: 12 }}>
              <span className="dot-live" style={{ width: 6, height: 6, background: disponPct > 90 ? "var(--mon-ok)" : "var(--mon-down)" }} />
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>ICMP · tempo real</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
              Monitoramento Operacional
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
              Saúde dos ativos da rede em tempo real · {summary?.monitorados ?? 0} equipamentos sendo pingados
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/dashboard/monitoramento/equipamentos" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Radio size={14} style={{ marginRight: 4 }} /> Equipamentos
            </Link>
            <Link href="/dashboard/monitoramento/servicos" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Server size={14} style={{ marginRight: 4 }} /> Serviços
            </Link>
            <Link href="/dashboard/monitoramento/osa" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <FolderClock size={14} style={{ marginRight: 4 }} /> OSA
            </Link>
            <Link href="/dashboard/monitoramento/historico" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <Activity size={14} style={{ marginRight: 4 }} /> Histórico
            </Link>
            <Link href="/dashboard/monitoramento/mapas" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <MapPin size={14} style={{ marginRight: 4 }} /> Mapas
            </Link>
            <Link href="/dashboard/monitoramento/executivo" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <BarChart3 size={14} style={{ marginRight: 4 }} /> Executivo
            </Link>
            <Link href="/dashboard/monitoramento/noc" className="btn btn-violet" style={{ fontSize: 12 }}>
              <Tv2 size={14} style={{ marginRight: 4 }} /> Modo NOC
            </Link>
            <button onClick={() => setSnapshots(s => !s)} className="btn btn-ghost" style={{ fontSize: 12, background: snapshots ? "var(--accent-violet-dim)" : undefined, color: snapshots ? "var(--accent-violet)" : undefined }} title="Mostrar miniaturas de câmeras (ITS com link)">
              <Camera size={14} style={{ marginRight: 4 }} /> {snapshots ? "Miniaturas ON" : "Miniaturas"}
            </button>
          </div>
        </div>

        {/* ── Incidentes: PRIMEIRA coisa da página ───────────────────────────
            Estava abaixo dos KPIs e dos chips de categoria. É a parte inteligente
            do módulo — dizer que 12 câmeras caíram porque UM switch caiu — e
            valia mais que qualquer contador. Quando não há incidente, não ocupa
            espaço nenhum. */}
        <PainelIncidentes incidentes={incidentes} />

        {/* ── KPI principal + secundarios ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 mb-6">
          {/* Disponibilidade — destaque com ring */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-subtle-o shadow-sm surface-card p-6 flex items-center gap-6 relative overflow-hidden group"
          >
            <svg width="84" height="84" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" stroke="var(--border-subtle)" strokeWidth="6" fill="none" />
              <motion.circle
                cx="40" cy="40" r="30"
                stroke={disponPct >= 95 ? "var(--mon-ok)" : disponPct >= 80 ? "var(--mon-warn)" : "var(--mon-down)"}
                strokeWidth="6" fill="none" strokeLinecap="round"
                transform="rotate(-90 40 40)"
                initial={{ strokeDasharray: "0 188.5" }}
                animate={{ strokeDasharray: `${ringDash} 188.5` }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1.5 }}>Disponibilidade geral</div>
              {/* O número acompanha o anel: verde acima de 95, âmbar acima de 80,
                  vermelho abaixo. Fixo em vermelho, ele gritava com a rede em
                  99,8% — e deixava de significar qualquer coisa quando caía. */}
              <div className="metric" style={{ fontSize: 34, marginTop: 2, color: disponPct >= 95 ? "var(--mon-ok)" : disponPct >= 80 ? "var(--mon-warn)" : "var(--mon-down)" }}>
                {disponPct.toFixed(1)}<span style={{ fontSize: 18, color: "var(--text-muted)" }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                <b style={{ color: "var(--mon-ok)" }}>{summary?.online ?? 0}</b> de <b>{summary?.monitorados ?? 0}</b> online
              </div>
            </div>
          </motion.div>

          {/* KPIs secundarios em strip */}
          <div className="grid grid-cols-4 gap-3">
            <KpiTile clickable active={statusFilter==="ONLINE"}        label="Online"           value={summary?.online ?? 0}   colorName="emerald" icon={<CheckCircle2 size={18}/>} onClick={() => setStat(statusFilter==="ONLINE"?"":"ONLINE")} />
            <KpiTile clickable active={statusFilter==="OFFLINE"}       label="Offline"          value={summary?.offline ?? 0}  colorName="red"     icon={<CircleSlash size={18}/>}  onClick={() => setStat(statusFilter==="OFFLINE"?"":"OFFLINE")} />
            <KpiTile clickable active={statusFilter==="INSTAVEL"}      label="Instáveis"        value={summary?.instavel ?? 0} colorName="amber"   icon={<AlertTriangle size={18}/>} onClick={() => setStat(statusFilter==="INSTAVEL"?"":"INSTAVEL")} />
            <KpiTile clickable active={statusFilter==="NAO_MONITORADO"} label="Não monitorado"  value={summary?.naoMon ?? 0}   colorName="slate"   icon={<Radio size={18}/>}        onClick={() => setStat(statusFilter==="NAO_MONITORADO"?"":"NAO_MONITORADO")} />
          </div>
        </div>

        {/* ── Chips de categoria (horizontal, scroll suave) ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
          {CATEGORIAS.map(c => {
            const r = porCategoria[c.v] || { online: 0, offline: 0, instavel: 0, total: 0 };
            const Icon = c.icon;
            const active = catFilter === c.v;
            return (
              <motion.button
                key={c.v}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCat(active ? "" : c.v)}
                className={`rounded-2xl border shadow-sm p-4 transition-all relative overflow-hidden group w-full text-left cursor-pointer
                  ${active ? 'border-accent-o ring-1 ring-[var(--accent-violet)] accent-text accent-soft' : 'border-subtle-o surface-card'}`}
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl bg-[var(--accent-violet)]" />
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'accent-solid' : 'surface-sunken text-muted-o'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${active ? '' : 'text-primary-o'}`}>{c.label}</div>
                    </div>
                  </div>
                  <div className="metric" style={{ fontSize: 22, color: active ? "inherit" : "var(--text-primary)" }}>{r.total}</div>
                </div>
                <div className="flex gap-3 text-[11px] font-bold uppercase tracking-wider relative z-10" style={{ fontFamily: "var(--font-mono)" }}>
                  <span className="text-emerald-500">● {r.online}</span>
                  <span className="text-red-500">● {r.offline}</span>
                  <span className="text-amber-500">● {r.instavel}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ── Filtro bar (sticky) ───────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg-primary)", padding: "10px 0", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Busca + Categoria dropdown */}
            <div style={{ display: "flex", flex: 1, minWidth: 280, maxWidth: 600, alignItems: "stretch", borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", overflow: "visible" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "var(--text-muted)" }}>
                <Search size={14} />
              </div>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por nome, IP ou tipo..."
                style={{ flex: 1, padding: "10px 4px", background: "transparent", border: 0, color: "var(--text-primary)", fontSize: 13, outline: "none", minWidth: 0 }}
              />
              {q && (
                <button onClick={() => setQ("")} className="btn-icon" style={{ width: 32, height: 32, margin: 3 }} title="Limpar"><X size={14}/></button>
              )}

              {/* Divisor */}
              <div style={{ width: 1, background: "var(--border-subtle)" }} />

              {/* Categoria dropdown */}
              <div ref={catMenuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setShowCatMenu(s => !s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: "100%",
                    background: "transparent", border: 0, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: catFilter ? "var(--accent-violet)" : "var(--text-secondary)",
                    minWidth: 160, justifyContent: "space-between",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Filter size={13} />
                    {catSelecionada ? catSelecionada.label : "Todas categorias"}
                  </span>
                  <ChevronDown size={14} style={{ transform: showCatMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}/>
                </button>
                <AnimatePresence>
                  {showCatMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 240, background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, boxShadow: "var(--shadow-elevated)", overflow: "hidden", zIndex: 50 }}
                    >
                      <button
                        onClick={() => { setCat(""); setShowCatMenu(false); }}
                        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: !catFilter ? "var(--bg-hover)" : "transparent", border: 0, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}
                      >
                        <span>Todas categorias</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{assets.length}</span>
                      </button>
                      <div style={{ height: 1, background: "var(--border-subtle)" }} />
                      {CATEGORIAS.map(c => {
                        const r = porCategoria[c.v] || { total: 0 };
                        const Icon = c.icon;
                        return (
                          <button key={c.v}
                            onClick={() => { setCat(c.v); setShowCatMenu(false); }}
                            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: catFilter === c.v ? "var(--bg-hover)" : "transparent", border: 0, cursor: "pointer", fontSize: 12, color: "var(--text-primary)", textAlign: "left" }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Icon size={13} style={{ color: catFilter === c.v ? "var(--accent-violet)" : "var(--text-secondary)" }} />
                              <span>
                                <div style={{ fontWeight: 600 }}>{c.label}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.tag}</div>
                              </span>
                            </span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.total}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Contador + clear */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <b style={{ color: "var(--text-primary)" }}>{visiveis.length}</b> de {assets.length}
              </span>
              {(q || statusFilter || catFilter) && (
                <button onClick={() => { setQ(""); setStat(""); setCat(""); }} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-primary)", fontSize: 11, cursor: "pointer", color: "var(--text-primary)" }}>Limpar filtros</button>
              )}
            </div>
          </div>
        </div>

        {/* ── Grid de status ────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88 }} />
            ))}
          </div>
        )}

        {!loading && visiveis.length === 0 && (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 14, background: "rgba(211,47,47,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Radio size={26} style={{ color: "var(--accent-violet)" }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {assets.length === 0 ? "Nenhum equipamento cadastrado" : "Nenhum equipamento no filtro atual"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {assets.length === 0
                ? <>Comece em <Link href="/dashboard/monitoramento/equipamentos" style={{ color: "var(--accent-violet)" }}>Equipamentos →</Link></>
                : <>Ajuste a busca ou os filtros pra ver resultados</>}
            </div>
          </div>
        )}

        {!loading && visiveis.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(["OFFLINE", "INSTAVEL", "NAO_MONITORADO", "ONLINE"] as Status[]).map(st => {
              const lista = grupos[st];
              if (!lista.length) return null;
              const s = STATUS[st];
              // Filtro de status explícito manda: aí a seção escolhida abre.
              const expandido = statusFilter === st ? true : !!aberto[st];
              const critico = st === "OFFLINE" || st === "INSTAVEL";

              return (
                <section key={st}>
                  <button
                    onClick={() => alterna(st)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      background: "transparent", border: 0, cursor: "pointer", padding: "6px 2px",
                      textAlign: "left", color: "var(--text-primary)",
                    }}
                  >
                    {expandido ? <ChevronDown size={15} style={{ color: "var(--text-muted)" }} />
                               : <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />}
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: s.dot, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: critico ? s.fg : "var(--text-secondary)" }}>
                      {s.label}
                    </span>
                    <span className="metric" style={{ fontSize: 16, color: critico ? s.fg : "var(--text-primary)" }}>{lista.length}</span>
                    {critico && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        · queda mais recente primeiro
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    {!expandido && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ver equipamentos</span>
                    )}
                  </button>

                  {/* Resumo por unidade: com a seção fechada, o verde ainda diz
                      onde está de pé — 406 cartões idênticos não dizem. */}
                  {st === "ONLINE" && !expandido && onlineAgrupado.grupos.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "2px 2px 0 33px" }}>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                        por {onlineAgrupado.por}
                      </span>
                      {onlineAgrupado.grupos.map(([nome, n]) => (
                        <span key={nome} style={{
                          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
                          padding: "4px 10px", borderRadius: 999,
                          background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                          color: "var(--text-secondary)",
                        }}>
                          {nome}
                          <b className="num" style={{ color: "var(--mon-ok)" }}>{n}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  {expandido && (critico
                    // Quebrado vira LINHA larga: o nome carrega o KM e o sentido,
                    // e era exatamente o fim do nome que o cartão de 260px cortava.
                    ? (st === "OFFLINE" ? (
                      <div style={{ marginTop: 6 }}>
                        {faixas.agora.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 8 }}>
                            {faixas.agora.map(a => <AssetRow key={a.id} a={a} desde={desdeDe(a)} micro={micro[a.id]} />)}
                          </div>
                        )}

                        {/* Caiu hoje, mas não agora: linha simples. Mesmo dado,
                            um terço do peso visual. */}
                        {faixas.hoje.length > 0 && (
                          <div style={{ marginTop: faixas.agora.length ? 12 : 0 }}>
                            <div className="mon-faixa__rot">nas últimas 24 horas · {faixas.hoje.length}</div>
                            <div className="mon-chips">
                              {faixas.hoje.map(a => <LinhaQuieta key={a.id} a={a} desde={desdeDe(a)} />)}
                            </div>
                          </div>
                        )}

                        {/* Fora do ar há mais de um dia: deixou de ser incidente
                            e virou pendência de campo. Fica recolhido, mas NÃO
                            some — some é como o problema envelhece sem dono. */}
                        {faixas.antigos.length > 0 && (
                          <div style={{ marginTop: 12 }}>
                            <button onClick={() => setVerAntigos(v => !v)} className="mon-antigos">
                              {verAntigos ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              <b className="num">{faixas.antigos.length}</b>
                              <span>sem resposta há mais de um dia</span>
                              {faixas.maisAntigo && (
                                <span style={{ color: "var(--text-muted)" }}>
                                  · o mais antigo {fmtDuracao(desdeDe(faixas.maisAntigo))}
                                </span>
                              )}
                              <span style={{ flex: 1 }} />
                              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                {verAntigos ? "recolher" : "ver lista"}
                              </span>
                            </button>
                            {verAntigos && (
                              <div className="mon-chips" style={{ marginTop: 6 }}>
                                {faixas.antigos.map(a => <LinhaQuieta key={a.id} a={a} desde={desdeDe(a)} />)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 8, marginTop: 6 }}>
                        {lista.map(a => <AssetRow key={a.id} a={a} desde={desdeDe(a)} micro={micro[a.id]} />)}
                      </div>
                    ))
                    // Saudável entra denso e agrupado por tipo. O cartão continua
                    // existindo para UM caso: com as miniaturas ligadas, o que se
                    // quer ver é a imagem da câmera, e aí o tamanho é o ponto.
                    : snapshots
                      ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8, marginTop: 6 }}>
                          {lista.map(a => (
                            <AssetCard key={a.id} a={a} showSnap={snapshots} snapTick={snapTick} escondeTipo={!!catFilter} />
                          ))}
                        </div>
                      )
                      : <GruposSaudaveis itens={lista} />
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Correlação de falhas — causa-raiz e falha em massa.
 *
 * Vive no topo da página porque responde a pergunta que os contadores não
 * respondem: "são 12 problemas ou é UM problema com 12 sintomas?". Um switch de
 * praça caído derruba as câmeras dependentes, e tratar cada câmera como
 * incidente separado manda o time para o lugar errado doze vezes.
 */
function PainelIncidentes({ incidentes }: { incidentes: any }) {
  const lista = incidentes?.incidentes;
  if (!lista?.length) return null;

  return (
    <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      {lista.map((inc: any, i: number) => {
        const isRoot = inc.tipo === "causa_raiz";
        const cor = isRoot ? "var(--mon-down)" : "var(--mon-warn)";
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ padding: "14px 16px", borderLeft: `4px solid ${cor}`, background: `${cor}0d` }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <AlertTriangle size={16} style={{ color: cor, flexShrink: 0 }} />
              {isRoot ? (
                <span style={{ fontSize: 13.5 }}>
                  <b style={{ color: cor, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Causa provável</b>
                  <span style={{ margin: "0 8px", color: "var(--border-medium)" }}>|</span>
                  <b>{inc.causa.nome}</b> <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>({inc.causa.ip})</span> offline
                  {" — "}<b>{inc.afetados.length}</b> dependente(s) caíram com ele
                  {inc.unidade && <span style={{ color: "var(--text-muted)" }}> · {inc.unidade}</span>}
                </span>
              ) : (
                <span style={{ fontSize: 13.5 }}>
                  <b style={{ color: cor, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Falha em massa</b>
                  <span style={{ margin: "0 8px", color: "var(--border-medium)" }}>|</span>
                  <b>{inc.total}</b> equipamentos offline na unidade <b>{inc.unidade}</b>
                  <span style={{ color: "var(--text-muted)" }}> — {inc.dica}</span>
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 9, marginLeft: 25 }}>
              {inc.afetados.slice(0, 12).map((f: any) => (
                <span key={f.id} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  {f.nome}
                </span>
              ))}
              {inc.afetados.length > 12 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{inc.afetados.length - 12}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function KpiTile({ label, value, colorName, onClick, active, clickable }: {
  label: string; value: any; colorName: string; icon?: React.ReactNode;
  onClick?: () => void; active?: boolean; clickable?: boolean;
}) {
  const c = {
    emerald: "var(--mon-ok)",
    red: "var(--mon-down)",
    amber: "var(--mon-warn)",
    slate: "var(--text-muted)"
  }[colorName] || "var(--text-muted)";
  
  const Comp: any = clickable ? motion.button : "div";
  return (
    <Comp
      {...(clickable ? { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, onClick } : {})}
      className="stat-card flex-1 min-w-[150px]"
      data-active={active ? "true" : "false"}
      style={{ ["--sc" as any]: c, cursor: clickable ? "pointer" : "default" }}
    >
      <span className="stat-card__head">
        <span className="stat-card__dot" />
        <span className="mono-cap">{label}</span>
      </span>
      <span className="metric stat-card__value">{value}</span>
      {clickable && (
        <span className="stat-card__foot">
          <span style={{ flex: 1 }} />
          <span className="stat-card__hint">{active ? "● filtrando" : "filtrar"}</span>
        </span>
      )}
    </Comp>
  );
}

/**
 * Clique abre o histórico; duplo-clique abre a câmera.
 *
 * O debounce de 250ms existe porque as duas ações moram no mesmo alvo: sem ele,
 * o duplo-clique disparava a navegação antes de o segundo clique chegar.
 */
function useAbrirAtivo(a: Asset) {
  const router = useRouter();
  const hasLink = !!a.link;
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      router.push(`/dashboard/monitoramento/historico?assetId=${a.id}`);
    }, 250);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (hasLink) window.open(normalizeLink(a.link as string), "_blank", "noopener,noreferrer");
    else router.push(`/dashboard/monitoramento/historico?assetId=${a.id}`);
  };
  const title = hasLink ? `Clique: histórico · Duplo-clique: abrir ${a.link}` : "Clique: histórico";
  return { onClick, onDoubleClick, title, hasLink };
}

/** Série de latência dos últimos minutos, do rollup por minuto. */
type Micro = { serie: number[]; perdaPct: number | null };

/**
 * Equipamento saudável, em chip.
 *
 * Um ativo no ar precisa responder três coisas: existe, está verde, e onde
 * acho. O cartão anterior gastava ~100px de altura repetindo IP, tipo, idade do
 * ping e a palavra "Online" para cada um dos 407 — quatro linhas de dado igual,
 * 407 vezes, empurrando o que importa para fora da tela.
 *
 * Aqui é uma linha de 28px: estado, nome inteiro e latência. O resto continua
 * a um clique (histórico) e no atributo `title`, para quem precisar do IP sem
 * sair da tela.
 */
function ChipAtivo({ a }: { a: Asset }) {
  const s = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
  const { onClick, onDoubleClick, hasLink } = useAbrirAtivo(a);
  const detalhe = [a.ip, a.tipo, a.unidade?.nome].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${a.nome}\n${detalhe}${hasLink ? "\n\nClique: histórico · Duplo-clique: abrir câmera" : "\n\nClique: histórico"}`}
      className="mon-chip"
      style={{ cursor: hasLink ? "alias" : "pointer" }}
    >
      <span className="mon-chip__dot" style={{ background: s.dot }} />
      <span className="mon-chip__nome">{a.nome}</span>
      <span className="mon-chip__lat num" style={{ color: latencyColor(a.ultimaLatenciaMs) }}>
        {a.ultimaLatenciaMs != null ? `${a.ultimaLatenciaMs}ms` : "—"}
      </span>
    </button>
  );
}

/**
 * Equipamento parado sem ser novidade.
 *
 * Mesmo dado da linha larga, um terço do peso: sem fundo tingido, sem borda
 * lateral, sem badge. O que sobra é o essencial — bolinha, nome e há quanto
 * tempo. Cinquenta e sete cartões vermelhos empilhados não se leem; cinquenta
 * e sete linhas, sim.
 */
function LinhaQuieta({ a, desde }: { a: Asset; desde?: string | null }) {
  const s = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
  const { onClick, onDoubleClick, hasLink } = useAbrirAtivo(a);
  const detalhe = [a.ip, a.tipo, a.unidade?.nome].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onClick} onDoubleClick={onDoubleClick}
      title={`${a.nome}\n${detalhe}`}
      className="mon-chip"
      style={{ cursor: hasLink ? "alias" : "pointer" }}
    >
      <span className="mon-chip__dot" style={{ background: s.dot }} />
      <span className="mon-chip__nome">{a.nome}</span>
      <span className="mon-chip__lat" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
        {fmtDuracao(desde)?.replace("há ", "") || "—"}
      </span>
    </button>
  );
}

/**
 * Saudáveis agrupados por tipo, cada grupo recolhível.
 *
 * Tipo é o que a operação usa para pensar ("os access points", "os switches") e
 * está sempre preenchido — diferente de `unidade`, que está vazia em 100% da
 * base. Com os grupos, achar um equipamento deixa de depender de rolar 400
 * cartões: o cabeçalho diz quantos são e o grupo fecha.
 */
function GruposSaudaveis({ itens }: { itens: Asset[] }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Asset[]>();
    for (const a of itens) {
      const k = a.tipo?.trim() || a.categoria || "Outros";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return [...m.entries()].sort((x, y) => y[1].length - x[1].length);
  }, [itens]);

  // Grupo grande demais para caber na cabeça começa fechado; os pequenos, não.
  const [fechados, setFechados] = useState<Record<string, boolean>>({});
  const alterna = (k: string) => setFechados(p => ({ ...p, [k]: !p[k] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {grupos.map(([tipo, lista]) => {
        const fechado = !!fechados[tipo];
        return (
          <div key={tipo}>
            <button onClick={() => alterna(tipo)} className="mon-grupo__head">
              {fechado ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              <span className="mon-grupo__nome">{tipo}</span>
              <span className="mon-grupo__contagem num">{lista.length}</span>
              <span className="mon-grupo__linha" />
            </button>
            {!fechado && (
              <div className="mon-chips">
                {lista.map(a => <ChipAtivo key={a.id} a={a} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Sparkline em SVG puro — sem biblioteca.
 *
 * "Instável" é um estado que um número só não descreve: 15ms de média pode ser
 * 15ms constante ou um serrote entre 2ms e 400ms, e são problemas diferentes.
 * A forma da linha responde isso num relance.
 */
function Sparkline({ serie, cor }: { serie: number[]; cor: string }) {
  if (serie.length < 2) return null;
  const w = 62, h = 16;
  const max = Math.max(...serie, 1);
  const pts = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * w;
    const y = h - (v / max) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }} aria-hidden>
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
    </svg>
  );
}

/**
 * O equipamento com problema, em linha larga.
 *
 * Cartão de 260px truncava o nome em "CFTV 011 - KM 025+500 (S..." — e em 143
 * câmeras que só diferem pelo KM e pelo sentido, o fim do nome É a identidade.
 * Aqui o nome tem a largura toda e quebra em duas linhas se precisar.
 *
 * O número em destaque é o TEMPO DE QUEDA, não o último ping: é ele que decide
 * quem atende primeiro.
 */
function AssetRow({ a, desde, micro }: { a: Asset; desde?: string; micro?: Micro }) {
  const s = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
  const { onClick, onDoubleClick, title, hasLink } = useAbrirAtivo(a);
  const duracao = fmtDuracao(desde);

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
    >
      <div
        role="button" tabIndex={0}
        onClick={onClick} onDoubleClick={onDoubleClick} title={title}
        className="card"
        style={{
          padding: "12px 14px", borderLeft: `3px solid ${s.dot}`,
          background: `linear-gradient(90deg, ${s.bg}, transparent 55%)`,
          cursor: hasLink ? "alias" : "pointer", userSelect: "none",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 5, background: s.dot, flexShrink: 0, marginTop: 4, boxShadow: `0 0 8px ${s.dot}` }} />

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, display: "flex", alignItems: "center", gap: 5 }}>
            <span>{a.nome}</span>
            {hasLink && <ExternalLink size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{a.ip}</span>
            {a.tipo && <><span>·</span><span>{a.tipo}</span></>}
            {a.unidade?.nome && <><span>·</span><span>{a.unidade.nome}</span></>}
          </div>

          {(a.supressedByDep || a.latenciaAnomala) && (
            <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
              {a.supressedByDep && (
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--mon-idle-soft)", color: "var(--mon-idle)" }}
                  title={`Consequência, não causa: o uplink "${a.dependeDe?.nome}" está offline`}>
                  ⛓ por dependência
                </span>
              )}
              {a.latenciaAnomala && (
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--mon-warn-soft)", color: "var(--mon-warn)" }}
                  title={`Latência ${a.ultimaLatenciaMs}ms muito acima do normal (~${Math.round(a.latenciaBaseMs || 0)}ms)`}>
                  ⚡ latência alta
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.fg, whiteSpace: "nowrap" }}>
            {duracao || s.label}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
            {a.ultimaLatenciaMs != null
              ? <span style={{ color: latencyColor(a.ultimaLatenciaMs) }}>{a.ultimaLatenciaMs}ms</span>
              : "sem resposta"}
            <span style={{ margin: "0 4px" }}>·</span>
            {/* Último ping: prova que o probe continua tentando. */}
            ping {fmtAgo(a.ultimoCheckEm)}
          </div>
          {/* Instável só faz sentido com a FORMA da oscilação e a perda de
              pacote. Vem do rollup por minuto, carregado sob demanda. */}
          {micro && (micro.serie.length > 1 || micro.perdaPct != null) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkline serie={micro.serie} cor={s.dot} />
              {micro.perdaPct != null && micro.perdaPct > 0 && (
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: s.fg, whiteSpace: "nowrap" }}
                  title="Pacotes sem resposta nas últimas 2 horas">
                  perda {micro.perdaPct.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AssetCard({ a, showSnap, snapTick, escondeTipo }: { a: Asset; showSnap?: boolean; snapTick?: number; escondeTipo?: boolean }) {
  const s = STATUS[a.ultimoStatus] || STATUS.NAO_MONITORADO;
  const [snapErr, setSnapErr] = useState(false);
  const { onClick: handleClick, onDoubleClick: handleDblClick, title: cardTitle, hasLink } = useAbrirAtivo(a);
  // Miniatura: so pra ITS com link, quando ligado e o ativo nao esta offline.
  const podeSnap = !!showSnap && a.categoria === "ITS" && hasLink && a.ultimoStatus !== "OFFLINE" && a.ultimoStatus !== "NAO_MONITORADO";

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      whileHover={{ y: -3, boxShadow: "var(--shadow-elevated)" }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      style={{ borderRadius: 10 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        title={cardTitle}
        className="card"
        style={{
          padding: "12px 14px", display: "block", textDecoration: "none", color: "inherit",
          borderLeft: `3px solid ${s.dot}`,
          position: "relative", overflow: "hidden",
          cursor: hasLink ? "alias" : "pointer", userSelect: "none",
        }}
      >

        {/* miniatura da camera (opt-in) */}
        {podeSnap && !snapErr && (
          <img
            src={`${snapshotUrl(a.link as string)}${snapshotUrl(a.link as string).includes("?") ? "&" : "?"}_t=${snapTick}`}
            alt=""
            onError={() => setSnapErr(true)}
            style={{ position: "relative", width: "100%", height: 110, objectFit: "cover", borderRadius: 6, marginBottom: 8, background: "#000" }}
          />
        )}

        {/* Cabeçalho: nome em DUAS linhas antes de truncar.
            O nome carrega o KM e o sentido, e cortar no meio ("KM 025+500 (S...")
            apaga justamente o que distingue uma câmera da outra.
            A pílula de status saiu: este cartão só é usado no que está saudável,
            e repetir "Online" 406 vezes rouba a atenção das 55 que importam —
            o dot pulsando já diz. */}
        <div style={{ position: "relative", display: "flex", alignItems: "start", gap: 8 }}>
          <motion.span
            style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: s.dot, flexShrink: 0, marginTop: 5 }}
            animate={a.ultimoStatus === "ONLINE" ? { opacity: [1, 0.35, 1] } : {}}
            transition={a.ultimoStatus === "ONLINE" ? { duration: 2.4, repeat: Infinity } : {}}
            title={s.label}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, display: "flex", alignItems: "flex-start", gap: 5 }}>
              <span style={{
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden", minWidth: 0,
              } as any}>{a.nome}</span>
              {hasLink && <ExternalLink size={10} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 3 }}>{a.ip}</div>
          </div>
        </div>

        {/* Badges de inteligência: dependência / anomalia */}
        {(a.supressedByDep || a.latenciaAnomala) && (
          <div style={{ position: "relative", display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {a.supressedByDep && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--mon-idle-soft)", color: "var(--mon-idle)" }}
                title={`Offline por dependência: uplink "${a.dependeDe?.nome}" está offline`}>
                ⛓ por dependência
              </span>
            )}
            {a.latenciaAnomala && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--mon-warn-soft)", color: "var(--mon-warn)" }}
                title={`Latência ${a.ultimaLatenciaMs}ms muito acima do normal (~${Math.round(a.latenciaBaseMs||0)}ms)`}>
                ⚡ latência alta
              </span>
            )}
          </div>
        )}

        {/* Rodapé. O tipo sai quando a categoria já está filtrada: com o filtro
            em ITS, "CFTV" repetido em 143 cartões não informa nada. */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 10.5 }}>
          <span style={{ color: "var(--text-muted)" }}>{escondeTipo ? (a.unidade?.nome || "") : (a.tipo || a.categoria)}</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            <span style={{ color: latencyColor(a.ultimaLatenciaMs), fontWeight: 700 }}>{a.ultimaLatenciaMs != null ? `${a.ultimaLatenciaMs}ms` : "—"}</span>
            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--text-muted)" }}>{fmtAgo(a.ultimoCheckEm)}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
