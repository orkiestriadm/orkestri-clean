"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { review360Service, Calibracao } from "@/lib/people/review360.service";
import {
  PageBody, BackLink, PageHeader, Panel, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, Toolbar, SelectFilter,
} from "@/components/data-ui";
import { Scale } from "lucide-react";

/**
 * Calibração — a régua de cada gestor no mesmo ciclo.
 *
 * Nota só compara quando os avaliadores usam a mesma régua, e eles nunca usam.
 * Sem esta tela, "4,2" de um gestor e "4,2" de outro são números diferentes com
 * o mesmo nome — e promoção, mérito e sucessão saem enviesados por quem avalia,
 * não por quem entrega.
 *
 * A TELA NÃO AJUSTA NOTA NENHUMA, e isso é deliberado. Reescalar por trás faria
 * a nota que a pessoa recebeu deixar de ser a que o gestor deu, e ninguém
 * conseguiria explicar a diferença numa conversa. O que ela produz é a pauta da
 * reunião entre gestores; o ajuste, se houver, é decisão deles, na avaliação.
 */

export default function CalibracaoPage() {
  const [ciclos, setCiclos] = useState<string[]>([]);
  const [ciclo, setCiclo] = useState("");
  const [dados, setDados] = useState<Calibracao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semPermissao, setSemPermissao] = useState(false);

  useEffect(() => {
    review360Service.ciclos()
      .then(r => {
        setCiclos(r.data ?? []);
        if (r.data?.length) setCiclo(r.data[0]);
        else setCarregando(false);
      })
      .catch((e: any) => {
        if (e?.response?.status === 403) setSemPermissao(true);
        setCarregando(false);
      });
  }, []);

  const carregar = useCallback(async () => {
    if (!ciclo) return;
    setCarregando(true);
    setErro("");
    try {
      const r = await review360Service.calibracao(ciclo);
      setDados(r.data);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar a calibração.");
    } finally {
      setCarregando(false);
    }
  }, [ciclo]);

  useEffect(() => { carregar(); }, [carregar]);

  if (semPermissao) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink href="/dashboard/people" label="Voltar para Pessoas" />
          <PermissionDenied />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <Topbar />
      <PageBody>
        <BackLink href="/dashboard/people" label="Voltar para Pessoas" />
        <PageHeader
          icon={<Scale size={22} />}
          title="Calibração de desempenho"
          subtitle={
            dados
              ? `${dados.totalAvaliados} avaliação(ões) finalizada(s) · média geral ${dados.mediaGeral ?? "—"}`
              : "Compare a régua de cada gestor no mesmo ciclo"
          }
        />

        <Toolbar>
          <SelectFilter
            value={ciclo}
            onChange={setCiclo}
            options={ciclos.map(c => ({ value: c, label: `Ciclo ${c}` }))}
            placeholder="Ciclo"
          />
        </Toolbar>

        {erro && <ErrorState detail={erro} onRetry={carregar} />}

        {dados && !dados.escopoOrganizacional && (
          // Sem este aviso, um gestor leria a média da própria equipe como se
          // fosse a da organização — e concluiria o oposto do que os números
          // dizem sobre a régua dele.
          <Panel>
            <p className="muted">
              Você está vendo apenas a sua equipe. A comparação entre gestores exige
              enxergar a organização inteira.
            </p>
          </Panel>
        )}

        <TableCard>
          <table>
            <caption className="sr-only">Média e distribuição de notas por gestor</caption>
            <thead>
              <tr>
                <th>Gestor</th>
                <th style={{ textAlign: "right" }}>Avaliados</th>
                <th style={{ textAlign: "right" }}>Média</th>
                <th>Régua</th>
                <th>Distribuição</th>
              </tr>
            </thead>
            <tbody>
              {carregando && <LoadingRows colSpan={5} />}

              {!carregando && (!dados || dados.gestores.length === 0) && (
                <EmptyState
                  colSpan={5}
                  icon={<Scale size={20} />}
                  title="Nenhuma avaliação finalizada neste ciclo"
                  hint="A calibração usa só o que já foi fechado — nota em rascunho ainda muda."
                />
              )}

              {!carregando && dados?.gestores.map(g => (
                <tr key={g.gestorId ?? "sem-gestor"}>
                  <td><strong>{g.gestorNome}</strong></td>
                  <td style={{ textAlign: "right" }}>{g.avaliados}</td>
                  <td style={{ textAlign: "right" }} className="metric">{g.media}</td>
                  <td>
                    <StatusBadge
                      label={rotuloDesvio(g.desvio)}
                      tone={Math.abs(g.desvio) >= 0.5 ? "atencao" : "neutro"}
                    />
                  </td>
                  <td>
                    <Barras distribuicao={g.distribuicao} total={g.avaliados} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <Panel title="Como ler">
          <p className="muted" style={{ fontSize: 13 }}>
            A <strong>régua</strong> é a distância entre a média do gestor e a média geral do
            ciclo. Desvio alto não significa erro: uma equipe pode de fato ter ido melhor
            ou pior. Significa que vale entender <em>por quê</em> antes de comparar as notas
            entre times — que é o que a reunião de calibração faz.
          </p>
        </Panel>
      </PageBody>
    </>
  );
}

/**
 * Distribuição por faixa inteira de nota.
 *
 * Cada faixa tem um TRILHO de altura fixa, e o preenchimento cresce dentro
 * dele. A primeira versão desenhava só a barra preenchida, com 2px de mínimo
 * para a faixa vazia — que na prática somia, e a coluna parecia ter duas
 * faixas em vez de cinco. Uma distribuição em que não dá para ver as faixas
 * vazias não é uma distribuição: é um par de barras soltas.
 *
 * A escala vai embaixo pelo mesmo motivo — sem ela, não há como saber que a
 * barra da direita é a nota 5 sem passar o mouse.
 */
const ALTURA_BARRA = 26;

function Barras({ distribuicao, total }: { distribuicao: number[]; total: number }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <span style={{ display: "flex", gap: 3, alignItems: "flex-end", height: ALTURA_BARRA }}>
        {distribuicao.map((q, i) => (
          <span
            key={i}
            title={`Nota ${i + 1}: ${q} ${q === 1 ? "pessoa" : "pessoas"}`}
            style={{
              width: 14, height: ALTURA_BARRA,
              display: "flex", alignItems: "flex-end",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 3, overflow: "hidden",
            }}
          >
            <span
              style={{
                width: "100%",
                // Mínimo de 4px quando há alguém: uma pessoa em cinquenta não
                // pode desenhar uma barra de altura zero e sumir da conta.
                height: q > 0 && total > 0 ? Math.max(4, (q / total) * ALTURA_BARRA) : 0,
                background: "var(--accent-violet)",
              }}
            />
          </span>
        ))}
      </span>
      <span style={{ display: "flex", gap: 3 }}>
        {distribuicao.map((_, i) => (
          <span
            key={i}
            className="muted"
            style={{ width: 14, fontSize: 9, textAlign: "center", lineHeight: 1 }}
          >
            {i + 1}
          </span>
        ))}
      </span>
    </span>
  );
}

function rotuloDesvio(d: number): string {
  if (d === 0) return "na média";
  return d > 0 ? `+${d} acima` : `${d} abaixo`;
}
