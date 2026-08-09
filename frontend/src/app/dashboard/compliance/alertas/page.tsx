"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { useToastStore } from "@/lib/toast";
import {
  PageBody, BackLink, PageHeader, Tabs, Panel, TableCard, EmptyState,
  ErrorState, PermissionDenied, StatusBadge, RowActions, RowAction,
  Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Bell, Plus, Pencil, Trash2, Eye, Send, Sliders } from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Regra, Template, Escalonamento, Envio, Previa, Categoria } from "@/lib/compliance/types";
import { ROTULO_BASE, ROTULO_CANAL, ROTULO_DESTINATARIO } from "@/lib/compliance/types";
import { pode, data, Aviso } from "../_components/comuns";
import { NotificacoesModal } from "../_components/NotificacoesModal";

type Aba = "regras" | "previa" | "templates" | "escalonamento" | "envios";

/**
 * Configuração dos alertas.
 *
 * A aba "Prévia" é a peça central. Configurar régua às cegas é o defeito que a
 * planilha tinha: só se descobre que está errada quando o aviso não chega. Aqui
 * a prévia mostra o que a régua dispararia HOJE, sem enviar nada — inclusive as
 * obrigações que não têm destinatário e por isso avisariam ninguém.
 */
export default function AlertasPage() {
  const user = useAuthStore(s => s.user);
  const [aba, setAba] = useState<Aba>("regras");
  const [configurando, setConfigurando] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const podeConfigurar = pode(user, "compliance.notificacao:configurar");

  useEffect(() => {
    if (!pode(user, "compliance.notificacao:ver")) setSemPermissao(true);
  }, [user]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/compliance" label="Compliance" />

          <PageHeader
            icon={<Bell size={19} />}
            title="Alertas"
            subtitle="Quem é avisado, por qual canal e com quanta antecedência"
            actions={
              // Esta tela é a de auditoria: prévia, trilha de enviados, degraus.
              // Quem só quer ajustar a régua não precisa passar por ela.
              <button type="button" className="btn btn-primary" onClick={() => setConfigurando(true)}>
                <Sliders size={14} /> Configuração guiada
              </button>
            }
          />

          <NotificacoesModal
            aberto={configurando}
            onFechar={() => setConfigurando(false)}
            podeConfigurar={podeConfigurar}
          />

          {semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver a configuração de alertas." />
          ) : (
            <>
              <Tabs<Aba>
                tabs={[
                  { id: "regras", label: "Réguas" },
                  { id: "previa", label: "Prévia" },
                  { id: "templates", label: "Mensagens" },
                  { id: "escalonamento", label: "Escalonamento" },
                  { id: "envios", label: "Enviados" },
                ]}
                active={aba}
                onChange={setAba}
              />

              {aba === "regras" && <AbaRegras podeConfigurar={podeConfigurar} />}
              {aba === "previa" && <AbaPrevia podeConfigurar={podeConfigurar} />}
              {aba === "templates" && <AbaTemplates podeConfigurar={podeConfigurar} />}
              {aba === "escalonamento" && <AbaEscalonamento podeConfigurar={podeConfigurar} />}
              {aba === "envios" && <AbaEnvios />}
            </>
          )}
        </PageBody>
      </div>
    </div>
  );
}

/* ── Réguas ───────────────────────────────────────────────────────────────── */

function AbaRegras({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [itens, setItens] = useState<Regra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Regra | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setItens(await complianceService.regras()); }
    catch (e: any) { setErro(e?.response?.data?.message ?? "Falha ao carregar as réguas."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir(r: Regra) {
    if (!confirm(`Excluir a régua "${r.nome}"?`)) return;
    try {
      await complianceService.excluirRegra(r.id);
      useToastStore.getState().success("Régua excluída");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Régua", "Alcance", "Base", "Antes (dias)", "Depois (dias)", "Canais", "Destinatários", "Situação", ""];

  return (
    <>
      <Aviso tom="info">
        A régua mais específica ganha: uma régua da <strong>obrigação</strong> vence a da{" "}
        <strong>categoria</strong>, que vence a da <strong>organização</strong>. Assim, configurar uma
        exceção para uma licença não exige desligar a régua de toda a categoria.
      </Aviso>

      <Panel
        title="Réguas de aviso"
        actions={
          podeConfigurar && (
            <button type="button" className="btn btn-ghost" onClick={() => setCriando(true)}>
              <Plus size={13} /> Nova régua
            </button>
          )
        }
      >
        <TableCard>
          <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={COLUNAS.length}><span className="skeleton" style={{ display: "block", height: 14 }} /></td></tr>
            ) : erro ? (
              <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
            ) : itens.length === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<Bell size={20} />}
                title="Nenhuma régua configurada"
                hint="Sem régua, nenhuma obrigação gera aviso — o módulo vira um cadastro passivo."
              />
            ) : (
              itens.map(r => (
                <tr key={r.id} style={{ opacity: r.ativo ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>{r.nome}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.obrigacao ? `Obrigação ${r.obrigacao.codigo}`
                      : r.categoria ? `Categoria ${r.categoria.nome}`
                      : "Organização inteira"}
                  </td>
                  <td style={{ fontSize: 12 }}>{ROTULO_BASE[r.baseData]}</td>
                  <td className="num" style={{ fontSize: 11.5 }}>{r.diasAntes.join(", ") || "—"}</td>
                  <td className="num" style={{ fontSize: 11.5 }}>{r.diasDepois.join(", ") || "—"}</td>
                  <td style={{ fontSize: 12 }}>{r.canais.map(c => ROTULO_CANAL[c] ?? c).join(", ")}</td>
                  <td style={{ fontSize: 12 }}>{r.destinatarios.map(d => ROTULO_DESTINATARIO[d] ?? d).join(", ")}</td>
                  <td><StatusBadge label={r.ativo ? "Ativa" : "Desligada"} tone={r.ativo ? "ok" : "neutro"} /></td>
                  <td>
                    {podeConfigurar && (
                      <RowActions>
                        <RowAction tone="edit" title="Editar" onClick={() => setEditando(r)}><Pencil size={13} /></RowAction>
                        <RowAction tone="danger" title="Excluir" onClick={() => excluir(r)}><Trash2 size={13} /></RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>

      <RegraForm
        aberto={criando || !!editando}
        regra={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={carregar}
      />
    </>
  );
}

function RegraForm({
  aberto, regra, onFechar, onSalvo,
}: { aberto: boolean; regra: Regra | null; onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [baseData, setBaseData] = useState("prazo_interno");
  const [antes, setAntes] = useState("90, 60, 30, 15, 7, 3, 1, 0");
  const [depois, setDepois] = useState("1, 3, 7, 15, 30");
  const [canais, setCanais] = useState<string[]>(["interno", "email"]);
  const [destinatarios, setDestinatarios] = useState<string[]>(["responsavel", "gestor"]);
  const [emailsExtras, setEmailsExtras] = useState("");
  const [whatsappsExtras, setWhatsappsExtras] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    complianceService.categorias(true).then(setCategorias).catch(() => setCategorias([]));
    complianceService.templates().then(setTemplates).catch(() => setTemplates([]));

    setNome(regra?.nome ?? "Régua");
    setCategoriaId(regra?.categoriaId ?? "");
    setBaseData(regra?.baseData ?? "prazo_interno");
    setAntes((regra?.diasAntes ?? [90, 60, 30, 15, 7, 3, 1, 0]).join(", "));
    setDepois((regra?.diasDepois ?? [1, 3, 7, 15, 30]).join(", "));
    setCanais(regra?.canais ?? ["interno", "email"]);
    setDestinatarios(regra?.destinatarios ?? ["responsavel", "gestor"]);
    setEmailsExtras((regra?.emailsExtras ?? []).join(", "));
    setWhatsappsExtras((regra?.whatsappsExtras ?? []).join(", "));
    setTemplateId(regra?.templateId ?? "");
    setAtivo(regra?.ativo ?? true);
  }, [aberto, regra]);

  const numeros = (v: string) =>
    v.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0);

  function alternar(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor]);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await complianceService.salvarRegra(regra?.id ?? null, {
        nome: nome.trim() || "Régua",
        categoriaId: categoriaId || undefined,
        baseData,
        diasAntes: numeros(antes),
        diasDepois: numeros(depois).filter(n => n >= 1),
        canais,
        destinatarios,
        emailsExtras: emailsExtras.split(",").map(s => s.trim()).filter(Boolean),
        whatsappsExtras: whatsappsExtras.split(",").map(s => s.trim()).filter(Boolean),
        templateId: templateId || undefined,
        ativo,
      });
      useToastStore.getState().success(regra ? "Régua atualizada" : "Régua criada");
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo={regra ? "Editar régua" : "Nova régua"} onFechar={onFechar} largura={680}>
      <div className="panel__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <FormGrid>
          <FormField label="Nome" largura="total">
            <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} />
          </FormField>

          <FormField label="Alcance" dica="Em branco, vale para a organização inteira.">
            <select className="input-o" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
              <option value="">Organização inteira</option>
              {categorias.map(c => <option key={c.id} value={c.id}>Categoria {c.nome}</option>)}
            </select>
          </FormField>

          <FormField
            label="Contar a partir de"
            dica="Prazo interno é o padrão: avisar na validade é avisar depois de já ter perdido a janela do órgão."
          >
            <select className="input-o" value={baseData} onChange={e => setBaseData(e.target.value)}>
              {Object.entries(ROTULO_BASE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>

          <FormField label="Avisar antes (dias)" largura="total"
            dica="Separados por vírgula. Cada número dispara um aviso ao ser cruzado — uma vez só.">
            <input className="input-o" value={antes} onChange={e => setAntes(e.target.value)} />
          </FormField>

          <FormField label="Cobrar depois (dias)" largura="total"
            dica="Parar no dia do vencimento é perder a cobrança de quem não renovou.">
            <input className="input-o" value={depois} onChange={e => setDepois(e.target.value)} />
          </FormField>

          <FormField label="Canais" largura="total">
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 4 }}>
              {["interno", "email", "whatsapp"].map(c => (
                <label key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={canais.includes(c)} onChange={() => alternar(canais, setCanais, c)} />
                  {ROTULO_CANAL[c]}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Destinatários" largura="total">
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 4 }}>
              {Object.entries(ROTULO_DESTINATARIO).map(([v, l]) => (
                <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={destinatarios.includes(v)} onChange={() => alternar(destinatarios, setDestinatarios, v)} />
                  {l}
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="E-mails adicionais" largura="total" dica="Separados por vírgula. Não precisam ter login.">
            <input className="input-o" value={emailsExtras} onChange={e => setEmailsExtras(e.target.value)} />
          </FormField>

          {/* O motor já lia `whatsappsExtras`; só a tela não deixava preencher,
              então o campo existia e era impossível de usar. */}
          <FormField label="WhatsApps adicionais" largura="total"
            dica="Com DDI e DDD, separados por vírgula: 5511987654321. Só valem com o canal WhatsApp ligado.">
            <input className="input-o" value={whatsappsExtras} onChange={e => setWhatsappsExtras(e.target.value)} />
          </FormField>

          <FormField label="Mensagem" dica="Em branco, usa a mensagem padrão do sistema.">
            <select className="input-o" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              <option value="">Mensagem padrão</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.nome} ({t.canal})</option>)}
            </select>
          </FormField>

          <FormField label="Situação">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, paddingTop: 8 }}>
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              Régua ativa
            </label>
          </FormField>
        </FormGrid>
      </div>

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </FormActions>
    </Modal>
  );
}

/* ── Prévia ───────────────────────────────────────────────────────────────── */

function AbaPrevia({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [varrendo, setVarrendo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setPrevia(await complianceService.previa()); }
    catch { /* interceptor */ }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function varrer() {
    if (!confirm("Disparar a varredura agora?\n\nIsto ENVIA os avisos de verdade — e-mail e WhatsApp inclusive.")) return;
    setVarrendo(true);
    try {
      const r = await complianceService.varrer();
      useToastStore.getState().success(
        "Varredura concluída",
        `${r.examinadas} obrigações examinadas, ${r.enviados} avisos enviados, ${r.escalonamentos} escalonamentos.`,
      );
      carregar();
    } catch { /* interceptor */ } finally { setVarrendo(false); }
  }

  const semDestino = previa?.previstos.filter(p => p.semDestinatario) ?? [];
  const COLUNAS = ["Obrigação", "Marco", "Dias para a base", "Régua", "Destinatários"];

  return (
    <>
      <Aviso tom="info">
        Isto é o que a varredura de <strong>hoje às 07:00</strong> dispararia. Nada é enviado ao abrir
        esta tela. Um marco só dispara uma vez — se a varredura ficar dias fora do ar, no retorno ela
        recupera o aviso da janela atual, sem repetir os anteriores.
      </Aviso>

      {semDestino.length > 0 && (
        <Aviso tom="atencao">
          <strong>{semDestino.length}</strong>{" "}
          {semDestino.length === 1 ? "obrigação atingiu um marco e não tem destinatário" : "obrigações atingiram um marco e não têm destinatário"} —
          o aviso não vai para ninguém. Cadastre responsáveis com e-mail ou adicione e-mails extras na régua.
        </Aviso>
      )}

      <Panel
        title={carregando ? "Calculando…" : `${previa?.previstos.length ?? 0} avisos previstos para hoje`}
        actions={
          podeConfigurar && (
            <button type="button" className="btn btn-ghost" onClick={varrer} disabled={varrendo}>
              <Send size={13} /> {varrendo ? "Enviando…" : "Disparar agora"}
            </button>
          )
        }
      >
        <TableCard>
          <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={COLUNAS.length}><span className="skeleton" style={{ display: "block", height: 14 }} /></td></tr>
            ) : (previa?.previstos.length ?? 0) === 0 ? (
              <EmptyState
                colSpan={COLUNAS.length}
                icon={<Eye size={20} />}
                title="Nenhum aviso previsto para hoje"
                hint="Nenhuma obrigação cruzou um marco da régua hoje."
              />
            ) : (
              previa!.previstos.map(p => (
                <tr key={`${p.obrigacaoId}-${p.marco}`} style={p.semDestinatario ? { background: "color-mix(in srgb, var(--accent-amber) 6%, transparent)" } : undefined}>
                  <td>
                    <Link href={`/dashboard/compliance/obrigacoes/${p.obrigacaoId}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                      {p.nome}
                    </Link>
                    <div className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.codigo}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {p.marco.startsWith("antes")
                      ? `${p.marco.split(":")[1]} dias antes`
                      : `${p.marco.split(":")[1]} dias depois`}
                  </td>
                  <td className="num">{p.diasParaBase}</td>
                  <td style={{ fontSize: 12 }}>{p.regra}</td>
                  <td style={{ fontSize: 12 }}>
                    {p.semDestinatario
                      ? <span style={{ color: "var(--accent-amber)" }}>ninguém</span>
                      : p.destinatarios.map(d => `${d.nome} (${ROTULO_CANAL[d.canal] ?? d.canal})`).join(", ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>
    </>
  );
}

/* ── Templates ────────────────────────────────────────────────────────────── */

function AbaTemplates({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [itens, setItens] = useState<Template[]>([]);
  const [editando, setEditando] = useState<Template | null>(null);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(() => {
    complianceService.templates().then(setItens).catch(() => setItens([]));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const COLUNAS = ["Nome", "Canal", "Assunto", "Situação", ""];

  return (
    <>
      <Aviso tom="info">
        Marcadores disponíveis: <code>{"{{Responsavel}}"}</code>, <code>{"{{NomeObrigacao}}"}</code>,{" "}
        <code>{"{{Codigo}}"}</code>, <code>{"{{Sigla}}"}</code>, <code>{"{{Numero}}"}</code>,{" "}
        <code>{"{{Dias}}"}</code>, <code>{"{{DataValidade}}"}</code>, <code>{"{{PrazoInterno}}"}</code>,{" "}
        <code>{"{{PrazoFatal}}"}</code>, <code>{"{{Unidade}}"}</code>, <code>{"{{Orgao}}"}</code>,{" "}
        <code>{"{{Situacao}}"}</code>, <code>{"{{Link}}"}</code> e{" "}
        <code>{"{{campo.chave}}"}</code> para campos personalizados. Acento e caixa não importam.
      </Aviso>

      <Panel
        title="Mensagens"
        actions={
          podeConfigurar && (
            <button type="button" className="btn btn-ghost" onClick={() => setCriando(true)}>
              <Plus size={13} /> Nova mensagem
            </button>
          )
        }
      >
        <TableCard>
          <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {itens.length === 0 ? (
              <EmptyState colSpan={COLUNAS.length} title="Nenhuma mensagem personalizada"
                hint="Sem template, o sistema usa a mensagem padrão." />
            ) : (
              itens.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nome}</td>
                  <td style={{ fontSize: 12 }}>{ROTULO_CANAL[t.canal] ?? t.canal}</td>
                  <td style={{ fontSize: 12 }}>{t.assunto ?? "—"}</td>
                  <td><StatusBadge label={t.ativo ? "Ativa" : "Desligada"} tone={t.ativo ? "ok" : "neutro"} /></td>
                  <td>
                    {podeConfigurar && (
                      <RowActions>
                        <RowAction tone="edit" title="Editar" onClick={() => setEditando(t)}><Pencil size={13} /></RowAction>
                        <RowAction tone="danger" title="Excluir" onClick={async () => {
                          if (!confirm(`Excluir a mensagem "${t.nome}"?`)) return;
                          await complianceService.excluirTemplate(t.id);
                          carregar();
                        }}><Trash2 size={13} /></RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </Panel>

      <TemplateForm
        aberto={criando || !!editando}
        template={editando}
        onFechar={() => { setCriando(false); setEditando(null); }}
        onSalvo={carregar}
      />
    </>
  );
}

function TemplateForm({
  aberto, template, onFechar, onSalvo,
}: { aberto: boolean; template: Template | null; onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState("email");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(template?.nome ?? "");
    setCanal(template?.canal ?? "email");
    setAssunto(template?.assunto ?? "");
    setCorpo(template?.corpo ?? "Olá {{Responsavel}},\n\nA obrigação {{NomeObrigacao}} vence em {{Dias}} dias.\nValidade: {{DataValidade}}\n\n{{Link}}");
    setAtivo(template?.ativo ?? true);
  }, [aberto, template]);

  async function salvar() {
    if (!nome.trim() || !corpo.trim()) {
      useToastStore.getState().warning("Informe o nome e o corpo da mensagem");
      return;
    }
    setSalvando(true);
    try {
      await complianceService.salvarTemplate(template?.id ?? null, {
        nome: nome.trim(), canal, assunto: assunto.trim() || undefined, corpo, ativo,
      });
      useToastStore.getState().success("Mensagem salva");
      onSalvo();
      onFechar();
    } catch { /* interceptor */ } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo={template ? "Editar mensagem" : "Nova mensagem"} onFechar={onFechar} largura={680}>
      <div className="panel__body">
        <FormGrid>
          <FormField label="Nome" obrigatorio><input className="input-o" value={nome} onChange={e => setNome(e.target.value)} /></FormField>
          <FormField label="Canal">
            <select className="input-o" value={canal} onChange={e => setCanal(e.target.value)}>
              <option value="email">E-mail</option>
              <option value="interno">Notificação interna</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </FormField>
          <FormField label="Assunto" largura="total"><input className="input-o" value={assunto} onChange={e => setAssunto(e.target.value)} /></FormField>
          <FormField label="Corpo" obrigatorio largura="total">
            <textarea className="input-o" rows={9} value={corpo} onChange={e => setCorpo(e.target.value)} style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} />
          </FormField>
          <FormField label="Situação">
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, paddingTop: 8 }}>
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Ativa
            </label>
          </FormField>
        </FormGrid>
      </div>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </FormActions>
    </Modal>
  );
}

/* ── Escalonamento ────────────────────────────────────────────────────────── */

function AbaEscalonamento({ podeConfigurar }: { podeConfigurar: boolean }) {
  const [itens, setItens] = useState<Escalonamento[]>([]);
  const [aposDias, setAposDias] = useState("3");
  const [alvo, setAlvo] = useState("gestor");
  const [emails, setEmails] = useState("");

  const carregar = useCallback(() => {
    complianceService.escalonamentos().then(setItens).catch(() => setItens([]));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    try {
      await complianceService.salvarEscalonamento(null, {
        aposDias: Number(aposDias),
        alvo,
        emails: emails.split(",").map(s => s.trim()).filter(Boolean),
        ordem: itens.length,
      });
      useToastStore.getState().success("Degrau adicionado");
      setEmails("");
      carregar();
    } catch { /* interceptor */ }
  }

  const COLUNAS = ["Após (dias de atraso)", "Sobe para", "Alcance", ""];

  return (
    <>
      <Aviso tom="info">
        Quando o <strong>prazo interno</strong> passa e a obrigação continua parada, o aviso sobe de
        degrau. Um degrau só dispara por vez — o mais alto já cruzado. Quem chegou ao diretor não
        recebe mais o aviso do gestor.
      </Aviso>

      <Panel title="Degraus de escalonamento">
        <TableCard>
          <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {itens.length === 0 ? (
              <EmptyState colSpan={COLUNAS.length} title="Nenhum degrau configurado"
                hint="Sem escalonamento, uma obrigação parada continua cobrando só o responsável." />
            ) : (
              itens.map(e => (
                <tr key={e.id}>
                  <td className="num">{e.aposDias}</td>
                  <td style={{ fontSize: 12 }}>
                    {e.alvo === "gestor" ? "Gestor da obrigação"
                      : e.alvo === "administrador" ? "Administradores da organização"
                      : e.alvo === "usuario" ? (e.user?.nome ?? "Usuário")
                      : e.emails.join(", ")}
                  </td>
                  <td style={{ fontSize: 12 }}>{e.categoria?.nome ?? "Todas as categorias"}</td>
                  <td>
                    {podeConfigurar && (
                      <RowActions>
                        <RowAction tone="danger" title="Remover" onClick={async () => {
                          await complianceService.excluirEscalonamento(e.id);
                          carregar();
                        }}><Trash2 size={13} /></RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>

        {podeConfigurar && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ width: 120 }}>
              <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Após (dias)</div>
              <input type="number" min={1} className="input-o" value={aposDias} onChange={e => setAposDias(e.target.value)} />
            </div>
            <div style={{ width: 220 }}>
              <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Sobe para</div>
              <select className="input-o" value={alvo} onChange={e => setAlvo(e.target.value)}>
                <option value="gestor">Gestor da obrigação</option>
                <option value="administrador">Administradores</option>
                <option value="email">E-mails específicos</option>
              </select>
            </div>
            {alvo === "email" && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="mono-cap" style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>E-mails</div>
                <input className="input-o" value={emails} onChange={e => setEmails(e.target.value)} placeholder="separados por vírgula" />
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={adicionar}>
              <Plus size={13} /> Adicionar degrau
            </button>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ── Enviados ─────────────────────────────────────────────────────────────── */

function AbaEnvios() {
  const [itens, setItens] = useState<Envio[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    complianceService.envios()
      .then(setItens)
      .catch(() => setItens([]))
      .finally(() => setCarregando(false));
  }, []);

  const COLUNAS = ["Quando", "Obrigação", "Marco", "Canal", "Destino", "Situação"];

  return (
    <Panel title="Avisos enviados">
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.55 }}>
        A trilha do que foi enviado, para quem e por qual canal. É o que responde "eu fui avisado?"
        sem depender da memória de ninguém.
      </div>
      <TableCard>
        <thead><tr>{COLUNAS.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {carregando ? (
            <tr><td colSpan={COLUNAS.length}><span className="skeleton" style={{ display: "block", height: 14 }} /></td></tr>
          ) : itens.length === 0 ? (
            <EmptyState colSpan={COLUNAS.length} icon={<Send size={20} />} title="Nenhum aviso enviado ainda" />
          ) : (
            itens.map(e => (
              <tr key={e.id}>
                <td className="num">{data(e.enviadoEm)}</td>
                <td>
                  {e.obrigacao ? (
                    <Link href={`/dashboard/compliance/obrigacoes/${e.obrigacaoId}`} style={{ color: "inherit", textDecoration: "none" }}>
                      <span style={{ fontWeight: 600 }}>{e.obrigacao.nome}</span>
                      <div className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.obrigacao.codigo}</div>
                    </Link>
                  ) : "—"}
                </td>
                <td style={{ fontSize: 12 }}>{e.marco}</td>
                <td style={{ fontSize: 12 }}>{ROTULO_CANAL[e.canal] ?? e.canal}</td>
                <td style={{ fontSize: 12 }}>{e.destino}</td>
                <td>
                  <StatusBadge
                    label={e.status}
                    tone={e.status === "enviado" ? "ok" : e.status === "falhou" ? "critico" : "neutro"}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </Panel>
  );
}
