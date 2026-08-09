"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import {
  PageBody, PageHeader, TableCard, EmptyState, ErrorState, PermissionDenied,
  useCountUp,
} from "@/components/data-ui";
import {
  ShieldCheck, AlertTriangle, CalendarClock, Clock, FileWarning, CheckCircle2,
  ListChecks, CalendarDays, Settings, BarChart2, ArrowRight,
} from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Painel, Obrigacao } from "@/lib/compliance/types";
import {
  pode, data, prazoEmPalavras, SeloSituacao, Identificacao, dinheiro,
} from "./_components/comuns";
import { BarrasComparativas, BarraEmpilhada, ColunasPorMes, Cartao } from "./_components/graficos";
import ObrigacaoModal from "./_components/ObrigacaoModal";
import RenovarModal from "./_components/RenovarModal";
import ProtocoloModal from "./_components/ProtocoloModal";

/**
 * Painel executivo do Compliance.
 *
 * A hierarquia é a decisão de design mais importante desta tela, e vem antes
 * de qualquer escolha visual: quem abre um painel de conformidade tem UMA
 * pergunta — o que está em risco agora. Tudo o mais é contexto.
 *
 * Por isso a ordem é:
 *
 *   1. uma FRASE dizendo se há problema, e qual
 *   2. os números que exigem ação, com o filtro já pronto no clique
 *   3. a fila do que fazer, que é a tela que se usa de verdade
 *   4. só então a distribuição da carteira
 *
 * A planilha que este módulo substitui ordenava por número de item, e por isso
 * a licença com o prazo estourado ficava na linha 6 sem nada a distinguindo.
 */

type Recorte = {
  id: string;
  rotulo: string;
  valor: number;
  cor: string;
  icone: any;
  href: string;
  /** O que este número quer dizer — vira `title`, para não sobrar dúvida. */
  dica: string;
  urgente?: boolean;
};

export default function CompliancePainelPage() {
  const user = useAuthStore(s => s.user);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [aberta, setAberta] = useState<string | null>(null);
  const [renovando, setRenovando] = useState<Obrigacao | null>(null);
  const [protocolando, setProtocolando] = useState<Obrigacao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPainel(await complianceService.painel());
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar o painel.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const c = painel?.cartoes;
  const g = painel?.graficos;

  const recortes: Recorte[] = useMemo(() => !c ? [] : [
    {
      id: "vencida", rotulo: "Vencidas", valor: c.vencidas, cor: "var(--accent-red)",
      icone: AlertTriangle, href: "/dashboard/compliance/obrigacoes?situacao=vencida",
      dica: "Passaram da validade e não têm protocolo tempestivo.", urgente: true,
    },
    {
      id: "prazo_fatal_vencido", rotulo: "Prazo fatal vencido", valor: c.prazoFatalVencido,
      cor: "var(--accent-red)", icone: FileWarning,
      href: "/dashboard/compliance/obrigacoes?situacao=prazo_fatal_vencido",
      dica: "Ainda válidas, mas a janela que o órgão exige para protocolar já fechou.", urgente: true,
    },
    {
      id: "renovacao_devida", rotulo: "Renovação devida", valor: c.renovacaoDevida,
      cor: "var(--accent-amber)", icone: Clock,
      href: "/dashboard/compliance/obrigacoes?situacao=renovacao_devida",
      dica: "Passaram do prazo interno — é hora de começar.", urgente: true,
    },
    {
      id: "vence30", rotulo: "Vence em 30 dias", valor: c.vence30, cor: "var(--accent-amber)",
      icone: CalendarClock, href: "/dashboard/compliance/obrigacoes?venceEmDias=30",
      dica: "Janela dos próximos 30 dias, incluindo o que já venceu.",
    },
    {
      id: "prorrogada", rotulo: "Prorrogadas", valor: c.prorrogadas, cor: "var(--accent-cyan)",
      icone: CheckCircle2, href: "/dashboard/compliance/obrigacoes?situacao=prorrogada",
      dica: "Vencidas no papel, regulares por protocolo tempestivo.",
    },
    {
      id: "total", rotulo: "Na carteira", valor: c.total, cor: "var(--accent-violet)",
      icone: ShieldCheck, href: "/dashboard/compliance/obrigacoes",
      dica: "Tudo que está no radar — fora canceladas e arquivadas.",
    },
  ], [c]);

  const precisaAcao = (c?.vencidas ?? 0) + (c?.prazoFatalVencido ?? 0) + (c?.renovacaoDevida ?? 0);
  const critico = (c?.vencidas ?? 0) + (c?.prazoFatalVencido ?? 0) > 0;

  const COLUNAS = ["Obrigação", "Situação", "Começar em", "Prazo fatal", "Vence", "Responsável"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <PageHeader
            icon={<ShieldCheck size={19} />}
            title="Compliance"
            subtitle="Licenças, laudos, certificados e contratos — o que vence, quando começar e quem responde"
            actions={
              <>
                <Link href="/dashboard/compliance/obrigacoes" className="btn btn-ghost">
                  <ListChecks size={14} /> Obrigações
                </Link>
                <Link href="/dashboard/compliance/calendario" className="btn btn-ghost">
                  <CalendarDays size={14} /> Calendário
                </Link>
                <Link href="/dashboard/compliance/relatorios" className="btn btn-ghost">
                  <BarChart2 size={14} /> Relatórios
                </Link>
                {pode(user, "compliance.notificacao:ver") && (
                  <Link href="/dashboard/compliance/alertas" className="btn btn-ghost">
                    <Settings size={14} /> Alertas
                  </Link>
                )}
              </>
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o painel de conformidade." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando ? (
            <>
              <div className="skeleton" style={{ height: 68, borderRadius: 14, marginBottom: 16 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 96, borderRadius: 14 }} />
                ))}
              </div>
              <div className="skeleton" style={{ height: 280, borderRadius: 14 }} />
            </>
          ) : !painel ? null : (
            <>
              <Veredito precisaAcao={precisaAcao} critico={critico} cartoes={c!} />

              {/* `.stagger` já existe no design system e o próprio globals.css
                  a desliga em prefers-reduced-motion — reusar sai mais barato e
                  mais correto que inventar uma animação nova aqui. */}
              <div
                className="stagger"
                style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(172px, 1fr))",
                  gap: 12, marginBottom: 22,
                }}
              >
                {recortes.map((r, i) => <CartaoRecorte key={r.id} r={r} index={i} />)}
              </div>

              <Cartao
                titulo="O que fazer agora"
                dica="Ordenado pelo prazo interno — a data em que é preciso começar, não a validade."
                acoes={
                  <Link
                    href="/dashboard/compliance/obrigacoes"
                    className="btn btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 11.5 }}
                  >
                    Ver a carteira <ArrowRight size={12} />
                  </Link>
                }
              >
                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Duplo clique em qualquer linha abre o detalhe completo sem sair daqui.
                </p>
                <TableCard>
                  <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>
                    {painel.filaDeAcao.length === 0 ? (
                      <EmptyState
                        colSpan={COLUNAS.length}
                        icon={<CheckCircle2 size={20} />}
                        title="Nada exige ação agora"
                        hint="Nenhuma obrigação passou do prazo interno de renovação."
                      />
                    ) : painel.filaDeAcao.map(o => (
                      <tr
                        key={o.id}
                        onDoubleClick={() => setAberta(o.id)}
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === "Enter" && e.currentTarget === e.target) setAberta(o.id); }}
                        title="Duplo clique para abrir"
                        style={{ cursor: "pointer" }}
                      >
                        <td><Identificacao o={o} /></td>
                        <td><SeloSituacao o={o} /></td>
                        <td className="num">
                          {data(o.prazoInternoEm)}
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                            {prazoEmPalavras(o.diasParaPrazoInterno)}
                          </div>
                        </td>
                        <td className="num">{data(o.prazoFatalEm)}</td>
                        <td className="num">
                          {data(o.dataValidade)}
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                            {prazoEmPalavras(o.diasParaValidade)}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {o.responsaveis?.[0]?.user?.nome ?? o.responsaveis?.[0]?.nome ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableCard>
              </Cartao>

              <Cartao
                titulo="Vencimentos por mês"
                dica="Clique num mês para filtrar a carteira por ele."
                acoes={<Legenda />}
              >
                <ColunasPorMes dados={g!.vencimentos} />
              </Cartao>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
                <Cartao titulo="Por categoria">
                  <BarrasComparativas
                    itens={g!.porCategoria.map(x => ({
                      rotulo: x.nome, valor: x.total, cor: x.cor,
                      href: `/dashboard/compliance/obrigacoes?categoriaId=${x.categoriaId}`,
                    }))}
                  />
                </Cartao>

                <Cartao titulo="Por unidade" dica="As dez unidades com mais obrigações.">
                  <BarrasComparativas
                    itens={g!.porUnidade.slice(0, 10).map(x => ({
                      rotulo: x.valor, valor: x.total, cor: "var(--accent-cyan)",
                      href: x.valor === "—" ? undefined
                        : `/dashboard/compliance/obrigacoes?unidade=${encodeURIComponent(x.valor)}`,
                    }))}
                  />
                </Cartao>

                <Cartao titulo="Criticidade" dica="Proporção da carteira por nível de criticidade.">
                  <BarraEmpilhada
                    fatias={[
                      { rotulo: "Crítica", valor: valorDe(g!.porCriticidade, "critica"), cor: "var(--accent-red)" },
                      { rotulo: "Alta", valor: valorDe(g!.porCriticidade, "alta"), cor: "var(--accent-amber)" },
                      { rotulo: "Média", valor: valorDe(g!.porCriticidade, "media"), cor: "var(--accent-violet)" },
                      { rotulo: "Baixa", valor: valorDe(g!.porCriticidade, "baixa"), cor: "var(--text-muted)" },
                    ]}
                  />
                </Cartao>

                <Cartao titulo="Por responsável" dica="Quem está com quantas na mão.">
                  <BarrasComparativas
                    itens={g!.porResponsavel.slice(0, 10).map(x => ({ rotulo: x.nome, valor: x.total }))}
                    vazio="Nenhuma obrigação tem responsável nomeado."
                  />
                </Cartao>
              </div>

              {painel.custos.obrigacoesComCusto > 0 && (
                <Cartao titulo="Custos">
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)" }}>Licenças</div>
                      <div className="metric" style={{ fontSize: 20 }}>{dinheiro(painel.custos.totalLicencas)}</div>
                    </div>
                    <div>
                      <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)" }}>Renovações</div>
                      <div className="metric" style={{ fontSize: 20 }}>{dinheiro(painel.custos.totalRenovacoes)}</div>
                    </div>
                  </div>
                  <BarrasComparativas
                    itens={painel.custos.porCategoria.map(x => ({
                      rotulo: x.nome, valor: Math.round(x.licenca + x.renovacao),
                    }))}
                  />
                </Cartao>
              )}
            </>
          )}
        </PageBody>
      </div>

      <ObrigacaoModal
        obrigacaoId={aberta}
        user={user}
        onFechar={() => setAberta(null)}
        onMudou={carregar}
        onRenovar={o => { setAberta(null); setRenovando(o); }}
        onProtocolar={o => { setAberta(null); setProtocolando(o); }}
      />
      <RenovarModal obrigacao={renovando} onFechar={() => setRenovando(null)} onSalvo={carregar} />
      <ProtocoloModal obrigacao={protocolando} onFechar={() => setProtocolando(null)} onSalvo={carregar} />
    </div>
  );
}

function valorDe(lista: { valor: string; total: number }[], chave: string): number {
  return lista.find(x => x.valor === chave)?.total ?? 0;
}

/* ── Veredito ─────────────────────────────────────────────────────────────
   Uma frase antes de qualquer número. Painel que só mostra números obriga o
   leitor a fazer a conta e concluir sozinho se está tudo bem — e é aí que a
   informação passa despercebida. */

function Veredito({
  precisaAcao, critico, cartoes,
}: { precisaAcao: number; critico: boolean; cartoes: NonNullable<Painel["cartoes"]> }) {
  const cor = critico ? "var(--accent-red)" : precisaAcao > 0 ? "var(--accent-amber)" : "var(--accent-green)";

  const frase = precisaAcao === 0
    ? "Nenhuma obrigação exige ação hoje."
    : `${precisaAcao} ${precisaAcao === 1 ? "obrigação exige" : "obrigações exigem"} ação.`;

  const detalhe = precisaAcao === 0
    ? cartoes.vence30 > 0
      ? `${cartoes.vence30} ${cartoes.vence30 === 1 ? "vence" : "vencem"} nos próximos 30 dias, ainda dentro do prazo.`
      : "Nada vence nos próximos 30 dias."
    : [
        cartoes.vencidas > 0 && `${cartoes.vencidas} já ${cartoes.vencidas === 1 ? "venceu" : "venceram"}`,
        cartoes.prazoFatalVencido > 0
          && `${cartoes.prazoFatalVencido} ${cartoes.prazoFatalVencido === 1 ? "perdeu" : "perderam"} a janela de protocolo`,
        cartoes.renovacaoDevida > 0
          && `${cartoes.renovacaoDevida} ${cartoes.renovacaoDevida === 1 ? "passou" : "passaram"} do prazo interno`,
      ].filter(Boolean).join(" · ");

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "16px 18px", borderRadius: 14, marginBottom: 18,
        background: `color-mix(in srgb, ${cor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cor} 26%, transparent)`,
      }}
    >
      <span style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        display: "grid", placeItems: "center", color: cor,
        background: `color-mix(in srgb, ${cor} 14%, transparent)`,
      }}>
        {precisaAcao === 0 ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
      </span>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 2 }}>{frase}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{detalhe}</div>
      </div>
      {precisaAcao > 0 && (
        <Link href="/dashboard/compliance/obrigacoes?situacao=renovacao_devida" className="btn btn-primary">
          Ver a fila <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

/* ── Cartão-recorte ───────────────────────────────────────────────────────
   Cada número é um filtro: clicar leva à carteira já recortada. Número que
   não leva a lugar nenhum obriga a refazer o filtro à mão. */

function CartaoRecorte({ r, index }: { r: Recorte; index: number }) {
  const mostrado = useCountUp(r.valor);
  const Icone = r.icone;
  const aceso = r.urgente && r.valor > 0;

  return (
    <Link
      href={r.href}
      title={r.dica}
      aria-label={`${r.rotulo}: ${r.valor}. ${r.dica}`}
      style={{
        display: "block", padding: "14px 16px", borderRadius: 14, textDecoration: "none",
        color: "inherit", position: "relative", overflow: "hidden",
        border: `1px solid color-mix(in srgb, ${r.cor} ${aceso ? 40 : 16}%, transparent)`,
        background: aceso ? `color-mix(in srgb, ${r.cor} 7%, transparent)` : undefined,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, color: r.cor }}>
        <Icone size={15} />
        <span className="mono-cap" style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{r.rotulo}</span>
      </span>
      <span className="metric" style={{ fontSize: 27, lineHeight: 1, display: "block", color: aceso ? r.cor : undefined }}>
        {mostrado.toLocaleString("pt-BR")}
      </span>
      <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, display: "block" }}>
        filtrar
      </span>
    </Link>
  );
}

function Legenda() {
  const itens = [
    { cor: "var(--accent-red)", rotulo: "já passou" },
    { cor: "var(--accent-amber)", rotulo: "tem crítica" },
    { cor: "var(--accent-violet)", rotulo: "no prazo" },
  ];
  return (
    <span style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {itens.map(i => (
        <span key={i.rotulo} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-muted)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </span>
  );
}
