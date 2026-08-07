import {
  IsString, IsOptional, IsIn, IsInt, IsBoolean, IsDateString, IsArray,
  IsNumber, IsUUID, MaxLength, Min, Max, ValidateNested, IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { CRITICIDADE_VALUES, STATUS_OBRIGACAO_VALUES } from "../../domain/obrigacao.entity";

/**
 * Contratos de entrada da API de obrigações.
 *
 * Regra que atravessa todos: prazo interno e prazo fatal NÃO são campos comuns.
 * O que o cliente manda é `prazoFatalManual` / `prazoInternoManual`, e o nome
 * carrega a intenção — sobrepor um cálculo, não informar um dado. Quem não
 * manda nada recebe a conta feita.
 */

export class ResponsavelDto {
  @IsIn(["principal", "gestor", "equipe", "observador"]) papel!: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() collaboratorId?: string;
  @IsOptional() @IsString() @MaxLength(160) nome?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(40) telefone?: string;
  @IsOptional() @IsBoolean() notificar?: boolean;
}

class ObrigacaoBase {
  @IsOptional() @IsString() @MaxLength(200) nome?: string;
  @IsOptional() @IsString() @MaxLength(40) sigla?: string;
  @IsOptional() @IsString() @MaxLength(120) numeroDocumento?: string;
  @IsOptional() @IsString() @MaxLength(4000) descricao?: string;

  @IsOptional() @IsUUID() orgaoId?: string;

  @IsOptional() @IsString() @MaxLength(160) empresa?: string;
  @IsOptional() @IsString() @MaxLength(160) filial?: string;
  @IsOptional() @IsString() @MaxLength(160) unidade?: string;
  @IsOptional() @IsString() @MaxLength(160) departamento?: string;
  @IsOptional() @IsString() @MaxLength(80)  centroCusto?: string;
  @IsOptional() @IsString() @MaxLength(120) ativoIdentificador?: string;
  @IsOptional() @IsUUID() projectId?: string;

  @IsOptional() @IsIn(CRITICIDADE_VALUES) criticidade?: string;

  @IsOptional() @IsDateString() dataEmissao?: string;
  @IsOptional() @IsDateString() dataValidade?: string;
  @IsOptional() @IsDateString() dataAprovacao?: string;

  // 1200 meses = 100 anos. Limite existe para barrar digitação errada (12 anos
  // digitados como 12000), não para restringir o negócio.
  @IsOptional() @IsInt() @Min(1) @Max(1200) validadeMeses?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3650) prazoMinimoDias?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3650) folgaInternaDias?: number;

  @IsOptional() @IsDateString() prazoFatalManual?: string;
  @IsOptional() @IsDateString() prazoInternoManual?: string;

  @IsOptional() @IsBoolean() renovacaoAutomatica?: boolean;
  @IsOptional() @IsString() @MaxLength(120) protocoloNumero?: string;
  @IsOptional() @IsDateString() protocoloEm?: string;
  @IsOptional() @IsString() @MaxLength(1000) protocoloObservacao?: string;

  @IsOptional() @IsNumber() @Min(0) valorLicenca?: number;
  @IsOptional() @IsNumber() @Min(0) valorRenovacao?: number;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() @MaxLength(60) notaFiscal?: string;

  @IsOptional() @IsString() @MaxLength(4000) observacoes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ResponsavelDto)
  responsaveis?: ResponsavelDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];

  /** Mapa chave → valor dos campos personalizados da categoria. */
  @IsOptional() @IsObject() campos?: Record<string, unknown>;
}

export class CriarObrigacaoDto extends ObrigacaoBase {
  @IsUUID() categoriaId!: string;
  @IsString() @MaxLength(200) nome!: string;
}

export class AtualizarObrigacaoDto extends ObrigacaoBase {
  @IsOptional() @IsUUID() categoriaId?: string;
}

/**
 * Renovação.
 *
 * A nova emissão é obrigatória; a nova validade é opcional porque o sistema a
 * propõe a partir da periodicidade — obrigar a digitar o que ele já sabe
 * calcular é convite a erro de digitação.
 */
export class RenovarObrigacaoDto {
  @IsDateString() dataEmissao!: string;
  @IsOptional() @IsDateString() dataValidade?: string;
  @IsOptional() @IsString() @MaxLength(120) numeroDocumento?: string;
  @IsOptional() @IsInt() @Min(0) @Max(3650) prazoMinimoDias?: number;
  @IsOptional() @IsNumber() @Min(0) valor?: number;
  @IsOptional() @IsString() @MaxLength(1000) observacao?: string;
}

/** Registro do protocolo — o que sustenta a prorrogação por renovação automática. */
export class ProtocolarDto {
  @IsString() @MaxLength(120) protocoloNumero!: string;
  @IsDateString() protocoloEm!: string;
  @IsOptional() @IsString() @MaxLength(1000) observacao?: string;
}

export class MudarStatusDto {
  @IsIn(STATUS_OBRIGACAO_VALUES) status!: string;
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}

export class ComentarDto {
  @IsString() @MaxLength(4000) conteudo!: string;
}

/**
 * Filtros da listagem.
 *
 * Tudo chega como string na query — daí `@Type(() => Number)` nos numéricos e
 * a ausência de `@IsBoolean` nos sinalizadores, tratados no serviço.
 */
export class ListarObrigacoesQuery {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsString() orgaoId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() criticidade?: string;
  /** Situação DERIVADA: vigente | renovacao_devida | prazo_fatal_vencido | vencida | prorrogada. */
  @IsOptional() @IsString() situacao?: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() responsavelId?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsString() supplierId?: string;
  /** Janela de vencimento em dias — o "vence nos próximos N dias" do painel. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) venceEmDias?: number;
  @IsOptional() @IsDateString() de?: string;
  @IsOptional() @IsDateString() ate?: string;
  @IsOptional() @IsString() favoritos?: string;
  @IsOptional() @IsString() ordenar?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limite?: number;
}
