"use client";

/**
 * Peças compartilhadas pelas telas do Compliance.
 *
 * Ficam aqui as decisões que precisam ser IGUAIS em todas as telas: a cor de
 * cada situação, como se conta o prazo em palavras e como se desenha a barra de
 * um gráfico. Espalhá-las reproduziria o defeito da planilha — quatro lugares
 * dizendo coisas diferentes sobre a mesma licença.
 */

import { ReactNode } from "react";
import Link from "next/link";
import { StatusBadge, BadgeTone } from "@/components/data-ui";
import { formatarDataBR } from "@/lib/datas";
import type { Obrigacao, SituacaoPrazo, Criticidade } from "@/lib/compliance/types";
import { ROTULO_CRITICIDADE, TOM_CRITICIDADE } from "@/lib/compliance/types";

/** Link que não parece link até o hover — a linha inteira já é clicável. */
export const LINK_DISCRETO: React.CSSProperties = {
  color: "inherit", textDecoration: "none",
};

export function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

export const data = (v: string | null | undefined) => formatarDataBR(v) ?? "—";

export const dinheiro = (v: string | number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * O prazo em palavras.
 *
 * "faltam 11 dias" e "venceu há 3 dias" são a mesma informação com sinais
 * opostos, e mostrar `-3` numa coluna faria o leitor calcular de cabeça.
 */
export function prazoEmPalavras(dias: number | null | undefined): string {
  if (dias == null) return "—";
  if (dias === 0) return "hoje";
  if (dias > 0) return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const atraso = Math.abs(dias);
  return `há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
}

export function SeloSituacao({ o }: { o: Obrigacao }) {
  return <StatusBadge label={o.situacaoRotulo} tone={o.situacaoTom as BadgeTone} />;
}

export function SeloCriticidade({ nivel }: { nivel: Criticidade }) {
  return <StatusBadge label={ROTULO_CRITICIDADE[nivel]} tone={TOM_CRITICIDADE[nivel]} />;
}

/** Cor da situação, para gráficos e listas onde o selo não cabe. */
export const COR_SITUACAO: Record<SituacaoPrazo, string> = {
  sem_validade: "var(--text-muted)",
  vigente: "var(--accent-green)",
  renovacao_devida: "var(--accent-amber)",
  prazo_fatal_vencido: "var(--accent-red)",
  vencida: "var(--accent-red)",
  prorrogada: "var(--accent-cyan)",
};

/**
 * Identificação da obrigação em uma célula.
 *
 * Nome, sigla e número juntos porque nenhum dos três identifica sozinho: há
 * nove "Licença de Porte e Uso de Motopoda", e dois CCB com o mesmo número.
 * O que desempata é o escopo — unidade ou equipamento.
 */
export function Identificacao({ o, comLink = true }: { o: Obrigacao; comLink?: boolean }) {
  const identificador = [o.sigla, o.numeroDocumento].filter(Boolean).join(" ");
  const escopo = o.ativoIdentificador ?? o.unidade;

  const titulo = (
    <span style={{ fontWeight: 600 }}>
      {o.nome}
      {escopo && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}> · {escopo}</span>}
    </span>
  );

  return (
    <div style={{ minWidth: 0 }}>
      {comLink
        ? <Link href={`/dashboard/compliance/obrigacoes/${o.id}`} style={LINK_DISCRETO}>{titulo}</Link>
        : titulo}
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
        <span className="num">{o.codigo}</span>
        {identificador && <> · {identificador}</>}
        {o.categoria && <> · {o.categoria.nome}</>}
      </div>
    </div>
  );
}

/**
 * Barra horizontal proporcional.
 *
 * Usada nos agrupamentos do painel. Preferida à rosca porque a pergunta que o
 * painel responde é comparativa ("qual categoria tem mais"), e comparar
 * comprimento é mais preciso que comparar ângulo.
 */
export function BarraProporcao({
  itens, max,
}: {
  itens: { rotulo: string; valor: number; cor?: string; href?: string }[];
  max?: number;
}) {
  const teto = max ?? Math.max(1, ...itens.map(i => i.valor));

  if (itens.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>Sem dados.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {itens.map((i, idx) => {
        const pct = Math.round((i.valor / teto) * 100);
        const linha = (
          <>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {i.rotulo}
            </span>
            <span className="metric" style={{ fontSize: 12.5, minWidth: 34, textAlign: "right" }}>
              {i.valor.toLocaleString("pt-BR")}
            </span>
          </>
        );
        return (
          <div key={`${i.rotulo}-${idx}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              {i.href
                ? <Link href={i.href} style={{ ...LINK_DISCRETO, flex: 1, minWidth: 0, display: "flex", gap: 10 }}>{linha}</Link>
                : linha}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2, rgba(127,127,127,.14))", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: i.cor ?? "var(--accent-violet)", borderRadius: 3, transition: "width .35s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Secao({ titulo, acoes, children }: { titulo: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__head">
        <span className="panel__title mono-cap">{titulo}</span>
        {acoes}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/**
 * Aviso destacado.
 *
 * Existe porque há informação que a tela precisa dar sem que o usuário tenha
 * clicado em nada — "seu protocolo não prorroga", "a exportação veio cortada".
 */
export function Aviso({ tom = "atencao", children }: { tom?: "atencao" | "critico" | "info"; children: ReactNode }) {
  const cor = tom === "critico" ? "var(--accent-red)" : tom === "info" ? "var(--accent-cyan)" : "var(--accent-amber)";
  return (
    <div
      style={{
        padding: "12px 14px", borderRadius: 12, marginBottom: 14, fontSize: 12.5, lineHeight: 1.55,
        background: `color-mix(in srgb, ${cor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cor} 26%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}
