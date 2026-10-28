"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, StatGrid, StatCard, Toolbar, SearchInput,
  SelectFilter, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  Pagination, RowActions, RowAction,
} from "@/components/data-ui";
import {
  ListChecks, Plus, Download, Star, RefreshCw, Stamp, Pencil, Trash2,
} from "lucide-react";
import { complianceService, ConsultaObrigacoes } from "@/lib/compliance/compliance.service";
import type { Obrigacao, Filtros, SituacaoPrazo } from "@/lib/compliance/types";
import { ROTULO_STATUS, ROTULO_CRITICIDADE } from "@/lib/compliance/types";
import {
  pode, data, prazoEmPalavras, SeloSituacao, SeloCriticidade, Identificacao,
} from "../_components/comuns";
import ObrigacaoForm from "../_components/ObrigacaoForm";
import RenovarModal from "../_components/RenovarModal";
import ProtocoloModal from "../_components/ProtocoloModal";
import ObrigacaoModal from "../_components/ObrigacaoModal";

/**
 * Carteira de obrigações.
 *
 * Os cartões do topo são FILTROS, não enfeite: clicar em "Vencidas" filtra a
 * lista. É a resposta ao que a planilha não tinha — lá, descobrir quais itens
 * estavam com o prazo estourado exigia ler as 36 linhas uma a uma.
 */

const SITUACOES: { id: SituacaoPrazo; rotulo: string; cor: string; critico?: boolean }[] = [
  { id: "vencida",             rotulo: "Vencidas",          cor: "var(--accent-red)",    critico: true },
  { id: "prazo_fatal_vencido", rotulo: "Prazo fatal",       cor: "var(--accent-red)",    critico: true },
  { id: "renovacao_devida",    rotulo: "Renovação devida",  cor: "var(--accent-amber)",  critico: true },
  { id: "vigente",             rotulo: "Vigentes",          cor: "var(--accent-green)" },
  { id: "prorrogada",          rotulo: "Prorrogadas",       cor: "var(--accent-cyan)" },
];

export default function ObrigacoesPage() {
  const user = useAuthStore(s => s.user);
  const params = useSearchParams();

  const [consulta, setConsulta] = useState<ConsultaObrigacoes>({ pagina: 1, limite: 25 });
  const [lista, setLista] = useState<Obrigacao[]>([]);
  const [total, setTotal] = useState(0);
  const [paginas, setPaginas] = useState(1);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [editando, setEditando] = useState<Obrigacao | null>(null);
  const [criando, setCriando] = useState(false);
  const [renovando, setRenovando] = useState<Obrigacao | null>(null);
  const [protocolando, setProtocolando] = useState<Obrigacao | null>(null);
  /** Duplo clique na linha abre o detalhe completo sem perder a lista. */
  const [aberta, setAberta] = useState<string | null>(null);

  const podeCriar = pode(user, "compliance.obrigacao:criar");
  const podeEditar = pode(user, "compliance.obrigacao:editar");
  const podeExcluir = pode(user, "compliance.obrigacao:excluir");
  const podeRenovar = pode(user, "compliance.obrigacao:renovar");
  const podeExportar = pode(user, "compliance.obrigacao:exportar");

  // A URL manda no filtro inicial: o painel e os alertas linkam para cá já
  // filtrados, e perder isso ao chegar tornaria os links inúteis.
  useEffect(() => {
    const inicial: ConsultaObrigacoes = { pagina: 1, limite: 25 };
    for (const chave of ["situacao", "categoriaId", "status", "criticidade", "unidade", "tag", "de", "ate", "q"] as const) {
      const v = params.get(chave);
      if (v) (inicial as any)[chave] = v;
    }
    if (params.get("venceEmDias")) inicial.venceEmDias = Number(params.get("venceEmDias"));
    if (params.get("favoritos") === "true") inicial.favoritos = true;
    setConsulta(inicial);
  }, [params]);

  const carregar = useCallback(async (c: ConsultaObrigacoes) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await complianceService.listar(c);
      setLista(r.itens);
      setTotal(r.total);
      setPaginas(r.paginas);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar as obrigações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(consulta); }, [consulta, carregar]);

  useEffect(() => {
    complianceService.filtros().then(setFiltros).catch(() => { /* combo vazio é aceitável */ });
  }, []);

  /**
   * Contagem por situação para os cartões.
   *
   * Uma consulta por situação, só do total — não traz linha nenhuma. Contar a
   * partir da página atual daria números errados assim que houvesse paginação.
   */
  const recontar = useCallback(async () => {
    const semSituacao = { ...consulta, situacao: undefined, pagina: 1, limite: 1 };
    const resultados = await Promise.all(
      SITUACOES.map(s =>
        complianceService.listar({ ...semSituacao, situacao: s.id })
          .then(r => [s.id, r.total] as const)
          .catch(() => [s.id, 0] as const)),
    );
    setContagens(Object.fromEntries(resultados));
  }, [consulta.q, consulta.categoriaId, consulta.status, consulta.criticidade, consulta.unidade, consulta.tag, consulta.favoritos]);

  useEffect(() => { recontar(); }, [recontar]);

  const universo = useMemo(
    () => Object.values(contagens).reduce((s, n) => s + n, 0),
    [contagens],
  );

  function aplicar(mudanca: Partial<ConsultaObrigacoes>) {
    setConsulta(c => ({ ...c, ...mudanca, pagina: mudanca.pagina ?? 1 }));
  }

  async function favoritar(o: Obrigacao) {
    try {
      const { favorito } = await complianceService.favoritar(o.id);
      setLista(l => l.map(x => (x.id === o.id ? { ...x, favorito } : x)));
    } catch { /* interceptor */ }
  }

  async function excluir(o: Obrigacao) {
    if (!confirm(`Excluir a obrigação ${o.codigo} — ${o.nome}?\n\nO registro sai das telas mas fica guardado para auditoria.`)) return;
    try {
      await complianceService.excluir(o.id);
      useToastStore.getState().success("Obrigação excluída");
      carregar(consulta);
      recontar();
    } catch { /* interceptor */ }
  }

  async function exportar(formato: "excel" | "pdf" | "csv") {
    try {
      const { truncado } = await complianceService.exportar(formato, consulta);
      if (truncado) {
        useToastStore.getState().warning(
          "Exportação parcial",
          "O arquivo traz as primeiras 10.000 linhas. Refine os filtros para exportar o restante.",
        );
      } else {
        useToastStore.getState().success("Exportação concluída");
      }
    } catch { /* interceptor */ }
  }

  const COLUNAS = [
    "", "Obrigação", "Situação", "Criticidade", "Prazo interno", "Prazo fatal", "Validade", "Status", "",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<ListChecks size={19} />}
            title="Obrigações"
            subtitle="Licenças, autorizações, laudos, certificados e contratos com prazo"
            actions={
              <>
                {podeExportar && (
                  <>
                    <button type="button" className="btn btn-ghost" onClick={() => exportar("excel")}>
                      <Download size={14} /> Excel
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => exportar("pdf")}>
                      <Download size={14} /> PDF
                    </button>
                  </>
                )}
                {podeCriar && (
                  <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                    <Plus size={14} /> Nova obrigação
                  </button>
                )}
              </>
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver as obrigações." />
          ) : (
            <>
              <StatGrid min={165}>
                {SITUACOES.map((s, i) => (
                  <StatCard
                    key={s.id}
                    index={i}
                    label={s.rotulo}
                    value={contagens[s.id] ?? 0}
                    color={s.cor}
                    total={universo}
                    critical={s.critico}
                    active={consulta.situacao === s.id}
                    onClick={() => aplicar({ situacao: consulta.situacao === s.id ? undefined : s.id })}
                  />
                ))}
              </StatGrid>

              <Toolbar>
                <SearchInput
                  value={consulta.q ?? ""}
                  onChange={v => aplicar({ q: v })}
                  placeholder="Nome, código, número do documento, unidade, série…"
                />
                <SelectFilter
                  value={consulta.categoriaId ?? ""}
                  onChange={v => aplicar({ categoriaId: v })}
                  placeholder="Categoria"
                  options={(filtros?.categorias ?? []).map(c => ({ value: c.id, label: `${c.nome} (${c.total})` }))}
                />
                <SelectFilter
                  value={consulta.unidade ?? ""}
                  onChange={v => aplicar({ unidade: v })}
                  placeholder="Unidade"
                  options={(filtros?.unidades ?? []).map(u => ({ value: u, label: u }))}
                />
                <SelectFilter
                  value={consulta.status ?? ""}
                  onChange={v => aplicar({ status: v })}
                  placeholder="Status"
                  options={Object.entries(ROTULO_STATUS).map(([value, label]) => ({ value, label }))}
                />
                <SelectFilter
                  value={consulta.criticidade ?? ""}
                  onChange={v => aplicar({ criticidade: v })}
                  placeholder="Criticidade"
                  options={Object.entries(ROTULO_CRITICIDADE).map(([value, label]) => ({ value, label }))}
                />
                <SelectFilter
                  value={String(consulta.venceEmDias ?? "")}
                  onChange={v => aplicar({ venceEmDias: v ? Number(v) : undefined })}
                  placeholder="Janela de vencimento"
                  options={[
                    { value: "7", label: "Vence em 7 dias" },
                    { value: "30", label: "Vence em 30 dias" },
                    { value: "90", label: "Vence em 90 dias" },
                    { value: "180", label: "Vence em 180 dias" },
                  ]}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  data-active={consulta.favoritos ? "true" : "false"}
                  onClick={() => aplicar({ favoritos: !consulta.favoritos })}
                  title="Mostrar apenas os meus favoritos"
                >
                  <Star size={14} fill={consulta.favoritos ? "currentColor" : "none"} /> Favoritos
                </button>
              </Toolbar>

              <TableCard>
                <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={6} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={() => carregar(consulta)} colSpan={COLUNAS.length} />
                  ) : lista.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<ListChecks size={20} />}
                      title="Nenhuma obrigação encontrada"
                      hint={
                        consulta.situacao || consulta.q || consulta.categoriaId
                          ? "Nenhum registro casa com os filtros aplicados."
                          : podeCriar ? "Cadastre a primeira obrigação para começar a acompanhar prazos." : undefined
                      }
                    />
                  ) : (
                    lista.map(o => (
                      <tr
                        key={o.id}
                        onDoubleClick={() => setAberta(o.id)}
                        /* Enter abre também: quem navega por teclado não tem
                           duplo clique. A linha entra na ordem de tabulação. */
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === "Enter" && e.currentTarget === e.target) setAberta(o.id);
                        }}
                        title="Duplo clique para abrir"
                        style={{ cursor: "pointer" }}
                      >
                        <td style={{ width: 30 }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title={o.favorito ? "Remover dos favoritos" : "Favoritar"}
                            aria-label={o.favorito ? "Remover dos favoritos" : "Favoritar"}
                            onClick={() => favoritar(o)}
                          >
                            <Star
                              size={13}
                              fill={o.favorito ? "var(--accent-amber)" : "none"}
                              color={o.favorito ? "var(--accent-amber)" : "currentColor"}
                            />
                          </button>
                        </td>
                        <td><Identificacao o={o} /></td>
                        <td><SeloSituacao o={o} /></td>
                        <td><SeloCriticidade nivel={o.criticidade} /></td>
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
                        <td style={{ fontSize: 12 }}>{ROTULO_STATUS[o.status]}</td>
                        <td>
                          <RowActions>
                            {podeRenovar && (
                              <>
                                <RowAction tone="view" title="Renovar" onClick={() => setRenovando(o)}>
                                  <RefreshCw size={13} />
                                </RowAction>
                                <RowAction tone="view" title="Registrar protocolo" onClick={() => setProtocolando(o)}>
                                  <Stamp size={13} />
                                </RowAction>
                              </>
                            )}
                            {podeEditar && (
                              <RowAction tone="edit" title="Editar" onClick={() => setEditando(o)}>
                                <Pencil size={13} />
                              </RowAction>
                            )}
                            {podeExcluir && (
                              <RowAction tone="danger" title="Excluir" onClick={() => excluir(o)}>
                                <Trash2 size={13} />
                              </RowAction>
                            )}
                          </RowActions>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </TableCard>

              <Pagination
                pagina={consulta.pagina ?? 1}
                paginas={paginas}
                total={total}
                onChange={p => setConsulta(c => ({ ...c, pagina: p }))}
              />
            </>
          )}
        </PageBody>
      </div>

      <ObrigacaoForm
        aberto={criando || !!editando}
        obrigacao={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={() => { carregar(consulta); recontar(); }}
      />
      <RenovarModal
        obrigacao={renovando}
        onFechar={() => setRenovando(null)}
        onSalvo={() => { carregar(consulta); recontar(); }}
      />
      <ProtocoloModal
        obrigacao={protocolando}
        onFechar={() => setProtocolando(null)}
        onSalvo={() => { carregar(consulta); recontar(); }}
      />
      <ObrigacaoModal
        obrigacaoId={aberta}
        user={user}
        onFechar={() => setAberta(null)}
        onMudou={() => { carregar(consulta); recontar(); }}
        /* Renovar e protocolar saem do detalhe para o seu próprio passo: são
           operações com regra e confirmação próprias, não edição de campo. */
        onRenovar={o => { setAberta(null); setRenovando(o); }}
        onProtocolar={o => { setAberta(null); setProtocolando(o); }}
      />
    </div>
  );
}
