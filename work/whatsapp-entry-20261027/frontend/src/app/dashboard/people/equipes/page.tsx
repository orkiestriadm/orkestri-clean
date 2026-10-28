"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { api } from "@/lib/api";
import {
  skillsService, squadsService, Skill, Squad, MembroSquad,
} from "@/lib/people/org.service";
import {
  PageBody, BackLink, PageHeader, Tabs, Panel, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { UsersRound, Plus, Pencil, Trash2, Sparkles, UserPlus } from "lucide-react";

/**
 * Equipes: squads e catálogo de competências.
 *
 * Os dois vivem juntos porque respondem à mesma pergunta — como o trabalho está
 * organizado e quem sabe fazer o quê. Estavam em Cadastros, onde ninguém do RH
 * procuraria.
 */

function pode(user: any, ...perms: string[]): boolean {
  if (user?.isMaster) return true;
  const atuais: string[] = user?.permissions ?? [];
  return atuais.includes("*") || perms.some(p => atuais.includes(p));
}

const nomeDe = (c?: { nomeCompleto?: string | null; user?: { nome: string } | null } | null) =>
  c?.nomeCompleto || c?.user?.nome || "—";

type AbaEquipes = "squads" | "skills";

export default function EquipesPage() {
  const user = useAuthStore(s => s.user);
  const [aba, setAba] = useState<AbaEquipes>("squads");

  const podeVer = pode(user, "colaboradores:ver", "people.colaborador:ver");
  const podeGerenciar = pode(user, "colaboradores:editar", "people.colaborador:editar");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />
          <PageHeader
            icon={<UsersRound size={19} />}
            title="Equipes"
            subtitle="Squads e competências da organização"
          />

          {!podeVer ? (
            <PermissionDenied hint="Você não tem permissão para ver as equipes." />
          ) : (
            <>
              <Tabs<AbaEquipes>
                tabs={[
                  { id: "squads", label: "Squads" },
                  { id: "skills", label: "Competências" },
                ]}
                active={aba}
                onChange={setAba}
              />
              {aba === "squads"
                ? <AbaSquads podeGerenciar={podeGerenciar} />
                : <AbaSkills podeGerenciar={podeGerenciar} />}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/* ── Squads ───────────────────────────────────────────────────────────────── */

function AbaSquads({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [itens, setItens] = useState<Squad[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Squad | "novo" | null>(null);
  const [gerindo, setGerindo] = useState<Squad | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      setItens(await squadsService.listar());
    } catch (e: any) {
      setItens([]);
      setErro(e?.response?.data?.message || "Não foi possível carregar os squads.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(s: Squad) {
    if (!confirm(`Excluir o squad "${s.nome}"?`)) return;
    try {
      await squadsService.excluir(s.id);
      useToastStore.getState().success("Squad excluído");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Squad", "Líder", "Membros", "Situação", ""];

  return (
    <>
      <Panel
        title={`SQUADS (${itens.length})`}
        actions={
          podeGerenciar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditando("novo")}>
              <Plus size={13} /> Novo squad
            </button>
          )
        }
      >
        <TableCard>
          <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COLUNAS.length} rows={3} />
            ) : erro ? (
              <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
            ) : itens.length === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<UsersRound size={20} />}
                title="Nenhum squad criado"
                hint={podeGerenciar ? "Agrupe pessoas por time de trabalho, com alocação percentual." : undefined}
              />
            ) : (
              itens.map(s => (
                <tr key={s.id} style={{ opacity: s.ativo ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      {s.cor && (
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: s.cor, flexShrink: 0 }} />
                      )}
                      {s.nome}
                    </div>
                    {s.descricao && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.descricao}</div>
                    )}
                  </td>
                  <td>{s.lider ? nomeDe(s.lider) : "—"}</td>
                  <td className="num">{s._count?.members ?? s.members?.length ?? 0}</td>
                  <td>
                    <StatusBadge label={s.ativo ? "Ativo" : "Inativo"} tone={s.ativo ? "ok" : "neutro"} />
                  </td>
                  <td>
                    {podeGerenciar && (
                      <RowActions>
                        <RowAction tone="view" title="Membros" onClick={() => setGerindo(s)}>
                          <UserPlus size={13} />
                        </RowAction>
                        <RowAction tone="view" title="Editar" onClick={() => setEditando(s)}>
                          <Pencil size={13} />
                        </RowAction>
                        <RowAction tone="danger" title="Excluir" onClick={() => excluir(s)}>
                          <Trash2 size={13} />
                        </RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>

      <FormSquad alvo={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />
      <MembrosSquad squad={gerindo} onFechar={() => setGerindo(null)} onMudou={carregar} />
    </>
  );
}

function FormSquad({
  alvo, onFechar, onSalvo,
}: { alvo: Squad | "novo" | null; onFechar: () => void; onSalvo: () => void }) {
  const edicao = alvo && alvo !== "novo" ? alvo : null;
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [liderId, setLiderId] = useState("");
  const [cor, setCor] = useState("#f97316");
  const [colaboradores, setColaboradores] = useState<{ id: string; nomeExibicao: string }[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(edicao?.nome ?? "");
    setDescricao(edicao?.descricao ?? "");
    setLiderId(edicao?.liderId ?? "");
    setCor(edicao?.cor ?? "#f97316");
    setErro("");
    api.get("/v1/people/employees", { params: { tamanho: 200, status: "ATIVO" }, silent: true })
      .then(r => setColaboradores(r.data?.data ?? []))
      .catch(() => setColaboradores([]));
  }, [alvo, edicao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome"); return; }
    setSalvando(true);
    try {
      await squadsService.salvar(edicao?.id ?? null, { nome, descricao, liderId, cor });
      useToastStore.getState().success(edicao ? "Squad atualizado" : "Squad criado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={!!alvo} titulo={edicao ? "Editar squad" : "Novo squad"} onFechar={onFechar} largura={520}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erro} largura="total">
            <input className="input-o" maxLength={120} value={nome} onChange={e => setNome(e.target.value)} />
          </FormField>

          <FormField label="Líder">
            <select className="input-o" value={liderId} onChange={e => setLiderId(e.target.value)}>
              <option value="">—</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nomeExibicao}</option>)}
            </select>
          </FormField>

          <FormField label="Cor" dica="Identifica o squad nas listas">
            <input
              type="color" className="input-o" value={cor}
              onChange={e => setCor(e.target.value)}
              style={{ padding: 4, height: 38 }}
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
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : edicao ? "Salvar" : "Criar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function MembrosSquad({
  squad, onFechar, onMudou,
}: { squad: Squad | null; onFechar: () => void; onMudou: () => void }) {
  const [membros, setMembros] = useState<MembroSquad[]>([]);
  const [colaboradores, setColaboradores] = useState<{ id: string; nomeExibicao: string }[]>([]);
  const [novoId, setNovoId] = useState("");
  const [alocacao, setAlocacao] = useState("100");
  const [papel, setPapel] = useState("membro");
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    if (!squad) return;
    setCarregando(true);
    try {
      const s = await squadsService.obter(squad.id);
      setMembros(s.members ?? []);
    } catch { setMembros([]); } finally { setCarregando(false); }
  }, [squad]);

  useEffect(() => {
    if (!squad) return;
    setNovoId(""); setAlocacao("100"); setPapel("membro");
    recarregar();
    api.get("/v1/people/employees", { params: { tamanho: 200, status: "ATIVO" }, silent: true })
      .then(r => setColaboradores(r.data?.data ?? []))
      .catch(() => setColaboradores([]));
  }, [squad, recarregar]);

  const disponiveis = colaboradores.filter(c => !membros.some(m => m.collaboratorId === c.id));

  async function adicionar() {
    if (!squad || !novoId) return;
    try {
      await squadsService.adicionarMembro(squad.id, novoId, Number(alocacao) || 100, papel);
      setNovoId("");
      await recarregar();
      onMudou();
    } catch { /* interceptor */ }
  }

  async function remover(m: MembroSquad) {
    if (!squad) return;
    try {
      await squadsService.removerMembro(squad.id, m.id);
      await recarregar();
      onMudou();
    } catch { /* interceptor */ }
  }

  return (
    <Modal
      aberto={!!squad}
      titulo="Membros do squad"
      subtitulo={squad?.nome}
      onFechar={onFechar}
      largura={560}
    >
      {carregando ? (
        <span className="skeleton" style={{ display: "block", height: 120, borderRadius: 12 }} />
      ) : membros.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum membro neste squad.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {membros.map(m => (
            <div
              key={m.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 10,
                background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                {nomeDe(m.collaborator)}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.papel}</span>
              <span className="num" style={{ fontSize: 12 }}>{m.alocacaoPercent}%</span>
              <button
                type="button" className="btn-icon" aria-label="Remover"
                onClick={() => remover(m)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
        <FormGrid min={140}>
          <FormField label="Adicionar colaborador" largura="total">
            <select className="input-o" value={novoId} onChange={e => setNovoId(e.target.value)}>
              <option value="">
                {disponiveis.length === 0 ? "Todos os ativos já são membros" : "—"}
              </option>
              {disponiveis.map(c => <option key={c.id} value={c.id}>{c.nomeExibicao}</option>)}
            </select>
          </FormField>

          <FormField label="Alocação" dica="% do tempo">
            <input
              type="number" className="input-o" min={1} max={100}
              value={alocacao} onChange={e => setAlocacao(e.target.value)}
            />
          </FormField>

          <FormField label="Papel">
            <input className="input-o" value={papel} onChange={e => setPapel(e.target.value)} />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={adicionar} disabled={!novoId}>
            Adicionar
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}

/* ── Skills ───────────────────────────────────────────────────────────────── */

function AbaSkills({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [itens, setItens] = useState<Skill[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Skill | "nova" | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      setItens(await skillsService.listar());
    } catch (e: any) {
      setItens([]);
      setErro(e?.response?.data?.message || "Não foi possível carregar as competências.");
    } finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(s: Skill) {
    if (!confirm(`Excluir a competência "${s.nome}"?`)) return;
    try {
      await skillsService.excluir(s.id);
      useToastStore.getState().success("Competência excluída");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Competência", "Categoria", "Pessoas", "Situação", ""];

  return (
    <>
      <Panel
        title={`COMPETÊNCIAS (${itens.length})`}
        actions={
          podeGerenciar && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditando("nova")}>
              <Plus size={13} /> Nova competência
            </button>
          )
        }
      >
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 0 }}>
          O catálogo define o vocabulário. A atribuição a cada pessoa, com nível,
          é feita no perfil do colaborador.
        </p>

        <TableCard>
          <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <LoadingRows colSpan={COLUNAS.length} rows={3} />
            ) : erro ? (
              <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
            ) : itens.length === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<Sparkles size={20} />}
                title="Nenhuma competência cadastrada"
                hint={podeGerenciar ? "Cadastre o que a organização precisa saber fazer." : undefined}
              />
            ) : (
              itens.map(s => (
                <tr key={s.id} style={{ opacity: s.ativo ? 1 : 0.6 }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                      {s.cor && (
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: s.cor, flexShrink: 0 }} />
                      )}
                      {s.nome}
                    </div>
                    {s.descricao && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.descricao}</div>
                    )}
                  </td>
                  <td>{s.categoria || "—"}</td>
                  <td className="num">{s._count?.collaborators ?? 0}</td>
                  <td>
                    <StatusBadge label={s.ativo ? "Ativa" : "Inativa"} tone={s.ativo ? "ok" : "neutro"} />
                  </td>
                  <td>
                    {podeGerenciar && (
                      <RowActions>
                        <RowAction tone="view" title="Editar" onClick={() => setEditando(s)}>
                          <Pencil size={13} />
                        </RowAction>
                        <RowAction tone="danger" title="Excluir" onClick={() => excluir(s)}>
                          <Trash2 size={13} />
                        </RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>

      <FormSkill alvo={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />
    </>
  );
}

function FormSkill({
  alvo, onFechar, onSalvo,
}: { alvo: Skill | "nova" | null; onFechar: () => void; onSalvo: () => void }) {
  const edicao = alvo && alvo !== "nova" ? alvo : null;
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState("#f97316");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(edicao?.nome ?? "");
    setCategoria(edicao?.categoria ?? "");
    setDescricao(edicao?.descricao ?? "");
    setCor(edicao?.cor ?? "#f97316");
    setErro("");
  }, [alvo, edicao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome"); return; }
    setSalvando(true);
    try {
      if (edicao) await skillsService.atualizar(edicao.id, { nome, categoria, descricao, cor });
      else await skillsService.criar({ nome, categoria, descricao, cor });
      useToastStore.getState().success(edicao ? "Competência atualizada" : "Competência criada");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally { setSalvando(false); }
  }

  return (
    <Modal
      aberto={!!alvo}
      titulo={edicao ? "Editar competência" : "Nova competência"}
      onFechar={onFechar}
      largura={500}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erro} largura="total">
            <input
              className="input-o" maxLength={120} value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex.: PostgreSQL"
            />
          </FormField>

          <FormField label="Categoria">
            <input
              className="input-o" maxLength={60} value={categoria}
              onChange={e => setCategoria(e.target.value)}
              placeholder="Ex.: Banco de dados"
            />
          </FormField>

          <FormField label="Cor">
            <input
              type="color" className="input-o" value={cor}
              onChange={e => setCor(e.target.value)}
              style={{ padding: 4, height: 38 }}
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
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : edicao ? "Salvar" : "Criar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
