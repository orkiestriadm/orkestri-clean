/**
 * Resolve a instância WhatsApp de uma organização, preferindo a versão que
 * protege contra vazamento entre clientes.
 *
 * `resolveInstanceSegura` recusa o aparelho compartilhado quando a organização
 * não tem instância própria E existe mais de uma organização no sistema — sem
 * isso, a mensagem do cliente B sairia pelo telefone do cliente A, com o nome e
 * a foto de perfil dele.
 *
 * O acesso é feito por checagem em tempo de execução, e não por chamada direta,
 * por um motivo concreto: o `whatsapp.service.ts` está em versões diferentes
 * entre os ambientes, e o servidor de homologação ainda não tem o método.
 * Chamá-lo direto quebraria o build lá — e atualizar aquele arquivo arrastaria
 * junto a troca da marca exibida em TODAS as mensagens ("Orkestri" → "Orkiestri"),
 * decisão que não cabe a um ajuste de multi-tenant.
 *
 * Quando o ambiente receber a versão nova, a proteção passa a valer sozinha,
 * sem tocar neste arquivo. Até lá, o comportamento é o anterior — que é seguro
 * onde só existe uma organização, que é o caso de homologação.
 */
export async function resolverInstancia(wa: any, orgId: string): Promise<string | null> {
  if (typeof wa?.resolveInstanceSegura === "function") {
    return wa.resolveInstanceSegura(orgId).catch(() => null);
  }
  return wa?.resolveInstance?.(orgId).catch(() => null) ?? null;
}
