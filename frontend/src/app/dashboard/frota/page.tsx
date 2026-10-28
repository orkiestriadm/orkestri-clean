"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { Truck, Users, Wrench, Zap, AlertTriangle, FileText, CalendarDays, CreditCard } from "lucide-react";

type Dash = {
  totalVeiculos: number;
  porStatus: Record<string, number>;
  totalMotoristas: number;
  manutAbertas: number;
  custoManutMes: number;
  custoAbastMes: number;
  alertas: { cnhVencendo: number; docVencendo: number; revisoesPendentes: number; total: number };
};

const fmtMoney = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ icon: Icon, label, value, color, href }: { icon: any; label: string; value: React.ReactNode; color: string; href?: string }) {
  const body = (
    <div className="card" style={{ padding: "18px 20px", borderLeft: `3px solid ${color}`, cursor: href ? "pointer" : "default", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function FrotaDashboardPage() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/frota/dashboard").then(r => setD(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const STATUS_LABEL: Record<string, string> = { ativo: "Ativos", manutencao: "Em manutenção", inativo: "Inativos", vendido: "Vendidos" };
  const STATUS_COLOR: Record<string, string> = { ativo: "var(--accent-green)", manutencao: "var(--accent-amber)", inativo: "var(--text-muted)", vendido: "var(--accent-red)" };

  return (
    <div className="flex flex-col h-full">
      <Topbar />
      <main className="flex-1 overflow-y-auto p-6">
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Carregando...</div>}
        {d && (
          <>
            {/* KPIs principais */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
              <Kpi icon={Truck} label="VEÍCULOS" value={d.totalVeiculos} color="var(--accent-cyan)" href="/dashboard/frota/veiculos" />
              <Kpi icon={Users} label="MOTORISTAS" value={d.totalMotoristas} color="var(--accent-violet, #8b5cf6)" href="/dashboard/frota/motoristas" />
              <Kpi icon={Wrench} label="MANUTENÇÕES ABERTAS" value={d.manutAbertas} color="var(--accent-amber)" href="/dashboard/frota/manutencoes" />
              <Kpi icon={AlertTriangle} label="ALERTAS" value={d.alertas.total} color={d.alertas.total > 0 ? "var(--accent-red)" : "var(--accent-green)"} />
              <Kpi icon={Wrench} label="CUSTO MANUT. (MÊS)" value={fmtMoney(d.custoManutMes)} color="var(--accent-amber)" />
              <Kpi icon={Zap} label="ABASTECIMENTO (MÊS)" value={fmtMoney(d.custoAbastMes)} color="var(--accent-green)" href="/dashboard/frota/abastecimentos" />
            </div>

            {/* Status da frota */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>STATUS DA FROTA</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 22 }}>
              {["ativo", "manutencao", "inativo", "vendido"].map(s => (
                <div key={s} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[s], fontFamily: "var(--font-mono)" }}>{d.porStatus[s] || 0}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{STATUS_LABEL[s]}</div>
                </div>
              ))}
            </div>

            {/* Alertas */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 8 }}>ALERTAS DE VENCIMENTO (PRÓXIMOS 30 DIAS)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <Link href="/dashboard/frota/motoristas">
                <div className="card" style={{ padding: "16px 18px", borderLeft: `3px solid ${d.alertas.cnhVencendo ? "var(--accent-amber)" : "var(--accent-green)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CreditCard size={15} style={{ color: "var(--accent-amber)" }} /><span style={{ fontSize: 12 }}>CNH vencendo</span></div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{d.alertas.cnhVencendo}</div>
                </div>
              </Link>
              <Link href="/dashboard/frota/documentacoes">
                <div className="card" style={{ padding: "16px 18px", borderLeft: `3px solid ${d.alertas.docVencendo ? "var(--accent-amber)" : "var(--accent-green)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={15} style={{ color: "var(--accent-amber)" }} /><span style={{ fontSize: 12 }}>Documentos vencendo</span></div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{d.alertas.docVencendo}</div>
                </div>
              </Link>
              <Link href="/dashboard/frota/revisoes">
                <div className="card" style={{ padding: "16px 18px", borderLeft: `3px solid ${d.alertas.revisoesPendentes ? "var(--accent-amber)" : "var(--accent-green)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={15} style={{ color: "var(--accent-amber)" }} /><span style={{ fontSize: 12 }}>Revisões pendentes</span></div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{d.alertas.revisoesPendentes}</div>
                </div>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
