"use client";
import { useMemo, useState } from 'react';
import type { WorkBook } from 'xlsx';
import { Upload, X, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { corrigirTelefoneLead } from '@/lib/lead-phone';

const input = 'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm';
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm disabled:opacity-40';
const fields = ['nome', 'telefone', 'email', 'empresa'] as const;
type Field = typeof fields[number];
type Row = Record<Field, string>;
const labels: Record<Field, string> = { nome: 'Nome *', telefone: 'Telefone / WhatsApp *', email: 'E-mail', empresa: 'Empresa' };
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<Field, RegExp> = { nome: /^(nome|nomecompleto|name|fullname|contato|cliente|razaosocial)$/, telefone: /^(telefone|telefone1|tel|celular|celular1|whatsapp|whats|fone|phone|mobile|numerowhatsapp|telefoneddd|telefonedocontato|numero)$/, email: /^(email|email1|correioeletronico)$/, empresa: /^(empresa|company|organizacao|nomefantasia|nomedaempresa)$/ };

export default function LeadImportDialog({ existing, onClose, onComplete }: { existing: string[]; onClose: () => void; onComplete: (result: any) => void }) {
  const [book, setBook] = useState<WorkBook | null>(null);
  const [sheets, setSheets] = useState<Record<string, string[][]>>({});
  const [sheet, setSheet] = useState('');
  const [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<Record<Field, number>>({ nome: -1, telefone: -1, email: -1, empresa: -1 });
  const [filename, setFilename] = useState('');
  const [list, setList] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<number, Partial<Row>>>({});
  const [excluded, setExcluded] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [dddPadrao, setDddPadrao] = useState('');
  const matrix = sheets[sheet] || [];
  const headers = matrix[header] || [];
  function configure(data: string[][], index: number) {
    const columns = data[index] || [];
    const found = Object.fromEntries(fields.map(f => [f, columns.findIndex(c => aliases[f].test(normalize(String(c || ''))))])) as Record<Field, number>;
    setHeader(index); setMapping(found); setEdits({}); setExcluded([]); setPage(0);
  }
  async function read(file?: File) {
    if (!file) return;
    setError(''); setBusy(true); setBook(null); setSheets({}); setDddPadrao('');
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Selecione um arquivo Excel (.xlsx ou .xls) ou CSV.');
      if (file.size > 5000000) throw new Error('O arquivo ultrapassa 5 MB. Divida a planilha em arquivos menores.');
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      if (!wb.SheetNames.length) throw new Error('A planilha está vazia.');
      const data: Record<string, string[][]> = {};
      for (const name of wb.SheetNames) data[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true, blankrows: true }).map((r: any) => r.map((c: any) => String(c ?? '').trim()));
      const first = wb.SheetNames.find(n => data[n].some(r => r.some(Boolean))) || wb.SheetNames[0];
      if (!data[first].some(r => r.some(Boolean))) throw new Error('Não encontramos dados no arquivo.');
      const guessed = data[first].slice(0, 20).findIndex(r => r.some(c => aliases.telefone.test(normalize(c))) && r.some(c => aliases.nome.test(normalize(c))));
      setBook(wb); setSheets(data); setSheet(first); setFilename(file.name); setList(file.name.replace(/\.[^.]+$/, '').slice(0, 100)); configure(data[first], guessed >= 0 ? guessed : 0);
    } catch (e: any) { setError(e.message || 'Não foi possível ler o arquivo. Confira o formato e tente novamente.'); }
    finally { setBusy(false); }
  }
  const rows = useMemo(() => {
    const seen = new Set(existing.map(n => corrigirTelefoneLead(n).numero).filter(Boolean));
    return matrix.slice(header + 1).map((cells, i) => ({ cells, line: header + i + 2 })).filter(r => r.cells.some(Boolean)).map(({ cells, line }) => {
      const value = Object.fromEntries(fields.map(f => [f, edits[line]?.[f] ?? (mapping[f] >= 0 ? cells[mapping[f]] || '' : '')])) as Row;
      const correcao = corrigirTelefoneLead(value.telefone, dddPadrao);
      const number = correcao.numero;
      let status = 'Pronto';
      if (excluded.includes(line)) status = 'Ignorado';
      else if (!value.nome.trim() || value.nome.trim().length > 200) status = 'Confira o nome';
      else if (!number) status = 'Confira o telefone / DDD';
      else if (value.email.length > 254 || value.empresa.length > 200) status = 'Texto muito longo';
      else if (seen.has(number)) status = 'Duplicado';
      else seen.add(number);
      return { line, value, number, status, correcao };
    });
  }, [matrix, header, mapping, edits, excluded, existing, dddPadrao]);
  const ready = rows.filter(r => r.status === 'Pronto');
  const invalid = rows.filter(r => r.status.startsWith('Confira') || r.status === 'Texto muito longo').length;
  const duplicates = rows.filter(r => r.status === 'Duplicado').length;
  const corrigidos = ready.filter(r => r.correcao.corrigido).length;
  async function commit() {
    setError(''); setBusy(true);
    try {
      const result = await api.post('/superadmin/leads/importar', { lista: list.trim(), contatos: ready.map(r => ({ ...r.value, nome: r.value.nome.trim(), telefone: r.number })) });
      onComplete({ ...result.data, duplicados: result.data.duplicados + duplicates, invalidos: result.data.invalidos + invalid });
    } catch (e: any) { const msg = e?.response?.data?.message; setError(Array.isArray(msg) ? msg.join(' · ') : msg || (e?.response?.status === 413 ? 'Arquivo muito grande para o servidor. Divida a lista.' : 'Não foi possível importar. Confira sua conexão e tente novamente.')); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Importar e revisar planilha" className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl">
    <header className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-start gap-4"><div><h2 className="text-xl font-semibold">Importar e conferir contatos</h2><p className="text-sm text-[var(--text-muted)] mt-1">Escolha a planilha, identifique as colunas e revise os dados. Nenhuma mensagem será enviada.</p></div><button disabled={busy} onClick={onClose} aria-label="Fechar importação"><X size={20} /></button></header>
    <div className="p-5 space-y-5 overflow-y-auto">
      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 p-3 text-sm">{error}</div>}
      <label htmlFor="leads-planilha" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void read(e.dataTransfer.files[0]); }} className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-[var(--border-subtle)] rounded-xl cursor-pointer hover:border-orange-500 transition-colors">
        <Upload size={25} /><span className="font-medium">{busy ? 'Processando…' : 'Clique aqui para escolher ou arraste sua planilha'}</span><span className="text-xs text-[var(--text-muted)]">Excel (.xlsx, .xls) ou CSV · Até 5 MB · Até 5.000 contatos</span>{filename && book && <span className="text-sm flex items-center gap-2"><FileSpreadsheet size={16} />{filename}</span>}
      </label><input id="leads-planilha" type="file" className="sr-only" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => { void read(e.target.files?.[0]); e.target.value = ''; }} />
      {book && <>
        <div className="grid md:grid-cols-3 gap-3"><label className="text-sm">Nome da lista<input className={input + ' mt-1'} value={list} maxLength={100} onChange={e => setList(e.target.value)} /></label><label className="text-sm">Aba da planilha<select className={input + ' mt-1'} value={sheet} onChange={e => { setSheet(e.target.value); configure(sheets[e.target.value], 0); }}>{book.SheetNames.map(n => <option key={n}>{n}</option>)}</select></label><label className="text-sm">Linha com os títulos<select className={input + ' mt-1'} value={header} onChange={e => configure(matrix, Number(e.target.value))}>{matrix.slice(0, 20).map((_, i) => <option key={i} value={i}>Linha {i + 1}</option>)}</select></label></div>
        <div><h3 className="font-medium mb-2">Qual coluna corresponde a cada informação?</h3><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{fields.map(f => <label key={f} className="text-xs">{labels[f]}<select aria-label={'Coluna de ' + f} className={input + ' mt-1'} value={mapping[f]} onChange={e => { setMapping(m => ({ ...m, [f]: Number(e.target.value) })); setEdits({}); setPage(0); }}><option value={-1}>{f === 'nome' || f === 'telefone' ? 'Selecione uma coluna' : 'Não importar'}</option>{headers.map((h, i) => <option key={i} value={i}>{h || 'Sem título'} (coluna {i + 1})</option>)}</select></label>)}</div></div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2"><h3 className="font-medium">Correção automática dos telefones</h3><p className="text-xs text-[var(--text-muted)]">O sistema adiciona +55 quando o número tem DDD, limpa a formatação e corrige prefixos 0 e 0055. Para números sem DDD, informe o DDD da lista abaixo. Nenhum dígito ausente será inventado.</p><label className="block text-sm max-w-xs">DDD para números que vieram sem DDD (opcional)<input aria-label="DDD padrão para correção automática" inputMode="numeric" maxLength={2} placeholder="Ex.: 11" className={input + ' mt-1'} value={dddPadrao} onChange={e => setDddPadrao(e.target.value.replace(/\D/g, ''))} /></label></div>
        <div className="flex flex-wrap gap-3 text-sm"><span>{rows.length} linhas</span><span className="text-emerald-500">{ready.length} prontos para importar</span><span className="text-emerald-500">{corrigidos} corrigidos automaticamente</span><span className="text-amber-500">{invalid} para conferir</span><span className="text-[var(--text-muted)]">{duplicates} duplicados ignorados</span></div>
        {rows.length > 5000 && <p role="alert" className="text-red-400 text-sm">A aba tem mais de 5.000 contatos. Divida a lista antes de importar.</p>}
        <p className="text-xs text-[var(--text-muted)]">Abaixo de cada telefone aparece o número corrigido que será importado. Você pode editar os dados ou desmarcar uma linha. Duplicados e linhas sem dados suficientes continuam sinalizados.</p>
        <div className="overflow-auto max-h-[340px] border border-[var(--border-subtle)] rounded-lg"><table className="w-full text-xs min-w-[830px]"><thead className="sticky top-0 bg-[var(--bg-card)] text-left"><tr><th className="p-2">Incluir</th><th className="p-2">Linha</th>{fields.map(f => <th className="p-2" key={f}>{labels[f]}</th>)}<th className="p-2">Conferência</th></tr></thead><tbody>{rows.slice(page * 50, page * 50 + 50).map(r => <tr key={r.line} className="border-t border-[var(--border-subtle)]"><td className="p-2"><input type="checkbox" aria-label={'Incluir linha ' + r.line} checked={!excluded.includes(r.line)} onChange={e => setExcluded(s => e.target.checked ? s.filter(n => n !== r.line) : [...s, r.line])} /></td><td className="p-2">{r.line}</td>{fields.map(f => <td className="p-1" key={f}><input aria-label={`${f} da linha ${r.line}`} className={input + ' min-w-[140px]'} value={r.value[f]} onChange={e => setEdits(s => ({ ...s, [r.line]: { ...s[r.line], [f]: e.target.value } }))} />{f === 'telefone' && r.correcao.numero && <p className="text-[10px] text-emerald-500 px-2 py-1">{r.correcao.corrigido ? 'Corrigido: ' : 'Número: '}{r.correcao.exibicao}</p>}</td>)}<td className={'p-2 whitespace-nowrap ' + (r.status === 'Pronto' ? 'text-emerald-500' : 'text-amber-500')}>{r.status === 'Pronto' && r.correcao.corrigido ? 'Pronto · corrigido' : r.status}</td></tr>)}</tbody></table></div>
        {rows.length > 50 && <div className="flex justify-end items-center gap-3 text-sm"><button className={button} disabled={!page} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(rows.length / 50)}</span><button className={button} disabled={(page + 1) * 50 >= rows.length} onClick={() => setPage(p => p + 1)}>Próxima</button></div>}
      </>}
    </div>
    <footer className="p-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-[var(--text-muted)]">Os contatos entrarão em revisão. Você decide quando liberá-los para campanhas.</span><div className="flex gap-2"><button className={button} disabled={busy} onClick={onClose}>Cancelar</button><button className={button + ' bg-orange-500 text-white border-orange-500'} disabled={busy || !list.trim() || !ready.length || rows.length > 5000 || mapping.nome < 0 || mapping.telefone < 0} onClick={() => void commit()}>{busy ? 'Processando…' : `Importar ${ready.length} contatos para revisão`}<ArrowRight size={16} /></button></div></footer>
  </section></div>;
}
