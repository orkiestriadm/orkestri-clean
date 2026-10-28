"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  feedbackService, Feedback, TipoFeedback, TIPOS_FEEDBACK,
} from "@/lib/people/salary.service";
import {
  Panel, Modal, FormGrid, FormField, FormActions, StatusBadge, BadgeTone,
} from "@/components/data-ui";
import { MessageSquare, Plus, Trash2, Lock } from "lucide-react";
import { formatarDataBR } from "@/lib/datas";

/**
 * Feedback contínuo.
 *
 * Fecha PEOPLE_HUB_BLUEPRINT.md §14. Existe porque avaliação semestral sem
 * registro no meio do caminho vira surpresa: ninguém lembra de março em
 * novembro, e a nota acaba refletindo as últimas semanas.
 *
 * O privado só chega aqui para quem pode registrar feedback — o backend nem
 * inclui no JSON dos demais. O cadeado na tela é sinal, não a proteção.
 */

const ROTULO_TIPO = new Map(TIPOS_FEEDBACK.map(t => [t.value, t.label]));

const TOM: Record<TipoFeedback, BadgeTone> = {
  elogio: "ok",
  correcao: "atencao",
  um_a_um: "info",
  reconhecimento: "ok",
  outro: "neutro",
};

const fmtData = (d: string) =>
  formatarDataBR(d);

type Props = {
  collaboratorId: string;
  podeRegistrar: boolean;
};

export default function SecaoFeedback({ collaboratorId, podeRegistrar }: Props) {
  const [itens, setItens] = useState<Feedback[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null); setSemPermissao(false);
    try {
      setItens((await feedbackService.listar(collaboratorId)).data ?? []);
    } catch (e: any) {
      setItens([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os feedbacks.");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(f: Feedback) {
    if (!confirm("Remover este feedback?")) return;
    try {
      await feedbackService.excluir(f.id);
      useToastStore.getState().success("Feedback removido");
      carregar();
    } catch { /* interceptor */ }
  }

  // Sem permissão, a seção some em vez de ocupar espaço com um aviso: a aba
  // Desenvolvimento continua útil pelos treinamentos.
  if (semPermissao) return null;

  return (
    <>
      <Panel
        title={`FEEDBACK (${itens.length})`}
        actions={
          podeRegistrar && (
            <button type="button" className="btn btn-ghost" onClick={() => setRegistrando(true)}>
              <Plus size={13} /> Registrar
            </button>
          )
        }
      >
        {carregando ? (
          <div className="skeleton" style={{ height: 90, borderRadius: 12 }} />
        ) : erro ? (
          <p style={{ fontSize: 12.5, color: "var(--accent-red)", margin: 0 }}>{erro}</p>
        ) : itens.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Nenhum feedback registrado.{" "}
            {podeRegistrar && "Anotar elogio e correção durante o ciclo evita que a avaliação vire surpresa."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {itens.map(f => (
              <div
                key={f.id}
                style={{
                  padding: "12px 14px", borderRadius: 12,
                  background: "var(--bg-secondary)",
                  border: `1px solid ${
                    f.visibilidade === "privado"
                      ? "color-mix(in srgb, var(--accent-amber) 28%, transparent)"
                      : "var(--border-subtle)"
                  }`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <StatusBadge label={ROTULO_TIPO.get(f.tipo) ?? f.tipo} tone={TOM[f.tipo] ?? "neutro"} />
                  {f.visibilidade === "privado" && (
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent-amber)" }}
                      title="Só quem registra feedback vê esta anotação"
                    >
                      <Lock size={11} /> privado
                    </span>
                  )}
                  {f.ciclo && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ciclo {f.ciclo}</span>
                  )}
                  <span className="num" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {fmtData(f.ocorridoEm)}
                  </span>
                  {podeRegistrar && (
                    <button
                      type="button" className="btn-icon" aria-label="Remover"
                      onClick={() => excluir(f)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <p style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {f.conteudo}
                </p>

                {f.autorNome && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                    por {f.autorNome}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <RegistrarFeedback
        aberto={registrando}
        collaboratorId={collaboratorId}
        onFechar={() => setRegistrando(false)}
        onRegistrado={carregar}
      />
    </>
  );
}

function RegistrarFeedback({
  aberto, collaboratorId, onFechar, onRegistrado,
}: { aberto: boolean; collaboratorId: string; onFechar: () => void; onRegistrado: () => void }) {
  const [tipo, setTipo] = useState<TipoFeedback>("elogio");
  const [conteudo, setConteudo] = useState("");
  const [ocorridoEm, setOcorridoEm] = useState("");
  const [privado, setPrivado] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setTipo("elogio");
    setConteudo("");
    setOcorridoEm(new Date().toISOString().slice(0, 10));
    setPrivado(false);
    setErro("");
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!conteudo.trim()) { setErro("Escreva o feedback"); return; }

    setSalvando(true);
    try {
      await feedbackService.criar(collaboratorId, {
        tipo, conteudo, ocorridoEm,
        visibilidade: privado ? "privado" : "compartilhado",
      });
      useToastStore.getState().success("Feedback registrado");
      onRegistrado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) setErro(Array.isArray(msg) ? msg.join(". ") : msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Registrar feedback" onFechar={onFechar} largura={540}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Tipo" obrigatorio>
            <select className="input-o" value={tipo} onChange={e => setTipo(e.target.value as TipoFeedback)}>
              {TIPOS_FEEDBACK.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FormField>

          <FormField label="Quando aconteceu">
            <input
              type="date" className="input-o"
              value={ocorridoEm} onChange={e => setOcorridoEm(e.target.value)}
            />
          </FormField>

          <FormField label="Feedback" obrigatorio erro={erro} largura="total">
            <textarea
              className="input-o" rows={5} maxLength={4000} autoFocus
              value={conteudo} onChange={e => setConteudo(e.target.value)}
              placeholder="Descreva o fato observado, não o traço de personalidade."
            />
          </FormField>

          <label
            style={{
              gridColumn: "1 / -1", display: "flex", gap: 9, alignItems: "flex-start",
              cursor: "pointer", padding: "10px 12px", borderRadius: 10,
              background: "var(--bg-hover)", border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox" checked={privado}
              onChange={e => setPrivado(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text-primary)" }}>Anotação privada</strong> — o
              colaborador não vê. Use para o que ainda vai virar conversa; feedback que a
              pessoa não lê não muda comportamento.
            </span>
          </label>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Registrando..." : "Registrar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
