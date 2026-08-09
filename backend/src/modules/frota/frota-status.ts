/**
 * Status operacional e farol da frota.
 *
 * Origem: planilha FORFT_0005 ("Controle de Manutenções Corretivas — Frotas"),
 * que a operação mantém à mão. Ela classifica cada veículo em três estados e
 * pinta um `●` colorido por formatação condicional:
 *
 *   Operando            → verde   (#00B050)
 *   Operando com Avaria → amarelo (#FFC000)
 *   Parado              → vermelho(#FF0000)
 *
 * O estado do meio é o que o sistema não sabia representar. `veiculos.status`
 * só distingue "ativo" de "manutencao" — ou o veículo roda, ou está parado.
 * Na leitura de 28/07/2026 da planilha, 22 dos 95 veículos estavam justamente
 * no meio: rodando com defeito aberto.
 *
 * DECISÃO: o farol é derivado, nunca gravado. A fonte é o conjunto de OS
 * abertas do veículo, e `ManutencaoVeiculo.imobiliza` decide se aquela OS tira
 * o veículo de operação. Consequências:
 *
 *   - corrigir a data de uma OS corrige o histórico junto, em vez de deixar
 *     um snapshot mentindo sobre o passado;
 *   - a série histórica de disponibilidade sai das mesmas janelas de OS que o
 *     relatório de disponibilidade já usa — uma regra só, dois consumidores;
 *   - não há job diário nem tabela de snapshot para manter.
 *
 * Este arquivo é de funções puras (sem Prisma, sem I/O) justamente para que a
 * regra do farol possa ser testada e reusada pelo dashboard, pelo relatório e
 * pela série histórica sem divergir — foi assim que as colunas dos relatórios
 * divergiram em quatro cópias antes de virarem definição única.
 */

/** Status da OS que significa "ainda aberta" — o veículo ainda está nela. */
const OS_ENCERRADAS = ["finalizada", "cancelada", "concluida"];

/**
 * `concluida` entra na lista por segurança: o dashboard filtrava por esse nome
 * enquanto o formulário gravava `finalizada`, então pode haver OS legada com
 * ele. Aceitar os dois evita que uma OS encerrada mantenha um veículo vermelho
 * para sempre.
 */
export function osEstaAberta(os: { status?: string | null }): boolean {
  return !OS_ENCERRADAS.includes(String(os?.status || "").toLowerCase());
}

export type FarolOperacional = "operando" | "operando_com_avaria" | "parado" | "fora_de_operacao";

/** Cores do farol — as mesmas da formatação condicional da planilha. */
export const FAROL_CORES: Record<FarolOperacional, string> = {
  operando: "#00B050",
  operando_com_avaria: "#FFC000",
  parado: "#FF0000",
  fora_de_operacao: "#9CA3AF",
};

export const FAROL_LABELS: Record<FarolOperacional, string> = {
  operando: "Operando",
  operando_com_avaria: "Operando com Avaria",
  parado: "Parado",
  fora_de_operacao: "Fora de operação",
};

/**
 * Veículos que não fazem parte do cálculo de disponibilidade.
 *
 * Um veículo vendido não é uma indisponibilidade da frota — é uma saída dela.
 * Contá-lo como parado afundaria o percentual para sempre. A planilha resolve
 * isso removendo a linha; aqui o veículo continua cadastrado (o histórico
 * precisa dele) mas sai do denominador.
 */
const STATUS_FORA_DA_FROTA = ["inativo", "vendido"];

export function foraDaFrota(veiculo: { status?: string | null }): boolean {
  return STATUS_FORA_DA_FROTA.includes(String(veiculo?.status || "").toLowerCase());
}

/**
 * Status do cadastro que declara avaria SEM tirar o veículo de operação.
 *
 * A planilha mantém esse estado como coluna digitada à mão, e a operação
 * trabalha assim. Derivar o amarelo APENAS de OS aberta exigiria que o time
 * mudasse o processo antes de a tela servir para alguma coisa — está de trás
 * para frente. Aqui o campo é a porta de entrada manual; quando existir OS, ela
 * tem precedência por ser mais específica.
 */
const STATUS_AVARIA_MANUAL = "operando_com_avaria";

/** Sinais externos ao veículo e às suas OS que também acendem o farol. */
export type SinaisVeiculo = {
  /** Revisão vencida (registro `atrasada`, ou `agendada` com data no passado). */
  revisaoAtrasada?: boolean;
};

/**
 * Farol + o motivo dele.
 *
 * O motivo não é enfeite: o amarelo passou a ter três origens possíveis (OS
 * aberta, avaria no cadastro, revisão atrasada). Sem dizer qual delas acendeu,
 * a tela vira caixa-preta e o usuário não sabe o que fazer com a informação.
 */
export type ResultadoFarol = {
  farol: FarolOperacional;
  motivo: string;
  origem: "os" | "cadastro" | "revisao" | "nenhuma";
};

export type OsAberta = {
  id?: string;
  numeroOs?: string | null;
  tipo?: string | null;
  status?: string | null;
  descricao?: string | null;
  imobiliza?: boolean | null;
  localizacao?: string | null;
  oficina?: string | null;
  fornecedor?: string | null;
  observacoes?: string | null;
  dataAbertura?: Date | string | null;
  data?: Date | string | null;
  previsaoLiberacao?: Date | string | null;
  dataFechamento?: Date | string | null;
  criadoEm?: Date | string | null;
};

/**
 * Deriva o farol de um veículo — escada de precedência de três degraus, cada um
 * com mais de uma origem possível.
 *
 *   🔴 Parado   ← OS imobilizante aberta | cadastro manutencao/sinistrado
 *   🟡 Atenção  ← OS aberta não-imobilizante | cadastro operando_com_avaria
 *                 | revisão atrasada
 *   🟢 Operando ← resto
 *
 * Dentro de cada degrau a ordem é da causa mais específica para a mais genérica:
 * uma OS aberta diz QUAL é o problema e por isso ganha do campo do cadastro, que
 * só diz que existe um.
 *
 * Vermelho manda em amarelo sem exceção — não importa quantas avarias leves
 * existam, o veículo que está na oficina está parado.
 */
export function farolDoVeiculo(
  veiculo: { status?: string | null },
  osAbertas: OsAberta[] = [],
  sinais: SinaisVeiculo = {},
): ResultadoFarol {
  if (foraDaFrota(veiculo)) {
    return { farol: "fora_de_operacao", motivo: "Fora da frota", origem: "cadastro" };
  }

  const abertas = osAbertas.filter(osEstaAberta);
  const statusVeiculo = String(veiculo?.status || "").toLowerCase();

  // ── 🔴 Parado ──────────────────────────────────────────────────────────────
  // Usa a mesma OS que `osDeterminante` escolhe para preencher as colunas da
  // linha (a imobilizante mais antiga). Se aqui pegasse outra, o motivo citaria
  // uma OS e as colunas ao lado mostrariam os dados de outra.
  const osImobilizante = abertas.some(os => os.imobiliza !== false)
    ? osDeterminante(abertas)
    : null;
  if (osImobilizante) {
    return {
      farol: "parado",
      motivo: osImobilizante.numeroOs ? `OS ${osImobilizante.numeroOs}` : "OS aberta",
      origem: "os",
    };
  }
  if (statusVeiculo === "manutencao" || statusVeiculo === "sinistrado") {
    return {
      farol: "parado",
      motivo: statusVeiculo === "sinistrado" ? "Sinistrado (cadastro)" : "Em manutenção (cadastro)",
      origem: "cadastro",
    };
  }

  // ── 🟡 Atenção ─────────────────────────────────────────────────────────────
  if (abertas.length) {
    const os = osDeterminante(abertas);
    return {
      farol: "operando_com_avaria",
      motivo: os?.numeroOs ? `OS ${os.numeroOs} (não imobiliza)` : "OS aberta (não imobiliza)",
      origem: "os",
    };
  }
  if (statusVeiculo === STATUS_AVARIA_MANUAL) {
    return { farol: "operando_com_avaria", motivo: "Avaria registrada no cadastro", origem: "cadastro" };
  }
  if (sinais.revisaoAtrasada) {
    return { farol: "operando_com_avaria", motivo: "Revisão atrasada", origem: "revisao" };
  }

  // ── 🟢 Operando ────────────────────────────────────────────────────────────
  return { farol: "operando", motivo: "Sem pendências", origem: "nenhuma" };
}

/**
 * A OS que explica o farol — a que o usuário quer ver na linha da tabela.
 *
 * Escolhe a imobilizante mais antiga (é ela que está segurando o veículo);
 * sem imobilizante, a avaria aberta mais antiga. Ordenar pela mais antiga e
 * não pela mais recente é deliberado: o que interessa em um painel de frota
 * parada é há quanto tempo aquilo está travado.
 */
export function osDeterminante(osAbertas: OsAberta[] = []): OsAberta | null {
  const abertas = osAbertas.filter(osEstaAberta);
  if (!abertas.length) return null;

  const inicio = (os: OsAberta) => {
    const d = os.dataAbertura || os.data || os.criadoEm;
    return d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER;
  };

  const imobilizantes = abertas.filter(os => os.imobiliza !== false);
  const candidatas = imobilizantes.length ? imobilizantes : abertas;
  return candidatas.slice().sort((a, b) => inicio(a) - inicio(b))[0];
}

/**
 * Início efetivo de uma OS.
 *
 * Mesma ordem de fallback de `frota-datas.ts`, com `criadoEm` no fim: OS antiga
 * pode não ter `dataAbertura`, e sem o último fallback ela sumia do cálculo de
 * parada em silêncio.
 */
export function inicioEfetivoOs(os: OsAberta): Date | null {
  const d = os.dataAbertura || os.data || os.criadoEm;
  return d ? new Date(d) : null;
}

export type ContagemFarol = {
  operando: number;
  operandoComAvaria: number;
  parado: number;
  foraDeOperacao: number;
  /** Denominador dos percentuais: frota ativa (exclui vendidos/inativos). */
  totalFrota: number;
  percRodando: number;
  percParados: number;
};

/**
 * Consolida os KPIs no formato do cabeçalho da planilha.
 *
 * A planilha divide por 92 fixo enquanto lista 95 veículos, e por isso os
 * percentuais dela somam 104%. Aqui o denominador é a frota ativa de verdade,
 * então rodando + parados fecha em 100%.
 */
export function contarFarois(farois: FarolOperacional[]): ContagemFarol {
  const operando = farois.filter(f => f === "operando").length;
  const operandoComAvaria = farois.filter(f => f === "operando_com_avaria").length;
  const parado = farois.filter(f => f === "parado").length;
  const foraDeOperacao = farois.filter(f => f === "fora_de_operacao").length;
  const totalFrota = operando + operandoComAvaria + parado;

  const pct = (n: number) => (totalFrota ? Math.round((n / totalFrota) * 1000) / 10 : 0);

  return {
    operando,
    operandoComAvaria,
    parado,
    foraDeOperacao,
    totalFrota,
    // "Rodando" inclui o veículo com avaria: ele está em operação, é o que a
    // planilha conta e é o que a operação entende por frota disponível.
    percRodando: pct(operando + operandoComAvaria),
    percParados: pct(parado),
  };
}
