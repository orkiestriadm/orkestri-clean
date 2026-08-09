"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Modal, Tabs, Field, FieldGrid, StatusBadge, Timeline, EmptyState, TableCard,
} from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import {
  ShieldCheck, RefreshCw, Stamp, Pencil, Trash2, Upload, Download, Save, X,
  ExternalLink, Paperclip, History, Layers, Send,
} from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type {
  Obrigacao, Anexo, EventoHistorico, Versao, Categoria, Orgao,
} from "@/lib/compliance/types";
import { ROTULO_STATUS, ROTULO_CRITICIDADE } from "@/lib/compliance/types";
import {
  pode, data, dinheiro, prazoEmPalavras, SeloSituacao, SeloCriticidade, Aviso,
} from "./comuns";

/**
 * Detalhe da obrigação em modal, aberto por duplo clique na lista.
 *
 * Por que modal e não navegar para a página de detalhe: numa carteira, o que se
 * faz o dia inteiro é abrir um registro, conferir um prazo, fechar e abrir o
 * próximo. Navegar perde a lista — filtro, rolagem e página — e obriga a
 * refazer o caminho a cada consulta. O modal devolve ao mesmo ponto.
 *
 * A página de detalhe continua existindo e é o que o link do e-mail abre: ela
 * tem URL própria, que o modal não tem. Uma não substitui a outra.
 *
 * O CRUD é INLINE. Abrir outro modal por cima para editar seria empilhar
 * camada, que é justamente o que torna a tela confusa.
 */

type Aba = "dados" | "anexos" | "historico" | "versoes";

const soData = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export default function ObrigacaoModal({
  obrigacaoId, user, onFechar, onMudou, onRenovar, onProtocolar,
}: {
  obrigacaoId: string | null;
  user: any;
  onFechar: () => void;
  onMudou: () => void;
  onRenovar: (o: Obrigacao) => void;
  onProtocolar: (o: Obrigacao) => void;
}) {
  const [o, setO] = useState<Obrigacao | null>(null);
  const [aba, setAba] = useState<Aba>("dados");
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);

  const podeEditar = pode(user, "compliance.obrigacao:editar");
  const podeExcluir = pode(user, "compliance.obrigacao:excluir");
  const podeRenovar = pode(user, "compliance.obrigacao:renovar");

  const carregar = useCallback(async () => {
    if (!obrigacaoId) return;
    setCarregando(true);
    try {
      const r = await complianceService.obter(obrigacaoId);
      setO(r);
      setForm({
        nome: r.nome, sigla: r.sigla ?? "", numeroDocumento: r.numeroDocumento ?? "",
        categoriaId: r.categoriaId, orgaoId: r.orgaoId ?? "",
        unidade: r.unidade ?? "", departamento: r.departamento ?? "",
        ativoIdentificador: r.ativoIdentificador ?? "", criticidade: r.criticidade,
        dataEmissao: soData(r.dataEmissao), dataValidade: soData(r.dataValidade),
        prazoMinimoDias: String(r.prazoMinimoDias ?? 0),
        validadeMeses: r.validadeMeses == null ? "" : String(r.validadeMeses),
        renovacaoAutomatica: r.renovacaoAutomatica,
        observacoes: r.observacoes ?? "",
      });
    } catch { /* interceptor */ } finally { setCarregando(false); }
  }, [obrigacaoId]);

  useEffect(() => {
    if (!obrigacaoId) { setO(null); setEditando(false); setAba("dados"); return; }
    carregar();
  }, [obrigacaoId, carregar]);

  useEffect(() => {
    if (!editando || categorias.length) return;
    complianceService.categorias().then(setCategorias).catch(() => {});
    complianceService.orgaos().then(setOrgaos).catch(() => {});
  }, [editando, categorias.length]);

  async function salvar() {
    if (!o) return;
    setSalvando(true);
    try {
      const texto = (v: string) => (String(v ?? "").trim() === "" ? undefined : String(v).trim());
      const num = (v: string) => (v === "" ? undefined : Number(v));
      await complianceService.atualizar(o.id, {
        nome: form.nome?.trim(),
        sigla: texto(form.sigla),
        numeroDocumento: texto(form.numeroDocumento),
        categoriaId: form.categoriaId,
        orgaoId: texto(form.orgaoId),
        unidade: texto(form.unidade),
        departamento: texto(form.departamento),
        ativoIdentificador: texto(form.ativoIdentificador),
        criticidade: form.criticidade,
        dataEmissao: texto(form.dataEmissao),
        dataValidade: texto(form.dataValidade),
        prazoMinimoDias: num(form.prazoMinimoDias) ?? 0,
        validadeMeses: num(form.validadeMeses),
        renovacaoAutomatica: !!form.renovacaoAutomatica,
        observacoes: texto(form.observacoes),
      });
      useToastStore.getState().success("Alterações salvas");
      setEditando(false);
      await carregar();
      onMudou();
    } catch { /* interceptor */ } finally { setSalvando(false); }
  }

  async function excluir() {
    if (!o) return;
    if (!confirm(`Excluir ${o.codigo} — ${o.nome}?\n\nSai das telas mas fica guardado para auditoria.`)) return;
    try {
      await complianceService.excluir(o.id);
      useToastStore.getState().success("Obrigação excluída");
      onMudou();
      onFechar();
    } catch { /* interceptor */ }
  }

  async function mudarStatus(status: string) {
    if (!o) return;
    try {
      await complianceService.mudarStatus(o.id, status);
      await carregar();
      onMudou();
    } catch { /* interceptor */ }
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal
      aberto={!!obrigacaoId}
      titulo={o ? `${o.codigo} · ${o.nome}` : "Carregando…"}
      subtitulo={o ? [o.sigla, o.numeroDocumento, o.categoria?.nome].filter(Boolean).join(" · ") : undefined}
      onFechar={onFechar}
      largura={980}
    >
      <div className="panel__body" style={{ maxHeight: "76vh", overflowY: "auto" }}>
        {carregando && !o ? (
          <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
        ) : !o ? null : (
          <>
            {/* Situação e prazos primeiro: é o que a pessoa abriu para ver. */}
            <ReguaDePrazos o={o} />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 16px" }}>
              {podeEditar && !editando && (
                <button type="button" className="btn btn-ghost" onClick={() => setEditando(true)}>
                  <Pencil size={13} /> Editar aqui
                </button>
              )}
              {editando && (
                <>
                  <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
                    <Save size={13} /> {salvando ? "Salvando…" : "Salvar"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditando(false); carregar(); }}>
                    <X size={13} /> Cancelar
                  </button>
                </>
              )}
              {podeRenovar && !editando && (
                <>
                  <button type="button" className="btn btn-ghost" onClick={() => onRenovar(o)}>
                    <RefreshCw size={13} /> Renovar
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => onProtocolar(o)}>
                    <Stamp size={13} /> Protocolo
                  </button>
                </>
              )}
              <span style={{ flex: 1 }} />
              <Link
                href={`/dashboard/compliance/obrigacoes/${o.id}`}
                className="btn btn-ghost"
                title="Abrir em página própria, com endereço que dá para compartilhar"
              >
                <ExternalLink size={13} /> Página
              </Link>
              {podeExcluir && !editando && (
                <button type="button" className="btn btn-ghost" onClick={excluir}
                  style={{ color: "var(--accent-red)" }}>
                  <Trash2 size={13} /> Excluir
                </button>
              )}
            </div>

            <Tabs<Aba>
              tabs={[
                { id: "dados", label: "Dados" },
                { id: "anexos", label: "Anexos" },
                { id: "historico", label: "Histórico" },
                { id: "versoes", label: `Versões (${o.versaoAtual})` },
              ]}
              active={aba}
              onChange={setAba}
            />

            {aba === "dados" && (
              editando
                ? <FormEmLinha o={o} form={form} set={set} categorias={categorias} orgaos={orgaos} />
                : <Leitura o={o} podeMudarStatus={pode(user, "compliance.obrigacao:mudar_status")} onStatus={mudarStatus} />
            )}
            {aba === "anexos" && <AbaAnexos o={o} user={user} />}
            {aba === "historico" && <AbaHistorico id={o.id} />}
            {aba === "versoes" && <AbaVersoes id={o.id} />}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Régua de prazos ───────────────────────────────────────────────────────
   Os três marcos na ordem em que acontecem. É a informação que a planilha
   tinha espalhada em três colunas de fórmula que ninguém lia. */

function ReguaDePrazos({ o }: { o: Obrigacao }) {
  const marcos = [
    { rotulo: "Iniciar renovação", quando: o.prazoInternoEm, dias: o.diasParaPrazoInterno, cor: "var(--accent-amber)" },
    { rotulo: "Prazo fatal", quando: o.prazoFatalEm, dias: o.diasParaPrazoFatal, cor: "var(--accent-red)" },
    { rotulo: "Vencimento", quando: o.dataValidade, dias: o.diasParaValidade, cor: "var(--accent-violet)" },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <SeloSituacao o={o} />
        <SeloCriticidade nivel={o.criticidade} />
        <StatusBadge label={ROTULO_STATUS[o.status]} tone="neutro" />
        {o.unidade && <StatusBadge label={o.unidade} tone="neutro" />}
        {o.ativoIdentificador && <StatusBadge label={o.ativoIdentificador} tone="neutro" />}
      </div>

      {o.renovacaoAutomatica && !o.prorrogacaoVigente && (
        <Aviso tom="atencao">
          Marcada como <strong>renovação automática</strong>, mas sem protocolo tempestivo registrado —
          por isso continua sendo cobrada.
          {o.protocoloEm
            ? ` O protocolo de ${data(o.protocoloEm)} é posterior ao prazo fatal.`
            : " Registre número e data do protocolo para a prorrogação valer."}
        </Aviso>
      )}
      {o.prorrogacaoVigente && (
        <Aviso tom="info">
          Validade <strong>prorrogada</strong> pelo protocolo {o.protocoloNumero} de {data(o.protocoloEm)},
          até decisão do órgão. Os alertas estão suspensos.
        </Aviso>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
        {marcos.map(m => {
          const passou = m.dias != null && m.dias < 0;
          return (
            <div key={m.rotulo} style={{
              padding: "12px 14px", borderRadius: 12,
              background: passou ? `color-mix(in srgb, ${m.cor} 10%, transparent)` : undefined,
              border: `1px solid color-mix(in srgb, ${m.cor} ${passou ? 34 : 16}%, transparent)`,
            }}>
              <div className="mono-cap" style={{ fontSize: 9.5, color: "var(--text-muted)", marginBottom: 5 }}>
                {m.rotulo}
              </div>
              <div className="metric" style={{ fontSize: 18 }}>{data(m.quando)}</div>
              <div style={{ fontSize: 11, color: passou ? m.cor : "var(--text-secondary)", marginTop: 2 }}>
                {m.dias == null ? "—" : passou ? `passou ${prazoEmPalavras(m.dias)}` : prazoEmPalavras(m.dias)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Leitura ───────────────────────────────────────────────────────────── */

function Leitura({
  o, podeMudarStatus, onStatus,
}: { o: Obrigacao; podeMudarStatus: boolean; onStatus: (s: string) => void }) {
  return (
    <>
      <FieldGrid>
        <Field label="Órgão emissor" value={o.orgao?.nome} />
        <Field label="Emissão" value={data(o.dataEmissao)} />
        <Field label="Periodicidade" value={o.validadeMeses ? `${o.validadeMeses} meses` : null} />
        <Field label="Prazo do órgão" value={`${o.prazoMinimoDias} ${o.prazoMinimoDias === 1 ? "dia" : "dias"}`} />
        <Field label="Renovação automática" value={o.renovacaoAutomatica ? "Sim" : "Não"} />
        <Field label="Protocolo" value={o.protocoloNumero} />
        <Field label="Última renovação" value={data(o.dataUltimaRenovacao)} />
        <Field label="Empresa" value={o.empresa} />
        <Field label="Departamento" value={o.departamento} />
        <Field label="Centro de custo" value={o.centroCusto} />
        <Field label="Valor da licença" value={dinheiro(o.valorLicenca)} />
        <Field label="Valor da renovação" value={dinheiro(o.valorRenovacao)} />
        <Field label="Tags" value={o.tags.map(t => t.nome).join(", ")} />
        <Field label="Observações" value={o.observacoes} />
      </FieldGrid>

      {o.campos.length > 0 && (
        <>
          <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", margin: "18px 0 8px" }}>
            {o.categoria?.nome}
          </div>
          <FieldGrid>
            {o.campos.map(c => (
              <Field key={c.chave} label={c.rotulo}
                value={c.valor == null ? null
                  : c.tipo === "booleano" ? (c.valor ? "Sim" : "Não")
                  : c.tipo === "data" ? data(String(c.valor)) : String(c.valor)} />
            ))}
          </FieldGrid>
        </>
      )}

      <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", margin: "18px 0 8px" }}>
        Responsáveis
      </div>
      {o.responsaveis.length === 0 ? (
        <Aviso tom="atencao">
          Sem responsável cadastrado — <strong>esta obrigação não avisa ninguém</strong>.
        </Aviso>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {o.responsaveis.map((r, i) => (
            <div key={r.id ?? i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
              <StatusBadge label={r.papel} tone={r.papel === "principal" ? "info" : "neutro"} />
              <span style={{ fontWeight: 600 }}>{r.user?.nome ?? r.nome ?? "—"}</span>
              <span style={{ color: "var(--text-secondary)" }}>{r.email ?? r.user?.email ?? ""}</span>
              <span style={{ color: "var(--text-muted)" }}>{r.telefone ?? ""}</span>
              {r.notificar === false && (
                <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>(não recebe avisos)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {podeMudarStatus && (
        <>
          <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", margin: "18px 0 8px" }}>
            Situação declarada
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["ativa", "em_renovacao", "suspensa", "cancelada", "arquivada"] as const).map(s => (
              <button key={s} type="button"
                className={o.status === s ? "btn btn-primary" : "btn btn-ghost"}
                onClick={() => onStatus(s)} disabled={o.status === s}
                style={{ padding: "4px 10px", fontSize: 11.5 }}>
                {ROTULO_STATUS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ── Edição em linha ───────────────────────────────────────────────────────
   Os campos que se corrige no dia a dia. O cadastro completo, com escopo,
   custos e campos personalizados, continua no formulário de 5 abas — trazer
   tudo para cá tornaria o modal tão pesado quanto o que ele evita. */

function FormEmLinha({
  o, form, set, categorias, orgaos,
}: {
  o: Obrigacao; form: Record<string, any>; set: (k: string, v: any) => void;
  categorias: Categoria[]; orgaos: Orgao[];
}) {
  const campo = (rotulo: string, chave: string, tipo = "text", dica?: string) => (
    <div className="form-field">
      <label className="form-field__label">{rotulo}</label>
      <input type={tipo} className="input-o" value={form[chave] ?? ""}
        onChange={e => set(chave, e.target.value)} />
      {dica && <span className="form-field__dica">{dica}</span>}
    </div>
  );

  return (
    <>
      <Aviso tom="info">
        Prazo interno e prazo fatal <strong>não se digitam</strong> — saem da validade menos o prazo do
        órgão, menos a folga da categoria. Mude a validade ou o prazo e eles se recalculam ao salvar.
      </Aviso>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label className="form-field__label">Nome</label>
          <input className="input-o" value={form.nome ?? ""} onChange={e => set("nome", e.target.value)} />
        </div>
        {campo("Sigla", "sigla")}
        {campo("Número do documento", "numeroDocumento")}

        <div className="form-field">
          <label className="form-field__label">Categoria</label>
          <select className="input-o" value={form.categoriaId ?? ""} onChange={e => set("categoriaId", e.target.value)}>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label">Órgão</label>
          <select className="input-o" value={form.orgaoId ?? ""} onChange={e => set("orgaoId", e.target.value)}>
            <option value="">Não informado</option>
            {orgaos.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>

        {campo("Emissão", "dataEmissao", "date")}
        {campo("Validade", "dataValidade", "date")}
        {campo("Prazo do órgão (dias)", "prazoMinimoDias", "number", "Antecedência exigida para protocolar")}
        {campo("Periodicidade (meses)", "validadeMeses", "number", "Propõe a próxima validade na renovação")}
        {campo("Unidade / instalação", "unidade")}
        {campo("Departamento", "departamento")}
        {campo("Equipamento / série", "ativoIdentificador")}

        <div className="form-field">
          <label className="form-field__label">Criticidade</label>
          <select className="input-o" value={form.criticidade ?? "media"} onChange={e => set("criticidade", e.target.value)}>
            {Object.entries(ROTULO_CRITICIDADE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.renovacaoAutomatica}
              onChange={e => set("renovacaoAutomatica", e.target.checked)} />
            O protocolo tempestivo prorroga a validade
          </label>
        </div>

        <div className="form-field" style={{ gridColumn: "1 / -1" }}>
          <label className="form-field__label">Observações</label>
          <textarea className="input-o" rows={3} value={form.observacoes ?? ""}
            onChange={e => set("observacoes", e.target.value)} />
        </div>
      </div>
    </>
  );
}

/* ── Abas ──────────────────────────────────────────────────────────────── */

function AbaAnexos({ o, user }: { o: Obrigacao; user: any }) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const podeEnviar = pode(user, "compliance.anexo:enviar");
  const podeExcluir = pode(user, "compliance.anexo:excluir");

  const carregar = useCallback(() => {
    complianceService.anexos(o.id).then(setItens).catch(() => setItens([]));
  }, [o.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(arquivos: FileList) {
    setEnviando(true);
    try {
      // Em lote: quem digitaliza uma licença sobe frente, verso e anexos de uma vez.
      for (const a of Array.from(arquivos)) {
        await complianceService.enviarAnexo(o.id, a, { titulo: a.name });
      }
      useToastStore.getState().success(
        arquivos.length === 1 ? "Anexo enviado" : `${arquivos.length} anexos enviados`,
      );
      carregar();
    } catch { /* interceptor */ } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const COLS = ["Documento", "Versão", "Tamanho", "Enviado", ""];

  return (
    <>
      {podeEnviar && (
        <div style={{ marginBottom: 12 }}>
          <input ref={entrada} type="file" multiple style={{ display: "none" }}
            onChange={e => { const f = e.target.files; if (f?.length) enviar(f); }} />
          <button type="button" className="btn btn-ghost" disabled={enviando}
            onClick={() => entrada.current?.click()}>
            <Upload size={13} /> {enviando ? "Enviando…" : "Anexar (pode escolher vários)"}
          </button>
        </div>
      )}
      <TableCard>
        <thead><tr>{COLS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {itens.length === 0 ? (
            <EmptyState colSpan={COLS.length} icon={<Paperclip size={18} />}
              title="Nenhum documento anexado"
              hint="Uma obrigação sem o documento não prova nada numa fiscalização." />
          ) : itens.map(a => (
            <tr key={a.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{a.titulo}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{a.nomeOriginal}</div>
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
                    <span style={{ fontSize: 10.5, color: "var(--accent-red)" }}>indisponível</span>
                  )}
                  {podeExcluir && (
                    <button type="button" className="btn-icon" title="Excluir"
                      onClick={async () => {
                        if (!confirm(`Excluir "${a.titulo}"?`)) return;
                        await complianceService.excluirAnexo(a.id);
                        carregar();
                      }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>
    </>
  );
}

const TOM_ACAO: Record<string, "ok" | "info" | "atencao" | "critico" | "neutro"> = {
  criou: "ok", editou: "info", renovou: "ok", protocolou: "info", anexou: "info",
  removeu_anexo: "atencao", mudou_status: "atencao", notificou: "info",
  aprovou: "ok", rejeitou: "critico", excluiu: "critico", comentou: "neutro",
};

function AbaHistorico({ id }: { id: string }) {
  const [itens, setItens] = useState<EventoHistorico[]>([]);
  useEffect(() => { complianceService.historico(id).then(setItens).catch(() => setItens([])); }, [id]);

  return (
    <Timeline
      itens={itens.map(e => ({
        id: e.id,
        titulo: e.descricao ?? e.acao,
        descricao: [e.user?.nome ?? (e.origem === "sistema" ? "sistema" : null), e.campo]
          .filter(Boolean).join(" · ") || undefined,
        data: e.criadoEm,
        tone: TOM_ACAO[e.acao] ?? "neutro",
      }))}
    />
  );
}

function AbaVersoes({ id }: { id: string }) {
  const [itens, setItens] = useState<Versao[]>([]);
  useEffect(() => { complianceService.versoes(id).then(setItens).catch(() => setItens([])); }, [id]);

  const COLS = ["Versão", "Documento", "Emissão", "Validade", "Prazo fatal", "Vigência"];
  return (
    <TableCard>
      <thead><tr>{COLS.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
      <tbody>
        {itens.length === 0 ? (
          <EmptyState colSpan={COLS.length} icon={<Layers size={18} />} title="Nenhuma versão" />
        ) : itens.map(v => (
          <tr key={v.id}>
            <td className="num" style={{ fontWeight: 600 }}>v{v.versao}</td>
            <td>{v.numeroDocumento ?? "—"}</td>
            <td className="num">{data(v.dataEmissao)}</td>
            <td className="num">{data(v.dataValidade)}</td>
            <td className="num">{data(v.prazoFatalEm)}</td>
            <td>
              <StatusBadge label={v.encerradaEm ? `até ${data(v.encerradaEm)}` : "corrente"}
                tone={v.encerradaEm ? "neutro" : "ok"} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}
