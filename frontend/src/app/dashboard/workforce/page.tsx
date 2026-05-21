"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

type Overview = {
  periodo: { mes: string; diasUteis: number };
  colaboradores: { total: number; ativos: number; inativos: number; semSkill: number };
  capacity: { nominal: number; realizado: number; planejado: number; utilRealizado: number; utilPlanejado: number; sobrecarregados: number };
  ausencias: { pendentes: number; aprovadasMes: number; ausentesHoje: number };
  workflows: { pendentes: number; aprovadasMes: number; rejeitadasMes: number };
  skills: { total: number; top: { id: string; nome: string; categoria: string|null; cor: string|null; colaboradores: number }[] };
  porSetor: { nome: string; cor: string|null; colaboradores: number; nominal: number; planejado: number; util: number }[];
};

function Spin() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>;
}

function utilColor(u: number) {
  if (u > 90) return "var(--accent-red)";
  if (u > 70) return "#fbbf24";
  if (u > 30) return "var(--accent-green)";
  return "var(--accent-cyan)";
}

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding:"16px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontSize:11, fontFamily:"var(--font-mono)", letterSpacing:"0.08em", color:"var(--text-muted)" }}>{title}</div>
        {href && <Link href={href} style={{ fontSize:11, color:"var(--accent-violet)", textDecoration:"none" }}>Ver detalhes →</Link>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, color, sufix }: { label: string; value: number|string; color: string; sufix?: string }) {
  return (
    <div style={{ flex:1 }}>
      <div style={{ fontFamily:"var(--font-display)", fontSize:24, fontWeight:700, color }}>{value}{sufix}</div>
      <div style={{ fontSize:10, fontFamily:"var(--font-mono)", letterSpacing:"0.06em", color:"var(--text-muted)" }}>{label}</div>
    </div>
  );
}

export default function WorkforcePage() {
  const [data, setData] = useState<Overview|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/workforce/overview")
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <Topbar />
      <div style={{ flex:1, overflowY:"auto", padding:24, display:"flex", flexDirection:"column", gap:16 }}>
        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spin/></div>
        ) : !data ? (
          <div style={{ textAlign:"center", padding:60, color:"var(--text-muted)" }}>Não foi possível carregar o overview</div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <h2 style={{ fontFamily:"var(--font-display)", fontSize:20, fontWeight:700, textTransform:"capitalize" }}>{data.periodo.mes}</h2>
              <span style={{ fontSize:12, color:"var(--text-muted)" }}>{data.periodo.diasUteis} dias úteis</span>
            </div>

            {/* KPIs principais */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <Section title="COLABORADORES" href="/dashboard/cadastros">
                <div style={{ display:"flex", gap:12 }}>
                  <MiniStat label="ATIVOS" value={data.colaboradores.ativos} color="var(--accent-violet)" />
                  <MiniStat label="INATIVOS" value={data.colaboradores.inativos} color="var(--text-muted)" />
                </div>
                {data.colaboradores.semSkill > 0 && (
                  <div style={{ marginTop:10, fontSize:11, color:"#fbbf24" }}>⚠ {data.colaboradores.semSkill} sem skills cadastradas</div>
                )}
              </Section>

              <Section title="CAPACIDADE (PLANEJADO)" href="/dashboard/capacity">
                <div style={{ fontFamily:"var(--font-display)", fontSize:32, fontWeight:700, color:utilColor(data.capacity.utilPlanejado) }}>
                  {data.capacity.utilPlanejado}%
                </div>
                <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                  {data.capacity.planejado}h / {data.capacity.nominal}h
                </div>
                {data.capacity.sobrecarregados > 0 && (
                  <div style={{ marginTop:6, fontSize:11, color:"var(--accent-red)" }}>{data.capacity.sobrecarregados} sobrecarregado(s)</div>
                )}
              </Section>

              <Section title="AUSÊNCIAS" href="/dashboard/cadastros">
                <div style={{ display:"flex", gap:12 }}>
                  <MiniStat label="PENDENTES" value={data.ausencias.pendentes} color="#fbbf24" />
                  <MiniStat label="HOJE" value={data.ausencias.ausentesHoje} color="#94a3b8" />
                </div>
                <div style={{ marginTop:10, fontSize:11, color:"var(--text-muted)" }}>{data.ausencias.aprovadasMes} aprovadas no mês</div>
              </Section>

              <Section title="APROVAÇÕES" href="/dashboard/aprovacoes">
                <div style={{ display:"flex", gap:12 }}>
                  <MiniStat label="PENDENTES" value={data.workflows.pendentes} color="var(--accent-violet)" />
                  <MiniStat label="APROV. MÊS" value={data.workflows.aprovadasMes} color="var(--accent-green)" />
                </div>
                {data.workflows.rejeitadasMes > 0 && (
                  <div style={{ marginTop:10, fontSize:11, color:"var(--text-muted)" }}>{data.workflows.rejeitadasMes} rejeitadas no mês</div>
                )}
              </Section>
            </div>

            {/* Capacidade realizada vs planejada — barra */}
            <Section title="UTILIZAÇÃO DA CAPACIDADE ORGANIZACIONAL">
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {[
                  { label:"Realizado (apontado)", val:data.capacity.utilRealizado, abs:data.capacity.realizado },
                  { label:"Planejado (alocado)",  val:data.capacity.utilPlanejado, abs:data.capacity.planejado },
                ].map(b=>(
                  <div key={b.label}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                      <span style={{ color:"var(--text-secondary)" }}>{b.label}</span>
                      <span style={{ fontFamily:"var(--font-mono)", color:utilColor(b.val) }}>{b.val}% • {b.abs}h</span>
                    </div>
                    <div style={{ height:10, borderRadius:5, background:"var(--bg-hover)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(100,b.val)}%`, background:utilColor(b.val), borderRadius:5, transition:"width 0.4s" }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>
                  Capacidade nominal: {data.capacity.nominal}h (já descontadas ausências aprovadas)
                </div>
              </div>
            </Section>

            <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16 }}>
              {/* Por setor */}
              <Section title="CAPACIDADE POR SETOR">
                {data.porSetor.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>Sem colaboradores cadastrados</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {data.porSetor.map(s=>(
                      <div key={s.nome}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ width:8, height:8, borderRadius:"50%", background:s.cor||"#94a3b8" }} />
                            {s.nome}
                            <span style={{ color:"var(--text-muted)", fontSize:11 }}>({s.colaboradores})</span>
                          </span>
                          <span style={{ fontFamily:"var(--font-mono)", color:utilColor(s.util) }}>{s.util}%</span>
                        </div>
                        <div style={{ height:8, borderRadius:4, background:"var(--bg-hover)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${Math.min(100,s.util)}%`, background:utilColor(s.util), borderRadius:4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Top skills */}
              <Section title="SKILLS MAIS PRESENTES" href="/dashboard/cadastros">
                {data.skills.top.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>Nenhuma skill cadastrada</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {data.skills.top.map(sk=>(
                      <div key={sk.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:24, height:24, borderRadius:6, background:(sk.cor||"#a78bfa")+"20", border:`1px solid ${(sk.cor||"#a78bfa")}40`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={sk.cor||"#a78bfa"} strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500 }}>{sk.nome}</div>
                          {sk.categoria && <div style={{ fontSize:10, color:"var(--text-muted)" }}>{sk.categoria}</div>}
                        </div>
                        <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--text-secondary)" }}>{sk.colaboradores}</span>
                      </div>
                    ))}
                    <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>{data.skills.total} skills no catálogo</div>
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
