import { AlertScheduler } from "./alert.scheduler";

/**
 * A passada do agendador varre agenda, SLA, faturas e frota e dispara
 * WhatsApp. Ela roda de 30 em 30s; quando passa disso, sem trava a seguinte
 * começava por cima e as passadas se acumulavam — degradando a API inteira e
 * duplicando mensagens para as mesmas pessoas.
 */
describe("AlertScheduler — trava de sobreposição", () => {
  function montar() {
    const prisma: any = {
      alertConfig: { findMany: jest.fn().mockResolvedValue([]) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const wa: any = { resolveInstance: jest.fn(), sendMessage: jest.fn() };
    const config: any = { get: jest.fn().mockReturnValue("https://exemplo.local") };
    const email: any = { enviar: jest.fn() };

    const s = new AlertScheduler(prisma, wa, config, email);

    // As sub-varreduras têm dependências próprias; aqui interessa só quantas
    // vezes o corpo da passada é executado.
    const chamadas = { sla: 0, fatura: 0, frota: 0, orcamento: 0, relatorios: 0 };
    (s as any).runSlaCheck = async () => { chamadas.sla++; };
    (s as any).runFaturaCheck = async () => { chamadas.fatura++; };
    (s as any).runFrotaCheck = async () => { chamadas.frota++; };
    (s as any).runOrcamentoAlertCheck = async () => { chamadas.orcamento++; };
    (s as any).runScheduledReports = async () => { chamadas.relatorios++; };

    return { s, prisma, chamadas };
  }

  it("duas passadas simultâneas executam o corpo uma única vez", async () => {
    const { s, chamadas } = montar();

    // Dispara as duas sem aguardar a primeira — é o que o setInterval faz
    // quando a passada anterior ainda não terminou.
    await Promise.all([s.run(), s.run()]);

    expect(chamadas.sla).toBe(1);
    expect(chamadas.fatura).toBe(1);
    expect(chamadas.frota).toBe(1);
  });

  it("depois que a passada termina, a próxima roda normalmente", async () => {
    const { s, chamadas } = montar();

    await s.run();
    await s.run();

    expect(chamadas.sla).toBe(2);
  });

  it("uma passada que explode libera a trava — o agendador não fica mudo para sempre", async () => {
    const { s, chamadas } = montar();
    (s as any).runSlaCheck = async () => { throw new Error("falha na varredura de SLA"); };

    await expect(s.run()).rejects.toThrow("falha na varredura de SLA");

    // A trava tem que ter sido liberada: a passada seguinte executa.
    (s as any).runSlaCheck = async () => { chamadas.sla++; };
    await s.run();
    expect(chamadas.sla).toBe(1);
  });
});
