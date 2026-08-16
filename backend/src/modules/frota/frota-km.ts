/**
 * Hodômetro do veículo — o abastecimento é a fonte viva.
 *
 * `veiculos.km_atual` é o número que o resto do módulo lê: a agenda de revisão
 * por KM, o desgaste de pneu, o custo por quilômetro. Só que ninguém edita
 * cadastro de veículo todo dia — quem toca a frota todo dia é o abastecimento,
 * que chega pela planilha do cartão-combustível com o KM lido na bomba.
 *
 * Antes esse elo existia em três lugares soltos: o `beforeCreate` do
 * abastecimento, o botão "Atualizar KM" do veículo e o botão "sincronizar" da
 * agenda. Editar ou apagar um abastecimento não mexia em nada, e a agenda de
 * revisão passava a projetar em cima de um hodômetro velho — sem erro nenhum
 * na tela, que é o pior tipo de erro que este módulo já teve.
 *
 * Aqui a regra é uma só e todo mundo chama.
 *
 * ## Por que o KM só sobe
 *
 * Hodômetro é monotônico. Um abastecimento com KM menor que o atual é quase
 * sempre digitação errada (ou a bomba de outro veículo), e deixar o número
 * descer faria a revisão "desvencer" sozinha. Correção para baixo existe, mas é
 * decisão humana explícita — o endpoint `POST /frota/veiculos/:id/atualizar-km`
 * com `{ km }` no corpo.
 *
 * ## Por que existe teto de salto
 *
 * A planilha real traz placeholder (999999) e leitura absurda (852809 num
 * veículo na casa dos 40 mil). Sem o teto, uma linha dessas viraria o hodômetro
 * do veículo e a agenda de revisão inteira daquele veículo iria para vermelho
 * permanente. O teto é o mesmo da importação, porque o problema é o mesmo dado.
 */

/** Avanço plausível de hodômetro entre duas leituras conhecidas. */
export const KM_SALTO_MAX = 30000;

/** Teto absoluto para veículo sem baseline (km_atual = 0): acima disso é lixo. */
export const KM_ABSURDO = 2000000;

/**
 * O KM do abastecimento pode virar hodômetro do veículo?
 *
 * Sem baseline aceita qualquer leitura sã (é o primeiro número que o veículo
 * tem). Com baseline, exige avanço e limita o salto.
 */
export function kmPlausivel(atual: number | null | undefined, novo: number | null | undefined): boolean {
  if (novo == null || !isFinite(novo) || novo <= 0) return false;
  const base = atual ?? 0;
  if (base === 0) return novo < KM_ABSURDO;
  return novo > base && novo - base <= KM_SALTO_MAX;
}

type VeiculoKm = { id: string; kmAtual: number | null };

export type ResultadoSincronizacaoKm = {
  /** Quantos veículos tiveram o hodômetro avançado nesta chamada. */
  atualizados: number;
  /** Quantos foram avaliados. */
  total: number;
  /** KM efetivo por veículo DEPOIS da reconciliação — inclui quem não mudou. */
  km: Map<string, number>;
  /** Leituras recusadas pelo teto de salto, para a tela poder avisar. */
  recusados: { veiculoId: string; kmAtual: number; kmAbastecimento: number }[];
};

/**
 * Reconcilia `veiculos.km_atual` com o maior KM lançado em abastecimento.
 *
 * Devolve o KM efetivo de cada veículo para quem chamou usar na mesma
 * requisição — a agenda de revisão precisa do número reconciliado AGORA, não no
 * próximo request, senão a tela mostra a projeção velha uma vez a cada mudança.
 *
 * Passar `veiculoIds` restringe o trabalho (usado nos hooks de escrita do
 * abastecimento, que mexem num veículo só). Sem ele, varre a organização.
 */
export async function sincronizarKmPorAbastecimento(
  db: any,
  opts: { orgId?: string | null; veiculoIds?: string[]; veiculos?: VeiculoKm[] } = {},
): Promise<ResultadoSincronizacaoKm> {
  const { orgId, veiculoIds } = opts;
  const vazio: ResultadoSincronizacaoKm = { atualizados: 0, total: 0, km: new Map(), recusados: [] };
  if (veiculoIds && !veiculoIds.length) return vazio;

  const veiculos: VeiculoKm[] = opts.veiculos ?? await db.veiculo.findMany({
    where: {
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
      ...(veiculoIds ? { id: { in: veiculoIds } } : {}),
    },
    select: { id: true, kmAtual: true },
  });
  if (!veiculos.length) return vazio;

  // Uma consulta agregada para a frota inteira. A versão anterior fazia um
  // findFirst por veículo dentro de um for — 118 idas ao banco para responder
  // uma tela.
  const maximos: any[] = await db.abastecimento.groupBy({
    by: ["veiculoId"],
    where: {
      deletedAt: null,
      kmAtual: { not: null },
      ...(orgId ? { organizationId: orgId } : {}),
      veiculoId: { in: veiculos.map(v => v.id) },
    },
    _max: { kmAtual: true },
  }).catch(() => []);

  const maiorPorVeiculo = new Map<string, number>();
  for (const m of maximos) {
    if (m?.veiculoId && m?._max?.kmAtual != null) maiorPorVeiculo.set(m.veiculoId, Number(m._max.kmAtual));
  }

  const km = new Map<string, number>();
  const recusados: ResultadoSincronizacaoKm["recusados"] = [];
  const avancar: { id: string; km: number }[] = [];

  for (const v of veiculos) {
    const atual = v.kmAtual ?? 0;
    km.set(v.id, atual);
    const doAbastecimento = maiorPorVeiculo.get(v.id);
    if (doAbastecimento == null || doAbastecimento <= atual) continue;
    if (kmPlausivel(atual, doAbastecimento)) {
      km.set(v.id, doAbastecimento);
      avancar.push({ id: v.id, km: doAbastecimento });
    } else {
      recusados.push({ veiculoId: v.id, kmAtual: atual, kmAbastecimento: doAbastecimento });
    }
  }

  // `kmAtual: { lt }` na condição para não derrubar uma escrita concorrente que
  // já tenha avançado mais — o mesmo cuidado que corrigiu o import parcial.
  for (const a of avancar) {
    await db.veiculo.updateMany({
      where: { id: a.id, kmAtual: { lt: a.km } },
      data: { kmAtual: a.km },
    }).catch(() => {});
    await propagarKmAosPneus(db, a.id, a.km);
  }

  return { atualizados: avancar.length, total: veiculos.length, km, recusados };
}

/**
 * O pneu montado roda o que o veículo roda.
 *
 * `pneu.km_atual` é a leitura do hodômetro DO VEÍCULO no pneu — é com ela que
 * se calcula quanto o pneu já rodou (`km_atual - km_inicial`), o desgaste, o
 * marco de rodízio e o custo por quilômetro. Só que nada a movia: o campo era
 * escrito apenas quando alguém registrava um evento de pneu à mão. Resultado —
 * pneu instalado há 40 mil km continuava marcando o mesmo número do dia da
 * instalação, o alerta de rodízio nunca disparava e o custo/km ficava
 * artificialmente alto.
 *
 * Só pneu `em_uso` recebe: pneu em estoque, em recapagem ou descartado não está
 * rodando, e mexer nele inventaria quilometragem que não existiu.
 */
export async function propagarKmAosPneus(db: any, veiculoId: string, km: number): Promise<number> {
  const r = await db.pneu.updateMany({
    where: { veiculoId, deletedAt: null, status: "em_uso", OR: [{ kmAtual: null }, { kmAtual: { lt: km } }] },
    data: { kmAtual: km },
  }).catch(() => ({ count: 0 }));
  return r?.count ?? 0;
}
