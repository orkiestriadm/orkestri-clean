"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  benefitsService, Beneficio, CATEGORIAS_BENEFICIO, CategoriaBeneficio,
} from "@/lib/people/benefits.service";
import { developmentService, Curso } from "@/lib/people/development.service";
import {
  PageBody, BackLink, PageHeader, Tabs, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Library, Plus, Pencil, Trash2, Power, PowerOff, Gift, GraduationCap } from "lucide-react";
import CatalogoChecklists from "../_components/CatalogoChecklists";

/**
 * Catálogos da organização: benefícios e cursos.
 *
 * Os dois vivem na mesma tela porque são a mesma tarefa administrativa — "o
 * que a empresa oferece" — e separá-los em duas páginas obrigaria o RH a
 * lembrar de dois caminhos para o mesmo tipo de manutenção.
 */

function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

const fmtMoeda = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_CATEGORIA = new Map(CATEGORIAS_BENEFICIO.map(c => [c.value, c.label]));

type AbaCatalogo = "beneficios" | "cursos" | "checklists";

export default function CatalogosPage() {
  const user = useAuthStore(s => s.user);
  const [aba, setAba] = useState<AbaCatalogo>("beneficios");

  const podeVerBeneficio = pode(user, "people.beneficio:ver");
  const podeVerCurso = pode(user, "people.treinamento:ver");
  const podeVerChecklist = pode(user, "people.checklist:ver");

  // Abre direto no que a pessoa pode ver, em vez de mostrar um bloqueio.
  useEffect(() => {
    if (!podeVerBeneficio && podeVerCurso) setAba("cursos");
    else if (!podeVerBeneficio && !podeVerCurso && podeVerChecklist) setAba("checklists");
  }, [podeVerBeneficio, podeVerCurso, podeVerChecklist]);

  const ABAS = [
    ...(podeVerBeneficio ? [{ id: "beneficios" as const, label: "Benefícios" }] : []),
    ...(podeVerCurso ? [{ id: "cursos" as const, label: "Cursos e treinamentos" }] : []),
    ...(podeVerChecklist ? [{ id: "checklists" as const, label: "Checklists" }] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />
          <PageHeader
            icon={<Library size={19} />}
            title="Catálogos"
            subtitle="O que a organização oferece e o que ela exige — benefícios, capacitação e checklists"
          />

          {ABAS.length === 0 ? (
            <PermissionDenied hint="Você não tem permissão para ver os catálogos." />
          ) : (
            <>
              <Tabs<AbaCatalogo> tabs={ABAS} active={aba} onChange={setAba} />
              {aba === "beneficios" ? (
                <CatalogoBeneficios podeGerenciar={pode(user, "people.beneficio:gerenciar")} />
              ) : aba === "cursos" ? (
                <CatalogoCursos podeGerenciar={pode(user, "people.treinamento:gerenciar")} />
              ) : (
                <CatalogoChecklists podeGerenciar={pode(user, "people.checklist:gerenciar")} />
              )}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/* ── Benefícios ───────────────────────────────────────────────────────────── */

function CatalogoBeneficios({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [itens, setItens] = useState<Beneficio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<Beneficio | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setItens((await benefitsService.catalogo(true)).data ?? []);
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os benefícios.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(b: Beneficio) {
    if (!confirm(`Excluir o benefício "${b.nome}"?`)) return;
    try {
      await benefitsService.excluir(b.id);
      useToastStore.getState().success("Benefício excluído");
      carregar();
    } catch { /* interceptor mostra o motivo do backend */ }
  }

  async function alternar(b: Beneficio) {
    try {
      await benefitsService.alternarAtivo(b.id, b, !b.ativo);
      useToastStore.getState().success(b.ativo ? "Benefício desativado" : "Benefício reativado");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) return <PermissionDenied hint="Você não tem permissão para ver os benefícios." />;

  const COLUNAS = ["Benefício", "Categoria", "Valor de referência", "Concessões", "Situação", ""];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        {podeGerenciar && (
          <button type="button" className="btn btn-primary" onClick={() => setEditando("novo")}>
            <Plus size={14} /> Novo benefício
          </button>
        )}
      </div>

      <TableCard>
        <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {carregando ? (
            <LoadingRows colSpan={COLUNAS.length} rows={4} />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
          ) : itens.length === 0 ? (
            <EmptyState
              colSpan={COLUNAS.length}
              icon={<Gift size={20} />}
              title="Nenhum benefício cadastrado"
              hint={podeGerenciar ? "Cadastre o que a empresa oferece para poder conceder." : undefined}
            />
          ) : (
            itens.map(b => (
              <tr key={b.id} style={{ opacity: b.ativo ? 1 : 0.6 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.nome}</div>
                  {b.descricao && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{b.descricao}</div>
                  )}
                </td>
                <td>{ROTULO_CATEGORIA.get(b.categoria) ?? b.categoria}</td>
                <td className="num">{fmtMoeda(b.valorReferencia)}</td>
                <td className="num">{b.concessoes}</td>
                <td>
                  <StatusBadge label={b.ativo ? "Ativo" : "Desativado"} tone={b.ativo ? "ok" : "neutro"} />
                </td>
                <td>
                  {podeGerenciar && (
                    <RowActions>
                      <RowAction tone="view" title="Editar" onClick={() => setEditando(b)}>
                        <Pencil size={13} />
                      </RowAction>
                      <RowAction
                        tone="view"
                        title={b.ativo ? "Desativar" : "Reativar"}
                        onClick={() => alternar(b)}
                      >
                        {b.ativo ? <PowerOff size={13} /> : <Power size={13} />}
                      </RowAction>
                      {/* Já concedido faz parte do histórico: o backend recusa. */}
                      {b.concessoes === 0 && (
                        <RowAction tone="danger" title="Excluir" onClick={() => excluir(b)}>
                          <Trash2 size={13} />
                        </RowAction>
                      )}
                    </RowActions>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <FormBeneficio alvo={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />
    </>
  );
}

function FormBeneficio({
  alvo, onFechar, onSalvo,
}: { alvo: Beneficio | "novo" | null; onFechar: () => void; onSalvo: () => void }) {
  const edicao = alvo && alvo !== "novo" ? alvo : null;
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<CategoriaBeneficio>("outro");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(edicao?.nome ?? "");
    setCategoria(edicao?.categoria ?? "outro");
    setDescricao(edicao?.descricao ?? "");
    setValor(edicao?.valorReferencia?.toString() ?? "");
    setErros({});
  }, [alvo, edicao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErros({ nome: "Informe o nome" }); return; }

    setSalvando(true);
    try {
      const dados = {
        nome, categoria, descricao,
        valorReferencia: valor === "" ? null : Number(valor),
      };
      if (edicao) await benefitsService.atualizar(edicao.id, dados);
      else await benefitsService.criar(dados);
      useToastStore.getState().success(edicao ? "Benefício atualizado" : "Benefício criado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ nome: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!alvo}
      titulo={edicao ? "Editar benefício" : "Novo benefício"}
      onFechar={onFechar}
      largura={520}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erros.nome} largura="total">
            <input
              className="input-o" maxLength={120} value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: Plano de saúde"
            />
          </FormField>

          <FormField label="Categoria" obrigatorio>
            <select
              className="input-o" value={categoria}
              onChange={e => setCategoria(e.target.value as CategoriaBeneficio)}
            >
              {CATEGORIAS_BENEFICIO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>

          <FormField label="Valor de referência" dica="Sugerido ao conceder; pode variar por pessoa">
            <input
              type="number" className="input-o" min={0} step="0.01"
              value={valor} onChange={e => setValor(e.target.value)}
            />
          </FormField>

          <FormField label="Descrição" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={descricao} onChange={e => setDescricao(e.target.value)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : edicao ? "Salvar" : "Criar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

/* ── Cursos ───────────────────────────────────────────────────────────────── */

function CatalogoCursos({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [itens, setItens] = useState<Curso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<Curso | "novo" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setItens((await developmentService.cursos(true)).data ?? []);
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os cursos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(c: Curso) {
    if (!confirm(`Excluir o curso "${c.nome}"?`)) return;
    try {
      await developmentService.excluirCurso(c.id);
      useToastStore.getState().success("Curso excluído");
      carregar();
    } catch { /* interceptor */ }
  }

  async function alternar(c: Curso) {
    try {
      await developmentService.alternarCursoAtivo(c.id, c, !c.ativo);
      useToastStore.getState().success(c.ativo ? "Curso desativado" : "Curso reativado");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) return <PermissionDenied hint="Você não tem permissão para ver os cursos." />;

  const COLUNAS = ["Curso", "Fornecedor", "Carga", "Validade", "Participações", "Situação", ""];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        {podeGerenciar && (
          <button type="button" className="btn btn-primary" onClick={() => setEditando("novo")}>
            <Plus size={14} /> Novo curso
          </button>
        )}
      </div>

      <TableCard>
        <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {carregando ? (
            <LoadingRows colSpan={COLUNAS.length} rows={4} />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
          ) : itens.length === 0 ? (
            <EmptyState
              colSpan={COLUNAS.length}
              icon={<GraduationCap size={20} />}
              title="Nenhum curso cadastrado"
              hint={podeGerenciar ? "Cadastre cursos para registrar participação e certificação." : undefined}
            />
          ) : (
            itens.map(c => (
              <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.6 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.nome}</div>
                  {c.categoria && c.categoria !== "outro" && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.categoria}</div>
                  )}
                </td>
                <td>{c.fornecedor || "—"}</td>
                <td className="num">{c.cargaHoraria ? `${c.cargaHoraria}h` : "—"}</td>
                <td className="num">
                  {c.validadeMeses ? `${c.validadeMeses} meses` : "Não expira"}
                </td>
                <td className="num">{c.participacoes}</td>
                <td>
                  <StatusBadge label={c.ativo ? "Ativo" : "Desativado"} tone={c.ativo ? "ok" : "neutro"} />
                </td>
                <td>
                  {podeGerenciar && (
                    <RowActions>
                      <RowAction tone="view" title="Editar" onClick={() => setEditando(c)}>
                        <Pencil size={13} />
                      </RowAction>
                      <RowAction
                        tone="view"
                        title={c.ativo ? "Desativar" : "Reativar"}
                        onClick={() => alternar(c)}
                      >
                        {c.ativo ? <PowerOff size={13} /> : <Power size={13} />}
                      </RowAction>
                      {c.participacoes === 0 && (
                        <RowAction tone="danger" title="Excluir" onClick={() => excluir(c)}>
                          <Trash2 size={13} />
                        </RowAction>
                      )}
                    </RowActions>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <FormCurso alvo={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />
    </>
  );
}

function FormCurso({
  alvo, onFechar, onSalvo,
}: { alvo: Curso | "novo" | null; onFechar: () => void; onSalvo: () => void }) {
  const edicao = alvo && alvo !== "novo" ? alvo : null;
  const [nome, setNome] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [carga, setCarga] = useState("");
  const [validade, setValidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(edicao?.nome ?? "");
    setFornecedor(edicao?.fornecedor ?? "");
    setCategoria(edicao?.categoria === "outro" ? "" : edicao?.categoria ?? "");
    setCarga(edicao?.cargaHoraria?.toString() ?? "");
    setValidade(edicao?.validadeMeses?.toString() ?? "");
    setDescricao(edicao?.descricao ?? "");
    setErros({});
  }, [alvo, edicao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErros({ nome: "Informe o nome" }); return; }

    setSalvando(true);
    try {
      const dados = {
        nome, fornecedor, categoria, descricao,
        cargaHoraria: carga === "" ? null : Number(carga),
        validadeMeses: validade === "" ? null : Number(validade),
      };
      if (edicao) await developmentService.atualizarCurso(edicao.id, dados);
      else await developmentService.criarCurso(dados);
      useToastStore.getState().success(edicao ? "Curso atualizado" : "Curso criado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ nome: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!alvo}
      titulo={edicao ? "Editar curso" : "Novo curso"}
      onFechar={onFechar}
      largura={560}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erros.nome} largura="total">
            <input
              className="input-o" maxLength={160} value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: NR-10 — Segurança em instalações elétricas"
            />
          </FormField>

          <FormField label="Fornecedor">
            <input
              className="input-o" maxLength={120} value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
            />
          </FormField>

          <FormField label="Categoria">
            <input
              className="input-o" maxLength={60} value={categoria}
              onChange={e => setCategoria(e.target.value)}
              placeholder="Ex.: Segurança"
            />
          </FormField>

          <FormField label="Carga horária" dica="Em horas">
            <input
              type="number" className="input-o" min={1}
              value={carga} onChange={e => setCarga(e.target.value)}
            />
          </FormField>

          <FormField
            label="Validade da certificação"
            dica="Em meses. Vazio = não expira"
          >
            <input
              type="number" className="input-o" min={1}
              value={validade} onChange={e => setValidade(e.target.value)}
            />
          </FormField>

          <FormField label="Descrição" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={descricao} onChange={e => setDescricao(e.target.value)}
            />
          </FormField>
        </FormGrid>

        {edicao && edicao.participacoes > 0 && validade !== String(edicao.validadeMeses ?? "") && (
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Alterar a validade vale apenas para conclusões futuras. Os{" "}
            <span className="metric">{edicao.participacoes}</span> certificados já
            emitidos mantêm a data que tinham.
          </p>
        )}

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : edicao ? "Salvar" : "Criar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
