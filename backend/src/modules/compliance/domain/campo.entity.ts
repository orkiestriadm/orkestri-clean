/**
 * Campos personalizados por categoria.
 *
 * É o que permite a mesma tabela guardar "Número do Processo / CETESB /
 * Condicionantes" em Meio Ambiente e "Fabricante / Chave / Servidor" em
 * Software, sem um formulário com quarenta campos vazios em cada tela.
 *
 * O valor é gravado em coluna tipada (`valor_texto`, `valor_numero`,
 * `valor_data`, `valor_bool`) e não num Json solto: filtrar "processo contém
 * 1035" ou ordenar por data de condicionante exige coluna de verdade.
 */

export const TIPO_CAMPO = {
  TEXTO: "texto",
  TEXTO_LONGO: "texto_longo",
  NUMERO: "numero",
  DATA: "data",
  BOOLEANO: "booleano",
  SELECAO: "selecao",
} as const;

export type TipoCampo = (typeof TIPO_CAMPO)[keyof typeof TIPO_CAMPO];
export const TIPO_CAMPO_VALUES = Object.values(TIPO_CAMPO) as TipoCampo[];

export type ValorColunas = {
  valorTexto: string | null;
  valorNumero: number | null;
  valorData: Date | null;
  valorBool: boolean | null;
};

const VAZIO: ValorColunas = { valorTexto: null, valorNumero: null, valorData: null, valorBool: null };

export class ValorCampoInvalido extends Error {
  constructor(public readonly rotulo: string, motivo: string) {
    super(`${rotulo}: ${motivo}`);
    this.name = "ValorCampoInvalido";
  }
}

/**
 * Converte o valor cru recebido da API para as colunas tipadas.
 *
 * Recusa em vez de gravar lixo: um "abc" num campo numérico viraria NULL
 * silencioso, e o usuário só descobriria meses depois, ao filtrar e não achar.
 */
export function coagirValor(
  definicao: { tipo: string; rotulo: string; obrigatorio?: boolean; opcoes?: unknown },
  valor: unknown,
): ValorColunas {
  const ausente = valor === null || valor === undefined || valor === "";

  if (ausente) {
    if (definicao.obrigatorio) throw new ValorCampoInvalido(definicao.rotulo, "é obrigatório");
    return { ...VAZIO };
  }

  switch (definicao.tipo) {
    case TIPO_CAMPO.NUMERO: {
      const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
      if (!Number.isFinite(n)) throw new ValorCampoInvalido(definicao.rotulo, "não é um número");
      return { ...VAZIO, valorNumero: n };
    }

    case TIPO_CAMPO.DATA: {
      const d = valor instanceof Date ? valor : new Date(String(valor));
      if (Number.isNaN(d.getTime())) throw new ValorCampoInvalido(definicao.rotulo, "não é uma data válida");
      return { ...VAZIO, valorData: d };
    }

    case TIPO_CAMPO.BOOLEANO: {
      if (typeof valor === "boolean") return { ...VAZIO, valorBool: valor };
      const t = String(valor).toLowerCase();
      if (["true", "1", "sim"].includes(t)) return { ...VAZIO, valorBool: true };
      if (["false", "0", "nao", "não"].includes(t)) return { ...VAZIO, valorBool: false };
      throw new ValorCampoInvalido(definicao.rotulo, "não é sim/não");
    }

    case TIPO_CAMPO.SELECAO: {
      const texto = String(valor);
      const opcoes = normalizarOpcoes(definicao.opcoes);
      // Lista vazia significa "ainda não configurou as opções" — aceitar é
      // melhor que travar o cadastro por causa de uma configuração incompleta.
      if (opcoes.length > 0 && !opcoes.includes(texto)) {
        throw new ValorCampoInvalido(
          definicao.rotulo, `valor não está entre as opções (${opcoes.join(", ")})`,
        );
      }
      return { ...VAZIO, valorTexto: texto };
    }

    default:
      return { ...VAZIO, valorTexto: String(valor) };
  }
}

/** O inverso: colunas tipadas → valor para a API e para os templates. */
export function lerValor(
  tipo: string,
  colunas: Partial<ValorColunas>,
): string | number | boolean | Date | null {
  switch (tipo) {
    case TIPO_CAMPO.NUMERO:   return colunas.valorNumero ?? null;
    case TIPO_CAMPO.DATA:     return colunas.valorData ?? null;
    case TIPO_CAMPO.BOOLEANO: return colunas.valorBool ?? null;
    default:                  return colunas.valorTexto ?? null;
  }
}

export function normalizarOpcoes(opcoes: unknown): string[] {
  if (!Array.isArray(opcoes)) return [];
  return opcoes.map(o => String(o)).filter(o => o.length > 0);
}

/**
 * Chave estável a partir do rótulo — `Número do Processo` → `numero_do_processo`.
 *
 * A chave entra nos templates de mensagem (`{{campo.numero_do_processo}}`), por
 * isso não pode ter acento nem espaço, e não muda quando o rótulo é corrigido.
 */
export function chaveDeRotulo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
}
