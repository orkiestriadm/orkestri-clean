const fs = require('fs');
const file = 'c:/orkestri-clean/frontend/src/app/dashboard/frota/manutencoes/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldCounts = `  const counts = {
    aberta: items.filter(m => m.status === "aberta").length,
    em_andamento: items.filter(m => m.status === "em_andamento").length,
    aguardando_pecas: items.filter(m => m.status === "aguardando_pecas").length,
    finalizada: items.filter(m => m.status === "finalizada").length,
    cancelada: items.filter(m => m.status === "cancelada").length,
  };`;

const newCounts = `  const counts = {
    aberta: items.filter(m => m.status === "aberta").length,
    em_andamento: items.filter(m => m.status === "em_andamento").length,
    aguardando_pecas: items.filter(m => m.status === "aguardando_pecas").length,
    finalizada: items.filter(m => m.status === "finalizada").length,
    cancelada: items.filter(m => m.status === "cancelada").length,
    preventiva: items.filter(m => m.tipo === "preventiva").length,
    corretiva: items.filter(m => m.tipo === "corretiva").length,
    emergencial: items.filter(m => m.tipo === "emergencial").length,
  };`;
content = content.replace(oldCounts, newCounts);

const regexPainel = /\{\/\* Painel de Filtros e KPIs \*\/\}\s*<div className="bg-white[\s\S]*?<\/div>\s*<\/div>/;
const newPainel = `{/* Painel de filtros (clique para filtrar) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiCard label="Abertas" valor={counts.aberta} color="#06b6d4" active={activeFilterStatus === "aberta"} onClick={() => setActiveFilterStatus(activeFilterStatus === "aberta" ? "" : "aberta")} />
            <KpiCard label="Em andamento" valor={counts.em_andamento} color="#f59e0b" active={activeFilterStatus === "em_andamento"} onClick={() => setActiveFilterStatus(activeFilterStatus === "em_andamento" ? "" : "em_andamento")} />
            <KpiCard label="Aguard. peças" valor={counts.aguardando_pecas} color="#f97316" active={activeFilterStatus === "aguardando_pecas"} onClick={() => setActiveFilterStatus(activeFilterStatus === "aguardando_pecas" ? "" : "aguardando_pecas")} />
            <KpiCard label="Finalizadas" valor={counts.finalizada} color="#22c55e" active={activeFilterStatus === "finalizada"} onClick={() => setActiveFilterStatus(activeFilterStatus === "finalizada" ? "" : "finalizada")} />
            <KpiCard label="Canceladas" valor={counts.cancelada} color="var(--text-muted)" active={activeFilterStatus === "cancelada"} onClick={() => setActiveFilterStatus(activeFilterStatus === "cancelada" ? "" : "cancelada")} />
            
            <KpiCard label="Preventiva" valor={counts.preventiva} color="#0ea5e9" active={activeFilterTipo === "preventiva"} onClick={() => setActiveFilterTipo(activeFilterTipo === "preventiva" ? "" : "preventiva")} />
            <KpiCard label="Corretiva" valor={counts.corretiva} color="#eab308" active={activeFilterTipo === "corretiva"} onClick={() => setActiveFilterTipo(activeFilterTipo === "corretiva" ? "" : "corretiva")} />
            <KpiCard label="Emergencial" valor={counts.emergencial} color="#ef4444" active={activeFilterTipo === "emergencial"} onClick={() => setActiveFilterTipo(activeFilterTipo === "emergencial" ? "" : "emergencial")} />
          </div>`;

content = content.replace(regexPainel, newPainel);

const oldSearchRow = /\{q && \(\s*<button style=\{\{ border: "1px solid var\(--border-subtle\)", borderRadius: 8, padding: "6px 12px", background: "var\(--bg-primary\)", fontSize: 11, cursor: "pointer", color: "var\(--text-primary\)" \}\} onClick=\{\(\) => setQ\(""\)\}>Limpar pesquisa<\/button>\s*\)\}/;

const newSearchRow = `{(q || activeFilterStatus || activeFilterTipo) && (
              <button style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "6px 12px", background: "var(--bg-primary)", fontSize: 11, cursor: "pointer", color: "var(--text-primary)" }} onClick={() => { setQ(""); setActiveFilterStatus(""); setActiveFilterTipo(""); }}>Limpar filtros</button>
            )}`;

content = content.replace(oldSearchRow, newSearchRow);

fs.writeFileSync(file, content, 'utf8');
console.log('Manutencoes updated successfully');
