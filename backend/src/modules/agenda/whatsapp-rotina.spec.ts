import { comandoRotina } from "./whatsapp-rotina.service";
import { dataTarefa, diaSaoPaulo, instanteSaoPaulo, ocorrenciaNoDia } from "./whatsapp-rotina-datas";

describe("Rotina pessoal pelo WhatsApp", () => {
  it("não captura comandos do resumo semanal financeiro nem consultas de gastos", () => {
    expect(comandoRotina("parar resumo")).toBe(false);
    expect(comandoRotina("quanto gastei hoje")).toBe(false);
    expect(comandoRotina("ativar resumo diário 08:00 dias úteis")).toBe(true);
    expect(comandoRotina("meu dia")).toBe(true);
  });
  it("calcula o dia em Brasília na virada da data UTC", () => {
    expect(diaSaoPaulo(new Date("2026-10-25T01:00:00Z"))).toBe("2026-10-24");
    expect(instanteSaoPaulo("2026-10-24", "08", "00").toISOString()).toBe("2026-10-24T11:00:00.000Z");
  });
  it("não descarta uma recorrência diária antiga por limite de iterações", () => {
    const event = { inicio: "2024-01-01T12:00:00Z", fim: "2024-01-01T13:00:00Z", recorrencia: "DIARIA" };
    const p = ocorrenciaNoDia(event, "2026-10-26", instanteSaoPaulo("2026-10-26"), instanteSaoPaulo("2026-10-27"));
    expect(p.inicio.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(p.fim.toISOString()).toBe("2026-10-26T13:00:00.000Z");
  });
  it("respeita o fim da recorrência e o intervalo semanal", () => {
    const from = instanteSaoPaulo("2026-10-26"), to = instanteSaoPaulo("2026-10-27");
    expect(ocorrenciaNoDia({ inicio: "2026-10-20T12:00:00Z", recorrencia: "SEMANAL" }, "2026-10-26", from, to)).toBeNull();
    expect(ocorrenciaNoDia({ inicio: "2024-01-01T12:00:00Z", recorrencia: "DIARIA", recorrenciaFim: "2026-10-25T23:59:59Z" }, "2026-10-26", from, to)).toBeNull();
  });
  it("valida datas de tarefa e não aceita somente uma data sem descrição", () => {
    const now = new Date("2026-10-26T11:00:00Z");
    expect(dataTarefa("Comprar material amanhã", now)).toEqual({ titulo: "Comprar material", dia: "2026-10-27" });
    expect(dataTarefa("Comprar material 31/02/2026", now)).toBeNull();
    expect(dataTarefa("amanhã", now)).toBeNull();
    expect(dataTarefa("Comprar material 29/02/2028", now)?.dia).toBe("2028-02-29");
  });
  it("inclui compromisso que atravessa a meia-noite, mas não o já encerrado", () => {
    const from = instanteSaoPaulo("2026-10-26"), to = instanteSaoPaulo("2026-10-27");
    expect(ocorrenciaNoDia({ inicio: "2026-10-26T02:00:00Z", fim: "2026-10-26T04:00:00Z" }, "2026-10-26", from, to)).not.toBeNull();
    expect(ocorrenciaNoDia({ inicio: "2026-10-25T12:00:00Z", fim: "2026-10-25T13:00:00Z" }, "2026-10-26", from, to)).toBeNull();
  });
});
