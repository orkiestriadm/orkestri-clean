"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { documentsService, Conformidade } from "@/lib/people/documents.service";
import {
  PageBody, BackLink, PageHeader, Panel, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, KpiGrid, KpiCard,
} from "@/components/data-ui";
import { ShieldCheck, FileWarning, Clock, FileCheck2 } from "lucide-react";
import { formatarDataBR } from "@/lib/datas";

/**
 * Conformidade documental.
 *
 * O indicador na tela de Indicadores diz QUANTOS documentos estão pendentes ou
 * vencendo; esta tela diz QUAIS e DE QUEM — que é o que permite agir. O
 * endpoint existia desde a Fase 4 sem nenhuma tela chamando: o número aparecia,
 * a lista por trás dele não.
 */

const ROTULO_APROVACAO: Record<string, { label: string; tone: "ok" | "atencao" | "critico" | "neutro" }> = {
  PENDENTE:  { label: "Pendentes",  tone: "atencao" },
  APROVADO:  { label: "Aprovados",  tone: "ok" },
  REJEITADO: { label: "Rejeitados", tone: "critico" },
  ARQUIVADO: { label: "Arquivados", tone: "neutro" },
};

const CATEGORIA: Record<string, string> = {
  identidade: "Identidade", contrato: "Contrato", certificado: "Certificado",
  medico: "Médico", formacao: "Formação", outro: "Outro",
};

function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

export default function ConformidadePage() {
  const user = useAuthStore(s => s.user);
  const [dados, setDados] = useState<Conformidade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await documentsService.conformidade();
      setDados(r.data);
      setSemPermissao(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar a conformidade");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const podeVer = pode(user, "people.relatorio:ver");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people/indicadores" label="Indicadores" />

          <PageHeader
            icon={<ShieldCheck size={19} />}
            title="Conformidade documental"
            subtitle="O que falta aprovar, o que está vencendo e o que perdeu o arquivo"
          />

          {semPermissao || !podeVer ? (
            <PermissionDenied hint="Conformidade documental exige a permissão de indicadores." />
          ) : carregando ? (
            <Panel title="CARREGANDO"><Texto>Consultando os documentos…</Texto></Panel>
          ) : erro ? (
            <table style={{ width: "100%" }}><tbody>
              <ErrorState detail={erro} onRetry={carregar} colSpan={1} />
            </tbody></table>
          ) : dados ? (
            <>
              <KpiGrid>
                {dados.porAprovacao.map(a => {
                  const r = ROTULO_APROVACAO[a.aprovacao] ?? { label: a.aprovacao, tone: "neutro" as const };
                  return (
                    <KpiCard
                      key={a.aprovacao}
                      label={r.label}
                      valor={a.total}
                      icon={<FileCheck2 size={14} />}
                    />
                  );
                })}
                <KpiCard
                  label={`Vencendo em ${dados.janelaDias} dias`}
                  valor={dados.vencendo.length}
                  icon={<Clock size={14} />}
                  color="var(--accent-amber)"
                />
                <KpiCard
                  label="Sem arquivo"
                  valor={dados.semArquivo.length}
                  icon={<FileWarning size={14} />}
                  color="var(--accent-amber)"
                  hint={dados.semArquivo.length > 0 ? "Precisam de reenvio — não há como recuperar pelo sistema" : undefined}
                />
              </KpiGrid>

              {dados.semArquivo.length > 0 && (
                <Panel title={`SEM ARQUIVO (${dados.semArquivo.length})`}>
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 12px" }}>
                    O cadastro existe, o arquivo não está mais no armazenamento. Estes
                    precisam ser reenviados — não há como recuperá-los pelo sistema.
                  </p>
                  <TableCard>
                    <thead>
                      <tr><th>Documento</th><th>Categoria</th><th>Colaborador</th></tr>
                    </thead>
                    <tbody>
                      {dados.semArquivo.map(d => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.titulo}</td>
                          <td>{CATEGORIA[d.categoria] ?? d.categoria}</td>
                          <td>
                            <Link
                              href={`/dashboard/people/${d.collaboratorId}`}
                              style={{ color: "var(--accent-violet)" }}
                            >
                              {d.colaborador ?? "—"}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                </Panel>
              )}

              <Panel title={`VENCENDO EM ATÉ ${dados.janelaDias} DIAS (${dados.vencendo.length})`}>
                <TableCard>
                  <thead>
                    <tr><th>Documento</th><th>Categoria</th><th>Colaborador</th><th>Validade</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {dados.vencendo.length === 0 ? (
                      <EmptyState
                        colSpan={5}
                        icon={<ShieldCheck size={20} />}
                        title="Nada vencendo na janela"
                        hint="Nenhum documento aprovado vence nos próximos dias."
                      />
                    ) : (
                      dados.vencendo.map(d => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600 }}>{d.titulo}</td>
                          <td>{CATEGORIA[d.categoria] ?? d.categoria}</td>
                          <td>
                            {d.collaborator ? (
                              <Link
                                href={`/dashboard/people/${d.collaborator.id}`}
                                style={{ color: "var(--accent-violet)" }}
                              >
                                {d.collaborator.nomeCompleto ?? d.collaborator.user?.nome ?? "—"}
                              </Link>
                            ) : "—"}
                          </td>
                          <td className="num">{formatarDataBR(d.dataValidade) ?? "—"}</td>
                          <td>
                            <StatusBadge
                              label={d.situacaoValidade === "vencido" ? "Vencido" : "Vence em breve"}
                              tone={d.situacaoValidade === "vencido" ? "critico" : "atencao"}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </TableCard>
              </Panel>
            </>
          ) : null}
        </PageBody>
      </div>
    </div>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
      {children}
    </p>
  );
}
