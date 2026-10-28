"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows, ErrorState,
  PermissionDenied, RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Landmark, Plus, Pencil, Trash2 } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Orgao } from "@/lib/compliance/types";
import { pode, Aviso } from "../_components/comuns";

/**
 * Órgãos emissores — CETESB, Corpo de Bombeiros, Prefeitura…
 *
 * Cadastro à parte da obrigação porque o mesmo órgão atende dezenas de
 * licenças: o telefone muda uma vez aqui, e não em trinta obrigações.
 */

const CAMPOS = ["nome", "sigla", "contato", "telefone", "email", "site", "endereco", "observacoes"] as const;
type Campo = (typeof CAMPOS)[number];
type Formulario = Record<Campo, string>;

const VAZIO: Formulario = {
  nome: "", sigla: "", contato: "", telefone: "", email: "", site: "", endereco: "", observacoes: "",
};

export default function OrgaosPage() {
  const user = useAuthStore(s => s.user);
  const [itens, setItens] = useState<Orgao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<Orgao | null>(null);
  const [criando, setCriando] = useState(false);

  const podeGerenciar = pode(user, "compliance.admin:gerenciar");

  // Excluir é mais restrito que cadastrar e editar — a API recusa quem não for
  // a administração da organização, e o botão acompanha para ninguém descobrir
  // isso por um 403.
  const podeExcluir =
    !!user?.isMaster || !!user?.isSuperAdmin || (user?.roles ?? []).includes("administrador");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setItens(await complianceService.orgaos());
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar os órgãos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(o: Orgao) {
    if (!confirm(`Excluir o órgão "${o.nome}"?`)) return;
    try {
      await complianceService.excluirOrgao(o.id);
      useToastStore.getState().success("Órgão excluído");
      carregar();
    } catch { /* interceptor mostra o motivo */ }
  }

  const COLUNAS = ["Órgão", "Contato", "Telefone / e-mail", "Obrigações", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<Landmark size={19} />}
            title="Órgãos emissores"
            subtitle="Quem emite e fiscaliza os documentos — aparecem no cadastro de cada obrigação"
            actions={
              podeGerenciar && (
                <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                  <Plus size={14} /> Novo órgão
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver os órgãos emissores." />
          ) : (
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
                    icon={<Landmark size={20} />}
                    title="Nenhum órgão cadastrado"
                    hint={podeGerenciar ? "Cadastre órgãos como CETESB, Corpo de Bombeiros ou Prefeitura." : undefined}
                  />
                ) : (
                  itens.map(o => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.nome}</div>
                        {o.sigla && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.sigla}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{o.contato || "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        <div>{o.telefone || "—"}</div>
                        {o.email && <div style={{ color: "var(--text-muted)" }}>{o.email}</div>}
                      </td>
                      <td className="num">{o.totalObrigacoes ?? 0}</td>
                      <td>
                        {podeGerenciar && (
                          <RowActions>
                            <RowAction tone="edit" title="Editar" onClick={() => setEditando(o)}>
                              <Pencil size={13} />
                            </RowAction>
                            {/* Com obrigação vinculada, excluir deixaria o documento apontando
                                para um órgão que some da lista. */}
                            {podeExcluir && (o.totalObrigacoes ?? 0) === 0 && (
                              <RowAction tone="danger" title="Excluir" onClick={() => excluir(o)}>
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
          )}
        </PageBody>
      </div>

      <OrgaoForm
        aberto={criando || !!editando}
        orgao={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={carregar}
      />
    </div>
  );
}

function OrgaoForm({
  aberto, orgao, onFechar, onSalvo,
}: {
  aberto: boolean;
  orgao: Orgao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setForm(Object.fromEntries(CAMPOS.map(c => [c, (orgao as any)?.[c] ?? ""])) as Formulario);
  }, [aberto, orgao]);

  const set = (campo: Campo, valor: string) => setForm(f => ({ ...f, [campo]: valor }));

  async function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome do órgão."); return; }

    setSalvando(true);
    try {
      // Vazio vai como null: é assim que a edição apaga um telefone antigo.
      const dados = Object.fromEntries(CAMPOS.map(c => [c, form[c].trim() || null]));
      await complianceService.salvarOrgao(orgao?.id ?? null, dados);
      useToastStore.getState().success(orgao ? "Órgão atualizado" : "Órgão cadastrado");
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={orgao ? `Editar ${orgao.nome}` : "Novo órgão emissor"}
      onFechar={onFechar}
      largura={640}
    >
      <div className="panel__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {erro && <Aviso tom="critico">{erro}</Aviso>}

        <FormGrid>
          <FormField label="Nome" obrigatorio largura="total">
            <input className="input-o" value={form.nome} onChange={e => set("nome", e.target.value)}
              placeholder="Corpo de Bombeiros do Estado de São Paulo" maxLength={160} />
          </FormField>
          <FormField label="Sigla">
            <input className="input-o" value={form.sigla} onChange={e => set("sigla", e.target.value)}
              placeholder="CBPMESP, CETESB…" maxLength={30} />
          </FormField>
          <FormField label="Contato">
            <input className="input-o" value={form.contato} onChange={e => set("contato", e.target.value)}
              placeholder="Pessoa ou setor" maxLength={160} />
          </FormField>
          <FormField label="Telefone">
            <input className="input-o" value={form.telefone} onChange={e => set("telefone", e.target.value)} maxLength={40} />
          </FormField>
          <FormField label="E-mail">
            <input type="email" className="input-o" value={form.email} onChange={e => set("email", e.target.value)} maxLength={160} />
          </FormField>
          <FormField label="Site" largura="total">
            <input className="input-o" value={form.site} onChange={e => set("site", e.target.value)}
              placeholder="https://" maxLength={200} />
          </FormField>
          <FormField label="Endereço" largura="total">
            <input className="input-o" value={form.endereco} onChange={e => set("endereco", e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Observações" largura="total">
            <textarea className="input-o" rows={3} value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)} maxLength={2000} />
          </FormField>
        </FormGrid>
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
