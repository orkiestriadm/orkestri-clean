"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useEmployees } from "@/hooks/useEmployees";
import {
  ColaboradorLista, FiltrosColaboradores, StatusColaborador,
} from "@/lib/people/employees.service";
import {
  PageBody, PageHeader, Toolbar, SearchInput, SelectFilter,
  TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  Pagination, StatusBadge, BadgeTone,
} from "@/components/data-ui";
import {
  Users, ArrowUpDown, UserX, Plus, CalendarClock, Briefcase, Library, BarChart3, Route,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import ColaboradorForm from "./_components/ColaboradorForm";
import { formatarDataBR } from "@/lib/datas";

/* ── Vocabulário de situação ───────────────────────────────────
   Rótulo e tom em um lugar só: a mesma situação precisa aparecer
   igual na lista, no perfil e em relatório. */
const SITUACAO: Record<StatusColaborador, { label: string; tone: BadgeTone }> = {
  ATIVO:     { label: "Ativo",     tone: "ok" },
  AFASTADO:  { label: "Afastado",  tone: "atencao" },
  SUSPENSO:  { label: "Suspenso",  tone: "atencao" },
  INATIVO:   { label: "Inativo",   tone: "neutro" },
  DESLIGADO: { label: "Desligado", tone: "critico" },
};

const OPCOES_SITUACAO = (Object.keys(SITUACAO) as StatusColaborador[])
  .map(s => ({ value: s, label: SITUACAO[s].label }));

const COLUNAS: { chave: string; label: string; ordenavel?: boolean }[] = [
  { chave: "nomeCompleto", label: "Colaborador", ordenavel: true },
  { chave: "cargo",        label: "Cargo",       ordenavel: true },
  { chave: "setor",        label: "Setor" },
  { chave: "gestor",       label: "Gestor" },
  { chave: "status",       label: "Situação",    ordenavel: true },
  { chave: "dataAdmissao", label: "Admissão",    ordenavel: true },
];

const fmtData = (d: string | null) =>
  d ? formatarDataBR(d) : null;

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

/**
 * Espelha a checagem do backend. Aqui é só para não oferecer um botão que vai
 * falhar — a autorização real é do servidor (FRONTEND.md §21).
 * A permissão legada vale: o guard traduz `colaboradores:criar`.
 */
function podeCriar(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*")
    || perms.includes("people.colaborador:criar")
    || perms.includes("colaboradores:criar");
}

/** Benefícios e cursos moram na mesma tela; ver qualquer um a justifica. */
function podeVerCatalogos(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*")
    || perms.includes("people.beneficio:ver")
    || perms.includes("people.treinamento:ver");
}

function podeVerRelatorio(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes("people.relatorio:ver");
}

/** O catálogo de cargos é da organização — basta poder consultá-lo. */
function podeVerCargos(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes("people.cargo:ver");
}

/**
 * O passivo é uma visão sobre o quadro inteiro, não sobre uma pessoa — por isso
 * o backend o protege com `people.relatorio:ver` e não com `people.ferias:ver`.
 * Espelhar exatamente evita oferecer um link que responderia 403.
 */
function podeVerPassivo(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes("people.relatorio:ver");
}

function podeVerCarreira(user: any): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes("people.carreira:ver");
}

export default function ColaboradoresPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const [formAberto, setFormAberto] = useState(false);

  const [busca, setBusca] = useState("");
  const [buscaDebounced, setBuscaDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [setorId, setSetorId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [ordenarPor, setOrdenarPor] = useState("nomeCompleto");
  const [direcao, setDirecao] = useState<"asc" | "desc">("asc");
  const [setores, setSetores] = useState<{ value: string; label: string }[]>([]);

  // Sem debounce, cada tecla vira uma requisição e o servidor responde
  // fora de ordem para buscas longas.
  useEffect(() => {
    const t = setTimeout(() => { setBuscaDebounced(busca); setPagina(1); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Combo de apoio: se o perfil não tem acesso, a tela continua utilizável sem
  // ele — por isso `silent`.
  //
  // Sai do QUADRO, não do catálogo `/setores`. O catálogo devolve apenas os
  // `ativo: true`, e setor inativo com gente dentro é comum — desativar serve
  // para não alocar ninguém novo, não para esconder quem já está lá. Montado a
  // partir dele, o filtro deixava 10 de 18 pessoas infiltráveis: a coluna
  // mostrava o setor e a lista de filtros não o oferecia.
  useEffect(() => {
    // `r.data` é o corpo da resposta, e o People envolve tudo em
    // `{ success, data }` — daí o `data.data`. O `/setores` legado devolvia o
    // array cru, e copiar a forma dele deixava a lista silenciosamente vazia.
    api.get("/v1/people/employees/filtros", { silent: true })
      .then(r => setSetores((r.data?.data?.setores ?? []).map((s: any) => ({ value: s.id, label: s.nome }))))
      .catch(() => setSetores([]));
  }, []);

  const filtros: FiltrosColaboradores = useMemo(() => ({
    busca: buscaDebounced || undefined,
    status: (status as StatusColaborador) || undefined,
    setorId: setorId || undefined,
    pagina,
    tamanho: 25,
    ordenarPor,
    direcao,
  }), [buscaDebounced, status, setorId, pagina, ordenarPor, direcao]);

  const { itens, meta, carregando, erro, semPermissao, recarregar } = useEmployees(filtros);

  function ordenar(chave: string) {
    if (ordenarPor === chave) {
      setDirecao(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrdenarPor(chave);
      setDirecao("asc");
    }
    setPagina(1);
  }

  function limparFiltros() {
    setBusca(""); setStatus(""); setSetorId(""); setPagina(1);
  }

  const temFiltro = !!(buscaDebounced || status || setorId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <PageHeader
            icon={<Users size={19} />}
            title="Colaboradores"
            subtitle="Quadro de pessoas da organização"
            actions={
              <>
                {podeVerRelatorio(user) && (
                  <Link href="/dashboard/people/indicadores" className="btn btn-ghost">
                    <BarChart3 size={14} /> Indicadores
                  </Link>
                )}
                {podeVerCatalogos(user) && (
                  <Link href="/dashboard/people/catalogos" className="btn btn-ghost">
                    <Library size={14} /> Catálogos
                  </Link>
                )}
                {podeVerCargos(user) && (
                  <Link href="/dashboard/people/cargos" className="btn btn-ghost">
                    <Briefcase size={14} /> Cargos
                  </Link>
                )}
                {podeVerCarreira(user) && (
                  <Link href="/dashboard/people/carreira" className="btn btn-ghost">
                    <Route size={14} /> Carreira
                  </Link>
                )}
                {podeVerPassivo(user) && (
                  <Link href="/dashboard/people/ferias" className="btn btn-ghost">
                    <CalendarClock size={14} /> Passivo de férias
                  </Link>
                )}
                {podeCriar(user) && (
                  <button type="button" className="btn btn-primary" onClick={() => setFormAberto(true)}>
                    <Plus size={14} /> Novo colaborador
                  </button>
                )}
              </>
            }
          />

          <Toolbar>
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Nome, matrícula, e-mail ou cargo..."
            />
            <SelectFilter
              value={status}
              onChange={v => { setStatus(v); setPagina(1); }}
              options={OPCOES_SITUACAO}
              placeholder="Todas as situações"
            />
            {setores.length > 0 && (
              <SelectFilter
                value={setorId}
                onChange={v => { setSetorId(v); setPagina(1); }}
                options={setores}
                placeholder="Todos os setores"
              />
            )}
          </Toolbar>

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o quadro de colaboradores." />
          ) : (
            <>
              <TableCard>
                <thead>
                  <tr>
                    {COLUNAS.map(col => (
                      <th key={col.chave}>
                        {col.ordenavel ? (
                          <button
                            type="button"
                            onClick={() => ordenar(col.chave)}
                            aria-label={`Ordenar por ${col.label}`}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: "none", border: "none", cursor: "pointer",
                              font: "inherit", color: ordenarPor === col.chave ? "var(--accent-violet)" : "inherit",
                              padding: 0,
                            }}
                          >
                            {col.label}
                            <ArrowUpDown size={11} style={{ opacity: ordenarPor === col.chave ? 1 : 0.35 }} />
                          </button>
                        ) : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={6} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
                  ) : itens.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      title={temFiltro ? "Nenhum colaborador para estes filtros" : "Nenhum colaborador cadastrado"}
                      hint={temFiltro ? "Ajuste ou limpe os filtros para ver mais resultados." : undefined}
                    />
                  ) : (
                    itens.map(c => <LinhaColaborador key={c.id} colaborador={c} onAbrir={() => router.push(`/dashboard/people/${c.id}`)} />)
                  )}
                </tbody>
              </TableCard>

              {!carregando && !erro && (
                <Pagination
                  pagina={meta.pagina}
                  paginas={meta.paginas}
                  total={meta.total}
                  onChange={setPagina}
                />
              )}

              {temFiltro && !carregando && itens.length === 0 && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={limparFiltros}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 12, color: "var(--accent-violet)",
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </>
          )}
          <ColaboradorForm
            aberto={formAberto}
            onFechar={() => setFormAberto(false)}
            onSalvo={recarregar}
          />
        </PageBody>
      </div>
    </div>
  );
}

function LinhaColaborador({ colaborador, onAbrir }: { colaborador: ColaboradorLista; onAbrir: () => void }) {
  const situacao = SITUACAO[colaborador.status] ?? SITUACAO.INATIVO;
  const gestor = colaborador.gestor?.nomeCompleto || colaborador.gestor?.user?.nome;

  return (
    // Sem `role="link"`: a ARIA não prevê essa combinação em <tr> e cada leitor
    // de tela trata de um jeito. A linha é um atalho de mouse; o caminho
    // acessível é o link no nome, abaixo.
    <tr
      onClick={onAbrir}
      style={{ cursor: "pointer" }}
    >
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              display: "grid", placeItems: "center", flexShrink: 0,
              width: 32, height: 32, borderRadius: 10, overflow: "hidden",
              background: "var(--bg-hover)", color: "var(--text-muted)",
              fontSize: 11, fontWeight: 700,
            }}
            aria-hidden
          >
            {colaborador.fotoUrl
              ? <img src={colaborador.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : iniciais(colaborador.nomeExibicao)}
          </span>
          <div style={{ minWidth: 0 }}>
            <Link
              href={`/dashboard/people/${colaborador.id}`}
              onClick={e => e.stopPropagation()}
              style={{
                fontWeight: 600, color: "inherit", textDecoration: "none",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                display: "block",
              }}
            >
              {colaborador.nomeExibicao}
            </Link>
            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              {colaborador.matricula && <span className="num">{colaborador.matricula}</span>}
              {/* Sem login o colaborador nunca aponta horas: a utilização 0%
                  nos relatórios é esperada, não ociosidade. */}
              {!colaborador.userId && (
                <span title="Sem acesso ao sistema" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <UserX size={10} /> sem acesso
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td>{colaborador.position?.titulo || colaborador.cargo || "—"}</td>
      <td>
        {colaborador.setor ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: colaborador.setor.cor || "var(--text-muted)",
            }} />
            {colaborador.setor.nome}
          </span>
        ) : "—"}
      </td>
      <td>{gestor || "—"}</td>
      <td><StatusBadge label={situacao.label} tone={situacao.tone} /></td>
      <td className="num">{fmtData(colaborador.dataAdmissao) || "—"}</td>
    </tr>
  );
}
