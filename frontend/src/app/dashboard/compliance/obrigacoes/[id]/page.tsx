"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, DetailHeader, FieldGrid, Field, Panel, Tabs,
  ErrorState, PermissionDenied, StatusBadge, Timeline, TableCard, EmptyState,
} from "@/components/data-ui";
import {
  ShieldCheck, RefreshCw, Stamp, Pencil, Upload, Download, Trash2, Star,
  FileText, History, Layers, MessageSquare, Paperclip, Send,
} from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type {
  Obrigacao, Anexo, EventoHistorico, Versao, Comentario,
} from "@/lib/compliance/types";
import { ROTULO_STATUS } from "@/lib/compliance/types";
import {
  pode, data, dinheiro, prazoEmPalavras, SeloSituacao, SeloCriticidade, Aviso,
} from "../../_components/comuns";
import ObrigacaoForm from "../../_components/ObrigacaoForm";
import RenovarModal from "../../_components/RenovarModal";
import ProtocoloModal from "../../_components/ProtocoloModal";

type Aba = "dados" | "anexos" | "versoes" | "historico" | "comentarios";

/**
 * Detalhe da obrigação.
 *
 * O cabeçalho responde à pergunta que a planilha demorava a responder: em que
 * pé está isto, e quando é preciso agir. Só depois vêm os dados cadastrais.
 */
export default function ObrigacaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore(s => s.user);

  const [o, setO] = useState<Obrigacao | null>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const [editando, setEditando] = useState(false);
  const [renovando, setRenovando] = useState(false);
  const [protocolando, setProtocolando] = useState(false);

  const podeEditar = pode(user, "compliance.obrigacao:editar");
  const podeRenovar = pode(user, "compliance.obrigacao:renovar");
  const podeAnexar = pode(user, "compliance.anexo:enviar");
  const podeExcluirAnexo = pode(user, "compliance.anexo:excluir");
  const podeMudarStatus = pode(user, "compliance.obrigacao:mudar_status");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setO(await complianceService.obter(id));
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Falha ao carregar a obrigação.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function favoritar() {
    if (!o) return;
    try {
      const { favorito } = await complianceService.favoritar(o.id);
      setO({ ...o, favorito });
    } catch { /* interceptor */ }
  }

  async function mudarStatus(status: string) {
    if (!o) return;
    const motivo = status === "cancelada" || status === "suspensa"
      ? prompt(`Motivo para ${status === "cancelada" ? "cancelar" : "suspender"}:`) ?? undefined
      : undefined;
    try {
      await complianceService.mudarStatus(o.id, status, motivo);
      useToastStore.getState().success("Status alterado");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Topbar />
        <PageBody><PermissionDenied hint="Você não tem permissão para ver esta obrigação." /></PageBody>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance/obrigacoes" label="Obrigações" />

          {erro ? (
            <ErrorState detail={erro} onRetry={carregar} />
          ) : carregando || !o ? (
            <div className="skeleton" style={{ height: 140, borderRadius: 14 }} />
          ) : (
            <>
              <DetailHeader
                avatar={<ShieldCheck size={20} />}
                titulo={o.nome}
                selo={<SeloSituacao o={o} />}
                subtitulo={
                  <>
                    <span className="num">{o.codigo}</span>
                    {o.sigla && <> · {o.sigla}</>}
                    {o.numeroDocumento && <> · {o.numeroDocumento}</>}
                    {o.categoria && <> · {o.categoria.nome}</>}
                    {(o.unidade || o.ativoIdentificador) && <> · {o.ativoIdentificador ?? o.unidade}</>}
                  </>
                }
                meta={
                  <>
                    <SeloCriticidade nivel={o.criticidade} />
                    <StatusBadge label={ROTULO_STATUS[o.status]} tone="neutro" />
                    <StatusBadge label={`versão ${o.versaoAtual}`} tone="neutro" />
                  </>
                }
                actions={
                  <>
                    <button type="button" className="btn btn-ghost" onClick={favoritar}
                      title={o.favorito ? "Remover dos favoritos" : "Favoritar"}>
                      <Star size={14} fill={o.favorito ? "currentColor" : "none"} />
                    </button>
                    {podeRenovar && (
                      <>
                        <button type="button" className="btn btn-ghost" onClick={() => setProtocolando(true)}>
                          <Stamp size={14} /> Protocolo
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => setRenovando(true)}>
                          <RefreshCw size={14} /> Renovar
                        </button>
                      </>
                    )}
                    {podeEditar && (
                      <button type="button" className="btn btn-ghost" onClick={() => setEditando(true)}>
                        <Pencil size={14} /> Editar
                      </button>
                    )}
                  </>
                }
              />

              <PainelDePrazos o={o} />

              <Tabs<Aba>
                tabs={[
                  { id: "dados", label: "Dados" },
                  { id: "anexos", label: "Anexos" },
                  { id: "versoes", label: `Versões (${o.versaoAtual})` },
                  { id: "historico", label: "Histórico" },
                  { id: "comentarios", label: "Comentários" },
                ]}
                active={aba}
                onChange={setAba}
              />

              {aba === "dados" && <AbaDados o={o} podeMudarStatus={podeMudarStatus} onMudarStatus={mudarStatus} />}
              {aba === "anexos" && <AbaAnexos obrigacaoId={o.id} podeEnviar={podeAnexar} podeExcluir={podeExcluirAnexo} />}
              {aba === "versoes" && <AbaVersoes obrigacaoId={o.id} />}
              {aba === "historico" && <AbaHistorico obrigacaoId={o.id} />}
              {aba === "comentarios" && <AbaComentarios obrigacaoId={o.id} />}
            </>
          )}
        </PageBody>
      </div>

      <ObrigacaoForm aberto={editando} obrigacao={o} onFechar={() => setEditando(false)} onSalvo={carregar} />
      <RenovarModal obrigacao={renovando ? o : null} onFechar={() => setRenovando(false)} onSalvo={carregar} />
      <ProtocoloModal obrigacao={protocolando ? o : null} onFechar={() => setProtocolando(false)} onSalvo={carregar} />
    </div>
  );
}

/**
 * A régua de prazos.
 *
 * Os três marcos lado a lado, na ordem em que acontecem, com o que resta de
 * cada um. É a informação que na planilha estava espalhada em três colunas de
 * fórmula que ninguém lia.
 */
function PainelDePrazos({ o }: { o: Obrigacao }) {
  const marcos = [
    { rotulo: "Iniciar renovação", quando: o.prazoInternoEm, dias: o.diasParaPrazoInterno, cor: "var(--accent-amber)" },
    { rotulo: "Prazo fatal para protocolar", quando: o.prazoFatalEm, dias: o.diasParaPrazoFatal, cor: "var(--accent-red)" },
    { rotulo: "Vencimento", quando: o.dataValidade, dias: o.diasParaValidade, cor: "var(--accent-violet)" },
  ];

  return (
    <>
      {o.renovacaoAutomatica && !o.prorrogacaoVigente && (
        <Aviso tom="atencao">
          Esta obrigação é de <strong>renovação automática</strong>, mas ainda não tem protocolo
          tempestivo registrado — por isso ela continua sendo cobrada pelos alertas.
          {o.protocoloEm
            ? ` O protocolo registrado (${data(o.protocoloEm)}) é posterior ao prazo fatal.`
            : " Registre o número e a data do protocolo para que a prorrogação passe a valer."}
        </Aviso>
      )}

      {o.prorrogacaoVigente && (
        <Aviso tom="info">
          Validade <strong>prorrogada</strong> pelo protocolo {o.protocoloNumero} de {data(o.protocoloEm)},
          até a decisão do órgão. Os alertas de prazo estão suspensos para esta obrigação.
        </Aviso>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 18 }}>
        {marcos.map(m => {
          const passou = m.dias != null && m.dias < 0;
          return (
            <div
              key={m.rotulo}
              style={{
                padding: "14px 16px", borderRadius: 12,
                background: passou
                  ? `color-mix(in srgb, ${m.cor} 10%, transparent)`
                  : "var(--surface-1, transparent)",
                border: `1px solid color-mix(in srgb, ${m.cor} ${passou ? 34 : 18}%, transparent)`,
              }}
            >
              <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                {m.rotulo}
              </div>
              <div className="metric" style={{ fontSize: 19 }}>{data(m.quando)}</div>
              <div style={{ fontSize: 11.5, color: passou ? m.cor : "var(--text-secondary)", marginTop: 3 }}>
                {m.dias == null ? "—" : passou ? `passou ${prazoEmPalavras(m.dias)}` : prazoEmPalavras(m.dias)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AbaDados({
  o, podeMudarStatus, onMudarStatus,
}: {
  o: Obrigacao;
  podeMudarStatus: boolean;
  onMudarStatus: (status: string) => void;
}) {
  return (
    <>
      <Panel title="Identificação">
        <FieldGrid>
          <Field label="Código" value={<span className="num">{o.codigo}</span>} />
          <Field label="Categoria" value={o.categoria?.nome} />
          <Field label="Sigla" value={o.sigla} />
          <Field label="Número do documento" value={o.numeroDocumento} />
          <Field label="Órgão emissor" value={o.orgao?.nome} />
          <Field label="Descrição" value={o.descricao} />
        </FieldGrid>
      </Panel>

      <Panel title="Prazos e renovação">
        <FieldGrid>
          <Field label="Emissão" value={data(o.dataEmissao)} />
          <Field label="Validade" value={data(o.dataValidade)} />
          <Field label="Periodicidade" value={o.validadeMeses ? `${o.validadeMeses} meses` : null} />
          <Field label="Prazo mínimo do órgão" value={`${o.prazoMinimoDias} ${o.prazoMinimoDias === 1 ? "dia" : "dias"}`} />
          <Field label="Folga interna" value={o.folgaInternaDias != null ? `${o.folgaInternaDias} dias` : "da categoria"} />
          <Field label="Renovação automática" value={o.renovacaoAutomatica ? "Sim" : "Não"} />
          <Field label="Protocolo" value={o.protocoloNumero} />
          <Field label="Protocolado em" value={data(o.protocoloEm)} />
          <Field label="Última renovação" value={data(o.dataUltimaRenovacao)} />
          <Field label="Aprovada em" value={data(o.dataAprovacao)} />
        </FieldGrid>
      </Panel>

      <Panel title="Escopo">
        <FieldGrid>
          <Field label="Empresa" value={o.empresa} />
          <Field label="Filial" value={o.filial} />
          <Field label="Unidade / instalação" value={o.unidade} />
          <Field label="Departamento" value={o.departamento} />
          <Field label="Equipamento" value={o.ativoIdentificador} />
          <Field label="Centro de custo" value={o.centroCusto} />
          <Field label="Obra / projeto" value={o.project?.titulo} />
        </FieldGrid>
      </Panel>

      {o.campos.length > 0 && (
        <Panel title={`Campos de ${o.categoria?.nome ?? "categoria"}`}>
          <FieldGrid>
            {o.campos.map(c => (
              <Field
                key={c.chave}
                label={c.rotulo}
                value={
                  c.valor == null ? null
                    : c.tipo === "booleano" ? (c.valor ? "Sim" : "Não")
                    : c.tipo === "data" ? data(String(c.valor))
                    : String(c.valor)
                }
              />
            ))}
          </FieldGrid>
        </Panel>
      )}

      <Panel title="Responsáveis">
        {o.responsaveis.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Nenhum responsável cadastrado — esta obrigação não vai gerar aviso para ninguém.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {o.responsaveis.map((r, i) => (
              <div key={r.id ?? i} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                <StatusBadge label={r.papel} tone={r.papel === "principal" ? "info" : "neutro"} />
                <span style={{ fontWeight: 600 }}>{r.user?.nome ?? r.nome ?? "—"}</span>
                <span style={{ color: "var(--text-secondary)" }}>{r.email ?? r.user?.email ?? ""}</span>
                <span style={{ color: "var(--text-muted)" }}>{r.telefone ?? ""}</span>
                {r.notificar === false && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>(não recebe avisos)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Custos e observações">
        <FieldGrid>
          <Field label="Valor da licença" value={dinheiro(o.valorLicenca)} />
          <Field label="Valor da renovação" value={dinheiro(o.valorRenovacao)} />
          <Field label="Nota fiscal" value={o.notaFiscal} />
          <Field label="Tags" value={o.tags.map(t => t.nome).join(", ")} />
          <Field label="Observações" value={o.observacoes} />
        </FieldGrid>
      </Panel>

      {podeMudarStatus && (
        <Panel title="Situação declarada">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["ativa", "em_renovacao", "suspensa", "cancelada", "arquivada"] as const).map(s => (
              <button
                key={s}
                type="button"
                className={o.status === s ? "btn btn-primary" : "btn btn-ghost"}
                onClick={() => onMudarStatus(s)}
                disabled={o.status === s}
              >
                {ROTULO_STATUS[s]}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.55 }}>
            Cancelada e arquivada tiram a obrigação do radar: ela deixa de contar no painel e de gerar
            alerta. A situação de prazo continua sendo calculada pelas datas — não é digitada aqui.
          </div>
        </Panel>
      )}
    </>
  );
}

function AbaAnexos({
  obrigacaoId, podeEnviar, podeExcluir,
}: { obrigacaoId: string; podeEnviar: boolean; podeExcluir: boolean }) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setItens(await complianceService.anexos(obrigacaoId)); }
    catch { /* interceptor */ }
    finally { setCarregando(false); }
  }, [obrigacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      await complianceService.enviarAnexo(obrigacaoId, arquivo, { titulo: arquivo.name });
      useToastStore.getState().success("Anexo enviado");
      carregar();
    } catch { /* interceptor */ } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function excluir(a: Anexo) {
    if (!confirm(`Excluir o anexo "${a.titulo}"?\n\nO arquivo sai do armazenamento; o registro fica para auditoria.`)) return;
    try {
      await complianceService.excluirAnexo(a.id);
      useToastStore.getState().success("Anexo excluído");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Documento", "Versão", "Tamanho", "Enviado em", ""];

  return (
    <Panel
      title="Anexos"
      actions={
        podeEnviar && (
          <>
            <input
              ref={entrada}
              type="file"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) enviar(f); }}
            />
            <button type="button" className="btn btn-ghost" disabled={enviando}
              onClick={() => entrada.current?.click()}>
              <Upload size={13} /> {enviando ? "Enviando…" : "Anexar"}
            </button>
          </>
        )
      }
    >
      <TableCard>
        <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {carregando ? (
            <tr><td colSpan={COLUNAS.length}><span className="skeleton" style={{ display: "block", height: 14 }} /></td></tr>
          ) : itens.length === 0 ? (
            <EmptyState
              colSpan={COLUNAS.length}
              icon={<Paperclip size={20} />}
              title="Nenhum documento anexado"
              hint="Anexe o PDF da licença — uma obrigação sem o documento não prova nada numa fiscalização."
            />
          ) : (
            itens.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.nomeOriginal}</div>
                </td>
                <td className="num">v{a.versao}</td>
                <td className="num">{a.tamanho ? `${Math.round(a.tamanho / 1024)} KB` : "—"}</td>
                <td className="num">{data(a.criadoEm)}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {a.arquivoDisponivel ? (
                      <button type="button" className="btn-icon" title="Baixar"
                        onClick={() => complianceService.baixarAnexo(a)}>
                        <Download size={13} />
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--accent-red)" }} title="O registro existe mas o arquivo não está no armazenamento">
                        indisponível
                      </span>
                    )}
                    {podeExcluir && (
                      <button type="button" className="btn-icon" title="Excluir" onClick={() => excluir(a)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </Panel>
  );
}

function AbaVersoes({ obrigacaoId }: { obrigacaoId: string }) {
  const [itens, setItens] = useState<Versao[]>([]);

  useEffect(() => {
    complianceService.versoes(obrigacaoId).then(setItens).catch(() => setItens([]));
  }, [obrigacaoId]);

  const COLUNAS = ["Versão", "Documento", "Emissão", "Validade", "Prazo fatal", "Vigência", "Observação"];

  return (
    <Panel title="Versões">
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.55 }}>
        Cada renovação congela a vigência anterior. Nenhuma versão é substituída — a licença que valia
        em 2022 continua sendo o documento daquele ano.
      </div>
      <TableCard>
        <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {itens.length === 0 ? (
            <EmptyState colSpan={COLUNAS.length} icon={<Layers size={20} />} title="Nenhuma versão registrada" />
          ) : (
            itens.map(v => (
              <tr key={v.id}>
                <td className="num" style={{ fontWeight: 600 }}>v{v.versao}</td>
                <td>{v.numeroDocumento ?? "—"}</td>
                <td className="num">{data(v.dataEmissao)}</td>
                <td className="num">{data(v.dataValidade)}</td>
                <td className="num">{data(v.prazoFatalEm)}</td>
                <td>
                  <StatusBadge
                    label={v.encerradaEm ? `encerrada em ${data(v.encerradaEm)}` : "corrente"}
                    tone={v.encerradaEm ? "neutro" : "ok"}
                  />
                </td>
                <td style={{ fontSize: 12 }}>{v.observacao ?? "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </Panel>
  );
}

const TOM_ACAO: Record<string, "ok" | "info" | "atencao" | "critico" | "neutro"> = {
  criou: "ok", editou: "info", renovou: "ok", protocolou: "info",
  anexou: "info", removeu_anexo: "atencao", mudou_status: "atencao",
  notificou: "info", aprovou: "ok", rejeitou: "critico", excluiu: "critico",
  comentou: "neutro",
};

function AbaHistorico({ obrigacaoId }: { obrigacaoId: string }) {
  const [itens, setItens] = useState<EventoHistorico[]>([]);

  useEffect(() => {
    complianceService.historico(obrigacaoId).then(setItens).catch(() => setItens([]));
  }, [obrigacaoId]);

  return (
    <Panel title="Histórico">
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.55 }}>
        Toda alteração é registrada campo a campo, com quem fez e quando. O que a varredura noturna
        escreve aparece como <em>sistema</em>.
      </div>
      <Timeline
        itens={itens.map(e => ({
          id: e.id,
          titulo: e.descricao ?? e.acao,
          descricao: [
            e.user?.nome ?? (e.origem === "sistema" ? "sistema" : null),
            e.campo,
          ].filter(Boolean).join(" · ") || undefined,
          data: e.criadoEm,
          tone: TOM_ACAO[e.acao] ?? "neutro",
        }))}
      />
    </Panel>
  );
}

function AbaComentarios({ obrigacaoId }: { obrigacaoId: string }) {
  const [itens, setItens] = useState<Comentario[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    complianceService.comentarios(obrigacaoId).then(setItens).catch(() => setItens([]));
  }, [obrigacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await complianceService.comentar(obrigacaoId, texto.trim());
      setTexto("");
      carregar();
    } catch { /* interceptor */ } finally { setEnviando(false); }
  }

  return (
    <Panel title="Comentários">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <textarea
          className="input-o"
          rows={2}
          style={{ flex: 1 }}
          placeholder="Registre um andamento, uma conversa com o órgão, uma pendência…"
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={enviar} disabled={enviando || !texto.trim()}>
          <Send size={13} />
        </button>
      </div>

      {itens.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nenhum comentário ainda.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {itens.map(c => (
            <div key={c.id} style={{ paddingBottom: 12, borderBottom: "1px solid var(--border-subtle, rgba(127,127,127,.12))" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 12.5 }}>{c.user?.nome}</span>
                <span className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>{data(c.criadoEm)}</span>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.conteudo}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
