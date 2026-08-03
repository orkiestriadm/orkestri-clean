"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  checklistService, ModeloChecklist, EVENTOS, RESPONSAVEIS,
  EventoChecklist, Responsavel,
} from "@/lib/people/checklist.service";
import {
  Panel, EmptyState, ErrorState, StatusBadge, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions, TableCard,
} from "@/components/data-ui";
import { ClipboardList, Plus, Pencil, Trash2, X } from "lucide-react";

/**
 * Modelos de checklist de admissão e desligamento.
 *
 * O modelo é o que a organização exige; a instância no perfil é o que foi
 * exigido daquela pessoa. Mudar o modelo NÃO mexe em checklist já aberto — o
 * histórico não pode mentir sobre o que valia na época.
 */

const ROTULO_EVENTO = new Map(EVENTOS.map(e => [e.value, e.label]));
const ROTULO_RESP = new Map(RESPONSAVEIS.map(r => [r.value, r.label]));

export default function CatalogoChecklists({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [modelos, setModelos] = useState<ModeloChecklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<ModeloChecklist | "novo" | null>(null);
  const [itemEm, setItemEm] = useState<ModeloChecklist | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await checklistService.modelos(true);
      setModelos(r.data ?? []);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar os modelos");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(m: ModeloChecklist) {
    if (!confirm(`Excluir o modelo "${m.nome}"? Checklists já abertos continuam como estão.`)) return;
    try {
      await checklistService.excluirModelo(m.id);
      useToastStore.getState().success("Modelo excluído");
      carregar();
    } catch { /* interceptor */ }
  }

  async function removerItem(id: string) {
    try {
      await checklistService.removerItemModelo(id);
      carregar();
    } catch { /* interceptor */ }
  }

  if (carregando) {
    return <Panel title="MODELOS"><Texto>Carregando…</Texto></Panel>;
  }
  if (erro) {
    return (
      <TableCard>
        <tbody><ErrorState detail={erro} onRetry={carregar} colSpan={1} /></tbody>
      </TableCard>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {modelos.length === 0 ? (
          <Panel
            title="MODELOS DE CHECKLIST"
            actions={
              podeGerenciar && (
                <button type="button" className="btn btn-primary" onClick={() => setEditando("novo")}>
                  <Plus size={13} /> Novo modelo
                </button>
              )
            }
          >
            <div style={{ padding: "20px 4px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65 }}>
              <ClipboardList size={22} style={{ opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                Nenhum modelo cadastrado
              </div>
              Um modelo lista o que precisa acontecer em toda admissão — documentos,
              exame, crachá, acessos — com prazo e responsável. Sem ele, cada entrada
              depende de alguém lembrar.
            </div>
          </Panel>
        ) : (
          <>
            {podeGerenciar && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-primary" onClick={() => setEditando("novo")}>
                  <Plus size={13} /> Novo modelo
                </button>
              </div>
            )}

            {modelos.map(m => (
              <Panel
                key={m.id}
                title={m.nome.toUpperCase()}
                actions={
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusBadge label={ROTULO_EVENTO.get(m.evento) ?? m.evento} tone="info" />
                    {!m.ativo && <StatusBadge label="Inativo" tone="neutro" />}
                    {podeGerenciar && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => setItemEm(m)}>
                          <Plus size={12} /> Item
                        </button>
                        <RowActions>
                          <RowAction tone="view" title="Editar modelo" onClick={() => setEditando(m)}>
                            <Pencil size={13} />
                          </RowAction>
                          <RowAction tone="danger" title="Excluir modelo" onClick={() => excluir(m)}>
                            <Trash2 size={13} />
                          </RowAction>
                        </RowActions>
                      </>
                    )}
                  </div>
                }
              >
                {m.descricao && (
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.6 }}>
                    {m.descricao}
                  </p>
                )}

                {m.itens.length === 0 ? (
                  <Texto>Modelo sem itens. Adicione o primeiro para ele valer alguma coisa.</Texto>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {m.itens.map(i => (
                      <div
                        key={i.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 12px", borderRadius: 11,
                          background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
                        }}
                      >
                        <span
                          className="metric"
                          style={{
                            width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700,
                            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                          }}
                        >
                          {i.ordem}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {i.titulo}
                            {!i.obrigatorio && (
                              <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · opcional</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                            {[
                              ROTULO_RESP.get(i.responsavel) ?? i.responsavel,
                              i.prazoDias != null
                                ? `prazo de ${i.prazoDias} ${i.prazoDias === 1 ? "dia" : "dias"}`
                                : "sem prazo",
                            ].join(" · ")}
                          </div>
                        </div>
                        {podeGerenciar && (
                          <button
                            type="button"
                            onClick={() => removerItem(i.id)}
                            title="Remover item"
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "var(--text-muted)", display: "inline-flex", padding: 4,
                            }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ))}
          </>
        )}
      </div>

      <ModeloForm alvo={editando} onFechar={() => setEditando(null)} onSalvo={carregar} />
      <ItemForm modelo={itemEm} onFechar={() => setItemEm(null)} onSalvo={carregar} />
    </>
  );
}

function ModeloForm({
  alvo, onFechar, onSalvo,
}: {
  alvo: ModeloChecklist | "novo" | null; onFechar: () => void; onSalvo: () => void;
}) {
  const editando = alvo && alvo !== "novo" ? alvo : null;
  const [nome, setNome] = useState("");
  const [evento, setEvento] = useState<EventoChecklist>("admissao");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!alvo) return;
    setNome(editando?.nome ?? "");
    setEvento(editando?.evento ?? "admissao");
    setDescricao(editando?.descricao ?? "");
    setAtivo(editando?.ativo ?? true);
    setErro("");
  }, [alvo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome do modelo"); return; }

    setSalvando(true);
    try {
      await checklistService.salvarModelo(editando?.id ?? null, { nome, evento, descricao, ativo });
      useToastStore.getState().success(editando ? "Modelo atualizado" : "Modelo criado");
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
    <Modal aberto={!!alvo} titulo={editando ? "Editar modelo" : "Novo modelo"} onFechar={onFechar} largura={520}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Nome" obrigatorio erro={erro} largura="total">
            <input
              className="input-o" maxLength={120} value={nome}
              onChange={e => setNome(e.target.value)} placeholder="Admissão CLT"
            />
          </FormField>
          <FormField label="Evento" largura="total" dica="Quando este checklist é usado">
            <select
              className="input-o" value={evento}
              onChange={e => setEvento(e.target.value as EventoChecklist)}
            >
              {EVENTOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
          <FormField label="Descrição" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Opcional"
            />
          </FormField>
          {editando && (
            <FormField label="Situação" largura="total">
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                Modelo ativo — só os ativos são oferecidos ao abrir um checklist
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

function ItemForm({
  modelo, onFechar, onSalvo,
}: {
  modelo: ModeloChecklist | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel>("rh");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [prazoDias, setPrazoDias] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!modelo) return;
    setTitulo(""); setDescricao(""); setResponsavel("rh");
    setObrigatorio(true); setPrazoDias(""); setErro("");
  }, [modelo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!modelo) return;
    if (!titulo.trim()) { setErro("Informe o que precisa acontecer"); return; }

    setSalvando(true);
    try {
      await checklistService.adicionarItemModelo(modelo.id, {
        titulo, descricao, responsavel, obrigatorio,
        prazoDias: prazoDias === "" ? null : Number(prazoDias),
      });
      useToastStore.getState().success("Item adicionado");
      onSalvo();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={!!modelo} titulo="Item do checklist" subtitulo={modelo?.nome} onFechar={onFechar} largura={540}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="O que precisa acontecer" obrigatorio erro={erro} largura="total">
            <input
              className="input-o" maxLength={160} value={titulo}
              onChange={e => setTitulo(e.target.value)} placeholder="Exame admissional"
            />
          </FormField>

          <FormField label="Responsável" dica="Quem faz, não quem confere">
            <select
              className="input-o" value={responsavel}
              onChange={e => setResponsavel(e.target.value as Responsavel)}
            >
              {RESPONSAVEIS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>

          <FormField label="Prazo (dias)" dica="Contados a partir da data do evento; em branco = sem prazo">
            <input
              type="number" className="input-o" min={0} max={365}
              value={prazoDias} onChange={e => setPrazoDias(e.target.value)} placeholder="—"
            />
          </FormField>

          <FormField label="Detalhe" largura="total">
            <input
              className="input-o" maxLength={500} value={descricao}
              onChange={e => setDescricao(e.target.value)} placeholder="Opcional"
            />
          </FormField>

          <FormField label="Peso" largura="total">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} />
              Obrigatório — em branco, não impede o checklist de ser concluído
            </label>
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Adicionando..." : "Adicionar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
      {children}
    </p>
  );
}
