"use client";

import { useCallback, useEffect, useState } from "react";
import { meService } from "@/lib/people/me.service";
import type { SituacaoCarreira } from "@/lib/people/career.service";
import { Panel, StatusBadge, ErrorState } from "@/components/data-ui";
import { Route, Check, Clock, UserCheck } from "lucide-react";
import Vazio from "./Vazio";

/**
 * Minha carreira — o que falta para o próximo degrau.
 *
 * A tela do RH desenha a trilha; esta responde uma pergunta só: "o que
 * depende de mim para chegar lá?". Por isso o que abre é a LISTA DE
 * REQUISITOS, e não o desenho da trilha — saber que existem cinco degraus não
 * muda o comportamento de ninguém; saber que falta um curso, muda.
 *
 * O percentual NÃO é promessa de promoção, e o texto diz isso. Prontidão é
 * insumo da conversa com o gestor; quem decide promoção é gente.
 */

const TOM: Record<string, "ok" | "atencao" | "info"> = {
  atendido: "ok",
  pendente: "atencao",
  conferencia_manual: "info",
};

const ROTULO: Record<string, string> = {
  atendido: "Atendido",
  pendente: "Pendente",
  conferencia_manual: "Avaliação do gestor",
};

export default function MinhaCarreira() {
  const [dados, setDados] = useState<SituacaoCarreira | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await meService.carreira();
      setDados(r.data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar a sua carreira.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;
  if (carregando || !dados) return <Panel><p className="muted">Carregando…</p></Panel>;

  if (!dados.trilha) {
    return (
      <Panel title="Carreira">
        <Vazio
          icon={<Route size={28} />}
          titulo="Você ainda não está em uma trilha"
          dica={dados.motivo ?? "Converse com seu gestor sobre o seu plano de carreira."}
        />
      </Panel>
    );
  }

  if (dados.noTopo) {
    return (
      <Panel title={`Trilha ${dados.trilha.nome}`}>
        <Vazio
          icon={<UserCheck size={28} />}
          titulo="Você está no último degrau desta trilha"
          dica="Não há próximo cargo definido aqui. Um novo caminho é conversa com seu gestor."
        />
      </Panel>
    );
  }

  const p = dados.prontidao;

  return (
    <>
      <Panel title={`Trilha ${dados.trilha.nome}`}>
        <p>
          Hoje: <strong>{dados.degrauAtual?.cargo ?? "—"}</strong>
          {dados.proximoDegrau?.cargo && (
            <> · próximo degrau: <strong>{dados.proximoDegrau.cargo}</strong></>
          )}
        </p>
        {p && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <span className="metric" style={{ fontSize: 30 }}>{p.percentual}%</span>
              <span className="muted">dos requisitos atendidos</span>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Este número não é uma promessa de promoção — é o que o sistema consegue
              conferir sozinho. A decisão é do seu gestor.
            </p>
          </>
        )}
        {dados.inferida && (
          // Honestidade sobre a origem do dado: trilha deduzida do cargo não é
          // um plano que alguém desenhou para esta pessoa.
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Esta trilha foi deduzida pelo seu cargo, não atribuída a você.
          </p>
        )}
      </Panel>

      <Panel title="O que falta">
        {!p || p.requisitos.length === 0 ? (
          <Vazio titulo="Nenhum requisito cadastrado neste degrau" />
        ) : (
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {[...p.requisitos]
              // Pendente primeiro: é o que dá o que fazer.
              .sort((a, b) => ordem(a.situacao) - ordem(b.situacao))
              .map(r => (
                <li key={r.id} className="row-line">
                  <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                    {r.situacao === "atendido"
                      ? <Check size={15} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
                      : <Clock size={15} className="muted" style={{ flexShrink: 0 }} />}
                    <span>
                      {r.skillNome ?? r.trainingNome ?? r.descricao ?? "Requisito"}
                      {r.nivelMinimo && (
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>
                          nível {r.nivelMinimo}
                        </span>
                      )}
                      {!r.obrigatorio && (
                        <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>opcional</span>
                      )}
                    </span>
                  </span>
                  <StatusBadge label={ROTULO[r.situacao] ?? r.situacao} tone={TOM[r.situacao] ?? "atencao"} />
                </li>
              ))}
          </ul>
        )}

        {p && p.criterios.length > 0 && (
          <>
            <h4 style={{ marginTop: 18, marginBottom: 8 }}>Critérios do degrau</h4>
            <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
              {p.criterios.map((c, i) => (
                <li key={i} className="row-line">
                  <span>
                    <strong>{c.rotulo}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{c.detalhe}</div>
                  </span>
                  <StatusBadge label={ROTULO[c.situacao] ?? c.situacao} tone={TOM[c.situacao] ?? "atencao"} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}

function ordem(situacao: string): number {
  return situacao === "pendente" ? 0 : situacao === "conferencia_manual" ? 1 : 2;
}
