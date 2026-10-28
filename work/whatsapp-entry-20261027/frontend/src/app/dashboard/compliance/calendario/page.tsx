"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import {
  PageBody, BackLink, PageHeader, ErrorState, PermissionDenied, Tabs, Panel,
} from "@/components/data-ui";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FileWarning, AlertTriangle } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { EventoCalendario } from "@/lib/compliance/types";
import { data, COR_SITUACAO } from "../_components/comuns";

/**
 * Calendário de prazos.
 *
 * Cada obrigação rende até três eventos — prazo interno, prazo fatal e
 * validade. É a diferença em relação à coluna de vencimento da planilha:
 * mostrar quando é preciso COMEÇAR, e não só quando acaba.
 */

type Visao = "mes" | "lista";

const CORES_TIPO: Record<EventoCalendario["tipo"], string> = {
  prazo_interno: "var(--accent-amber)",
  prazo_fatal: "var(--accent-red)",
  validade: "var(--accent-violet)",
};

const ICONE_TIPO: Record<EventoCalendario["tipo"], any> = {
  prazo_interno: Clock,
  prazo_fatal: FileWarning,
  validade: AlertTriangle,
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function CalendarioPage() {
  const [visao, setVisao] = useState<Visao>("mes");
  const [referencia, setReferencia] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [tiposVisiveis, setTiposVisiveis] = useState<Record<string, boolean>>({
    prazo_interno: true, prazo_fatal: true, validade: true,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      // A janela sempre passa do mês visível: na visão de lista o usuário quer
      // enxergar o que vem depois sem trocar de mês três vezes.
      const de = new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1);
      const ate = new Date(referencia.getFullYear(), referencia.getMonth() + 6, 0);
      const r = await complianceService.calendario(
        de.toISOString().slice(0, 10), ate.toISOString().slice(0, 10),
      );
      setEventos(r.eventos);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar o calendário.");
    } finally {
      setCarregando(false);
    }
  }, [referencia]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(
    () => eventos.filter(e => tiposVisiveis[e.tipo]),
    [eventos, tiposVisiveis],
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const e of filtrados) {
      const chave = String(e.data).slice(0, 10);
      const lista = mapa.get(chave) ?? [];
      lista.push(e);
      mapa.set(chave, lista);
    }
    return mapa;
  }, [filtrados]);

  const celulas = useMemo(() => construirGrade(referencia), [referencia]);
  const doMes = useMemo(() => {
    const prefixo = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, "0")}`;
    return filtrados.filter(e => String(e.data).slice(0, 7) === prefixo);
  }, [filtrados, referencia]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<CalendarDays size={19} />}
            title="Calendário de prazos"
            subtitle="Quando começar a renovar, quando é o último dia para protocolar, e quando vence"
            actions={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" className="btn-icon" aria-label="Mês anterior"
                  onClick={() => setReferencia(r => new Date(r.getFullYear(), r.getMonth() - 1, 1))}>
                  <ChevronLeft size={15} />
                </button>
                <span style={{ minWidth: 148, textAlign: "center", fontWeight: 600, fontSize: 13.5 }}>
                  {referencia.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </span>
                <button type="button" className="btn-icon" aria-label="Próximo mês"
                  onClick={() => setReferencia(r => new Date(r.getFullYear(), r.getMonth() + 1, 1))}>
                  <ChevronRight size={15} />
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { const d = new Date(); setReferencia(new Date(d.getFullYear(), d.getMonth(), 1)); }}>
                  Hoje
                </button>
              </div>
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o calendário de prazos." />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                {(Object.keys(CORES_TIPO) as EventoCalendario["tipo"][]).map(tipo => (
                  <label key={tipo} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={tiposVisiveis[tipo]}
                      onChange={e => setTiposVisiveis(t => ({ ...t, [tipo]: e.target.checked }))}
                    />
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: CORES_TIPO[tipo], display: "inline-block" }} />
                    {tipo === "prazo_interno" ? "Iniciar renovação"
                      : tipo === "prazo_fatal" ? "Prazo fatal" : "Vencimento"}
                  </label>
                ))}
                <span style={{ marginLeft: "auto" }}>
                  <Tabs<Visao>
                    tabs={[{ id: "mes", label: "Mês" }, { id: "lista", label: "Lista" }]}
                    active={visao}
                    onChange={setVisao}
                  />
                </span>
              </div>

              {carregando ? (
                <div className="skeleton" style={{ height: 420, borderRadius: 14 }} />
              ) : visao === "mes" ? (
                <div className="panel">
                  <div className="panel__body">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                      {DIAS_SEMANA.map(d => (
                        <div key={d} className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {celulas.map(celula => {
                        const chave = celula.iso;
                        const doDia = porDia.get(chave) ?? [];
                        const eHoje = chave === hoje;
                        return (
                          <div
                            key={chave}
                            style={{
                              minHeight: 92, padding: 6, borderRadius: 8,
                              border: eHoje
                                ? "1px solid var(--accent-violet)"
                                : "1px solid var(--border-subtle, rgba(127,127,127,.12))",
                              opacity: celula.doMes ? 1 : 0.4,
                              background: eHoje ? "color-mix(in srgb, var(--accent-violet) 6%, transparent)" : undefined,
                            }}
                          >
                            <div className="num" style={{ fontSize: 11, color: eHoje ? "var(--accent-violet)" : "var(--text-muted)", fontWeight: eHoje ? 700 : 400 }}>
                              {celula.dia}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                              {doDia.slice(0, 3).map(e => (
                                <Link
                                  key={e.id}
                                  href={`/dashboard/compliance/obrigacoes/${e.obrigacaoId}`}
                                  title={`${e.rotulo}: ${e.titulo}${e.unidade ? ` (${e.unidade})` : ""}`}
                                  style={{
                                    fontSize: 10, padding: "2px 5px", borderRadius: 4, textDecoration: "none",
                                    color: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                    background: `color-mix(in srgb, ${CORES_TIPO[e.tipo]} 16%, transparent)`,
                                    borderLeft: `2px solid ${CORES_TIPO[e.tipo]}`,
                                  }}
                                >
                                  {e.sigla ?? e.titulo}
                                </Link>
                              ))}
                              {doDia.length > 3 && (
                                <span style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                                  +{doDia.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <Panel title={`${doMes.length} ${doMes.length === 1 ? "evento" : "eventos"} no mês`}>
                  {doMes.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum prazo neste mês.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {doMes.map(e => {
                        const Icone = ICONE_TIPO[e.tipo];
                        return (
                          <Link
                            key={e.id}
                            href={`/dashboard/compliance/obrigacoes/${e.obrigacaoId}`}
                            style={{
                              display: "flex", gap: 12, alignItems: "center", padding: "9px 10px",
                              borderRadius: 8, textDecoration: "none", color: "inherit",
                              borderLeft: `3px solid ${CORES_TIPO[e.tipo]}`,
                            }}
                          >
                            <span className="num" style={{ fontSize: 12, minWidth: 78, color: "var(--text-secondary)" }}>
                              {data(e.data)}
                            </span>
                            <Icone size={14} color={CORES_TIPO[e.tipo]} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 600, fontSize: 12.5 }}>{e.titulo}</span>
                              {e.unidade && <span style={{ color: "var(--text-secondary)", fontSize: 12.5 }}> · {e.unidade}</span>}
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {e.rotulo} · <span className="num">{e.codigo}</span> · {e.categoria.nome}
                              </div>
                            </span>
                            <span style={{ fontSize: 11, color: COR_SITUACAO[e.situacao] }}>
                              {e.diasRestantes == null ? "" : e.diasRestantes < 0
                                ? `${Math.abs(e.diasRestantes)}d atrás`
                                : `em ${e.diasRestantes}d`}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/** Grade de 6 semanas começando no domingo — sempre 42 células, sem salto de layout. */
function construirGrade(referencia: Date): { iso: string; dia: number; doMes: boolean }[] {
  const primeiro = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(inicio.getDate() - primeiro.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, dia: d.getDate(), doMes: d.getMonth() === referencia.getMonth() };
  });
}
