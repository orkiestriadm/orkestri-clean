import { PreviaImportacao } from "../domain/importacao.parser";
import { calcularFarol, PARAMETROS_PADRAO } from "../domain/farol.entity";
import { chaveNormalizada, naturezaDe, formatarCodigo, DEPENDENCIAS_PADRAO, etapaDe } from "../domain/caso.entity";

/**
 * Gravação da importação — separada do serviço Nest para ser usada também pelo
 * script de linha de comando (cli/importar-planilha.ts), com o mesmo resultado.
 *
 * Idempotente pela `importacaoChave` (título normalizado): importar a mesma
 * planilha duas vezes não duplica nada — o que já existe é listado como
 * ignorado, inclusive o que foi excluído depois (reimportar não ressuscita).
 *
 * Tudo numa transação: ou entra a planilha inteira, ou nada.
 */

export type ResultadoImportacao = {
  criados: { codigo: string; titulo: string; eventos: number; pendencias: number }[];
  ignorados: { titulo: string; motivo: string }[];
  eventos: number;
  dependencias: number;
  catalogosCriados: string[];
};

const dataDia = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00.000Z`) : null);

export async function executarImportacao(
  db: any,
  p: { organizationId: string; userId: string | null; previa: PreviaImportacao; arquivo: string; hoje?: Date },
): Promise<ResultadoImportacao> {
  const { organizationId, userId, previa } = p;
  const hoje = p.hoje ?? new Date();
  const resultado: ResultadoImportacao = { criados: [], ignorados: [], eventos: 0, dependencias: 0, catalogosCriados: [] };

  await db.$transaction(async (tx: any) => {
    // ── Catálogos ──────────────────────────────────────────────────────────
    const existentes = await tx.estrategicoCatalogo.findMany({ where: { organizationId } });
    const porChave = new Map<string, any>(existentes.map((c: any) => [`${c.tipo}:${chaveNormalizada(c.nome)}`, c]));

    const garantir = async (tipo: string, nome: string | null, extra: Record<string, any> = {}) => {
      if (!nome?.trim()) return null;
      const k = `${tipo}:${chaveNormalizada(nome)}`;
      if (porChave.has(k)) return porChave.get(k).id;
      const criado = await tx.estrategicoCatalogo.create({
        data: { organizationId, tipo, nome: nome.trim(), ordem: porChave.size, ...extra },
      });
      porChave.set(k, criado);
      resultado.catalogosCriados.push(`${tipo}: ${criado.nome}`);
      return criado.id;
    };

    if (!existentes.some((c: any) => c.tipo === "dependencia")) {
      for (const d of DEPENDENCIAS_PADRAO) await garantir("dependencia", d.nome, { natureza: d.natureza });
    }

    // ── Já importados ──────────────────────────────────────────────────────
    const chaves = previa.casos.map(c => c.chave);
    const jaExistem = await tx.estrategicoCaso.findMany({
      where: { organizationId, importacaoChave: { in: chaves } },
      select: { importacaoChave: true, codigo: true, deletedAt: true },
    });
    const existentesPorChave = new Map(jaExistem.map((c: any) => [c.importacaoChave, c]));

    const ultimo = await tx.estrategicoCaso.findFirst({ where: { organizationId }, orderBy: { codigo: "desc" }, select: { codigo: true } });
    let sequencial = ultimo ? Number(String(ultimo.codigo).replace(/\D/g, "")) || 0 : 0;

    for (const c of previa.casos) {
      const existente: any = existentesPorChave.get(c.chave);
      if (existente) {
        resultado.ignorados.push({
          titulo: c.titulo,
          motivo: existente.deletedAt ? `Já importado como ${existente.codigo} (excluído depois)` : `Já importado como ${existente.codigo}`,
        });
        continue;
      }

      const grupoId = await garantir("grupo", c.grupo);
      const objetivoId = await garantir("objetivo", c.objetivo);
      const esferaId = await garantir("esfera", c.esfera);
      const areaOperacionalId = await garantir("area", c.areaOperacional);
      const apoios: string[] = [];
      for (const a of c.areasApoio) {
        const id = await garantir("area", a);
        if (id && id !== areaOperacionalId) apoios.push(id);
      }
      const dependenciaId = c.dependencia
        ? await garantir("dependencia", c.dependencia, { natureza: DEPENDENCIAS_PADRAO.find(d => d.nome === c.dependencia)?.natureza ?? "externa" })
        : null;

      const pendencias = [...c.pendencias];
      if (c.dependencia) pendencias.push(`Data de início da dependência de ${c.dependencia} desconhecida — informar para medir o tempo de espera.`);

      const farol = calcularFarol({
        tipo: c.tipo, etapa: c.etapa, estagioOportunidade: c.estagioOportunidade, prioridade: "media",
        proximaAcao: null, proximaAcaoPrazo: null, ultimaMovimentacaoEm: dataDia(c.ultimaMovimentacao),
        valorEmRisco: null, dependencias: [],
      }, PARAMETROS_PADRAO, hoje);

      sequencial++;
      const codigo = formatarCodigo(sequencial);
      const caso = await tx.estrategicoCaso.create({
        data: {
          organizationId, codigo, titulo: c.titulo.trim(), tipo: c.tipo,
          estagioOportunidade: c.estagioOportunidade, etapa: c.etapa, prioridade: "media",
          grupoId, objetivoId, esferaId, areaOperacionalId,
          valorPretendido: c.valores.valorPretendido, valorAlcancado: c.valores.valorAlcancado,
          valorReequilibrio: c.valores.valorReequilibrio,
          ultimaMovimentacaoEm: dataDia(c.ultimaMovimentacao),
          encerradoEm: naturezaDe(c.etapa) === "encerrada" ? hoje : null,
          statusOriginal: [c.statusOriginal, c.situacaoOriginal].filter(Boolean).join(" · ") || null,
          andamentosOriginais: c.andamentosOriginais,
          importacaoChave: c.chave,
          importacaoDados: {
            arquivo: p.arquivo, aba: previa.aba, linha: c.linha, grupo: c.grupo,
            celulasOriginais: c.celulasOriginais, pendencias, trechosSemData: c.trechosSemData,
            valoresCitados: c.valoresCitados, importadoEm: hoje.toISOString(),
          },
          revisarImportacao: true,
          farolCalculado: farol.farol, farolMotivos: farol.motivos, farolCalculadoEm: hoje,
          criadoPorId: userId, atualizadoPorId: userId,
        },
      });

      if (apoios.length) {
        await tx.estrategicoCasoArea.createMany({ data: [...new Set(apoios)].map(areaId => ({ casoId: caso.id, areaId })), skipDuplicates: true });
      }
      if (dependenciaId) {
        await tx.estrategicoDependencia.create({
          data: {
            organizationId, casoId: caso.id, catalogoId: dependenciaId, desde: null,
            descricao: `Importado do status "${c.statusOriginal}" da planilha.`,
          },
        });
        resultado.dependencias++;
      }
      if (c.eventos.length) {
        await tx.estrategicoEvento.createMany({
          data: c.eventos.map(e => ({
            organizationId, casoId: caso.id, tipo: e.tipo, dataEvento: dataDia(e.data), precisaoData: e.precisao,
            titulo: e.titulo, descricao: e.contexto ? `${e.descricao}\n\nContexto na planilha: ${e.contexto}` : e.descricao,
            origem: "importacao", autorId: userId, revisar: !!e.contexto || e.precisao === "mes",
          })),
        });
        resultado.eventos += c.eventos.length;
      }
      for (const [campo, valor] of Object.entries(c.valores)) {
        if (valor == null) continue;
        await tx.estrategicoValorHistorico.create({
          data: { organizationId, casoId: caso.id, campo, valorAnterior: null, valorNovo: valor, observacao: "Importado da planilha", userId, origem: "importacao" },
        });
      }
      await tx.estrategicoHistorico.create({
        data: {
          organizationId, casoId: caso.id, userId, acao: "importou", origem: "importacao",
          descricao: `Importado de "${p.arquivo}" (aba ${previa.aba}, linha ${c.linha}) na etapa "${etapaDe(c.etapa)?.rotulo}". ${c.eventos.length} andamento(s) convertido(s); ${pendencias.length} ponto(s) para revisão.`,
        },
      });
      resultado.criados.push({ codigo, titulo: caso.titulo, eventos: c.eventos.length, pendencias: pendencias.length });
    }
  }, { timeout: 180_000, maxWait: 15_000 });

  return resultado;
}
