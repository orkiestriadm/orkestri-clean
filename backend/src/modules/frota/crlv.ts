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
 * Calendário de licenciamento de SÃO PAULO, por final da placa.
 *
 * ATENÇÃO — ESTE É O ÚNICO LUGAR A CORRIGIR se o Detran mudar o calendário.
 * A tabela foi confirmada pelo usuário em 19/08/2026, com uma ressalva que eu
 * mesmo levantei e fica registrada: os finais 8, 9 e 0 são os que eu tinha
 * MENOS certeza — em alguns exercícios o Detran-SP desloca ou junta esses
 * meses. Se aparecer vencimento estranho, comece por aqui.
 *
 * Só vale para SP. Qualquer outra UF devolve null de propósito: preencher data
 * chutada faria a régua de vencimento cobrar licenciamento no mês errado, que é
 * pior que campo vazio.
 */
export const LICENCIAMENTO_SP_POR_FINAL: Record<string, number> = {
  "1": 4,  // abril
  "2": 5,  // maio
  "3": 6,  // junho
  "4": 7,  // julho
  "5": 8,  // agosto
  "6": 9,  // setembro
  "7": 10, // outubro
  "8": 11, // novembro
  "9": 11, // novembro
  "0": 12, // dezembro
};

/** Último dia ÚTIL do mês — o Detran fecha o prazo em dia útil. */
function ultimoDiaUtil(ano: number, mes1a12: number): Date {
  const d = new Date(Date.UTC(ano, mes1a12, 0)); // dia 0 do mês seguinte = último deste
  // Feriado não entra: os meses do calendário não têm feriado fixo caindo no
  // fim do mês, e uma tabela de feriados móveis envelheceria sem ninguém notar.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * Vencimento do licenciamento. Devolve null quando não há regra — e quem chama
 * deve então PEDIR a data ao usuário, nunca inventar.
 */
export function vencimentoLicenciamento(uf: string | null, placa: string | null, exercicio: string | number | null): Date | null {
  if (!uf || norm(uf) !== "SP") return null;
  const p = normalizaPlaca(placa);
  if (!p) return null;
  const mes = LICENCIAMENTO_SP_POR_FINAL[p.slice(-1)];
  const ano = Number(exercicio);
  if (!mes || !ano || ano < 2000 || ano > 2100) return null;
  return ultimoDiaUtil(ano, mes);
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
