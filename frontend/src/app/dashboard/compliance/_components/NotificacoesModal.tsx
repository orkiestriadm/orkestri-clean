"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, FormField, FormActions, Tabs } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import {
  BellRing, CalendarClock, Users, MessageSquare, Send, Plus, X, Check,
} from "lucide-react";
import { complianceService } from "@/lib/compliance/compliance.service";
import type { Regra, Template, Categoria, PreviaMensagem } from "@/lib/compliance/types";
import { ROTULO_BASE, ROTULO_CANAL, ROTULO_DESTINATARIO } from "@/lib/compliance/types";
import { Aviso } from "./comuns";

/**
 * Configuração de notificações do módulo, numa modal só.
 *
 * A tela /alertas existe e continua sendo o lugar de auditar (prévia, enviados,
 * escalonamento). O que faltava era a pergunta prática, respondida sem sair de
 * onde a pessoa está: QUANDO avisar, QUEM recebe, O QUE chega.
 *
 * Três decisões que mudam o que dá errado:
 *
 *  1. OS DIAS NÃO SÃO UM CAMPO DE TEXTO. Eram "90, 60, 30, 15, 7, 3, 1, 0"
 *     digitados à mão, onde um ponto no lugar da vírgula apaga um marco em
 *     silêncio. Aqui são fichas: clica para ligar, clica para desligar, e uma
 *     linha do tempo mostra a sequência que vai disparar.
 *
 *  2. A MENSAGEM É VISTA ANTES DE SALVAR. A prévia renderiza contra uma
 *     obrigação REAL da carteira. Marcador escrito errado aparece literal na
 *     frase, e não três semanas depois no e-mail de alguém.
 *
 *  3. DÁ PARA PROVAR QUE O CANAL FUNCIONA. "Enviar teste" manda a mensagem
 *     agora, para o endereço que se escolher. Sem isso, a única forma de
 *     descobrir que o WhatsApp não estava configurado é o dia em que o aviso
 *     precisava ter chegado.
 */

type Aba = "quando" | "quem" | "mensagem";

/** Marcos oferecidos como ficha. Cobre da antecedência de contrato ao dia do vencimento. */
const ANTES_OFERECIDOS = [180, 120, 90, 60, 45, 30, 21, 15, 10, 7, 5, 3, 1, 0];
const DEPOIS_OFERECIDOS = [1, 3, 7, 15, 30, 60, 90];

const CORPO_INICIAL =
  "Olá {{Responsavel}},\n\n" +
  "A obrigação {{NomeObrigacao}} ({{Codigo}}) vence em {{Dias}} dias.\n" +
  "Validade: {{DataValidade}}\n" +
  "Prazo interno de renovação: {{PrazoInterno}}\n\n" +
  "Abrir no sistema: {{Link}}";

export function NotificacoesModal({
  aberto, onFechar, podeConfigurar, categoriaId,
}: {
  aberto: boolean;
  onFechar: () => void;
  podeConfigurar: boolean;
  /** Abre já mirando a régua de uma categoria específica. */
  categoriaId?: string;
}) {
  const [aba, setAba] = useState<Aba>("quando");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [regras, setRegras] = useState<Regra[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [alvo, setAlvo] = useState<string>(categoriaId ?? "");

  // Estado da régua em edição.
  const [baseData, setBaseData] = useState("prazo_interno");
  const [antes, setAntes] = useState<number[]>([90, 60, 30, 15, 7, 3, 1, 0]);
  const [depois, setDepois] = useState<number[]>([1, 3, 7, 15, 30]);
  const [canais, setCanais] = useState<string[]>(["interno", "email"]);
  const [destinatarios, setDestinatarios] = useState<string[]>(["responsavel", "gestor"]);
  const [emailsExtras, setEmailsExtras] = useState<string[]>([]);
  const [whatsappsExtras, setWhatsappsExtras] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);

  // Mensagem.
  const [templateId, setTemplateId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState(CORPO_INICIAL);
  const [previa, setPrevia] = useState<PreviaMensagem | null>(null);

  const regraAtual = useMemo(
    () => regras.find(r => (r.categoriaId ?? "") === alvo && !r.obrigacaoId) ?? null,
    [regras, alvo],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [rs, ts, cs] = await Promise.all([
      complianceService.regras().catch(() => [] as Regra[]),
      complianceService.templates().catch(() => [] as Template[]),
      complianceService.categorias(true).catch(() => [] as Categoria[]),
    ]);
    setRegras(rs);
    setTemplates(ts);
    setCategorias(cs);
    setCarregando(false);
  }, []);

  useEffect(() => { if (aberto) { setAba("quando"); setAlvo(categoriaId ?? ""); carregar(); } }, [aberto, categoriaId, carregar]);

  /* Ao trocar de alvo, o formulário passa a refletir a régua daquele alcance —
     ou os padrões, quando ela ainda não existe. */
  useEffect(() => {
    if (!aberto) return;
    const r = regraAtual;
    setBaseData(r?.baseData ?? "prazo_interno");
    setAntes(r?.diasAntes ?? [90, 60, 30, 15, 7, 3, 1, 0]);
    setDepois(r?.diasDepois ?? [1, 3, 7, 15, 30]);
    setCanais(r?.canais ?? ["interno", "email"]);
    setDestinatarios(r?.destinatarios ?? ["responsavel", "gestor"]);
    setEmailsExtras(r?.emailsExtras ?? []);
    setWhatsappsExtras(r?.whatsappsExtras ?? []);
    setAtivo(r?.ativo ?? true);
    setTemplateId(r?.templateId ?? "");

    const t = r?.templateId ? templates.find(x => x.id === r.templateId) : null;
    setAssunto(t?.assunto ?? "");
    setCorpo(t?.corpo ?? CORPO_INICIAL);
  }, [aberto, regraAtual, templates]);

  /* Prévia com atraso: renderiza contra dado real, mas não a cada tecla. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!aberto || aba !== "mensagem") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      complianceService
        .previaMensagem({ assunto: assunto || undefined, corpo: corpo || undefined })
        .then(setPrevia)
        .catch(() => setPrevia(null));
    }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [aberto, aba, assunto, corpo]);

  function alternar<T>(lista: T[], set: (v: T[]) => void, valor: T) {
    set(lista.includes(valor) ? lista.filter(v => v !== valor) : [...lista, valor].sort((a, b) =>
      typeof a === "number" && typeof b === "number" ? b - a : 0));
  }

  async function salvar() {
    if (antes.length === 0 && depois.length === 0) {
      useToastStore.getState().warning("Escolha pelo menos um marco", "Sem marco, a régua não dispara nada.");
      setAba("quando");
      return;
    }
    if (canais.length === 0) {
      useToastStore.getState().warning("Escolha ao menos um canal");
      setAba("quem");
      return;
    }
    const semDestino =
      destinatarios.length === 0 && emailsExtras.length === 0 && whatsappsExtras.length === 0;
    if (semDestino) {
      useToastStore.getState().warning("Ninguém receberia", "Escolha destinatários ou informe endereços avulsos.");
      setAba("quem");
      return;
    }

    setSalvando(true);
    try {
      // A mensagem vira template só quando foi de fato escrita. Guardar um
      // template idêntico ao padrão do sistema seria criar manutenção à toa.
      let idTemplate = templateId || undefined;
      const editouMensagem = corpo.trim() !== "" && corpo.trim() !== CORPO_INICIAL.trim();
      if (editouMensagem || assunto.trim()) {
        const salvo = await complianceService.salvarTemplate(templateId || null, {
          nome: alvo
            ? `Mensagem — ${categorias.find(c => c.id === alvo)?.nome ?? "categoria"}`
            : "Mensagem padrão da organização",
          canal: canais.includes("whatsapp") && !canais.includes("email") ? "whatsapp" : "email",
          assunto: assunto.trim() || undefined,
          corpo,
          ativo: true,
        });
        idTemplate = salvo.id;
      }

      await complianceService.salvarRegra(regraAtual?.id ?? null, {
        nome: alvo
          ? `Régua — ${categorias.find(c => c.id === alvo)?.nome ?? "categoria"}`
          : "Régua da organização",
        categoriaId: alvo || undefined,
        baseData,
        diasAntes: antes,
        diasDepois: depois.filter(n => n >= 1),
        canais,
        destinatarios,
        emailsExtras,
        whatsappsExtras,
        templateId: idTemplate,
        ativo,
      });

      useToastStore.getState().success(
        "Notificações configuradas",
        `${antes.length + depois.length} avisos por obrigação, para ${resumoDestino(destinatarios, emailsExtras, whatsappsExtras)}.`,
      );
      await carregar();
      onFechar();
    } catch { /* interceptor */ } finally { setSalvando(false); }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Notificações do Compliance"
      subtitulo="Quando avisar, quem recebe e o que chega"
      onFechar={onFechar}
      largura={860}
    >
      <div className="panel__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {carregando ? (
          <div className="skeleton" style={{ height: 260, borderRadius: 12 }} />
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <FormField
                  label="Esta configuração vale para"
                  dica="A régua de uma categoria vence a da organização — dá para ter uma exceção sem desligar o resto."
                >
                  <select className="input-o" value={alvo} onChange={e => setAlvo(e.target.value)}>
                    <option value="">Toda a organização</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>Categoria {c.nome}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, paddingBottom: 20, cursor: "pointer" }}
                title="Desligada, nenhum aviso deste alcance é enviado."
              >
                <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} disabled={!podeConfigurar} />
                Notificações ligadas
              </label>
            </div>

            {!regraAtual && (
              <Aviso tom="info">
                {alvo
                  ? "Esta categoria ainda não tem régua própria — hoje ela segue a da organização. Salvar aqui cria a exceção."
                  : "Nenhuma régua da organização configurada ainda. Sem ela, nenhuma obrigação gera aviso."}
              </Aviso>
            )}

            <Tabs<Aba>
              tabs={[
                { id: "quando", label: "Quando avisar" },
                { id: "quem", label: "Quem recebe" },
                { id: "mensagem", label: "O que é enviado" },
              ]}
              active={aba}
              onChange={setAba}
            />

            {aba === "quando" && (
              <AbaQuando
                baseData={baseData} setBaseData={setBaseData}
                antes={antes} depois={depois}
                alternarAntes={n => alternar(antes, setAntes, n)}
                alternarDepois={n => alternar(depois, setDepois, n)}
                travado={!podeConfigurar}
              />
            )}

            {aba === "quem" && (
              <AbaQuem
                canais={canais} destinatarios={destinatarios}
                emailsExtras={emailsExtras} whatsappsExtras={whatsappsExtras}
                alternarCanal={c => alternar(canais, setCanais, c)}
                alternarDestinatario={d => alternar(destinatarios, setDestinatarios, d)}
                setEmailsExtras={setEmailsExtras} setWhatsappsExtras={setWhatsappsExtras}
                travado={!podeConfigurar}
              />
            )}

            {aba === "mensagem" && (
              <AbaMensagem
                assunto={assunto} setAssunto={setAssunto}
                corpo={corpo} setCorpo={setCorpo}
                previa={previa}
                canais={canais}
                podeConfigurar={podeConfigurar}
              />
            )}
          </>
        )}
      </div>

      <FormActions>
        <span style={{ marginRight: "auto", fontSize: 11.5, color: "var(--text-secondary)" }}>
          {antes.length + depois.length} avisos por obrigação · {resumoDestino(destinatarios, emailsExtras, whatsappsExtras)}
        </span>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
          {podeConfigurar ? "Cancelar" : "Fechar"}
        </button>
        {podeConfigurar && (
          <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar configuração"}
          </button>
        )}
      </FormActions>
    </Modal>
  );
}

function resumoDestino(destinatarios: string[], emails: string[], whats: string[]): string {
  const partes = destinatarios.map(d => (ROTULO_DESTINATARIO[d] ?? d).toLowerCase());
  if (emails.length) partes.push(`${emails.length} e-mail${emails.length > 1 ? "s" : ""} avulso${emails.length > 1 ? "s" : ""}`);
  if (whats.length) partes.push(`${whats.length} WhatsApp avulso${whats.length > 1 ? "s" : ""}`);
  return partes.length ? partes.join(", ") : "ninguém";
}

/* ── Quando ───────────────────────────────────────────────────────────────── */

function AbaQuando({
  baseData, setBaseData, antes, depois, alternarAntes, alternarDepois, travado,
}: {
  baseData: string; setBaseData: (v: string) => void;
  antes: number[]; depois: number[];
  alternarAntes: (n: number) => void; alternarDepois: (n: number) => void;
  travado: boolean;
}) {
  return (
    <div style={{ paddingTop: 16 }}>
      <FormField
        label="Contar a partir de"
        dica="Prazo interno é o padrão: avisar na validade é avisar depois de já ter perdido a janela do órgão."
      >
        <select className="input-o" value={baseData} onChange={e => setBaseData(e.target.value)} disabled={travado} style={{ maxWidth: 360 }}>
          {Object.entries(ROTULO_BASE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </FormField>

      <ReguaVisual antes={antes} depois={depois} base={ROTULO_BASE[baseData] ?? baseData} />

      <GrupoFichas
        titulo="Avisar antes"
        legenda="Cada ficha ligada dispara um aviso ao ser cruzada — uma vez só, nunca repetido."
        icone={<CalendarClock size={14} />}
        oferecidos={ANTES_OFERECIDOS}
        selecionados={antes}
        onAlternar={alternarAntes}
        rotulo={n => (n === 0 ? "no dia" : `${n}d`)}
        travado={travado}
      />

      <GrupoFichas
        titulo="Cobrar depois"
        legenda="Parar no dia do vencimento é perder a cobrança de quem não renovou."
        icone={<BellRing size={14} />}
        oferecidos={DEPOIS_OFERECIDOS}
        selecionados={depois}
        onAlternar={alternarDepois}
        rotulo={n => `+${n}d`}
        tom="var(--accent-red)"
        travado={travado}
      />

      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55, marginTop: 4 }}>
        A varredura roda todo dia às <strong>07:00</strong>. Se ela ficar dias fora do ar, no retorno
        recupera o aviso da janela atual sem repetir os anteriores — nenhum marco é perdido, nenhum
        chega duas vezes.
      </p>
    </div>
  );
}

/**
 * A sequência de avisos desenhada.
 *
 * Uma lista de números não diz se há um buraco de 60 dias no meio da régua.
 * Desenhada, a lacuna salta aos olhos antes de custar um prazo.
 */
function ReguaVisual({ antes, depois, base }: { antes: number[]; depois: number[]; base: string }) {
  const a = [...antes].sort((x, y) => y - x);
  const d = [...depois].sort((x, y) => x - y);

  if (a.length === 0 && d.length === 0) {
    return (
      <div style={{ ...caixaRegua, color: "var(--accent-amber)", fontSize: 12.5 }}>
        Nenhum marco ligado — nesta configuração o sistema não avisa ninguém.
      </div>
    );
  }

  return (
    <div style={caixaRegua}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
        {a.map(n => <Ponto key={`a${n}`} rotulo={n === 0 ? "no dia" : `${n}d antes`} cor="var(--accent-violet)" />)}
        <span style={{
          flexShrink: 0, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: "var(--accent-amber)", color: "#1a1200", whiteSpace: "nowrap",
        }}>
          {base}
        </span>
        {d.map(n => <Ponto key={`d${n}`} rotulo={`${n}d depois`} cor="var(--accent-red)" />)}
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
        {a.length + d.length} avisos por obrigação, do primeiro ao último.
      </p>
    </div>
  );
}

const caixaRegua: React.CSSProperties = {
  padding: "12px 14px", borderRadius: 12, margin: "14px 0 18px",
  border: "1px solid var(--border)", background: "var(--bg-subtle, transparent)",
};

function Ponto({ rotulo, cor }: { rotulo: string; cor: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cor }} />
      <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{rotulo}</span>
      <span style={{ width: 14, height: 1, background: "var(--border)" }} />
    </span>
  );
}

function GrupoFichas({
  titulo, legenda, icone, oferecidos, selecionados, onAlternar, rotulo, tom, travado,
}: {
  titulo: string; legenda: string; icone: React.ReactNode;
  oferecidos: number[]; selecionados: number[];
  onAlternar: (n: number) => void; rotulo: (n: number) => string;
  tom?: string; travado: boolean;
}) {
  const cor = tom ?? "var(--accent-violet)";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <span style={{ color: cor, display: "flex" }}>{icone}</span>
        <span className="mono-cap" style={{ fontSize: 10.5 }}>{titulo}</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 9px" }}>{legenda}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {oferecidos.map(n => {
          const ligado = selecionados.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onAlternar(n)}
              disabled={travado}
              aria-pressed={ligado}
              title={ligado ? "Clique para desligar este aviso" : "Clique para ligar este aviso"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 11px", borderRadius: 999, fontSize: 12,
                cursor: travado ? "not-allowed" : "pointer",
                border: `1px solid ${ligado ? cor : "var(--border)"}`,
                background: ligado ? `color-mix(in srgb, ${cor} 16%, transparent)` : "transparent",
                color: ligado ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: ligado ? 600 : 400,
                transition: "background .15s, border-color .15s",
              }}
            >
              {/* A ficha ligada tem marca, não só cor: cor sozinha não é informação. */}
              {ligado && <Check size={11} strokeWidth={3} />}
              {rotulo(n)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Quem ─────────────────────────────────────────────────────────────────── */

function AbaQuem({
  canais, destinatarios, emailsExtras, whatsappsExtras,
  alternarCanal, alternarDestinatario, setEmailsExtras, setWhatsappsExtras, travado,
}: {
  canais: string[]; destinatarios: string[];
  emailsExtras: string[]; whatsappsExtras: string[];
  alternarCanal: (c: string) => void; alternarDestinatario: (d: string) => void;
  setEmailsExtras: (v: string[]) => void; setWhatsappsExtras: (v: string[]) => void;
  travado: boolean;
}) {
  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <Users size={14} color="var(--accent-violet)" />
        <span className="mono-cap" style={{ fontSize: 10.5 }}>Por papel na obrigação</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Resolvido por obrigação, no momento do envio: quem estiver nomeado ali recebe.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 20 }}>
        {Object.entries(ROTULO_DESTINATARIO).map(([v, l]) => (
          <Cartaozinho
            key={v}
            ligado={destinatarios.includes(v)}
            onClick={() => alternarDestinatario(v)}
            titulo={l}
            nota={NOTA_DESTINATARIO[v]}
            travado={travado}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <Send size={14} color="var(--accent-violet)" />
        <span className="mono-cap" style={{ fontSize: 10.5 }}>Por onde chega</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        O WhatsApp sai pela Evolution já configurada na organização. Quem desligou o aviso por
        WhatsApp no próprio perfil não recebe, mesmo estando aqui.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 20 }}>
        {["interno", "email", "whatsapp"].map(c => (
          <Cartaozinho
            key={c}
            ligado={canais.includes(c)}
            onClick={() => alternarCanal(c)}
            titulo={ROTULO_CANAL[c]}
            nota={NOTA_CANAL[c]}
            travado={travado}
          />
        ))}
      </div>

      <ListaEnderecos
        titulo="E-mails avulsos"
        legenda="Não precisam ter login no sistema. Só recebem se o canal E-mail estiver ligado."
        valores={emailsExtras}
        onMudar={setEmailsExtras}
        placeholder="fulano@empresa.com.br"
        desligado={!canais.includes("email")}
        travado={travado}
      />

      <ListaEnderecos
        titulo="WhatsApps avulsos"
        legenda="Com DDI e DDD, como 5511987654321. Só recebem se o canal WhatsApp estiver ligado."
        valores={whatsappsExtras}
        onMudar={setWhatsappsExtras}
        placeholder="5511987654321"
        desligado={!canais.includes("whatsapp")}
        travado={travado}
      />
    </div>
  );
}

const NOTA_DESTINATARIO: Record<string, string> = {
  responsavel: "Quem responde pela obrigação",
  gestor: "Quem cobra o responsável",
  equipe: "Todos os nomeados na obrigação",
  administrador: "Só por notificação interna",
};

const NOTA_CANAL: Record<string, string> = {
  interno: "Sino do sistema. Não depende de nada externo.",
  email: "Precisa do e-mail cadastrado na pessoa.",
  whatsapp: "Sai pela Evolution da organização.",
};

function Cartaozinho({
  ligado, onClick, titulo, nota, travado,
}: { ligado: boolean; onClick: () => void; titulo: string; nota?: string; travado: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={travado}
      aria-pressed={ligado}
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: 10,
        cursor: travado ? "not-allowed" : "pointer",
        border: `1px solid ${ligado ? "var(--accent-violet)" : "var(--border)"}`,
        background: ligado ? "color-mix(in srgb, var(--accent-violet) 10%, transparent)" : "transparent",
        transition: "background .15s, border-color .15s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: ligado ? 600 : 400 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 4, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${ligado ? "var(--accent-violet)" : "var(--border)"}`,
          background: ligado ? "var(--accent-violet)" : "transparent",
          color: "#fff",
        }}>
          {ligado && <Check size={10} strokeWidth={3} />}
        </span>
        {titulo}
      </span>
      {nota && (
        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginTop: 4, paddingLeft: 21 }}>
          {nota}
        </span>
      )}
    </button>
  );
}

/**
 * Endereços avulsos como lista de fichas, não como campo de texto separado por
 * vírgula: assim um endereço errado é removível sem reeditar a linha inteira.
 */
function ListaEnderecos({
  titulo, legenda, valores, onMudar, placeholder, desligado, travado,
}: {
  titulo: string; legenda: string; valores: string[];
  onMudar: (v: string[]) => void; placeholder: string;
  desligado: boolean; travado: boolean;
}) {
  const [rascunho, setRascunho] = useState("");

  function adicionar() {
    const v = rascunho.trim();
    if (!v || valores.includes(v)) { setRascunho(""); return; }
    onMudar([...valores, v]);
    setRascunho("");
  }

  return (
    <div style={{ marginBottom: 18, opacity: desligado ? 0.55 : 1 }}>
      <span className="mono-cap" style={{ fontSize: 10.5 }}>{titulo}</span>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "3px 0 8px" }}>{legenda}</p>

      {valores.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {valores.map(v => (
            <span key={v} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 11px",
              borderRadius: 999, fontSize: 12, border: "1px solid var(--border)",
            }}>
              <span className="num">{v}</span>
              {!travado && (
                <button
                  type="button"
                  onClick={() => onMudar(valores.filter(x => x !== v))}
                  aria-label={`Remover ${v}`}
                  style={{ display: "flex", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!travado && (
        <div style={{ display: "flex", gap: 7 }}>
          <input
            className="input-o"
            value={rascunho}
            placeholder={placeholder}
            onChange={e => setRascunho(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
            style={{ maxWidth: 320 }}
          />
          <button type="button" className="btn btn-ghost" onClick={adicionar} disabled={!rascunho.trim()}>
            <Plus size={13} /> Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Mensagem ─────────────────────────────────────────────────────────────── */

const MARCADORES: { chave: string; dica?: string }[] = [
  { chave: "{{Responsavel}}" },
  { chave: "{{NomeObrigacao}}" },
  { chave: "{{Codigo}}" },
  { chave: "{{Sigla}}" },
  { chave: "{{Numero}}" },
  // A distinção importa: numa cobrança pós-vencimento, {{Dias}} sai positivo e
  // a frase "vence em N dias" fica errada. {{DiasRestantes}} sai negativo.
  { chave: "{{Dias}}", dica: "Sempre positivo — use em 'vence em {{Dias}} dias'." },
  { chave: "{{DiasRestantes}}", dica: "Com sinal: negativo quando já venceu." },
  { chave: "{{DataValidade}}" },
  { chave: "{{PrazoInterno}}" },
  { chave: "{{PrazoFatal}}" },
  { chave: "{{Unidade}}" },
  { chave: "{{Orgao}}" },
  { chave: "{{Situacao}}", dica: "Vigente, Renovação devida, Vencida…" },
  { chave: "{{Link}}" },
];

function AbaMensagem({
  assunto, setAssunto, corpo, setCorpo, previa, canais, podeConfigurar,
}: {
  assunto: string; setAssunto: (v: string) => void;
  corpo: string; setCorpo: (v: string) => void;
  previa: PreviaMensagem | null;
  canais: string[];
  podeConfigurar: boolean;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [canalTeste, setCanalTeste] = useState(canais.includes("whatsapp") ? "whatsapp" : "email");
  const [paraTeste, setParaTeste] = useState("");
  const [enviando, setEnviando] = useState(false);

  /** Insere no cursor, não no fim: escrever a frase e depois caçar o marcador é o fluxo natural. */
  function inserir(marcador: string) {
    const el = areaRef.current;
    if (!el) { setCorpo(corpo + marcador); return; }
    const ini = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, ini) + marcador + corpo.slice(fim);
    setCorpo(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + marcador.length, ini + marcador.length);
    });
  }

  async function testar() {
    if (!paraTeste.trim()) {
      useToastStore.getState().warning("Informe o destino do teste");
      return;
    }
    setEnviando(true);
    try {
      const r = await complianceService.testarMensagem({
        canal: canalTeste,
        para: paraTeste.trim(),
        assunto: assunto || undefined,
        corpo: corpo || undefined,
      });
      if (r.enviado) {
        useToastStore.getState().success("Teste enviado", `Chegou pelo canal ${ROTULO_CANAL[canalTeste]} em ${paraTeste.trim()}.`);
      } else {
        useToastStore.getState().error("O teste não foi entregue", r.motivo ?? "Confira a configuração do canal.");
      }
    } catch { /* interceptor */ } finally { setEnviando(false); }
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <FormField label="Assunto" dica="Vale para e-mail e vira o título da notificação interna. Em branco, usa o assunto padrão.">
        <input className="input-o" value={assunto} onChange={e => setAssunto(e.target.value)} disabled={!podeConfigurar}
          placeholder="Obrigação a vencer: {{NomeObrigacao}}" />
      </FormField>

      <div style={{ marginTop: 14 }}>
        <span className="mono-cap" style={{ fontSize: 10.5 }}>Corpo da mensagem</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "7px 0 8px" }}>
          {MARCADORES.map(m => (
            <button
              key={m.chave}
              type="button"
              onClick={() => inserir(m.chave)}
              disabled={!podeConfigurar}
              title={m.dica ? `${m.dica} Clique para inserir no cursor.` : "Inserir no ponto do cursor"}
              style={{
                padding: "3px 8px", borderRadius: 6, fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                border: `1px solid ${m.dica ? "color-mix(in srgb, var(--accent-violet) 40%, var(--border))" : "var(--border)"}`,
                background: "transparent",
                color: "var(--text-secondary)", cursor: podeConfigurar ? "pointer" : "not-allowed",
              }}
            >
              {m.chave}
            </button>
          ))}
        </div>
        <textarea
          ref={areaRef}
          className="input-o"
          rows={8}
          value={corpo}
          onChange={e => setCorpo(e.target.value)}
          disabled={!podeConfigurar}
          style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.6 }}
        />
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
          Marcador escrito errado fica literal na mensagem, em vez de virar um buraco na frase —
          é por isso que a prévia abaixo importa.
        </p>
      </div>

      <div style={{
        marginTop: 16, padding: "13px 15px", borderRadius: 12,
        border: "1px solid color-mix(in srgb, var(--accent-violet) 22%, transparent)",
        background: "color-mix(in srgb, var(--accent-violet) 5%, transparent)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <MessageSquare size={14} color="var(--accent-violet)" />
          <span className="mono-cap" style={{ fontSize: 10.5 }}>Como vai chegar</span>
          {previa?.exemplo ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              montada com <span className="num">{previa.exemplo.codigo}</span> — {previa.exemplo.nome}
            </span>
          ) : previa ? (
            <span style={{ fontSize: 11, color: "var(--accent-amber)" }}>
              exemplo fictício — a carteira ainda não tem obrigação com validade
            </span>
          ) : null}
        </div>

        {!previa ? (
          <div className="skeleton" style={{ height: 70, borderRadius: 8 }} />
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5 }}>{previa.titulo}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {previa.corpo}
            </div>
          </>
        )}

        {podeConfigurar && (
          <div style={{ display: "flex", gap: 7, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input-o" value={canalTeste} onChange={e => setCanalTeste(e.target.value)} style={{ width: 170 }}>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <input
              className="input-o"
              value={paraTeste}
              onChange={e => setParaTeste(e.target.value)}
              placeholder={canalTeste === "email" ? "seu@email.com" : "5511987654321"}
              style={{ flex: 1, minWidth: 190 }}
            />
            <button type="button" className="btn btn-ghost" onClick={testar} disabled={enviando}>
              <Send size={13} /> {enviando ? "Enviando…" : "Enviar teste"}
            </button>
          </div>
        )}
        {podeConfigurar && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "7px 0 0" }}>
            O teste é enviado de verdade, agora, só para este endereço — e não entra na trilha de
            avisos enviados.
          </p>
        )}
      </div>
    </div>
  );
}
