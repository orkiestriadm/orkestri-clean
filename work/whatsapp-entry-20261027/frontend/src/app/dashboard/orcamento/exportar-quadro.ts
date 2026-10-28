/**
 * Exportar e imprimir o QUADRO do Orçamento (OPEX/CAPEX) exatamente como ele
 * está na tela.
 *
 * Mora fora do `page.tsx` por um motivo prático: aqui dá para rodar em Node,
 * gerar a planilha e ABRIR o arquivo num teste. Dentro da página, só o
 * typecheck rodaria — e typecheck não prova que a planilha sai.
 */

/** Rótulos dos meses. Fonte única: a página importa daqui. */
export const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

/** O mínimo que um item precisa ter para virar linha do quadro. */
export interface ItemDoQuadro {
  nome: string;
  categoria?: { nome: string } | null;
  meses: { mes: number; valorPrevisto: number; valorRealizado?: number | null }[];
  totais: { previsto: number; realizado: number; execucao: number };
}

// // A cor da célula de mês É informação, não enfeite: ciano = realizado lançado,
// vermelho = realizado acima do previsto, violeta = ainda sem realizado (o
// número mostrado é o previsto). Quem recebe o papel enxerga onde estourou sem
// abrir o sistema — por isso a legenda vai junto no rodapé.
export const COR_REAL = "0E7490", COR_ESTOURO = "B91C1C", COR_PREV = "7C3AED", COR_VAZIO = "9CA3AF";
const COR_ACENTO = "8B5CF6", COR_ZEBRA = "F5F3FF", COR_TOTAL = "EDE9FE";
const LEGENDA: [string,string][] = [
  ["Realizado lançado", COR_REAL],
  ["Realizado acima do previsto (estouro)", COR_ESTOURO],
  ["Ainda sem realizado — o valor é o previsto", COR_PREV],
  ["Mês sem previsto e sem realizado", COR_VAZIO],
];

export type CelulaMes = { valor:number|null; cor:string };
export type LinhaGrid = { nome:string; categoria:string; meses:CelulaMes[]; previsto:number; realizado:number; execucao:number };

// Normaliza o que o grid mostra. É a MESMA regra da célula na tela: realizado
// quando lançado, senão o previsto, senão nada. Um segundo cálculo aqui faria
// o papel discordar da tela na primeira mudança de regra.
export function linhasDoGrid(itens:ItemDoQuadro[]): LinhaGrid[] {
  return itens.map(it=>({
    nome: it.nome,
    categoria: it.categoria?.nome || "",
    meses: MESES.map((_,i)=>{
      const m = it.meses.find(x=>x.mes===i+1);
      const prev = m?.valorPrevisto || 0;
      const real = m?.valorRealizado;
      if(real!=null) return { valor: real, cor: real>prev ? COR_ESTOURO : COR_REAL };
      if(prev>0)     return { valor: prev, cor: COR_PREV };
      return { valor: null, cor: COR_VAZIO };
    }),
    previsto: it.totais.previsto,
    realizado: it.totais.realizado,
    execucao: it.totais.execucao,
  }));
}

const CABECALHO_GRID = ["Item","Categoria",...MESES,"Previsto","Realizado","% Exec."];

export async function exportGridExcel(tipo:string, ano:string, itens:ItemDoQuadro[], filtro:string, totalItens:number) {
  // exceljs e CommonJS: dependendo do empacotador o modulo vem em `default` ou
  // na raiz. Aceitar os dois evita um "Workbook is not a constructor" que so
  // apareceria em producao.
  const mod:any = await import("exceljs");
  const ExcelJS:any = mod?.default?.Workbook ? mod.default : mod;
  const linhas = linhasDoGrid(itens);
  const somaP = linhas.reduce((a,l)=>a+l.previsto,0);
  const somaR = linhas.reduce((a,l)=>a+l.realizado,0);
  const LIN_CAB = 7;
  const argb = (hex:string)=>"FF"+hex;
  const MOEDA = 'R$ #,##0;[Red]-R$ #,##0';

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${tipo} ${ano}`, {
    // Congela o cabeçalho E as duas colunas de identificação: com 17 colunas,
    // rolar para Dezembro sem isso faz perder de vista de quem é a linha.
    views: [{ state:"frozen", xSplit:2, ySplit:LIN_CAB }],
    pageSetup: {
      orientation:"landscape", paperSize:9, fitToPage:true, fitToWidth:1, fitToHeight:0,
      printTitlesRow:`${LIN_CAB}:${LIN_CAB}`, horizontalCentered:true,
      margins:{ left:0.3, right:0.3, top:0.5, bottom:0.5, header:0.2, footer:0.2 },
    },
    headerFooter: { oddFooter:`&L${`Orçamento ${ano} — ${tipo}`}&RPágina &P de &N` },
  });

  ws.getCell("A1").value = `Orçamento ${ano} — ${tipo}`;
  ws.getCell("A1").font = { bold:true, size:15 };
  ws.getCell("A2").value = filtro;
  ws.getCell("A2").font = { size:9, color:{argb:"FF6B7280"} };

  // Faixa de totais — a mesma que fica acima do quadro na tela.
  const faixa: [string, number, string][] = [
    ["Total Previsto", somaP, MOEDA],
    ["Total Realizado", somaR, MOEDA],
    ["Execução", somaP ? somaR/somaP : 0, "0.0%"],
  ];
  faixa.forEach(([rot,val,fmt],i)=>{
    const c1 = ws.getCell(4, 1+i*2); c1.value = rot; c1.font = { size:9, bold:true, color:{argb:"FF6B7280"} };
    const c2 = ws.getCell(4, 2+i*2); c2.value = val; c2.numFmt = fmt;
    c2.font = { size:11, bold:true, color:{argb:argb(COR_ACENTO)} };
  });
  const cQtd = ws.getCell(4, 7);
  cQtd.value = itens.length===totalItens ? `${totalItens} itens` : `mostrando ${itens.length} de ${totalItens} itens`;
  cQtd.font = { size:9, italic:true, color:{argb:"FF6B7280"} };

  CABECALHO_GRID.forEach((nome,i)=>{
    const c = ws.getCell(LIN_CAB, i+1);
    c.value = nome;
    c.font = { bold:true, size:10, color:{argb:"FFFFFFFF"} };
    c.fill = { type:"pattern", pattern:"solid", fgColor:{argb:argb(COR_ACENTO)} };
    c.alignment = { horizontal: i<2 ? "left" : "center", vertical:"middle" };
  });
  ws.getRow(LIN_CAB).height = 20;
  ws.getColumn(1).width = 32; ws.getColumn(2).width = 18;
  for(let i=3;i<=14;i++) ws.getColumn(i).width = 11;
  for(let i=15;i<=17;i++) ws.getColumn(i).width = 13;

  let r = LIN_CAB;
  linhas.forEach((l,idx)=>{
    r++;
    const zebra = idx % 2 === 1;
    ws.getCell(r,1).value = l.nome;      ws.getCell(r,1).font = { size:10 };
    ws.getCell(r,2).value = l.categoria; ws.getCell(r,2).font = { size:9, color:{argb:"FF6B7280"} };
    l.meses.forEach((m,i)=>{
      const c = ws.getCell(r, 3+i);
      if(m.valor!=null) c.value = m.valor;
      c.numFmt = MOEDA;
      c.font = { size:10, color:{argb:argb(m.cor)}, bold: m.cor===COR_ESTOURO };
      c.alignment = { horizontal:"right" };
    });
    const cp = ws.getCell(r,15); cp.value = l.previsto;  cp.numFmt = MOEDA; cp.font = { size:10, color:{argb:argb(COR_PREV)} };
    const cr = ws.getCell(r,16); cr.value = l.realizado; cr.numFmt = MOEDA; cr.font = { size:10, color:{argb:argb(COR_REAL)} };
    const ce = ws.getCell(r,17); ce.value = l.execucao/100; ce.numFmt = "0.0%";
    ce.font = { size:10, bold:true, color:{argb:argb(l.execucao>100 ? COR_ESTOURO : COR_REAL)} };
    for(let i=1;i<=17;i++){
      const c = ws.getCell(r,i);
      c.border = { bottom:{ style:"thin", color:{argb:"FFE5E7EB"} } };
      if(zebra) c.fill = { type:"pattern", pattern:"solid", fgColor:{argb:argb(COR_ZEBRA)} };
    }
  });

  // Total do que está à vista — e o rótulo diz isso, para ninguém ler como o
  // total do ciclo inteiro.
  r++;
  ws.getCell(r,1).value = itens.length===totalItens ? "TOTAL" : `TOTAL (${itens.length} itens à vista)`;
  ws.getCell(r,1).font = { bold:true, size:10 };
  for(let i=3;i<=16;i++){
    const L = ws.getColumn(i).letter;
    const c = ws.getCell(r,i);
    c.value = { formula:`SUM(${L}${LIN_CAB+1}:${L}${r-1})` };
    c.numFmt = MOEDA; c.font = { bold:true, size:10 };
  }
  const ct = ws.getCell(r,17);
  ct.value = { formula:`IF(O${r}=0,0,P${r}/O${r})` };
  ct.numFmt = "0.0%"; ct.font = { bold:true, size:10 };
  for(let i=1;i<=17;i++){
    const c = ws.getCell(r,i);
    c.fill = { type:"pattern", pattern:"solid", fgColor:{argb:argb(COR_TOTAL)} };
    c.border = { top:{ style:"medium", color:{argb:argb(COR_ACENTO)} }, bottom:{ style:"medium", color:{argb:argb(COR_ACENTO)} } };
  }

  r += 2;
  ws.getCell(r,1).value = "Como ler as cores"; ws.getCell(r,1).font = { bold:true, size:9 };
  LEGENDA.forEach(([txt,cor],i)=>{
    const c = ws.getCell(r+1+i, 1);
    c.value = "■  " + txt;
    c.font = { size:9, color:{argb:argb(cor)} };
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `orcamento_${ano}_${tipo.toLowerCase()}.xlsx`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

// Impressão num iframe escondido: escrever a página inteira num documento
// próprio evita brigar com o layout do app (sidebar, topbar, scroll) e não
// esbarra em bloqueador de pop-up, como window.open esbarraria.
/**
 * Monta a pagina de impressao. Separado do `imprimirGrid` de proposito: esta
 * parte e pura, entao da para gerar o HTML num teste e OLHAR o resultado, em
 * vez de descobrir na impressora.
 */
export function htmlDoQuadroParaImpressao(tipo:string, ano:string, itens:ItemDoQuadro[], filtro:string, totalItens:number): string {
  const linhas = linhasDoGrid(itens);
  const somaP = linhas.reduce((a,l)=>a+l.previsto,0);
  const somaR = linhas.reduce((a,l)=>a+l.realizado,0);
  const esc = (t:string)=> (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const n0 = (v:number)=> Math.round(v||0).toLocaleString("pt-BR");
  const cel = (m:CelulaMes)=> m.valor==null
    ? `<td class="m vazio">—</td>`
    : `<td class="m" style="color:#${m.cor}${m.cor===COR_ESTOURO?";font-weight:700":""}">${n0(m.valor)}</td>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Orçamento ${esc(ano)} — ${esc(tipo)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#111827; margin:0; font-size:10px; }
  h1 { font-size:15px; margin:0 0 2px; }
  .filtro { font-size:9px; color:#6B7280; margin-bottom:8px; }
  .faixa { display:flex; gap:22px; margin:0 0 10px; align-items:baseline; }
  .faixa b { font-size:13px; color:#${COR_ACENTO}; }
  .faixa span { font-size:9px; color:#6B7280; text-transform:uppercase; letter-spacing:.04em; }
  .qtd { font-size:9px; color:#6B7280; font-style:italic; margin-left:auto; }
  table { width:100%; border-collapse:collapse; }
  /* table-header-group faz o cabeçalho repetir em toda página impressa */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background:#${COR_ACENTO}; color:#fff; font-size:9px; padding:5px 4px; text-align:center; }
  th.l { text-align:left; }
  td { padding:4px; border-bottom:1px solid #E5E7EB; font-size:9.5px; }
  /* Numero nunca quebra; o nome do item quebra. Sem isso um item de nome
     longo espreme as colunas de mes e estoura a largura do A4. */
  td.m, td.t { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td:first-child { word-break:break-word; }
  td.vazio { color:#${COR_VAZIO}; text-align:center; }
  .cat { color:#6B7280; font-size:8.5px; }
  tbody tr:nth-child(even) td { background:#${COR_ZEBRA}; }
  tfoot td { background:#${COR_TOTAL}; font-weight:700; border-top:2px solid #${COR_ACENTO}; border-bottom:2px solid #${COR_ACENTO}; }
  .legenda { margin-top:10px; font-size:8.5px; display:flex; gap:14px; flex-wrap:wrap; }
  .legenda i { font-style:normal; }
</style></head><body>
<h1>Orçamento ${esc(ano)} — ${esc(tipo)}</h1>
<div class="filtro">${esc(filtro)}</div>
<div class="faixa">
  <div><span>Total Previsto</span><br><b>R$ ${n0(somaP)}</b></div>
  <div><span>Total Realizado</span><br><b>R$ ${n0(somaR)}</b></div>
  <div><span>Execução</span><br><b>${somaP ? ((somaR/somaP)*100).toFixed(1) : "0.0"}%</b></div>
  <div class="qtd">${itens.length===totalItens ? `${totalItens} itens` : `mostrando ${itens.length} de ${totalItens} itens`}</div>
</div>
<table>
  <thead><tr>
    <th class="l">Item</th><th class="l">Categoria</th>
    ${MESES.map(m=>`<th>${m}</th>`).join("")}
    <th>Previsto</th><th>Realizado</th><th>% Exec.</th>
  </tr></thead>
  <tbody>
    ${linhas.map(l=>`<tr>
      <td>${esc(l.nome)}</td><td class="cat">${esc(l.categoria)}</td>
      ${l.meses.map(cel).join("")}
      <td class="t" style="color:#${COR_PREV}">${n0(l.previsto)}</td>
      <td class="t" style="color:#${COR_REAL}">${n0(l.realizado)}</td>
      <td class="t" style="color:#${l.execucao>100?COR_ESTOURO:COR_REAL};font-weight:700">${l.execucao.toFixed(1)}%</td>
    </tr>`).join("")}
  </tbody>
  <tfoot><tr>
    <td colspan="2">${itens.length===totalItens ? "TOTAL" : `TOTAL (${itens.length} itens à vista)`}</td>
    ${MESES.map((_,i)=>`<td class="t">${n0(linhas.reduce((a,l)=>a+(l.meses[i].valor||0),0))}</td>`).join("")}
    <td class="t">${n0(somaP)}</td><td class="t">${n0(somaR)}</td>
    <td class="t">${somaP ? ((somaR/somaP)*100).toFixed(1) : "0.0"}%</td>
  </tr></tfoot>
</table>
<div class="legenda">
  <strong>Como ler as cores:</strong>
  ${LEGENDA.map(([t,c])=>`<i style="color:#${c}">■ ${esc(t)}</i>`).join("")}
</div>
</body></html>`;
  return html;
}

// Impressao num iframe escondido: escrever a pagina inteira num documento
// proprio evita brigar com o layout do app (sidebar, topbar, scroll) e nao
// esbarra em bloqueador de pop-up, como window.open esbarraria.
export function imprimirGrid(tipo:string, ano:string, itens:ItemDoQuadro[], filtro:string, totalItens:number) {
  const html = htmlDoQuadroParaImpressao(tipo, ano, itens, filtro, totalItens);
  const ifr = document.createElement("iframe");
  ifr.setAttribute("aria-hidden", "true");
  ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(ifr);
  const doc = ifr.contentWindow?.document;
  if(!doc){ ifr.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  // Espera o layout: chamar print() antes de o documento assentar imprime
  // página em branco. E o iframe só sai bem depois — removê-lo cedo cancela
  // o diálogo de impressão em alguns navegadores.
  setTimeout(()=>{
    try { ifr.contentWindow?.focus(); ifr.contentWindow?.print(); } catch {}
    setTimeout(()=>ifr.remove(), 60000);
  }, 300);
}
