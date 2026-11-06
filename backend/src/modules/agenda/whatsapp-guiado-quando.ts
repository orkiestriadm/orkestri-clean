import { diaCompromisso, novaDataCompromisso } from "../notifications/evento-alerta-datas";
import { diaSaoPaulo, somarDias } from "./whatsapp-rotina-datas";
import { horaIa } from './aurelia-ia.service';
import { horarioAmbiguo } from './whatsapp-agenda-comandos';

export type QuandoParcial = { dia?: string; horario?: string; ambiguo?: string; erro?: string };
const legivel = (dia: string) => dia.split("-").reverse().join("/");
export function perguntaQuando(parcial: QuandoParcial = {}, agora = new Date()): string {
  const exemplo = legivel(somarDias(diaSaoPaulo(agora), 1));
  if (parcial.erro) return parcial.erro + '\n' + perguntaQuando({...parcial, erro:undefined}, agora);
  if (parcial.ambiguo) return `Você disse “${parcial.ambiguo}”. É de manhã, da tarde ou da noite? Envie o horário completo, por exemplo: *duas da tarde* ou *14h*.`;
  if (parcial.dia) return "Data: *" + legivel(parcial.dia) + "*. Qual é o horário? Exemplo: *14h* ou *14:30*.";
  if (parcial.horario) return "Horário: *" + parcial.horario + "*. Qual é o dia? Exemplo: *amanhã* ou *" + exemplo + "*.";
  return "Qual é o dia e o horário? Exemplo: *amanhã às 14h*. Pode enviar a data e o horário em mensagens separadas.";
}

/** Resposta parcial só muda o rascunho da conversa, nunca cria o evento. */
export function coletarQuando(texto: string, anterior: QuandoParcial = {}, agora = new Date()): {
  valor?: string; parcial?: QuandoParcial; mensagem?: string; erro?: string;
} {
  const completa = novaDataCompromisso(texto, agora);
  if (completa) return { valor: completa.toISOString() };
  const combinado = texto.match(/^(.+?)\s+[àa]s\s+(.+)$/i);
  const diaInformado = diaCompromisso(combinado ? combinado[1] : texto, agora);
  if (diaInformado && diaInformado < diaSaoPaulo(agora)) return { erro: "Esse dia está no passado. Envie uma data de hoje em diante." };
  if (horarioAmbiguo(combinado ? combinado[2] : texto)) {
    const parcial = { ...anterior, ...(diaInformado ? {dia:diaInformado} : {}), horario: undefined, ambiguo: combinado ? combinado[2] : texto.trim() };
    delete parcial.erro;
    return { parcial, mensagem: perguntaQuando(parcial, agora) };
  }
  const periodo = texto.trim().match(/^(?:da |de |à |a )?(manhã|manha|tarde|noite)$/i);
  const horaTexto = periodo && anterior.ambiguo ? anterior.ambiguo + ' da ' + periodo[1] : combinado ? combinado[2] : texto;
  const dia = diaInformado, horario = horaIa(horaTexto);
  if (!dia && !horario) return { erro: "Não reconheci essa informação. Envie uma data válida ou um horário, como *amanhã* ou *14:30*." };
  if (dia && dia < diaSaoPaulo(agora)) return { erro: "Esse dia está no passado. Envie uma data de hoje em diante." };
  const parcial = { ...anterior, ...(dia ? { dia } : {}), ...(horario ? { horario } : {}) };
  delete parcial.erro;
  if (horario) delete parcial.ambiguo;
  if (parcial.dia && parcial.horario) {
    const data = novaDataCompromisso(legivel(parcial.dia) + " " + parcial.horario, agora);
    if (!data) return { erro: "Esse horário já passou. Informe uma data e um horário no futuro." };
    return { valor: data.toISOString() };
  }
  return { parcial, mensagem: perguntaQuando(parcial, agora) };
}
