import { coletarQuando } from "./whatsapp-guiado-quando";
import { diaCompromisso, novaDataCompromisso } from "../notifications/evento-alerta-datas";
const agora = new Date("2026-10-29T11:28:00Z");
describe("Datas brasileiras e respostas parciais", () => {
  it.each([
    ["10/12/2026", "2026-12-10"], ["10 de dezembro de 2026", "2026-12-10"],
    ["1 de março de 2027", "2027-03-01"], ["29 de fevereiro de 2028", "2028-02-29"],
    ["amanhã", "2026-10-30"], ["hoje", "2026-10-29"],
  ])("reconhece o dia sem atribuir horário: %s", (texto, esperado) => {
    expect(diaCompromisso(texto, agora)).toBe(esperado);
    expect(novaDataCompromisso(texto, agora)).toBeNull();
  });
  it.each(["31/02/2027", "29 de fevereiro de 2027", "31 de abril de 2027", "10 de inexistente de 2027", "0/12/2026", "10/13/2026"])("recusa calendário impossível %s", texto => expect(diaCompromisso(texto, agora)).toBeNull());
  it.each([
    ["10 de dezembro de 2026 às 14h30", "2026-12-10T17:30:00.000Z"],
    ["10/12/2026 14:30", "2026-12-10T17:30:00.000Z"],
    ["amanhã 00h", "2026-10-30T03:00:00.000Z"],
  ])("combina explicitamente dia e hora em São Paulo: %s", (texto, iso) => expect(novaDataCompromisso(texto, agora)?.toISOString()).toBe(iso));
  it.each(["24h", "14:60", "14h60", "14h depois cancelar", "10/12/2026 24:00"])("não aceita horário inválido ou comandos misturados: %s", texto => expect(coletarQuando(texto, {dia:"2026-12-10"}, agora).erro).toBeTruthy());
  it("não assume hoje quando só recebe hora", () => {
    expect(coletarQuando("14:30", {}, agora)).toEqual(expect.objectContaining({parcial:{horario:"14:30"}}));
    expect(coletarQuando("14:30", {}, agora).valor).toBeUndefined();
  });
  it("mantém hoje em São Paulo antes da meia-noite UTC", () => {
    expect(coletarQuando("23:30", {dia:"2026-10-29"}, new Date("2026-10-30T02:00:00Z")).valor).toBe("2026-10-30T02:30:00.000Z");
  });
});
