import { lerPlanilha, extrairEventos, lerDataInicial, mapearStatus, valoresCitados, inferirTipoEvento } from "./importacao.parser";

/**
 * Dados SINTÉTICOS no layout da planilha de origem. Nenhum conteúdo real da
 * empresa entra no repositório — a planilha verdadeira é importada pela tela
 * ou pelo script, nunca versionada.
 */
const HOJE = new Date(2026, 8, 10);

const cab = [null, "Assunto", "Objetivo", "Principais Andamentos", "Valor envolvido - Pretensão", "Valor - Alcançado", "Valor de Reequilíbrio", "Esfera", "Status Atual", "Área Responsável", null];
const grupo = (nome: string) => [null, nome, null, null, null, null, null, null, null, null, null];

const linhas = [
  [null, "ACOMPANHAMENTO ESTRATÉGICO"],
  cab,
  grupo("Alteração de parâmetros"),
  [null, "Assunto A", "Alteração de parâmetros", "01/07/2026 - Protocolo do pedido\ncontinuação da mesma linha", null, null, null, "Administrativa", "Aguardando ANTT", "Regulatório", "Em andamento"],
  [null, "Assunto B", "Alteração parâmetros", null, "-", "-", 0.08, "Administrativa", "Aguardando TTBR", "Jurídico/ Regulatório/ Financeiro", "Em andamento"],
  grupo("Busca pela improcedência"),
  [null, "Assunto C", "Improcedência", "PROCESSO X 123\n20/03/26: ajuizada ação\n14/04/26: concedida tutela\n\nTexto sem data nenhuma.", null, null, 1500000, "Judicial", "Suspenso", "Jurídico", "Suspenso"],
  grupo("Oportunidades"),
  [null, "Oportunidade D", "Reequilíbrio", "Dez/23 - Estudo iniciado\n09/2025 - Ofício com R$ 1.234.567,89", null, null, null, "Administrativa", "Aguardando levantamento - Time Financeiro", "Financeiro", "Em andamento"],
];

describe("lerPlanilha", () => {
  const previa = lerPlanilha([
    { nome: "Resumo", linhas: [[null, "ATUAL", "Contagem"]] },
    { nome: "Assuntos", linhas },
  ], HOJE);

  it("acha a aba certa, o cabeçalho e a coluna de situação sem título", () => {
    expect(previa.aba).toBe("Assuntos");
    expect(previa.linhaCabecalho).toBe(2);
    expect(previa.colunas.situacao).toBe("(sem cabeçalho)");
    expect(previa.avisos.join(" ")).toContain("Resumo");
  });

  it("linhas só com assunto são grupos; o resto são assuntos do grupo", () => {
    expect(previa.grupos).toEqual(["Alteração de parâmetros", "Busca pela improcedência", "Oportunidades"]);
    expect(previa.casos.map(c => c.titulo)).toEqual(["Assunto A", "Assunto B", "Assunto C", "Oportunidade D"]);
    expect(previa.casos[2].grupo).toBe("Busca pela improcedência");
  });

  it("unifica grafias do objetivo e registra o aviso", () => {
    expect(previa.casos[0].objetivo).toBe(previa.casos[1].objetivo);
    expect(previa.catalogos.objetivo.find(o => o.variacoes.length === 2)).toBeTruthy();
  });

  it("status vira etapa + dependência, preservando o texto original", () => {
    const a = previa.casos[0];
    expect(a.etapa).toBe("negociacao_externa");
    expect(a.dependencia).toBe("ANTT");
    expect(a.statusOriginal).toBe("Aguardando ANTT");
    expect(previa.casos[2].etapa).toBe("suspenso");
  });

  it("áreas: primeira é a operacional, as demais são apoio", () => {
    expect(previa.casos[1].areaOperacional).toBe("Jurídico");
    expect(previa.casos[1].areasApoio).toEqual(["Regulatório", "Financeiro"]);
  });

  it("não consolida valor implausível nem traço; importa número válido", () => {
    const b = previa.casos[1];
    expect(b.valores).toEqual({ valorPretendido: null, valorAlcancado: null, valorReequilibrio: null });
    expect(b.pendencias.join(" ")).toContain("parece percentual");
    expect(previa.casos[2].valores.valorReequilibrio).toBe(1500000);
  });

  it("oportunidade recebe tipo e estágio inferido, marcado para revisão", () => {
    const d = previa.casos[3];
    expect(d.tipo).toBe("oportunidade");
    expect(d.estagioOportunidade).toBe("em_estudo");
    expect(d.pendencias.join(" ")).toContain("Oportunidade");
    expect(d.valoresCitados[0].valor).toBe(1234567.89);
  });

  it("toda linha tem pendências de revisão (validação com usuários é etapa do plano)", () => {
    expect(previa.casos.every(c => c.pendencias.length > 0)).toBe(true);
    expect(previa.casos[0].pendencias.join(" ")).toContain("sem próxima ação");
  });

  it("última movimentação = data do evento mais recente", () => {
    expect(previa.casos[0].ultimaMovimentacao).toBe("2026-07-01");
    expect(previa.casos[1].ultimaMovimentacao).toBeNull();
  });
});

describe("extrairEventos", () => {
  it("só converte linha que COMEÇA com data clara; junta continuação", () => {
    const r = extrairEventos("01/07/2026 - Protocolo do pedido\ncontinuação", HOJE);
    expect(r.eventos).toHaveLength(1);
    expect(r.eventos[0]).toMatchObject({ data: "2026-07-01", precisao: "dia", tipo: "protocolo" });
    expect(r.eventos[0].descricao).toBe("Protocolo do pedido continuação");
  });

  it("título de bloco vira contexto dos eventos seguintes", () => {
    const r = extrairEventos("PROCESSO X 123\n20/03/26: ajuizada ação\n\nOutro parágrafo solto.", HOJE);
    expect(r.eventos[0]).toMatchObject({ data: "2026-03-20", contexto: "PROCESSO X 123" });
    expect(r.trechosSemData).toEqual(["PROCESSO X 123", "Outro parágrafo solto."]);
  });

  it("data futura não é andamento ocorrido", () => {
    const r = extrairEventos("15/12/2026 - Audiência marcada", HOJE);
    expect(r.eventos).toHaveLength(0);
    expect(r.trechosSemData).toHaveLength(1);
  });

  it("mês/ano vira evento com precisão de mês, sem inventar o dia", () => {
    const r = extrairEventos("Dez/23 - Protocolo do requerimento\n08/2026 - Engenharia cobrada", HOJE);
    expect(r.eventos.map(e => [e.data, e.precisao])).toEqual([["2023-12-01", "mes"], ["2026-08-01", "mes"]]);
  });

  it("data no meio da frase ou incompleta não vira evento", () => {
    expect(lerDataInicial("Em 19.11.2025, protocolou petição")).toBeNull();
    expect(lerDataInicial("06 e 07/07 - Reuniões")).toBeNull();
    expect(lerDataInicial("31/02/2026 - data inválida")).toBeNull();
    expect(lerDataInicial("24.04.26 processo recebido")?.data).toBe("2026-04-24");
  });
});

describe("regras auxiliares", () => {
  it("mapearStatus marca o que não reconhece em vez de adivinhar", () => {
    expect(mapearStatus("Aguardando judiciário", "Em andamento")).toMatchObject({ etapa: "aguardando_decisao", dependencia: "Judiciário" });
    expect(mapearStatus("Algo novo", null).nota).toContain("não reconhecido");
    expect(mapearStatus("Aguardando TTBR", null).nota).toContain("TBR");
  });
  it("valores citados reconhecem R$ e MM", () => {
    expect(valoresCitados("multas de R$ 1,2 MM e R$ 10,00").map(v => v.valor)).toEqual([10, 1_200_000]);
  });
  it("tipo de evento por palavra-chave", () => {
    expect(inferirTipoEvento("Despacho deferindo a suspensão")).toBe("decisao");
    expect(inferirTipoEvento("Realizada reunião com a agência")).toBe("reuniao");
    expect(inferirTipoEvento("Qualquer coisa")).toBe("andamento");
  });
});
