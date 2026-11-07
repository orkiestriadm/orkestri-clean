/**
 * Redação preventiva para exemplos de melhoria da Aurélia.
 * Não substitui consentimento nem autorização de acesso: é uma segunda barreira
 * antes de qualquer armazenamento para avaliação ou aprendizado.
 */
export function anonimizarExemploAurelia(texto: string): string {
  return String(texto || "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]")
    .replace(/https?:\/\/\S+/gi, "[LINK]")
    .replace(/(CPF\s*)\d{11}\b/gi, "$1[CPF]")
    .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[TELEFONE]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/\b\d{11}\b/g, "[IDENTIFICADOR]")
    .replace(/R\$\s*[\d.]+(?:,\d{1,2})?/gi, "[VALOR]")
    .replace(/\b\d+[,.]?\d*\s*(?:reais| reais)\b/gi, "[VALOR]")
    .replace(/\s{2,}/g, " ")
    .trim();
}
