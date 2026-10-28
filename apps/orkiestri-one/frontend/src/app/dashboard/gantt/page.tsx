"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";

type Task = { id:string; titulo:string; status:string; prioridade:string; dataVencimento?:string; assignee?:{nome:string}; criadoEm:string; };
type Project = { id:string; titulo:string; cor:string; dataInicio?:string; dataFim?:string; tasks:Task[]; progressoPct:number; };

const STATUS_COLORS: Record<string,string> = { A_FAZER:"var(--text-muted)", EM_ANDAMENTO:"var(--accent-cyan)", REVISAO:"var(--accent-amber)", BLOQUEADA:"var(--accent-red)", CONCLUIDA:"var(--accent-green)" };

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }

export default function GanttPage() {
  const [projects, setProjects]  = useState<Project[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [selected, setSelected]  = useState<string|null>(null);
  const [viewDays, setViewDays]  = useState(30);

  useEffect(() => {
    api.get("/projects").then(r => {
      setProjects(r.data);
      if (r.data.length > 0) setSelected(r.data[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadDetail = async (id: string) => {
    const { data } = await api.get("/projects/"+id);
    setProjects(p => p.map(proj => proj.id === id ? data : proj));
    setSelected(id);
  };

  const project = projects.find(p => p.id === selected);
  const today = new Date(); today.setHours(0,0,0,0);
  const startDate = project?.dataInicio ? new Date(project.dataInicio) : addDays(today, -7);
  const days = Array.from({ length: viewDays }, (_, i) => addDays(startDate, i));

  function taskBar(task: Task) {
    const start = new Date(task.criadoEm); start.setHours(0,0,0,0);
    const end   = task.dataVencimento ? new Date(task.dataVencimento) : addDays(start, 3);
    const startIdx = Math.max(0, Math.floor((start.getTime() - startDate.getTime()) / 86400000));
    const endIdx   = Math.min(viewDays, Math.ceil((end.getTime() - startDate.getTime()) / 86400000));
    const width = Math.max(1, endIdx - startIdx);
    return { startIdx, width };
  }

  const COL = 36;
  const ROW = 38;

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        <div style={{ display:"flex", gap:4, background:"var(--bg-glass)", border:"1px solid var(--border-subtle)", borderRadius:8, padding:3 }}>
          {[14,30,60].map(d => (
            <button key={d} onClick={()=>setViewDays(d)} style={{ padding:"4px 10px", borderRadius:6, background:viewDays===d?"var(--accent-violet)":"transparent", border:"none", color:viewDays===d?"white":"var(--text-muted)", fontSize:11, cursor:"pointer" }}>{d}d</button>
          ))}
        </div>
      </Topbar>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de projetos */}
        <div style={{ width:220, borderRight:"1px solid var(--border-subtle)", overflowY:"auto", padding:12, flexShrink:0 }}>
          <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)", letterSpacing:"0.08em", marginBottom:10, textTransform:"uppercase" }}>Projetos</div>
          {loading ? <div style={{ textAlign:"center", padding:20, color:"var(--text-muted)" }}>Carregando...</div> :
          projects.map(p => (
            <div key={p.id} onClick={()=>loadDetail(p.id)} style={{ padding:"10px 12px", borderRadius:8, cursor:"pointer", marginBottom:4, border:`1px solid ${selected===p.id?"rgba(124,58,237,0.3)":"var(--border-subtle)"}`, background:selected===p.id?"var(--accent-violet-dim)":"var(--bg-card)", transition:"all 0.15s" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:p.cor }} />
                <span style={{ fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.titulo}</span>
              </div>
              <div style={{ height:3, background:"var(--border-subtle)", borderRadius:2 }}>
                <div style={{ height:"100%", width:p.progressoPct+"%", background:p.cor, borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Gantt grid */}
        <div style={{ flex:1, overflowX:"auto", overflowY:"auto" }}>
          {!project ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--text-muted)", fontSize:13 }}>
              Selecione um projeto
            </div>
          ) : (
            <div style={{ minWidth: 280 + days.length * COL }}>
              {/* Header de datas */}
              <div style={{ display:"flex", position:"sticky", top:0, zIndex:3, background:"var(--bg-primary)", borderBottom:"1px solid var(--border-subtle)" }}>
                <div style={{ width:280, flexShrink:0, padding:"8px 16px", borderRight:"1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-muted)" }}>TASK</span>
                </div>
                {days.map((d,i) => {
                  const isToday = d.getTime() === today.getTime();
                  const isMon   = d.getDay() === 1;
                  return (
                    <div key={i} style={{ width:COL, flexShrink:0, textAlign:"center", padding:"4px 0", borderLeft:isMon?"1px solid var(--border-subtle)":"none", background:isToday?"rgba(124,58,237,0.06)":"transparent" }}>
                      {(isMon || i===0) && <div style={{ fontSize:9, color:"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{d.getDate()}/{d.getMonth()+1}</div>}
                      <div style={{ fontSize:8, color:isToday?"var(--accent-violet)":"var(--text-muted)", fontFamily:"var(--font-mono)" }}>{["D","S","T","Q","Q","S","S"][d.getDay()]}</div>
                    </div>
                  );
                })}
              </div>

              {/* Linhas de tasks */}
              {(project.tasks||[]).map((task, ti) => {
                const bar = taskBar(task);
                const color = project.cor;
                const isToday = days.findIndex(d => d.getTime() === today.getTime());
                return (
                  <div key={task.id} style={{ display:"flex", height:ROW, borderBottom:"1px solid var(--border-subtle)", alignItems:"center" }}>
                    <div style={{ width:280, flexShrink:0, padding:"0 16px", borderRight:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:STATUS_COLORS[task.status], flexShrink:0 }} />
                      <span style={{ fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{task.titulo}</span>
                      {task.assignee && <span style={{ fontSize:10, color:"var(--text-muted)", flexShrink:0 }}>{task.assignee.nome.split(" ")[0]}</span>}
                    </div>
                    <div style={{ position:"relative", flex:1, height:"100%" }}>
                      {/* Fundo do grid */}
                      {days.map((d,i) => {
                        const isT = i === isToday;
                        const isMon = d.getDay() === 1;
                        return <div key={i} style={{ position:"absolute", left:i*COL, width:COL, top:0, bottom:0, background:isT?"rgba(124,58,237,0.04)":d.getDay()===0||d.getDay()===6?"rgba(0,0,0,0.03)":"transparent", borderLeft:isMon?"1px solid var(--border-subtle)":"none" }} />;
                      })}
                      {/* Linha hoje */}
                      {isToday >= 0 && <div style={{ position:"absolute", left:isToday*COL+COL/2, top:0, bottom:0, width:2, background:"rgba(124,58,237,0.3)", zIndex:2 }} />}
                      {/* Barra da task */}
                      {bar.startIdx < viewDays && bar.width > 0 && (
                        <div title={task.titulo} style={{ position:"absolute", left:bar.startIdx*COL+2, width:bar.width*COL-4, top:"25%", height:"50%", background:task.status==="CONCLUIDA"?color+"80":color, borderRadius:4, zIndex:1, opacity:0.85, boxShadow:`0 1px 4px ${color}40`, display:"flex", alignItems:"center", paddingLeft:6 }}>
                          <span style={{ fontSize:10, color:"white", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.titulo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!project.tasks||project.tasks.length===0) && (
                <div style={{ padding:48, textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>Nenhuma task neste projeto</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}