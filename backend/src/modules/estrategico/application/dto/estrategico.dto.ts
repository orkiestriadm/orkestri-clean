import {
  IsString, IsOptional, IsIn, IsInt, IsBoolean, IsDateString, IsArray, IsNumber,
  IsUUID, MaxLength, Min, Max, ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ETAPA_IDS, ESTAGIO_IDS, PRIORIDADES, TIPOS_CASO, TIPO_EVENTO_IDS, STATUS_TAREFA,
  CATEGORIA_DOCUMENTO_IDS, CLASSIFICACAO_IDS, TIPOS_CATALOGO,
} from "../../domain/caso.entity";
import { FAROIS } from "../../domain/farol.entity";

/**
 * Contratos de entrada do Strategy.
 *
 * Convenção: campo AUSENTE não mexe; `null` LIMPA. O `@IsOptional` do
 * class-validator aceita os dois, e o serviço distingue `undefined` de `null`.
 */

const VALOR_MAX = 1e15;
const Valor = () => (target: any, key: string) => {
  IsOptional()(target, key);
  IsNumber({ maxDecimalPlaces: 2 })(target, key);
  Min(-VALOR_MAX)(target, key);
  Max(VALOR_MAX)(target, key);
};
const Escala = () => (target: any, key: string) => {
  IsOptional()(target, key);
  IsInt()(target, key);
  Min(1)(target, key);
  Max(5)(target, key);
};

class CasoBase {
  @IsOptional() @IsString() @MaxLength(300) titulo?: string;
  @IsOptional() @IsString() @MaxLength(8000) descricao?: string;
  @IsOptional() @IsIn(TIPOS_CASO as unknown as string[]) tipo?: string;

  @IsOptional() @IsUUID() grupoId?: string | null;
  @IsOptional() @IsUUID() objetivoId?: string | null;
  @IsOptional() @IsUUID() esferaId?: string | null;

  @IsOptional() @IsIn(ETAPA_IDS) etapa?: string;
  @IsOptional() @IsIn(ESTAGIO_IDS) estagioOportunidade?: string | null;
  @IsOptional() @IsIn(PRIORIDADES as unknown as string[]) prioridade?: string;

  @IsOptional() @IsUUID() areaExecutivaId?: string | null;
  @IsOptional() @IsUUID() areaOperacionalId?: string | null;
  @IsOptional() @IsUUID() responsavelExecutivoId?: string | null;
  @IsOptional() @IsUUID() responsavelOperacionalId?: string | null;
  @IsOptional() @IsArray() @IsUUID("all", { each: true }) areasApoioIds?: string[];

  @IsOptional() @IsString() @MaxLength(2000) proximaAcao?: string | null;
  @IsOptional() @IsUUID() proximaAcaoResponsavelId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) proximaAcaoResponsavelNome?: string | null;
  @IsOptional() @IsDateString() proximaAcaoPrazo?: string | null;
  @IsOptional() @IsIn(PRIORIDADES as unknown as string[]) proximaAcaoPrioridade?: string | null;

  @IsOptional() @IsDateString() prazoFinal?: string | null;

  @IsOptional() @IsIn(CLASSIFICACAO_IDS) classificacaoFinanceira?: string | null;
  @Valor() valorPretendido?: number | null;
  @Valor() valorSolicitado?: number | null;
  @Valor() valorEmAnalise?: number | null;
  @Valor() valorReconhecido?: number | null;
  @Valor() valorAlcancado?: number | null;
  @Valor() valorRecebido?: number | null;
  @Valor() valorReequilibrio?: number | null;
  @Valor() valorEmRisco?: number | null;
  @Valor() valorPotencial?: number | null;
  @IsOptional() @IsDateString() valoresReferenciaEm?: string | null;
  /** Explica a mudança de valor no histórico financeiro ("Estudo econômico"). */
  @IsOptional() @IsString() @MaxLength(500) observacaoValor?: string;

  @Escala() probabilidade?: number | null;
  @Escala() impacto?: number | null;
  @Escala() riscoFinanceiro?: number | null;
  @Escala() riscoJuridico?: number | null;
  @Escala() riscoRegulatorio?: number | null;
  @Escala() riscoOperacional?: number | null;
  @Escala() riscoPrazo?: number | null;
  @IsOptional() @IsString() @MaxLength(8000) planoMitigacao?: string | null;

  @IsOptional() @IsBoolean() revisarImportacao?: boolean;
}

export class CriarCasoDto extends CasoBase {
  @IsString() @MaxLength(300) declare titulo: string;
}

export class AtualizarCasoDto extends CasoBase {
  /** Motivo da mudança de etapa — vai para a timeline. */
  @IsOptional() @IsString() @MaxLength(1000) motivo?: string;
}

export class FarolManualDto {
  @IsOptional() @IsIn(FAROIS) farol?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) justificativa?: string;
}

export class ListarCasosQuery {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() farol?: string;
  @IsOptional() @IsString() etapa?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() objetivoId?: string;
  @IsOptional() @IsString() esferaId?: string;
  @IsOptional() @IsString() grupoId?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() dependenciaId?: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsString() responsavelId?: string;
  /** sem_acao | vencidos | parados | revisar | ativos | encerrados | risco_alto */
  @IsOptional() @IsString() recorte?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) paradoDias?: number;
  @IsOptional() @IsString() ordenar?: string;
}

/* ── Atividade ───────────────────────────────────────────────────────────── */

export class CriarEventoDto {
  @IsIn(TIPO_EVENTO_IDS) tipo!: string;
  @IsDateString() dataEvento!: string;
  @IsString() @MaxLength(300) titulo!: string;
  @IsOptional() @IsString() @MaxLength(8000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(4000) decisao?: string;
  @IsOptional() @IsString() @MaxLength(2000) proximoPasso?: string;
  @IsOptional() @IsUUID() responsavelId?: string;
  @IsOptional() @IsUUID() documentoId?: string;
}

export class AtualizarEventoDto {
  @IsOptional() @IsIn(TIPO_EVENTO_IDS) tipo?: string;
  @IsOptional() @IsDateString() dataEvento?: string;
  @IsOptional() @IsString() @MaxLength(300) titulo?: string;
  @IsOptional() @IsString() @MaxLength(8000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(4000) decisao?: string;
  @IsOptional() @IsString() @MaxLength(2000) proximoPasso?: string;
  @IsOptional() @IsBoolean() revisar?: boolean;
}

export class CriarTarefaDto {
  @IsString() @MaxLength(300) titulo!: string;
  @IsOptional() @IsString() @MaxLength(8000) descricao?: string;
  @IsOptional() @IsUUID() responsavelId?: string | null;
  @IsOptional() @IsDateString() prazo?: string | null;
  @IsOptional() @IsIn(PRIORIDADES as unknown as string[]) prioridade?: string;
  @IsOptional() @IsString() @MaxLength(300) dependencia?: string | null;
}

export class AtualizarTarefaDto {
  @IsOptional() @IsString() @MaxLength(300) titulo?: string;
  @IsOptional() @IsString() @MaxLength(8000) descricao?: string;
  @IsOptional() @IsUUID() responsavelId?: string | null;
  @IsOptional() @IsDateString() prazo?: string | null;
  @IsOptional() @IsIn(PRIORIDADES as unknown as string[]) prioridade?: string;
  @IsOptional() @IsIn(STATUS_TAREFA as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(300) dependencia?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) conclusao?: string | null;
}

export class ComentarDto {
  @IsString() @MaxLength(8000) conteudo!: string;
}

export class DependenciaDto {
  @IsOptional() @IsUUID() catalogoId?: string | null;
  @IsOptional() @IsString() @MaxLength(200) organizacao?: string | null;
  @IsOptional() @IsString() @MaxLength(200) contato?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string | null;
  @IsOptional() @IsDateString() desde?: string | null;
  @IsOptional() @IsDateString() respostaEsperadaEm?: string | null;
  @IsOptional() @IsDateString() ultimoFollowUpEm?: string | null;
  @IsOptional() @IsDateString() proximoFollowUpEm?: string | null;
  @IsOptional() @IsBoolean() resolvida?: boolean;
}

export class DocumentoDto {
  @IsOptional() @IsString() @MaxLength(300) titulo?: string;
  @IsOptional() @IsIn(CATEGORIA_DOCUMENTO_IDS) categoria?: string;
  @IsOptional() @IsString() @MaxLength(2000) observacoes?: string;
  @IsOptional() @IsUUID() documentoOrigemId?: string;
  @IsOptional() @IsUUID() eventoId?: string;
  @IsOptional() @IsUUID() tarefaId?: string;
}

/* ── Catálogo e configuração ─────────────────────────────────────────────── */

export class CatalogoDto {
  @IsOptional() @IsIn(TIPOS_CATALOGO as unknown as string[]) tipo?: string;
  @IsOptional() @IsString() @MaxLength(160) nome?: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string | null;
  @IsOptional() @IsString() @MaxLength(20) cor?: string | null;
  @IsOptional() @IsIn(["interna", "externa"]) natureza?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(9999) ordem?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class ConfigDto {
  @IsOptional() @IsInt() @Min(1) @Max(3650) diasAtencaoSemMovimento?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) diasCriticoSemMovimento?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) diasAtrasoCritico?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) diasDependenciaAtencao?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) diasFollowUp?: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(365, { each: true }) antecedenciasAviso?: number[];
  @IsOptional() @IsInt() @Min(1) @Max(365) diasEscalonamento?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) limiarValorRelevante?: number | null;
  @IsOptional() @IsBoolean() automacoesAtivas?: boolean;
  @IsOptional() @IsBoolean() notificarEmail?: boolean;
  @IsOptional() @IsArray() @IsUUID("all", { each: true }) gestoresEscalonamento?: string[];
}

/* ── Reunião ─────────────────────────────────────────────────────────────── */

export class ParticipanteDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsString() @MaxLength(160) nome!: string;
}

export class CriarReuniaoDto {
  @IsString() @MaxLength(200) titulo!: string;
  @IsDateString() dataReuniao!: string;
  @IsOptional() @IsString() @MaxLength(200) local?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ParticipanteDto) participantes?: ParticipanteDto[];
  /** Cria o compromisso na agenda de cada participante com login. */
  @IsOptional() @IsBoolean() agendar?: boolean;
}

export class AnotarPautaDto {
  @IsUUID() casoId!: string;
  @IsOptional() @IsBoolean() discutido?: boolean;
  @IsOptional() @IsString() @MaxLength(4000) nota?: string;
}

export class DecisaoDto {
  @IsOptional() @IsUUID() casoId?: string;
  @IsString() @MaxLength(4000) descricao!: string;
}

export class TarefaReuniaoDto extends CriarTarefaDto {
  @IsUUID() casoId!: string;
}

export class StatusReuniaoDto {
  @IsIn(["em_andamento", "encerrada", "cancelada"]) status!: string;
}
