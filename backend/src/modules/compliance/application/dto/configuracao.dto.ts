import {
  IsString, IsOptional, IsIn, IsInt, IsBoolean, IsArray, IsUUID,
  MaxLength, Min, Max, ValidateNested, IsHexColor, ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { TIPO_CAMPO_VALUES } from "../../domain/campo.entity";
import { CANAL_VALUES, DESTINATARIO_VALUES, BASE_DATA_VALUES } from "../../domain/alerta.entity";

/* ── Categoria e campos personalizados ────────────────────────────────────── */

export class CampoDefinicaoDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(80) rotulo!: string;
  @IsIn(TIPO_CAMPO_VALUES) tipo!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(200) opcoes?: string[];
  @IsOptional() @IsBoolean() obrigatorio?: boolean;
  @IsOptional() @IsString() @MaxLength(200) ajuda?: string;
  @IsOptional() @IsInt() @Min(0) ordem?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class SalvarCategoriaDto {
  @IsString() @MaxLength(80) nome!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsString() @MaxLength(40) icone?: string;
  @IsOptional() @IsHexColor() cor?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsInt() @Min(0) ordem?: number;
  /** Folga interna padrão da categoria, em dias. */
  @IsOptional() @IsInt() @Min(0) @Max(3650) folgaInternaDias?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CampoDefinicaoDto)
  campos?: CampoDefinicaoDto[];
}

/* ── Órgão ────────────────────────────────────────────────────────────────── */

export class SalvarOrgaoDto {
  @IsString() @MaxLength(160) nome!: string;
  @IsOptional() @IsString() @MaxLength(30) sigla?: string;
  @IsOptional() @IsString() @MaxLength(160) contato?: string;
  @IsOptional() @IsString() @MaxLength(40) telefone?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(200) site?: string;
  @IsOptional() @IsString() @MaxLength(300) endereco?: string;
  @IsOptional() @IsString() @MaxLength(2000) observacoes?: string;
}

/* ── Tag ──────────────────────────────────────────────────────────────────── */

export class SalvarTagDto {
  @IsString() @MaxLength(40) nome!: string;
  @IsOptional() @IsHexColor() cor?: string;
}

/* ── Régua de alertas ─────────────────────────────────────────────────────── */

/**
 * Régua de avisos.
 *
 * `categoriaId` e `obrigacaoId` são mutuamente exclusivos e ambos opcionais:
 * sem nenhum, a régua vale para a organização inteira. A resolução (mais
 * específica ganha) fica no serviço.
 */
export class SalvarRegraDto {
  @IsOptional() @IsString() @MaxLength(80) nome?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsUUID() obrigacaoId?: string;

  @IsOptional() @IsIn(BASE_DATA_VALUES) baseData?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(30)
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(3650, { each: true })
  diasAntes?: number[];

  @IsOptional() @IsArray() @ArrayMaxSize(30)
  @IsInt({ each: true }) @Min(1, { each: true }) @Max(3650, { each: true })
  diasDepois?: number[];

  @IsOptional() @IsArray() @IsIn(CANAL_VALUES, { each: true }) canais?: string[];
  @IsOptional() @IsArray() @IsIn(DESTINATARIO_VALUES, { each: true }) destinatarios?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(50) emailsExtras?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(50) whatsappsExtras?: string[];

  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class SalvarTemplateDto {
  @IsString() @MaxLength(80) nome!: string;
  @IsIn(["interno", "email", "whatsapp"]) canal!: string;
  @IsOptional() @IsString() @MaxLength(200) assunto?: string;
  @IsString() @MaxLength(8000) corpo!: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

/**
 * Prévia e teste da mensagem.
 *
 * `assunto` e `corpo` chegam soltos, e não só `templateId`, porque a prévia
 * precisa funcionar com o texto que está sendo digitado — esperar salvar para
 * então descobrir que o marcador estava errado é o ciclo que se quer evitar.
 */
export class PreviaMensagemDto {
  @IsOptional() @IsString() @MaxLength(200) assunto?: string;
  @IsOptional() @IsString() @MaxLength(8000) corpo?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsUUID() obrigacaoId?: string;
}

export class TestarMensagemDto extends PreviaMensagemDto {
  @IsIn(["interno", "email", "whatsapp"]) canal!: string;
  /** E-mail, número de WhatsApp ou id de usuário, conforme o canal. */
  @IsString() @MaxLength(200) para!: string;
}

export class SalvarEscalonamentoDto {
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsInt() @Min(1) @Max(3650) aposDias!: number;
  @IsIn(["gestor", "administrador", "usuario", "email"]) alvo!: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(50) emails?: string[];
  @IsOptional() @IsInt() @Min(0) ordem?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

/* ── Fluxo de aprovação ───────────────────────────────────────────────────── */

export class EtapaFluxoDto {
  @IsString() @MaxLength(80) nome!: string;
  @IsInt() @Min(0) ordem!: number;
  @IsOptional() @IsString() @MaxLength(40) papelAprovador?: string;
  @IsOptional() @IsBoolean() exigeAprovacao?: boolean;
  @IsOptional() @IsString() @MaxLength(30) statusAoEntrar?: string;
}

export class SalvarFluxoDto {
  @IsString() @MaxLength(80) nome!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => EtapaFluxoDto) etapas!: EtapaFluxoDto[];
}

export class DecidirAprovacaoDto {
  @IsIn(["aprovado", "rejeitado"]) decisao!: string;
  /** Obrigatório na rejeição — a regra vive no serviço, não aqui. */
  @IsOptional() @IsString() @MaxLength(1000) motivo?: string;
}
