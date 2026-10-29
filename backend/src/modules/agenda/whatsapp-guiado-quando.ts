import { diaCompromisso, horaCompromisso, novaDataCompromisso } from "../notifications/evento-alerta-datas";
import { diaSaoPaulo, somarDias } from "./whatsapp-rotina-datas";

export type QuandoParcial = { dia?: string; horario?: string };
const legivel = (dia: string) => dia.split("-").reverse().join("/");
export function perguntaQuando(parcial: QuandoParcial = {}, agora = new Date()): string {
  const exemplo = legivel(somarDias(diaSaoPaulo(agora), 1));
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
  const dia = diaCompromisso(texto, agora), horario = horaCompromisso(texto);
  if (!dia && !horario) return { erro: "Não reconheci essa informação. Envie uma data válida ou um horário, como *amanhã* ou *14:30*." };
  if (dia && dia < diaSaoPaulo(agora)) return { erro: "Esse dia está no passado. Envie uma data de hoje em diante." };
  const parcial = { ...anterior, ...(dia ? { dia } : {}), ...(horario ? { horario } : {}) };
  if (parcial.dia && parcial.horario) {
    const data = novaDataCompromisso(legivel(parcial.dia) + " " + parcial.horario, agora);
    if (!data) return { erro: "Esse horário já passou. Informe uma data e um horário no futuro." };
    return { valor: data.toISOString() };
  }
  return { parcial, mensagem: perguntaQuando(parcial, agora) };
}
