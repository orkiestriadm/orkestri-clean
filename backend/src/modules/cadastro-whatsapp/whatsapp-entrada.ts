import { MARCA } from "../../common/marca";

export function numeroCadastro(valor: string | null | undefined): string {
  const digits = (valor || "").replace(/\D/g, "");
  const local =
    digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
  return /^[1-9]\d{9,10}$/.test(local) ? `55${local}` : "";
}

export function mesmoTelefoneCadastro(
  a: string,
  b: string | null | undefined,
): boolean {
  const x = numeroCadastro(a),
    y = numeroCadastro(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const localX = x.slice(2),
    localY = y.slice(2);
  if (localX.slice(0, 2) !== localY.slice(0, 2)) return false;
  const oldMobile = (phone: string) =>
    phone.length === 11 && phone[2] === "9"
      ? phone.slice(0, 2) + phone.slice(3)
      : phone;
  const shorter =
    localX.length === 10 ? localX : localY.length === 10 ? localY : "";
  return (
    !!shorter &&
    /^[6-9]/.test(shorter.slice(2)) &&
    oldMobile(localX) === oldMobile(localY)
  );
}

/**
 * O endereço que abre a conversa de cadastro já com a primeira palavra escrita.
 *
 * Existe porque a Aurélia passou a ser a ÚNICA porta de entrada: todo lugar que
 * antes oferecia cadastro próprio aponta para cá. O texto é "cadastro" porque é
 * o que `comandoCadastroGeral` reconhece — mudar um sem o outro quebra a porta.
 */
export function linkCadastroWhatsapp(): string {
  const numero = (process.env.LEADS_WHATSAPP_NUMERO || "5514991661688").replace(/\D/g, "");
  return `https://wa.me/${numero}?text=cadastro`;
}

export function comandoCadastroGeral(texto: string): boolean {
  const t = texto
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  return /^(cadastro|cadastrar|cadastro (?:no )?orkiestri|quero me cadastrar|quero fazer meu cadastro(?: no orkiestri)?)$/.test(
    t,
  );
}

export type SituacaoNumero = {
  tipo: "novo" | "existente" | "vincular" | "restrito" | "ambiguo";
  userId?: string;
};

/** Apenas consulta; telefone de contato não concede acesso nem cria vínculo. */
export async function consultarNumeroCadastro(
  prisma: any,
  numero: string,
  conversa = "",
): Promise<SituacaoNumero> {
  const lid = conversa.endsWith("@lid") ? conversa.split("@")[0] : "";
  const perfis = await prisma.userProfile.findMany({
    where: {
      OR: [
        { whatsapp: { not: null } },
        { telefone: { not: null } },
        ...(lid ? [{ whatsappLid: lid }] : []),
      ],
    },
    select: {
      userId: true,
      whatsapp: true,
      telefone: true,
      whatsappLid: true,
      user: { select: { id: true, ativo: true, bloqueado: true } },
    },
  });
  const ligados = perfis.filter(
    (p: any) =>
      (lid && p.whatsappLid === lid) ||
      mesmoTelefoneCadastro(numero, p.whatsapp),
  );
  if (ligados.length > 1) return { tipo: "ambiguo" };
  if (ligados.length === 1) {
    const perfil = ligados[0];
    if (!perfil.user?.ativo || perfil.user.bloqueado)
      return { tipo: "restrito" };
    return { tipo: "existente", userId: perfil.userId || perfil.user.id };
  }
  if (perfis.some((p: any) => mesmoTelefoneCadastro(numero, p.telefone)))
    return { tipo: "vincular" };
  return { tipo: "novo" };
}

export function mensagemPrimeiroContato(
  tipo: SituacaoNumero["tipo"],
  jaTemConta = false,
): string {
  if (tipo === "restrito" || tipo === "ambiguo")
    return `Oi! Sou a Aurélia, do *${MARCA}*. Preciso que nossa equipe confira o acesso deste número antes de continuar. Fale com o suporte pelo site. Não vou abrir outro cadastro para você.`;
  if (tipo === "existente")
    return `Oi! Sou a Aurélia, do *${MARCA}*. Você já tem cadastro com este WhatsApp. Envie *menu* para ver seus recursos ou *acesso* para receber as orientações de entrada.`;
  if (tipo === "vincular" || jaTemConta)
    return `Oi! Sou a Aurélia, do *${MARCA}*. Para usar sua conta existente com este WhatsApp, entre no sistema, abra seu *Perfil* e siga a opção *Criar evento pelo WhatsApp*. Envie aqui *VINCULAR* e o código que aparecer.\n\nSe precisar recuperar o acesso, use *Esqueci a senha* no site. Não precisa criar outra conta.`;
  return `Oi! Eu sou a *Aurélia*, do *${MARCA}*. 😊\nAjudo você a lembrar compromissos e organizar o dia pelo WhatsApp.\n\nComo posso ajudar?\n*1* — Criar minha conta gratuita\n*2* — Já tenho uma conta\n*3* — Conhecer o ${MARCA}\n*0* — Sair\n\nPara começar direto, responda *CADASTRO*. Eu faço uma pergunta de cada vez.`;
}
