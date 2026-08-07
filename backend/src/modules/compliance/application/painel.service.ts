import { Injectable } from "@nestjs/common";
import { PainelRepository } from "../infrastructure/painel.repository";
import { apresentarLista } from "./obrigacao.presenter";
import { situacaoPrazo, distancias } from "../domain/obrigacao.entity";

type Usuario = { id: string; organizationId: string };

/**
 * Painel executivo e calendário.
 *
 * Toda contagem sai do banco; nada é somado em memória a partir da carteira
 * inteira. Com 36 licenças a diferença não apareceria — com 3.600, a página
 * deixaria de abrir.
 */
@Injectable()
export class PainelService {
  constructor(private readonly repo: PainelRepository) {}

  async painel(user: Usuario) {
    const hoje = new Date();
    const orgId = user.organizationId;

    // Janela do gráfico de linha do tempo: 6 meses para trás (o que já venceu
    // e continua pendente é informação, não passado) e 24 para a frente.
    const de = new Date(hoje.getTime()); de.setMonth(de.getMonth() - 6);
    const ate = new Date(hoje.getTime()); ate.setMonth(ate.getMonth() + 24);

    const [
      cartoes, porCategoria, porStatus, porCriticidade, porUnidade,
      porDepartamento, porResponsavel, vencimentos, fila, custos,
    ] = await Promise.all([
      this.repo.cartoes(orgId, hoje),
      this.repo.porCategoria(orgId),
      this.repo.porColuna(orgId, "status"),
      this.repo.porColuna(orgId, "criticidade"),
      this.repo.porColuna(orgId, "unidade"),
      this.repo.porColuna(orgId, "departamento"),
      this.repo.porResponsavel(orgId),
      this.repo.vencimentosPorMes(orgId, de, ate),
      this.repo.filaDeAcao(orgId, hoje, 25),
      this.repo.custos(orgId),
    ]);

    return {
      cartoes,
      graficos: {
        porCategoria, porStatus, porCriticidade, porUnidade,
        porDepartamento, porResponsavel, vencimentos,
      },
      filaDeAcao: apresentarLista(fila, hoje),
      custos: {
        totalLicencas: Number(custos.agregado?._sum?.valorLicenca ?? 0),
        totalRenovacoes: Number(custos.agregado?._sum?.valorRenovacao ?? 0),
        obrigacoesComCusto: custos.agregado?._count?._all ?? 0,
        porCategoria: custos.porCategoria.map((c: any) => ({
          categoriaId: c.categoriaId,
          nome: porCategoria.find((p: any) => p.categoriaId === c.categoriaId)?.nome ?? "—",
          licenca: Number(c._sum?.valorLicenca ?? 0),
          renovacao: Number(c._sum?.valorRenovacao ?? 0),
        })),
      },
      geradoEm: hoje.toISOString(),
    };
  }

  /**
   * Painel pessoal: o que é MEU.
   *
   * Existe separado porque a pergunta é outra. O painel executivo responde
   * "como está a organização"; este responde "o que eu preciso fazer" — e
   * quem responde a segunda pergunta não deveria ter que filtrar a primeira.
   */
  async meuPainel(user: Usuario) {
    const hoje = new Date();
    const minhas = await this.repo.minhasObrigacoes(user.organizationId, user.id);

    const apresentadas = apresentarLista(minhas, hoje);
    const contar = (s: string) => apresentadas.filter(o => o.situacao === s).length;

    return {
      total: apresentadas.length,
      vencidas: contar("vencida"),
      prazoFatalVencido: contar("prazo_fatal_vencido"),
      renovacaoDevida: contar("renovacao_devida"),
      prorrogadas: contar("prorrogada"),
      // Só o que exige ação sobe para o topo; o resto fica na lista completa.
      pendencias: apresentadas.filter(o =>
        ["vencida", "prazo_fatal_vencido", "renovacao_devida"].includes(o.situacao)),
      obrigacoes: apresentadas,
      geradoEm: hoje.toISOString(),
    };
  }

  /**
   * Eventos do calendário.
   *
   * Cada obrigação rende até três eventos: prazo interno (começar), prazo fatal
   * (último dia para protocolar) e validade (acaba). É a diferença entre este
   * calendário e a coluna de vencimento da planilha — mostrar quando COMEÇAR,
   * não só quando termina.
   */
  async calendario(user: Usuario, deIso?: string, ateIso?: string) {
    const hoje = new Date();
    const de = deIso ? new Date(deIso) : inicioDoMes(hoje, -1);
    const ate = ateIso ? new Date(ateIso) : inicioDoMes(hoje, 13);

    const obrigacoes = await this.repo.eventosCalendario(user.organizationId, de, ate);

    const eventos: any[] = [];
    for (const o of obrigacoes) {
      const contexto = {
        dataValidade: o.dataValidade,
        prazoFatalEm: o.prazoFatalEm,
        prazoInternoEm: o.prazoInternoEm,
        renovacaoAutomatica: o.renovacaoAutomatica,
        protocoloEm: o.protocoloEm,
      };
      const situacao = situacaoPrazo(contexto, hoje);
      const d = distancias(contexto, hoje);

      const comum = {
        obrigacaoId: o.id,
        codigo: o.codigo,
        titulo: o.nome,
        sigla: o.sigla,
        unidade: o.unidade,
        criticidade: o.criticidade,
        categoria: o.categoria,
        situacao,
      };

      if (dentro(o.prazoInternoEm, de, ate)) {
        eventos.push({
          ...comum, id: `${o.id}:interno`, tipo: "prazo_interno",
          rotulo: "Iniciar renovação", data: o.prazoInternoEm,
          diasRestantes: d.diasParaPrazoInterno,
        });
      }
      if (dentro(o.prazoFatalEm, de, ate)) {
        eventos.push({
          ...comum, id: `${o.id}:fatal`, tipo: "prazo_fatal",
          rotulo: "Prazo fatal para protocolar", data: o.prazoFatalEm,
          diasRestantes: d.diasParaPrazoFatal,
        });
      }
      if (dentro(o.dataValidade, de, ate)) {
        eventos.push({
          ...comum, id: `${o.id}:validade`, tipo: "validade",
          rotulo: "Vencimento", data: o.dataValidade,
          diasRestantes: d.diasParaValidade,
        });
      }
    }

    eventos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return { de: de.toISOString(), ate: ate.toISOString(), eventos };
  }
}

function inicioDoMes(base: Date, deslocamentoMeses: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + deslocamentoMeses, 1);
  return d;
}

function dentro(valor: Date | null | undefined, de: Date, ate: Date): boolean {
  if (!valor) return false;
  const t = new Date(valor).getTime();
  return t >= de.getTime() && t <= ate.getTime();
}
