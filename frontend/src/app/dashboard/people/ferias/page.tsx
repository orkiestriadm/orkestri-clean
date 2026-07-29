"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { vacationsService, ItemPassivo } from "@/lib/people/vacations.service";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge,
} from "@/components/data-ui";
import { CalendarClock, CheckCircle2 } from "lucide-react";

/**
 * Passivo de férias.
 *
 * Quem tem período aquisitivo prestes a vencer, ou já vencido. Cada linha aqui
 * é dinheiro: passado o prazo concessivo, a CLT obriga o pagamento em dobro.
 * Por isso a ordenação é por urgência e não por nome — a lista existe para ser
 * atacada de cima para baixo.
 */

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function PassivoFeriasPage() {
  const [itens, setItens] = useState<ItemPassivo[]>([]);
  const [janela, setJanela] = useState(60);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setSemPermissao(false);
    try {
      const r = await vacationsService.passivo();
      // Vencido primeiro, depois o que vence antes.
      setItens([...r.data.periodos].sort((a, b) => a.diasParaVencer - b.diasParaVencer));
      setJanela(r.data.janelaDias);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar o passivo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const vencidos = itens.filter(i => i.diasParaVencer < 0);
  const diasVencidos = vencidos.reduce((s, i) => s + i.saldo, 0);
  const COLUNAS = ["Colaborador", "Limite para gozar", "Prazo", "Saldo", "Situação"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<CalendarClock size={19} />}
            title="Passivo de férias"
            subtitle={`Períodos vencidos ou que vencem nos próximos ${janela} dias`}
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o passivo de férias." />
          ) : (
            <>
              {vencidos.length > 0 && (
                <div
                  style={{
                    display: "flex", gap: 11, alignItems: "flex-start",
                    padding: "13px 15px", borderRadius: 14, marginBottom: 16,
                    background: "color-mix(in srgb, var(--accent-red) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-red) 24%, transparent)",
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--text-primary)" }}>
                      <span className="metric">{diasVencidos}</span> dias já vencidos
                    </strong>{" "}
                    em {vencidos.length}{" "}
                    {vencidos.length === 1 ? "colaborador" : "colaboradores"}. Esses
                    dias são devidos em dobro — agendar as férias agora não desfaz
                    o valor já acumulado, mas impede que ele cresça.
                  </div>
                </div>
              )}

              <TableCard>
                <thead>
                  <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={5} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
                  ) : itens.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<CheckCircle2 size={20} />}
                      title="Nenhum período vencendo"
                      hint={`Ninguém no seu escopo tem férias a vencer nos próximos ${janela} dias.`}
                    />
                  ) : (
                    itens.map(item => {
                      const vencido = item.diasParaVencer < 0;
                      return (
                        <tr key={item.id}>
                          <td>
                            <Link
                              href={`/dashboard/people/${item.colaborador.id}`}
                              style={{ color: "var(--accent-violet)", textDecoration: "none", fontWeight: 600 }}
                            >
                              {item.colaborador.nome}
                            </Link>
                          </td>
                          <td className="num">{fmtData(item.limiteConcessivo)}</td>
                          <td
                            className="num"
                            style={{ color: vencido ? "var(--accent-red)" : "var(--text-secondary)" }}
                          >
                            {vencido
                              ? `há ${Math.abs(item.diasParaVencer)} dias`
                              : `em ${item.diasParaVencer} dias`}
                          </td>
                          <td className="num" style={{ fontWeight: 600 }}>{item.saldo}</td>
                          <td>
                            <StatusBadge
                              label={vencido ? "Vencido" : "Vencendo"}
                              tone={vencido ? "critico" : "atencao"}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </TableCard>
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}
