"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  checklistService, Checklist, ItemChecklist, ModeloChecklist,
  EVENTOS, RESPONSAVEIS, EventoChecklist,
} from "@/lib/people/checklist.service";
import { Panel, PermissionDenied, StatusBadge } from "@/components/data-ui";
import { ClipboardList, Check, Clock, AlertTriangle, Plus, Trash2 } from "lucide-react";

/**
 * Checklist de admissão e desligamento do colaborador.
 *
 * O que importa aqui não é a barra de progresso — é a lista com nome, dono e
 * prazo de cada pendência. "70%" não diz a ninguém o que fazer; "exame
 * admissional, RH, 6 dias atrasado" diz.
 */

const ROTULO_RESP: Record<string, string> =
  Object.fromEntries(RESPONSAVEIS.map(r => [r.value, r.label]));

const ROTULO_EVENTO: Record<string, string> =
  Object.fromEntries(EVENTOS.map(e => [e.value, e.label]));

type Props = {
  collaboratorId: string;
  podeGerenciar: boolean;
};

export default function AbaChecklist({ collaboratorId, podeGerenciar }: Props) {
  const [listas, setListas] = useState<Checklist[]>([]);
  const [modelos, setModelos] = useState<ModeloChecklist[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState<EventoChecklist | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await checklistService.doColaborador(collaboratorId);
      setListas(r.data ?? []);
      setSemPermissao(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar os checklists");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!podeGerenciar) return;
    checklistService.modelos().then(r => setModelos(r.data ?? [])).catch(() => setModelos([]));
  }, [podeGerenciar]);

  async function abrir(evento: EventoChecklist) {
    setAbrindo(evento);
    try {
      await checklistService.abrir(collaboratorId, evento);
      useToastStore.getState().success(`Checklist de ${ROTULO_EVENTO[evento].toLowerCase()} aberto`);
      carregar();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setAbrindo(null);
    }
  }

  async function alternar(item: ItemChecklist) {
    try {
      await checklistService.marcarItem(item.id, item.situacao !== "concluido");
      carregar();
    } catch { /* interceptor */ }
  }

  async function excluir(c: Checklist) {
    if (!confirm(`Remover o checklist "${c.nome}"? O que já foi marcado será perdido.`)) return;
    try {
      await checklistService.excluir(c.id);
      useToastStore.getState().success("Checklist removido");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver os checklists deste colaborador." />;
  }
  if (carregando) {
    return <Panel title="CHECKLIST"><Texto>Carregando…</Texto></Panel>;
  }
  if (erro) {
    return <Panel title="CHECKLIST"><Texto>{erro}</Texto></Panel>;
  }

  const eventosAbertos = new Set(listas.map(l => l.evento));
  const faltando = EVENTOS.filter(e => !eventosAbertos.has(e.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {listas.length === 0 && (
        <Panel title="CHECKLIST">
          <Texto>
            Nenhum checklist aberto para este colaborador.{" "}
            {podeGerenciar
              ? modelos.length === 0
                ? "Crie um modelo em Catálogos › Checklists antes de abrir o primeiro."
                : "Abra o de admissão para acompanhar o que falta para a entrada."
              : ""}
          </Texto>
        </Panel>
      )}

      {listas.map(c => (
        <Panel
          key={c.id}
          title={`${ROTULO_EVENTO[c.evento].toUpperCase()} · ${c.nome.toUpperCase()}`}
          actions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge
                label={c.completo ? "Concluído" : `${c.percentual}%`}
                tone={c.completo ? "ok" : c.atrasados > 0 ? "critico" : "atencao"}
              />
              {podeGerenciar && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => excluir(c)}
                  title="Remover checklist"
                  style={{ color: "var(--accent-red)" }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          }
        >
          <Barra percentual={c.percentual} completo={c.completo} />

          {c.atrasados > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "10px 0 4px" }}>
              <AlertTriangle size={13} style={{ color: "var(--accent-red)" }} />
              <span style={{ fontSize: 12, color: "var(--accent-red)" }}>
                {c.atrasados === 1 ? "1 item atrasado" : `${c.atrasados} itens atrasados`}
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
            {c.itens.map(i => (
              <ItemLinha
                key={i.id}
                item={i}
                podeGerenciar={podeGerenciar}
                onAlternar={() => alternar(i)}
              />
            ))}
          </div>
        </Panel>
      ))}

      {podeGerenciar && faltando.length > 0 && modelos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {faltando.map(e => (
            <button
              key={e.value}
              type="button"
              className="btn btn-ghost"
              disabled={abrindo === e.value}
              onClick={() => abrir(e.value)}
            >
              <Plus size={13} />
              {abrindo === e.value ? "Abrindo..." : `Abrir checklist de ${e.label.toLowerCase()}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Barra({ percentual, completo }: { percentual: number; completo: boolean }) {
  return (
    <div style={{ height: 7, borderRadius: 999, overflow: "hidden", background: "var(--bg-tertiary)" }}>
      <div
        style={{
          width: `${percentual}%`, height: "100%",
          background: completo ? "var(--accent-emerald, #10b981)" : "var(--accent-violet)",
          transition: "width .4s ease",
        }}
      />
    </div>
  );
}

function ItemLinha({
  item, podeGerenciar, onAlternar,
}: {
  item: ItemChecklist; podeGerenciar: boolean; onAlternar: () => void;
}) {
  const concluido = item.situacao === "concluido";
  const atrasado = item.situacao === "atrasado";

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "9px 12px", borderRadius: 11,
        background: "var(--bg-secondary)",
        border: `1px solid ${atrasado
          ? "color-mix(in srgb, var(--accent-red) 28%, transparent)"
          : "var(--border-subtle)"}`,
        opacity: concluido ? 0.72 : 1,
      }}
    >
      <button
        type="button"
        onClick={onAlternar}
        disabled={!podeGerenciar}
        title={concluido ? "Desmarcar" : "Marcar como concluído"}
        style={{
          width: 19, height: 19, borderRadius: 6, flexShrink: 0, marginTop: 1,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          cursor: podeGerenciar ? "pointer" : "default",
          background: concluido ? "var(--accent-emerald, #10b981)" : "transparent",
          border: `1.5px solid ${concluido ? "var(--accent-emerald, #10b981)" : "var(--border-medium)"}`,
          color: "#fff",
        }}
      >
        {concluido && <Check size={12} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5, fontWeight: 600,
            textDecoration: concluido ? "line-through" : "none",
          }}
        >
          {item.titulo}
          {!item.obrigatorio && (
            <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · opcional</span>
          )}
        </div>
        {item.descricao && (
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.5 }}>
            {item.descricao}
          </div>
        )}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 3,
            fontSize: 11, color: atrasado ? "var(--accent-red)" : "var(--text-muted)",
          }}
        >
          <span>{ROTULO_RESP[item.responsavel] ?? item.responsavel}</span>
          {item.diasParaPrazo !== null && !concluido && (
            <>
              <span>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock size={10} />
                {item.diasParaPrazo < 0
                  ? `${Math.abs(item.diasParaPrazo)} ${Math.abs(item.diasParaPrazo) === 1 ? "dia" : "dias"} de atraso`
                  : item.diasParaPrazo === 0
                    ? "vence hoje"
                    : `${item.diasParaPrazo} ${item.diasParaPrazo === 1 ? "dia" : "dias"} para o prazo`}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
      {children}
    </p>
  );
}
