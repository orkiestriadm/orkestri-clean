/**
 * Anonimização de ex-colaborador — regras puras.
 *
 * O módulo tinha soft delete e mais nada. Soft delete não é privacidade: o CPF,
 * o endereço, a data de nascimento e os documentos digitalizados continuam
 * inteiros no banco, indefinidamente, de gente que saiu há anos. A LGPD (art.
 * 15 e 16) manda eliminar o dado pessoal quando a finalidade acaba, e a
 * finalidade acaba quando o vínculo acaba e o prazo de guarda vence.
 *
 * O QUE ESTE MÓDULO **NÃO** FAZ, E POR QUÊ
 *
 * Não apaga automaticamente. A eliminação é irreversível e o prazo é só um
 * indício: uma reclamação trabalhista em curso obriga a guardar tudo, e o
 * sistema não sabe que ela existe. Então aqui se calcula ELEGIBILIDADE e se
 * oferece a ação; quem decide é gente, e a decisão fica auditada.
 *
 * O QUE SOBREVIVE À ANONIMIZAÇÃO
 *
 * O esqueleto do vínculo: que existiu um contrato, entre quais datas, em qual
 * cargo e setor, com qual histórico salarial. Isso não é dado pessoal
 * dispensável — é o que prova tempo de serviço para a previdência, o que
 * responde a fiscalização e o que sustenta a defesa da empresa numa ação. O
 * art. 16, I da LGPD ressalva exatamente essa guarda.
 *
 * O que some é o que identifica a PESSOA: nome, CPF, documentos, endereço,
 * contatos, telefone, e-mail pessoal, data de nascimento, foto. Depois disso a
 * linha vira uma estatística — "houve um analista pleno no setor de operações
 * de 2019 a 2024" — e não mais um cadastro de alguém.
 */

import { diasDeCalendario } from "../../../common/datas";

/**
 * Prazo padrão de guarda depois do desligamento.
 *
 * Cinco anos é a prescrição trabalhista (CLT art. 11 e CF art. 7º, XXIX): o
 * ex-empregado pode reclamar verbas nesse prazo, e até lá a empresa precisa do
 * cadastro para se defender. Antes disso, anonimizar destrói a própria prova.
 *
 * É PADRÃO, não lei absoluta: cada organização pode ter obrigação maior — o
 * prazo é parâmetro do cálculo, não constante embutida na regra.
 */
export const ANOS_GUARDA_PADRAO = 5;

export type MotivoInelegibilidade =
  | "nao_desligado"
  | "sem_data_desligamento"
  | "dentro_do_prazo"
  | "ja_anonimizado";

export type Elegibilidade = {
  elegivel: boolean;
  motivo: MotivoInelegibilidade | null;
  /** Quando o prazo de guarda vence. Nulo quando não há como calcular. */
  liberaEm: Date | null;
  /** Negativo quando o prazo já venceu. */
  diasParaLiberar: number | null;
};

export type SituacaoColaborador = {
  status: string;
  dataDesligamento: Date | null;
  anonimizadoEm: Date | null;
};

/**
 * A pessoa já pode ser anonimizada?
 *
 * A ordem das checagens é a ordem em que elas importam: quem está na ativa não
 * entra na conversa, e sem data de desligamento não há de onde contar prazo —
 * esse é um buraco de cadastro a corrigir, não um caso a liberar por omissão.
 */
export function avaliarElegibilidade(
  c: SituacaoColaborador,
  hoje: Date = new Date(),
  anosGuarda: number = ANOS_GUARDA_PADRAO,
): Elegibilidade {
  const nao = (motivo: MotivoInelegibilidade, liberaEm: Date | null = null, dias: number | null = null) =>
    ({ elegivel: false, motivo, liberaEm, diasParaLiberar: dias });

  if (c.anonimizadoEm) return nao("ja_anonimizado");
  if (c.status !== "DESLIGADO") return nao("nao_desligado");
  // Sem a data não se libera por padrão: na dúvida, guardar. O erro de guardar
  // demais se corrige depois; o de apagar cedo, não.
  if (!c.dataDesligamento) return nao("sem_data_desligamento");

  const liberaEm = new Date(c.dataDesligamento);
  liberaEm.setFullYear(liberaEm.getFullYear() + anosGuarda);

  const dias = diasDeCalendario(hoje, liberaEm);

  if (dias > 0) return nao("dentro_do_prazo", liberaEm, dias);
  return { elegivel: true, motivo: null, liberaEm, diasParaLiberar: dias };
}

export const EXPLICACAO_INELEGIBILIDADE: Record<MotivoInelegibilidade, string> = {
  nao_desligado: "A pessoa não está desligada — o vínculo ainda é a finalidade do dado.",
  sem_data_desligamento: "Falta a data de desligamento no cadastro, e sem ela não há prazo a contar.",
  dentro_do_prazo: "Ainda dentro do prazo de guarda — o cadastro sustenta a defesa em eventual ação trabalhista.",
  ja_anonimizado: "Este cadastro já foi anonimizado.",
};

/**
 * Os valores que substituem o dado pessoal.
 *
 * Substituir e não esvaziar: campo nulo é ambíguo — pode ser dado apagado ou
 * dado que nunca foi preenchido. O rótulo diz o que aconteceu, e a tela para
 * de parecer um cadastro pela metade.
 *
 * O `referencia` entra no nome para que a linha continue distinguível das
 * outras sem identificar ninguém: sem ele, cinquenta ex-colaboradores viram
 * cinquenta linhas idênticas e o histórico funcional fica ilegível.
 */
export function valoresAnonimos(referencia: string) {
  return {
    nomeCompleto: `Colaborador anonimizado ${referencia}`,
    emailPessoal: null,
    emailCorporativo: null,
    celular: null,
    telefone: null,
    dataNascimento: null,
    genero: null,
    estadoCivil: null,
    nacionalidade: null,
    fotoUrl: null,
    matricula: null,
    // O login também vai: manter o vínculo permitiria voltar ao nome pela
    // tabela de usuários, e aí a anonimização seria só aparente.
    userId: null,
    // Legado, e cheio de dado livre digitado à mão.
    skills: null,
    certificacoes: null,
  };
}
