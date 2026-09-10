"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { PageBody, BackLink, PageHeader, ErrorState, PermissionDenied } from "@/components/data-ui";
import { Lightbulb, Plus } from "lucide-react";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { Caso, Filtros, CasoDetalhe } from "@/lib/estrategico/types";
import { BASE, pode, dinheiroCurto, FarolPonto, SemAcao, prazoEmPalavras, Nota, mensagemErro, LINK_DISCRETO } from "../_components/comuns";
import CasoForm from "../_components/CasoForm";

/**
 * Pipeline de oportunidades (seção 12 do plano).
 *
 * Uma oportunidade nasce antes de ser pleito formal. Cada coluna é um estágio;
 * o potencial somado por coluna responde "o que pode virar dinheiro".
 * Enquanto está antes do protocolo, o farol é azul — estruturação, não alerta.
 */
export default function OportunidadesPage() {
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const [itens, setItens] = useState<Caso[] | null>(null);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);
  const fin = pode(user, "estrategico.financeiro:ver");
  const podeMover = pode(user, "estrategico.caso:editar");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await estrategicoService.listar({ tipo: "oportunidade" });
      setItens(r.itens.filter(c => c.etapa !== "cancelado"));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(mensagemErro(e, "Falha ao carregar as oportunidades."));
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { estrategicoService.filtros().then(setFiltros).catch(() => {}); }, []);

  async function mover(c: Caso, estagio: string) {
    try {
      await estrategicoService.atualizar(c.id, { estagioOportunidade: estagio });
      toast.success(`${c.codigo} movida para ${filtros?.pipeline.find(p => p.id === estagio)?.rotulo}`);
      carregar();
    } catch (e) { toast.error("Não foi possível mover", mensagemErro(e, "")); }
  }

  const estagios = filtros?.pipeline ?? [];
  const potencial = (lista: Caso[]) => lista.reduce((s, c) => s + (c.valorPotencial ?? c.valorPretendido ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href={BASE} label="Painel estratégico" />
          <PageHeader
            icon={<Lightbulb size={19} />}
            title="Oportunidades"
            subtitle={itens ? `${itens.length} no pipeline${fin && potencial(itens) ? ` · potencial informado ${dinheiroCurto(potencial(itens))}` : ""}` : "Identificada → Em estudo → … → Reconhecida → Realizada"}
            actions={pode(user, "estrategico.caso:criar") ? <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}><Plus size={14} /> Nova oportunidade</button> : undefined}
          />
          {semPermissao ? <PermissionDenied /> : erro ? <ErrorState detail={erro} onRetry={carregar} /> : !itens || !filtros ? (
            <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          ) : (
            <>
              {itens.length === 0 && <Nota>Nenhuma oportunidade cadastrada.</Nota>}
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}>
                {estagios.map(e => {
                  const coluna = itens.filter(c => (c.estagioOportunidade ?? "identificada") === e.id);
                  return (
                    <section key={e.id} className="panel" style={{ minWidth: 230, width: 230, flexShrink: 0, padding: 10 }}>
                      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span className="mono-cap" style={{ fontSize: 11 }}>{e.rotulo}</span>
                        <span className="metric" style={{ fontSize: 13 }}>{coluna.length}</span>
                      </header>
                      {fin && <div className="metric" style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>{potencial(coluna) ? dinheiroCurto(potencial(coluna)) : "—"}</div>}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {coluna.map(c => (
                          <article key={c.id} style={{ padding: 10, borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                              <span style={{ paddingTop: 3 }}><FarolPonto farol={c.farol} tamanho={8} /></span>
                              <Link href={`${BASE}/assuntos/${c.id}`} style={{ ...LINK_DISCRETO, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{c.titulo}</Link>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0" }}>{c.codigo} · {c.etapaRotulo}</div>
                            <div style={{ fontSize: 11.5 }}>
                              {c.semProximaAcao ? <SemAcao compacto /> : <>{c.proximaAcao}{c.proximaAcaoPrazo ? <span style={{ color: c.acaoVencida ? "var(--accent-red)" : "var(--text-muted)" }}> · {prazoEmPalavras(c.diasProximaAcao)}</span> : null}</>}
                            </div>
                            {fin && (c.valorPotencial ?? c.valorPretendido) != null && <div className="metric" style={{ fontSize: 12, marginTop: 4 }}>{dinheiroCurto(c.valorPotencial ?? c.valorPretendido)}</div>}
                            {podeMover && (
                              <select className="select-field" style={{ width: "100%", marginTop: 6, fontSize: 11.5 }} value={c.estagioOportunidade ?? "identificada"} onChange={ev => mover(c, ev.target.value)} aria-label={`Estágio de ${c.titulo}`}>
                                {estagios.map(x => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                              </select>
                            )}
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
          <CasoForm
            aberto={criando}
            caso={null}
            filtros={filtros}
            onFechar={() => setCriando(false)}
            onSalvo={(c: CasoDetalhe) => { setCriando(false); window.location.href = `${BASE}/assuntos/${c.id}`; }}
          />
        </PageBody>
      </div>
    </div>
  );
}
