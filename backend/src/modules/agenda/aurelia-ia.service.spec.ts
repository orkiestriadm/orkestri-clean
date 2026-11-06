import { AureliaIaService, dadosAgendaIa, duracaoIa, horaIa, validarExtracaoAgenda } from './aurelia-ia.service';

const empty = { acao: 'criar', titulo: '', dia: '', hora: '', duracao: '' } as const;
describe('Agenda IA: dados não confiáveis', () => {
  it('interpreta horários por extenso somente com período explícito', () => {
    expect(horaIa('duas da tarde')).toBe('14:00');
    expect(horaIa('às nove e meia da manhã')).toBe('09:30');
    expect(horaIa('oito da noite')).toBe('20:00');
    expect(horaIa('meio-dia')).toBe('12:00');
    expect(horaIa('duas')).toBeNull();
    expect(horaIa('25 da tarde')).toBeNull();
  });
  it('rejeita datas inventadas e ações fora da lista', () => {
    expect(validarExtracaoAgenda({ ...empty, dia: '2023-04-01' }, 'dentista amanhã')).toBeNull();
    expect(validarExtracaoAgenda({ ...empty, acao: 'excluir' }, 'excluir')).toBeNull();
    expect(validarExtracaoAgenda({ ...empty, userId: 'outro' }, 'oi')).toBeNull();
    expect(validarExtracaoAgenda({ ...empty, hora: null }, 'oi')).toBeNull();
    expect(validarExtracaoAgenda({ ...empty, hora: '2h' }, 'dentista às 12h')).toBeNull();
    expect(validarExtracaoAgenda({ ...empty, hora: '14h' }, 'dentista às duas da tarde')).toBeNull();
  });
  it('restaura acentos e caixa somente quando o trecho existe na mensagem', () => {
    expect(validarExtracaoAgenda({ ...empty, titulo: 'reuniao', dia: 'amanha' }, '📅 Marque REUNIÃO amanhã')?.dia).toBe('amanhã');
    expect(validarExtracaoAgenda({ ...empty, titulo: 'reuniao' }, '📅 Marque REUNIÃO amanhã')?.titulo).toBe('REUNIÃO');
  });
  it('aceita apenas trechos copiados e não preenche informações ausentes', () => {
    const v = validarExtracaoAgenda({ ...empty, titulo: 'reunião' }, 'Quero agendar uma reunião');
    expect(v).not.toBeNull();
    expect(dadosAgendaIa(v)).toEqual({ ia: true, acao: 'evento.criar', titulo: 'reunião' });
  });
  it('calcula amanhã no fuso de São Paulo, com duração explícita', () => {
    expect(dadosAgendaIa({ ...empty, dia: 'amanhã', hora: '14h', duracao: 'uma hora' }, new Date('2026-11-05T15:00:00Z')))
      .toMatchObject({ quando: '2026-11-06T17:00:00.000Z', duracao: 60 });
  });
  it('não converte data impossível ou horário passado em compromisso', () => {
    const now = new Date('2026-11-05T18:00:00Z');
    expect(dadosAgendaIa({ ...empty, dia: '31/02', hora: '25h' }, now).quando).toBeUndefined();
    expect(dadosAgendaIa({ ...empty, dia: 'hoje', hora: '14h' }, now).quando).toBeUndefined();
    expect(duracaoIa('9999 minutos')).toBeUndefined();
  });
  it('preserva data parcial para perguntar somente a informação que falta', () => {
    expect(dadosAgendaIa({ ...empty, dia: 'amanhã' }, new Date('2026-11-05T15:00:00Z')).quandoParcial).toEqual({ dia: '2026-11-06' });
  });
});

describe('Cliente Ollama: limites e fallback', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });
  it('fica desligado por padrão e não envia mensagens ao modelo', async () => {
    delete process.env.AURELIA_IA_ENABLED;
    global.fetch = jest.fn();
    expect(await new AureliaIaService().extrair('dentista')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('não permite mais de uma inferência simultânea; falha volta ao fluxo atual', async () => {
    process.env.AURELIA_IA_ENABLED = 'true'; process.env.AURELIA_IA_URL = 'http://127.0.0.1:11435';
    let release: (v: any) => void;
    global.fetch = jest.fn().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const service = new AureliaIaService();
    const first = service.extrair('dentista');
    expect(await service.extrair('reunião')).toBeNull();
    release({ ok: false });
    expect(await first).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).think).toBe(false);
  });
});
