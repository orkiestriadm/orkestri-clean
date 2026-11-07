"use client";
import { useEffect, useState } from 'react';
import { Check, Plus, Flame, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';

type Habito = { id:string; titulo:string; dias:number; inicio:string; cor:string; arquivado:boolean; checkins:{dia:string}[] };
const novo = { titulo:'', dias:30, cor:'#f97316', inicio:'' };
const dia = (s:string,n:number) => { const d=new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const input='block w-full mt-2 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-card)] p-3';
export default function Habitos() {
 const [itens,setItens]=useState<Habito[]>([]),[hoje,setHoje]=useState(''),[loading,setLoading]=useState(true);
 const [form,setForm]=useState(novo),[editor,setEditor]=useState<string|null>(null),[busy,setBusy]=useState(false),[erro,setErro]=useState(''),[arquivados,setArquivados]=useState(false);
 const carregar=async()=>{const {data}=await api.get('/rotina-pessoal/habitos');setItens(data.itens);setHoje(data.hoje);};
 useEffect(()=>{carregar().catch(()=>setErro('Não consegui carregar seus hábitos.')).finally(()=>setLoading(false));},[]);
 async function executar(fn:()=>Promise<any>){setBusy(true);setErro('');try{await fn();await carregar();}catch(e:any){setErro(e.response?.data?.message||'Não foi possível concluir. Tente novamente.');}finally{setBusy(false);}}
 function editar(h?:Habito){setForm(h?{titulo:h.titulo,dias:h.dias,cor:h.cor,inicio:h.inicio}:{...novo,inicio:hoje});setEditor(h?.id||'novo');}
 return <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
  <header className="flex flex-wrap justify-between gap-4"><div><p className="text-orange-500 flex gap-2 items-center text-sm"><Flame size={18}/> UM DIA DE CADA VEZ</p><h1 className="text-3xl font-semibold mt-2">Meus hábitos</h1><p className="text-[var(--text-secondary)] mt-2">Pequenos passos, progresso de verdade. Um check-in por dia.</p></div><button disabled={busy||loading} onClick={()=>editar()} className="self-center flex gap-2 rounded-xl bg-orange-500 text-white px-5 py-3 disabled:opacity-50"><Plus size={18}/> Novo hábito</button></header>
  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 text-sm">Pelo WhatsApp: <strong>Faça check-in no hábito “Academia”</strong>.<p className="mt-2 text-[var(--text-secondary)]">Para criar: “Crie um hábito Academia por 30 dias”. Horários de Brasília.</p></div>
  {erro&&<p role="alert" className="text-red-500">{erro}</p>}
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arquivados} onChange={e=>setArquivados(e.target.checked)}/> Mostrar arquivados</label>
  {loading?<p role="status">Carregando…</p>:<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{itens.filter(h=>h.arquivado===arquivados).map(h=>{
   const feito=h.checkins.some(c=>c.dia===hoje),acabou=hoje>=dia(h.inicio,h.dias),futuro=hoje<h.inicio;
   return <article key={h.id} className="rounded-2xl border border-[var(--border-medium)] bg-[var(--bg-card)] p-6" style={{borderTop:`3px solid ${h.cor}`}}>
    <div className="flex justify-between gap-2"><h2 className="font-semibold text-xl break-words">{h.titulo}</h2><button disabled={busy} onClick={()=>editar(h)} aria-label={`Editar ${h.titulo}`} className="p-2"><Settings2 size={18}/></button></div>
    <p className="text-sm mt-4">{h.checkins.length} de {h.dias} dias · {Math.round(h.checkins.length/h.dias*100)}%</p>
    <div className="h-2 rounded-full bg-orange-500/10 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{width:`${h.checkins.length/h.dias*100}%`,background:h.cor}}/></div>
    <div className="grid grid-cols-7 gap-2 my-5 max-h-72 overflow-auto">{Array.from({length:h.dias},(_,i)=>{const d=dia(h.inicio,i),ok=h.checkins.some(c=>c.dia===d);return <span key={d} title={`${d.split('-').reverse().join('/')}: ${ok?'feito':'não marcado'}`} aria-label={`Dia ${i+1}: ${ok?'feito':'não marcado'}`} className="aspect-square rounded-lg flex items-center justify-center text-xs border border-[var(--border-medium)]" style={ok?{background:h.cor,color:'#fff'}:d===hoje?{borderColor:h.cor}:{}}>{ok?<Check size={16}/>:i+1}</span>;})}</div>
    {!h.arquivado&&<button disabled={busy||acabou||futuro} onClick={()=>executar(()=>api.post(`/rotina-pessoal/habitos/${h.id}/${feito?'desfazer':'checkin'}`))} className="w-full rounded-xl py-3 font-medium border disabled:opacity-50" style={{borderColor:h.cor,background:feito?'transparent':h.cor,color:feito?'inherit':'white'}}>{acabou?'Ciclo encerrado':futuro?'Começa em '+h.inicio.split('-').reverse().join('/'):feito?'✓ Hoje feito · desfazer':'Fazer check-in de hoje'}</button>}
    <button disabled={busy} onClick={()=>executar(()=>api.post(`/rotina-pessoal/habitos/${h.id}/arquivo`,{arquivado:!h.arquivado}))} className="mt-4 text-sm text-[var(--text-secondary)]">{h.arquivado?'Reativar card':'Arquivar card'}</button>
   </article>;
  })}</div>}
  {!loading&&!itens.some(h=>h.arquivado===arquivados)&&<div className="text-center rounded-2xl border border-dashed border-[var(--border-medium)] p-12"><Flame className="mx-auto text-orange-500 mb-4" size={36}/><h2 className="text-xl">Seu próximo hábito começa aqui</h2><p className="text-[var(--text-secondary)] mt-2">Academia, leitura ou uma caminhada. Crie seu primeiro card.</p></div>}
  {editor&&<div role="dialog" aria-modal="true" aria-labelledby="habito-title" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><form onSubmit={e=>{e.preventDefault();executar(async()=>{await(editor==='novo'?api.post('/rotina-pessoal/habitos',form):api.put('/rotina-pessoal/habitos/'+editor,form));setEditor(null);});}} className="bg-[var(--bg-card)] rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-auto space-y-4"><h2 id="habito-title" className="text-xl font-semibold">{editor==='novo'?'Novo hábito':'Configurar hábito'}</h2><label className="block text-sm">Nome<input autoFocus required maxLength={80} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} className={input} placeholder="Academia"/></label><label className="block text-sm">Duração em dias<input required type="number" min={1} max={366} value={form.dias} onChange={e=>setForm({...form,dias:+e.target.value})} className={input}/></label><label className="block text-sm">Começa em<input required type="date" value={form.inicio} onChange={e=>setForm({...form,inicio:e.target.value})} className={input}/></label><label className="flex items-center justify-between text-sm">Cor do card<input type="color" value={form.cor} onChange={e=>setForm({...form,cor:e.target.value})}/></label><p className="text-xs text-[var(--text-secondary)]">Depois do primeiro check-in, a duração e a data inicial ficam preservadas.</p>{erro&&<p role="alert" className="text-red-500 text-sm">{erro}</p>}<div className="flex gap-4 justify-end"><button type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancelar</button><button disabled={busy} className="bg-orange-500 text-white px-5 py-2 rounded-lg">{busy?'Salvando…':'Salvar hábito'}</button></div></form></div>}
 </main>;
}
