"use client";

import { useCallback, useEffect, useState } from "react";
import {
  review360Service, Pendencia360, MeuResultado360, ROTULO_ORIGEM,
} from "@/lib/people/review360.service";
import { meService } from "@/lib/people/me.service";
import {
  Panel, StatusBadge, ErrorState, FormField, FormActions, Modal,
} from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { ClipboardCheck, UserCheck, Users } from "lucide-react";
import Vazio from "./Vazio";

/**
 * Minhas avaliações — o que tenho a responder e o que recebi.
 *
 * O ciclo era gestor → liderado, e o colaborador não participava dele em lugar
 * nenhum: nem para se avaliar, nem para avaliar colegas, nem para ler o
 * resultado. Esta é a porta de entrada dele.
 *
 * O resultado só aparece depois de FINALIZADA a avaliação: ler as respostas
 * enquanto o gestor ainda decide transformaria o ciclo numa negociação.
 */

export default function MinhasAvaliacoes() {
  const [pendencias, setPendencias] = useState<Pendencia360[]>([]);
  const [resultados, setResultados] = useState<MeuResultado360[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [respondendo, setRespondendo] = useState<Pendencia360 | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const p = await review360Service.minhasPendencias();
      setPendencias(p.data ?? []);

      // Os resultados vêm das avaliações finalizadas que já apareciam na aba
      // de desenvolvimento — reaproveitar evita um endpoint só para listar
      // ciclos que a pessoa já tem à mão.
      const dev = await meService.desenvolvimento();
      const finalizadas = (dev.data.avaliacoes ?? []).map((a: any) => a.ciclo);
      const lidos = await Promise.all(
        finalizadas.map((c: string) =>
          review360Service.meuResultado(c).then(r => r.data).catch(() => null),
        ),
      );
      setResultados(lidos.filter(Boolean) as MeuResultado360[]);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar as suas avaliações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;
  if (carregando) return <Panel><p className="muted">Carregando…</p></Panel>;

  return (
    <>
      <Panel title="Aguardando a sua resposta">
        {pendencias.length === 0 ? (
          <Vazio
            icon={<ClipboardCheck size={28} />}
            titulo="Nada para responder"
            dica="Quando abrirem um ciclo com a sua participação, aparece aqui."
          />
        ) : (
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {pendencias.map(p => (
              <li key={p.id} className="row-line">
                <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                  {p.origem === "autoavaliacao"
                    ? <UserCheck size={15} style={{ flexShrink: 0 }} />
                    : <Users size={15} className="muted" style={{ flexShrink: 0 }} />}
                  <span>
                    <strong>
                      {p.origem === "autoavaliacao"
                        ? "Sua autoavaliação"
                        : `Avaliar ${p.sobre?.nome ?? "colega"}`}
                    </strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Ciclo {p.ciclo} · {p.rotuloOrigem}
                    </div>
                  </span>
                </span>
                <button type="button" className="btn-primary" onClick={() => setRespondendo(p)}>
                  Responder
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {resultados.map(r => <Resultado key={r.ciclo} r={r} />)}

      {respondendo && (
        <Responder
          pendencia={respondendo}
          onFechar={() => setRespondendo(null)}
          onRespondeu={() => { setRespondendo(null); carregar(); }}
        />
      )}
    </>
  );
}

/* ── Resultado ───────────────────────────────────────────────────────────── */

function Resultado({ r }: { r: MeuResultado360 }) {
  return (
    <Panel title={`Resultado do ciclo ${r.ciclo}`}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 12 }}>
        <div>
          <div className="mono-cap muted" style={{ fontSize: 11 }}>Nota do gestor</div>
          <div className="metric" style={{ fontSize: 28 }}>{r.notaGestor ?? "—"}</div>
        </div>
        {r.resumo.map(o => (
          <div key={o.origem}>
            <div className="mono-cap muted" style={{ fontSize: 11 }}>{ROTULO_ORIGEM[o.origem]}</div>
            <div className="metric" style={{ fontSize: 28 }}>
              {o.media ?? "—"}
            </div>
            {o.omitidaPorAnonimato && (
              // A explicação é obrigatória: sem ela, "—" parece defeito.
              <div className="muted" style={{ fontSize: 11, maxWidth: 190 }}>
                {o.respondidas} resposta(s) — poucas para mostrar a média sem
                identificar quem respondeu.
              </div>
            )}
          </div>
        ))}
      </div>

      {r.divergenciaAutoavaliacao !== null && (
        <p className="muted" style={{ fontSize: 13 }}>
          {r.divergenciaAutoavaliacao > 0
            ? `Você se avaliou ${r.divergenciaAutoavaliacao} ponto(s) acima do seu gestor.`
            : r.divergenciaAutoavaliacao < 0
              ? `Você se avaliou ${Math.abs(r.divergenciaAutoavaliacao)} ponto(s) abaixo do seu gestor.`
              : "Sua autoavaliação coincidiu com a do seu gestor."}
          {" "}É um bom ponto de partida para a conversa com ele.
        </p>
      )}

      {r.comentarios.length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>O que disseram</h4>
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {r.comentarios.map((c, i) => (
              <li key={i} className="row-line" style={{ alignItems: "flex-start" }}>
                <span style={{ minWidth: 0 }}>{c.texto}</span>
                <StatusBadge
                  label={c.tipo === "forte" ? "ponto forte" : "a desenvolver"}
                  tone={c.tipo === "forte" ? "ok" : "atencao"}
                />
              </li>
            ))}
          </ul>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Os comentários vêm sem autor — é o que permite a quem responde ser franco.
          </p>
        </>
      )}
    </Panel>
  );
}

/* ── Resposta ────────────────────────────────────────────────────────────── */

const NOTAS = [1, 2, 3, 4, 5];

function Responder({
  pendencia, onFechar, onRespondeu,
}: {
  pendencia: Pendencia360;
  onFechar: () => void;
  onRespondeu: () => void;
}) {
  const [nota, setNota] = useState<number | undefined>();
  const [fortes, setFortes] = useState("");
  const [melhoria, setMelhoria] = useState("");
  const [enviando, setEnviando] = useState(false);

  const auto = pendencia.origem === "autoavaliacao";
  // O backend recusa resposta vazia — participação que não diz nada some da
  // lista de pendentes sem ter dito nada. A tela avisa antes de tentar.
  const pode = (nota !== undefined || fortes.trim() || melhoria.trim()) && !enviando;

  async function enviar() {
    setEnviando(true);
    try {
      await review360Service.responder(pendencia.id, {
        nota, pontosFortes: fortes, pontosMelhoria: melhoria,
      });
      useToastStore.getState().success("Resposta registrada");
      onRespondeu();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto
      titulo={auto ? "Sua autoavaliação" : `Avaliar ${pendencia.sobre?.nome ?? "colega"}`}
      subtitulo={`Ciclo ${pendencia.ciclo}`}
      onFechar={onFechar}
      largura={600}
    >
      <div style={{ display: "grid", gap: 14 }}>
        {!auto && (
          <p className="muted" style={{ fontSize: 13 }}>
            A pessoa avaliada vê os comentários <strong>sem saber de quem vieram</strong>, e
            só depois que o gestor finalizar o ciclo.
          </p>
        )}

        <FormField label="Nota" dica="De 1 a 5">
          <div style={{ display: "flex", gap: 6 }}>
            {NOTAS.map(n => (
              <button
                key={n}
                type="button"
                className={nota === n ? "btn-primary" : "btn-secondary"}
                onClick={() => setNota(nota === n ? undefined : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={auto ? "O que você fez bem" : "Pontos fortes"}>
          <textarea
            rows={3}
            maxLength={4000}
            value={fortes}
            onChange={e => setFortes(e.target.value)}
            placeholder={auto ? "O que deu certo neste ciclo" : "O que essa pessoa faz bem"}
          />
        </FormField>

        <FormField label={auto ? "O que você quer desenvolver" : "O que pode melhorar"}>
          <textarea
            rows={3}
            maxLength={4000}
            value={melhoria}
            onChange={e => setMelhoria(e.target.value)}
          />
        </FormField>

        <FormActions>
          <button type="button" className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!pode} onClick={enviar}>
            {enviando ? "Enviando…" : "Enviar resposta"}
          </button>
        </FormActions>

        <p className="muted" style={{ fontSize: 12 }}>
          A resposta não pode ser editada depois de enviada.
        </p>
      </div>
    </Modal>
  );
}
