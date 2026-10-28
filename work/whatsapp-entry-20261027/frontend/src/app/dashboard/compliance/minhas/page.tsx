"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import {
  PageBody, BackLink, PageHeader, KpiGrid, KpiCard, TableCard, EmptyState,
  ErrorState, LoadingRows,
} from "@/components/data-ui";
import { UserCircle, AlertTriangle, FileWarning, Clock, CheckCircle2 } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { MeuPainel, Obrigacao } from "@/lib/compliance/types";
import { data, prazoEmPalavras, SeloSituacao, Identificacao } from "../_components/comuns";

/**
 * Painel pessoal.
 *
 * SEM exigência de permissão, de propósito: é a única tela do módulo feita para
 * quem RESPONDE pela obrigação, e não para quem administra o módulo. Exigir
 * concessão do administrador para alguém ver as próprias pendências inverteria
 * o controle de acesso — e o backend já só devolve aquilo em que a pessoa está
 * nomeada como responsável.
 */
export default function MinhasObrigacoesPage() {
  const [painel, setPainel] = useState<MeuPainel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setPainel(await complianceService.meuPainel()); }
    catch (e: any) { setErro(e?.response?.data?.message ?? "Falha ao carregar as suas obrigações."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const COLUNAS = ["Obrigação", "Situação", "Iniciar renovação", "Prazo fatal", "Validade"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<UserCircle size={19} />}
            title="Minhas obrigações"
            subtitle="O que está no seu nome e o que exige a sua ação"
          />

          {erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando || !painel ? (
            <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />
          ) : painel.total === 0 ? (
            <TableCard>
              <tbody>
                <EmptyState
                  colSpan={1}
                  icon={<CheckCircle2 size={20} />}
                  title="Você não é responsável por nenhuma obrigação"
                  hint="Quem cadastra a obrigação define os responsáveis — peça para ser incluído se isto estiver errado."
                />
              </tbody>
            </TableCard>
          ) : (
            <>
              <KpiGrid min={175}>
                <KpiCard index={0} label="No seu nome" valor={painel.total} color="var(--accent-violet)" icon={<UserCircle size={16} />} />
                <KpiCard index={1} label="Vencidas" valor={painel.vencidas} color="var(--accent-red)" icon={<AlertTriangle size={16} />} />
                <KpiCard index={2} label="Prazo fatal vencido" valor={painel.prazoFatalVencido} color="var(--accent-red)" icon={<FileWarning size={16} />} />
                <KpiCard index={3} label="Renovação devida" valor={painel.renovacaoDevida} color="var(--accent-amber)" icon={<Clock size={16} />} />
              </KpiGrid>

              {painel.pendencias.length > 0 && (
                <Lista titulo={`Exigem sua ação (${painel.pendencias.length})`} itens={painel.pendencias} colunas={COLUNAS} />
              )}

              <Lista titulo={`Todas as suas obrigações (${painel.obrigacoes.length})`} itens={painel.obrigacoes} colunas={COLUNAS} />
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

function Lista({ titulo, itens, colunas }: { titulo: string; itens: Obrigacao[]; colunas: string[] }) {
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="panel__head"><span className="panel__title mono-cap">{titulo}</span></div>
      <div className="panel__body">
        <TableCard>
          <thead><tr>{colunas.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {itens.length === 0 ? (
              <EmptyState colSpan={colunas.length} title="Nada aqui" />
            ) : (
              itens.map(o => (
                <tr key={o.id}>
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
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </div>
    </section>
  );
}
