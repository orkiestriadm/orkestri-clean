"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import {
  PageBody, BackLink, PageHeader, Tabs, Toolbar, SearchInput, SelectFilter, TableCard,
  EmptyState, LoadingRows, ErrorState, PermissionDenied, StatusBadge,
} from "@/components/data-ui";
import { useAuthStore } from "@/lib/store";
import { formatarDataBR } from "@/lib/datas";
import {
  feedbackDesempenhoService, ItemFeedbackDesempenho, ETAPAS, formatarDataHora,
} from "@/lib/people/feedback-desempenho.service";
import { MessagesSquare, Plus, AlertTriangle } from "lucide-react";
import { NovoFeedback } from "./_components/ModaisFeedback";
import { TOM_STATUS } from "./_components/EtapasFeedback";

/**
 * Avaliação de Desempenho — por enquanto, só o Feedback.
 *
 * A página é do submódulo e o Feedback é a primeira aba: o modelo de avaliação
 * que vem depois entra como aba irmã, sem mudar o menu nem a rota.
 */

function pode(user: any, ...perms: string[]): boolean {
  if (user?.isMaster) return true;
  const atuais: string[] = user?.permissions ?? [];
  return atuais.includes("*") || perms.some(p => atuais.includes(p));
}

type Aba = "feedback";

export default function AvaliacaoDesempenhoPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const podeRegistrar = pode(user, "people.feedback_desempenho:registrar");

  const [aba, setAba] = useState<Aba>("feedback");
  const [itens, setItens] = useState<ItemFeedbackDesempenho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [novo, setNovo] = useState(false);

  // Abrir com ?exclusao=1 (link da notificação do RH) já filtra os pedidos.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("exclusao") === "1") setSoPendentes(true);
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      const r = await feedbackDesempenhoService.listar({ status, busca, exclusaoPendente: soPendentes });
      setItens(r.data ?? []);
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os feedbacks.");
    } finally {
      setCarregando(false);
    }
  }, [status, busca, soPendentes]);

  // Busca com pequena espera: uma requisição por tecla sobrecarregaria a lista.
  useEffect(() => {
    const t = setTimeout(carregar, busca ? 300 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca]);

  const COLUNAS = ["Colaborador", "Gestor", "Registrado em", "Reunião", "Etapa", "Ciência"];
  const pendentesExclusao = itens.filter(i => i.exclusaoPendente).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="People" />

          <PageHeader
            icon={<MessagesSquare size={19} />}
            title="Avaliação de Desempenho"
            subtitle="Feedback: registro, reunião, ciência do colaborador e encerramento."
            actions={
              podeRegistrar && (
                <button type="button" className="btn btn-primary" onClick={() => setNovo(true)}>
                  <Plus size={14} /> Registrar feedback
                </button>
              )
            }
          />

          <Tabs<Aba> active={aba} onChange={setAba} tabs={[{ id: "feedback", label: "Feedback" }]} />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver os feedbacks de desempenho." />
          ) : (
            <>
              <Toolbar>
                <SearchInput value={busca} onChange={setBusca} placeholder="Buscar colaborador ou gestor..." />
                <SelectFilter
                  value={status} onChange={setStatus} placeholder="Todas as etapas"
                  options={ETAPAS.map(e => ({ value: e.status, label: e.rotulo }))}
                />
                <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input type="checkbox" checked={soPendentes} onChange={e => setSoPendentes(e.target.checked)} />
                  Só com exclusão pendente
                </label>
              </Toolbar>

              {!soPendentes && pendentesExclusao > 0 && (
                <div
                  style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderRadius: 12, marginBottom: 14,
                    background: "color-mix(in srgb, var(--accent-amber) 9%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent)",
                    fontSize: 12.5, color: "var(--text-secondary)",
                  }}
                >
                  <AlertTriangle size={15} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                  {pendentesExclusao === 1
                    ? "1 feedback com pedido de exclusão aguardando o RH."
                    : `${pendentesExclusao} feedbacks com pedido de exclusão aguardando o RH.`}
                </div>
              )}

              <TableCard>
                <thead>
                  <tr>{COLUNAS.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={5} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
                  ) : itens.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<MessagesSquare size={20} />}
                      title={soPendentes ? "Nenhum pedido de exclusão pendente" : "Nenhum feedback registrado"}
                      hint={podeRegistrar && !soPendentes ? "Use “Registrar feedback” para começar o processo com alguém da sua equipe." : undefined}
                    />
                  ) : (
                    itens.map(f => (
                      <tr
                        key={f.id}
                        onClick={() => router.push(`/dashboard/people/avaliacao-desempenho/feedback/${f.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{f.colaborador.nome}</td>
                        <td>{f.souGestor ? "Você" : f.gestor.nome}</td>
                        <td className="num">{formatarDataBR(f.criadoEm)}</td>
                        <td className="num">{f.reuniaoInicio ? formatarDataHora(f.reuniaoInicio) : "—"}</td>
                        <td>
                          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <StatusBadge label={f.rotuloStatus} tone={TOM_STATUS[f.status]} />
                            {f.exclusaoPendente && <StatusBadge label="Exclusão pendente" tone="critico" />}
                          </span>
                        </td>
                        <td className="num">{f.cienciaEm ? formatarDataBR(f.cienciaEm) : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </TableCard>
            </>
          )}
        </PageBody>
      </div>

      <NovoFeedback
        aberto={novo}
        onFechar={() => setNovo(false)}
        onCriado={id => { setNovo(false); router.push(`/dashboard/people/avaliacao-desempenho/feedback/${id}`); }}
      />
    </div>
  );
}
