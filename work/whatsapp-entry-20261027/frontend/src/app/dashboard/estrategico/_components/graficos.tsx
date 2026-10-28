"use client";

/**
 * Gráficos do Strategy.
 *
 * Barra comparativa, barra empilhada e cartão vêm do Compliance — são as
 * primitivas de gráfico do produto, decididas com a skill de UX (barra
 * ordenada com valor rotulado, nada de pizza, cor nunca sozinha). Aqui entram
 * só as formas que o plano pede e o Compliance não tinha: matriz de risco,
 * funil de valores, pipeline e evolução mensal.
 */

import { useState, type ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { BASE, dinheiroCurto, dinheiro, FarolPonto } from "./comuns";
import type { Farol } from "@/lib/estrategico/types";

export { BarrasComparativas, BarraEmpilhada, Cartao } from "../../compliance/_components/graficos";
export type { ItemBarra } from "../../compliance/_components/graficos";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");
const vazio = (texto: string) => <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0" }}>{texto}</p>;

/* ── Participação executiva (direção "C", escolhida em 11/09/2026) ──────────
   Cada quadro abre com o número que responde a pergunta dele e mostra a
   divisão numa barra única, com legenda clicável. Duas regras de cor:
   - status: a cor já quer dizer algo (farol, tempo sem andamento) e vem do dado;
   - líder: categorias sem ordem natural (objetivo, área, dependência...) — o
     maior em grafite, o resto em cinza. Pintar por posição no ranking faria a
     categoria parecer escala e trocaria de cor a cada filtro do painel. */

export type Fatia = { id: string; rotulo: string; valor: number; cor?: string; href?: string };

const COR_LIDER = "color-mix(in srgb, var(--text-primary) 78%, transparent)";
const COR_DEMAIS = "color-mix(in srgb, var(--text-muted) 42%, transparent)";
const COR_OUTROS = "color-mix(in srgb, var(--text-muted) 20%, transparent)";
const pct = (v: number, total: number) => (total ? Math.round((v / total) * 100) : 0);

export function Destaque({ numero, texto, tom, compacto }: { numero: ReactNode; texto: ReactNode; tom?: string; compacto?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: compacto ? "0 0 8px" : "0 0 12px", minWidth: 0 }}>
      <span className="metric" style={{ fontSize: compacto ? 20 : 30, lineHeight: 1, color: tom ?? "var(--text-primary)", flexShrink: 0 }}>{numero}</span>
      <span style={{ fontSize: compacto ? 12 : 12.5, color: "var(--text-secondary)", lineHeight: 1.35, minWidth: 0 }}>{texto}</span>
    </div>
  );
}

function BarraParticipacao({ fatias, total }: { fatias: (Fatia & { cor: string })[]; total: number }) {
  const visiveis = fatias.filter(f => f.valor > 0);
  return (
    <div
      role="img"
      aria-label={visiveis.map(f => `${f.rotulo}: ${fmt(f.valor)}`).join(", ")}
      style={{ display: "flex", gap: 2, height: 12, borderRadius: 6, overflow: "hidden" }}
    >
      {visiveis.map(f => {
        const estilo: CSSProperties = {
          flex: `${f.valor} 1 0`, minWidth: 4, background: f.cor, display: "block",
          transition: "flex-grow .4s cubic-bezier(.22,1,.36,1), filter .15s",
        };
        const titulo = `${f.rotulo}: ${fmt(f.valor)} (${pct(f.valor, total)}%)`;
        return f.href
          ? <Link key={f.id} href={f.href} title={titulo} aria-label={titulo} className="participacao__fatia" style={estilo} />
          : <span key={f.id} title={titulo} style={estilo} />;
      })}
    </div>
  );
}

function LegendaParticipacao({ fatias, total, mostrarZero }: { fatias: (Fatia & { cor: string })[]; total: number; mostrarZero?: boolean }) {
  const estilo: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "inherit", textDecoration: "none" };
  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", listStyle: "none", padding: 0, margin: "10px 0 0" }}>
      {fatias.filter(f => mostrarZero || f.valor > 0).map(f => {
        const corpo = (
          <>
            <span style={{
              width: 9, height: 9, borderRadius: 2, flexShrink: 0,
              background: f.valor ? f.cor : "transparent", boxShadow: f.valor ? undefined : `inset 0 0 0 1.5px ${f.cor}`,
            }} />
            <span style={{ color: "var(--text-secondary)" }}>{f.rotulo}</span>
            <span className="metric" style={{ color: "var(--text-primary)" }} title={`${pct(f.valor, total)}%`}>{fmt(f.valor)}</span>
          </>
        );
        return <li key={f.id}>{f.href && f.valor ? <Link href={f.href} style={estilo}>{corpo}</Link> : <span style={estilo}>{corpo}</span>}</li>;
      })}
    </ul>
  );
}

/** Categorias sem ordem natural: destaca quem concentra mais e agrupa a cauda em "Outros". */
export function DistribuicaoLider({
  itens, unidade = "assuntos", max = 4, compacto, textoVazio = "Sem dados.",
}: { itens: Fatia[]; unidade?: string; max?: number; compacto?: boolean; textoVazio?: string }) {
  const ordenados = itens.filter(i => i.valor > 0).sort((a, b) => b.valor - a.valor);
  const total = ordenados.reduce((s, i) => s + i.valor, 0);
  if (!total) return vazio(textoVazio);

  // "Outros (1)" esconderia um nome sem ganhar espaço: aí mostra o item.
  const corte = ordenados.length === max + 1 ? max + 1 : max;
  const principais = ordenados.slice(0, corte);
  const resto = ordenados.slice(corte);
  const fatias: (Fatia & { cor: string })[] = [
    ...principais.map((i, idx) => ({ ...i, cor: idx === 0 ? COR_LIDER : COR_DEMAIS })),
    ...(resto.length ? [{ id: "__outros", rotulo: `Outros (${resto.length})`, valor: resto.reduce((s, i) => s + i.valor, 0), cor: COR_OUTROS }] : []),
  ];
  const lider = principais[0];

  return (
    <div>
      <Destaque
        compacto={compacto}
        numero={`${pct(lider.valor, total)}%`}
        texto={<><strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{lider.rotulo}</strong> · {fmt(lider.valor)} de {fmt(total)} {unidade}</>}
      />
      <BarraParticipacao fatias={fatias} total={total} />
      <LegendaParticipacao fatias={fatias} total={total} />
    </div>
  );
}

const COR_AGING: Record<string, string> = {
  ate_30: "var(--accent-green)",
  "31_60": "var(--accent-amber)",
  "61_90": "color-mix(in srgb, var(--accent-amber) 50%, var(--accent-red))",
  acima_90: "var(--accent-red)",
  sem_registro: "color-mix(in srgb, var(--text-muted) 45%, transparent)",
};

/** Tempo sem andamento: faixas na ordem do tempo, nunca pelo tamanho. */
export function AgingResumo({ faixas }: { faixas: Fatia[] }) {
  const total = faixas.reduce((s, f) => s + f.valor, 0);
  if (!total) return vazio("Nenhum assunto ativo.");
  const valor = (id: string) => faixas.find(f => f.id === id)?.valor ?? 0;
  const fatias = faixas.map(f => ({ ...f, cor: COR_AGING[f.id] ?? COR_DEMAIS }));
  const acima90 = valor("acima_90");
  const recentes = valor("ate_30");

  return (
    <div>
      {acima90 > 0 ? (
        <Destaque
          numero={fmt(acima90)} tom="var(--accent-red)"
          texto={<>{acima90 === 1 ? "assunto parado" : "assuntos parados"} há mais de 90 dias · {pct(acima90, total)}% dos ativos</>}
        />
      ) : (
        <Destaque
          numero={`${pct(recentes, total)}%`}
          texto={<>com andamento nos últimos 30 dias · {fmt(recentes)} de {fmt(total)} assuntos ativos</>}
        />
      )}
      <BarraParticipacao fatias={fatias} total={total} />
      <LegendaParticipacao fatias={fatias} total={total} mostrarZero />
    </div>
  );
}

/** Farol da carteira: a manchete é a cor mais grave que existe. */
export function FarolResumo({ fatias: entrada }: { fatias: Fatia[] }) {
  const total = entrada.reduce((s, f) => s + f.valor, 0);
  if (!total) return vazio("Nenhum assunto.");
  const valor = (id: string) => entrada.find(f => f.id === id)?.valor ?? 0;
  const fatias = entrada.map(f => ({ ...f, cor: f.cor ?? COR_DEMAIS }));
  const [vermelho, amarelo, verde] = [valor("vermelho"), valor("amarelo"), valor("verde")];

  const manchete = vermelho
    ? { numero: `${pct(vermelho, total)}%`, tom: "var(--accent-red)", texto: <>em risco (vermelho) · {fmt(vermelho)} de {fmt(total)} assuntos</> }
    : amarelo
      ? { numero: `${pct(amarelo, total)}%`, tom: undefined, texto: <>pedem atenção (amarelo) · {fmt(amarelo)} de {fmt(total)} assuntos</> }
      : { numero: `${pct(verde, total)}%`, tom: undefined, texto: <>sob controle (verde) · {fmt(verde)} de {fmt(total)} assuntos</> };

  return (
    <div>
      <Destaque numero={manchete.numero} tom={manchete.tom} texto={manchete.texto} />
      <BarraParticipacao fatias={fatias} total={total} />
      <LegendaParticipacao fatias={fatias} total={total} mostrarZero />
    </div>
  );
}

/* ── Matriz Probabilidade × Impacto ─────────────────────────────────────── */

const NIVEL = (score: number) => (score >= 15 ? "critico" : score >= 10 ? "alto" : score >= 5 ? "moderado" : "baixo");
const COR_NIVEL: Record<string, string> = {
  baixo: "var(--accent-green)", moderado: "var(--accent-cyan)", alto: "var(--accent-amber)", critico: "var(--accent-red)",
};

export function MatrizRisco({
  celulas, destaque,
}: {
  celulas: { probabilidade: number; impacto: number; quantidade: number; casos: { id: string; codigo: string; titulo: string }[] }[];
  /** Caso a destacar (tela de detalhe): marca a célula dele. */
  destaque?: { probabilidade: number | null; impacto: number | null };
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const selecionada = celulas.find(c => `${c.probabilidade}-${c.impacto}` === aberta);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "22px repeat(5, minmax(34px, 1fr))", gap: 4, alignItems: "stretch" }}>
        {[5, 4, 3, 2, 1].map(p => (
          <FragmentoLinha key={p} p={p} celulas={celulas} aberta={aberta} setAberta={setAberta} destaque={destaque} />
        ))}
        <span />
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className="num" style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>{i}</span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)", margin: "4px 0 0 26px" }}>
        <span>↑ Probabilidade</span><span>Impacto →</span>
      </div>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", listStyle: "none", padding: 0, margin: "8px 0 0" }}>
        {(["baixo", "moderado", "alto", "critico"] as const).map(n => (
          <li key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: COR_NIVEL[n] }} />
            {{ baixo: "Baixo (1–4)", moderado: "Moderado (5–9)", alto: "Alto (10–14)", critico: "Crítico (15–25)" }[n]}
          </li>
        ))}
      </ul>
      {selecionada && selecionada.casos.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
          {selecionada.casos.map(c => (
            <li key={c.id} style={{ fontSize: 12 }}>
              <Link href={`${BASE}/assuntos/${c.id}`} style={{ color: "var(--text-primary)" }}>
                <span className="num" style={{ color: "var(--text-muted)" }}>{c.codigo}</span> {c.titulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FragmentoLinha({
  p, celulas, aberta, setAberta, destaque,
}: {
  p: number; celulas: any[]; aberta: string | null; setAberta: (k: string | null) => void;
  destaque?: { probabilidade: number | null; impacto: number | null };
}) {
  return (
    <>
      <span className="num" style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>{p}</span>
      {[1, 2, 3, 4, 5].map(i => {
        const cel = celulas.find(c => c.probabilidade === p && c.impacto === i);
        const qtd = cel?.quantidade ?? 0;
        const nivel = NIVEL(p * i);
        const chave = `${p}-${i}`;
        const marcado = destaque?.probabilidade === p && destaque?.impacto === i;
        return (
          <button
            key={chave}
            type="button"
            onClick={() => setAberta(aberta === chave ? null : chave)}
            disabled={!qtd && !marcado}
            title={`Probabilidade ${p} × Impacto ${i} = ${p * i} (${nivel})${qtd ? ` · ${qtd} assunto(s)` : ""}`}
            style={{
              minHeight: 34, borderRadius: 6, cursor: qtd ? "pointer" : "default",
              border: marcado ? "2px solid var(--text-primary)" : aberta === chave ? "1px solid var(--text-primary)" : "1px solid transparent",
              background: `color-mix(in srgb, ${COR_NIVEL[nivel]} ${qtd || marcado ? 42 : 12}%, transparent)`,
              color: "var(--text-primary)", fontSize: 12, fontWeight: 700,
            }}
          >
            {qtd ? <span className="metric">{qtd}</span> : marcado ? "●" : ""}
          </button>
        );
      })}
    </>
  );
}

/* ── Funil de valores ───────────────────────────────────────────────────── */

export function FunilValores({
  valores, campos,
}: { valores: Record<string, number>; campos: { campo: string; rotulo: string }[] }) {
  const funil = ["valorPretendido", "valorSolicitado", "valorEmAnalise", "valorReconhecido", "valorAlcancado", "valorRecebido"];
  const extras = ["valorReequilibrio", "valorEmRisco", "valorPotencial"];
  const rotulo = (c: string) => campos.find(x => x.campo === c)?.rotulo ?? c;
  const teto = Math.max(1, ...funil.map(c => Math.abs(valores[c] ?? 0)));
  const total = [...funil, ...extras].reduce((s, c) => s + Math.abs(valores[c] ?? 0), 0);
  if (total === 0) return vazio("Nenhum valor financeiro informado nos assuntos.");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {funil.map((c, idx) => {
        const v = valores[c] ?? 0;
        return (
          <div key={c} title={`${rotulo(c)}: ${dinheiro(v)}`} style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{rotulo(c)}</span>
            <span style={{ height: 12, borderRadius: 4, background: "color-mix(in srgb, var(--text-muted) 12%, transparent)", overflow: "hidden" }}>
              <span style={{
                display: "block", height: "100%", width: `${(Math.abs(v) / teto) * 100}%`, borderRadius: 4,
                background: `color-mix(in srgb, var(--accent-violet) ${100 - idx * 11}%, var(--accent-green))`,
              }} />
            </span>
            <span className="metric" style={{ fontSize: 12, textAlign: "right" }}>{dinheiroCurto(v)}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        {extras.map(c => (
          <span key={c} title={dinheiro(valores[c] ?? 0)} style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{rotulo(c)}: </span>
            <span className="metric" style={{ color: c === "valorEmRisco" ? "var(--accent-red)" : "var(--text-primary)" }}>{dinheiroCurto(valores[c] ?? 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Evolução mensal ────────────────────────────────────────────────────── */

export function ColunasMensais({
  dados, series,
}: {
  dados: Record<string, any>[];
  series: { chave: string; rotulo: string; cor: string }[];
}) {
  const teto = Math.max(1, ...dados.flatMap(d => series.map(s => Number(d[s.chave] ?? 0))));
  const algum = dados.some(d => series.some(s => Number(d[s.chave] ?? 0) > 0));
  if (!algum) return vazio("Sem movimentação registrada nos últimos 12 meses.");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", overflowX: "auto", paddingBottom: 4 }}>
        {dados.map(d => (
          <div key={d.mes} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 42 }}
            title={series.map(s => `${s.rotulo}: ${fmt(d[s.chave])}`).join(" · ")}>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 110 }}>
              {series.map(s => (
                <span key={s.chave} style={{
                  width: 9, height: Math.max(d[s.chave] ? 4 : 0, Math.round((Number(d[s.chave] ?? 0) / teto) * 104)),
                  background: s.cor, borderRadius: "3px 3px 0 0",
                }} />
              ))}
            </div>
            <span style={{ fontSize: 9.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{d.rotulo}</span>
          </div>
        ))}
      </div>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", listStyle: "none", padding: 0, margin: "8px 0 0" }}>
        {series.map(s => (
          <li key={s.chave} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.cor }} /> {s.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Pipeline de oportunidades ──────────────────────────────────────────── */

export function PipelineResumo({
  etapas, mostrarValor,
}: {
  etapas: { id: string; rotulo: string; quantidade: number; potencial: number | null; casos: { id: string; codigo: string; titulo: string; farol: Farol }[] }[];
  mostrarValor: boolean;
}) {
  const total = etapas.reduce((s, e) => s + e.quantidade, 0);
  if (!total) return vazio("Nenhuma oportunidade cadastrada.");
  const potencial = etapas.reduce((s, e) => s + (e.potencial ?? 0), 0);
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
        {etapas.map((e, idx) => (
          <div key={e.id} title={e.casos.map(c => `${c.codigo} ${c.titulo}`).join("\n") || "Nenhuma"}
            style={{
              flex: "1 0 92px", padding: "8px 10px", borderRadius: 8,
              background: e.quantidade ? `color-mix(in srgb, var(--accent-cyan) ${14 + Math.min(40, e.quantidade * 8)}%, transparent)` : "color-mix(in srgb, var(--text-muted) 8%, transparent)",
              clipPath: idx < etapas.length - 1 ? "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)" : undefined,
            }}>
            <div style={{ fontSize: 10.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{e.rotulo}</div>
            <div className="metric" style={{ fontSize: 17 }}>{e.quantidade}</div>
            {mostrarValor && <div className="metric" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{e.potencial ? dinheiroCurto(e.potencial) : "—"}</div>}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0" }}>
        {total} {total === 1 ? "oportunidade" : "oportunidades"}
        {mostrarValor ? <> · potencial informado <strong className="metric">{potencial ? dinheiro(potencial) : "nenhum"}</strong></> : null}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
        {etapas.flatMap(e => e.casos.map(c => (
          <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <FarolPonto farol={c.farol} tamanho={8} />
            <Link href={`${BASE}/assuntos/${c.id}`} style={{ color: "var(--text-primary)" }}>{c.titulo}</Link>
            <span style={{ color: "var(--text-muted)" }}>· {e.rotulo}</span>
          </li>
        )))}
      </ul>
    </div>
  );
}
