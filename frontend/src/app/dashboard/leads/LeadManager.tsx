"use client";
import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/layout/Topbar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Users, Upload, Send, MessageCircle, Download, X, Search, Plus, Pencil, CheckCircle2, ArrowRight, ShieldCheck, Trash2, AlertTriangle, FilterX } from 'lucide-react';
import LeadImportDialog from './LeadImportDialog';

type Mensagem = { id: string; campanha: string; texto: string; status: string; erro?: string; criadoEm: string };
type Lead = { id: string; nome: string; telefone: string; email: string; empresa: string; lista: string; etapa: string; bloqueado: boolean; revisado: boolean; arquivado: boolean; observacoes: string; proximoContato?: string | null; mensagens: Mensagem[] };
const etapas: Record<string, string> = { NOVO: 'Novo', CONVIDADO: 'Convidado', EM_TESTE: 'Em teste', EM_ACOMPANHAMENTO: 'Em acompanhamento', PAGANTE: 'Pagante', PERDIDO: 'Perdido' };
const modelosPadrao = [
  { nome: 'Convite • cadastro gratuito no Orkiestri', texto: 'Olá, {nome}! 👋 *Que tal receber seus compromissos e lembretes no WhatsApp que você já usa todos os dias?*\n\nSou a *Aurélia*, assistente do *Orkiestri*. Eu te ajudo a organizar a rotina e lembrar do que importa: reuniões, consultas e aqueles compromissos que não podem passar despercebidos. 📅\n\nQuero te convidar para conhecer o Orkiestri. *O cadastro e o acesso nesta fase são gratuitos, sem cartão.* Você se cadastra aqui mesmo, conversando comigo, e eu te ajudo a agendar seu primeiro compromisso.\n\n*Vamos começar? É gratuito!*\n\n*1* — Quero me cadastrar e experimentar\n*2* — Não tenho interesse. Encerrar convite\n\nAo responder *1*, vou pedir seus dados, uma informação por vez. Se as condições de acesso mudarem, você será avisado com antecedência.\n\nConheça o Orkiestri: https://www.orkiestri.com' },
  { nome: 'Orientação • primeiro acesso', texto: 'Olá, {nome}! Vamos começar seu teste do Orkiestri? Me responda por aqui para eu te orientar no acesso e na criação do seu login. Estou à disposição para acompanhar seus primeiros passos.' },
  { nome: 'Acompanhamento • uso do sistema', texto: 'Olá, {nome}! Como está sua experiência com o Orkiestri? Qual tarefa você gostaria de organizar hoje? Posso te mostrar como fazer no sistema.' },
  { nome: 'Conversão • plano semanal', texto: 'Olá, {nome}! Como foi seu teste do Orkiestri? Se quiser continuar, me responda para conhecer o plano semanal e receber orientação para contratar.' },
  { nome: 'Novidades e promoções', texto: 'Olá, {nome}! Temos novidades no Orkiestri: [descreva a função ou promoção e suas condições]. Quer saber como aproveitar?' },
];
const campo = 'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]';
const botao = campo + ' inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40';
const primary = botao + ' !bg-orange-500 !border-orange-500 !text-white';
const panel = 'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]';
const blank: Lead = { id: '', nome: '', telefone: '', email: '', empresa: '', lista: 'Cadastro manual', etapa: 'NOVO', bloqueado: false, revisado: false, arquivado: false, observacoes: '', proximoContato: null, mensagens: [] };
const apto = (l: Lead) => l.revisado && !l.bloqueado && !l.arquivado;
const retornoVencido = (l: Lead) => !!l.proximoContato && new Date(l.proximoContato).getTime() <= Date.now();
/**
 * As situações da base, numa estrutura só.
 *
 * Os cards do topo, o seletor de situação e o filtro da lista saem todos
 * daqui. Antes o card contava de um jeito e o filtro de outro: dava para
 * clicar em "Aguardando revisão: 272" e a lista mostrar outro número.
 */
const SITUACOES: { id: string; label: string; teste: (l: Lead) => boolean }[] = [
  { id: 'ativos',     label: 'Contatos ativos',          teste: l => !l.arquivado },
  { id: 'revisao',    label: 'Aguardando revisão',       teste: l => !l.arquivado && !l.revisado },
  { id: 'liberados',  label: 'Liberados para campanhas', teste: l => !l.arquivado && apto(l) },
  { id: 'retorno',    label: 'Retornos pendentes',       teste: l => !l.arquivado && retornoVencido(l) },
  { id: 'bloqueados', label: 'Não contatar',             teste: l => !l.arquivado && l.bloqueado },
  { id: 'arquivados', label: 'Arquivados',               teste: l => l.arquivado },
];
function dateInput(value?: string | null) { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

export default function LeadManager() {
  const { user } = useAuthStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tab, setTab] = useState<'contatos' | 'mensagens'>('contatos');
  const [busca, setBusca] = useState(''); const [etapa, setEtapa] = useState(''); const [lista, setLista] = useState(''); const [situacao, setSituacao] = useState('ativos'); const [pagina, setPagina] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modelos, setModelos] = useState(modelosPadrao);
  const [campanha, setCampanha] = useState(modelosPadrao[0].nome); const [texto, setTexto] = useState(modelosPadrao[0].texto);
  const [feedback, setFeedback] = useState(''); const [erroModal, setErroModal] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [importar, setImportar] = useState(false);
  const [detalhe, setDetalhe] = useState<Lead | null>(null); const [confirmar, setConfirmar] = useState(false);
  // Quem está na fila para sumir de vez. Guardamos os leads inteiros (e não só
  // os ids) para a confirmação poder dizer QUEM vai ser apagado — confirmar um
  // número é fácil demais quando a ação não tem volta.
  const [excluindo, setExcluindo] = useState<Lead[]>([]);
  const [acao, setAcao] = useState('LIBERAR'); const [valor, setValor] = useState('');
  const listaRef = useRef<HTMLElement>(null);
  const mensagemErro = (e: any) => { const m = e?.response?.data?.message; return Array.isArray(m) ? m.join(' · ') : String(m || e.message || 'Não foi possível concluir.'); };
  async function carregar() { try { const r = await api.get('/superadmin/leads'); setLeads(r.data); } catch (e) { setFeedback(mensagemErro(e)); } finally { setLoading(false); } }
  useEffect(() => { if (!user?.isSuperAdmin) return; void carregar(); const timer = setInterval(() => void carregar(), 10000); return () => clearInterval(timer); }, [user?.isSuperAdmin]);
  useEffect(() => {
    if (!user?.isSuperAdmin) return;
    api.get('/superadmin/leads/modelos').then(r => {
      if (!Array.isArray(r.data) || !r.data[0]?.texto) return;
      setModelos(r.data);
      setCampanha(v => v === modelosPadrao[0].nome ? r.data[0].nome : v);
      setTexto(v => v === modelosPadrao[0].texto ? r.data[0].texto : v);
    }).catch(() => setFeedback('Não foi possível carregar os modelos atualizados. Recarregue a tela antes de preparar uma campanha.'));
  }, [user?.isSuperAdmin]);
  useEffect(() => setPagina(0), [busca, lista, etapa, situacao]);
  if (!user?.isSuperAdmin) return <div className="p-8">Acesso exclusivo do Super Admin.</div>;
  const naSituacao = SITUACOES.find(s => s.id === situacao)?.teste ?? (() => true);
  const filtrados = leads.filter(l => naSituacao(l)
    && (!lista || l.lista === lista) && (!etapa || l.etapa === etapa)
    && `${l.nome} ${l.telefone} ${l.empresa} ${l.email}`.toLowerCase().includes(busca.toLowerCase()));
  const filtrando = !!busca || !!lista || !!etapa || situacao !== 'ativos';
  function limparFiltros() { setBusca(''); setLista(''); setEtapa(''); setSituacao('ativos'); }
  const selecionadosLeads = leads.filter(l => selecionados.includes(l.id)); const destinatarios = selecionadosLeads.filter(apto);
  const podeEnviar = !!destinatarios.length && destinatarios.length === selecionadosLeads.length && destinatarios.length <= 1000;
  const preview = texto.replace(/\{nome\}/g, () => destinatarios[0]?.nome || 'Maria').replace(/\{empresa\}/g, () => destinatarios[0]?.empresa || 'Sua empresa');
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / 50)); const paginaAtual = Math.min(pagina, totalPaginas - 1);
  function irParaPagina(proxima: number) { setPagina(Math.max(0, Math.min(totalPaginas - 1, proxima))); listaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function paginacao() {
    if (!filtrados.length) return null;
    return <nav aria-label="Paginação dos contatos" className="flex flex-wrap justify-between items-center gap-3 text-sm py-2"><span className="text-xs text-[var(--text-muted)]">Exibindo {paginaAtual * 50 + 1}–{Math.min((paginaAtual + 1) * 50, filtrados.length)} de {filtrados.length} contatos</span><div className="flex flex-wrap items-center gap-2"><button className={botao} disabled={!paginaAtual} onClick={() => irParaPagina(0)}>Primeira</button><button className={botao} disabled={!paginaAtual} onClick={() => irParaPagina(paginaAtual - 1)}>Anterior</button><select aria-label="Ir para página de contatos" className={campo} value={paginaAtual} onChange={e => irParaPagina(Number(e.target.value))}>{Array.from({ length: totalPaginas }, (_, i) => <option key={i} value={i}>Página {i + 1} de {totalPaginas}</option>)}</select><button className={botao} disabled={paginaAtual + 1 >= totalPaginas} onClick={() => irParaPagina(paginaAtual + 1)}>Próxima</button><button className={botao} disabled={paginaAtual + 1 >= totalPaginas} onClick={() => irParaPagina(totalPaginas - 1)}>Última</button></div></nav>;
  }
  function abrir(l: Lead) { setDetalhe({ ...l }); setErroModal(''); }
  async function salvar() {
    if (!detalhe) return; setBusy(true); setErroModal('');
    try { const { id, mensagens, ...dados } = detalhe;
      if (id) await api.patch('/superadmin/leads/' + id, { nome: dados.nome, telefone: dados.telefone, email: dados.email, empresa: dados.empresa, lista: dados.lista, etapa: dados.etapa, observacoes: dados.observacoes, proximoContato: dados.proximoContato ?? null, revisado: dados.revisado, bloqueado: dados.bloqueado, arquivado: dados.arquivado });
      else await api.post('/superadmin/leads', { nome: dados.nome, telefone: dados.telefone, email: dados.email, empresa: dados.empresa, lista: dados.lista });
      setDetalhe(null); await carregar(); setFeedback(id ? 'Contato atualizado.' : 'Contato cadastrado para revisão.');
    } catch (e) { setErroModal(mensagemErro(e)); } finally { setBusy(false); }
  }
  async function aplicarLote() {
    setBusy(true); try { const r = await api.post('/superadmin/leads/lote', { ids: selecionados, acao, valor }); await carregar(); setSelecionados([]); setFeedback(`${r.data.count} contatos atualizados. Nenhuma mensagem foi enviada.`); }
    catch (e) { setFeedback(mensagemErro(e)); } finally { setBusy(false); }
  }
  async function excluirContatos() {
    if (!excluindo.length) return; setBusy(true); setErroModal('');
    try {
      const ids = excluindo.map(l => l.id);
      const r = ids.length === 1
        ? await api.delete('/superadmin/leads/' + ids[0])
        : await api.post('/superadmin/leads/excluir', { ids });
      setExcluindo([]); setSelecionados(s => s.filter(id => !ids.includes(id))); setDetalhe(null); await carregar();
      setFeedback(`${r.data.excluidos} contato(s) excluídos de vez, com ${r.data.mensagensRemovidas} mensagem(ns) do histórico. Isso não pode ser desfeito.`);
    } catch (e) { setErroModal(mensagemErro(e)); } finally { setBusy(false); }
  }
  async function enviar() {
    if (!podeEnviar) return; setBusy(true);
    try { const r = await api.post('/superadmin/leads/enviar', { ids: destinatarios.map(l => l.id), texto, campanha }); setFeedback(`${r.data.enfileirados} mensagens na fila. Consulte o histórico dos contatos.`); setSelecionados([]); setConfirmar(false); await carregar(); }
    catch (e) { setErroModal(mensagemErro(e)); } finally { setBusy(false); }
  }
  function baixarModelo() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFFnome;telefone;email;empresa\r\nMaria Silva;11987654321;maria@exemplo.com;Empresa exemplo'], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-leads.csv'; a.click(); URL.revokeObjectURL(a.href); }
  return <><Topbar>Gestão de leads</Topbar><main aria-label="Área de gestão de leads" tabIndex={0} style={{ scrollbarGutter: 'stable' }} className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain p-4 md:p-8 space-y-5 max-w-[1600px] mx-auto text-[var(--text-primary)]">
    <header className="flex flex-wrap gap-4 justify-between items-center"><div><p className="text-xs uppercase tracking-widest text-orange-500 mb-2">Plataforma / Gestão de leads</p><h1 className="text-3xl font-semibold">Sua base de contatos, organizada</h1><p className="text-sm text-[var(--text-muted)] mt-2">Importe, confira os dados e acompanhe o relacionamento antes de iniciar uma campanha.</p></div><div className="flex gap-2 flex-wrap"><button className={botao} onClick={() => abrir(blank)}><Plus size={16} /> Novo contato</button><button className={primary} onClick={() => setImportar(true)}><Upload size={16} /> Importar planilha</button></div></header>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{SITUACOES.map(s => { const ativo = situacao === s.id; return (
      <button key={s.id} type="button" aria-pressed={ativo} onClick={() => { setSituacao(s.id); setTab('contatos'); }}
        className={panel + ' p-4 text-left transition ' + (ativo ? '!border-orange-500 bg-orange-500/5' : 'hover:border-orange-500/40')}>
        <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
        <p className={'text-3xl font-semibold mt-2 ' + (ativo ? 'text-orange-500' : '')}>{leads.filter(s.teste).length}</p>
      </button>); })}</div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">Etapa comercial:</span>
      {Object.entries(etapas).map(([k, v]) => { const ativo = etapa === k; return (
        <button key={k} type="button" aria-pressed={ativo} onClick={() => { setEtapa(ativo ? '' : k); setTab('contatos'); }}
          className={campo + ' !py-1 text-xs ' + (ativo ? '!border-orange-500 !text-orange-500' : '')}>
          {v} <strong className="ml-1">{leads.filter(l => naSituacao(l) && l.etapa === k).length}</strong>
        </button>); })}
      {filtrando && <button type="button" className={botao + ' !py-1 text-xs ml-auto'} onClick={limparFiltros}><FilterX size={13} /> Limpar filtros</button>}
    </div>
    {feedback && <div role="status" className={campo + ' border-orange-500/50 flex justify-between gap-3'}><span>{feedback}</span><button onClick={() => setFeedback('')} aria-label="Fechar aviso"><X size={16} /></button></div>}
    <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-3"><button className={tab === 'contatos' ? primary : botao} onClick={() => setTab('contatos')}><Users size={16} /> 1. Gerenciar contatos</button><button className={tab === 'mensagens' ? primary : botao} onClick={() => setTab('mensagens')}><MessageCircle size={16} /> 2. Mensagens e campanhas</button></div>
    {tab === 'contatos' ? <section ref={listaRef} className={panel + ' p-4 space-y-4'}>
      <div className="flex flex-wrap gap-2"><div className="flex items-center gap-2 flex-1 min-w-[220px]"><Search size={17} /><input aria-label="Buscar contatos" className={campo + ' w-full'} placeholder="Buscar nome, empresa, e-mail ou telefone" value={busca} onChange={e => setBusca(e.target.value)} /></div><select aria-label="Situação dos contatos" className={campo} value={situacao} onChange={e => setSituacao(e.target.value)}>{SITUACOES.map(s => <option key={s.id} value={s.id}>{s.id === 'ativos' ? 'Todos os ativos' : s.label}</option>)}</select><select aria-label="Lista" className={campo} value={lista} onChange={e => setLista(e.target.value)}><option value="">Todas as listas</option>{Array.from(new Set(leads.map(l => l.lista))).map(s => <option key={s}>{s}</option>)}</select><select aria-label="Etapa" className={campo} value={etapa} onChange={e => setEtapa(e.target.value)}><option value="">Todas as etapas</option>{Object.entries(etapas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--text-muted)]"><span>{filtrados.length} contatos encontrados · {selecionadosLeads.length} selecionados</span><div className="flex gap-3"><button onClick={() => setSelecionados(filtrados.map(l => l.id))}>Selecionar todos os filtrados</button><button onClick={() => setSelecionados([])}>Limpar seleção</button><button onClick={baixarModelo} className="flex items-center gap-1"><Download size={13} /> Modelo de planilha</button></div></div>
      {!!selecionadosLeads.length && <div className="rounded-lg bg-orange-500/5 border border-orange-500/30 p-3 flex flex-wrap items-center gap-2"><strong className="text-sm mr-2">Gerenciar {selecionadosLeads.length} contatos</strong><select aria-label="Ação em lote" className={campo} value={acao} onChange={e => { setAcao(e.target.value); setValor(e.target.value === 'ETAPA' ? 'NOVO' : ''); }}><option value="LIBERAR">Liberar após revisão</option><option value="REVISAR">Marcar para revisar</option><option value="ETAPA">Alterar etapa</option><option value="LISTA">Mover para outra lista</option><option value="BLOQUEAR">Marcar como não contatar</option><option value="DESBLOQUEAR">Remover bloqueio de contato</option><option value="ARQUIVAR">Arquivar</option><option value="RESTAURAR">Restaurar arquivados</option></select>{acao === 'ETAPA' && <select aria-label="Nova etapa" className={campo} value={valor} onChange={e => setValor(e.target.value)}>{Object.entries(etapas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}{acao === 'LISTA' && <input aria-label="Nova lista" className={campo} maxLength={100} placeholder="Nome da lista" value={valor} onChange={e => setValor(e.target.value)} />}<button className={botao} disabled={busy || (acao === 'LISTA' && !valor.trim())} onClick={() => void aplicarLote()}>Aplicar aos selecionados</button><button className={botao + ' !text-red-400 hover:!border-red-500/50'} disabled={busy} onClick={() => { setErroModal(''); setExcluindo(selecionadosLeads); }}><Trash2 size={15} /> Excluir</button><button className={primary + ' ml-auto'} onClick={() => setTab('mensagens')}><ArrowRight size={15} /> Preparar mensagem</button></div>}
      {paginacao()}<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs text-[var(--text-muted)]"><tr><th className="p-2"><input type="checkbox" aria-label="Selecionar contatos filtrados" checked={!!filtrados.length && filtrados.every(l => selecionados.includes(l.id))} onChange={e => setSelecionados(e.target.checked ? filtrados.map(l => l.id) : [])} /></th><th className="p-2">Contato</th><th className="p-2">Empresa / lista</th><th className="p-2">Etapa comercial</th><th className="p-2">Revisão e contato</th><th className="p-2">Próximo retorno</th><th className="p-2">Gerenciar</th></tr></thead><tbody>{filtrados.slice(paginaAtual * 50, paginaAtual * 50 + 50).map(l => <tr key={l.id} className="border-t border-[var(--border-subtle)]"><td className="p-2"><input type="checkbox" aria-label={'Selecionar ' + l.nome} checked={selecionados.includes(l.id)} onChange={e => setSelecionados(s => e.target.checked ? [...s, l.id] : s.filter(id => id !== l.id))} /></td><td className="p-3"><button className="font-medium text-left hover:text-orange-500" onClick={() => abrir(l)}>{l.nome}</button><p className="text-xs text-[var(--text-muted)] mt-1">{l.telefone}</p>{l.email && <p className="text-xs text-[var(--text-muted)]">{l.email}</p>}</td><td className="p-2"><p>{l.empresa || '—'}</p><p className="text-xs text-[var(--text-muted)]">{l.lista}</p></td><td className="p-2">{etapas[l.etapa]}</td><td className="p-2 text-xs"><span className={l.revisado ? 'text-emerald-500' : 'text-amber-500'}>{l.revisado ? 'Dados conferidos' : 'Aguardando revisão'}</span>{l.bloqueado && <p className="text-red-400 mt-1">Não contatar</p>}{l.arquivado && <p className="text-[var(--text-muted)] mt-1">Arquivado</p>}</td><td className="p-2 text-xs">{l.proximoContato ? new Date(l.proximoContato).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Não definido'}</td><td className="p-2"><div className="flex gap-2"><button className={botao} aria-label={'Editar ' + l.nome} onClick={() => abrir(l)}><Pencil size={14} /> Editar</button><button className={botao + ' !text-red-400 hover:!border-red-500/50'} aria-label={'Excluir ' + l.nome} onClick={() => { setErroModal(''); setExcluindo([l]); }}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
      {!filtrados.length && <div className="text-center py-14 space-y-3 text-[var(--text-muted)]"><Users className="mx-auto" size={30} /><p>{loading ? 'Carregando contatos…' : 'Nenhum contato encontrado.'}</p>{!leads.length && <><p className="text-sm">Importe sua planilha ou cadastre um contato. Você poderá revisar tudo antes de enviar.</p><button className={primary} onClick={() => setImportar(true)}><Upload size={16} /> Escolher planilha</button></>}</div>}
      {paginacao()}
    </section> : <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5">
      <section className={panel + ' p-5 space-y-4'}><h2 className="text-xl font-semibold">Preparar campanha</h2><p className="text-sm text-[var(--text-muted)]">A seleção de destinatários é feita na aba de contatos. Somente contatos revisados e liberados podem receber mensagens.</p><label className="block text-sm">Partir de um modelo<select className={campo + ' block w-full mt-1'} defaultValue="0" onChange={e => { const m = modelos[Number(e.target.value)]; setTexto(m.texto); setCampanha(m.nome); }}>{modelos.map((m, i) => <option key={m.nome} value={i}>{m.nome}</option>)}</select></label><label className="block text-sm">Nome da campanha<input maxLength={120} className={campo + ' block w-full mt-1'} value={campanha} onChange={e => setCampanha(e.target.value)} /></label><label className="block text-sm">Mensagem<textarea maxLength={4000} rows={10} className={campo + ' block w-full mt-1 resize-y'} value={texto} onChange={e => setTexto(e.target.value)} /></label><p className="text-xs text-[var(--text-muted)]">Personalize com {'{nome}'} e {'{empresa}'}. O envio usa o WhatsApp conectado à plataforma.</p><div className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-4"><p className="text-xs text-emerald-500 mb-2">Prévia • {destinatarios[0]?.nome || 'Exemplo'}</p><p className="text-sm whitespace-pre-wrap">{preview}</p></div></section>
      <aside className={panel + ' p-5 space-y-4 self-start'}><h2 className="font-semibold flex gap-2 items-center"><ShieldCheck size={18} /> Conferir destinatários</h2><p className="text-sm">{selecionadosLeads.length} selecionados · {destinatarios.length} aptos para envio</p>{selecionadosLeads.length !== destinatarios.length && <p role="alert" className="text-sm text-amber-500">Há contatos sem revisão, bloqueados ou arquivados na seleção. Ajuste a seleção ou libere os contatos antes de enviar.</p>}{!selecionadosLeads.length && <p className="text-sm text-[var(--text-muted)]">Primeiro, selecione os contatos que devem receber esta mensagem.</p>}<ul className="max-h-64 overflow-auto space-y-2 text-sm">{selecionadosLeads.map(l => <li className="border-b border-[var(--border-subtle)] pb-2" key={l.id}><p>{l.nome}</p><p className="text-xs text-[var(--text-muted)]">{l.telefone} · {apto(l) ? 'Liberado' : 'Não apto para envio'}</p></li>)}</ul><button className={botao + ' w-full'} onClick={() => setTab('contatos')}>Voltar à gestão de contatos</button><button className={primary + ' w-full'} disabled={busy || !podeEnviar || !texto.trim() || !campanha.trim()} onClick={() => { setErroModal(''); setConfirmar(true); }}><Send size={15} /> Revisar envio para {destinatarios.length}</button>{destinatarios.length > 1000 && <p className="text-xs text-amber-500">Selecione até 1.000 contatos por campanha.</p>}<p className="text-xs text-[var(--text-muted)]">Nenhum envio ocorre ao importar, editar ou liberar contatos. Você confirmará o envio na próxima etapa.</p></aside>
    </div>}
    {importar && <LeadImportDialog existing={leads.map(l => l.telefone)} onClose={() => setImportar(false)} onComplete={result => { setImportar(false); setTab('contatos'); setLista(''); setSituacao('revisao'); setSelecionados([]); setFeedback(`${result.importados} contatos importados para revisão. ${result.duplicados} duplicados ignorados; ${result.invalidos} linhas inválidas não importadas. Nenhuma mensagem foi enviada.`); void carregar(); }} />}
    {detalhe && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3"><form onSubmit={e => { e.preventDefault(); void salvar(); }} role="dialog" aria-modal="true" aria-label={detalhe.id ? 'Gerenciar contato' : 'Novo contato'} className={panel + ' w-full max-w-2xl max-h-[94vh] overflow-auto p-5 space-y-4'}><header className="flex justify-between items-center"><div><h2 className="text-xl font-semibold">{detalhe.id ? 'Gerenciar contato' : 'Novo contato'}</h2><p className="text-xs text-[var(--text-muted)] mt-1">Revise os dados e organize o relacionamento antes de enviar mensagens.</p></div><button type="button" disabled={busy} aria-label="Fechar contato" onClick={() => setDetalhe(null)}><X /></button></header>{erroModal && <p role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{erroModal}</p>}
      <div className="grid sm:grid-cols-2 gap-3">{(['nome', 'telefone', 'email', 'empresa', 'lista'] as const).map(f => <label key={f} className="text-sm">{{ nome: 'Nome *', telefone: 'WhatsApp com DDD *', email: 'E-mail', empresa: 'Empresa', lista: 'Lista *' }[f]}<input required={['nome', 'telefone', 'lista'].includes(f)} className={campo + ' block w-full mt-1'} maxLength={f === 'email' ? 254 : f === 'lista' || f === 'telefone' ? 100 : 200} value={detalhe[f]} onChange={e => setDetalhe({ ...detalhe, [f]: e.target.value })} /></label>)}{detalhe.id && <label className="text-sm">Etapa comercial<select className={campo + ' block w-full mt-1'} value={detalhe.etapa} onChange={e => setDetalhe({ ...detalhe, etapa: e.target.value })}>{Object.entries(etapas).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}</div>
      {detalhe.id && <><label className="block text-sm">Próximo retorno<input type="datetime-local" className={campo + ' block mt-1'} value={dateInput(detalhe.proximoContato)} onChange={e => setDetalhe({ ...detalhe, proximoContato: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label><label className="block text-sm">Anotações de acompanhamento<textarea rows={3} maxLength={5000} className={campo + ' block w-full mt-1'} value={detalhe.observacoes} onChange={e => setDetalhe({ ...detalhe, observacoes: e.target.value })} /></label><div className="space-y-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm"><label className="flex gap-2"><input type="checkbox" checked={detalhe.revisado} onChange={e => setDetalhe({ ...detalhe, revisado: e.target.checked })} /> Dados conferidos: liberar este contato para campanhas</label><label className="flex gap-2"><input type="checkbox" checked={detalhe.bloqueado} onChange={e => setDetalhe({ ...detalhe, bloqueado: e.target.checked })} /> Não contatar este lead</label><label className="flex gap-2"><input type="checkbox" checked={detalhe.arquivado} onChange={e => setDetalhe({ ...detalhe, arquivado: e.target.checked })} /> Arquivar contato (pode ser restaurado)</label></div></>}
      <div className="flex justify-end gap-2">{detalhe.id && <button type="button" className={botao + ' !text-red-400 hover:!border-red-500/50 mr-auto'} disabled={busy} onClick={() => { setErroModal(''); setExcluindo([detalhe]); }}><Trash2 size={15} /> Excluir contato</button>}<button type="button" className={botao} disabled={busy} onClick={() => setDetalhe(null)}>Cancelar</button><button type="submit" className={primary} disabled={busy}><CheckCircle2 size={16} />{busy ? 'Salvando…' : 'Salvar contato'}</button></div>
      {detalhe.id && <details><summary className="text-sm font-medium cursor-pointer">Histórico de mensagens ({detalhe.mensagens.length} mais recentes)</summary><div className="space-y-2 mt-3">{!detalhe.mensagens.length && <p className="text-sm text-[var(--text-muted)]">Nenhuma mensagem enviada.</p>}{detalhe.mensagens.map(m => <div key={m.id} className={campo}><p className="font-medium">{m.campanha} · {m.status}</p><p className="text-xs text-[var(--text-muted)]">{new Date(m.criadoEm).toLocaleString('pt-BR')}</p><p className="whitespace-pre-wrap mt-2">{m.texto}</p>{m.erro && <p className="text-amber-500 mt-2">{m.erro}</p>}</div>)}</div></details>}
    </form></div>}
    {confirmar && <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Confirmar campanha" className={panel + ' p-5 max-w-lg w-full space-y-4'}><h2 className="text-xl font-semibold">Confirmar envio para {destinatarios.length} contatos?</h2>{erroModal && <p role="alert" className="text-red-400">{erroModal}</p>}<p className="text-sm">Campanha: {campanha}</p><p className="whitespace-pre-wrap text-sm max-h-64 overflow-auto">{preview}</p><p className="text-xs text-[var(--text-muted)]">As mensagens entrarão na fila somente após esta confirmação. O resultado ficará no histórico dos contatos.</p><div className="flex justify-end gap-2"><button disabled={busy} className={botao} onClick={() => setConfirmar(false)}>Voltar</button><button disabled={busy || !podeEnviar} className={primary} onClick={() => void enviar()}>{busy ? 'Enfileirando…' : 'Confirmar envio'}</button></div></section></div>}
    {!!excluindo.length && <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-3"><section role="dialog" aria-modal="true" aria-label="Confirmar exclusão" className={panel + ' p-5 max-w-lg w-full space-y-4'}>
      <h2 className="text-xl font-semibold flex items-center gap-2"><AlertTriangle className="text-red-400 shrink-0" size={20} /> Excluir {excluindo.length === 1 ? 'este contato' : `${excluindo.length} contatos`} de vez?</h2>
      {erroModal && <p role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{erroModal}</p>}
      <p className="text-sm">O contato sai da base junto com todo o histórico de mensagens. <strong>Isso não pode ser desfeito.</strong></p>
      <ul className="max-h-48 overflow-auto text-sm space-y-1">{excluindo.slice(0, 8).map(l => <li key={l.id} className="border-b border-[var(--border-subtle)] pb-1">{l.nome} <span className="text-xs text-[var(--text-muted)]">· {l.telefone}{l.mensagens.length ? ` · ${l.mensagens.length} mensagem(ns)` : ''}</span></li>)}</ul>
      {excluindo.length > 8 && <p className="text-xs text-[var(--text-muted)]">…e mais {excluindo.length - 8} contato(s).</p>}
      <p className="text-xs text-[var(--text-muted)]">Para só tirar das campanhas sem perder o registro, use <strong>Arquivar</strong>: o contato some da lista e pode voltar depois.</p>
      <div className="flex justify-end gap-2"><button disabled={busy} className={botao} onClick={() => setExcluindo([])}>Cancelar</button><button disabled={busy} className={botao + ' !bg-red-500 !border-red-500 !text-white'} onClick={() => void excluirContatos()}><Trash2 size={15} /> {busy ? 'Excluindo…' : 'Excluir definitivamente'}</button></div>
    </section></div>}
  </main></>;
}
