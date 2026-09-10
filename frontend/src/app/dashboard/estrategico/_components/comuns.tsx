"use client";

/**
 * Peças compartilhadas pelas telas do Strategy.
 *
 * O farol é a decisão visual mais importante do módulo e precisa ser IGUAL em
 * todas as telas: mesma cor, mesmo rótulo, e sempre com o significado no
 * `title` — a cor nunca é a única informação (acessibilidade e daltonismo).
 */

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/data-ui";
import { formatarDataBR } from "@/lib/datas";
import type { Farol, NivelRisco, Caso } from "@/lib/estrategico/types";
import {
  COR_FAROL, ROTULO_FAROL, SIGNIFICADO_FAROL, TOM_FAROL, ROTULO_RISCO, TOM_RISCO,
} from "@/lib/estrategico/types";

export { Aviso, Secao } from "../../compliance/_components/comuns";

export const BASE = "/dashboard/estrategico";

export const LINK_DISCRETO: React.CSSProperties = { color: "inherit", textDecoration: "none" };

export function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

export const data = (v: string | null | undefined) => formatarDataBR(v) ?? "—";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** Data de andamento: "set/2025" quando a planilha só tinha mês e ano. */
export function dataEvento(v: string, precisao: "dia" | "mes" = "dia") {
  if (precisao === "mes") {
    const [ano, mes] = v.slice(0, 7).split("-");
    return `${MESES[Number(mes) - 1]}/${ano}`;
  }
  return data(v);
}

export const dinheiro = (v: number | string | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** R$ 23,2 mi — para cartão e gráfico, onde o valor exato vai no `title`. */
export function dinheiroCurto(v: number | string | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  const abs = Math.abs(n);
  const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `R$ ${f(n / 1e9)} bi`;
  if (abs >= 1e6) return `R$ ${f(n / 1e6)} mi`;
  if (abs >= 1e4) return `R$ ${f(n / 1e3)} mil`;
  return dinheiro(n);
}

/** "1.234.567,89" ou "1234567.89" → número. Vazio → null. */
export function lerNumero(texto: string): number | null {
  const t = String(texto ?? "").trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const normalizado = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

export function prazoEmPalavras(dias: number | null | undefined): string {
  if (dias == null) return "sem prazo";
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const atraso = Math.abs(dias);
  return `vencida há ${atraso} ${atraso === 1 ? "dia" : "dias"}`;
}

export function paradoEmPalavras(dias: number | null | undefined): string {
  if (dias == null) return "sem andamento datado";
  if (dias === 0) return "movimentado hoje";
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function FarolPonto({ farol, tamanho = 10 }: { farol: Farol; tamanho?: number }) {
  return (
    <span
      role="img"
      aria-label={`Farol ${ROTULO_FAROL[farol]}: ${SIGNIFICADO_FAROL[farol]}`}
      title={`${ROTULO_FAROL[farol]} — ${SIGNIFICADO_FAROL[farol]}`}
      style={{
        display: "inline-block", width: tamanho, height: tamanho, borderRadius: "50%", flexShrink: 0,
        background: COR_FAROL[farol],
        boxShadow: `0 0 0 3px color-mix(in srgb, ${COR_FAROL[farol]} 22%, transparent)`,
      }}
    />
  );
}

export function SeloFarol({ farol, manual }: { farol: Farol; manual?: boolean }) {
  return (
    <span title={`${SIGNIFICADO_FAROL[farol]}${manual ? " · definido manualmente" : " · calculado"}`}>
      <StatusBadge label={`${ROTULO_FAROL[farol]}${manual ? " · manual" : ""}`} tone={TOM_FAROL[farol]} />
    </span>
  );
}

export function SeloRisco({ nivel }: { nivel: NivelRisco | null }) {
  if (!nivel) return <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>não avaliado</span>;
  return <StatusBadge label={ROTULO_RISCO[nivel]} tone={TOM_RISCO[nivel]} />;
}

export function Identificacao({ c, link = true }: { c: Pick<Caso, "id" | "codigo" | "titulo" | "tipo">; link?: boolean }) {
  const corpo = (
    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span className="num" style={{ fontSize: 10.5, color: "var(--text-muted)", letterSpacing: ".02em" }}>
        {c.codigo}{c.tipo === "oportunidade" ? " · oportunidade" : ""}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{c.titulo}</span>
    </span>
  );
  return link ? <Link href={`${BASE}/assuntos/${c.id}`} style={LINK_DISCRETO}>{corpo}</Link> : corpo;
}

export function SemAcao({ compacto }: { compacto?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--accent-amber)", fontSize: compacto ? 11.5 : 12.5, fontWeight: 600 }}>
      <AlertTriangle size={compacto ? 12 : 14} /> Sem próxima ação definida
    </span>
  );
}

export function ProximaAcaoCelula({ c }: { c: Caso }) {
  if (!c.ativo) return <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>;
  if (c.semProximaAcao) return <SemAcao compacto />;
  const vencida = c.acaoVencida;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>{c.proximaAcao}</span>
      <span className="num" style={{ fontSize: 11, color: vencida ? "var(--accent-red)" : c.diasProximaAcao != null && c.diasProximaAcao <= 7 ? "var(--accent-amber)" : "var(--text-muted)", fontWeight: vencida ? 600 : 400 }}>
        {c.proximaAcaoPrazo ? `${data(c.proximaAcaoPrazo)} · ${prazoEmPalavras(c.diasProximaAcao)}` : "sem prazo"}
      </span>
    </span>
  );
}

export const responsavelDe = (c: Caso) =>
  c.proximaAcaoResponsavel?.nome ?? c.proximaAcaoResponsavelNome ?? c.responsavelOperacional?.nome ?? c.areaOperacional?.nome ?? null;

/** Largura estreita (celular): troca tabela por cartões. */
export function useEstreito(limite = 760) {
  const [estreito, setEstreito] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${limite}px)`);
    const aplicar = () => setEstreito(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [limite]);
  return estreito;
}

export function Nota({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0", lineHeight: 1.5 }}>{children}</p>;
}

export function mensagemErro(e: any, padrao: string): string {
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(" · ");
  return m ?? padrao;
}
