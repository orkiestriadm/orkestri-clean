"use client";

import { useEffect, useState } from "react";
import { Modal, FormGrid, FormField, FormActions, Tabs } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { useAuthStore } from "@/lib/store";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { CasoDetalhe, Filtros } from "@/lib/estrategico/types";
import { pode, lerNumero, mensagemErro, Nota, SemAcao } from "./comuns";

/**
 * Cadastro e edição do assunto estratégico.
 *
 * As abas seguem as perguntas do plano, e não as colunas da planilha: o que
 * é, em que pé está, quem responde, qual o próximo passo, quanto vale e qual o
 * risco. A tela de detalhe abre direto na aba do bloco em que se clicou.
 *
 * A regra "toda ação tem prazo" é aplicada aqui: próxima ação sem prazo não
 * salva. Já assunto sem próxima ação salva — os importados nascem assim —, e
 * o sistema sinaliza em vez de bloquear.
 */

export type AbaForm = "geral" | "workflow" | "responsaveis" | "acao" | "financeiro" | "risco";

const CAMPOS_VALOR = [
  "valorPretendido", "valorSolicitado", "valorEmAnalise", "valorReconhecido", "valorAlcancado",
  "valorRecebido", "valorReequilibrio", "valorEmRisco", "valorPotencial",
];
const DIMENSOES = ["riscoFinanceiro", "riscoJuridico", "riscoRegulatorio", "riscoOperacional", "riscoPrazo"];

const ABA_DO_CAMPO: Record<string, AbaForm> = {
  titulo: "geral", proximaAcaoPrazo: "acao", proximaAcaoResponsavelNome: "acao",
  ...Object.fromEntries(CAMPOS_VALOR.map(c => [c, "financeiro" as AbaForm])),
};

type Form = Record<string, any>;

function doCaso(c?: CasoDetalhe | null): Form {
  const d = (v?: string | null) => (v ? v.slice(0, 10) : "");
  const n = (v?: number | null) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
  return {
    titulo: c?.titulo ?? "", descricao: c?.descricao ?? "", tipo: c?.tipo ?? "assunto",
    grupoId: c?.grupo?.id ?? "", objetivoId: c?.objetivo?.id ?? "", esferaId: c?.esfera?.id ?? "",
    etapa: c?.etapa ?? "", estagioOportunidade: c?.estagioOportunidade ?? "", prioridade: c?.prioridade ?? "media",
    prazoFinal: d(c?.prazoFinal), motivo: "",
    areaExecutivaId: c?.areaExecutiva?.id ?? "", areaOperacionalId: c?.areaOperacional?.id ?? "",
    responsavelExecutivoId: c?.responsavelExecutivo?.id ?? "", responsavelOperacionalId: c?.responsavelOperacional?.id ?? "",
    areasApoioIds: c?.areasApoio?.map(a => a.id) ?? [],
    proximaAcao: c?.proximaAcao ?? "", proximaAcaoResponsavelId: c?.proximaAcaoResponsavel?.id ?? "",
    proximaAcaoResponsavelNome: c?.proximaAcaoResponsavelNome ?? "", proximaAcaoPrazo: d(c?.proximaAcaoPrazo),
    proximaAcaoPrioridade: c?.proximaAcaoPrioridade ?? "",
    classificacaoFinanceira: c?.classificacaoFinanceira ?? "", valoresReferenciaEm: d(c?.valoresReferenciaEm), observacaoValor: "",
    ...Object.fromEntries(CAMPOS_VALOR.map(k => [k, n((c as any)?.[k])])),
    probabilidade: c?.probabilidade ?? "", impacto: c?.impacto ?? "",
    ...Object.fromEntries(DIMENSOES.map(k => [k, (c as any)?.[k] ?? ""])),
    planoMitigacao: c?.planoMitigacao ?? "",
  };
}

export default function CasoForm({
  aberto, caso, abaInicial = "geral", filtros, onFechar, onSalvo,
}: {
  aberto: boolean;
  caso?: CasoDetalhe | null;
  abaInicial?: AbaForm;
  filtros: Filtros | null;
  onFechar: () => void;
  onSalvo: (c: CasoDetalhe) => void;
}) {
  const user = useAuthStore(s => s.user);
  const toast = useToastStore();
  const editando = !!caso;
  const verFin = pode(user, "estrategico.financeiro:ver");
  const editarFin = pode(user, "estrategico.financeiro:editar");

  const [aba, setAba] = useState<AbaForm>(abaInicial);
  const [f, setF] = useState<Form>(doCaso(caso));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setF(doCaso(caso));
    setAba(abaInicial);
    setErros({});
  }, [aberto, caso, abaInicial]);

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const etapaMudou = editando && f.etapa && f.etapa !== caso?.etapa;
  const opcoes = (lista?: { id: string; nome: string }[]) => (lista ?? []).map(o => <option key={o.id} value={o.id}>{o.nome}</option>);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!f.titulo.trim()) e.titulo = "Informe o título.";
    if (f.proximaAcao.trim() && !f.proximaAcaoPrazo) e.proximaAcaoPrazo = "Toda ação precisa de prazo.";
    if (f.proximaAcaoResponsavelId && f.proximaAcaoResponsavelNome.trim()) {
      e.proximaAcaoResponsavelNome = "Escolha um usuário ou informe um nome — não os dois.";
    }
    const valores: Record<string, number | null> = {};
    if (editarFin) {
      for (const k of CAMPOS_VALOR) {
        const n = lerNumero(f[k]);
        if (Number.isNaN(n)) e[k] = "Valor inválido.";
        else valores[k] = n;
      }
    }
    setErros(e);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      setAba(ABA_DO_CAMPO[primeiro] ?? "geral");
      return;
    }

    const nul = (v: any) => (v === "" || v == null ? null : v);
    const int = (v: any) => (v === "" || v == null ? null : Number(v));
    const payload: Record<string, any> = {
      titulo: f.titulo.trim(), descricao: nul(f.descricao.trim()), tipo: f.tipo,
      grupoId: nul(f.grupoId), objetivoId: nul(f.objetivoId), esferaId: nul(f.esferaId),
      prioridade: f.prioridade,
      estagioOportunidade: f.tipo === "oportunidade" ? (nul(f.estagioOportunidade) ?? "identificada") : null,
      prazoFinal: nul(f.prazoFinal),
      areaExecutivaId: nul(f.areaExecutivaId), areaOperacionalId: nul(f.areaOperacionalId),
      responsavelExecutivoId: nul(f.responsavelExecutivoId), responsavelOperacionalId: nul(f.responsavelOperacionalId),
      areasApoioIds: f.areasApoioIds.filter((a: string) => a !== f.areaOperacionalId && a !== f.areaExecutivaId),
      proximaAcao: nul(f.proximaAcao.trim()), proximaAcaoResponsavelId: nul(f.proximaAcaoResponsavelId),
      proximaAcaoResponsavelNome: nul(f.proximaAcaoResponsavelNome.trim()),
      proximaAcaoPrazo: nul(f.proximaAcaoPrazo), proximaAcaoPrioridade: nul(f.proximaAcaoPrioridade),
      probabilidade: int(f.probabilidade), impacto: int(f.impacto),
      ...Object.fromEntries(DIMENSOES.map(k => [k, int(f[k])])),
      planoMitigacao: nul(f.planoMitigacao.trim()),
    };
    if (f.etapa) payload.etapa = f.etapa;
    if (etapaMudou && f.motivo.trim()) payload.motivo = f.motivo.trim();
    if (editarFin) {
      Object.assign(payload, valores, {
        classificacaoFinanceira: nul(f.classificacaoFinanceira), valoresReferenciaEm: nul(f.valoresReferenciaEm),
      });
      if (f.observacaoValor.trim()) payload.observacaoValor = f.observacaoValor.trim();
    }

    setSalvando(true);
    try {
      const r = editando
        ? await estrategicoService.atualizar(caso!.id, payload)
        : await estrategicoService.criar(payload);
      toast.success(editando ? "Assunto atualizado" : `Assunto ${r.codigo} cadastrado`);
      onSalvo(r);
    } catch (err) {
      toast.error("Não foi possível salvar", mensagemErro(err, "Erro ao salvar o assunto."));
    } finally {
      setSalvando(false);
    }
  }

  const abas: { id: AbaForm; label: string }[] = [
    { id: "geral", label: "Identificação" },
    { id: "workflow", label: "Etapa e prazos" },
    { id: "responsaveis", label: "Responsáveis" },
    { id: "acao", label: "Próxima ação" },
    ...(verFin ? [{ id: "financeiro" as AbaForm, label: "Financeiro" }] : []),
    { id: "risco", label: "Risco" },
  ];

  const etapasVisiveis = filtros?.etapas ?? [];

  return (
    <Modal
      aberto={aberto}
      titulo={editando ? `Editar ${caso!.codigo}` : "Novo assunto estratégico"}
      subtitulo={editando ? caso!.titulo : "Pleito, processo, negociação ou oportunidade acompanhada pela Diretoria"}
      onFechar={onFechar}
      largura={880}
    >
      <Tabs tabs={abas} active={aba} onChange={id => setAba(id as AbaForm)} />
      <div style={{ marginTop: 16 }}>
        {aba === "geral" && (
          <FormGrid min={240}>
            <FormField label="Título" obrigatorio erro={erros.titulo} largura="total">
              <input className="input-o" value={f.titulo} onChange={e => set("titulo", e.target.value)} maxLength={300} autoFocus />
            </FormField>
            <FormField label="Tipo">
              <select className="input-o" value={f.tipo} onChange={e => set("tipo", e.target.value)}>
                <option value="assunto">Assunto estratégico</option>
                <option value="oportunidade">Oportunidade (ainda não é pleito formal)</option>
              </select>
            </FormField>
            <FormField label="Grupo" dica="Agrupamento da planilha (Reequilíbrio, Investimentos…)">
              <select className="input-o" value={f.grupoId} onChange={e => set("grupoId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.grupos)}
              </select>
            </FormField>
            <FormField label="Objetivo">
              <select className="input-o" value={f.objetivoId} onChange={e => set("objetivoId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.objetivos)}
              </select>
            </FormField>
            <FormField label="Esfera">
              <select className="input-o" value={f.esferaId} onChange={e => set("esferaId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.esferas)}
              </select>
            </FormField>
            <FormField label="Descrição" largura="total">
              <textarea className="input-o" rows={4} value={f.descricao} onChange={e => set("descricao", e.target.value)} maxLength={8000} />
            </FormField>
          </FormGrid>
        )}

        {aba === "workflow" && (
          <FormGrid min={240}>
            <FormField label="Etapa" dica="Status operacional. A saúde (farol) é calculada à parte.">
              <select className="input-o" value={f.etapa} onChange={e => set("etapa", e.target.value)}>
                {!editando && <option value="">{f.tipo === "oportunidade" ? "Ideia/Oportunidade" : "Em análise"} (padrão)</option>}
                {etapasVisiveis.map(e => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
              </select>
            </FormField>
            {f.tipo === "oportunidade" && (
              <FormField label="Estágio no pipeline">
                <select className="input-o" value={f.estagioOportunidade} onChange={e => set("estagioOportunidade", e.target.value)}>
                  {(filtros?.pipeline ?? []).map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Prioridade">
              <select className="input-o" value={f.prioridade} onChange={e => set("prioridade", e.target.value)}>
                {(filtros?.prioridades ?? []).map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
              </select>
            </FormField>
            <FormField label="Prazo final do assunto" dica="Opcional — ex.: prazo final da comissão">
              <input type="date" className="input-o" value={f.prazoFinal} onChange={e => set("prazoFinal", e.target.value)} />
            </FormField>
            {etapaMudou && (
              <FormField label="Motivo da mudança de etapa" largura="total" dica="Vai para a timeline do assunto.">
                <input className="input-o" value={f.motivo} onChange={e => set("motivo", e.target.value)} maxLength={1000} />
              </FormField>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <Nota>
                A dependência externa (ANTT, Judiciário, Banco…) é registrada na aba <strong>Dependências</strong> do assunto,
                com a data de início — é ela que permite dizer "aguardando ANTT há 32 dias".
              </Nota>
            </div>
          </FormGrid>
        )}

        {aba === "responsaveis" && (
          <FormGrid min={240}>
            <FormField label="Área executiva" dica="Uma só — ex.: Diretoria">
              <select className="input-o" value={f.areaExecutivaId} onChange={e => set("areaExecutivaId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.areas)}
              </select>
            </FormField>
            <FormField label="Responsável executivo">
              <select className="input-o" value={f.responsavelExecutivoId} onChange={e => set("responsavelExecutivoId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.usuarios)}
              </select>
            </FormField>
            <FormField label="Área operacional" dica="Uma só — ex.: Regulatório">
              <select className="input-o" value={f.areaOperacionalId} onChange={e => set("areaOperacionalId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.areas)}
              </select>
            </FormField>
            <FormField label="Responsável operacional">
              <select className="input-o" value={f.responsavelOperacionalId} onChange={e => set("responsavelOperacionalId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.usuarios)}
              </select>
            </FormField>
            <FormField label="Áreas de apoio" largura="total">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                {(filtros?.areas ?? []).filter(a => a.id !== f.areaOperacionalId && a.id !== f.areaExecutivaId).map(a => (
                  <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={f.areasApoioIds.includes(a.id)}
                      onChange={e => set("areasApoioIds", e.target.checked ? [...f.areasApoioIds, a.id] : f.areasApoioIds.filter((x: string) => x !== a.id))}
                    />
                    {a.nome}
                  </label>
                ))}
                {!filtros?.areas?.length && <Nota>Nenhuma área no catálogo — cadastre em Configurações.</Nota>}
              </div>
            </FormField>
          </FormGrid>
        )}

        {aba === "acao" && (
          <FormGrid min={240}>
            {!f.proximaAcao.trim() && <div style={{ gridColumn: "1 / -1" }}><SemAcao /></div>}
            <FormField label="Próxima ação" largura="total" dica='Concreta e verificável — ex.: "Cobrar manifestação da ANTT".'>
              <textarea className="input-o" rows={2} value={f.proximaAcao} onChange={e => set("proximaAcao", e.target.value)} maxLength={2000} />
            </FormField>
            <FormField label="Responsável (usuário)">
              <select className="input-o" value={f.proximaAcaoResponsavelId} onChange={e => set("proximaAcaoResponsavelId", e.target.value)}>
                <option value="">—</option>{opcoes(filtros?.usuarios)}
              </select>
            </FormField>
            <FormField label="…ou responsável sem login" erro={erros.proximaAcaoResponsavelNome} dica="Escritório, consultoria, contato externo">
              <input className="input-o" value={f.proximaAcaoResponsavelNome} onChange={e => set("proximaAcaoResponsavelNome", e.target.value)} maxLength={160} />
            </FormField>
            <FormField label="Prazo" obrigatorio={!!f.proximaAcao.trim()} erro={erros.proximaAcaoPrazo}>
              <input type="date" className="input-o" value={f.proximaAcaoPrazo} onChange={e => set("proximaAcaoPrazo", e.target.value)} />
            </FormField>
            <FormField label="Prioridade da ação">
              <select className="input-o" value={f.proximaAcaoPrioridade} onChange={e => set("proximaAcaoPrioridade", e.target.value)}>
                <option value="">Igual à do assunto</option>
                {(filtros?.prioridades ?? []).map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
              </select>
            </FormField>
          </FormGrid>
        )}

        {aba === "financeiro" && verFin && (
          <FormGrid min={200}>
            {!editarFin && <div style={{ gridColumn: "1 / -1" }}><Nota>Você pode ver, mas não alterar, os valores.</Nota></div>}
            <FormField label="Classificação">
              <select className="input-o" value={f.classificacaoFinanceira} onChange={e => set("classificacaoFinanceira", e.target.value)} disabled={!editarFin}>
                <option value="">—</option>
                {(filtros?.classificacoesFinanceiras ?? []).map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            </FormField>
            <FormField label="Data de referência">
              <input type="date" className="input-o" value={f.valoresReferenciaEm} onChange={e => set("valoresReferenciaEm", e.target.value)} disabled={!editarFin} />
            </FormField>
            {(filtros?.camposValor ?? []).map(c => (
              <FormField key={c.campo} label={`${c.rotulo} (R$)`} erro={erros[c.campo]}>
                <input className="input-o num" inputMode="decimal" placeholder="0,00" value={f[c.campo]} onChange={e => set(c.campo, e.target.value)} disabled={!editarFin} />
              </FormField>
            ))}
            {editarFin && (
              <FormField label="O que motivou a mudança de valor" largura="total" dica='Vai para o histórico financeiro — ex.: "Estudo econômico", "Proposta à ANTT".'>
                <input className="input-o" value={f.observacaoValor} onChange={e => set("observacaoValor", e.target.value)} maxLength={500} />
              </FormField>
            )}
          </FormGrid>
        )}

        {aba === "risco" && (
          <FormGrid min={180}>
            {(["probabilidade", "impacto"] as const).map(k => (
              <FormField key={k} label={k === "probabilidade" ? "Probabilidade (1–5)" : "Impacto (1–5)"}>
                <select className="input-o" value={f[k]} onChange={e => set(k, e.target.value)}>
                  <option value="">Não avaliado</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </FormField>
            ))}
            {(filtros?.dimensoesRisco ?? []).map(d => (
              <FormField key={d.campo} label={`Risco ${d.rotulo.toLowerCase()} (1–5)`}>
                <select className="input-o" value={f[d.campo]} onChange={e => set(d.campo, e.target.value)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}{n === 5 ? " · crítico" : n === 4 ? " · alto" : ""}</option>)}
                </select>
              </FormField>
            ))}
            <FormField label="Plano de mitigação" largura="total">
              <textarea className="input-o" rows={3} value={f.planoMitigacao} onChange={e => set("planoMitigacao", e.target.value)} maxLength={8000} />
            </FormField>
            <div style={{ gridColumn: "1 / -1" }}>
              <Nota>Probabilidade × Impacto: 1–4 baixo · 5–9 moderado · 10–14 alto · 15–25 crítico. Dimensão em 5 torna o farol vermelho.</Nota>
            </div>
          </FormGrid>
        )}
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar"}
        </button>
      </FormActions>
    </Modal>
  );
}
