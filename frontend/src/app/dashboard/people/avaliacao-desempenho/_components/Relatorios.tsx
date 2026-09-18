"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel, FormGrid, FormField } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { feedbackDesempenhoService, ETAPAS } from "@/lib/people/feedback-desempenho.service";
import { Printer, FileText, Files } from "lucide-react";
import { AreaImpressao, FichaFeedback, RelatorioConsolidado, RelatorioDados } from "./ImpressaoFeedback";

/**
 * Relatórios para imprimir — o registro em papel (ou PDF) do feedback.
 *
 * Dois formatos:
 *  - CONSOLIDADO: números do período, quadro por gestor e a lista de feedbacks.
 *  - FICHAS COMPLETAS: uma página por feedback, com tudo que foi registrado —
 *    é o documento de arquivo.
 *
 * O recorte é o da tela: o gestor imprime a própria equipe, o RH a empresa.
 * Quem decide é o backend; esta aba só escolhe período e filtros.
 */

// O dia em São Paulo, e não em UTC: `toISOString` depois das 21h já seria amanhã.
const diaSP = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const hoje = () => diaSP(new Date());
const haDias = (n: number) => diaSP(new Date(Date.now() - n * 86_400_000));

type Pedido = { tipo: "consolidado" | "fichas"; dados: RelatorioDados; filtrosTexto: string };

export default function Relatorios() {
  const [de, setDe] = useState(haDias(90));
  const [ate, setAte] = useState(hoje());
  const [gestorId, setGestorId] = useState("");
  const [status, setStatus] = useState("");
  const [gestores, setGestores] = useState<{ id: string; nome: string }[]>([]);
  const [gerando, setGerando] = useState<"consolidado" | "fichas" | null>(null);
  const [imprimindo, setImprimindo] = useState<Pedido | null>(null);

  // As opções de gestor vêm do Acompanhamento (mesmo recorte). Não da
  // impressão: ela grava na auditoria, e abrir a aba não é imprimir.
  useEffect(() => {
    feedbackDesempenhoService.acompanhamento(30)
      .then(r => {
        setGestores((r.data?.gestores ?? []).map(g => ({ id: g.id, nome: g.nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      })
      .catch(() => {});
  }, []);

  async function gerar(tipo: "consolidado" | "fichas") {
    if (de && ate && de > ate) {
      useToastStore.getState().error("A data inicial é depois da final.");
      return;
    }
    setGerando(tipo);
    try {
      const r = await feedbackDesempenhoService.impressao({ de, ate, gestorId, status, completo: tipo === "fichas" });
      const dados: RelatorioDados = r.data;
      if (tipo === "fichas" && dados.itens.length === 0) {
        useToastStore.getState().error("Nenhum feedback no período e filtros escolhidos.");
        return;
      }
      const filtros = [
        gestorId ? `Gestor: ${gestores.find(g => g.id === gestorId)?.nome ?? "—"}` : "",
        status ? `Etapa: ${ETAPAS.find(e => e.status === status)?.rotulo ?? status}` : "",
      ].filter(Boolean).join(" · ");
      setImprimindo({ tipo, dados, filtrosTexto: filtros });
    } catch (e: any) {
      useToastStore.getState().error(e?.response?.data?.message || "Não foi possível gerar o relatório.");
    } finally {
      setGerando(null);
    }
  }

  const fim = useCallback(() => setImprimindo(null), []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel title="PERÍODO E FILTROS">
        <FormGrid min={180}>
          <FormField label="Registrados de">
            <input type="date" className="input-o" value={de} onChange={e => setDe(e.target.value)} />
          </FormField>
          <FormField label="Até">
            <input type="date" className="input-o" value={ate} onChange={e => setAte(e.target.value)} />
          </FormField>
          <FormField label="Gestor">
            <select className="input-o" value={gestorId} onChange={e => setGestorId(e.target.value)}>
              <option value="">Todos</option>
              {gestores.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </FormField>
          <FormField label="Etapa">
            <select className="input-o" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {ETAPAS.map(e => <option key={e.status} value={e.status}>{e.rotulo}</option>)}
            </select>
          </FormField>
        </FormGrid>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          O gestor imprime os feedbacks da própria equipe; o RH, os da empresa inteira — o mesmo que cada um vê na tela.{" "}O período considera a data em que o feedback foi registrado.
        </p>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        <Panel title="RELATÓRIO CONSOLIDADO">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <FileText size={22} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Números do período, quadro por gestor e a lista de feedbacks com as datas de registro, reunião e ciência.
            </p>
          </div>
          <button
            type="button" className="btn btn-primary" style={{ marginTop: 14 }}
            onClick={() => gerar("consolidado")} disabled={!!gerando}
          >
            <Printer size={14} /> {gerando === "consolidado" ? "Gerando..." : "Imprimir relatório"}
          </button>
        </Panel>

        <Panel title="FICHAS COMPLETAS">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Files size={22} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Uma página por feedback, com tudo que foi registrado: pontos fortes, oportunidades, reunião, próximos
              passos, ciência e linha do tempo. É o documento para arquivo.
            </p>
          </div>
          <button
            type="button" className="btn btn-primary" style={{ marginTop: 14 }}
            onClick={() => gerar("fichas")} disabled={!!gerando}
          >
            <Printer size={14} /> {gerando === "fichas" ? "Gerando..." : "Imprimir fichas"}
          </button>
        </Panel>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
        Na janela de impressão, escolha a impressora ou "Salvar como PDF".
      </p>

      {imprimindo && (
        <AreaImpressao onFim={fim}>
          {imprimindo.tipo === "consolidado" ? (
            <RelatorioConsolidado d={imprimindo.dados} filtrosTexto={imprimindo.filtrosTexto} />
          ) : (
            imprimindo.dados.itens.map((f, i) => (
              <FichaFeedback
                key={f.id} f={f}
                geradoPor={imprimindo.dados.geradoPor} geradoEm={imprimindo.dados.geradoEm}
                quebra={i < imprimindo.dados.itens.length - 1}
              />
            ))
          )}
        </AreaImpressao>
      )}
    </div>
  );
}
