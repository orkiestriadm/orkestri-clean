"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal, FormGrid, FormField, FormActions, Tabs } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Obrigacao, Categoria, Orgao, CampoDefinicao } from "@/lib/compliance/types";
import { ROTULO_CRITICIDADE } from "@/lib/compliance/types";

/**
 * Cadastro e edição de obrigação.
 *
 * A tela NUNCA pede o prazo interno nem o prazo fatal como campo comum — eles
 * são calculados a partir da validade, do prazo que o órgão exige e da folga
 * da categoria, e o formulário mostra o resultado em tempo real, antes de
 * salvar. Foi a fórmula da planilha que virou comportamento visível.
 *
 * O override existe na aba "Prazos", com esse nome, para que sobrepor a conta
 * seja um ato consciente e não uma digitação distraída.
 */

type Aba = "geral" | "prazos" | "escopo" | "responsaveis" | "campos";

const VAZIO = {
  categoriaId: "", nome: "", sigla: "", numeroDocumento: "", descricao: "",
  orgaoId: "", empresa: "", filial: "", unidade: "", departamento: "",
  centroCusto: "", ativoIdentificador: "",
  criticidade: "media",
  dataEmissao: "", dataValidade: "",
  validadeMeses: "", prazoMinimoDias: "0", folgaInternaDias: "",
  prazoFatalManual: "", prazoInternoManual: "",
  renovacaoAutomatica: false,
  valorLicenca: "", valorRenovacao: "", notaFiscal: "",
  observacoes: "",
  tags: "" as string,
};

type Formulario = typeof VAZIO;
type LinhaResponsavel = { papel: string; nome: string; email: string; telefone: string; notificar: boolean };

const soData = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export default function ObrigacaoForm({
  aberto, obrigacao, onFechar, onSalvo,
}: {
  aberto: boolean;
  obrigacao: Obrigacao | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [aba, setAba] = useState<Aba>("geral");
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [responsaveis, setResponsaveis] = useState<LinhaResponsavel[]>([]);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!aberto) return;
    complianceService.categorias().then(setCategorias).catch(() => setCategorias([]));
    complianceService.orgaos().then(setOrgaos).catch(() => setOrgaos([]));
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    setAba("geral");
    setErros({});

    if (!obrigacao) {
      setForm(VAZIO);
      setResponsaveis([{ papel: "principal", nome: "", email: "", telefone: "", notificar: true }]);
      setCampos({});
      return;
    }

    setForm({
      categoriaId: obrigacao.categoriaId,
      nome: obrigacao.nome,
      sigla: obrigacao.sigla ?? "",
      numeroDocumento: obrigacao.numeroDocumento ?? "",
      descricao: obrigacao.descricao ?? "",
      orgaoId: obrigacao.orgaoId ?? "",
      empresa: obrigacao.empresa ?? "",
      filial: obrigacao.filial ?? "",
      unidade: obrigacao.unidade ?? "",
      departamento: obrigacao.departamento ?? "",
      centroCusto: obrigacao.centroCusto ?? "",
      ativoIdentificador: obrigacao.ativoIdentificador ?? "",
      criticidade: obrigacao.criticidade,
      dataEmissao: soData(obrigacao.dataEmissao),
      dataValidade: soData(obrigacao.dataValidade),
      validadeMeses: obrigacao.validadeMeses == null ? "" : String(obrigacao.validadeMeses),
      prazoMinimoDias: String(obrigacao.prazoMinimoDias ?? 0),
      folgaInternaDias: obrigacao.folgaInternaDias == null ? "" : String(obrigacao.folgaInternaDias),
      prazoFatalManual: soData(obrigacao.prazoFatalManual),
      prazoInternoManual: soData(obrigacao.prazoInternoManual),
      renovacaoAutomatica: obrigacao.renovacaoAutomatica,
      valorLicenca: obrigacao.valorLicenca == null ? "" : String(obrigacao.valorLicenca),
      valorRenovacao: obrigacao.valorRenovacao == null ? "" : String(obrigacao.valorRenovacao),
      notaFiscal: obrigacao.notaFiscal ?? "",
      observacoes: obrigacao.observacoes ?? "",
      tags: (obrigacao.tags ?? []).map(t => t.nome).join(", "),
    });

    setResponsaveis(
      (obrigacao.responsaveis ?? []).map(r => ({
        papel: r.papel,
        nome: r.user?.nome ?? r.nome ?? "",
        email: r.email ?? r.user?.email ?? "",
        telefone: r.telefone ?? "",
        notificar: r.notificar ?? true,
      })),
    );

    setCampos(
      Object.fromEntries(
        (obrigacao.campos ?? []).map(c => [c.chave, c.valor == null ? "" : String(c.valor)]),
      ),
    );
  }, [aberto, obrigacao]);

  const categoria = useMemo(
    () => categorias.find(c => c.id === form.categoriaId) ?? null,
    [categorias, form.categoriaId],
  );

  const definicoes: CampoDefinicao[] = useMemo(
    () => (categoria?.campos ?? []).filter(c => c.ativo !== false),
    [categoria],
  );

  /**
   * A conta, ao vivo.
   *
   * Reproduz `calcularPrazos` do backend. A duplicação é deliberada e pequena:
   * mostrar o resultado só depois de salvar tiraria justamente o que faz o
   * módulo ser melhor que a planilha — ver a data em que é preciso COMEÇAR.
   * O valor gravado continua sendo o do backend; este é só a prévia.
   */
  const previa = useMemo(() => {
    if (!form.dataValidade) return null;
    const folga = form.folgaInternaDias !== ""
      ? Number(form.folgaInternaDias)
      : categoria?.folgaInternaDias ?? 60;
    const minimo = Number(form.prazoMinimoDias || 0);

    const menos = (iso: string, dias: number) => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() - dias);
      return d.toLocaleDateString("pt-BR");
    };

    const fatal = form.prazoFatalManual || null;
    return {
      fatal: fatal ? new Date(`${fatal}T00:00:00`).toLocaleDateString("pt-BR") : menos(form.dataValidade, minimo),
      interno: form.prazoInternoManual
        ? new Date(`${form.prazoInternoManual}T00:00:00`).toLocaleDateString("pt-BR")
        : menos(fatal ?? form.dataValidade, (fatal ? 0 : minimo) + folga),
      folga, minimo,
      manual: !!(form.prazoFatalManual || form.prazoInternoManual),
    };
  }, [form.dataValidade, form.prazoMinimoDias, form.folgaInternaDias, form.prazoFatalManual, form.prazoInternoManual, categoria]);

  function set<K extends keyof Formulario>(chave: K, valor: Formulario[K]) {
    setForm(f => ({ ...f, [chave]: valor }));
    setErros(e => ({ ...e, [chave as string]: "" }));
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Informe o nome da obrigação.";
    if (!form.categoriaId) e.categoriaId = "Escolha a categoria.";
    if (form.dataEmissao && form.dataValidade && form.dataValidade <= form.dataEmissao) {
      e.dataValidade = "A validade precisa ser posterior à emissão.";
    }
    for (const def of definicoes) {
      if (def.obrigatorio && !String(campos[def.chave] ?? "").trim()) {
        e[`campo.${def.chave}`] = `${def.rotulo} é obrigatório.`;
      }
    }
    setErros(e);
    if (Object.keys(e).length === 0) return true;

    // Leva o usuário para a aba onde está o problema — deixá-lo procurar num
    // formulário de cinco abas é o mesmo que não dizer nada.
    if (e.nome || e.categoriaId) setAba("geral");
    else if (e.dataValidade) setAba("prazos");
    else setAba("campos");
    return false;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      const numero = (v: string) => (v === "" ? undefined : Number(v));
      const texto = (v: string) => (v.trim() === "" ? undefined : v.trim());

      const payload: Record<string, any> = {
        categoriaId: form.categoriaId,
        nome: form.nome.trim(),
        sigla: texto(form.sigla),
        numeroDocumento: texto(form.numeroDocumento),
        descricao: texto(form.descricao),
        orgaoId: texto(form.orgaoId),
        empresa: texto(form.empresa),
        filial: texto(form.filial),
        unidade: texto(form.unidade),
        departamento: texto(form.departamento),
        centroCusto: texto(form.centroCusto),
        ativoIdentificador: texto(form.ativoIdentificador),
        criticidade: form.criticidade,
        dataEmissao: texto(form.dataEmissao),
        dataValidade: texto(form.dataValidade),
        validadeMeses: numero(form.validadeMeses),
        prazoMinimoDias: numero(form.prazoMinimoDias) ?? 0,
        folgaInternaDias: numero(form.folgaInternaDias),
        prazoFatalManual: texto(form.prazoFatalManual),
        prazoInternoManual: texto(form.prazoInternoManual),
        renovacaoAutomatica: form.renovacaoAutomatica,
        valorLicenca: numero(form.valorLicenca),
        valorRenovacao: numero(form.valorRenovacao),
        notaFiscal: texto(form.notaFiscal),
        observacoes: texto(form.observacoes),
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        responsaveis: responsaveis
          .filter(r => r.nome.trim() || r.email.trim())
          .map(r => ({
            papel: r.papel,
            nome: texto(r.nome),
            email: texto(r.email),
            telefone: texto(r.telefone),
            notificar: r.notificar,
          })),
        campos,
      };

      if (obrigacao) await complianceService.atualizar(obrigacao.id, payload);
      else await complianceService.criar(payload);

      useToastStore.getState().success(obrigacao ? "Obrigação atualizada" : "Obrigação cadastrada");
      onSalvo();
      onFechar();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={obrigacao ? `Editar ${obrigacao.codigo}` : "Nova obrigação"}
      subtitulo={obrigacao ? obrigacao.nome : "Qualquer documento com emissão, validade e renovação"}
      onFechar={onFechar}
      largura={860}
    >
      <div className="panel__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <Tabs<Aba>
          tabs={[
            { id: "geral", label: "Geral" },
            { id: "prazos", label: "Prazos" },
            { id: "escopo", label: "Escopo e custos" },
            { id: "responsaveis", label: "Responsáveis" },
            ...(definicoes.length ? [{ id: "campos" as Aba, label: categoria?.nome ?? "Campos" }] : []),
          ]}
          active={aba}
          onChange={setAba}
        />

        {aba === "geral" && (
          <FormGrid>
            <FormField label="Categoria" obrigatorio erro={erros.categoriaId} largura="total">
              <select
                className="input-o"
                value={form.categoriaId}
                onChange={e => set("categoriaId", e.target.value)}
              >
                <option value="">Escolha…</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FormField>

            <FormField label="Nome" obrigatorio erro={erros.nome} largura="total"
              dica="O que o documento é — 'Licença de Operação', 'Auto de Vistoria do Corpo de Bombeiros'.">
              <input className="input-o" value={form.nome} onChange={e => set("nome", e.target.value)} />
            </FormField>

            <FormField label="Sigla" dica="LO, ASV, AVCB, PGR…">
              <input className="input-o" value={form.sigla} onChange={e => set("sigla", e.target.value)} />
            </FormField>

            <FormField label="Número do documento / processo">
              <input className="input-o" value={form.numeroDocumento} onChange={e => set("numeroDocumento", e.target.value)} />
            </FormField>

            <FormField label="Órgão emissor">
              <select className="input-o" value={form.orgaoId} onChange={e => set("orgaoId", e.target.value)}>
                <option value="">Não informado</option>
                {orgaos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </FormField>

            <FormField label="Criticidade">
              <select className="input-o" value={form.criticidade} onChange={e => set("criticidade", e.target.value)}>
                {Object.entries(ROTULO_CRITICIDADE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </FormField>

            <FormField label="Tags" largura="total" dica="Separadas por vírgula. As que não existirem são criadas.">
              <input className="input-o" value={form.tags} onChange={e => set("tags", e.target.value)} />
            </FormField>

            <FormField label="Descrição" largura="total">
              <textarea className="input-o" rows={3} value={form.descricao} onChange={e => set("descricao", e.target.value)} />
            </FormField>
          </FormGrid>
        )}

        {aba === "prazos" && (
          <>
            <FormGrid>
              <FormField label="Data de emissão">
                <input type="date" className="input-o" value={form.dataEmissao} onChange={e => set("dataEmissao", e.target.value)} />
              </FormField>

              <FormField label="Data de validade" erro={erros.dataValidade}>
                <input type="date" className="input-o" value={form.dataValidade} onChange={e => set("dataValidade", e.target.value)} />
              </FormField>

              <FormField label="Periodicidade (meses)"
                dica="Usada para propor a próxima validade na renovação.">
                <input type="number" min={1} className="input-o" value={form.validadeMeses} onChange={e => set("validadeMeses", e.target.value)} />
              </FormField>

              <FormField
                label="Prazo mínimo do órgão (dias)"
                dica="Antecedência que o órgão exige para protocolar a renovação."
              >
                <input type="number" min={0} className="input-o" value={form.prazoMinimoDias} onChange={e => set("prazoMinimoDias", e.target.value)} />
              </FormField>

              <FormField
                label="Folga interna (dias)"
                dica={`Em branco, usa a da categoria${categoria ? ` (${categoria.folgaInternaDias})` : ""}.`}
              >
                <input type="number" min={0} className="input-o" value={form.folgaInternaDias} onChange={e => set("folgaInternaDias", e.target.value)} />
              </FormField>
            </FormGrid>

            {previa && (
              <div
                style={{
                  marginTop: 16, padding: "14px 16px", borderRadius: 12,
                  background: "color-mix(in srgb, var(--accent-violet) 7%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-violet) 22%, transparent)",
                }}
              >
                <div className="mono-cap" style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>
                  Prazos calculados
                </div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Iniciar a renovação em</div>
                    <div className="metric" style={{ fontSize: 17 }}>{previa.interno}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>Prazo fatal para protocolar</div>
                    <div className="metric" style={{ fontSize: 17 }}>{previa.fatal}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 9, lineHeight: 1.5 }}>
                  {previa.manual
                    ? "Você sobrepôs o cálculo abaixo. Limpe os campos de sobreposição para voltar à conta automática."
                    : <>validade − {previa.minimo} {previa.minimo === 1 ? "dia" : "dias"} do órgão = prazo fatal; − {previa.folga} de folga interna = prazo interno.</>}
                </div>
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.renovacaoAutomatica}
                  onChange={e => set("renovacaoAutomatica", e.target.checked)}
                />
                O protocolo tempestivo prorroga a validade (renovação automática)
              </label>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 5, lineHeight: 1.5, maxWidth: 620 }}>
                Marque quando a legislação prorrogar a validade até a decisão do órgão, desde que o pedido
                seja protocolado dentro do prazo. A prorrogação só passa a valer depois que o número e a
                data do protocolo forem registrados — a marcação sozinha não silencia o alerta.
              </div>
            </div>

            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 12.5, cursor: "pointer", color: "var(--text-secondary)" }}>
                Sobrepor os prazos calculados
              </summary>
              <div style={{ marginTop: 12 }}>
                <FormGrid>
                  <FormField label="Prazo fatal (sobreposto)">
                    <input type="date" className="input-o" value={form.prazoFatalManual} onChange={e => set("prazoFatalManual", e.target.value)} />
                  </FormField>
                  <FormField label="Prazo interno (sobreposto)">
                    <input type="date" className="input-o" value={form.prazoInternoManual} onChange={e => set("prazoInternoManual", e.target.value)} />
                  </FormField>
                </FormGrid>
              </div>
            </details>
          </>
        )}

        {aba === "escopo" && (
          <FormGrid>
            <FormField label="Empresa"><input className="input-o" value={form.empresa} onChange={e => set("empresa", e.target.value)} /></FormField>
            <FormField label="Filial"><input className="input-o" value={form.filial} onChange={e => set("filial", e.target.value)} /></FormField>
            <FormField label="Unidade / instalação"
              dica="Sede, praça de pedágio, base operacional, fábrica…">
              <input className="input-o" value={form.unidade} onChange={e => set("unidade", e.target.value)} />
            </FormField>
            <FormField label="Departamento"><input className="input-o" value={form.departamento} onChange={e => set("departamento", e.target.value)} /></FormField>
            <FormField label="Equipamento / nº de série"
              dica="Quando a licença é de um equipamento específico.">
              <input className="input-o" value={form.ativoIdentificador} onChange={e => set("ativoIdentificador", e.target.value)} />
            </FormField>
            <FormField label="Centro de custo"><input className="input-o" value={form.centroCusto} onChange={e => set("centroCusto", e.target.value)} /></FormField>
            <FormField label="Valor da licença (R$)">
              <input type="number" step="0.01" min={0} className="input-o" value={form.valorLicenca} onChange={e => set("valorLicenca", e.target.value)} />
            </FormField>
            <FormField label="Valor da renovação (R$)">
              <input type="number" step="0.01" min={0} className="input-o" value={form.valorRenovacao} onChange={e => set("valorRenovacao", e.target.value)} />
            </FormField>
            <FormField label="Nota fiscal"><input className="input-o" value={form.notaFiscal} onChange={e => set("notaFiscal", e.target.value)} /></FormField>
            <FormField label="Observações" largura="total">
              <textarea className="input-o" rows={3} value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
            </FormField>
          </FormGrid>
        )}

        {aba === "responsaveis" && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.55 }}>
              Quem recebe os avisos. O e-mail não precisa ser de um usuário do sistema — quem não tem
              login recebe por e-mail e WhatsApp mesmo assim.
            </div>

            {responsaveis.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 130px 70px 30px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select
                  className="input-o"
                  value={r.papel}
                  onChange={e => setResponsaveis(l => l.map((x, j) => (j === i ? { ...x, papel: e.target.value } : x)))}
                >
                  <option value="principal">Principal</option>
                  <option value="gestor">Gestor</option>
                  <option value="equipe">Equipe</option>
                  <option value="observador">Observador</option>
                </select>
                <input className="input-o" placeholder="Nome" value={r.nome}
                  onChange={e => setResponsaveis(l => l.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                <input className="input-o" placeholder="E-mail" value={r.email}
                  onChange={e => setResponsaveis(l => l.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                <input className="input-o" placeholder="WhatsApp" value={r.telefone}
                  onChange={e => setResponsaveis(l => l.map((x, j) => (j === i ? { ...x, telefone: e.target.value } : x)))} />
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }} title="Recebe os avisos de prazo">
                  <input type="checkbox" checked={r.notificar}
                    onChange={e => setResponsaveis(l => l.map((x, j) => (j === i ? { ...x, notificar: e.target.checked } : x)))} />
                  avisar
                </label>
                <button type="button" className="btn-icon" title="Remover" aria-label="Remover responsável"
                  onClick={() => setResponsaveis(l => l.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setResponsaveis(l => [...l, { papel: "equipe", nome: "", email: "", telefone: "", notificar: true }])}
            >
              + Adicionar responsável
            </button>
          </div>
        )}

        {aba === "campos" && (
          <FormGrid>
            {definicoes.map(def => (
              <FormField
                key={def.id}
                label={def.rotulo}
                obrigatorio={def.obrigatorio}
                dica={def.ajuda ?? undefined}
                erro={erros[`campo.${def.chave}`]}
                largura={def.tipo === "texto_longo" ? "total" : undefined}
              >
                {def.tipo === "texto_longo" ? (
                  <textarea className="input-o" rows={3} value={campos[def.chave] ?? ""}
                    onChange={e => setCampos(c => ({ ...c, [def.chave]: e.target.value }))} />
                ) : def.tipo === "selecao" ? (
                  <select className="input-o" value={campos[def.chave] ?? ""}
                    onChange={e => setCampos(c => ({ ...c, [def.chave]: e.target.value }))}>
                    <option value="">—</option>
                    {def.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : def.tipo === "booleano" ? (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                    <input type="checkbox" checked={campos[def.chave] === "true"}
                      onChange={e => setCampos(c => ({ ...c, [def.chave]: String(e.target.checked) }))} />
                    Sim
                  </label>
                ) : (
                  <input
                    type={def.tipo === "data" ? "date" : def.tipo === "numero" ? "number" : "text"}
                    className="input-o"
                    value={campos[def.chave] ?? ""}
                    onChange={e => setCampos(c => ({ ...c, [def.chave]: e.target.value }))}
                  />
                )}
              </FormField>
            ))}
          </FormGrid>
        )}
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : obrigacao ? "Salvar alterações" : "Cadastrar"}
        </button>
      </FormActions>
    </Modal>
  );
}
