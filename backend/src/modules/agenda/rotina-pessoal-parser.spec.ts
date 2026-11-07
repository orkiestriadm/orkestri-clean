import { interpretarLembrete } from './rotina-pessoal-parser';
describe('Lembretes rápidos', () => {
  const agora = new Date('2026-11-07T15:00:00Z');
  it('agenda água daqui 15m sem pedir confirmação', () => {
    expect(interpretarLembrete('Me lembre de beber agua daqui 15m!', agora)).toEqual({titulo:'beber agua', quando:new Date('2026-11-07T15:15:00Z'),padrao:false});
  });
  it('usa manhã de Brasília e preserva a descrição', () => {
    expect(interpretarLembrete('Me lembre amanhã pela manhã de marcar uma consulta!', agora)).toEqual({titulo:'marcar uma consulta',quando:new Date('2026-11-08T12:00:00Z'),padrao:true});
  });
  it('aplica a preferência de horário', () => {
    expect(interpretarLembrete('Me lembre amanhã pela manhã de caminhar',agora,'07:30')?.quando).toEqual(new Date('2026-11-08T10:30:00Z'));
  });
  it.each(['Me lembre de água daqui 0m','Me lembre hoje às 09h de caminhar','Me lembre dia 31/02/2027 às 12h de caminhar','Me lembre de caminhar'])('não inventa horário ou aceita data inválida: %s', texto => {
    expect(interpretarLembrete(texto,agora)).toBeNull();
  });
});
