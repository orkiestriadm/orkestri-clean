"use client";
export const dynamic = "force-dynamic";

/**
 * Farol da Frota — equivalente da aba "Controle" da planilha FORFT_0005.
 *
 * A planilha classifica cada veículo em Operando / Operando com Avaria /
 * Parado e pinta um `●` colorido ao lado. Esta tela reproduz essa leitura por
 * uma escada de precedência de três degraus (ver `backend/.../frota-status.ts`):
 *
 *   🔴 OS imobilizante aberta | cadastro manutencao/sinistrado
 *   🟡 OS aberta não-imobilizante | cadastro operando_com_avaria
 *      | revisão atrasada
 *   🟢 resto
 *
 * A coluna "Motivo" existe porque o amarelo tem três origens: sem dizer qual
 * acendeu, a cor não informa o que fazer.
 *
 * O gráfico de tendência é o que a planilha só conseguia empilhando um snapshot
 * da frota inteira por dia (12.374 linhas para 130 dias).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard, KpiGrid, KpiCard,
  Toolbar, SearchInput, SelectFilter, TableCard, EmptyState, LoadingRows,
} from "../_components/ui";
import {
  Activity, Truck, Wrench, AlertTriangle, Download, RefreshCw, MapPin, Clock, TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

/** Cores do farol. Tokens do design system, não os hex da planilha — precisam
 *  funcionar no tema claro e no escuro. */
const FAROL: Record<string, { cor: string; label: string; curto: string }> = {
  parado:              { cor: "var(--accent-red)",   label: "Parado",              curto: "Parados" },
  operando_com_avaria: { cor: "var(--accent-amber)", label: "Operando com Avaria", curto: "Com avaria" },
  operando:            { cor: "var(--accent-green)", label: "Operando",            curto: "Operando" },
  fora_de_operacao:    { cor: "var(--text-muted)",   label: "Fora de operação",    curto: "Fora da frota" },
};

const fmtData = (v: any) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const fmtPct = (v: any) => `${Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));

/** O `●` da planilha. `title` para quem navega por leitor de tela ou não
 *  distingue as cores — cor sozinha não pode ser o único portador do sentido. */
function FarolDot({ farol }: { farol: string }) {
  const f = FAROL[farol] || FAROL.fora_de_operacao;
  return (
    <span
      title={f.label}
      aria-label={f.label}
      style={{
        display: "inline-block", width: 11, height: 11, borderRadius: "50%",
        background: f.cor, boxShadow: `0 0 8px ${f.cor}`, flexShrink: 0,
      }}
    />
  );
}

/** Texto longo da planilha (o campo "Problema" chega a ter 2.000 caracteres). */
function Trunc({ texto, max = 90 }: { texto: string; max?: number }) {
  if (!texto) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const curto = texto.length > max ? texto.slice(0, max) + "…" : texto;
  return (
    <span title={texto} style={{ display: "inline-block", maxWidth: 340, verticalAlign: "bottom" }}>
      {curto}
    </span>
  );
}

/** Coluna do bloco congelado. A largura é travada nos três eixos porque o
 *  `left` da coluna seguinte é calculado a partir dela — se o conteúdo esticar
 *  a célula, o bloco desalinha. */
function fixa(largura: number, esquerda: number) {
  return { width: largura, minWidth: largura, maxWidth: largura, left: esquerda };
}
// Larguras medidas pelo pior caso real da base: "Operando com Avaria" e
// "ROÇADEIRA T04". Apertar mais corta o texto justamente na coluna que existe
// para dar referência.
const COL_STATUS = fixa(196, 0);
const COL_PLACA = fixa(152, 196);

/** Status como etiqueta: o ponto colorido dentro dela dispensa a coluna de
 *  34px que existia só para exibi-lo. */
function ChipStatus({ farol, texto, osAbertas }: { farol: string; texto: string; osAbertas: number }) {
  const cor = FAROL[farol]?.cor || "var(--text-muted)";
  return (
    <span className="chip-status" style={{ color: cor, background: `color-mix(in srgb, ${cor} 13%, transparent)` }}>
      <span className="ponto" style={{ background: cor }} />
      {texto}
      {osAbertas > 1 && <span style={{ opacity: .7, fontWeight: 500 }} title={`${osAbertas} OS abertas`}>({osAbertas})</span>}
    </span>
  );
}

/** O problema vem da planilha em texto corrido e chega a ~2.000 caracteres.
 *  Antes era cortado em 90 com reticências, o que escondia justamente o que a
 *  pessoa foi ler. Agora quebra linha; o teto de 6 linhas evita que uma OS
 *  antiga empurre a tabela inteira. O texto completo fica no title — e na OS,
 *  que abre com duplo clique. */
function Problema({ texto, completo }: { texto: string; completo: boolean }) {
  if (!texto) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  return (
    <span
      title={completo ? undefined : texto}
      style={{
        display: "-webkit-box", WebkitLineClamp: completo ? 40 : 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.5,
      } as any}
    >
      {texto}
    </span>
  );
}

/**
 * Para onde o duplo clique leva. SEMPRE para Manutenções -- a linha do Farol
 * fala de um problema de manutenção, e é lá que se resolve.
 *
 * Com OS, abre a OS que acendeu o farol. Sem OS, abre a tela já filtrada pelo
 * veículo: 14 dos 29 amarelos estão assim por revisão atrasada e não têm OS,
 * e os 76 verdes não têm nada aberto -- antes, nessas 90 linhas de 118, o
 * duplo clique não fazia absolutamente nada, e nada se lê como quebrado.
 */
function destinoDaLinha(l: any): string {
  if (l.manutencaoId) return `/dashboard/frota/manutencoes?os=${l.manutencaoId}`;
  return `/dashboard/frota/manutencoes?veiculo=${encodeURIComponent(l.veiculo.placa)}`;
}

export default function FarolFrotaPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dados, setDados] = useState<any>(null);
  const [historico, setHistorico] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fFarol, setFFarol] = useState("");
  const [fSetor, setFSetor] = useState("");
  const [dias, setDias] = useState("90");
  // Duas linhas mantêm a grade com altura regular; quem precisa ler a OS
  // inteira abre o texto — ou dá duplo clique e vai direto para ela.
  const [textoCompleto, setTextoCompleto] = useState(false);

  const podeExportar = hasPerms(user, "frota:relatorios");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const de = new Date(Date.now() - (Number(dias) - 1) * 86400000).toISOString().slice(0, 10);
      const ate = new Date().toISOString().slice(0, 10);
      const [f, h] = await Promise.all([
        api.get("/frota/dashboard/farol"),
        api.get("/frota/dashboard/disponibilidade-historico", { params: { from: de, to: ate }, silent: true })
          .catch(() => ({ data: null })),
      ]);
      setDados(f.data);
      setHistorico(h.data);
    } catch {
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas: any[] = dados?.linhas || [];
  const totais = dados?.totais || {
    operando: 0, operandoComAvaria: 0, parado: 0, foraDeOperacao: 0,
    totalFrota: 0, percRodando: 0, percParados: 0,
  };

  const setores = useMemo(
    () => [...new Set(linhas.map(l => l.setor).filter(Boolean))].sort(),
    [linhas],
  );

  const filtradas = useMemo(() => linhas.filter(l => {
    if (fFarol && l.farol !== fFarol) return false;
    if (fSetor && l.setor !== fSetor) return false;
    if (q) {
      const alvo = [
        l.veiculo?.placa, l.veiculo?.identificacao, l.veiculo?.modelo, l.veiculo?.marca,
        l.setor, l.problema, l.prestador, l.localizacao,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!alvo.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [linhas, q, fFarol, fSetor]);

  const exportarCsv = () => {
    if (!filtradas.length) return;
    const cols: [string, (l: any) => any][] = [
      ["Status", l => l.statusOperacional],
      ["Motivo", l => (l.origemFarol && l.origemFarol !== "nenhuma" ? l.motivoFarol : "")],
      ["Placa", l => l.veiculo?.placa || ""],
      ["Identificação", l => l.veiculo?.identificacao || ""],
      ["Modelo", l => [l.veiculo?.marca, l.veiculo?.modelo].filter(Boolean).join(" ")],
      ["Setor", l => l.setor || ""],
      ["OS", l => l.numeroOs || ""],
      ["Dt baixa", l => (l.dataBaixa ? new Date(l.dataBaixa).toLocaleDateString("pt-BR") : "")],
      ["Dias parado", l => (l.diasParado ?? "")],
      ["Prev liberação", l => (l.previsaoLiberacao ? new Date(l.previsaoLiberacao).toLocaleDateString("pt-BR") : "")],
      ["Localização", l => l.localizacao || ""],
      ["Tipo Manut", l => l.tipoManutencao || ""],
      ["Problema", l => l.problema || ""],
      ["Prestador de serviço", l => l.prestador || ""],
      ["Observação", l => l.observacao || ""],
    ];
    const linha = (vals: any[]) => vals.map(v => {
      let s = String(v ?? "");
      // Neutraliza fórmula (CSV injection) antes de abrir no Excel.
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    }).join(";");
    const csv = "﻿" + [
      linha(cols.map(c => c[0])),
      ...filtradas.map(l => linha(cols.map(c => c[1](l)))),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `farol-frota-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const serie = (historico?.pontos || []).map((p: any) => ({
    ...p,
    label: new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar />
      <main className="flex-1 overflow-y-auto page-content">
        <PageBody>
          <BackLink href="/dashboard/frota" label="Voltar para o Dashboard de Frota" />

          <PageHeader
            icon={<Activity size={22} />}
            title="Farol da Frota"
            subtitle={
              <>
                Status operacional de <span className="num">{totais.totalFrota}</span> veículos em operação
                {totais.foraDeOperacao > 0 && <> · <span className="num">{totais.foraDeOperacao}</span> fora da frota</>}
              </>
            }
            accent="var(--accent-green)"
            actions={
              <>
                <button onClick={carregar} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }} title="Recarregar">
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                {podeExportar && (
                  <button onClick={exportarCsv} className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }}>
                    <Download size={14} /> Exportar CSV
                  </button>
                )}
              </>
            }
          />

          {/* KPIs no formato do cabeçalho da planilha */}
          <KpiGrid min={190}>
            <KpiCard
              index={0} label="Rodando" valor={fmtPct(totais.percRodando)}
              icon={<TrendingUp size={18} />} color="var(--accent-green)"
              hint="Operando + Operando com Avaria, sobre a frota em operação"
            />
            <KpiCard
              index={1} label="Parados" valor={fmtPct(totais.percParados)}
              icon={<Wrench size={18} />} color="var(--accent-red)"
              hint="Veículos com OS aberta que imobiliza"
            />
            <KpiCard
              index={2} label="Frota em operação" valor={String(totais.totalFrota)}
              icon={<Truck size={18} />} color="var(--accent-cyan)"
              hint="Exclui veículos inativos e vendidos"
            />
          </KpiGrid>

          {/* Contadores que também filtram a tabela */}
          <StatGrid min={170}>
            {(["parado", "operando_com_avaria", "operando"] as const).map((k, i) => {
              const valor = k === "parado" ? totais.parado
                : k === "operando_com_avaria" ? totais.operandoComAvaria
                : totais.operando;
              return (
                <StatCard
                  key={k} index={i}
                  label={FAROL[k].label}
                  value={valor}
                  color={FAROL[k].cor}
                  total={totais.totalFrota}
                  critical={k === "parado"}
                  active={fFarol === k}
                  onClick={() => setFFarol(fFarol === k ? "" : k)}
                />
              );
            })}
          </StatGrid>

          {/* Tendência — o que a planilha só tinha empilhando snapshots */}
          {serie.length > 1 && (
            <div className="surface-card rounded-2xl border border-subtle-o shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-primary-o">Disponibilidade ao longo do tempo</h3>
                {/* Select nativo em vez de SelectFilter: aqui não existe opção
                    "sem período", e o SelectFilter sempre injeta uma vazia. */}
                <select
                  className="select-field"
                  aria-label="Período do gráfico"
                  value={dias}
                  onChange={e => setDias(e.target.value)}
                >
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="180">Últimos 180 dias</option>
                  <option value="365">Último ano</option>
                </select>
              </div>
              <div className="w-full h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} minTickGap={28} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 12 }}
                      formatter={(v: any, n: string) => [v, ({
                        operando: "Operando", operandoComAvaria: "Com avaria", parado: "Parado",
                      } as any)[n] || n]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(n) => ({ operando: "Operando", operandoComAvaria: "Com avaria", parado: "Parado" } as any)[n] || n}
                    />
                    <Area type="monotone" dataKey="operando" stackId="1" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.5} />
                    <Area type="monotone" dataKey="operandoComAvaria" stackId="1" stroke="var(--accent-amber)" fill="var(--accent-amber)" fillOpacity={0.5} />
                    <Area type="monotone" dataKey="parado" stackId="1" stroke="var(--accent-red)" fill="var(--accent-red)" fillOpacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <Toolbar>
            <SearchInput value={q} onChange={setQ} placeholder="Pesquisar por placa, identificação, problema, prestador..." />
            {setores.length > 0 && (
              <SelectFilter
                value={fSetor}
                onChange={setFSetor}
                placeholder="Todos os setores"
                options={setores.map(s => ({ value: s, label: s }))}
              />
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, color: textoCompleto ? "var(--accent-violet)" : undefined }}
              onClick={() => setTextoCompleto(v => !v)}
              title="Alterna entre resumo de 2 linhas e o texto inteiro do problema"
            >
              {textoCompleto ? "Resumir problema" : "Problema completo"}
            </button>
            {(q || fFarol || fSetor) && (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setQ(""); setFFarol(""); setFSetor(""); }}>
                Limpar filtros
              </button>
            )}
          </Toolbar>

          <TableCard>
            <thead>
              <tr>
                <th className="col-fixa" style={COL_STATUS}>Status</th>
                <th className="col-fixa col-fixa-fim" style={COL_PLACA}>Placa</th>
                <th>Motivo</th>
                <th>Identificação</th>
                <th>Modelo</th>
                <th>Setor</th>
                <th>Dt baixa</th>
                <th style={{ textAlign: "right" }}>Dias</th>
                <th>Prev. liberação</th>
                <th>Localização</th>
                <th>Problema</th>
                <th>Prestador</th>
              </tr>
            </thead>
            <tbody className="stagger">
              {loading && <LoadingRows colSpan={12} />}
              {!loading && filtradas.length === 0 && (
                <EmptyState
                  colSpan={12}
                  icon={<Truck size={20} />}
                  title="Nenhum veículo encontrado"
                  hint={q || fFarol || fSetor
                    ? "Ajuste a busca ou remova os filtros ativos."
                    : "Cadastre veículos para acompanhar o farol da frota."}
                />
              )}
              {!loading && filtradas.map(l => (
                <tr
                  key={l.veiculo.id}
                  // Duplo clique sempre abre Manutenções: com OS, na própria
                  // OS; sem OS, na tela filtrada pelo veículo. Antes só ia
                  // quando havia OS, e em 90 das 118 linhas não fazia nada.
                  onDoubleClick={() => router.push(destinoDaLinha(l))}
                  title={l.manutencaoId ? `Abrir a OS ${l.numeroOs || ""}`.trim() : `Ver manutenções de ${l.veiculo.placa}`}
                  style={{ cursor: "pointer" }}
                >
                  <td className="col-fixa" style={COL_STATUS}>
                    <ChipStatus farol={l.farol} texto={l.statusOperacional} osAbertas={l.osAbertas} />
                  </td>
                  <td className="col-fixa col-fixa-fim" style={{ ...COL_PLACA, fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                    {l.veiculo.placa}
                  </td>
                  {/* O amarelo pode vir de OS, do cadastro ou de revisão vencida.
                      Sem dizer qual, a cor não informa o que fazer. */}
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {l.origemFarol && l.origemFarol !== "nenhuma" ? l.motivoFarol : "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                    {l.veiculo.identificacao || "—"}
                  </td>
                  <td>{[l.veiculo.marca, l.veiculo.modelo].filter(Boolean).join(" ") || "—"}</td>
                  <td>{l.setor || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtData(l.dataBaixa)}</td>
                  <td className="num" style={{ textAlign: "right" }}>
                    {l.diasParado == null ? "—" : l.diasParado}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.previsaoLiberacao ? (
                      <span
                        style={{ color: l.previsaoAtrasada ? "var(--accent-red)" : undefined, fontWeight: l.previsaoAtrasada ? 600 : undefined }}
                        title={l.previsaoAtrasada ? "Previsão de liberação vencida" : undefined}
                      >
                        {l.previsaoAtrasada && <AlertTriangle size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} />}
                        {fmtData(l.previsaoLiberacao)}
                      </span>
                    ) : "—"}
                  </td>
                  <td>{l.localizacao ? <><MapPin size={12} style={{ display: "inline", marginRight: 4, verticalAlign: -1, color: "var(--text-muted)" }} />{l.localizacao}</> : "—"}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 300, maxWidth: 480 }}>
                    <Problema texto={l.problema} completo={textoCompleto} />
                  </td>
                  <td><Trunc texto={l.prestador} max={28} /></td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          {dados?.truncado && (
            <p style={{ fontSize: 12, color: "var(--accent-amber)", marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Exibindo as primeiras {linhas.length} de {dados.totalLinhas} linhas.
            </p>
          )}
        </PageBody>
      </main>
    </div>
  );
}
