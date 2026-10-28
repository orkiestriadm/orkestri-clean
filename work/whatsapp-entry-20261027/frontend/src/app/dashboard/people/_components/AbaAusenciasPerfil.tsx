"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { absencesService, Ausencia, StatusAusencia, TIPOS_AUSENCIA } from "@/lib/people/absences.service";
import { requestsService, Solicitacao, StatusSolicitacao, TIPOS_SOLICITACAO } from "@/lib/people/requests.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, StatusBadge, BadgeTone,
} from "@/components/data-ui";
import { CalendarX, Inbox, ArrowRight } from "lucide-react";
import { formatarDataBR } from "@/lib/datas";

/**
 * Ausências e solicitações DESTA pessoa, dentro do perfil.
 *
 * PEOPLE_HUB_BLUEPRINT.md §8 pede as duas no perfil 360, e elas existiam
 * apenas como telas da organização: quem abria o colaborador não via as
 * ausências dele nem os pedidos que ele abriu, e precisava sair para a lista
 * geral e filtrar pelo nome.
 *
 * O filtro é no cliente porque as duas APIs são legadas e não aceitam recorte
 * por colaborador. Aceitável no volume de um perfil; se a organização crescer
 * a ponto de doer, o lugar de corrigir é o parâmetro no backend, não aqui.
 */

const STATUS_AUSENCIA: Record<StatusAusencia, { label: string; tone: BadgeTone }> = {
  PENDENTE:  { label: "Pendente",  tone: "atencao" },
  APROVADA:  { label: "Aprovada",  tone: "ok" },
  REJEITADA: { label: "Rejeitada", tone: "critico" },
  CANCELADA: { label: "Cancelada", tone: "neutro" },
};

const STATUS_SOLICITACAO: Record<StatusSolicitacao, { label: string; tone: BadgeTone }> = {
  PENDENTE:  { label: "Em análise", tone: "atencao" },
  APROVADA:  { label: "Aprovada",   tone: "ok" },
  REJEITADA: { label: "Rejeitada",  tone: "critico" },
  CANCELADA: { label: "Cancelada",  tone: "neutro" },
};

const ROTULO_TIPO_AUSENCIA = new Map(TIPOS_AUSENCIA.map(t => [t.value, t.label]));
const ROTULO_TIPO_SOLICITACAO = new Map(TIPOS_SOLICITACAO.map(t => [t.value, t.label]));

const fmtData = (d: string) =>
  formatarDataBR(d);

const contarDias = (inicio: string, fim: string) =>
  Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1;

type Props = {
  collaboratorId: string;
  /** Sem login, a pessoa não tem como abrir solicitação — o bloco some. */
  userId: string | null;
};

export default function AbaAusenciasPerfil({ collaboratorId, userId }: Props) {
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const todas = await absencesService.listar();
      setAusencias(todas.filter(a => a.collaboratorId === collaboratorId));
    } catch (e: any) {
      setAusencias([]);
      setErro(e?.response?.data?.message || "Não foi possível carregar as ausências.");
    } finally {
      setCarregando(false);
    }

    // Solicitações são do USUÁRIO, não do colaborador: quem não tem login não
    // abre pedido. `silent` porque o bloco é secundário na tela.
    if (!userId) { setSolicitacoes([]); return; }
    try {
      const todas = await requestsService.listar();
      setSolicitacoes(todas.filter(s => s.solicitante?.id === userId));
    } catch {
      setSolicitacoes([]);
    }
  }, [collaboratorId, userId]);

  useEffect(() => { carregar(); }, [carregar]);

  const COL_AUS = ["Tipo", "Período", "Dias", "Situação"];
  const COL_SOL = ["Solicitação", "Tipo", "Aberta em", "Situação"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel
        title={`AUSÊNCIAS (${ausencias.length})`}
        actions={
          <Link href="/dashboard/people/ausencias" className="btn btn-ghost">
            Ver todas <ArrowRight size={13} />
          </Link>
        }
      >
        <TableCard>
          <thead><tr>{COL_AUS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COL_AUS.length} rows={2} />
            ) : erro ? (
              <ErrorState detail={erro} onRetry={carregar} colSpan={COL_AUS.length} />
            ) : ausencias.length === 0 ? (
              <EmptyState
                colSpan={COL_AUS.length}
                icon={<CalendarX size={20} />}
                title="Nenhuma ausência registrada"
              />
            ) : (
              ausencias.map(a => {
                const s = STATUS_AUSENCIA[a.status] ?? STATUS_AUSENCIA.CANCELADA;
                return (
                  <tr key={a.id}>
                    <td>
                      {ROTULO_TIPO_AUSENCIA.get(a.tipo) ?? a.tipo}
                      {a.motivoRejeicao && (
                        <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 2 }}>
                          {a.motivoRejeicao}
                        </div>
                      )}
                    </td>
                    <td className="num">{fmtData(a.dataInicio)} a {fmtData(a.dataFim)}</td>
                    <td className="num">{contarDias(a.dataInicio, a.dataFim)}</td>
                    <td><StatusBadge label={s.label} tone={s.tone} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableCard>
      </Panel>

      <Panel title={`SOLICITAÇÕES AO RH (${solicitacoes.length})`}>
        {!userId ? (
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            Este colaborador não tem acesso ao sistema, então não abre solicitações
            por conta própria. Pedidos dele são registrados pelo RH.
          </p>
        ) : (
          <TableCard>
            <thead><tr>{COL_SOL.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {carregando ? (
                <LoadingRows colSpan={COL_SOL.length} rows={2} />
              ) : solicitacoes.length === 0 ? (
                <EmptyState
                  colSpan={COL_SOL.length}
                  icon={<Inbox size={20} />}
                  title="Nenhuma solicitação aberta"
                />
              ) : (
                solicitacoes.map(s => {
                  const st = STATUS_SOLICITACAO[s.status] ?? STATUS_SOLICITACAO.CANCELADA;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.titulo}</td>
                      <td>{ROTULO_TIPO_SOLICITACAO.get(s.tipo as any) ?? s.tipo}</td>
                      <td className="num">{fmtData(s.criadoEm)}</td>
                      <td><StatusBadge label={st.label} tone={st.tone} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </TableCard>
        )}
      </Panel>
    </div>
  );
}
