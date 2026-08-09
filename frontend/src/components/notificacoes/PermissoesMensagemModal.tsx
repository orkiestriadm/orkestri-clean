"use client";

/**
 * Modal onde o MASTER define, por pessoa, de quais módulos ela recebe mensagem
 * e por quais canais.
 *
 * O problema que ele resolve: antes existia um único interruptor global por
 * usuário (`whatsappAlertas`) e cada disparador escolhia destinatário do seu
 * jeito — alerta de Frota ia para todos os masters, cuidassem de frota ou não.
 * Quem é de Frotas recebia mensagem de Projetos.
 *
 * Duas decisões visíveis na tela:
 *  · Módulo sem acesso aparece DESABILITADO, não escondido. Esconder faria o
 *    master procurar uma opção que existe mas não se aplica; desabilitado com
 *    o motivo ao lado explica por que não dá.
 *  · Sem nenhuma linha marcada, a pessoa não recebe nada — negação por padrão.
 *    O aviso no rodapé diz isso, porque "salvei e ficou vazio" precisa ter
 *    consequência óbvia.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { Modal, FormActions, Tabs } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { Search, ShieldCheck, AlertTriangle, Check, X, Clock, History } from "lucide-react";

type Aba = "permissoes" | "entrega" | "trilha";
type Modulo = { id: string; label: string };
type Pref = { modulo: string; sistema: boolean; whatsapp: boolean; email: boolean; severidadeMin: string };
type Usuario = {
  id: string; nome: string; email: string; avatar?: string | null;
  whatsapp: string | null; whatsappVerificado: boolean;
  modulosVisiveis: string[];
  preferencias: Pref[];
};

const SEV_LABEL: Record<string, string> = {
  info: "Tudo", aviso: "Avisos e críticos", critico: "Só críticos",
};

export default function PermissoesMensagemModal({
  aberto, onFechar, userIdInicial,
}: {
  aberto: boolean;
  onFechar: () => void;
  userIdInicial?: string;
}) {
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [aba, setAba] = useState<Aba>("permissoes");
  const [selecionado, setSelecionado] = useState<string | null>(userIdInicial || null);
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState<Record<string, Pref>>({});

  const toast = useToastStore.getState();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/notificacoes/preferencias");
      setModulos(data.modulos || []);
      setUsuarios(data.usuarios || []);
      if (!selecionado && data.usuarios?.length) setSelecionado(data.usuarios[0].id);
    } catch {
      toast.error("Erro", "Não foi possível carregar as permissões.");
    } finally {
      setCarregando(false);
    }
  }, [selecionado]);

  useEffect(() => { if (aberto) carregar(); }, [aberto]);

  const usuario = useMemo(
    () => usuarios.find(u => u.id === selecionado) || null,
    [usuarios, selecionado],
  );

  // Ao trocar de pessoa, o rascunho é remontado a partir do que está salvo.
  useEffect(() => {
    if (!usuario) { setRascunho({}); return; }
    const mapa: Record<string, Pref> = {};
    for (const p of usuario.preferencias) mapa[p.modulo] = { ...p };
    setRascunho(mapa);
  }, [usuario?.id, usuarios]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(u =>
      u.nome.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [usuarios, busca]);

  const temAcesso = (m: string) => !!usuario?.modulosVisiveis.includes(m);

  const alternarCanal = (modulo: string, canal: "sistema" | "whatsapp" | "email") => {
    if (!temAcesso(modulo)) return;
    setRascunho(prev => {
      const atual = prev[modulo] || { modulo, sistema: false, whatsapp: false, email: false, severidadeMin: "info" };
      const novo = { ...atual, [canal]: !atual[canal] };
      const copia = { ...prev };
      // Sem canal nenhum, a linha some — é o mesmo que não ter preferência, e
      // guardar uma linha "muda" só confundiria quem lesse depois.
      if (!novo.sistema && !novo.whatsapp && !novo.email) delete copia[modulo];
      else copia[modulo] = novo;
      return copia;
    });
  };

  const mudarSeveridade = (modulo: string, sev: string) => {
    setRascunho(prev => (prev[modulo] ? { ...prev, [modulo]: { ...prev[modulo], severidadeMin: sev } } : prev));
  };

  const marcarTodos = (ligar: boolean) => {
    if (!usuario) return;
    if (!ligar) { setRascunho({}); return; }
    const mapa: Record<string, Pref> = {};
    for (const m of modulos) {
      if (!temAcesso(m.id)) continue;
      mapa[m.id] = { modulo: m.id, sistema: true, whatsapp: false, email: false, severidadeMin: "info" };
    }
    setRascunho(mapa);
  };

  const salvar = async () => {
    if (!usuario) return;
    setSalvando(true);
    try {
      const preferencias = Object.values(rascunho);
      await api.put(`/notificacoes/preferencias/${usuario.id}`, { preferencias });
      toast.success(
        "Permissões salvas",
        preferencias.length
          ? `${usuario.nome} passa a receber de ${preferencias.length} módulo(s).`
          : `${usuario.nome} não receberá nenhuma mensagem.`,
      );
      await carregar();
    } catch (e: any) {
      toast.error("Erro ao salvar", e?.response?.data?.message || "Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const totalMarcado = Object.keys(rascunho).length;
  const whatsSemVerificar = usuario && !usuario.whatsappVerificado
    && Object.values(rascunho).some(p => p.whatsapp);

  return (
    <Modal
      aberto={aberto}
      titulo="Permissões de mensagem"
      subtitulo="Defina de quais módulos cada pessoa recebe notificação, e por qual canal"
      onFechar={onFechar}
      largura={880}
    >
      <div style={{ marginBottom: 12 }}>
        <Tabs<Aba>
          tabs={[
            { id: "permissoes", label: "Permissões" },
            { id: "entrega", label: "Silêncio e vazão" },
            { id: "trilha", label: "Trilha de envios" },
          ]}
          active={aba}
          onChange={setAba}
        />
      </div>

      {aba === "entrega" && <AbaEntrega />}
      {aba === "trilha" && <AbaTrilha modulos={modulos} />}

      {aba === "permissoes" && (carregando ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 16, minHeight: 380 }}>

          {/* ── Pessoas ── */}
          <div style={{ borderRight: "1px solid var(--border-subtle)", paddingRight: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 8, top: 9, color: "var(--text-muted)" }} />
              <input
                className="input-o" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar pessoa" style={{ paddingLeft: 26, fontSize: 12 }}
              />
            </div>
            <div style={{ overflowY: "auto", maxHeight: 340, display: "flex", flexDirection: "column", gap: 2 }}>
              {filtrados.map(u => {
                const ativo = u.id === selecionado;
                const qtd = u.preferencias.length;
                return (
                  <button
                    key={u.id} type="button" onClick={() => setSelecionado(u.id)}
                    style={{
                      textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none",
                      cursor: "pointer", fontSize: 12,
                      background: ativo ? "var(--bg-hover)" : "transparent",
                      color: ativo ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: ativo ? 600 : 400,
                    }}
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nome}</div>
                    <div style={{ fontSize: 10, color: qtd ? "var(--accent-green)" : "var(--text-faint)" }}>
                      {qtd ? `${qtd} módulo(s)` : "não recebe nada"}
                    </div>
                  </button>
                );
              })}
              {!filtrados.length && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 10 }}>Ninguém encontrado.</div>
              )}
            </div>
          </div>

          {/* ── Módulos da pessoa ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            {!usuario ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Selecione uma pessoa.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{usuario.nome}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {usuario.whatsapp
                        ? <>WhatsApp {usuario.whatsapp} {usuario.whatsappVerificado
                            ? <span style={{ color: "var(--accent-green)" }}>· verificado</span>
                            : <span style={{ color: "var(--accent-amber)" }}>· não verificado</span>}</>
                        : <span style={{ color: "var(--text-faint)" }}>sem WhatsApp cadastrado</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => marcarTodos(true)}>
                      <Check size={12} /> Todos que acessa
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => marcarTodos(false)}>
                      <X size={12} /> Limpar
                    </button>
                  </div>
                </div>

                <div style={{ overflowY: "auto", maxHeight: 320, border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", padding: "8px 10px" }}>Módulo</th>
                        <th style={{ padding: "8px 4px", width: 58 }}>Sistema</th>
                        <th style={{ padding: "8px 4px", width: 66 }}>WhatsApp</th>
                        <th style={{ padding: "8px 4px", width: 54 }}>E-mail</th>
                        <th style={{ padding: "8px 10px", width: 140 }}>Recebe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modulos.map(m => {
                        const acesso = temAcesso(m.id);
                        const p = rascunho[m.id];
                        return (
                          <tr
                            key={m.id}
                            style={{ borderTop: "1px solid var(--border-subtle)", opacity: acesso ? 1 : 0.45 }}
                            title={acesso ? undefined : "A pessoa não tem acesso a este módulo"}
                          >
                            <td style={{ padding: "7px 10px" }}>
                              {m.label}
                              {!acesso && (
                                <div style={{ fontSize: 10, color: "var(--text-faint)" }}>sem acesso ao módulo</div>
                              )}
                            </td>
                            {(["sistema", "whatsapp", "email"] as const).map(canal => (
                              <td key={canal} style={{ textAlign: "center", padding: "7px 4px" }}>
                                <input
                                  type="checkbox"
                                  disabled={!acesso}
                                  checked={!!p?.[canal]}
                                  onChange={() => alternarCanal(m.id, canal)}
                                  style={{ width: 15, height: 15, cursor: acesso ? "pointer" : "not-allowed" }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: "7px 10px" }}>
                              <select
                                className="select-field"
                                style={{ fontSize: 11, padding: "3px 6px" }}
                                disabled={!p}
                                value={p?.severidadeMin || "info"}
                                onChange={e => mudarSeveridade(m.id, e.target.value)}
                              >
                                {Object.entries(SEV_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {whatsSemVerificar && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "var(--accent-amber)" }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      O WhatsApp desta pessoa ainda não foi verificado. As mensagens ficam retidas
                      até ela confirmar o número pelo próprio perfil — é o que impede um dígito
                      errado mandar alerta interno para um desconhecido.
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, color: "var(--text-muted)" }}>
                  <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {totalMarcado === 0
                      ? <>Nada marcado: <strong>esta pessoa não receberá nenhuma mensagem</strong>.</>
                      : <>Marcado em {totalMarcado} módulo(s). Fora daqui, nada é enviado.</>}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      <FormActions>
        <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>Fechar</button>
        {aba === "permissoes" && (
          <button type="button" className="btn btn-violet" onClick={salvar} disabled={salvando || !usuario}>
            {salvando ? "Salvando…" : "Salvar permissões"}
          </button>
        )}
      </FormActions>
    </Modal>
  );
}

/**
 * Silêncio noturno e vazão.
 *
 * A vazão não é conforto: o WhatsApp bane conta que dispara em rajada, e o
 * sistema mandaria dezenas de mensagens seguidas se muitos documentos vencessem
 * no mesmo dia. Ficava configurável só por API — sem tela, ninguém ajustava.
 */
function AbaEntrega() {
  const [cfg, setCfg] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const toast = useToastStore.getState();

  useEffect(() => {
    api.get("/notificacoes/preferencias/config/org")
      .then(r => setCfg(r.data))
      .catch(() => toast.error("Erro", "Não foi possível carregar a configuração."));
  }, []);

  const set = (k: string, v: any) => setCfg((p: any) => ({ ...p, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put("/notificacoes/preferencias/config/org", cfg);
      toast.success("Salvo", "Configuração de entrega atualizada.");
    } catch (e: any) {
      toast.error("Erro", e?.response?.data?.message || "Tente novamente.");
    } finally { setSalvando(false); }
  };

  if (!cfg) return <div style={{ padding: 30, color: "var(--text-muted)" }}>Carregando…</div>;

  const horas = Array.from({ length: 24 }, (_, i) => i);
  const semSilencio = Number(cfg.silencioInicio) === Number(cfg.silencioFim);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 340 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Clock size={15} /> Horário de silêncio
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          Mensagens geradas nesta janela ficam na fila e saem no horário de término.
          Alertas críticos podem furar o silêncio.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Das</span>
          <select className="select-field" value={cfg.silencioInicio} onChange={e => set("silencioInicio", Number(e.target.value))}>
            {horas.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
          </select>
          <span style={{ fontSize: 12 }}>às</span>
          <select className="select-field" value={cfg.silencioFim} onChange={e => set("silencioFim", Number(e.target.value))}>
            {horas.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
          </select>
          {semSilencio && <span style={{ fontSize: 11, color: "var(--accent-amber)" }}>horas iguais = silêncio desligado</span>}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={cfg.silencioIgnoraCritico !== false}
                 onChange={e => set("silencioIgnoraCritico", e.target.checked)} style={{ width: 15, height: 15 }} />
          Alertas críticos furam o silêncio
        </label>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Vazão e agrupamento</div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
          O WhatsApp bane número que dispara em rajada. O limite protege a conta;
          o agrupamento junta vários avisos do mesmo módulo numa mensagem só.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12 }}>Máximo de</span>
          <input type="number" className="input-o" min={1} max={60} style={{ width: 80 }}
                 value={cfg.maxPorMinuto} onChange={e => set("maxPorMinuto", Number(e.target.value))} />
          <span style={{ fontSize: 12 }}>mensagens por minuto</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={cfg.agruparPorModulo !== false}
                 onChange={e => set("agruparPorModulo", e.target.checked)} style={{ width: 15, height: 15 }} />
          Agrupar avisos do mesmo módulo
        </label>
      </div>

      <div>
        <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar configuração de entrega"}
        </button>
      </div>
    </div>
  );
}

/**
 * Trilha de envios.
 *
 * Existe para responder "essa mensagem foi enviada?" — pergunta que antes não
 * tinha resposta possível, porque nada era registrado e todo envio era chamado
 * com `.catch(() => {})`.
 */
function AbaTrilha({ modulos }: { modulos: Modulo[] }) {
  const [itens, setItens] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [fStatus, setFStatus] = useState("");
  const [fModulo, setFModulo] = useState("");

  useEffect(() => {
    setCarregando(true);
    const params: any = { limit: 200 };
    if (fStatus) params.status = fStatus;
    if (fModulo) params.modulo = fModulo;
    api.get("/notificacoes/preferencias/envios", { params })
      .then(r => { setItens(r.data.itens || []); setTotal(r.data.total || 0); })
      .catch(() => setItens([]))
      .finally(() => setCarregando(false));
  }, [fStatus, fModulo]);

  const COR: Record<string, string> = {
    enviada: "var(--accent-green)", pendente: "var(--accent-amber)",
    falhou: "var(--accent-red)", descartada: "var(--text-muted)", agrupada: "var(--accent-cyan)",
  };
  const dt = (v: any) => (v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 340 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <History size={14} style={{ color: "var(--text-muted)" }} />
        <select className="select-field" style={{ fontSize: 12 }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {["enviada", "pendente", "falhou", "descartada", "agrupada"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select-field" style={{ fontSize: 12 }} value={fModulo} onChange={e => setFModulo(e.target.value)}>
          <option value="">Todos os módulos</option>
          {modulos.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
          {itens.length} de {total}
        </span>
      </div>

      <div style={{ overflowY: "auto", maxHeight: 360, border: "1px solid var(--border-subtle)", borderRadius: 10 }}>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Quando</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Canal</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Destino</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Módulo</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Título</th>
              <th style={{ textAlign: "left", padding: "8px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Carregando…</td></tr>}
            {!carregando && !itens.length && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Nenhum envio registrado ainda.
              </td></tr>
            )}
            {!carregando && itens.map(e => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{dt(e.criadoEm)}</td>
                <td style={{ padding: "6px 6px" }}>{e.canal}</td>
                <td style={{ padding: "6px 6px", fontFamily: "var(--font-mono)" }}>{e.destino}</td>
                <td style={{ padding: "6px 6px" }}>{e.modulo}</td>
                <td style={{ padding: "6px 6px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.mensagem}>
                  {e.titulo}
                </td>
                <td style={{ padding: "6px 10px", color: COR[e.status] || "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}
                    title={e.ultimoErro || undefined}>
                  {e.status}
                  {e.tentativas > 1 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> ({e.tentativas}x)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Registros concluídos são removidos após 90 dias.
      </p>
    </div>
  );
}
