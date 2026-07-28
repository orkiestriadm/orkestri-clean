import { IsString, IsOptional, IsIn, IsDateString, MaxLength } from "class-validator";
import {
  DOCUMENT_CATEGORY_VALUES, DOCUMENT_APPROVAL_VALUES,
} from "../../domain/document.entity";

/**
 * Contratos de entrada da API de documentos.
 *
 * O upload chega como multipart: os campos vêm como string, então nada de
 * @IsNumber aqui — datas são validadas como ISO e convertidas no serviço.
 */
export class EnviarDocumentoDto {
  @IsIn(DOCUMENT_CATEGORY_VALUES) categoria!: string;
  @IsString() @MaxLength(160) titulo!: string;
  @IsOptional() @IsString() @MaxLength(500) descricao?: string;
  @IsOptional() @IsDateString() dataEmissao?: string;
  @IsOptional() @IsDateString() dataValidade?: string;
}

export class DecidirDocumentoDto {
  @IsIn(DOCUMENT_APPROVAL_VALUES) aprovacao!: string;
  /** Obrigatório na rejeição — a regra vive no domínio, não aqui. */
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}
