"use client";

import { useCallback, useEffect, useState } from "react";
import { meService } from "@/lib/people/me.service";
import type { SituacaoFerias, PeriodoFerias } from "@/lib/people/vacations.service";
import { Panel, StatusBadge, ErrorState, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { formatarDataBR } from "@/lib/datas";
import { CalendarClock, AlertTriangle } from "lucide-react";
import Vazio from "./Vazio";

/**
 * Minhas férias — saldo, períodos e pedido.
 *
 * A tela do RH mostra o passivo do quadro; esta mostra o direito de uma pessoa.
 * O que muda é o destaque: aqui o número que abre é o SALDO, porque é o que
 * responde "posso tirar férias?". O vencimento vem logo abaixo, e em vermelho,
 * porque é o que responde "preciso tirar quando?".
 *
 * Não mostra valor em reais em lugar nenhum: folha está fora do módulo, e um
 * número de dinheiro nesta tela seria lido como promessa de pagamento.
 */

const TOM: Record<string, "ok" | "neutro" | "atencao" | "critico" | "info"> = {
  ADQUIRIDO: "ok",
  EM_AQUISICAO: "info",
  GOZADO: "neutro",
  VENCIDO: "critico",
};

const ROTULO: Record<string, string> = {
  ADQUIRIDO: "Disponível",
  EM_AQUISICAO: "Em aquisição",
  GOZADO: "Gozado",
  VENCIDO: "Vencido",
};

export default function MinhasFerias({ onAlterou }: { onAlterou: () => void }) {
  const [dados, setDados] = useState<SituacaoFerias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await meService.ferias();
      setDados(r.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar as suas férias.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;
  if (carregando || !dados) return <Panel><p className="muted">Carregando…</p></Panel>;

  if (dados.semDataAdmissao) {
    return (
      <Panel title="Férias">
        <Vazio
          icon={<CalendarClock size={28} />}
          titulo="Sem data de admissão no seu cadastro"
          dica="O período aquisitivo é contado a partir dela. Peça ao RH para completar o cadastro."
        />
      </Panel>
    );
  }

  const vencidos = dados.periodos.filter(p => p.status === "VENCIDO");

  return (
    <>
      <Panel title="Meu saldo">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="metric" style={{ fontSize: 34 }}>{dados.saldoDisponivel}</span>
          <span className="muted">{dados.saldoDisponivel === 1 ? "dia disponível" : "dias disponíveis"}</span>
        </div>

        {vencidos.length > 0 && (
          // O aviso é sobre um direito da pessoa, não sobre uma falha dela: quem
          // aprova férias é o gestor. O texto pede uma ação possível.
          <p style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, color: "var(--accent-red)" }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Você tem período vencido. Esses dias continuam sendo seus e a empresa
              deve pagá-los em dobro — vale conversar com seu gestor sobre quando tirá-los.
            </span>
          </p>
        )}
      </Panel>

      <SolicitarFerias
        saldo={dados.saldoDisponivel}
        onEnviou={() => { carregar(); onAlterou(); }}
      />

      <Panel title="Meus períodos">
        {dados.periodos.length === 0 ? (
          <Vazio titulo="Nenhum período ainda" dica="Eles aparecem conforme o tempo de casa." />
        ) : (
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {dados.periodos.map(p => <Periodo key={p.id} p={p} />)}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Periodo({ p }: { p: PeriodoFerias }) {
  return (
    <li className="row-line">
      <span style={{ minWidth: 0 }}>
        <strong>{formatarDataBR(p.inicio)} a {formatarDataBR(p.fim)}</strong>
        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
          {p.saldo} de {p.diasDireito} {p.diasDireito === 1 ? "dia" : "dias"}
        </span>
        <div className="muted" style={{ fontSize: 12 }}>
          {p.diasParaVencer < 0
            ? `Prazo terminou há ${Math.abs(p.diasParaVencer)} dias`
            : `Precisa ser gozado até ${formatarDataBR(p.limiteConcessivo)}`}
        </div>
      </span>
      <StatusBadge label={ROTULO[p.status] ?? p.status} tone={TOM[p.status] ?? "neutro"} />
    </li>
  );
}

/* ── Pedido ──────────────────────────────────────────────────────────────── */

function SolicitarFerias({ saldo, onEnviou }: { saldo: number; onEnviou: () => void }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const dias = contarDias(inicio, fim);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await meService.solicitarFerias({ dataInicio: inicio, dataFim: fim, observacao });
      useToastStore.getState().success("Pedido enviado ao seu gestor");
      setInicio(""); setFim(""); setObservacao("");
      onEnviou();
    } catch {
      // O interceptor já mostrou o motivo do backend — que aqui é sempre uma
      // regra de negócio (saldo, sobreposição, fracionamento), não um erro.
    } finally {
      setEnviando(false);
    }
  }

  if (saldo <= 0) {
    return (
      <Panel title="Solicitar férias">
        <Vazio
          titulo="Você ainda não tem saldo"
          dica="O direito nasce ao completar 12 meses de cada período aquisitivo."
        />
      </Panel>
    );
  }

  return (
    <Panel title="Solicitar férias">
      <form onSubmit={enviar}>
        <FormGrid>
          <FormField label="Primeiro dia">
            <input type="date" value={inicio} required onChange={e => setInicio(e.target.value)} />
          </FormField>
          <FormField label="Último dia">
            <input type="date" value={fim} required min={inicio || undefined} onChange={e => setFim(e.target.value)} />
          </FormField>
          <FormField label="Observação (opcional)">
            <input
              type="text" value={observacao} maxLength={500}
              placeholder="Algo que seu gestor precise saber"
              onChange={e => setObservacao(e.target.value)}
            />
          </FormField>
        </FormGrid>

        {dias > 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            {dias} {dias === 1 ? "dia" : "dias"} corridos
            {dias > saldo && (
              // Avisa antes de enviar: o backend recusaria, e descobrir a regra
              // por mensagem de erro é pior do que ler antes.
              <strong style={{ color: "var(--accent-red)" }}> — acima do seu saldo de {saldo}</strong>
            )}
          </p>
        )}

        <FormActions>
          <button type="submit" className="btn-primary" disabled={enviando || !inicio || !fim}>
            {enviando ? "Enviando…" : "Enviar pedido"}
          </button>
        </FormActions>
      </form>

      <p className="muted" style={{ fontSize: 12 }}>
        O pedido vai para o seu gestor aprovar. Você recebe um aviso quando ele decidir.
      </p>
    </Panel>
  );
}

/** Dias corridos, inclusive as duas pontas — que é como a CLT conta férias. */
function contarDias(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}
