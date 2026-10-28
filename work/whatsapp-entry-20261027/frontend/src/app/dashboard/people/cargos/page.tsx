"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import { usePositions } from "@/hooks/usePositions";
import { positionsService, Cargo } from "@/lib/people/positions.service";
import {
  PageBody, BackLink, PageHeader, TableCard, EmptyState, LoadingRows,
  ErrorState, PermissionDenied, StatusBadge, RowActions, RowAction, Tabs,
} from "@/components/data-ui";
import { Briefcase, Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import CargoForm from "../_components/CargoForm";
import ImportarCargos from "../_components/ImportarCargos";
import AbaFaixas from "../_components/AbaFaixas";

/**
 * Catálogo de cargos.
 *
 * A coluna de colaboradores não é enfeite: ela explica por que o botão de
 * excluir some. Cargo em uso não pode ser apagado — apagá-lo deixaria gente
 * apontando para o nada —, então a saída é desativar, que tira dos seletores
 * sem quebrar o histórico.
 */

function pode(user: any, perm: string): boolean {
  if (user?.isMaster) return true;
  const perms: string[] = user?.permissions ?? [];
  return perms.includes("*") || perms.includes(perm);
}

type AbaCargos = "cargos" | "faixas";

export default function CargosPage() {
  const user = useAuthStore(s => s.user);
  const [aba, setAba] = useState<AbaCargos>("cargos");
  const [incluirInativos, setIncluirInativos] = useState(false);
  const { cargos, soltos, carregando, erro, semPermissao, recarregar } = usePositions(incluirInativos);
  const [editando, setEditando] = useState<Cargo | null>(null);
  const [criando, setCriando] = useState(false);
  const [importando, setImportando] = useState(false);

  const podeGerenciar = pode(user, "people.cargo:gerenciar");
  // Faixa é dado de remuneração, não de catálogo: quem organiza os cargos não
  // vê nem define quanto cada um vale sem a permissão de salário.
  const podeVerFaixa = pode(user, "people.salario:ver");
  const podeGerirFaixa = pode(user, "people.salario:gerenciar");

  async function excluir(cargo: Cargo) {
    if (!confirm(`Excluir o cargo "${cargo.titulo}"?`)) return;
    try {
      await positionsService.excluir(cargo.id);
      useToastStore.getState().success("Cargo excluído");
      recarregar();
    } catch { /* o interceptor já mostrou o motivo do backend */ }
  }

  async function alternar(cargo: Cargo) {
    try {
      await positionsService.alternarAtivo(cargo.id, cargo, !cargo.ativo);
      useToastStore.getState().success(cargo.ativo ? "Cargo desativado" : "Cargo reativado");
      recarregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Cargo", "Código", "Nível", "Colaboradores", "Situação", ""];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          <PageHeader
            icon={<Briefcase size={19} />}
            title="Cargos"
            subtitle="Catálogo de cargos da organização"
            actions={
              podeGerenciar && aba === "cargos" && (
                <button type="button" className="btn btn-primary" onClick={() => setCriando(true)}>
                  <Plus size={14} /> Novo cargo
                </button>
              )
            }
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o catálogo de cargos." />
          ) : (
            <>
              {/* Uma aba só não é aba: sem permissão de salário, a tela continua
                  sendo a lista de cargos, sem barra nenhuma. */}
              {podeVerFaixa && (
                <Tabs<AbaCargos>
                  tabs={[
                    { id: "cargos", label: "Cargos" },
                    { id: "faixas", label: "Faixas salariais" },
                  ]}
                  active={aba}
                  onChange={setAba}
                />
              )}

              {aba === "faixas" && podeVerFaixa ? (
                <AbaFaixas podeGerenciar={podeGerirFaixa} />
              ) : (
                <>
              {podeGerenciar && soltos.length > 0 && (
                <PainelSoltos soltos={soltos} onAbrir={() => setImportando(true)} />
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={incluirInativos}
                    onChange={e => setIncluirInativos(e.target.checked)}
                  />
                  Mostrar cargos desativados
                </label>
              </div>

              <TableCard>
                <thead>
                  <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {carregando ? (
                    <LoadingRows colSpan={COLUNAS.length} rows={4} />
                  ) : erro ? (
                    <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
                  ) : cargos.length === 0 ? (
                    <EmptyState
                      colSpan={COLUNAS.length}
                      icon={<Briefcase size={20} />}
                      title="Nenhum cargo cadastrado"
                      hint={
                        podeGerenciar
                          ? "Crie os cargos da organização para padronizar o cadastro e permitir análise por cargo."
                          : undefined
                      }
                    />
                  ) : (
                    cargos.map(cargo => (
                      <tr key={cargo.id} style={{ opacity: cargo.ativo ? 1 : 0.6 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{cargo.titulo}</div>
                          {cargo.descricao && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {cargo.descricao}
                            </div>
                          )}
                        </td>
                        <td className="num">{cargo.codigo || "—"}</td>
                        <td>{cargo.nivel || "—"}</td>
                        <td className="num">{cargo.colaboradores}</td>
                        <td>
                          <StatusBadge
                            label={cargo.ativo ? "Ativo" : "Desativado"}
                            tone={cargo.ativo ? "ok" : "neutro"}
                          />
                        </td>
                        <td>
                          {podeGerenciar && (
                            <RowActions>
                              <RowAction tone="view" title="Editar" onClick={() => setEditando(cargo)}>
                                <Pencil size={13} />
                              </RowAction>
                              <RowAction
                                tone="view"
                                title={cargo.ativo ? "Desativar" : "Reativar"}
                                onClick={() => alternar(cargo)}
                              >
                                {cargo.ativo ? <PowerOff size={13} /> : <Power size={13} />}
                              </RowAction>
                              {/* Em uso, a exclusão sempre falharia: o backend a
                                  recusa para não deixar colaborador órfão. */}
                              {cargo.colaboradores === 0 && (
                                <RowAction tone="danger" title="Excluir" onClick={() => excluir(cargo)}>
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
            </>
          )}
        </PageBody>
      </div>

      <CargoForm
        aberto={criando || !!editando}
        cargo={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={recarregar}
      />
      <ImportarCargos
        aberto={importando}
        soltos={soltos}
        onFechar={() => setImportando(false)}
        onImportado={recarregar}
      />
    </div>
  );
}

function PainelSoltos({ soltos, onAbrir }: { soltos: { cargo: string; total: number }[]; onAbrir: () => void }) {
  const pessoas = soltos.reduce((s, c) => s + c.total, 0);

  return (
    <div
      style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        padding: "14px 16px", borderRadius: 14, marginBottom: 16,
        background: "color-mix(in srgb, var(--accent-amber) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
      }}
    >
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>
          <span className="metric">{soltos.length}</span>{" "}
          {soltos.length === 1 ? "cargo escrito à mão" : "cargos escritos à mão"} no cadastro antigo
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Afetam <span className="metric">{pessoas}</span>{" "}
          {pessoas === 1 ? "colaborador" : "colaboradores"}. Enquanto forem só texto,
          não entram em nenhuma análise por cargo.
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onAbrir}>
        Revisar e importar
      </button>
    </div>
  );
}
