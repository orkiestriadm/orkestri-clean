"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MARCA, LOGO_ARQUIVO_CLARO } from "@/lib/marca";
import { ROTULO_EVENTO, formatarDataHora } from "@/lib/people/feedback-desempenho.service";
import { formatarDataBR } from "@/lib/datas";

/**
 * Impressão do Feedback — relatório consolidado e fichas completas.
 *
 * Sai pelo "Imprimir" do navegador, que também salva em PDF. Não há arquivo
 * gerado no servidor: o que se imprime é o que a tela já mostrou, com o mesmo
 * recorte de acesso.
 *
 * A área vai para `document.body` por portal, FORA do layout. Dentro dele o
 * conteúdo fica num contêiner com rolagem própria, e a impressão cortaria tudo
 * que passasse da primeira tela. No papel, só esta área aparece.
 *
 * Cores fixas (preto no branco), e não as variáveis do tema: quem imprime com
 * o sistema no modo escuro não pode receber folha preta.
 */

const ESTILO_IMPRESSAO = `
.area-impressao { display: none; }
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(.area-impressao) { display: none !important; }
  .area-impressao { display: block !important; color: #111; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; }
  .area-impressao .quebra { break-after: page; page-break-after: always; }
  .area-impressao table { border-collapse: collapse; width: 100%; }
  .area-impressao th, .area-impressao td { border-bottom: 1px solid #d0d4da; padding: 5px 6px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  .area-impressao th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: #555; border-bottom: 1.5px solid #888; }
  .area-impressao tr { break-inside: avoid; }
  .area-impressao .bloco { break-inside: avoid; }
}`;

/** Monta a área, espera o navegador desenhar, abre o Imprimir e desmonta ao fechar. */
export function AreaImpressao({ children, onFim }: { children: ReactNode; onFim: () => void }) {
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (!montado) return;
    const aoTerminar = () => onFim();
    window.addEventListener("afterprint", aoTerminar);
    // Dois quadros: o primeiro monta o portal, o segundo garante que a logo e
    // as tabelas já foram desenhadas quando o diálogo de impressão abrir.
    const t = setTimeout(() => window.print(), 350);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", aoTerminar);
    };
  }, [montado, onFim]);

  if (!montado) return null;
  return createPortal(
    <div className="area-impressao">
      <style>{ESTILO_IMPRESSAO}</style>
      {children}
    </div>,
    document.body,
  );
}

export function CabecalhoImpressao({ titulo, subtitulo, geradoPor, geradoEm }: {
  titulo: string; subtitulo?: string; geradoPor?: string | null; geradoEm: string | Date;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #222", paddingBottom: 10, marginBottom: 14 }}>
      {LOGO_ARQUIVO_CLARO
        ? <img src={LOGO_ARQUIVO_CLARO} alt={MARCA} style={{ height: 34, width: "auto" }} />
        : <strong style={{ fontSize: "13pt" }}>{MARCA}</strong>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "14pt", fontWeight: 700 }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: "9.5pt", color: "#444" }}>{subtitulo}</div>}
      </div>
      <div style={{ fontSize: "8.5pt", color: "#555", textAlign: "right" }}>
        Gerado em {formatarDataHora(typeof geradoEm === "string" ? geradoEm : geradoEm.toISOString())}
        {geradoPor ? <><br />por {geradoPor}</> : null}
      </div>
    </div>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: ".06em", color: "#666", marginBottom: 2 }}>{children}</div>;
}

function Texto({ children }: { children: string | null | undefined }) {
  return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{children || "—"}</div>;
}

export type FichaDados = {
  id: string;
  rotuloStatus: string;
  colaborador: { nome: string; cargo?: string | null };
  gestor: { nome: string };
  criadoEm: string;
  reuniaoInicio: string | null;
  reuniaoLocal: string | null;
  reuniaoRealizadaEm: string | null;
  cienciaEm: string | null;
  pontosFortes?: string | null;
  oportunidades?: string | null;
  alinhamentos?: string | null;
  comentarioColaborador?: string | null;
  eventos?: { tipo: string; autorNome: string | null; detalhe: string | null; criadoEm: string }[];
};

/** Uma ficha: o registro formal de um feedback, nas quatro etapas do RH. */
export function FichaFeedback({ f, geradoPor, geradoEm, quebra }: {
  f: FichaDados; geradoPor?: string | null; geradoEm: string | Date; quebra?: boolean;
}) {
  const secao = (titulo: string, conteudo: ReactNode) => (
    <div className="bloco" style={{ border: "1px solid #d0d4da", borderRadius: 6, padding: "9px 12px", marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: "10.5pt", marginBottom: 6 }}>{titulo}</div>
      {conteudo}
    </div>
  );

  return (
    <div className={quebra ? "quebra" : undefined}>
      <CabecalhoImpressao
        titulo="Registro de Feedback — Avaliação de Desempenho"
        subtitulo={`${f.colaborador.nome}${f.colaborador.cargo ? ` · ${f.colaborador.cargo}` : ""}`}
        geradoPor={geradoPor} geradoEm={geradoEm}
      />

      <table style={{ marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: "25%" }}><Rotulo>Colaborador</Rotulo>{f.colaborador.nome}</td>
            <td style={{ width: "25%" }}><Rotulo>Gestor</Rotulo>{f.gestor.nome}</td>
            <td style={{ width: "25%" }}><Rotulo>Registrado em</Rotulo>{formatarDataHora(f.criadoEm)}</td>
            <td style={{ width: "25%" }}><Rotulo>Situação</Rotulo>{f.rotuloStatus}</td>
          </tr>
        </tbody>
      </table>

      {secao("1 · Registro do gestor", <>
        <Rotulo>Pontos fortes</Rotulo><Texto>{f.pontosFortes}</Texto>
        <div style={{ height: 8 }} />
        <Rotulo>Oportunidades de desenvolvimento</Rotulo><Texto>{f.oportunidades}</Texto>
      </>)}

      {secao("2 · Reunião de feedback", <>
        <table style={{ marginBottom: 6 }}>
          <tbody>
            <tr>
              <td><Rotulo>Agendada para</Rotulo>{f.reuniaoInicio ? formatarDataHora(f.reuniaoInicio) : "—"}</td>
              <td><Rotulo>Local</Rotulo>{f.reuniaoLocal || "—"}</td>
              <td><Rotulo>Realizada em</Rotulo>{f.reuniaoRealizadaEm ? formatarDataHora(f.reuniaoRealizadaEm) : "—"}</td>
            </tr>
          </tbody>
        </table>
        <Rotulo>Expectativas e próximos passos</Rotulo><Texto>{f.alinhamentos}</Texto>
      </>)}

      {secao("3 · Ciência do colaborador", f.cienciaEm ? <>
        <div style={{ marginBottom: 6 }}>Ciência registrada no sistema em <strong>{formatarDataHora(f.cienciaEm)}</strong>, pelo próprio colaborador.</div>
        <Rotulo>Comentário do colaborador</Rotulo><Texto>{f.comentarioColaborador || "Sem comentário."}</Texto>
      </> : <div style={{ color: "#555" }}>Ciência ainda não registrada.</div>)}

      {secao("4 · Encerramento", <div>
        {f.cienciaEm
          ? `Processo encerrado em ${formatarDataHora(f.cienciaEm)}, formalizando os alinhamentos entre ${f.gestor.nome} e ${f.colaborador.nome}.`
          : "Processo em andamento."}
      </div>)}

      {!!f.eventos?.length && secao("Linha do tempo", (
        <table>
          <thead><tr><th style={{ width: "22%" }}>Quando</th><th style={{ width: "30%" }}>Evento</th><th>Quem · detalhe</th></tr></thead>
          <tbody>
            {f.eventos.map((e, i) => (
              <tr key={i}>
                <td>{formatarDataHora(e.criadoEm)}</td>
                <td>{ROTULO_EVENTO[e.tipo] ?? e.tipo}</td>
                <td>{[e.autorNome, e.detalhe].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <div style={{ fontSize: "8pt", color: "#666", marginTop: 8 }}>
        Documento gerado pelo {MARCA}. A ciência do colaborador é registrada eletronicamente no sistema, com data e hora.
      </div>
    </div>
  );
}

export type RelatorioDados = {
  geradoEm: string;
  geradoPor: string | null;
  de: string;
  ate: string;
  alcance: "organizacao" | "equipe";
  resumo: {
    registrados: number; aguardandoReuniao: number; aguardandoCiencia: number;
    encerrados: number; percentualRetorno: number; gestoresSemRegistro: number;
  } | null;
  porGestor: { id: string; nome: string; liderados: number; registrados: number; colaboradoresAtingidos: number; reuniaoRealizada: number; cienciaDada: number; cobertura: number }[];
  itens: FichaDados[];
};

/** O relatório consolidado: números do período, quadro por gestor e a lista. */
export function RelatorioConsolidado({ d, filtrosTexto }: { d: RelatorioDados; filtrosTexto: string }) {
  const r = d.resumo;
  const cartao = (rotulo: string, valor: ReactNode) => (
    <td style={{ border: "1px solid #d0d4da", padding: "8px 10px", width: "20%" }}>
      <div style={{ fontSize: "15pt", fontWeight: 700 }}>{valor}</div>
      <div style={{ fontSize: "8.5pt", color: "#555" }}>{rotulo}</div>
    </td>
  );

  return (
    <div>
      <CabecalhoImpressao
        titulo="Relatório de Feedback — Avaliação de Desempenho"
        subtitulo={`${d.alcance === "organizacao" ? "Empresa inteira" : "Minha equipe"} · Registrados de ${formatarDataBR(d.de)} a ${formatarDataBR(d.ate)}${filtrosTexto ? ` · ${filtrosTexto}` : ""}`}
        geradoPor={d.geradoPor} geradoEm={d.geradoEm}
      />

      {r && (
        <table style={{ marginBottom: 14 }}>
          <tbody>
            <tr>
              {cartao("Feedbacks registrados", r.registrados)}
              {cartao("Conversa ainda não aconteceu", r.aguardandoReuniao)}
              {cartao("Aguardando ciência", r.aguardandoCiencia)}
              {cartao("Encerrados", r.encerrados)}
              {cartao("Retorno dos colaboradores", `${r.percentualRetorno}%`)}
            </tr>
          </tbody>
        </table>
      )}

      {d.porGestor.length > 0 && (
        <div className="bloco" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Por gestor</div>
          <table>
            <thead>
              <tr><th>Gestor</th><th>Liderados</th><th>Feedbacks</th><th>Pessoas</th><th>Reuniões</th><th>Ciências</th><th>Cobertura</th></tr>
            </thead>
            <tbody>
              {d.porGestor.map(g => (
                <tr key={g.id}>
                  <td>{g.nome}</td><td>{g.liderados}</td>
                  <td>{g.registrados === 0 ? "Nenhum" : g.registrados}</td>
                  <td>{g.colaboradoresAtingidos}</td><td>{g.reuniaoRealizada}</td><td>{g.cienciaDada}</td>
                  <td>{g.cobertura}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontWeight: 700, marginBottom: 4 }}>Feedbacks ({d.itens.length})</div>
      {d.itens.length === 0 ? (
        <div style={{ color: "#555" }}>Nenhum feedback registrado no período e filtros escolhidos.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Colaborador</th><th>Gestor</th><th>Registro</th><th>Reunião realizada</th><th>Ciência</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {d.itens.map(f => (
              <tr key={f.id}>
                <td>{f.colaborador.nome}</td>
                <td>{f.gestor.nome}</td>
                <td>{formatarDataBR(f.criadoEm)}</td>
                <td>{f.reuniaoRealizadaEm ? formatarDataBR(f.reuniaoRealizadaEm) : "—"}</td>
                <td>{f.cienciaEm ? formatarDataBR(f.cienciaEm) : "—"}</td>
                <td>{f.rotuloStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ fontSize: "8pt", color: "#666", marginTop: 10 }}>Documento gerado pelo {MARCA}.</div>
    </div>
  );
}
