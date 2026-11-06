import { MARCA } from "../../common/marca";
export const ORIGEM_CONVITE_AGENDA = 'CONVITE_AGENDA_7_DIAS';
export const ORIGEM_CONVITE_GRATUITO = 'CONVITE_GRATUITO';
export const COMANDO_CONVITE_AGENDA = 'CADASTRO';
export function conviteComOpcoes(texto = '') {
  const t = texto.replace(/\*/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (t.includes('quer que eu comece seu cadastro') && t.includes('nao tenho interesse')) return true;
  return /\b1\s*[-—–:.)]?\s*(?:para\s+)?(?:quero\s+)?(?:me\s+)?(?:fazer\s+(?:o\s+)?)?(?:cadastro|se cadastrar|cadastrar)\b/.test(t)
    && /\b2\s*[-—–:.)]?\s*(?:para\s+)?(?:finalizar|encerrar|nao tenho interesse[.\s—–-]*encerrar convite)\b/.test(t);
}
export function interesseConviteAgenda(texto = '') {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(cadastro agenda|testar (?:a )?agenda|teste (?:da )?agenda|experimentar (?:a )?agenda)\b/.test(t);
}
export function dadosTesteAgenda(_agora = new Date()) {
  // Apenas contas novas: não modifica prazos gravados em contas existentes.
  return { isTrial: true, trialModulo: 'one-space', trialExpiraEm: null, trialAvisadoSuporte: false };
}
export function testeAgendaExpirado(user: any, agora = new Date()) {
  return !!(user?.isTrial && user.trialModulo === 'one-space' && !user.assinaturaEm && user.trialExpiraEm && new Date(user.trialExpiraEm).getTime() <= agora.getTime());
}
export function linksConviteAgenda() {
  const app = (process.env.APP_URL || 'https://www.orkiestri.com').replace(/\/$/, '');
  const numero = (process.env.LEADS_WHATSAPP_NUMERO || '5514991661688').replace(/\D/g, '');
  return { cadastro: `https://wa.me/${numero}?text=${encodeURIComponent(COMANDO_CONVITE_AGENDA)}`, login: `${app}/login`, senha: `${app}/recuperar-senha`, agenda: `${app}/dashboard/agenda` };
}
/**
 * O convite, num lugar só.
 *
 * Chega por dois caminhos que precisam dizer a MESMA coisa: a campanha
 * disparada pelo gestor de leads (com o nome da pessoa) e o primeiro contato
 * de quem clicou em "cadastrar" no site (sem nome, porque ainda não sabemos
 * quem é). Duas cópias do texto viravam duas promessas diferentes.
 */
export function textoConvite(nome?: string) {
  const ola = nome ? `Olá, ${nome}!` : 'Olá!';
  return `${ola} Sou a Aurélia, assistente do ${MARCA}. Posso ajudar você a lembrar dos compromissos e organizar seus gastos por aqui.\n\nO cadastro e o acesso nesta fase são gratuitos, sem cartão. Se as condições mudarem, você será avisado com antecedência.\n\nQuer que eu comece seu cadastro? Pode me dizer “quero me cadastrar” ou “vamos começar”. Vou pedir uma informação por vez. Se não quiser, basta dizer “não tenho interesse”.\n\nSe preferir conhecer primeiro: https://www.orkiestri.com`;
}
/** Quem respondeu "2": agradece e deixa a porta do site aberta. */
export function textoSemInteresse() {
  return `Tudo bem, obrigada pelo seu tempo! 🧡\n\nNão vou mais te escrever sobre isso. Se um dia quiser conhecer o ${MARCA} com calma, o site está aqui:\nhttps://www.orkiestri.com\n\nE se mudar de ideia, é só me mandar *CADASTRO* nesta conversa.`;
}
export function modelosConviteAgenda() {
  const l = linksConviteAgenda();
  return [
    { nome: `Convite • cadastro gratuito no ${MARCA}`, texto: textoConvite('{nome}') },
    { nome: `Orientação • primeiro acesso ao ${MARCA}`, texto: `Olá, {nome}! Se ainda não criou sua conta, envie *CADASTRO* aqui nesta conversa. A Aurélia fará seu cadastro no ${MARCA} pelo WhatsApp.\n\nSe já concluiu o cadastro e quiser usar também o site, defina sua senha em ${l.senha}. Escolha o código por WhatsApp e informe o mesmo número usado no cadastro.\n\nDepois, entre com seu e-mail e a senha que criou: ${l.login}\nPara começar por aqui, envie *começar* à Aurélia.` },
    { nome: 'Acompanhamento • primeiro compromisso', texto: `Olá, {nome}! Me conte seu compromisso, por exemplo: “Dentista hoje às 17h”. Eu confiro os detalhes com você antes de salvar. Para visualizar sua agenda completa, abra ${l.agenda}. Se precisar de ajuda para entrar, diga acesso.` },
    { nome: 'Conversão • continuar após o teste', texto: `Olá, {nome}! Como foi seu teste da agenda do ${MARCA}? Quer continuar organizando seus compromissos com a Aurélia? Responda para conhecer as condições do plano e receber orientação para contratar. Nenhuma contratação é feita por esta mensagem.` },
    { nome: 'Novidades e promoções', texto: `Olá, {nome}! Temos novidades no ${MARCA}: [descreva a função ou promoção e suas condições]. Quer saber como aproveitar?` },
  ];
}
export function mensagemInicioTesteAgenda(user: any) {
  if (!user?.isTrial || user.trialModulo !== 'one-space' || user.assinaturaEm) return null;
  const l = linksConviteAgenda();
  if (testeAgendaExpirado(user)) return `Seu teste de 7 dias da agenda terminou. Seus dados foram preservados. Fale com nossa equipe por aqui para conhecer as condições de continuidade. Acesso: ${l.login}`;
  const condicao = user.trialExpiraEm
    ? `Seu teste grátis vai até *${new Date(user.trialExpiraEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}* (horário de Brasília).`
    : 'Seu acesso nesta fase é gratuito. Se as condições mudarem, você será avisado com antecedência.';
  return `Sua conta está pronta, ${user.nome.split(/\s+/)[0]}! Me conte seu primeiro compromisso, por exemplo: “Dentista hoje às 17h”. Para um gasto, pode escrever “lançar barrinha de cereal 12 reais no pix”. Eu confiro os detalhes antes de registrar.\n\n${condicao}\n\nPara visualizar sua rotina e usar os outros módulos com mais comodidade, abra o sistema no navegador. Crie sua senha em ${l.senha}, escolhendo receber o código no WhatsApp. Depois, entre em ${l.login} com o e-mail *${user.email}*. Não envie sua senha nesta conversa.\n\nSe precisar rever estas orientações, me diga acesso.`;
}
