"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type Payment = {
  id: string; valor: number; status: string; metodo: string | null;
  dataPagamento: string | null; dataVencimento: string | null; referencia: string | null; criadoEm: string;
};

type BillingMe = {
  id: string; plano: string; status: string;
  trialEndsAt: string | null; currentPeriodEnd: string | null; nextBillingDate: string | null;
  valorMensal: number | null; mpCheckoutUrl: string | null;
  overrideNota: string | null;
  payments: Payment[];
  planInfo: {
    nome: string; valor: number | null; maxAdmins: number | null; maxUsers: number | null; features: string[];
  };
};

const STATUS_COLOR: Record<string, string> = {
  trial: "#f59e0b", active: "#22c55e", overdue: "#eab308",
  suspended: "#ef4444", cancelled: "#6b7280", enterprise_manual: "#7c3aed",
};
const STATUS_LABEL: Record<string, string> = {
  trial: "Trial", active: "Ativo", overdue: "Inadimplente",
  suspended: "Suspenso", cancelled: "Cancelado", enterprise_manual: "Enterprise",
};
const PAY_COLOR: Record<string, string> = {
  approved: "#22c55e", rejected: "#ef4444", pending: "#f59e0b",
  refunded: "#a78bfa", cancelled: "#6b7280",
};

function Spin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || "#9090b0";
  return (
    <span style={{
      fontSize: 11, padding: "3px 10px", borderRadius: 20,
      background: color + "18", border: `1px solid ${color}40`, color,
      fontFamily: "var(--font-mono)",
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function BillingMePage() {
  const { user } = useAuthStore();
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    api.get("/billing/me/summary")
      .then(r => setBilling(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCheckout = async () => {
    if (billing?.mpCheckoutUrl) { window.open(billing.mpCheckoutUrl, "_blank"); return; }
    setCheckoutLoading(true);
    try {
      const r = await api.get("/billing/me/checkout");
      window.open(r.data.checkoutUrl, "_blank");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Link de pagamento não disponível. Contate o suporte.");
    } finally { setCheckoutLoading(false); }
  };

  const isBlocked = billing?.status === "suspended" || billing?.status === "cancelled";
  const isTrialExpiring = billing?.status === "trial" && billing?.trialEndsAt &&
    new Date(billing.trialEndsAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Minha Assinatura
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Gerencie seu plano e histórico de pagamentos
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>
          ) : !billing ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 32, textAlign: "center" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Sem informações de assinatura. Contate o suporte.</div>
            </div>
          ) : (
            <>
              {/* Alerta de trial expirando */}
              {isTrialExpiring && (
                <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div>
                    <div style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13 }}>Trial expirando em breve</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
                      Seu trial encerra em {new Date(billing.trialEndsAt!).toLocaleDateString("pt-BR")}. Ative sua assinatura para não perder o acesso.
                    </div>
                  </div>
                </div>
              )}

              {/* Alerta de bloqueio */}
              {isBlocked && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16 }}>🚫</span>
                  <div>
                    <div style={{ color: "#ef4444", fontWeight: 600, fontSize: 13 }}>Acesso suspenso</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
                      Sua organização está com acesso suspenso. Regularize sua assinatura abaixo.
                    </div>
                  </div>
                </div>
              )}

              {/* Card principal */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Plano Atual</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                      {billing.planInfo.nome}
                    </div>
                    {billing.valorMensal && (
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
                        R$ {billing.valorMensal.toFixed(2)}<span style={{ fontSize: 11 }}>/mês</span>
                      </div>
                    )}
                  </div>
                  <StatusBadge status={billing.status} />
                </div>

                {/* Datas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {billing.status === "trial" && billing.trialEndsAt && (
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Trial encerra em</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {new Date(billing.trialEndsAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  )}
                  {billing.nextBillingDate && (
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Próxima cobrança</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {new Date(billing.nextBillingDate).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  )}
                  {billing.planInfo.maxUsers && (
                    <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Limite de usuários</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        até {billing.planInfo.maxUsers} usuários
                      </div>
                    </div>
                  )}
                </div>

                {/* Features do plano */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Incluído no plano</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {billing.planInfo.features.map(f => (
                      <span key={f} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                        ✓ {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA pagamento */}
                {(billing.status === "trial" || billing.status === "overdue" || billing.status === "suspended") && (
                  <button
                    onClick={openCheckout}
                    disabled={checkoutLoading}
                    className="btn btn-violet"
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                  >
                    {checkoutLoading ? <Spin /> : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        {billing.status === "trial" ? "Ativar Assinatura" : "Regularizar Agora"}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Histórico de pagamentos */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>Histórico de Pagamentos</div>
                {billing.payments.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Nenhum pagamento registrado</div>
                ) : (
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Data</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Ref.</th>
                        <th style={{ textAlign: "right", padding: "4px 8px" }}>Valor</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Método</th>
                        <th style={{ textAlign: "left", padding: "4px 8px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billing.payments.map(p => (
                        <tr key={p.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px", color: "var(--text-secondary)" }}>
                            {(p.dataPagamento || p.criadoEm) ? new Date(p.dataPagamento || p.criadoEm).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td style={{ padding: "8px", color: "var(--text-muted)" }}>{p.referencia || "—"}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)" }}>R$ {p.valor.toFixed(2)}</td>
                          <td style={{ padding: "8px", color: "var(--text-secondary)" }}>{p.metodo || "—"}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: (PAY_COLOR[p.status] || "#9090b0") + "18", border: `1px solid ${(PAY_COLOR[p.status] || "#9090b0")}40`, color: PAY_COLOR[p.status] || "#9090b0" }}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Suporte */}
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                Dúvidas sobre sua assinatura?{" "}
                <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-violet)" }}>
                  Fale com o suporte
                </a>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
