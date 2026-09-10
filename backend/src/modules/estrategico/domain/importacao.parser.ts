import { createHash } from "crypto";
import { chaveNormalizada } from "./caso.entity";

/**
 * Leitura da planilha "Acompanhamento Estratégico".
 *
 * Função pura: recebe as linhas (matriz de células) e devolve a PRÉVIA do que
 * seria importado — nada é gravado aqui. A prévia é o que a tela mostra antes
 * de confirmar, e o que a gravação usa depois.
 *
 * Três compromissos do plano (seção 21 e Etapa 3 do prompt):
 *
 *  1. NÃO PERDER O TEXTO ORIGINAL. "Principais Andamentos" e "Status Atual"
 *     são preservados como vieram, sempre.
 *  2. SÓ VIRA EVENTO O QUE TEM DATA CLARA NO INÍCIO DA LINHA. "20/03/26: ..."
 *     vira evento; "Em 19.11.2025, TTBR protocolou ..." no meio do parágrafo
 *     não — fica no original e o assunto é marcado para revisão.
 *  3. NÃO INVENTAR. Sem valor na planilha, sem valor no sistema. Valores
 *     citados no texto ("R$ 295.900.937,50") viram SUGESTÃO para revisão, não
 *     número consolidado no dashboard.
 *
 * Layout reconhecido (o da planilha de 20/08/2026): cabeçalho com "Assunto";
 * linhas só com o assunto preenchido são GRUPOS ("Reequilíbrio",
 * "Oportunidades"); as demais são assuntos daquele grupo. Uma coluna sem
 * cabeçalho com "Em andamento"/"Suspenso" é lida como situação.
 */

export type Celula = string | number | boolean | Date | null | undefined;

export type EventoPrevia = {
  data: string;              // yyyy-mm-dd
  precisao: "dia" | "mes";
  tipo: string;
  titulo: string;
  descricao: string;
  contexto?: string;
};

export type ValorCitado = { texto: string; valor: number; trecho: string };

export type CasoPrevia = {
  linha: number;
  chave: string;
  titulo: string;
  grupo: string | null;
  tipo: "assunto" | "oportunidade";
  estagioOportunidade: string | null;
  objetivo: string | null;
  esfera: string | null;
  areaOperacional: string | null;
  areasApoio: string[];
  statusOriginal: string | null;
  situacaoOriginal: string | null;
  etapa: string;
  dependencia: string | null;
  andamentosOriginais: string | null;
  eventos: EventoPrevia[];
  trechosSemData: string[];
  valores: { valorPretendido: number | null; valorAlcancado: number | null; valorReequilibrio: number | null };
  valoresCitados: ValorCitado[];
  celulasOriginais: Record<string, string | number | null>;
  pendencias: string[];
  ultimaMovimentacao: string | null;
};

export type PreviaImportacao = {
  aba: string;
  linhaCabecalho: number;
  colunas: Record<string, string>;
  casos: CasoPrevia[];
  grupos: string[];
  catalogos: {
    objetivo: { nome: string; variacoes: string[] }[];
    esfera: { nome: string; variacoes: string[] }[];
    area: { nome: string; variacoes: string[] }[];
    dependencia: string[];
  };
  avisos: string[];
};

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const texto = (v: Celula): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\r\n?/g, "\n");
};

const vazio = (v: Celula) => texto(v).trim() === "" || texto(v).trim() === "-";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ── Cabeçalho ────────────────────────────────────────────────────────────── */

type MapaColunas = {
  assunto: number; objetivo?: number; andamentos?: number;
  valorPretendido?: number; valorAlcancado?: number; valorReequilibrio?: number;
  esfera?: number; status?: number; area?: number; situacao?: number;
};

function reconhecerCabecalho(linha: Celula[]): MapaColunas | null {
  const idx = (teste: (h: string) => boolean) => {
    const i = linha.findIndex(c => teste(semAcento(texto(c)).trim()));
    return i >= 0 ? i : undefined;
  };
  const assunto = idx(h => h === "assunto" || h === "assuntos");
  if (assunto === undefined) return null;
  return {
    assunto,
    objetivo: idx(h => h.startsWith("objetivo")),
    andamentos: idx(h => h.includes("andamento")),
    valorPretendido: idx(h => h.includes("pretens") || h.includes("pretendid")),
    valorAlcancado: idx(h => h.includes("alcancad")),
    valorReequilibrio: idx(h => h.includes("reequilibrio") && h.includes("valor")),
    esfera: idx(h => h.startsWith("esfera")),
    status: idx(h => h.includes("status")),
    area: idx(h => h.includes("area") && h.includes("respons")),
  };
}

const SITUACOES = /^(em andamento|suspenso|suspensa|concluido|concluida|cancelado|cancelada)$/;

/** Coluna sem cabeçalho cujos valores são todos situação ("Em andamento"/"Suspenso"). */
function detectarSituacao(linhas: Celula[][], cabecalho: Celula[], inicio: number): number | undefined {
  const largura = Math.max(...linhas.map(l => l.length));
  for (let c = 0; c < largura; c++) {
    if (!vazio(cabecalho[c])) continue;
    const valores = linhas.slice(inicio).map(l => semAcento(texto(l[c])).trim()).filter(Boolean);
    if (valores.length >= 2 && valores.every(v => SITUACOES.test(v))) return c;
  }
  return undefined;
}

/* ── Status → etapa + dependência ─────────────────────────────────────────── */

export function mapearStatus(
  statusOriginal: string | null, situacao: string | null,
): { etapa: string; dependencia: string | null; nota: string | null } {
  const s = semAcento(statusOriginal ?? "").trim();
  const sit = semAcento(situacao ?? "").trim();

  if (sit.startsWith("suspens") || s.startsWith("suspens")) {
    return { etapa: "suspenso", dependencia: null, nota: null };
  }
  if (sit.startsWith("conclu")) return { etapa: "concluido", dependencia: null, nota: null };
  if (sit.startsWith("cancel")) return { etapa: "cancelado", dependencia: null, nota: null };

  const regras: [RegExp, string, string | null][] = [
    [/aguardando\s+antt/, "negociacao_externa", "ANTT"],
    [/aguardando\s+ministerio/, "negociacao_externa", "Ministério"],
    [/aguardando\s+judiciario/, "aguardando_decisao", "Judiciário"],
    [/aguardando\s+arbitragem/, "aguardando_decisao", "Arbitragem"],
    [/aguardando\s+banco/, "negociacao_externa", "Banco"],
    [/aguardando\s+t?tbr\b/, "em_analise", "TBR"],
    [/levantamento.*financeiro/, "levantamento", "Financeiro"],
    [/levantamento/, "levantamento", null],
    [/(prova|evidencia)/, "evidencias", null],
  ];
  for (const [re, etapa, dependencia] of regras) {
    if (re.test(s)) {
      const nota = /aguardando\s+ttbr/.test(s)
        ? `"${statusOriginal}" foi lido como dependência TBR — confirmar.`
        : null;
      return { etapa, dependencia, nota };
    }
  }
  return {
    etapa: "em_analise",
    dependencia: null,
    nota: statusOriginal ? `Status "${statusOriginal}" não reconhecido — etapa "Em análise" provisória.` : null,
  };
}

/* ── Andamentos → eventos ─────────────────────────────────────────────────── */

function dataValida(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Data no INÍCIO da linha. Devolve null se não houver data clara. */
export function lerDataInicial(linha: string): { data: string; precisao: "dia" | "mes"; resto: string } | null {
  const l = linha.trim();

  let m = l.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})(?![\d\/.])\s*[-–—:]?\s*(.*)$/s);
  if (m) {
    const dia = Number(m[1]); const mes = Number(m[2]);
    let ano = Number(m[3]); if (m[3].length === 2) ano += 2000;
    if (!dataValida(ano, mes, dia)) return null;
    return { data: `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`, precisao: "dia", resto: m[4].trim() };
  }

  m = l.match(/^(\d{1,2})\/(\d{4})(?![\d\/.])\s*[-–—:]?\s*(.*)$/s);
  if (m) {
    const mes = Number(m[1]); const ano = Number(m[2]);
    if (mes < 1 || mes > 12) return null;
    return { data: `${ano}-${doisDigitos(mes)}-01`, precisao: "mes", resto: m[3].trim() };
  }

  m = l.match(/^([A-Za-zçÇ]{3})[a-zç]*\/(\d{2}|\d{4})(?![\d\/.])\s*[-–—:]?\s*(.*)$/s);
  if (m) {
    const mes = MESES[semAcento(m[1]).slice(0, 3)];
    if (!mes) return null;
    let ano = Number(m[2]); if (m[2].length === 2) ano += 2000;
    return { data: `${ano}-${doisDigitos(mes)}-01`, precisao: "mes", resto: m[3].trim() };
  }
  return null;
}

export function inferirTipoEvento(t: string): string {
  const s = semAcento(t);
  if (/protocol/.test(s)) return "protocolo";
  if (/reuni/.test(s)) return "reuniao";
  if (/oficio/.test(s)) return "oficio";
  if (/(peticao|pedido de suspensao)/.test(s)) return "peticao";
  if (/(decis|despacho|sentenca|deferi|portaria|deliberacao|tutela)/.test(s)) return "decisao";
  if (/(manifest|impugnac|contrarraz|agravo|apelac)/.test(s)) return "manifestacao";
  if (/cobr/.test(s)) return "cobranca";
  if (/(nota tecnica|minuta|contrato|documenta|intimac)/.test(s)) return "documento";
  if (/(calcul|valor alcancado)/.test(s)) return "calculo";
  if (/(aprova|homolog|aceitacao)/.test(s)) return "aprovacao";
  return "andamento";
}

const pareceTitulo = (l: string) => l.length <= 90 && !/[.;]$/.test(l.trim());

export function extrairEventos(original: string | null, hoje: Date = new Date()): { eventos: EventoPrevia[]; trechosSemData: string[] } {
  const eventos: EventoPrevia[] = [];
  const trechosSemData: string[] = [];
  if (!original) return { eventos, trechosSemData };

  const limite = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1)).toISOString().slice(0, 10);
  const linhas = original.split("\n");
  let ultimo: EventoPrevia | null = null;
  let contexto: string | null = null;
  let anteriorEmBranco = true;

  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (!linha) { ultimo = null; contexto = null; anteriorEmBranco = true; continue; }

    const data = lerDataInicial(linha);
    if (data && data.data <= limite && data.resto) {
      const ev: EventoPrevia = {
        data: data.data,
        precisao: data.precisao,
        tipo: inferirTipoEvento(data.resto),
        titulo: data.resto.length > 120 ? data.resto.slice(0, 117).trimEnd() + "…" : data.resto,
        descricao: data.resto,
        ...(contexto ? { contexto } : {}),
      };
      eventos.push(ev);
      ultimo = ev;
      anteriorEmBranco = false;
      continue;
    }

    if (data && data.data > limite) {
      // Data futura no início ("Previsão ... 09/10") não é andamento ocorrido.
      trechosSemData.push(linha);
      ultimo = null;
    } else if (ultimo && !anteriorEmBranco) {
      // Continuação da linha anterior (quebra de linha dentro do mesmo item).
      ultimo.descricao += " " + linha;
    } else {
      trechosSemData.push(linha);
      // A PRIMEIRA linha de um bloco, curta e sem ponto final, seguida direto
      // por linhas datadas, é o título do bloco ("ACP OURINHOS 5000414-77...").
      // Vira contexto dos eventos seguintes para não se perder de qual processo
      // cada data é. Uma segunda linha sem data no mesmo bloco desfaz o
      // contexto: aí o bloco é texto corrido, não título + datas.
      contexto = anteriorEmBranco && pareceTitulo(linha) ? linha : null;
    }
    anteriorEmBranco = false;
  }

  return { eventos, trechosSemData };
}

/* ── Valores ──────────────────────────────────────────────────────────────── */

function numeroBR(s: string): number | null {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function valoresCitados(original: string | null): ValorCitado[] {
  if (!original) return [];
  const saida: ValorCitado[] = [];
  for (const linha of original.split("\n")) {
    for (const m of linha.matchAll(/R\$\s?([\d.]+,\d{2})/g)) {
      const valor = numeroBR(m[1]);
      if (valor != null) saida.push({ texto: m[0], valor, trecho: linha.trim().slice(0, 200) });
    }
    for (const m of linha.matchAll(/(?:R\$\s?)?(\d+(?:,\d+)?)\s?MM\b/g)) {
      const base = numeroBR(m[1]);
      if (base != null) saida.push({ texto: m[0], valor: base * 1_000_000, trecho: linha.trim().slice(0, 200) });
    }
  }
  return saida;
}

function valorCelula(v: Celula, rotulo: string, pendencias: string[]): number | null {
  if (vazio(v)) return null;
  const n = typeof v === "number" ? v : numeroBR(texto(v).replace(/[R$\s]/g, ""));
  if (n == null) {
    pendencias.push(`${rotulo}: "${texto(v)}" não é um número — não importado.`);
    return null;
  }
  // Valor estratégico abaixo de R$ 1 não é plausível — na planilha de origem
  // aparece 0,08 formatado como moeda, que parece um percentual. Não consolidar.
  if (Math.abs(n) < 1) {
    pendencias.push(`${rotulo}: ${String(n).replace(".", ",")} na planilha parece percentual, não moeda — não consolidado.`);
    return null;
  }
  return n;
}

/* ── Catálogo: unificar variações de digitação ────────────────────────────── */

function unificar(nomes: (string | null)[]) {
  const grupos = new Map<string, Map<string, number>>();
  for (const bruto of nomes) {
    const nome = bruto?.trim();
    if (!nome) continue;
    const chave = chaveNormalizada(nome);
    if (!grupos.has(chave)) grupos.set(chave, new Map());
    const g = grupos.get(chave)!;
    g.set(nome, (g.get(nome) ?? 0) + 1);
  }
  const resultado = new Map<string, { nome: string; variacoes: string[] }>();
  for (const [chave, variacoes] of grupos) {
    // Nome canônico = a grafia mais usada; empate fica com a mais longa (tende
    // a ser a completa: "Alteração de parâmetros" e não "Alteração parâmetros").
    const nome = [...variacoes.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    resultado.set(chave, { nome, variacoes: [...variacoes.keys()] });
  }
  return resultado;
}

/* ── Principal ────────────────────────────────────────────────────────────── */

export function lerPlanilha(
  abas: { nome: string; linhas: Celula[][] }[],
  hoje: Date = new Date(),
): PreviaImportacao {
  const avisos: string[] = [];

  let escolhida: { nome: string; linhas: Celula[][]; linhaCab: number; mapa: MapaColunas } | null = null;
  for (const aba of abas) {
    for (let i = 0; i < Math.min(aba.linhas.length, 15); i++) {
      const mapa = reconhecerCabecalho(aba.linhas[i] ?? []);
      if (mapa && (mapa.objetivo !== undefined || mapa.status !== undefined)) {
        escolhida = { ...aba, linhaCab: i, mapa };
        break;
      }
    }
    if (escolhida) break;
  }
  if (!escolhida) {
    throw new Error('Nenhuma aba com o cabeçalho esperado ("Assunto", "Objetivo", "Status Atual"...) foi encontrada.');
  }

  const { linhas, linhaCab, mapa } = escolhida;
  mapa.situacao = detectarSituacao(linhas, linhas[linhaCab], linhaCab + 1);
  const outras = abas.filter(a => a.nome !== escolhida!.nome).map(a => a.nome);
  if (outras.length) avisos.push(`Abas ignoradas (tabelas dinâmicas/resumos): ${outras.join(", ")}.`);

  const cab = linhas[linhaCab];
  const colunas: Record<string, string> = {};
  for (const [campo, i] of Object.entries(mapa)) {
    if (i !== undefined) colunas[campo] = vazio(cab[i]) ? "(sem cabeçalho)" : texto(cab[i]).trim();
  }

  const get = (l: Celula[], i?: number) => (i === undefined ? null : l[i]);
  const outrasColunas = (["objetivo", "andamentos", "valorPretendido", "valorAlcancado", "valorReequilibrio", "esfera", "status", "area", "situacao"] as const)
    .map(k => mapa[k]).filter((i): i is number => i !== undefined);

  // Linhas intermediárias: `_objetivo`, `_esfera` e `_areas` ainda com a
  // grafia da planilha; viram nome canônico depois de unificar o catálogo.
  const brutos: any[] = [];
  const grupos: string[] = [];
  let grupoAtual: string | null = null;

  for (let r = linhaCab + 1; r < linhas.length; r++) {
    const l = linhas[r] ?? [];
    const assunto = texto(get(l, mapa.assunto)).trim();
    if (!assunto) continue;

    if (outrasColunas.every(i => vazio(l[i]))) {
      grupoAtual = assunto;
      grupos.push(assunto);
      continue;
    }

    const pendencias: string[] = [];
    const statusOriginal = texto(get(l, mapa.status)).trim() || null;
    const situacaoOriginal = texto(get(l, mapa.situacao)).trim() || null;
    const andamentos = texto(get(l, mapa.andamentos)).trim() ? texto(get(l, mapa.andamentos)) : null;

    const mapeado = mapearStatus(statusOriginal, situacaoOriginal);
    if (mapeado.nota) pendencias.push(mapeado.nota);
    if (!situacaoOriginal && mapa.situacao !== undefined) pendencias.push("Situação (em andamento/suspenso) em branco na planilha.");

    const ehOportunidade = chaveNormalizada(grupoAtual ?? "").startsWith("oportunidade");
    let estagio: string | null = null;
    if (ehOportunidade) {
      estagio = mapeado.etapa === "levantamento" ? "em_estudo" : mapeado.etapa === "evidencias" ? "evidencia" : "identificada";
      pendencias.push(`Oportunidade: estágio "${estagio}" inferido do status — confirmar.`);
    }

    const { eventos, trechosSemData } = extrairEventos(andamentos, hoje);
    if (trechosSemData.length) {
      pendencias.push(`${trechosSemData.length} ${trechosSemData.length === 1 ? "trecho" : "trechos"} dos andamentos sem data clara — mantidos só no texto original.`);
    }
    const contextos = eventos.filter(e => e.contexto).length;
    if (contextos) pendencias.push("Datas de blocos distintos (processos diferentes) no mesmo assunto — conferir a timeline.");

    const valores = {
      valorPretendido: valorCelula(get(l, mapa.valorPretendido), "Valor pretendido", pendencias),
      valorAlcancado: valorCelula(get(l, mapa.valorAlcancado), "Valor alcançado", pendencias),
      valorReequilibrio: valorCelula(get(l, mapa.valorReequilibrio), "Valor de reequilíbrio", pendencias),
    };
    const citados = valoresCitados(andamentos);
    if (citados.length && Object.values(valores).every(v => v == null)) {
      pendencias.push(`${citados.length} ${citados.length === 1 ? "valor citado" : "valores citados"} no texto, sem valor consolidado nas colunas — revisar.`);
    }

    const areaTexto = texto(get(l, mapa.area)).trim();
    const areas = areaTexto.split(/[\/;,]/).map(a => a.trim()).filter(Boolean);
    if (!areas.length) pendencias.push("Área responsável não informada.");
    pendencias.push("Responsável executivo não informado na planilha.");
    if (!["suspenso", "concluido", "cancelado"].includes(mapeado.etapa)) {
      pendencias.push("Assunto ativo sem próxima ação — a planilha não tinha esse campo.");
    }

    const celulasOriginais: Record<string, string | number | null> = {};
    for (const [campo, i] of Object.entries(mapa)) {
      if (i === undefined) continue;
      const v = l[i];
      celulasOriginais[campo] = v == null ? null : typeof v === "number" ? v : texto(v);
    }

    const ultimaMovimentacao = eventos.length ? eventos.map(e => e.data).sort().reverse()[0] : null;

    brutos.push({
      linha: r + 1,
      chave: createHash("sha1").update(chaveNormalizada(assunto)).digest("hex").slice(0, 20),
      titulo: assunto,
      grupo: grupoAtual,
      tipo: ehOportunidade ? "oportunidade" : "assunto",
      estagioOportunidade: estagio,
      _objetivo: texto(get(l, mapa.objetivo)).trim() || null,
      _esfera: texto(get(l, mapa.esfera)).trim() || null,
      _areas: areas,
      statusOriginal,
      situacaoOriginal,
      etapa: mapeado.etapa,
      dependencia: mapeado.dependencia,
      andamentosOriginais: andamentos,
      eventos,
      trechosSemData,
      valores,
      valoresCitados: citados,
      celulasOriginais,
      pendencias,
      ultimaMovimentacao,
    });
  }

  const objetivos = unificar(brutos.map(b => (b._objetivo === "-" ? null : b._objetivo)));
  const esferas = unificar(brutos.map(b => b._esfera));
  const areas = unificar(brutos.flatMap(b => b._areas));

  const casos: CasoPrevia[] = brutos.map(b => {
    const objetivo = b._objetivo && b._objetivo !== "-" ? objetivos.get(chaveNormalizada(b._objetivo))!.nome : null;
    if (!objetivo) b.pendencias.push("Objetivo não informado.");
    const nomesArea = (b._areas as string[]).map(a => areas.get(chaveNormalizada(a))!.nome);
    const { _objetivo, _esfera, _areas, ...resto } = b;
    return {
      ...resto,
      objetivo,
      esfera: b._esfera ? esferas.get(chaveNormalizada(b._esfera))!.nome : null,
      areaOperacional: nomesArea[0] ?? null,
      areasApoio: [...new Set(nomesArea.slice(1))].filter(a => a !== nomesArea[0]),
    } as CasoPrevia;
  });

  const unificados = (m: Map<string, { nome: string; variacoes: string[] }>) => [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  for (const o of unificados(objetivos)) {
    if (o.variacoes.length > 1) avisos.push(`Objetivo "${o.nome}" unifica as grafias: ${o.variacoes.map(v => `"${v}"`).join(", ")}.`);
  }

  return {
    aba: escolhida.nome,
    linhaCabecalho: linhaCab + 1,
    colunas,
    casos,
    grupos,
    catalogos: {
      objetivo: unificados(objetivos),
      esfera: unificados(esferas),
      area: unificados(areas),
      dependencia: [...new Set(casos.map(c => c.dependencia).filter(Boolean) as string[])],
    },
    avisos,
  };
}
