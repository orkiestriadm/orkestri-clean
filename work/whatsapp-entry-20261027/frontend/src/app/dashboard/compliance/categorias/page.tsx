"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows, ErrorState,
  PermissionDenied, StatusBadge, RowActions, RowAction, Modal, FormGrid, FormField,
  FormActions,
} from "@/components/data-ui";
import { Layers, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Categoria, CampoDefinicao, TipoCampo } from "@/lib/compliance/types";
import { pode, Aviso } from "../_components/comuns";

/**
 * Categorias e campos personalizados.
 *
 * É o que torna o módulo genérico sem virar um formulário com quarenta campos
 * vazios: Meio Ambiente pede "Número do Processo" e "Condicionantes", Software
 * pede "Fabricante" e "Chave", e cada categoria só mostra os seus.
 */

const TIPOS: { valor: TipoCampo; rotulo: string }[] = [
  { valor: "texto", rotulo: "Texto" },
  { valor: "texto_longo", rotulo: "Texto longo" },
  { valor: "numero", rotulo: "Número" },
  { valor: "data", rotulo: "Data" },
  { valor: "booleano", rotulo: "Sim / Não" },
  { valor: "selecao", rotulo: "Lista de opções" },
];

export default function CategoriasPage() {
  const user = useAuthStore(s => s.user);
  const [itens, setItens] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [criando, setCriando] = useState(false);

  const podeGerenciar = pode(user, "compliance.categoria:gerenciar");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await complianceService.categorias(true));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar as categorias.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(c: Categoria) {
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    try {
      await complianceService.excluirCategoria(c.id);
      useToastStore.getState().success("Categoria excluída");
      carregar();
    } catch { /* o backend explica por que não deu — interceptor mostra */ }
  }

  const COLUNAS = ["Categoria", "Campos", "Folga interna", "Obrigações", "Situação", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<Layers size={19} />}
            title="Categorias"
            subtitle="Agrupam as obrigações e definem os campos próprios de cada tipo"
            actions={
              podeGerenciar && (
                <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                  <Plus size={14} /> Nova categoria
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver as categorias." />
          ) : (
            <>
              <Aviso tom="info">
                A <strong>folga interna</strong> é quantos dias antes do prazo fatal a organização quer
                começar a se mexer. O prazo interno de cada obrigação sai daí, e é sobre ele que os
                alertas são calibrados por padrão.
              </Aviso>

              <TableCard>
                <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={3} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
                  ) : itens.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<Layers size={20} />}
                      title="Nenhuma categoria cadastrada"
                      hint={podeGerenciar ? "Crie categorias como Meio Ambiente, Segurança do Trabalho ou Tecnologia." : undefined}
                    />
                  ) : (
                    itens.map(c => (
                      <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.6 }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.cor, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600 }}>{c.nome}</div>
                              {c.descricao && (
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.descricao}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {(c.campos ?? []).filter(x => x.ativo !== false).map(x => x.rotulo).join(", ") || "—"}
                        </td>
                        <td className="num">{c.folgaInternaDias} dias</td>
                        <td className="num">{c.totalObrigacoes ?? 0}</td>
                        <td><StatusBadge label={c.ativo ? "Ativa" : "Desativada"} tone={c.ativo ? "ok" : "neutro"} /></td>
                        <td>
                          {podeGerenciar && (
                            <RowActions>
                              <RowAction tone="edit" title="Editar" onClick={() => setEditando(c)}>
                                <Pencil size={13} />
                              </RowAction>
                              {(c.totalObrigacoes ?? 0) === 0 && (
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
            </>
          )}
        </PageBody>
      </div>

      <CategoriaForm
        aberto={criando || !!editando}
        categoria={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={carregar}
      />
    </div>
  );
}

function CategoriaForm({
  aberto, categoria, onFechar, onSalvo,
}: {
  aberto: boolean;
  categoria: Categoria | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState("#7c3aed");
  const [icone, setIcone] = useState("shield-check");
  const [folga, setFolga] = useState("60");
  const [ativo, setAtivo] = useState(true);
  const [campos, setCampos] = useState<Partial<CampoDefinicao>[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setNome(categoria?.nome ?? "");
    setDescricao(categoria?.descricao ?? "");
    setCor(categoria?.cor ?? "#7c3aed");
    setIcone(categoria?.icone ?? "shield-check");
    setFolga(String(categoria?.folgaInternaDias ?? 60));
    setAtivo(categoria?.ativo ?? true);
    setCampos((categoria?.campos ?? []).filter(c => c.ativo !== false).map(c => ({ ...c })));
  }, [aberto, categoria]);

  async function salvar() {
    if (!nome.trim()) { setErro("Informe o nome da categoria."); return; }
    if (campos.some(c => !c.rotulo?.trim())) { setErro("Todo campo personalizado precisa de um rótulo."); return; }

    setSalvando(true);
    try {
      await complianceService.salvarCategoria(categoria?.id ?? null, {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        cor, icone, ativo,
        folgaInternaDias: Number(folga || 60),
        campos: campos.map((c, i) => ({
          id: c.id,
          rotulo: c.rotulo!.trim(),
          tipo: c.tipo ?? "texto",
          opcoes: c.opcoes ?? [],
          obrigatorio: c.obrigatorio ?? false,
          ajuda: c.ajuda ?? undefined,
          ordem: i,
        })),
      });
      useToastStore.getState().success(categoria ? "Categoria atualizada" : "Categoria criada");
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={categoria ? `Editar ${categoria.nome}` : "Nova categoria"}
      onFechar={onFechar}
      largura={720}
    >
      <div className="panel__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {erro && <Aviso tom="critico">{erro}</Aviso>}

        <FormGrid>
          <FormField label="Nome" obrigatorio largura="total">
            <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} />
          </FormField>
          <FormField label="Descrição" largura="total">
            <input className="input-o" value={descricao} onChange={e => setDescricao(e.target.value)} />
          </FormField>
          <FormField label="Cor">
            <input type="color" className="input-o" value={cor} onChange={e => setCor(e.target.value)} style={{ height: 38, padding: 4 }} />
          </FormField>
          <FormField label="Ícone" dica="Nome do ícone lucide — leaf, hard-hat, shield-check…">
            <input className="input-o" value={icone} onChange={e => setIcone(e.target.value)} />
          </FormField>
          <FormField
            label="Folga interna (dias)"
            dica="Antecedência com que a organização quer começar a renovar, antes do prazo fatal."
          >
            <input type="number" min={0} className="input-o" value={folga} onChange={e => setFolga(e.target.value)} />
          </FormField>
          <FormField label="Situação">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, paddingTop: 8 }}>
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              Ativa
            </label>
          </FormField>
        </FormGrid>

        <div style={{ marginTop: 22 }}>
          <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 6 }}>
            Campos personalizados
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.55 }}>
            Aparecem no cadastro de toda obrigação desta categoria. Remover um campo aqui o desativa —
            os valores já preenchidos continuam guardados, porque há campo (número de processo) que é
            a única identificação do documento.
          </div>

          {campos.map((c, i) => (
            <div key={c.id ?? `novo-${i}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr 140px 1fr 70px 30px", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <GripVertical size={13} color="var(--text-muted)" />
              <input
                className="input-o" placeholder="Rótulo" value={c.rotulo ?? ""}
                onChange={e => setCampos(l => l.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))}
              />
              <select
                className="input-o" value={c.tipo ?? "texto"}
                onChange={e => setCampos(l => l.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoCampo } : x)))}
              >
                {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
              <input
                className="input-o"
                placeholder={c.tipo === "selecao" ? "Opções separadas por vírgula" : "Ajuda (opcional)"}
                value={c.tipo === "selecao" ? (c.opcoes ?? []).join(", ") : (c.ajuda ?? "")}
                onChange={e => setCampos(l => l.map((x, j) => (
                  j === i
                    ? c.tipo === "selecao"
                      ? { ...x, opcoes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }
                      : { ...x, ajuda: e.target.value }
                    : x
                )))}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <input
                  type="checkbox" checked={c.obrigatorio ?? false}
                  onChange={e => setCampos(l => l.map((x, j) => (j === i ? { ...x, obrigatorio: e.target.checked } : x)))}
                />
                obrig.
              </label>
              <button type="button" className="btn-icon" title="Remover campo" aria-label="Remover campo"
                onClick={() => setCampos(l => l.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCampos(l => [...l, { rotulo: "", tipo: "texto", opcoes: [], obrigatorio: false }])}
          >
            + Adicionar campo
          </button>
        </div>
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </FormActions>
    </Modal>
  );
}
