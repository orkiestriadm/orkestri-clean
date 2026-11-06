import { AlertScheduler } from './alert.scheduler';

const NOW = new Date('2026-10-28T18:20:00Z');
const event = (minutes: number, organizationId = 'org-new', id = 'event-fixture') => ({
  id, organizationId, userId: 'user-' + id, titulo: 'Compromisso Fixture',
  inicio: new Date(NOW.getTime() + minutes * 60000), confirmado: true, externalCancelled: false,
  user: { email: 'fixture@example.invalid', profile: { whatsapp: 'fixture-phone-' + id } },
});
const rule = (organizationId: string, minutos: number, ativo = true) => ({
  id: `${organizationId}-${minutos}`, organizationId, minutos, ativo, emoji: 'Fixture',
  titulo: 'Regra exclusiva', mensagem: 'Regra exclusiva de ' + organizationId + ': {evento} às {horario}',
});
function setup(rules: any[], events: any[]) {
  const prisma: any = {
    alertConfig: { findMany: jest.fn(async (args?: any) => args?.where?.ativo ? rules.filter(r => r.ativo) : rules) },
    event: { findMany: jest.fn(async ({ where }: any) => events.filter(e => e.inicio >= where.inicio.gte && e.inicio <= where.inicio.lte)) },
    notification: { create: jest.fn(async () => ({})) },
  };
  const wa: any = { resolveInstance: jest.fn(async () => 'isolated-instance'), sendMessage: jest.fn(async () => true) };
  const alerts: any = { prepararEnvio: jest.fn(async () => 'E-FIXTURE'), registrarEnvio: jest.fn(async () => {}), mensagemAgora: jest.fn(() => 'Seu compromisso acontece agora') };
  const scheduler = new AlertScheduler(prisma, wa, { get: () => 'https://example.invalid' } as any, {} as any, alerts);
  // Other scheduled business checks are outside the calendar reminder under test.
  (scheduler as any).runSlaCheck = jest.fn(async () => {});
  (scheduler as any).runOrcamentoAlertCheck = jest.fn(async () => {});
  return { prisma, wa, alerts, scheduler };
}
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('Lembretes da agenda isolados por organização', () => {
  it('avisa a organização nova mesmo quando outra organização já possui regras', async () => {
    const s = setup([rule('org-other', 60)], [event(60)]);
    await s.scheduler.run();
    expect(s.wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(s.wa.sendMessage.mock.calls[0][1]).not.toContain('org-other');
    expect(s.alerts.prepararEnvio).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-new' }), 60, 'isolated-instance');
    expect(s.prisma.notification.create).toHaveBeenCalledTimes(1);
  });
  it('a janela de busca inclui o aviso padrão de uma hora quando outras regras têm só 15 minutos', async () => {
    const s = setup([rule('org-other', 15)], [event(60)]);
    await s.scheduler.run();
    expect(s.prisma.event.findMany.mock.calls[0][0].where.inicio.lte.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 60 * 60000);
    expect(s.wa.sendMessage).toHaveBeenCalledTimes(1);
  });
  it('respeita todas as regras desativadas sem reativar os padrões', async () => {
    const s = setup([rule('org-new', 60, false), rule('org-new', 15, false)], [event(60)]);
    await s.scheduler.run();
    expect(s.wa.sendMessage).not.toHaveBeenCalled();
    expect(s.alerts.prepararEnvio).not.toHaveBeenCalled();
  });
  it('usa o texto da própria organização sem misturar regras de outra', async () => {
    const s = setup([rule('org-new', 60), rule('org-other', 60)], [event(60)]);
    await s.scheduler.run();
    expect(s.wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(s.wa.sendMessage.mock.calls[0][1]).toContain('org-new');
    expect(s.wa.sendMessage.mock.calls[0][1]).not.toContain('org-other');
  });
  it('não adiciona aviso de 60 minutos quando a organização configurou somente 15', async () => {
    const s = setup([rule('org-new', 15)], [event(60)]);
    await s.scheduler.run(); expect(s.wa.sendMessage).not.toHaveBeenCalled();
  });
  it('separa a organização desativada de outra que ainda usa os padrões', async () => {
    const s = setup([rule('org-disabled', 60, false)], [event(60, 'org-disabled', 'disabled'), event(60, 'org-new', 'new')]);
    await s.scheduler.run();
    expect(s.wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(s.wa.sendMessage.mock.calls[0][0]).toBe('fixture-phone-new');
  });
  it.each([60, 15, 5, 0])('mantém o aviso padrão de %s minutos quando não há configuração própria', async minutes => {
    const s = setup([], [event(minutes)]); await s.scheduler.run();
    expect(s.wa.sendMessage).toHaveBeenCalledTimes(1);
    expect(s.alerts.prepararEnvio).toHaveBeenCalledWith(expect.anything(), minutes, 'isolated-instance');
    expect(s.alerts.registrarEnvio).toHaveBeenCalledWith(expect.anything(), minutes, true);
  });
  it('não repete o aviso já reservado no recibo durável', async () => {
    const s = setup([], [event(60)]); s.alerts.prepararEnvio.mockResolvedValue(null);
    await s.scheduler.run(); expect(s.wa.sendMessage).not.toHaveBeenCalled();
  });
});
