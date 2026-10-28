export const ORIGEM_CONVITE_AGENDA = 'CONVITE_AGENDA_7_DIAS';
export const COMANDO_CONVITE_AGENDA = 'Quero fazer meu cadastro para testar a agenda por 7 dias';
export function conviteComOpcoes(texto = '') {
  const t = texto.replace(/\*/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b1\s*[-—–:.)]?\s*(?:para\s+)?(?:fazer\s+(?:o\s+)?)?(?:cadastro|se cadastrar|cadastrar)\b/.test(t)
    && /\b2\s*[-—–:.)]?\s*(?:para\s+)?(?:finalizar|encerrar)\b/.test(t);
}
export function interesseConviteAgenda(texto = '') {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(cadastro agenda|testar (?:a )?agenda|teste (?:da )?agenda|experimentar (?:a )?agenda)\b/.test(t);
}
export function dadosTesteAgenda(agora = new Date()) {
  return { isTrial: true, trialModulo: 'one-space', trialExpiraEm: new Date(agora.getTime() + 7 * 86400000), trialAvisadoSuporte: false };
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
    { nome: 'Convite • agenda por 7 dias grátis', texto: 'Olá, {nome}! 😊 Sou a *Aurélia*, do Orkiestri. Quero te convidar a testar nossa agenda por *7 dias grátis*, sem cartão e sem aprovação manual.\n\nResponda aqui nesta conversa:\n*1* — Fazer cadastro e testar o sistema\n*2* — Finalizar\n\nSe escolher *1*, vou iniciar seu cadastro por aqui e te ajudar a criar seu primeiro compromisso. Não é preciso abrir um link ou sair do WhatsApp para se cadastrar. O teste começa quando sua conta for criada.' },
    { nome: 'Orientação • primeiro acesso à agenda', texto: `Olá, {nome}! Se ainda não criou sua conta, envie *CADASTRO AGENDA* aqui nesta conversa. A Aurélia fará seu cadastro pelo WhatsApp.\n\nSe já concluiu o cadastro e quiser usar também o site, defina sua senha em ${l.senha}. Escolha o código por WhatsApp e informe o mesmo número usado no cadastro.\n\nDepois, entre com seu e-mail e a senha que criou: ${l.login}\nSua conta de teste abre a agenda. Para começar por aqui, envie *começar* à Aurélia.` },
    { nome: 'Acompanhamento • primeiro compromisso', texto: `Olá, {nome}! Vamos usar sua agenda do Orkiestri? Na conversa com a Aurélia, envie *começar*, escolha *1 — compromisso*, informe o título, o dia e o horário e confirme a prévia.\n\nPara consultar o que marcou, envie *compromissos*. Pelo site: ${l.agenda}\n\nSe precisar receber novamente as instruções de acesso, envie *acesso* à Aurélia.` },
    { nome: 'Conversão • continuar após o teste', texto: 'Olá, {nome}! Como foi seu teste da agenda do Orkiestri? Quer continuar organizando seus compromissos com a Aurélia? Responda para conhecer as condições do plano e receber orientação para contratar. Nenhuma contratação é feita por esta mensagem.' },
    { nome: 'Novidades e promoções', texto: 'Olá, {nome}! Temos novidades no Orkiestri: [descreva a função ou promoção e suas condições]. Quer saber como aproveitar?' },
  ];
}
export function mensagemInicioTesteAgenda(user: any) {
  if (!user?.isTrial || user.trialModulo !== 'one-space' || user.assinaturaEm) return null;
  const l = linksConviteAgenda();
  if (testeAgendaExpirado(user)) return `Seu teste de 7 dias da agenda terminou. Seus dados foram preservados. Fale com nossa equipe por aqui para conhecer as condições de continuidade. Acesso: ${l.login}`;
  const validade = new Date(user.trialExpiraEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  return `✅ *Sua agenda está pronta, ${user.nome.split(/\s+/)[0]}!*\nSou a *Aurélia* e vou te ajudar a começar. Seu teste grátis vai até *${validade}* (horário de Brasília).\n\n*Use agora pelo WhatsApp:* envie *começar*, escolha *1 — compromisso*, informe o título, o dia e o horário e confirme a prévia. Envie *compromissos* para consultar.\n\n*Para usar no site:*\n1. Abra ${l.senha}\n2. Escolha o código por WhatsApp e informe este mesmo número.\n3. Confira o código na página e crie sua senha. Não envie sua senha nesta conversa.\n4. Entre em ${l.login} com o e-mail *${user.email}* e sua nova senha. Sua conta abrirá a agenda.\n\nPara rever estas instruções, envie *acesso*. Para ajuda, envie *menu*.`;
}
