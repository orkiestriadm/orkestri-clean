export const ORIGEM_CONVITE_AGENDA = 'CONVITE_AGENDA_7_DIAS';
export const ORIGEM_CONVITE_GRATUITO = 'CONVITE_GRATUITO';
export const COMANDO_CONVITE_AGENDA = 'CADASTRO';
export function conviteComOpcoes(texto = '') {
  const t = texto.replace(/\*/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
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
export function modelosConviteAgenda() {
  const l = linksConviteAgenda();
  return [
    { nome: 'Convite • cadastro gratuito no Orkiestri', texto: 'Olá, {nome}! 👋 *Que tal receber seus compromissos e lembretes no WhatsApp que você já usa todos os dias?*\n\nSou a *Aurélia*, assistente do *Orkiestri*. Eu te ajudo a organizar a rotina e lembrar do que importa: reuniões, consultas e aqueles compromissos que não podem passar despercebidos. 📅\n\nQuero te convidar para conhecer o Orkiestri. *O cadastro e o acesso nesta fase são gratuitos, sem cartão.* Você se cadastra aqui mesmo, conversando comigo, e eu te ajudo a agendar seu primeiro compromisso.\n\n*Vamos começar? É gratuito!*\n\n*1* — Quero me cadastrar e experimentar\n*2* — Não tenho interesse. Encerrar convite\n\nAo responder *1*, vou pedir seus dados, uma informação por vez. Se as condições de acesso mudarem, você será avisado com antecedência.\n\nConheça o Orkiestri: https://www.orkiestri.com' },
    { nome: 'Orientação • primeiro acesso ao Orkiestri', texto: `Olá, {nome}! Se ainda não criou sua conta, envie *CADASTRO* aqui nesta conversa. A Aurélia fará seu cadastro no Orkiestri pelo WhatsApp.\n\nSe já concluiu o cadastro e quiser usar também o site, defina sua senha em ${l.senha}. Escolha o código por WhatsApp e informe o mesmo número usado no cadastro.\n\nDepois, entre com seu e-mail e a senha que criou: ${l.login}\nPara começar por aqui, envie *começar* à Aurélia.` },
    { nome: 'Acompanhamento • primeiro compromisso', texto: `Olá, {nome}! Vamos usar sua agenda do Orkiestri? Na conversa com a Aurélia, envie *começar*, escolha *1 — compromisso*, informe o título, o dia e o horário e confirme a prévia.\n\nPara consultar o que marcou, envie *compromissos*. Pelo site: ${l.agenda}\n\nSe precisar receber novamente as instruções de acesso, envie *acesso* à Aurélia.` },
    { nome: 'Conversão • continuar após o teste', texto: 'Olá, {nome}! Como foi seu teste da agenda do Orkiestri? Quer continuar organizando seus compromissos com a Aurélia? Responda para conhecer as condições do plano e receber orientação para contratar. Nenhuma contratação é feita por esta mensagem.' },
    { nome: 'Novidades e promoções', texto: 'Olá, {nome}! Temos novidades no Orkiestri: [descreva a função ou promoção e suas condições]. Quer saber como aproveitar?' },
  ];
}
export function mensagemInicioTesteAgenda(user: any) {
  if (!user?.isTrial || user.trialModulo !== 'one-space' || user.assinaturaEm) return null;
  const l = linksConviteAgenda();
  if (testeAgendaExpirado(user)) return `Seu teste de 7 dias da agenda terminou. Seus dados foram preservados. Fale com nossa equipe por aqui para conhecer as condições de continuidade. Acesso: ${l.login}`;
  const condicao = user.trialExpiraEm
    ? `Seu teste grátis vai até *${new Date(user.trialExpiraEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}* (horário de Brasília).`
    : 'Seu acesso nesta fase é gratuito. Se as condições mudarem, você será avisado com antecedência.';
  return `✅ *Sua agenda está pronta, ${user.nome.split(/\s+/)[0]}!*\nSou a *Aurélia* e vou te ajudar a começar.\n\nPara usar pelo WhatsApp, envie *menu* e escolha *Meus compromissos*. Eu pergunto as informações, uma de cada vez.\n\n${condicao}\n\nQuer usar também o site? Crie sua senha em ${l.senha}, escolhendo receber o código no seu WhatsApp. Depois, entre em ${l.login} com o e-mail *${user.email}*. Não envie sua senha nesta conversa.\n\nPara rever estas orientações, envie *acesso*.`;
}
