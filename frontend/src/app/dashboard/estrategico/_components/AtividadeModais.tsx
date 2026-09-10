"use client";

import { useEffect, useState } from "react";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { estrategicoService } from "@/lib/estrategico/estrategico.service";
import type { Filtros, Farol, CasoDetalhe, Evento, Tarefa, Dependencia } from "@/lib/estrategico/types";
import { ROTULO_FAROL, SIGNIFICADO_FAROL, ORDEM_FAROL } from "@/lib/estrategico/types";
import { mensagemErro, FarolPonto, Nota } from "./comuns";

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ── Andamento (timeline) ───────────────────────────────────────────────── */

export function EventoModal({
  aberto, casoId, evento, filtros, onFechar, onSalvo,
}: {
  aberto: boolean; casoId: string; evento?: Evento | null; filtros: Filtros | null;
  onFechar: () => void; onSalvo: () => void;
}) {
  const toast = useToastStore();
  const [f, setF] = useState({ tipo: "andamento", dataEvento: hojeISO(), titulo: "", descricao: "", decisao: "", proximoPasso: "" });
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setF(evento
      ? { tipo: evento.tipo, dataEvento: evento.dataEvento.slice(0, 10), titulo: evento.titulo, descricao: evento.descricao ?? "", decisao: evento.decisao ?? "", proximoPasso: evento.proximoPasso ?? "" }
      : { tipo: "andamento", dataEvento: hojeISO(), titulo: "", descricao: "", decisao: "", proximoPasso: "" });
  }, [aberto, evento]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function salvar() {
    if (!f.titulo.trim()) { toast.error("Informe o título do andamento"); return; }
    setSalvando(true);
    try {
      const dados = { ...f, titulo: f.titulo.trim(), descricao: f.descricao || undefined, decisao: f.decisao || undefined, proximoPasso: f.proximoPasso || undefined };
      if (evento) await estrategicoService.atualizarEvento(evento.id, { ...dados, revisar: false });
      else await estrategicoService.criarEvento(casoId, dados);
      toast.success(evento ? "Andamento atualizado" : "Andamento registrado");
      onSalvo();
    } catch (e) {
      toast.error("Não foi possível salvar", mensagemErro(e, "Erro ao registrar o andamento."));
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo={evento ? "Editar andamento" : "Registrar andamento"} subtitulo="O que aconteceu — protocolo, reunião, ofício, decisão…" onFechar={onFechar} largura={640}>
      <FormGrid min={200}>
        <FormField label="Tipo">
          <select className="input-o" value={f.tipo} onChange={e => set("tipo", e.target.value)}>
            {(filtros?.tiposEvento ?? []).filter(t => !["alteracao_status", "mudanca_responsavel"].includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </FormField>
        <FormField label="Data" obrigatorio>
          <input type="date" className="input-o" value={f.dataEvento} max={hojeISO()} onChange={e => set("dataEvento", e.target.value)} />
        </FormField>
        <FormField label="Título" obrigatorio largura="total">
          <input className="input-o" value={f.titulo} onChange={e => set("titulo", e.target.value)} maxLength={300} autoFocus />
        </FormField>
        <FormField label="Descrição" largura="total">
          <textarea className="input-o" rows={3} value={f.descricao} onChange={e => set("descricao", e.target.value)} maxLength={8000} />
        </FormField>
        {f.tipo === "decisao" && (
          <FormField label="Decisão" largura="total" dica="Fica também no registro de decisões do assunto.">
            <textarea className="input-o" rows={2} value={f.decisao} onChange={e => set("decisao", e.target.value)} maxLength={4000} />
          </FormField>
        )}
        <FormField label="Próximo passo" largura="total" dica="Se muda o que tem de ser feito, atualize também a próxima ação do assunto.">
          <input className="input-o" value={f.proximoPasso} onChange={e => set("proximoPasso", e.target.value)} maxLength={2000} />
        </FormField>
      </FormGrid>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </FormActions>
    </Modal>
  );
}

/* ── Tarefa ─────────────────────────────────────────────────────────────── */

export function TarefaModal({
  aberto, casoId, tarefa, filtros, casos, onFechar, onSalvo, salvarNova,
}: {
  aberto: boolean; casoId?: string; tarefa?: Tarefa | null; filtros: Filtros | null;
  /** Na reunião, a tarefa pode ser de qualquer assunto da pauta. */
  casos?: { id: string; codigo: string; titulo: string }[];
  onFechar: () => void; onSalvo: () => void;
  salvarNova?: (dados: Record<string, any>) => Promise<unknown>;
}) {
  const toast = useToastStore();
  const vazio = { casoId: casoId ?? "", titulo: "", descricao: "", responsavelId: "", prazo: "", prioridade: "media", status: "pendente", conclusao: "" };
  const [f, setF] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setF(tarefa
      ? { casoId: tarefa.casoId, titulo: tarefa.titulo, descricao: tarefa.descricao ?? "", responsavelId: tarefa.responsavelId ?? "", prazo: tarefa.prazo?.slice(0, 10) ?? "", prioridade: tarefa.prioridade, status: tarefa.status, conclusao: tarefa.conclusao ?? "" }
      : { ...vazio, casoId: casoId ?? casos?.[0]?.id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tarefa, casoId]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function salvar() {
    if (!f.titulo.trim()) { toast.error("Informe o título da tarefa"); return; }
    if (!f.casoId) { toast.error("Escolha o assunto"); return; }
    setSalvando(true);
    try {
      const base = { titulo: f.titulo.trim(), descricao: f.descricao || undefined, responsavelId: f.responsavelId || null, prazo: f.prazo || null, prioridade: f.prioridade };
      if (tarefa) {
        await estrategicoService.atualizarTarefa(tarefa.id, { ...base, status: f.status, conclusao: f.conclusao || null });
      } else if (salvarNova) {
        await salvarNova({ ...base, casoId: f.casoId });
      } else {
        await estrategicoService.criarTarefa(f.casoId, base);
      }
      toast.success(tarefa ? "Tarefa atualizada" : "Tarefa criada");
      onSalvo();
    } catch (e) {
      toast.error("Não foi possível salvar", mensagemErro(e, "Erro ao salvar a tarefa."));
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo={tarefa ? "Editar tarefa" : "Nova tarefa"} onFechar={onFechar} largura={620}>
      <FormGrid min={200}>
        {casos && !tarefa && (
          <FormField label="Assunto" obrigatorio largura="total">
            <select className="input-o" value={f.casoId} onChange={e => set("casoId", e.target.value)}>
              {casos.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.titulo}</option>)}
            </select>
          </FormField>
        )}
        <FormField label="Título" obrigatorio largura="total">
          <input className="input-o" value={f.titulo} onChange={e => set("titulo", e.target.value)} maxLength={300} autoFocus />
        </FormField>
        <FormField label="Responsável">
          <select className="input-o" value={f.responsavelId} onChange={e => set("responsavelId", e.target.value)}>
            <option value="">—</option>
            {(filtros?.usuarios ?? []).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </FormField>
        <FormField label="Prazo">
          <input type="date" className="input-o" value={f.prazo} onChange={e => set("prazo", e.target.value)} />
        </FormField>
        <FormField label="Prioridade">
          <select className="input-o" value={f.prioridade} onChange={e => set("prioridade", e.target.value)}>
            {(filtros?.prioridades ?? []).map(p => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
          </select>
        </FormField>
        {tarefa && (
          <FormField label="Status">
            <select className="input-o" value={f.status} onChange={e => set("status", e.target.value)}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="bloqueada">Bloqueada</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </FormField>
        )}
        <FormField label="Descrição" largura="total">
          <textarea className="input-o" rows={3} value={f.descricao} onChange={e => set("descricao", e.target.value)} maxLength={8000} />
        </FormField>
        {tarefa && (
          <FormField label="Conclusão" largura="total" dica="O que foi feito — vai para a timeline ao concluir.">
            <textarea className="input-o" rows={2} value={f.conclusao} onChange={e => set("conclusao", e.target.value)} maxLength={4000} />
          </FormField>
        )}
      </FormGrid>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </FormActions>
    </Modal>
  );
}

/* ── Farol manual ───────────────────────────────────────────────────────── */

export function FarolModal({
  aberto, caso, onFechar, onSalvo,
}: { aberto: boolean; caso: CasoDetalhe; onFechar: () => void; onSalvo: (c: CasoDetalhe) => void }) {
  const toast = useToastStore();
  const [escolha, setEscolha] = useState<Farol | "auto">("auto");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setEscolha(caso.farolManual ?? "auto");
    setJustificativa(caso.farolJustificativa ?? "");
  }, [aberto, caso]);

  async function salvar() {
    if (escolha !== "auto" && justificativa.trim().length < 10) {
      toast.error("Justifique a alteração", "Mínimo de 10 caracteres — fica registrado no histórico.");
      return;
    }
    setSalvando(true);
    try {
      const r = await estrategicoService.farol(caso.id, escolha === "auto" ? null : escolha, justificativa.trim() || undefined);
      toast.success("Farol atualizado");
      onSalvo(r);
    } catch (e) {
      toast.error("Não foi possível alterar o farol", mensagemErro(e, "Erro."));
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo="Farol estratégico" subtitulo={`${caso.codigo} — ${caso.titulo}`} onFechar={onFechar} largura={600}>
      <div style={{ marginBottom: 14, fontSize: 12.5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <FarolPonto farol={caso.farolCalculado} /> <strong>Cálculo automático: {ROTULO_FAROL[caso.farolCalculado]}</strong>
        </div>
        {caso.farolMotivos.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {caso.farolMotivos.map(m => <li key={m.codigo + m.texto}>{m.texto}</li>)}
          </ul>
        ) : <Nota>Nenhuma pendência identificada pelo cálculo.</Nota>}
      </div>
      <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="radio" checked={escolha === "auto"} onChange={() => setEscolha("auto")} />
          Usar o cálculo automático
        </label>
        {ORDEM_FAROL.map(f => (
          <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="radio" checked={escolha === f} onChange={() => setEscolha(f)} />
            <FarolPonto farol={f} /> {ROTULO_FAROL[f]} <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>— {SIGNIFICADO_FAROL[f]}</span>
          </label>
        ))}
      </div>
      {escolha !== "auto" && (
        <div style={{ marginTop: 12 }}>
          <FormField label="Justificativa" obrigatorio dica="Obrigatória. O cálculo continua visível ao lado do farol manual.">
            <textarea className="input-o" rows={3} value={justificativa} onChange={e => setJustificativa(e.target.value)} maxLength={2000} />
          </FormField>
        </div>
      )}
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </FormActions>
    </Modal>
  );
}

/* ── Dependência ────────────────────────────────────────────────────────── */

export function DependenciaModal({
  aberto, casoId, dependencia, filtros, onFechar, onSalvo,
}: {
  aberto: boolean; casoId: string; dependencia?: Dependencia | null; filtros: Filtros | null;
  onFechar: () => void; onSalvo: () => void;
}) {
  const toast = useToastStore();
  const vazio = { catalogoId: "", organizacao: "", contato: "", descricao: "", desde: hojeISO(), respostaEsperadaEm: "", ultimoFollowUpEm: "" };
  const [f, setF] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    setF(dependencia ? {
      catalogoId: dependencia.catalogoId ?? "", organizacao: dependencia.organizacao ?? "", contato: dependencia.contato ?? "",
      descricao: dependencia.descricao ?? "", desde: dependencia.desde?.slice(0, 10) ?? "",
      respostaEsperadaEm: dependencia.respostaEsperadaEm?.slice(0, 10) ?? "", ultimoFollowUpEm: dependencia.ultimoFollowUpEm?.slice(0, 10) ?? "",
    } : vazio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, dependencia]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function salvar() {
    if (!f.catalogoId && !f.organizacao.trim()) { toast.error("Informe de quem o assunto depende"); return; }
    setSalvando(true);
    const nul = (v: string) => (v ? v : null);
    const dados = {
      catalogoId: nul(f.catalogoId), organizacao: nul(f.organizacao.trim()), contato: nul(f.contato.trim()),
      descricao: nul(f.descricao.trim()), desde: nul(f.desde), respostaEsperadaEm: nul(f.respostaEsperadaEm),
      ultimoFollowUpEm: nul(f.ultimoFollowUpEm),
    };
    try {
      if (dependencia) await estrategicoService.atualizarDependencia(dependencia.id, dados);
      else await estrategicoService.criarDependencia(casoId, dados);
      toast.success("Dependência salva");
      onSalvo();
    } catch (e) {
      toast.error("Não foi possível salvar", mensagemErro(e, "Erro ao salvar a dependência."));
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo={dependencia ? "Editar dependência" : "Nova dependência"} subtitulo="De quem o assunto está aguardando, e desde quando" onFechar={onFechar} largura={620}>
      <FormGrid min={200}>
        <FormField label="Depende de">
          <select className="input-o" value={f.catalogoId} onChange={e => set("catalogoId", e.target.value)}>
            <option value="">— outro (informar ao lado) —</option>
            {(filtros?.dependencias ?? []).map(d => <option key={d.id} value={d.id}>{d.nome}{d.natureza === "externa" ? " · externa" : ""}</option>)}
          </select>
        </FormField>
        <FormField label="Organização / pessoa" dica="Específico: escritório, gerência, empresa">
          <input className="input-o" value={f.organizacao} onChange={e => set("organizacao", e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Aguardando desde" dica="É o que mede o tempo de espera e dispara a cobrança">
          <input type="date" className="input-o" value={f.desde} max={hojeISO()} onChange={e => set("desde", e.target.value)} />
        </FormField>
        <FormField label="Resposta esperada até">
          <input type="date" className="input-o" value={f.respostaEsperadaEm} onChange={e => set("respostaEsperadaEm", e.target.value)} />
        </FormField>
        <FormField label="Último follow-up">
          <input type="date" className="input-o" value={f.ultimoFollowUpEm} max={hojeISO()} onChange={e => set("ultimoFollowUpEm", e.target.value)} />
        </FormField>
        <FormField label="Contato">
          <input className="input-o" value={f.contato} onChange={e => set("contato", e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Observação" largura="total">
          <textarea className="input-o" rows={2} value={f.descricao} onChange={e => set("descricao", e.target.value)} maxLength={4000} />
        </FormField>
      </FormGrid>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </FormActions>
    </Modal>
  );
}

/* ── Decisão (reunião) ──────────────────────────────────────────────────── */

export function DecisaoModal({
  aberto, casos, casoIdInicial, onFechar, onSalvar,
}: {
  aberto: boolean; casos: { id: string; codigo: string; titulo: string }[]; casoIdInicial?: string;
  onFechar: () => void; onSalvar: (dados: { casoId?: string; descricao: string }) => Promise<void>;
}) {
  const toast = useToastStore();
  const [casoId, setCasoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setCasoId(casoIdInicial ?? ""); setDescricao(""); } }, [aberto, casoIdInicial]);

  async function salvar() {
    if (!descricao.trim()) { toast.error("Descreva a decisão"); return; }
    setSalvando(true);
    try {
      await onSalvar({ casoId: casoId || undefined, descricao: descricao.trim() });
      toast.success("Decisão registrada");
      onFechar();
    } catch (e) {
      toast.error("Não foi possível registrar", mensagemErro(e, "Erro."));
    } finally { setSalvando(false); }
  }

  return (
    <Modal aberto={aberto} titulo="Registrar decisão" onFechar={onFechar} largura={600}>
      <FormGrid min={240}>
        <FormField label="Assunto" largura="total" dica="Com assunto, a decisão entra também na timeline dele.">
          <select className="input-o" value={casoId} onChange={e => setCasoId(e.target.value)}>
            <option value="">Decisão geral da reunião</option>
            {casos.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.titulo}</option>)}
          </select>
        </FormField>
        <FormField label="Decisão" obrigatorio largura="total">
          <textarea className="input-o" rows={4} value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={4000} autoFocus />
        </FormField>
      </FormGrid>
      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Registrar"}</button>
      </FormActions>
    </Modal>
  );
}
