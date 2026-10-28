import { NotFoundException, InternalServerErrorException } from "@nestjs/common";

/**
 * Resolucao de registro POR DONO, e nao so por id.
 *
 * O defeito que isto fecha aparecia assim, repetido em dezenas de rotas:
 *
 *     const existing = await this.db.ativo.findUnique({ where: { id } });
 *     if (!existing) throw new NotFoundException("Ativo nao encontrado");
 *     return this.db.ativo.update({ where: { id }, data });
 *
 * A consulta confirma que o registro EXISTE — nao que ele e de quem pediu. O
 * `@Permissions("ativos:editar")` tambem nao ajuda: ele garante que o usuario
 * tem a permissao, nao que o objeto e da organizacao dele. Resultado: qualquer
 * usuario autenticado editava e apagava dado de outro cliente.
 *
 * O padrao correto no Prisma e verificar a posse ANTES de mutar, porque
 * `update`/`delete` exigem campo unico no `where` e nao aceitam
 * `organizationId` junto.
 */

/**
 * Extrai a organizacao de quem chamou, recusando o valor ausente.
 *
 * ISTO E O CORACAO DA PROTECAO. No Prisma, `where: { id, organizationId:
 * undefined }` NAO filtra por organizacao — o campo `undefined` e descartado da
 * consulta, e o resultado volta a ser "qualquer registro com este id". Ou seja,
 * um `req.user` sem `organizationId` reabriria silenciosamente exatamente o
 * furo que este arquivo existe para fechar, sem erro nenhum.
 *
 * Por isso falha alto em vez de seguir: e melhor a rota quebrar do que vazar.
 */
export function organizacaoDe(req: any): string {
  const orgId = req?.user?.organizationId;
  if (typeof orgId !== "string" || orgId.length === 0) {
    throw new InternalServerErrorException(
      "Requisicao sem organizacao definida — escopo nao pode ser aplicado.",
    );
  }
  return orgId;
}

type Delegate<T> = { findFirst(args: any): Promise<T | null> };

/**
 * Devolve o registro somente se ele pertencer a organizacao de quem chamou.
 *
 * Responde 404 e nao 403 de proposito: para quem esta fora da organizacao, o
 * registro nao existe. Um 403 confirmaria que aquele id e valido em outro
 * tenant, o que ja e vazamento de informacao.
 *
 * @param extras `include`/`select`/`where` adicionais, quando a rota precisa
 *               carregar relacoes ou restringir mais (ex.: `deletedAt: null`).
 */
// `T = any` e deliberado: os modulos chamam com `(this.prisma as any).modelo`,
// entao nao ha o que inferir. Sem o default, T vira `unknown` e todo acesso a
// campo do registro passa a nao compilar — trocaria um problema de seguranca
// por dezenas de erros de tipo sem ganho nenhum.
export async function acharNaOrganizacao<T = any>(
  delegate: Delegate<T>,
  id: string,
  req: any,
  naoEncontrado: string,
  extras: { include?: any; select?: any; where?: any } = {},
): Promise<T> {
  const organizationId = organizacaoDe(req);
  const { where: whereExtra, ...resto } = extras;

  const registro = await delegate.findFirst({
    where: { ...(whereExtra || {}), id, organizationId },
    ...resto,
  });

  if (!registro) throw new NotFoundException(naoEncontrado);
  return registro;
}
