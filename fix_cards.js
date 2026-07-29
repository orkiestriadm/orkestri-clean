const fs = require('fs');

function processMonitoramento() {
  const file = 'c:/orkestri-clean/frontend/src/app/dashboard/monitoramento/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Replace KpiTile
  const oldTile = `function KpiTile({ label, value, colorName, icon, onClick, active, clickable }: {
  label: string; value: any; colorName: string; icon: React.ReactNode;
  onClick?: () => void; active?: boolean; clickable?: boolean;
}) {
  const Comp: any = clickable ? motion.button : "div";
  
  const colors: Record<string, { bg: string, text: string, ring: string, activeBg: string }> = {
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500', activeBg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    red: { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500', activeBg: 'bg-red-50 dark:bg-red-500/10' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500', activeBg: 'bg-amber-50 dark:bg-amber-500/10' },
    slate: { bg: 'bg-slate-500', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-500', activeBg: 'bg-slate-50 dark:bg-slate-500/10' }
  };
  
  const c = colors[colorName] || colors.slate;
  
  return (
    <Comp
      {...(clickable ? { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, onClick } : {})}
      className={\`flex-1 min-w-[150px] rounded-2xl border shadow-sm p-4 transition-all relative overflow-hidden group w-full text-left \${clickable ? 'cursor-pointer' : ''}
        \${active ? \`border-current ring-1 \${c.ring} \${c.text} \${c.activeBg}\` : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}\`}
    >
      <div className={\`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity blur-2xl \${c.bg}\`} />
      <div className="flex items-center gap-3 relative z-10">
        <div className={\`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 \${active ? c.bg + ' text-white' : 'bg-slate-50 dark:bg-slate-900 ' + c.text}\`}>
          {icon}
        </div>
        <div>
          <div className={\`text-[11px] font-bold uppercase tracking-wider mb-0.5 \${active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}\`} style={{ fontFamily: "var(--font-mono)" }}>{label}</div>
          <div className={\`text-2xl font-black tracking-tight \${active ? '' : 'text-slate-800 dark:text-slate-100'}\`} style={{ fontFamily: "var(--font-display)" }}>{value}</div>
        </div>
      </div>
    </Comp>
  );
}`;
  
  const newTile = `function KpiTile({ label, value, colorName, onClick, active, clickable }: {
  label: string; value: any; colorName: string; icon?: React.ReactNode;
  onClick?: () => void; active?: boolean; clickable?: boolean;
}) {
  const c = {
    emerald: "#22c55e",
    red: "#ef4444",
    amber: "#f59e0b",
    slate: "var(--text-muted)"
  }[colorName] || "var(--text-muted)";
  
  const Comp: any = clickable ? motion.button : "div";
  return (
    <Comp
      {...(clickable ? { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, onClick } : {})}
      className="flex-1 min-w-[150px] w-full"
      style={{
        position: "relative", overflow: "hidden", textAlign: "left", cursor: clickable ? "pointer" : "default", padding: "16px 18px", borderRadius: 14,
        background: \`radial-gradient(130% 130% at 100% 0%, \${c}22, transparent 58%), var(--bg-secondary)\`,
        border: \`1px solid \${active ? c : "var(--border-subtle)"}\`,
        boxShadow: active ? \`0 0 0 1px \${c}, 0 12px 36px -16px \${c}\` : "0 6px 22px -16px rgba(0,0,0,.5)",
        transition: "all .2s"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, boxShadow: \`0 0 12px \${c}\`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-display)", color: c, lineHeight: 1, marginTop: 10, textShadow: \`0 0 24px \${c}55\` }}>{value}</div>
      {clickable && <span style={{ position: "absolute", right: 12, bottom: 11, fontSize: 8.5, fontFamily: "var(--font-mono)", color: active ? c : "var(--text-muted)", opacity: .85, textTransform: "uppercase", letterSpacing: "0.08em" }}>{active ? "● filtrando" : "filtrar"}</span>}
    </Comp>
  );
}`;

  content = content.replace(oldTile, newTile);
  
  // Update the Filter Bar in Monitoramento
  // Looking for: <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg-primary)", padding: "10px 0", marginBottom: 10 }}>
  const regexFiltros = /<div style={{ position: "sticky", top: 0, zIndex: 30[\s\S]*?{loading && \(/m;
  const matchFiltros = content.match(regexFiltros);
  if (matchFiltros) {
    let replacedFiltros = matchFiltros[0]
      .replace(/<button onClick=\{\(\) => \{ setQ\(""\); setStat\(""\); setCat\(""\); \}\}[\s\S]*?Limpar filtros\s*<\/button>/m,
        `<button onClick={() => { setQ(""); setStat(""); setCat(""); }} style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-primary)", fontSize: 11, cursor: "pointer", color: "var(--text-primary)" }}>Limpar filtros</button>`);
    content = content.replace(matchFiltros[0], replacedFiltros);
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('Monitoramento updated.');
}

function processManutencoes() {
  const file = 'c:/orkestri-clean/frontend/src/app/dashboard/frota/manutencoes/page.tsx';
  let content = fs.readFileSync(file, 'utf8');

  // Replace KpiCard
  const oldCard = /function KpiCard\(\{[\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}/m;
  const newCard = `function KpiCard({ label, valor, color, active, onClick }: { label: string; valor: string | number; color: string; active: boolean; onClick: () => void; }) {
  return (
    <button onClick={onClick} className="flex-1 min-w-[150px] w-full"
      style={{
        position: "relative", overflow: "hidden", textAlign: "left", cursor: "pointer", padding: "16px 18px", borderRadius: 14,
        background: \`radial-gradient(130% 130% at 100% 0%, \${color}22, transparent 58%), var(--bg-secondary)\`,
        border: \`1px solid \${active ? color : "var(--border-subtle)"}\`,
        boxShadow: active ? \`0 0 0 1px \${color}, 0 12px 36px -16px \${color}\` : "0 6px 22px -16px rgba(0,0,0,.5)",
        transition: "all .2s"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: \`0 0 12px \${color}\`, flexShrink: 0 }} />
        <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-display)", color, lineHeight: 1, marginTop: 10, textShadow: \`0 0 24px \${color}55\` }}>{valor}</div>
      <span style={{ position: "absolute", right: 12, bottom: 11, fontSize: 8.5, fontFamily: "var(--font-mono)", color: active ? color : "var(--text-muted)", opacity: .85, textTransform: "uppercase", letterSpacing: "0.08em" }}>{active ? "● filtrando" : "filtrar"}</span>
    </button>
  );
}`;
  
  content = content.replace(oldCard, newCard);

  // Replace the cards rendering block in Manutencoes
  content = content.replace(/<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800\/60">[\s\S]*?<\/div>/m,
    `<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <KpiCard label="Abertas" valor={counts.aberta} color="#06b6d4" active={activeFilterStatus === "aberta"} onClick={() => setActiveFilterStatus(activeFilterStatus === "aberta" ? "" : "aberta")} />
              <KpiCard label="Em andamento" valor={counts.em_andamento} color="#f59e0b" active={activeFilterStatus === "em_andamento"} onClick={() => setActiveFilterStatus(activeFilterStatus === "em_andamento" ? "" : "em_andamento")} />
              <KpiCard label="Aguard. peças" valor={counts.aguardando_pecas} color="#f97316" active={activeFilterStatus === "aguardando_pecas"} onClick={() => setActiveFilterStatus(activeFilterStatus === "aguardando_pecas" ? "" : "aguardando_pecas")} />
              <KpiCard label="Finalizadas" valor={counts.finalizada} color="#22c55e" active={activeFilterStatus === "finalizada"} onClick={() => setActiveFilterStatus(activeFilterStatus === "finalizada" ? "" : "finalizada")} />
              <KpiCard label="Canceladas" valor={counts.cancelada} color="var(--text-muted)" active={activeFilterStatus === "cancelada"} onClick={() => setActiveFilterStatus(activeFilterStatus === "cancelada" ? "" : "cancelada")} />
            </div>`);

  // Update the Limpar Filtros button in Search Row in Manutencoes
  content = content.replace(/<button className="btn btn-ghost" style=\{\{ fontSize: 11 \}\} onClick=\{\(\) => setQ\(""\)\}>[\s\S]*?<\/button>/m,
    `<button style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-primary)", fontSize: 11, cursor: "pointer", color: "var(--text-primary)" }} onClick={() => setQ("")}>Limpar pesquisa</button>`);

  fs.writeFileSync(file, content, 'utf8');
  console.log('Manutencoes updated.');
}

processMonitoramento();
processManutencoes();
