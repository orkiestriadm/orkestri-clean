"use client";

/**
 * Gráficos do painel executivo.
 *
 * Decisões vindas da skill ui-ux-pro-max, renderizadas com os tokens do
 * produto — a paleta e as primitivas continuam sendo as do Orkiestri, para o
 * módulo não virar uma ilha visual no meio do sistema.
 *
 * O que a skill mandou e está aqui:
 *
 *  - comparar categorias → BARRA, ordenada decrescente, com o VALOR rotulado
 *    na própria barra (`direct-labeling`): reduz o ir-e-vir do olho até a
 *    legenda;
 *  - nada de pizza. A orientação é explícita: acima de 5 fatias vira ilegível,
 *    e o leitor de tela não dá conta. Barra empilhada no lugar;
 *  - `color-not-only`: nenhuma informação sai só na cor — todo elemento tem
 *    número ou rótulo ao lado;
 *  - `tooltip-on-interact`: valor exato no hover, via `title` nativo, que
 *    funciona com teclado e leitor de tela;
 *  - `empty-data-state`: sem dado, uma frase — nunca um eixo vazio;
 *  - `gridline-subtle` e `trend-emphasis`: sem gradiente nem sombra
 *    competindo com o dado.
 */

import { ReactNode } from "react";
import Link from "next/link";

const fmt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

/* ── Barra horizontal comparativa ─────────────────────────────────────────
   Preferida à vertical quando os rótulos são palavras: nome de categoria em
   barra vertical vira texto girado, que ninguém lê confortavelmente. */

export type ItemBarra = {
  rotulo: string;
  valor: number;
  cor?: string;
  href?: string;
  /** Segundo valor, desenhado sobre o primeiro (ex.: quantas são críticas). */
  destaque?: number;
  destaqueRotulo?: string;
};

export function BarrasComparativas({
  itens, max, vazio = "Sem dados no período.",
}: { itens: ItemBarra[]; max?: number; vazio?: string }) {
  if (itens.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0" }}>{vazio}</p>;
  }

  // Ordena decrescente — a skill é explícita, e é o que faz a comparação ser
  // imediata em vez de exigir varredura.
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor);
  const teto = max ?? Math.max(1, ...ordenados.map(i => i.valor));

  return (
    <ul style={{ display: "flex", flexDirection: "column", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
      {ordenados.map((i, idx) => {
        const pct = Math.round((i.valor / teto) * 100);
        const pctDestaque = i.destaque ? Math.round((i.destaque / teto) * 100) : 0;
        const titulo = `${i.rotulo}: ${fmt(i.valor)}`
          + (i.destaque ? ` · ${fmt(i.destaque)} ${i.destaqueRotulo ?? "em destaque"}` : "");

        const conteudo = (
          <>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <span style={{
                fontSize: 12.5, minWidth: 0, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {i.rotulo}
              </span>
              {/* Valor rotulado: o olho não precisa ir até um eixo. */}
              <span className="metric" style={{ fontSize: 12.5, flexShrink: 0 }}>{fmt(i.valor)}</span>
            </span>
            <span style={{
              display: "block", position: "relative", height: 8, borderRadius: 4,
              background: "color-mix(in srgb, var(--text-muted) 14%, transparent)", overflow: "hidden",
            }}>
              <span style={{
                position: "absolute", inset: 0, width: `${pct}%`,
                background: i.cor ?? "var(--accent-violet)", borderRadius: 4,
                transition: "width .4s cubic-bezier(.22,1,.36,1)",
              }} />
              {pctDestaque > 0 && (
                <span
                  title={`${fmt(i.destaque!)} ${i.destaqueRotulo ?? ""}`}
                  style={{
                    position: "absolute", inset: 0, width: `${pctDestaque}%`,
                    background: "var(--accent-red)", borderRadius: 4,
                    transition: "width .4s cubic-bezier(.22,1,.36,1)",
                  }}
                />
              )}
            </span>
          </>
        );

        return (
          <li key={`${i.rotulo}-${idx}`} title={titulo}>
            {i.href
              ? <Link href={i.href} style={{ color: "inherit", textDecoration: "none", display: "block" }}>{conteudo}</Link>
              : conteudo}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Barra empilhada única ────────────────────────────────────────────────
   Substitui a pizza. Mostra proporção sem os problemas de leitura e de
   acessibilidade que a orientação da skill aponta para fatias. */

export function BarraEmpilhada({
  fatias, vazio = "Sem dados.",
}: { fatias: { rotulo: string; valor: number; cor: string }[]; vazio?: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  if (total === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0" }}>{vazio}</p>;
  }

  const visiveis = fatias.filter(f => f.valor > 0);

  return (
    <>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 12 }}>
        {visiveis.map(f => (
          <span
            key={f.rotulo}
            title={`${f.rotulo}: ${fmt(f.valor)} (${Math.round((f.valor / total) * 100)}%)`}
            style={{
              width: `${(f.valor / total) * 100}%`, background: f.cor,
              transition: "width .4s cubic-bezier(.22,1,.36,1)",
            }}
          />
        ))}
      </div>
      {/* Legenda com número ao lado da cor: a cor sozinha nunca carrega o dado. */}
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", listStyle: "none", margin: 0, padding: 0 }}>
        {visiveis.map(f => (
          <li key={f.rotulo} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: f.cor, flexShrink: 0 }} />
            <span>{f.rotulo}</span>
            <span className="metric" style={{ color: "var(--text-secondary)" }}>{fmt(f.valor)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── Linha do tempo de vencimentos ────────────────────────────────────────
   Colunas por mês. A skill sugere linha para tendência, mas aqui a pergunta
   não é "para onde vai" — é "qual mês concentra". Coluna responde isso
   melhor, e cada barra é um alvo clicável que leva à lista daquele mês. */

export function ColunasPorMes({
  dados, vazio = "Nenhum vencimento no período.",
}: {
  dados: { mes: string; total: number; criticas: number }[];
  vazio?: string;
}) {
  if (dados.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0" }}>{vazio}</p>;
  }

  const teto = Math.max(...dados.map(d => d.total));
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "flex-end", overflowX: "auto", paddingBottom: 4 }}>
      {dados.map(d => {
        const altura = Math.max(4, Math.round((d.total / teto) * 104));
        const passado = d.mes < mesAtual;
        const [ano, mes] = d.mes.split("-");
        const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();

        return (
          <Link
            key={d.mes}
            href={`/dashboard/compliance/obrigacoes?de=${d.mes}-01&ate=${d.mes}-${ultimoDia}`}
            title={
              `${fmt(d.total)} ${d.total === 1 ? "vencimento" : "vencimentos"} em ${mes}/${ano}`
              + (d.criticas > 0 ? ` · ${fmt(d.criticas)} de criticidade alta ou crítica` : "")
              + (passado ? " · mês já passado" : "")
            }
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              minWidth: 36, textDecoration: "none", color: "inherit",
            }}
          >
            <span className="metric" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{d.total}</span>
            <span style={{
              width: 22, height: altura, borderRadius: "4px 4px 0 0",
              // O passado fica em vermelho esmaecido: vencimento que já
              // passou e continua na carteira é exatamente o que interessa.
              background: passado
                ? "color-mix(in srgb, var(--accent-red) 55%, transparent)"
                : d.criticas > 0 ? "var(--accent-amber)" : "var(--accent-violet)",
              transition: "height .4s cubic-bezier(.22,1,.36,1)",
            }} />
            <span style={{ fontSize: 9.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {mes}/{ano.slice(2)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ── Cartão de seção ──────────────────────────────────────────────────── */

export function Cartao({
  titulo, dica, acoes, children,
}: { titulo: string; dica?: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__head">
        <span className="panel__title mono-cap" title={dica}>{titulo}</span>
        {acoes}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}
