import { comandoAgenda } from './whatsapp-agenda-comandos';
import { dadosAgendaIa, horaIa, duracaoIa } from './aurelia-ia.service';
import { diaCompromisso } from '../notifications/evento-alerta-datas';
const exemplos = require('./fixtures/aurelia-agenda.json');
import { coletarQuando } from './whatsapp-guiado-quando';
const agora = new Date('2026-11-05T13:00:00Z');
describe('Comandos de agenda por texto e transcrição', () => {
  it.each(exemplos)('base formal/informal: $texto', (exemplo: any) => {
    const {texto,horario,...campos} = exemplo;
    expect(comandoAgenda(texto)).toMatchObject(campos);
    expect(horaIa(campos.hora)).toBe(horario);
  });
  it('interpreta data e duração por extenso', () => {
    expect(diaCompromisso('no dia vinte e seis de novembro',agora)).toBe('2026-11-26');
    expect(duracaoIa('quarenta e cinco minutos')).toBe(45);
    expect(coletarQuando('sexta',{},agora).parcial?.dia).toBe('2026-11-06');
  });
  it('não normaliza data impossível nem mistura dois compromissos', () => {
    expect(dadosAgendaIa(comandoAgenda('marque dentista dia 31 do 02 às 15h')!,agora).quandoParcial.erro).toContain('data');
    expect(comandoAgenda('marque dentista amanhã às 9h e academia às 15h')).toBeNull();
  });
  it.each([
    ['Aurélia, anota aí pra mim, academia amanhã às 15.', 'academia','amanhã','15'],
    ['Aurélio. Anota aí pra mim: pegar táxi amanhã às 12.', 'pegar táxi','amanhã','12'],
    ['AURELIO, ANOTA AI PARA MIM: reunião às 15h30', 'reunião','','15h30'],
    ['Aurélio, anota aí pra mim: dentista duas horas', 'dentista','','duas horas'],
    ['marque academia amanhã às quatro horas', 'academia','amanhã','quatro horas'],
    ['marque cardiologista dia 26 do 11 às 15h30', 'cardiologista','dia 26 do 11','15h30'],
    ['dentista hoje às quatro horas', 'dentista','hoje','quatro horas'],
    ['Marque consulta sexta às duas da tarde', 'consulta','sexta','duas da tarde'],
    ['marca, academia, amanhã, às quatro e trinta.', 'academia','amanhã','quatro e trinta'],
    ['Marque uma reunião de teste amanhã às duas da tarde por meia hora','uma reunião de teste','amanhã','duas da tarde'],
  ])('extrai sem perder título: %s', (texto,titulo,dia,hora) => {
    expect(comandoAgenda(texto)).toMatchObject({acao:'criar',titulo,dia,hora});
  });
  it('converte data falada e não inventa dia para pedido só com hora', () => {
    expect(dadosAgendaIa(comandoAgenda('marque cardiologista dia 26 do 11 às 15h30')!,agora).quando).toBe('2026-11-26T18:30:00.000Z');
    expect(dadosAgendaIa(comandoAgenda('Aurélio, anota aí pra mim: reunião às 15h30')!,agora).quandoParcial).toEqual({horario:'15:30'});
  });
  it('esclarece período sem supor quatro da tarde e mantém a data', () => {
    const d=dadosAgendaIa(comandoAgenda('marque academia amanhã às quatro horas')!,agora);
    expect(d.quando).toBeUndefined();
    expect(d.quandoParcial).toEqual({dia:'2026-11-06',ambiguo:'quatro horas'});
    expect(coletarQuando('da tarde',d.quandoParcial,agora).valor).toBe('2026-11-06T19:00:00.000Z');
    expect(coletarQuando('duas da tarde',{dia:'2026-11-06'},agora).valor).toBe('2026-11-06T17:00:00.000Z');
    expect(coletarQuando('amanhã às duas da tarde',{},agora).valor).toBe('2026-11-06T17:00:00.000Z');
    const parcial = coletarQuando('amanhã às quatro horas',{},agora).parcial;
    expect(parcial).toMatchObject({dia:'2026-11-06',ambiguo:'quatro horas'});
    expect(coletarQuando('da tarde',parcial,agora).valor).toBe('2026-11-06T19:00:00.000Z');
  });
  it.each(['cancelar','apagar dentista amanhã','gastei 50 reais','tenho que comprar pão amanhã','anota: comprar pão','Aurélio, exclua a reunião'])('não transforma outra ação em compromisso: %s', t=>expect(comandoAgenda(t)).toBeNull());
});
