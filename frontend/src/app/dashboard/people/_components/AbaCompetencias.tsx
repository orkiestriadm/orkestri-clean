"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  skillsService, Skill, AtribuicaoSkill, NIVEIS_SKILL, NivelSkill, ROTULO_NIVEL,
} from "@/lib/people/org.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  RowActions, RowAction,
} from "@/components/data-ui";
import { Sparkles, Trash2 } from "lucide-react";

/**
 * Competências do colaborador.
 *
 * O nível é editável direto na linha, sem modal: mudar de pleno para sênior é
 * um clique que acontece em avaliação e em promoção, e abrir uma janela para
 * isso transforma uma tarefa de segundos numa de vários passos.
 */

type Props = {
  collaboratorId: string;
  podeGerenciar: boolean;
};

export default function AbaCompetencias({ collaboratorId, podeGerenciar }: Props) {
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoSkill[]>([]);
  const [catalogo, setCatalogo] = useState<Skill[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [novaSkillId, setNovaSkillId] = useState("");
  const [novoNivel, setNovoNivel] = useState<NivelSkill>("pleno");

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setAtribuicoes(await skillsService.doColaborador(collaboratorId));
    } catch (e: any) {
      setAtribuicoes([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar as competências.");
    } finally {
      setCarregando(false);
    }
    // O catálogo é apoio: falhar aqui não deve derrubar a aba.
    try { setCatalogo(await skillsService.listar()); } catch { setCatalogo([]); }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  const disponiveis = catalogo.filter(
    s => s.ativo && !atribuicoes.some(a => a.skill.id === s.id),
  );

  async function atribuir() {
    if (!novaSkillId) return;
    try {
      await skillsService.atribuir(collaboratorId, novaSkillId, novoNivel);
      useToastStore.getState().success("Competência atribuída");
      setNovaSkillId("");
      carregar();
    } catch { /* interceptor */ }
  }

  async function mudarNivel(a: AtribuicaoSkill, nivel: NivelSkill) {
    // Otimista: o select já mostra o novo valor, e um erro recarrega a verdade.
    setAtribuicoes(atual => atual.map(x => (x.id === a.id ? { ...x, nivel } : x)));
    try {
      await skillsService.mudarNivel(collaboratorId, a.id, nivel);
    } catch {
      carregar();
    }
  }

  async function remover(a: AtribuicaoSkill) {
    if (!confirm(`Remover "${a.skill.nome}" deste colaborador?`)) return;
    try {
      await skillsService.remover(collaboratorId, a.id);
      useToastStore.getState().success("Competência removida");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver as competências deste colaborador." />;
  }

  const COLUNAS = ["Competência", "Categoria", "Nível", ""];

  return (
    <Panel title={`COMPETÊNCIAS (${atribuicoes.length})`}>
      <TableCard>
        <thead><tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {carregando ? (
            <LoadingRows colSpan={COLUNAS.length} rows={3} />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
          ) : atribuicoes.length === 0 ? (
            <EmptyState
              colSpan={COLUNAS.length}
              icon={<Sparkles size={20} />}
              title="Nenhuma competência atribuída"
              hint={podeGerenciar ? "Atribua competências do catálogo da organização." : undefined}
            />
          ) : (
            atribuicoes.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    {a.skill.cor && (
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: a.skill.cor, flexShrink: 0 }} />
                    )}
                    {a.skill.nome}
                  </div>
                </td>
                <td>{a.skill.categoria || "—"}</td>
                <td>
                  {podeGerenciar ? (
                    <select
                      className="input-o"
                      value={a.nivel}
                      onChange={e => mudarNivel(a, e.target.value as NivelSkill)}
                      style={{ height: 30, fontSize: 12, padding: "0 8px" }}
                    >
                      {NIVEIS_SKILL.map(n => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
                    </select>
                  ) : (
                    ROTULO_NIVEL[a.nivel] ?? a.nivel
                  )}
                </td>
                <td>
                  {podeGerenciar && (
                    <RowActions>
                      <RowAction tone="danger" title="Remover" onClick={() => remover(a)}>
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

      {podeGerenciar && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="mono-cap" style={{ display: "block", color: "var(--text-muted)", marginBottom: 5 }}>
              Atribuir competência
            </label>
            <select
              className="input-o"
              value={novaSkillId}
              onChange={e => setNovaSkillId(e.target.value)}
            >
              <option value="">
                {catalogo.length === 0
                  ? "Nenhuma competência no catálogo"
                  : disponiveis.length === 0
                    ? "Todas as competências já atribuídas"
                    : "—"}
              </option>
              {disponiveis.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div style={{ minWidth: 140 }}>
            <label className="mono-cap" style={{ display: "block", color: "var(--text-muted)", marginBottom: 5 }}>
              Nível
            </label>
            <select
              className="input-o"
              value={novoNivel}
              onChange={e => setNovoNivel(e.target.value as NivelSkill)}
            >
              {NIVEIS_SKILL.map(n => <option key={n} value={n}>{ROTULO_NIVEL[n]}</option>)}
            </select>
          </div>

          <button type="button" className="btn btn-ghost" onClick={atribuir} disabled={!novaSkillId}>
            Atribuir
          </button>
        </div>
      )}
    </Panel>
  );
}
