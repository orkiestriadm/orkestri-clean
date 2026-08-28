"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/api";
import { RefreshCw, Gift, MessageCircle, Check, AlertTriangle, Users, Clock } from "lucide-react";

type Comissao = { valor: number | null; status: string | null };
type Linha = {
  id: string; nome: string; email: string; whatsapp: string | null;
  modulo: string | null; inicio: string; expira: string | null;
  diasRestantes: number | null; vencido: boolean;
  efetivado: boolean; assinaturaEm: string | null;
  indicadoPor: string | null; referralId: string | null; comissao: Comissao | null;
};
type Painel = {
  stats: {
    emTrial: number; vencidos: number; efetivados: number;
    comissaoPendente: { qtd: number; total: number };
    comissaoPaga: { qtd: number; total: number };
  };
  usuarios: Linha[];
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const waLink = (tel: string | null) => {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (!d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
};
const CARD: React.CSSProperties = { background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 16 };

type Filtro = "todos" | "trial" | "vencidos" | "efetivados";

export default function ReferralPanel() {
  const [data, setData] = useState<Painel | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busy, setBusy] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try { const r = await api.get<Painel>("/referral/admin/painel"); setData(r.data); }
    catch (e: any) { setErro(e?.response?.status === 403 ? "Acesso restrito a super-admins." : "Falha ao carregar."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (fn: () => Promise<any>, key: string) => {
    setBusy(key);
    try { await fn(); await carregar(); }
    catch (e: any) { alert(e?.response?.data?.message || "Erro na ação."); }
    finally { setBusy(null); }
  };

  const efetivar = (u: Linha) => {
    if (!confirm(`Marcar que ${u.nome} EFETIVOU a assinatura (R$ 27,00)?` + (u.indicadoPor ? `\n\nComo foi indicado por ${u.indicadoPor}, será criada a comissão de R$ 5,00.` : ""))) return;
    acao(() => api.post(`/referral/admin/${u.id}/efetivar`), u.id);
  };
  const desfazer = (u: Linha) => {
    if (!confirm(`Desfazer a efetivação de ${u.nome}?`)) return;
    acao(() => api.post(`/referral/admin/${u.id}/desfazer-efetivacao`), u.id);
  };
  const pagarComissao = (u: Linha) => {
    if (!u.referralId) return;
    if (!confirm(`Marcar a comissão de ${brl(u.comissao?.valor || 500)} para ${u.indicadoPor} como PAGA?`)) return;
    acao(() => api.post(`/referral/admin/comissao/${u.referralId}/paga`, {}), u.id);
  };
  const definirIndicador = (u: Linha) => {
    const codigo = prompt(`Código de indicação de quem indicou ${u.nome} (ex.: ORK-XXXXXX):`);
    if (!codigo) return;
    acao(() => api.post(`/referral/admin/${u.id}/indicador`, { codigo }), u.id);
  };

  const linhas = useMemo(() => {
    if (!data) return [];
    return data.usuarios.filter((u) => {
      if (filtro === "trial") return !u.vencido && !u.efetivado;
      if (filtro === "vencidos") return u.vencido && !u.efetivado;
      if (filtro === "efetivados") return u.efetivado;
      return true;
    });
  }, [data, filtro]);

  if (loading && !data) return <div style={{ color: "var(--text-muted)", fontSize: 14, padding: 40, textAlign: "center" }}>Carregando…</div>;
  if (erro) return <div style={{ ...CARD, borderColor: "var(--accent-red)", color: "var(--accent-red)" }}>{erro}</div>;
  if (!data) return null;
  const s = data.stats;

  const Stat = ({ label, valor, cor }: { label: string; valor: string; cor?: string }) => (
    <div style={CARD}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
      <div className="metric" style={{ fontSize: 22, fontWeight: 700, color: cor || "var(--text-primary)", marginTop: 6 }}>{valor}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Stat label="Em trial" valor={String(s.emTrial)} />
        <Stat label="Vencidos (a contatar)" valor={String(s.vencidos)} cor={s.vencidos ? "var(--accent-red)" : undefined} />
        <Stat label="Efetivados" valor={String(s.efetivados)} cor="var(--accent-green)" />
        <Stat label={`Comissões a pagar (${s.comissaoPendente.qtd})`} valor={brl(s.comissaoPendente.total)} cor="var(--accent-violet)" />
        <Stat label={`Comissões pagas (${s.comissaoPaga.qtd})`} valor={brl(s.comissaoPaga.total)} />
      </div>

      {/* Filtros + atualizar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-primary)", padding: 3, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          {([["todos", "Todos"], ["trial", "Em trial"], ["vencidos", "Vencidos"], ["efetivados", "Efetivados"]] as [Filtro, string][]).map(([k, lbl]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: filtro === k ? "var(--accent-violet)" : "transparent", color: filtro === k ? "#fff" : "var(--text-muted)",
            }}>{lbl}</button>
          ))}
        </div>
        <button onClick={carregar} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 10, border: "1px solid var(--border-medium)", background: "var(--bg-card)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> Atualizar
        </button>
      </div>

      {/* Lista */}
      {linhas.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 32 }}>Nenhum usuário neste filtro.</div>
      ) : linhas.map((u) => {
        const wa = waLink(u.whatsapp);
        return (
          <div key={u.id} style={CARD}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{u.nome}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}{u.modulo ? ` · ${u.modulo}` : ""}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Gift size={13} style={{ color: "var(--accent-violet)" }} />
                  Indicado por: <b style={{ color: u.indicadoPor ? "var(--text-primary)" : "var(--text-muted)" }}>{u.indicadoPor || "—"}</b>
                  {!u.indicadoPor && <button onClick={() => definirIndicador(u)} style={linkBtn}>definir</button>}
                </div>
              </div>
              {/* Status do trial / efetivação */}
              <div style={{ textAlign: "right" }}>
                {u.efetivado ? (
                  <span style={badge("var(--accent-green)")}><Check size={12} /> Efetivado</span>
                ) : u.vencido ? (
                  <span style={badge("var(--accent-red)")}><AlertTriangle size={12} /> Trial vencido</span>
                ) : (
                  <span style={badge("var(--accent-cyan)")}><Clock size={12} /> {u.diasRestantes} {u.diasRestantes === 1 ? "dia" : "dias"}</span>
                )}
                {u.comissao?.valor != null && (
                  <div style={{ fontSize: 11, marginTop: 6, color: u.comissao.status === "PAGA" ? "var(--accent-green)" : "var(--accent-violet)" }}>
                    Comissão {brl(u.comissao.valor)} · {u.comissao.status === "PAGA" ? "Paga" : "Pendente"}
                  </div>
                )}
              </div>
            </div>
            {/* Ações */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {wa && <a href={wa} target="_blank" rel="noreferrer" style={{ ...actBtn, color: "var(--accent-green)", borderColor: "color-mix(in srgb, var(--accent-green) 40%, transparent)" }}><MessageCircle size={13} /> Falar</a>}
              {!u.efetivado
                ? <button onClick={() => efetivar(u)} disabled={busy === u.id} style={{ ...actBtn, background: "var(--accent-violet)", color: "#fff", border: "none" }}>Marcar efetivado (R$ 27)</button>
                : <button onClick={() => desfazer(u)} disabled={busy === u.id} style={actBtn}>Desfazer efetivação</button>}
              {u.efetivado && u.referralId && u.comissao?.status === "PENDENTE" &&
                <button onClick={() => pagarComissao(u)} disabled={busy === u.id} style={{ ...actBtn, color: "var(--accent-violet)", borderColor: "color-mix(in srgb, var(--accent-violet) 40%, transparent)" }}>Marcar comissão paga</button>}
            </div>
          </div>
        );
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const badge = (cor: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: cor,
  background: `color-mix(in srgb, ${cor} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 30%, transparent)`,
  padding: "3px 10px", borderRadius: 20,
});
const actBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9,
  border: "1px solid var(--border-medium)", background: "var(--bg-card)", color: "var(--text-secondary)",
  fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none",
};
const linkBtn: React.CSSProperties = {
  background: "none", border: "none", color: "var(--accent-violet)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0,
};
