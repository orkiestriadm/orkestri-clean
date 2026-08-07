import {
  situacaoPrazo, distancias, gravidade, SituacaoPrazo,
} from "../domain/obrigacao.entity";
import { lerValor } from "../domain/campo.entity";

/**
 * Monta a forma que a API devolve.
 *
 * Existe para que a situação de prazo seja calculada em UM lugar. Espalhá-la
 * pelos serviços — listagem, detalhe, exportação, calendário — reproduziria o
 * defeito da planilha: quatro lugares dizendo coisas diferentes sobre a mesma
 * licença.
 */

export const ROTULO_SITUACAO: Readonly<Record<SituacaoPrazo, string>> = Object.freeze({
  sem_validade: "Sem validade",
  vigente: "Vigente",
  renovacao_devida: "Renovação devida",
  prazo_fatal_vencido: "Prazo fatal vencido",
  vencida: "Vencida",
  prorrogada: "Prorrogada por protocolo",
});

/** Tom semântico do selo — o frontend não escolhe cor, escolhe significado. */
export const TOM_SITUACAO: Readonly<Record<SituacaoPrazo, string>> = Object.freeze({
  sem_validade: "neutro",
  vigente: "ok",
  renovacao_devida: "atencao",
  prazo_fatal_vencido: "critico",
  vencida: "critico",
  prorrogada: "info",
});

export type ObrigacaoApresentada = Record<string, any>;

export function apresentar(o: any, hoje: Date = new Date()): ObrigacaoApresentada {
  const entrada = {
    dataValidade: o.dataValidade,
    prazoFatalEm: o.prazoFatalEm,
    prazoInternoEm: o.prazoInternoEm,
    renovacaoAutomatica: o.renovacaoAutomatica,
    protocoloEm: o.protocoloEm,
  };

  const situacao = situacaoPrazo(entrada, hoje);
  const d = distancias(entrada, hoje);

  const { camposValores, favoritos, tags, ...resto } = o;

  return {
    ...resto,
    tags: (tags ?? []).map((t: any) => t.tag ?? t),
    // Só o favorito de quem pediu vem do repositório; a presença da linha é a
    // resposta.
    favorito: Array.isArray(favoritos) ? favoritos.length > 0 : false,
    situacao,
    situacaoRotulo: ROTULO_SITUACAO[situacao],
    situacaoTom: TOM_SITUACAO[situacao],
    gravidade: gravidade(situacao),
    ...d,
    campos: montarCampos(o),
  };
}

export function apresentarLista(itens: any[], hoje: Date = new Date()) {
  return itens.map(i => apresentar(i, hoje));
}

/**
 * Junta definição e valor dos campos personalizados numa lista pronta para a
 * tela: rótulo, tipo e valor, na ordem definida pela categoria.
 *
 * Um campo definido e não preenchido aparece com valor nulo, e não some — a
 * tela precisa mostrar o formulário completo, não só o que já foi respondido.
 */
function montarCampos(o: any): { chave: string; rotulo: string; tipo: string; valor: any }[] {
  const definicoes = o.categoria?.campos;
  if (!Array.isArray(definicoes)) return [];

  const porId = new Map<string, any>(
    (o.camposValores ?? []).map((v: any) => [v.campoId, v]),
  );

  return definicoes.map((def: any) => ({
    chave: def.chave,
    rotulo: def.rotulo,
    tipo: def.tipo,
    obrigatorio: def.obrigatorio,
    ajuda: def.ajuda ?? null,
    opcoes: def.opcoes ?? [],
    valor: lerValor(def.tipo, porId.get(def.id) ?? {}),
  }));
}

/** Mapa chave → texto, para alimentar os `{{campo.x}}` dos templates. */
export function camposComoTexto(o: any): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const v of o.camposValores ?? []) {
    const chave = v.campo?.chave;
    if (!chave) continue;
    const valor = lerValor(v.campo.tipo, v);
    if (valor == null) continue;
    saida[chave] = valor instanceof Date
      ? valor.toISOString().slice(0, 10)
      : String(valor);
  }
  return saida;
}
