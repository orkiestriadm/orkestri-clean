"use client";

import { useCallback, useEffect, useState } from "react";
import {
  review360Service, Painel360 as Dados, EntradaPainel, Origem360, ROTULO_ORIGEM,
} from "@/lib/people/review360.service";
import { employeesService } from "@/lib/people/employees.service";
import {
  Modal, StatusBadge, FormGrid, FormField, FormActions, ErrorState,
} from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { Users, Trash2, UserCheck } from "lucide-react";

/**
 * O 360 pela ótica de quem CONDUZ a avaliação.
 *
 * Faltava. O backend inteiro existia e só o lado do avaliado tinha tela: abrir
 * um ciclo 360 exigia rodar script. Rota testada e sem botão é funcionalidade
 * que não existe para quem usa.
 *
 * Aqui NÃO há omissão por anonimato — quem conduz precisa do dado para decidir
 * e já sabe quem convidou. A omissão vive do outro lado, no Meu RH.
 *
 * A divergência entre a autoavaliação e a nota do gestor abre o painel: é o
 * número que aponta para uma conversa específica, e o resto é contexto dele.
 */

type Props = {
  reviewId: string;
  ciclo: string;
  collaboratorId: string;
  podeGerenciar: boolean;
  onFechar: () => void;
};

export default function Painel360({
  reviewId, ciclo, collaboratorId, podeGerenciar, onFechar,
}: Props) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await review360Service.painel(reviewId);
      setDados(r.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar o 360.");
    } finally {
      setCarregando(false);
    }
  }, [reviewId]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <Modal
      aberto
      titulo={`Avaliação 360 — ciclo ${ciclo}`}
      subtitulo="Autoavaliação e pares. A nota final continua sendo a sua."
      onFechar={onFechar}
      largura={680}
    >
      {erro && <ErrorState detail={erro} onRetry={carregar} />}
      {carregando && <p className="muted">Carregando…</p>}

      {dados && (
        <div style={{ display: "grid", gap: 16 }}>
          <Cabecalho dados={dados} />

          {podeGerenciar && (
            <Convidar
              reviewId={reviewId}
              collaboratorId={collaboratorId}
              jaConvidados={dados.entradas.map(e => e.avaliador.id)}
              onConvidou={carregar}
            />
          )}

          <Entradas
            entradas={dados.entradas}
            podeGerenciar={podeGerenciar}
            onMudou={carregar}
          />
        </div>
      )}
    </Modal>
  );
}

/* ── Números ─────────────────────────────────────────────────────────────── */

function Cabecalho({ dados }: { dados: Dados }) {
  const d = dados.divergenciaAutoavaliacao;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
        <Numero rotulo="Sua nota" valor={dados.notaGestor} />
        {dados.resumo.map(o => (
          <Numero
            key={o.origem}
            rotulo={ROTULO_ORIGEM[o.origem]}
            valor={o.media}
            nota={`${o.respondidas} de ${o.convidados} respondeu(ram)`}
          />
        ))}
      </div>

      {d !== null && (
        // O texto diz o que fazer com o número, não só qual é ele.
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          {d > 0
            ? `A pessoa se avaliou ${d} ponto(s) ACIMA de você. Vale entender o que ela viu que você não viu — ou o que faltou de retorno ao longo do ciclo.`
            : d < 0
              ? `A pessoa se avaliou ${Math.abs(d)} ponto(s) ABAIXO de você. Quem se subestima costuma não saber que vai bem.`
              : "A autoavaliação coincidiu com a sua — bom sinal de que o retorno ao longo do ciclo funcionou."}
        </p>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: number | null; nota?: string }) {
  return (
    <div>
      <div className="mono-cap muted" style={{ fontSize: 11 }}>{rotulo}</div>
      <div className="metric" style={{ fontSize: 26 }}>{valor ?? "—"}</div>
      {nota && <div className="muted" style={{ fontSize: 11 }}>{nota}</div>}
    </div>
  );
}

/* ── Convite ─────────────────────────────────────────────────────────────── */

function Convidar({
  reviewId, collaboratorId, jaConvidados, onConvidou,
}: {
  reviewId: string;
  collaboratorId: string;
  jaConvidados: string[];
  onConvidou: () => void;
}) {
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [alvo, setAlvo] = useState("");
  const [origem, setOrigem] = useState<Origem360>("par");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Só quem está no escopo de quem convida — é a mesma lista que o backend
    // aceita, então a tela não oferece o que a API vai recusar.
    employeesService
      .listar({ tamanho: 200 })
      .then(r => setPessoas((r.data ?? []).map((c: any) => ({ id: c.id, nome: c.nomeExibicao }))))
      .catch(() => setPessoas([]));
  }, []);

  const autoJaConvidada = jaConvidados.includes(collaboratorId);

  const disponiveis = pessoas.filter(p =>
    !jaConvidados.includes(p.id) &&
    // O avaliado não entra como par de si mesmo; para ele existe a autoavaliação.
    (origem === "autoavaliacao" ? p.id === collaboratorId : p.id !== collaboratorId),
  );

  async function convidar(id: string, o: Origem360) {
    setEnviando(true);
    try {
      await review360Service.convidar(reviewId, id, o);
      useToastStore.getState().success("Convite enviado");
      setAlvo("");
      onConvidou();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h4 style={{ marginBottom: 8 }}>Convidar</h4>

      {!autoJaConvidada && (
        // Atalho próprio: a autoavaliação é o convite mais importante do ciclo
        // e é sempre para a mesma pessoa — não faz sentido procurá-la na lista.
        <button
          type="button"
          className="btn-secondary"
          disabled={enviando}
          style={{ marginBottom: 10 }}
          onClick={() => convidar(collaboratorId, "autoavaliacao")}
        >
          <UserCheck size={13} /> Pedir a autoavaliação
        </button>
      )}

      <FormGrid min={180}>
        <FormField label="Pessoa">
          <select value={alvo} onChange={e => setAlvo(e.target.value)}>
            <option value="">Escolha…</option>
            {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </FormField>
        <FormField label="Como avalia">
          <select value={origem} onChange={e => setOrigem(e.target.value as Origem360)}>
            <option value="par">Par</option>
            <option value="lideranca">Liderança</option>
          </select>
        </FormField>
      </FormGrid>

      <FormActions>
        <button
          type="button"
          className="btn-primary"
          disabled={!alvo || enviando}
          onClick={() => convidar(alvo, origem)}
        >
          {enviando ? "Enviando…" : "Convidar"}
        </button>
      </FormActions>

      <p className="muted" style={{ fontSize: 12 }}>
        Quem for convidado vê o pedido em Meu RH. A pessoa avaliada lê os comentários
        sem saber de quem vieram, e só depois que você finalizar o ciclo.
      </p>
    </div>
  );
}

/* ── Respostas ───────────────────────────────────────────────────────────── */

function Entradas({
  entradas, podeGerenciar, onMudou,
}: {
  entradas: EntradaPainel[];
  podeGerenciar: boolean;
  onMudou: () => void;
}) {
  async function remover(e: EntradaPainel) {
    if (!confirm(`Remover o convite de ${e.avaliador.nome}?`)) return;
    try {
      await review360Service.remover(e.id);
      useToastStore.getState().success("Convite removido");
      onMudou();
    } catch { /* interceptor */ }
  }

  if (entradas.length === 0) {
    return <p className="muted">Ninguém foi convidado ainda.</p>;
  }

  return (
    <div>
      <h4 style={{ marginBottom: 8 }}>Respostas</h4>
      <ul style={{ display: "grid", gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
        {entradas.map(e => {
          const respondeu = e.status === "RESPONDIDA";
          return (
            <li
              key={e.id}
              style={{
                padding: "10px 12px", borderRadius: 10,
                background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Users size={13} className="muted" />
                <strong style={{ fontSize: 13 }}>{e.avaliador.nome}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{e.rotuloOrigem}</span>
                {respondeu && e.nota !== null && (
                  <span className="metric" style={{ fontWeight: 600 }}>{e.nota}</span>
                )}
                <span style={{ flex: 1 }} />
                <StatusBadge
                  label={respondeu ? "Respondeu" : "Aguardando"}
                  tone={respondeu ? "ok" : "atencao"}
                />
                {/* Resposta dada não se apaga: seria descartar uma opinião por
                    não gostar dela, e o avaliado nunca saberia que existiu. */}
                {podeGerenciar && !respondeu && (
                  <button
                    type="button"
                    className="btn-ghost"
                    title="Remover convite"
                    onClick={() => remover(e)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {respondeu && (e.pontosFortes || e.pontosMelhoria) && (
                <div style={{ marginTop: 6, fontSize: 13, display: "grid", gap: 4 }}>
                  {e.pontosFortes && <div>👍 {e.pontosFortes}</div>}
                  {e.pontosMelhoria && <div>🎯 {e.pontosMelhoria}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
