/**
 * Leitura do CRLV-e (PDF) e a regra de vencimento do licenciamento.
 *
 * O CRLV-e segue o modelo do SENATRAN: cada rótulo tem o valor desenhado logo
 * ABAIXO dele, alinhado à esquerda. Ler o PDF na ordem do texto não funciona —
 * o gerador desenha todos os rótulos primeiro e só depois todos os valores,
 * então "PLACA" e "FUK3B42" ficam a dezenas de itens de distância. O casamento
 * aqui é POSICIONAL, que é o que o documento de fato garante.
 *
 * Não há OCR: o CRLV-e digital traz camada de texto com ToUnicode. Se algum dia
 * chegar um CRLV digitalizado (foto), `lerCrlv` devolve os campos vazios — e o
 * chamador trata como "não consegui ler", nunca como "veículo sem dados".
 */

// `pdfjs-dist` é ESM; o backend compila para CommonJS. O import dinâmico é o
// que faz as duas coisas conviverem sem mudar o alvo do TypeScript.
async function carregarPdfjs(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return await (Function("return import('pdfjs-dist/legacy/build/pdf.mjs')")() as Promise<any>);
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = (s: any) => semAcento(String(s || "")).toUpperCase().replace(/\s+/g, " ").trim();

/** O CRLV preenche campo sem conteúdo com asteriscos e pontos, não com vazio. */
const semConteudo = (v: string | null) => !v || /^[*.\s/-]*$/.test(v);

export type CrlvLido = {
  placa: string | null; renavam: string | null; chassi: string | null;
  exercicio: string | null; anoFabricacao: string | null; anoModelo: string | null;
  marca: string | null; modelo: string | null; marcaModelo: string | null;
  cor: string | null; combustivel: string | null; categoria: string | null;
  especieTipo: string | null; motor: string | null; eixos: string | null;
  lotacao: string | null; proprietario: string | null; cpfCnpj: string | null;
  local: string | null; dataDocumento: string | null; numeroCrv: string | null;
  codigoSeguranca: string | null; observacoes: string | null; ufEmissor: string | null;
};

export async function lerCrlv(buffer: Buffer): Promise<CrlvLido> {
  const { getDocument } = await carregarPdfjs();
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pag = await doc.getPage(1);
  const itens = (await pag.getTextContent()).items
    .filter((i: any) => i.str && i.str.trim())
    .map((i: any) => ({ t: i.str.trim(), x: i.transform[4], y: i.transform[5] }));

  const valorDe = (rotulo: string): string | null => {
    const r = itens.find((i: any) => norm(i.t) === norm(rotulo));
    if (!r) return null;
    // O vão entre rótulo e valor varia de ~13 a ~23pt conforme o bloco; a
    // janela de 30 cobre os dois sem alcançar a linha seguinte.
    const abaixo = itens
      .filter((i: any) => i !== r && i.y < r.y - 4 && i.y > r.y - 30 && Math.abs(i.x - r.x) < 12)
      .sort((a: any, b: any) => b.y - a.y);
    const v = abaixo[0]?.t?.trim() || null;
    return semConteudo(v) ? null : v;
  };

  const texto = itens.map((i: any) => i.t).join(" ");
  const marcaModelo = valorDe("MARCA / MODELO / VERSAO");
  const [marca, ...restoModelo] = (marcaModelo || "").split("/");

  return {
    placa: valorDe("PLACA"),
    renavam: valorDe("CODIGO RENAVAM"),
    chassi: valorDe("CHASSI"),
    exercicio: valorDe("EXERCICIO"),
    anoFabricacao: valorDe("ANO FABRICACAO"),
    anoModelo: valorDe("ANO MODELO"),
    marcaModelo,
    marca: marca?.trim() || null,
    modelo: restoModelo.join("/").trim() || null,
    cor: valorDe("COR PREDOMINANTE"),
    combustivel: valorDe("COMBUSTIVEL"),
    categoria: valorDe("CATEGORIA"),
    especieTipo: valorDe("ESPECIE / TIPO"),
    motor: valorDe("MOTOR"),
    eixos: valorDe("EIXOS"),
    lotacao: valorDe("LOTACAO"),
    proprietario: valorDe("NOME"),
    cpfCnpj: valorDe("CPF / CNPJ"),
    local: valorDe("LOCAL"),
    dataDocumento: valorDe("DATA"),
    numeroCrv: valorDe("NUMERO DO CRV"),
    codigoSeguranca: valorDe("CODIGO DE SEGURANCA DO CLA"),
    observacoes: (texto.match(/ALIENA[CÇ][AÃ]O FIDUCI[AÁ]RIA/i) || [])[0] || null,
    ufEmissor: (texto.match(/DETRAN[- ]?([A-Z]{2})\b/) || [])[1] || null,
  };
}

/** Placa só com letras e números, para comparar com o cadastro sem tropeçar em hífen. */
export const normalizaPlaca = (p: any) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Calendário de licenciamento de SÃO PAULO — o oficial, do exercício 2026.
 *
 * ATENÇÃO: ESTE É O ÚNICO LUGAR A CORRIGIR quando o Detran publicar o
 * calendário de um novo exercício.
 *
 * Histórico que vale registrar: a primeira versão desta tabela foi escrita de
 * memória e estava ERRADA EM TODAS AS DEZ LINHAS -- não só nos finais 8, 9 e 0
 * que eu havia sinalizado como duvidosos. O final 1, por exemplo, saía abril
 * quando o correto é julho: três meses de diferença, em data que dispara
 * cobrança. Corrigido em 20/08/2026 contra o calendário oficial.
 *
 * São DUAS tabelas, e a primeira versão tinha só uma. O prazo de caminhão e
 * trator é bem mais tarde que o de carro com o mesmo final de placa: final 1
 * vence em julho se for carro e em setembro se for caminhão.
 *
 * O dia é sempre o ÚLTIMO DO MÊS, e não o último dia útil -- o calendário
 * oficial fixa 31/07, 31/08, 30/09, 31/10, 30/11 e 31/12. A versão anterior
 * recuava para a sexta-feira quando caía em fim de semana, o que antecipava o
 * vencimento sem que a lei pedisse.
 */

/** Carros, motos e veículos de passageiros. */
export const LICENCIAMENTO_SP_LEVE: Record<string, number> = {
  "1": 7,  "2": 7,   // até 31 de julho
  "3": 8,  "4": 8,   // até 31 de agosto
  "5": 9,  "6": 9,   // até 30 de setembro
  "7": 10, "8": 10,  // até 31 de outubro
  "9": 11,           // até 30 de novembro
  "0": 12,           // até 31 de dezembro
};

/** Caminhões e tratores. */
export const LICENCIAMENTO_SP_PESADO: Record<string, number> = {
  "1": 9,  "2": 9,            // até 30 de setembro
  "3": 10, "4": 10, "5": 10,  // até 31 de outubro
  "6": 11, "7": 11, "8": 11,  // até 30 de novembro
  "9": 12, "0": 12,           // até 31 de dezembro
};

/**
 * Decide qual das duas tabelas usar.
 *
 * A espécie do CRLV manda, porque é a classificação oficial do documento
 * ("CARGA/CAMINHAO", "TRACAO/TRATOR"). O `tipo` do cadastro entra como
 * segunda opção -- e precisa ser normalizado: a base real tem `caminhao` E
 * `caminhão`, as duas grafias, para a mesma coisa.
 */
export function ehPesado(especieTipoCrlv?: string | null, tipoCadastro?: string | null): boolean {
  const t = norm(semAcento(String(especieTipoCrlv || "") + " " + String(tipoCadastro || "")));
  return /CAMINHAO|TRATOR|CARGA|REBOQUE|SEMI ?REBOQUE|CAVALO/.test(t);
}

/** Último dia do mês. O calendário oficial fixa data corrida, não dia útil. */
function ultimoDiaDoMes(ano: number, mes1a12: number): Date {
  // Hora LOCAL, nunca Date.UTC: o container roda em America/Sao_Paulo, e
  // meia-noite UTC é 21h do dia anterior em Brasília -- a data certa no banco
  // aparecia um dia antes na tela. Os registros de CNH gravam às 03:00 UTC,
  // que é meia-noite local; aqui seguimos a mesma convenção.
  return new Date(ano, mes1a12, 0);
}
/**
 * Vencimento do licenciamento. Devolve null quando não há regra — e quem chama
 * deve então PEDIR a data ao usuário, nunca inventar.
 *
 * EXERCÍCIO + 1, e não o próprio exercício: o CRLV de 2026 prova que o
 * licenciamento de 2026 já foi feito. Calcular o prazo do próprio exercício
 * dava documento vencido no dia em que era cadastrado.
 *
 * RESSALVA que precisa ser revista a cada ano: a tabela em uso é a do
 * exercício 2026, e aqui ela é aplicada ao exercício seguinte, porque é o
 * único calendário publicado. Quando o Detran divulgar o de 2027, conferir se
 * os meses mudaram.
 */
export function vencimentoLicenciamento(
  uf: string | null,
  placa: string | null,
  exercicio: string | number | null,
  especieOuTipo?: { especieTipo?: string | null; tipoCadastro?: string | null },
): Date | null {
  if (!uf || norm(uf) !== "SP") return null;
  const p = normalizaPlaca(placa);
  if (!p) return null;
  const tabela = ehPesado(especieOuTipo?.especieTipo, especieOuTipo?.tipoCadastro)
    ? LICENCIAMENTO_SP_PESADO
    : LICENCIAMENTO_SP_LEVE;
  const mes = tabela[p.slice(-1)];
  const ano = Number(exercicio);
  if (!mes || !ano || ano < 2000 || ano > 2100) return null;
  return ultimoDiaDoMes(ano + 1, mes);
}


/**
 * Estados para o pré-cadastro da tela.
 *
 * Lista fixa em código, e não tabela: os 27 entes da federação não mudam com a
 * operação, e uma tabela vazia num tenant novo deixaria o campo obrigatório sem
 * nenhuma opção — impossível salvar documento.
 */
export const UFS: { sigla: string; nome: string }[] = [
  { sigla: "AC", nome: "Acre" }, { sigla: "AL", nome: "Alagoas" }, { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" }, { sigla: "BA", nome: "Bahia" }, { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" }, { sigla: "ES", nome: "Espírito Santo" }, { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" }, { sigla: "MT", nome: "Mato Grosso" }, { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" }, { sigla: "PA", nome: "Pará" }, { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" }, { sigla: "PE", nome: "Pernambuco" }, { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" }, { sigla: "RN", nome: "Rio Grande do Norte" }, { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" }, { sigla: "RR", nome: "Roraima" }, { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" }, { sigla: "SE", nome: "Sergipe" }, { sigla: "TO", nome: "Tocantins" },
];
