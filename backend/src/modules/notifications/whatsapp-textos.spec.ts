process.env.MARCA = "HUB Triunfo Transbrasiliana";

import { WhatsAppService } from "./whatsapp.service";

/**
 * As mensagens que chegam no celular de alguém, renderizadas com dados REAIS
 * de chamados do Hub e conferidas linha a linha.
 *
 * Existe porque texto que gera mensagem já saiu errado aqui: um alerta de
 * frota chegou a anunciar "revisão passou 3.304.493 km do previsto". Build
 * limpa e tipagem não leem o que a pessoa recebe — este teste lê.
 *
 * Rode com `--verbose=false` e o console mostra cada mensagem por inteiro.
 */

const APP_URL = "https://hub.triunfotransbrasiliana.com.br";

// Chamados REAIS do Hub (numero | id | titulo | prioridade | sla_horas).
// `urgente` é valor legado que não existe no mapa de rótulos de nenhuma tela —
// justamente por isso está aqui.
const C_URGENTE = { numero: 55, id: "274cd506-5ec0-408b-bca7-e38742885c9e", titulo: "Homologação de Versão de Cabine", prioridade: "urgente", sla: 8 };
const C_CRITICA = { numero: 51, id: "1fa4b307-de2b-4a17-9b5d-4eea76f4c4a6", titulo: "Teste de TI", prioridade: "critica", sla: 2 };

function montar() {
  const wa = new WhatsAppService({ get: (_k: string, d?: any) => d ?? "" } as any);
  const enviadas: string[] = [];
  (wa as any).sendMessage = async (_phone: string, msg: string) => { enviadas.push(msg); return true; };
  return { wa, enviadas, ultima: () => enviadas[enviadas.length - 1] };
}

function mostrar(rotulo: string, msg: string) {
  console.log(`\n${"=".repeat(60)}\n${rotulo}\n${"=".repeat(60)}\n${msg}`);
}

describe("Mensagens de WhatsApp — o que a pessoa recebe", () => {
  it("teste de conexão", async () => {
    const { wa, ultima } = montar();
    await wa.sendTest("5514999999999");
    mostrar("sendTest", ultima());
    expect(ultima()).toContain("WhatsApp configurado");
    expect(ultima()).toContain("Está tudo certo");
  });

  it("lembrete de evento, faltando tempo e começando agora", async () => {
    const { wa, enviadas } = montar();
    await wa.sendEventAlert("5514999999999", "Reunião de diretoria", 15, APP_URL);
    await wa.sendEventAlert("5514999999999", "Reunião de diretoria", 0, APP_URL);
    mostrar("sendEventAlert (15 min)", enviadas[0]);
    mostrar("sendEventAlert (agora)", enviadas[1]);
    expect(enviadas[0]).toContain("Começa em 15 minutos");
    expect(enviadas[1]).toContain("Começando agora");
  });

  it("chamado aberto — prioridade LEGADA `urgente` não sai em minúscula", async () => {
    const { wa, ultima } = montar();
    const c = C_URGENTE;
    await wa.sendChamadoAberto("5514999999999", c.numero, c.id, c.titulo, c.prioridade, c.sla, APP_URL);
    mostrar("sendChamadoAberto (prioridade legada)", ultima());
    expect(ultima()).toContain("*Prioridade:* Urgente");
    expect(ultima()).toContain("até 8h");
  });

  it("chamado atribuído traz o prazo em hora absoluta", async () => {
    const { wa, ultima } = montar();
    const c = C_CRITICA;
    await wa.sendChamadoAtribuido("5514999999999", c.numero, c.id, c.titulo, c.prioridade, new Date(Date.now() + 2 * 3600_000), APP_URL);
    mostrar("sendChamadoAtribuido", ultima());
    expect(ultima()).toContain("*Prioridade:* Crítica");
    expect(ultima()).toMatch(/vence às \d{2}:\d{2}/);
  });

  it("chamado atualizado e resolvido", async () => {
    const { wa, enviadas } = montar();
    const c = C_URGENTE;
    await wa.sendChamadoStatus("5514999999999", c.numero, c.id, c.titulo, "em_atendimento", APP_URL);
    await wa.sendChamadoResolvido("5514999999999", c.numero, c.id, c.titulo, APP_URL);
    mostrar("sendChamadoStatus", enviadas[0]);
    mostrar("sendChamadoResolvido", enviadas[1]);
    expect(enviadas[0]).toContain("Em atendimento");
    // Não promete a avaliação: o link abre o chamado, não a tela de nota.
    expect(enviadas[1]).not.toMatch(/avalie/i);
  });

  it("SLA em risco e violado — hora absoluta, e a data aparece quando não é hoje", async () => {
    const { wa, enviadas } = montar();
    const c = C_CRITICA;
    await wa.sendSlaRisco("5514999999999", c.numero, c.id, c.titulo, 45, APP_URL);
    await wa.sendSlaViolado("5514999999999", c.numero, c.id, c.titulo, 80, APP_URL);
    await wa.sendSlaViolado("5514999999999", c.numero, c.id, c.titulo, 26 * 60, APP_URL);
    mostrar("sendSlaRisco", enviadas[0]);
    mostrar("sendSlaViolado", enviadas[1]);
    mostrar("sendSlaViolado (venceu ontem)", enviadas[2]);

    expect(enviadas[0]).toMatch(/^⏱️ \*SLA vence às \d{2}:\d{2}\* — faltam 45 min/);
    expect(enviadas[1]).toMatch(/^🚨 \*SLA venceu às \d{2}:\d{2}\* — 1h 20min de atraso/);
    // Venceu ontem: sem a data, "venceu às 10:00" faria pensar que foi hoje.
    expect(enviadas[2]).toMatch(/SLA venceu em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
  });

  it("toda mensagem termina com a marca e nenhuma começa com ela", async () => {
    const { wa, enviadas } = montar();
    const c = C_CRITICA;
    await wa.sendTest("5514999999999");
    await wa.sendEventAlert("5514999999999", "Reunião", 15, APP_URL);
    await wa.sendChamadoAberto("5514999999999", c.numero, c.id, c.titulo, c.prioridade, c.sla, APP_URL);
    await wa.sendChamadoAtribuido("5514999999999", c.numero, c.id, c.titulo, c.prioridade, null, APP_URL);
    await wa.sendChamadoStatus("5514999999999", c.numero, c.id, c.titulo, "resolvido", APP_URL);
    await wa.sendChamadoResolvido("5514999999999", c.numero, c.id, c.titulo, APP_URL);
    await wa.sendSlaRisco("5514999999999", c.numero, c.id, c.titulo, 45, APP_URL);
    await wa.sendSlaViolado("5514999999999", c.numero, c.id, c.titulo, 80, APP_URL);

    for (const m of enviadas) {
      // A prévia do WhatsApp mostra só o começo: ali vai o fato, não a marca.
      expect(m.startsWith("*HUB")).toBe(false);
      expect(m.endsWith("_HUB Triunfo Transbrasiliana_")).toBe(true);
    }
  });

  it("o link leva AO chamado, não à lista", async () => {
    const { wa, enviadas } = montar();
    const c = C_CRITICA;
    await wa.sendChamadoAberto("5514999999999", c.numero, c.id, c.titulo, c.prioridade, c.sla, APP_URL);
    await wa.sendSlaRisco("5514999999999", c.numero, c.id, c.titulo, 45, APP_URL);
    await wa.sendSlaViolado("5514999999999", c.numero, c.id, c.titulo, 80, APP_URL);
    for (const m of enviadas) {
      expect(m).toContain(`/dashboard/chamados/${c.id}`);
    }
  });

  it("nenhuma palavra ficou sem acento", async () => {
    const { wa, enviadas } = montar();
    const c = C_CRITICA;
    await wa.sendTest("5514999999999");
    await wa.sendEventAlert("5514999999999", "Reunião", 15, APP_URL);
    await wa.sendChamadoAberto("5514999999999", c.numero, c.id, c.titulo, c.prioridade, c.sla, APP_URL);
    await wa.sendChamadoAtribuido("5514999999999", c.numero, c.id, c.titulo, c.prioridade, new Date(), APP_URL);
    await wa.sendChamadoStatus("5514999999999", c.numero, c.id, c.titulo, "aguardando", APP_URL);
    await wa.sendChamadoResolvido("5514999999999", c.numero, c.id, c.titulo, APP_URL);
    await wa.sendSlaRisco("5514999999999", c.numero, c.id, c.titulo, 45, APP_URL);
    await wa.sendSlaViolado("5514999999999", c.numero, c.id, c.titulo, 80, APP_URL);

    const semAcento = /\b(Voce|voce|esta configurado|CRITICA|Critica|atribuido|proximo|conexao|ate \d|Media|nao|sao)\b/;
    for (const m of enviadas) {
      expect(m).not.toMatch(semAcento);
    }
  });
});
