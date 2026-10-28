"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard, Toolbar, SearchInput, SelectFilter, TableCard,
  EmptyState, LoadingRows, ErrorState, PermissionDenied,
} from "@/components/data-ui";
import { ClipboardList, Plus, Download } from "lucide-react";
import { estrategicoService, ConsultaCasos } from "@/lib/estrategico/estrategico.service";
import type { Caso, Filtros, Contagens, Farol } from "@/lib/estrategico/types";
import { COR_FAROL, ROTULO_FAROL, ORDEM_FAROL } from "@/lib/estrategico/types";
import {
  BASE, pode, data, dinheiroCurto, FarolPonto, Identificacao, ProximaAcaoCelula, SeloRisco, paradoEmPalavras,
  responsavelDe, useEstreito, mensagemErro, Nota,
} from "../_components/comuns";
import CasoForm from "../_components/CasoForm";

/**
 * Carteira de assuntos estratégicos.
 *
 * Os cartões do topo são FILTROS. A ordem padrão é por gravidade (farol, depois
 * prazo da próxima ação) — a planilha ordenava por grupo, e o assunto crítico
 * ficava onde tivesse sido digitado.
 *
 * No celular a tabela vira lista de cartões: lá a pergunta é "o que eu faço
 * agora", não comparar colunas.
 */

const CHAVES_URL = ["q", "farol", "etapa", "tipo", "objetivoId", "esferaId", "grupoId", "areaId", "dependenciaId", "prioridade", "responsavelId", "recorte", "ordenar"] as const;

const RECORTES: { id: string; rotulo: string; chave: keyof Contagens; cor: string; critico?: boolean }[] = [
  { id: "sem_acao", rotulo: "Sem próxima ação", chave: "semAcao", cor: "var(--accent-amber)", critico: true },
  { id: "vencidos", rotulo: "Vencidos", chave: "vencidos", cor: "var(--accent-red)", critico: true },
  { id: "parados", rotulo: "Parados", chave: "parados", cor: "var(--accent-amber)" },
  { id: "sem_movimentacao", rotulo: "Sem andamento", chave: "semMovimentacao", cor: "var(--text-muted)" },
  { id: "sem_responsavel", rotulo: "Sem responsável", chave: "semResponsavel", cor: "var(--accent-amber)" },
  { id: "revisar", rotulo: "A revisar", chave: "revisar", cor: "var(--accent-cyan)" },
];

export default function AssuntosPage() {
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const params = useSearchParams();
  const router = useRouter();
  const estreito = useEstreito();

  const [consulta, setConsulta] = useState<ConsultaCasos | null>(null);
  const [itens, setItens] = useState<Caso[]>([]);
  const [contagens, setContagens] = useState<Contagens | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");

  const fin = pode(user, "estrategico.financeiro:ver");

  useEffect(() => {
    const inicial: ConsultaCasos = {};
    for (const k of CHAVES_URL) {
      const v = params.get(k);
      if (v) (inicial as any)[k] = v;
    }
    if (params.get("paradoDias")) inicial.paradoDias = Number(params.get("paradoDias"));
    setConsulta(inicial);
    setBusca(inicial.q ?? "");
  }, [params]);

  const carregar = useCallback(async (c: ConsultaCasos) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await estrategicoService.listar(c);
      setItens(r.itens);
      setContagens(r.contagens);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar os assuntos."));
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (consulta) carregar(consulta); }, [consulta, carregar]);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  // Busca com espera curta: digitar "COMPOR" não dispara seis consultas.
  useEffect(() => {
    if (!consulta) return;
    const t = setTimeout(() => { if ((consulta.q ?? "") !== busca) atualizar({ q: busca || undefined }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function atualizar(parcial: Partial<ConsultaCasos>) {
    const nova = { ...(consulta ?? {}), ...parcial };
    for (const [k, v] of Object.entries(nova)) if (v === undefined || v === "") delete (nova as any)[k];
    setConsulta(nova);
    const qs = new URLSearchParams(Object.entries(nova).map(([k, v]) => [k, String(v)]));
    router.replace(`${BASE}/assuntos${qs.toString() ? `?${qs}` : ""}`, { scroll: false });
  }

  const alternar = (chave: "farol" | "recorte", valor: string) =>
    atualizar({ [chave]: consulta?.[chave] === valor ? undefined : valor } as any);

  const COLUNAS = ["", "Assunto", "Etapa / status", "Próxima ação", "Responsável", "Última movimentação", "Risco", ...(fin ? ["Valor"] : [])];
  const filtrado = consulta && Object.keys(consulta).some(k => k !== "ordenar");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader
            icon={<ClipboardList size={19} />}
            title="Assuntos estratégicos"
            subtitle={contagens ? `${contagens.total} na carteira · ${contagens.ativos} em andamento` : "Carteira de assuntos acompanhados pela Diretoria"}
            actions={
              <>
                {pode(user, "estrategico.relatorio:exportar") && (
                  <button type="button" className="btn btn-ghost" onClick={() => estrategicoService.exportarRelatorio("executivo", "excel").catch(e => toast.error("Falha na exportação", mensagemErro(e, "")))}>
                    <Download size={14} /> Excel
                  </button>
                )}
                {pode(user, "estrategico.caso:criar") && (
                  <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}><Plus size={14} /> Novo assunto</button>
                )}
              </>
            }
          />

          {semPermissao ? <PermissionDenied /> : (
            <>
              {contagens && (
                <>
                  <StatGrid min={130}>
                    {ORDEM_FAROL.map((f, i) => (
                      <StatCard key={f} index={i} label={ROTULO_FAROL[f]} value={contagens.porFarol[f] ?? 0} color={COR_FAROL[f]}
                        total={contagens.total} active={consulta?.farol === f} critical={f === "vermelho"} onClick={() => alternar("farol", f)} />
                    ))}
                  </StatGrid>
                  <StatGrid min={140}>
                    {RECORTES.map((r, i) => (
                      <StatCard key={r.id} index={i + 5} label={r.rotulo} value={Number(contagens[r.chave] ?? 0)} color={r.cor}
                        active={consulta?.recorte === r.id} critical={r.critico} onClick={() => alternar("recorte", r.id)} />
                    ))}
                  </StatGrid>
                </>
              )}

              <Toolbar>
                <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por código, título, status, ação…" />
                <SelectFilter placeholder="Tipo" value={consulta?.tipo ?? ""} onChange={v => atualizar({ tipo: v || undefined })}
                  options={[{ value: "assunto", label: "Assuntos" }, { value: "oportunidade", label: "Oportunidades" }]} />
                {filtros && (
                  <>
                    <SelectFilter placeholder="Etapa" value={consulta?.etapa ?? ""} onChange={v => atualizar({ etapa: v || undefined })} options={filtros.etapas.map(e => ({ value: e.id, label: e.rotulo }))} />
                    <SelectFilter placeholder="Objetivo" value={consulta?.objetivoId ?? ""} onChange={v => atualizar({ objetivoId: v || undefined })} options={filtros.objetivos.map(o => ({ value: o.id, label: o.nome }))} />
                    <SelectFilter placeholder="Esfera" value={consulta?.esferaId ?? ""} onChange={v => atualizar({ esferaId: v || undefined })} options={filtros.esferas.map(o => ({ value: o.id, label: o.nome }))} />
                    <SelectFilter placeholder="Área" value={consulta?.areaId ?? ""} onChange={v => atualizar({ areaId: v || undefined })} options={filtros.areas.map(o => ({ value: o.id, label: o.nome }))} />
                    <SelectFilter placeholder="Aguardando" value={consulta?.dependenciaId ?? ""} onChange={v => atualizar({ dependenciaId: v || undefined })} options={filtros.dependencias.map(o => ({ value: o.id, label: o.nome }))} />
                    <SelectFilter placeholder="Prioridade" value={consulta?.prioridade ?? ""} onChange={v => atualizar({ prioridade: v || undefined })} options={filtros.prioridades.map(o => ({ value: o.id, label: o.rotulo }))} />
                  </>
                )}
                <select className="select-field" value={consulta?.ordenar ?? ""} onChange={e => atualizar({ ordenar: e.target.value || undefined })} aria-label="Ordenar">
                  <option value="">Ordenar: gravidade</option>
                  <option value="prazo">Ordenar: prazo da ação</option>
                  <option value="parado">Ordenar: mais parados</option>
                  {fin && <option value="valor">Ordenar: maior valor</option>}
                  <option value="codigo">Ordenar: código</option>
                  <option value="atualizado">Ordenar: atualizados</option>
                </select>
                {filtrado && (
                  <button type="button" className="btn btn-ghost" onClick={() => { setBusca(""); setConsulta({}); router.replace(`${BASE}/assuntos`); }}>Limpar filtros</button>
                )}
              </Toolbar>

              {consulta?.paradoDias && <Nota>Filtrando assuntos ativos sem movimentação há {consulta.paradoDias} dias ou mais.</Nota>}

              {erro ? <ErrorState detail={erro} onRetry={() => consulta && carregar(consulta)} /> : estreito ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {carregando && !itens.length ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />)
                    : itens.length === 0 ? <Nota>Nenhum assunto com esses filtros.</Nota>
                      : itens.map(c => (
                        <Link key={c.id} href={`${BASE}/assuntos/${c.id}`} className="panel" style={{ padding: 14, textDecoration: "none", color: "inherit", display: "block" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ paddingTop: 4 }}><FarolPonto farol={c.farol} /></span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Identificacao c={c} link={false} />
                              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: "4px 0 8px" }}>{c.statusTexto}</div>
                              <ProximaAcaoCelula c={c} />
                            </div>
                          </div>
                        </Link>
                      ))}
                </div>
              ) : (
                <TableCard>
                  <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>
                    {carregando && !itens.length ? <LoadingRows colSpan={COLUNAS.length} /> : itens.length === 0 ? (
                      <EmptyState colSpan={COLUNAS.length} title="Nenhum assunto encontrado" hint={filtrado ? "Ajuste ou limpe os filtros." : "Importe a planilha ou cadastre o primeiro assunto."} />
                    ) : itens.map(c => (
                      <tr key={c.id} onClick={e => { if ((e.target as HTMLElement).closest("a,button")) return; router.push(`${BASE}/assuntos/${c.id}`); }} style={{ cursor: "pointer" }}>
                        <td style={{ width: 22 }}><FarolPonto farol={c.farol as Farol} /></td>
                        <td style={{ minWidth: 220, maxWidth: 340 }}>
                          <Identificacao c={c} />
                          {c.farolMotivos[0] && <div style={{ fontSize: 11, color: c.farol === "vermelho" ? "var(--accent-red)" : "var(--text-muted)", marginTop: 2 }}>{c.farolMotivos[0].texto}</div>}
                        </td>
                        <td style={{ fontSize: 12, minWidth: 170 }}>
                          {c.etapaRotulo}
                          {c.dependenciaTexto && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.dependenciaTexto}</div>}
                        </td>
                        <td style={{ minWidth: 220, maxWidth: 320 }}><ProximaAcaoCelula c={c} /></td>
                        <td style={{ fontSize: 12 }}>{responsavelDe(c) ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                        <td className="num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {c.ultimaMovimentacaoEm ? data(c.ultimaMovimentacaoEm) : "—"}
                          <div style={{ fontSize: 10.5, color: (c.diasParado ?? 0) > 90 ? "var(--accent-red)" : "var(--text-muted)" }}>{paradoEmPalavras(c.diasParado)}</div>
                        </td>
                        <td><SeloRisco nivel={c.riscoNivel} /></td>
                        {fin && <td className="num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{c.valorPrincipal ? dinheiroCurto(c.valorPrincipal) : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </TableCard>
              )}
            </>
          )}

          <CasoForm aberto={criando} filtros={filtros} onFechar={() => setCriando(false)}
            onSalvo={c => { setCriando(false); router.push(`${BASE}/assuntos/${c.id}`); }} />
        </PageBody>
      </div>
    </div>
  );
}
