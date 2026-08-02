"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { usePositions } from "@/hooks/usePositions";
import {
  careerService, Trilha, Degrau, Requisito,
  NIVEIS_COMPETENCIA, TIPOS_REQUISITO, TipoRequisito,
} from "@/lib/people/career.service";
import { skillsService, Skill } from "@/lib/people/org.service";
import { developmentService, Curso } from "@/lib/people/development.service";
import {
  PageBody, BackLink, PageHeader, Panel, EmptyState, ErrorState,
  PermissionDenied, StatusBadge, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import {
  Route, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, GraduationCap, Award, ClipboardCheck,
} from "lucide-react";

/**
 * Trilhas de carreira.
 *
 * A trilha ORDENA CARGOS do catálogo. Não há "nível dentro do cargo": o
 * catálogo já carrega o nível e a faixa salarial está amarrada ao cargo, então
 * um segundo eixo criaria duas respostas para "que nível essa pessoa é?".
 * Progredir aqui é passar a ocupar o próximo cargo — o que move faixa,
 * organograma e histórico juntos, porque é o mesmo campo de sempre.
 */

function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

const ICONE_TIPO: Record<string, React.ReactNode> = {
  competencia: <Award size={12} />,
  treinamento: <GraduationCap size={12} />,
  manual: <ClipboardCheck size={12} />,
};

export default function CarreiraPage() {
  const user = useAuthStore(s => s.user);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semPermissao, setSemPermissao] = useState(false);
  const [editandoTrilha, setEditandoTrilha] = useState<Trilha | "nova" | null>(null);
  const [degrauEm, setDegrauEm] = useState<{ trilha: Trilha; degrau: Degrau | null } | null>(null);
  const [requisitoEm, setRequisitoEm] = useState<Degrau | null>(null);

  const podeGerenciar = pode(user, "people.carreira:gerenciar");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await careerService.trilhas(true);
      setTrilhas(r.data ?? []);
      setSemPermissao(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar as trilhas");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluirTrilha(t: Trilha) {
    if (!confirm(`Excluir a trilha "${t.nome}" e seus ${t.degraus.length} degraus?`)) return;
    try {
      await careerService.excluirTrilha(t.id);
      useToastStore.getState().success("Trilha excluída");
      carregar();
    } catch { /* o interceptor já mostrou o motivo */ }
  }

  async function mover(trilha: Trilha, degrau: Degrau, direcao: -1 | 1) {
    const ordenados = [...trilha.degraus].sort((a, b) => a.ordem - b.ordem);
    const i = ordenados.findIndex(d => d.id === degrau.id);
    const j = i + direcao;
    if (j < 0 || j >= ordenados.length) return;

    [ordenados[i], ordenados[j]] = [ordenados[j], ordenados[i]];
    try {
      await careerService.reordenar(trilha.id, ordenados.map(d => d.id));
      carregar();
    } catch { /* interceptor */ }
  }

  async function removerDegrau(d: Degrau) {
    if (!confirm(`Remover o degrau "${d.position?.titulo}" da trilha?`)) return;
    try {
      await careerService.removerDegrau(d.id);
      useToastStore.getState().success("Degrau removido");
      carregar();
    } catch { /* interceptor */ }
  }

  async function removerRequisito(r: Requisito) {
    try {
      await careerService.removerRequisito(r.id);
      carregar();
    } catch { /* interceptor */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<Route size={19} />}
            title="Trilhas de carreira"
            subtitle="Sequência de cargos e o que se exige em cada degrau"
            actions={
              podeGerenciar && (
                <button type="button" className="btn btn-primary" onClick={() => setEditandoTrilha("nova")}>
                  <Plus size={14} /> Nova trilha
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver as trilhas de carreira." />
          ) : carregando ? (
            <Panel title="TRILHAS"><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando…</p></Panel>
          ) : erro ? (
            <table style={{ width: "100%" }}><tbody>
              <ErrorState detail={erro} onRetry={carregar} colSpan={1} />
            </tbody></table>
          ) : trilhas.length === 0 ? (
            <Panel title="TRILHAS">
              <div style={{ padding: "22px 4px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>
                <Route size={22} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Nenhuma trilha desenhada
                </div>
                Uma trilha é a sequência de cargos que alguém percorre — Júnior, Pleno,
                Sênior. Com os requisitos de cada degrau, o perfil de cada pessoa passa a
                mostrar o que falta para o próximo.
              </div>
            </Panel>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {trilhas.map(trilha => (
                <Panel
                  key={trilha.id}
                  title={trilha.nome.toUpperCase()}
                  actions={
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {!trilha.ativo && <StatusBadge label="Inativa" tone="neutro" />}
                      {podeGerenciar && (
                        <>
                          <button type="button" className="btn btn-ghost" onClick={() => setDegrauEm({ trilha, degrau: null })}>
                            <Plus size={13} /> Degrau
                          </button>
                          <RowActions>
                            <RowAction tone="view" title="Editar trilha" onClick={() => setEditandoTrilha(trilha)}>
                              <Pencil size={13} />
                            </RowAction>
                            <RowAction tone="danger" title="Excluir trilha" onClick={() => excluirTrilha(trilha)}>
                              <Trash2 size={13} />
                            </RowAction>
                          </RowActions>
                        </>
                      )}
                    </div>
                  }
                >
                  {trilha.descricao && (
                    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.6 }}>
                      {trilha.descricao}
                    </p>
                  )}

                  {trilha.degraus.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
                      Trilha sem degraus. Adicione o primeiro cargo da sequência.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[...trilha.degraus].sort((a, b) => a.ordem - b.ordem).map((d, i, todos) => (
                        <DegrauCard
                          key={d.id}
                          degrau={d}
                          primeiro={i === 0}
                          ultimo={i === todos.length - 1}
                          podeGerenciar={podeGerenciar}
                          onSubir={() => mover(trilha, d, -1)}
                          onDescer={() => mover(trilha, d, 1)}
                          onEditar={() => setDegrauEm({ trilha, degrau: d })}
                          onRemover={() => removerDegrau(d)}
                          onNovoRequisito={() => setRequisitoEm(d)}
                          onRemoverRequisito={removerRequisito}
                        />
                      ))}
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          )}
        </PageBody>
      </div>

      <TrilhaForm
        alvo={editandoTrilha}
        onFechar={() => setEditandoTrilha(null)}
        onSalvo={carregar}
      />
      <DegrauForm
        alvo={degrauEm}
        onFechar={() => setDegrauEm(null)}
        onSalvo={carregar}
      />
      <RequisitoForm
        degrau={requisitoEm}
        onFechar={() => setRequisitoEm(null)}
        onSalvo={carregar}
      />
    </div>
  );
}

function DegrauCard({
  degrau, primeiro, ultimo, podeGerenciar,
  onSubir, onDescer, onEditar, onRemover, onNovoRequisito, onRemoverRequisito,
}: {
  degrau: Degrau; primeiro: boolean; ultimo: boolean; podeGerenciar: boolean;
  onSubir: () => void; onDescer: () => void; onEditar: () => void; onRemover: () => void;
  onNovoRequisito: () => void; onRemoverRequisito: (r: Requisito) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)", borderRadius: 14,
        padding: "12px 14px", background: "var(--bg-secondary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          className="metric"
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
          }}
        >
          {degrau.ordem}
        </span>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>
            {degrau.position?.titulo ?? "Cargo removido"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
            {[
              degrau.position?.nivel,
              degrau.mesesMinimos != null
                ? `mínimo ${degrau.mesesMinimos} ${degrau.mesesMinimos === 1 ? "mês" : "meses"} no degrau anterior`
                : null,
              degrau.notaMinima != null ? `nota mínima ${degrau.notaMinima}` : null,
              degrau.colaboradores
                ? `${degrau.colaboradores} ${degrau.colaboradores === 1 ? "pessoa" : "pessoas"}`
                : null,
            ].filter(Boolean).join(" · ") || "sem critérios de tempo ou nota"}
          </div>
        </div>

        {podeGerenciar && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" className="btn btn-ghost" onClick={onNovoRequisito}>
              <Plus size={12} /> Requisito
            </button>
            <RowActions>
              {/* Sem seta no topo e na base: botão que não faz nada ensina errado. */}
              {!primeiro && (
                <RowAction tone="view" title="Subir" onClick={onSubir}><ChevronUp size={13} /></RowAction>
              )}
              {!ultimo && (
                <RowAction tone="view" title="Descer" onClick={onDescer}><ChevronDown size={13} /></RowAction>
              )}
              <RowAction tone="view" title="Editar degrau" onClick={onEditar}><Pencil size={13} /></RowAction>
              <RowAction tone="danger" title="Remover degrau" onClick={onRemover}><Trash2 size={13} /></RowAction>
            </RowActions>
          </div>
        )}
      </div>

      {degrau.requisitos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {degrau.requisitos.map(r => (
            <span
              key={r.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 9px", borderRadius: 999, fontSize: 11.5,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-primary)",
                color: r.obrigatorio ? "var(--text-secondary)" : "var(--text-muted)",
              }}
              title={r.obrigatorio ? "Obrigatório" : "Diferencial — conta a favor, não trava"}
            >
              {ICONE_TIPO[r.tipo]}
              {rotuloRequisito(r)}
              {!r.obrigatorio && <em style={{ fontStyle: "normal", opacity: 0.7 }}>· diferencial</em>}
              {podeGerenciar && (
                <button
                  type="button"
                  onClick={() => onRemoverRequisito(r)}
                  title="Remover requisito"
                  style={{
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    display: "inline-flex", color: "var(--text-muted)",
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function rotuloRequisito(r: {
  tipo: string; skill?: { nome: string } | null; skillNome?: string | null;
  training?: { nome: string } | null; trainingNome?: string | null;
  nivelMinimo?: string | null; descricao?: string | null;
}): string {
  const nivel = NIVEIS_COMPETENCIA.find(n => n.value === r.nivelMinimo)?.label;
  if (r.tipo === "competencia") {
    const nome = r.skill?.nome ?? r.skillNome ?? "competência";
    return nivel ? `${nome} (${nivel})` : nome;
  }
  if (r.tipo === "treinamento") {
    return r.training?.nome ?? r.trainingNome ?? "treinamento";
  }
  return r.descricao ?? "conferência manual";
}

/* ── Formulários ──────────────────────────────────────────────────────────── */

function TrilhaForm({
  alvo, onFechar, onSalvo,
}: {
  alvo: Trilha | "nova" | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const editando = alvo && alvo !== "nova" ? alvo : null;

  useEffect(() => {
    if (!alvo) return;
    setNome(editando?.nome ?? "");
    setDescricao(editando?.descricao ?? "");
    setAtivo(editando?.ativo ?? true);
    setErro("");
  }, [alvo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome da trilha"); return; }

    setSalvando(true);
    try {
      await careerService.salvarTrilha(editando?.id ?? null, { nome, descricao, ativo });
      useToastStore.getState().success(editando ? "Trilha atualizada" : "Trilha criada");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg && [400, 409].includes(err?.response?.status)) {
        setErro(Array.isArray(msg) ? msg.join(". ") : msg);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={!!alvo} titulo={editando ? "Editar trilha" : "Nova trilha"} onFechar={onFechar} largura={520}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erro} largura="total">
            <input
              className="input-o" maxLength={120} value={nome}
              onChange={e => setNome(e.target.value)} placeholder="Engenharia de Software"
            />
          </FormField>
          <FormField label="Descrição" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
          {editando && (
            <FormField label="Situação" largura="total">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                Trilha ativa
              </label>
            </FormField>
          )}
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function DegrauForm({
  alvo, onFechar, onSalvo,
}: {
  alvo: { trilha: Trilha; degrau: Degrau | null } | null; onFechar: () => void; onSalvo: () => void;
}) {
  const { cargos } = usePositions(false);
  const [positionId, setPositionId] = useState("");
  const [mesesMinimos, setMesesMinimos] = useState("");
  const [notaMinima, setNotaMinima] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    const d = alvo.degrau;
    setPositionId(d?.positionId ?? "");
    setMesesMinimos(d?.mesesMinimos == null ? "" : String(d.mesesMinimos));
    setNotaMinima(d?.notaMinima == null ? "" : String(d.notaMinima));
    setObservacoes(d?.observacoes ?? "");
    setErro("");
  }, [alvo]);

  // Cargo já usado noutro degrau não aparece: o degrau atual de cada pessoa é
  // descoberto pelo cargo, e repetir tornaria essa descoberta ambígua.
  const jaUsados = new Set(
    (alvo?.trilha.degraus ?? [])
      .filter(d => d.id !== alvo?.degrau?.id)
      .map(d => d.positionId),
  );
  const disponiveis = cargos.filter(c => !jaUsados.has(c.id) || c.id === positionId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!positionId) { setErro("Escolha o cargo deste degrau"); return; }

    const dados = {
      positionId,
      mesesMinimos: mesesMinimos === "" ? null : Number(mesesMinimos),
      notaMinima: notaMinima === "" ? null : Number(notaMinima),
      observacoes,
    };

    setSalvando(true);
    try {
      if (alvo?.degrau) await careerService.atualizarDegrau(alvo.degrau.id, dados);
      else await careerService.adicionarDegrau(alvo!.trilha.id, dados);
      useToastStore.getState().success(alvo?.degrau ? "Degrau atualizado" : "Degrau adicionado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg && [400, 409].includes(err?.response?.status)) {
        setErro(Array.isArray(msg) ? msg.join(". ") : msg);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!alvo}
      titulo={alvo?.degrau ? "Editar degrau" : "Novo degrau"}
      subtitulo={alvo?.trilha.nome}
      onFechar={onFechar}
      largura={540}
    >
      <form onSubmit={salvar} noValidate>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 0 }}>
          Cada degrau é um cargo do catálogo. Tempo e nota são critérios para
          <strong> chegar</strong> a este degrau — quem está no anterior precisa cumpri-los.
        </p>

        <FormGrid>
          <FormField label="Cargo" obrigatorio erro={erro} largura="total">
            <select className="input-o" value={positionId} onChange={e => setPositionId(e.target.value)}>
              <option value="">—</option>
              {disponiveis.map(c => (
                <option key={c.id} value={c.id}>
                  {c.titulo}{c.nivel ? ` · ${c.nivel}` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tempo mínimo (meses)" dica="Em branco = a trilha não usa tempo como critério">
            <input
              type="number" className="input-o" min={0} max={600}
              value={mesesMinimos} onChange={e => setMesesMinimos(e.target.value)} placeholder="—"
            />
          </FormField>

          <FormField label="Nota mínima" dica="Última avaliação finalizada, de 0 a 5">
            <input
              type="number" className="input-o" min={0} max={5} step="0.1"
              value={notaMinima} onChange={e => setNotaMinima(e.target.value)} placeholder="—"
            />
          </FormField>

          <FormField label="Observações" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="O que caracteriza este degrau"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function RequisitoForm({
  degrau, onFechar, onSalvo,
}: {
  degrau: Degrau | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoRequisito>("competencia");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [skillId, setSkillId] = useState("");
  const [nivelMinimo, setNivelMinimo] = useState("pleno");
  const [trainingId, setTrainingId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!degrau) return;
    setTipo("competencia"); setSkillId(""); setNivelMinimo("pleno");
    setTrainingId(""); setDescricao(""); setObrigatorio(true); setErro("");

    skillsService.listar().then(setSkills).catch(() => setSkills([]));
    developmentService.cursos()
      .then(r => setCursos(r.data ?? []))
      .catch(() => setCursos([]));
  }, [degrau]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!degrau) return;

    setSalvando(true);
    try {
      await careerService.adicionarRequisito(degrau.id, {
        tipo, skillId, nivelMinimo, trainingId, descricao, obrigatorio,
      });
      useToastStore.getState().success("Requisito adicionado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg && [400, 409].includes(err?.response?.status)) {
        setErro(Array.isArray(msg) ? msg.join(". ") : msg);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!degrau}
      titulo="Requisito do degrau"
      subtitulo={degrau?.position?.titulo}
      onFechar={onFechar}
      largura={540}
    >
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Tipo" largura="total">
            <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value as TipoRequisito)}>
              {TIPOS_REQUISITO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          {tipo === "competencia" && (
            <>
              <FormField label="Competência" obrigatorio erro={erro}>
                <select className="input-o" value={skillId} onChange={e => setSkillId(e.target.value)}>
                  <option value="">—</option>
                  {skills.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Nível mínimo">
                <select className="input-o" value={nivelMinimo} onChange={e => setNivelMinimo(e.target.value)}>
                  {NIVEIS_COMPETENCIA.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </FormField>
            </>
          )}

          {tipo === "treinamento" && (
            <FormField label="Curso" obrigatorio erro={erro} largura="total">
              <select className="input-o" value={trainingId} onChange={e => setTrainingId(e.target.value)}>
                <option value="">—</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FormField>
          )}

          {tipo === "manual" && (
            <FormField
              label="O que será conferido"
              obrigatorio
              erro={erro}
              largura="total"
              dica="O sistema não marca sozinho: aparece como conferência de quem decide"
            >
              <input
                className="input-o" maxLength={300} value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Liderar um projeto de ponta a ponta"
              />
            </FormField>
          )}

          {tipo !== "manual" && (
            <FormField label="Observação" largura="total">
              <input
                className="input-o" maxLength={300} value={descricao}
                onChange={e => setDescricao(e.target.value)} placeholder="Opcional"
              />
            </FormField>
          )}

          <FormField label="Peso" largura="total">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} />
              Obrigatório — em branco, conta como diferencial e não trava a progressão
            </label>
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Adicionar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
