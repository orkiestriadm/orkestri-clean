import {
  IsString, IsOptional, IsBoolean, IsNumber, IsIn, IsDateString, IsEmail, IsInt, Min, Max,
} from "class-validator";
import { Type } from "class-transformer";
import { EMPLOYEE_STATUS_VALUES } from "../../domain/employee.entity";

/**
 * Contratos de entrada da API de colaboradores.
 *
 * A ValidationPipe global roda com `forbidNonWhitelisted: true` — campo não
 * declarado aqui faz a requisição falhar com 400, e não passa silenciosamente.
 */

export class CriarColaboradorDto {
  // Vínculo com usuário é opcional: nem todo colaborador tem login.
  // Sem ele, nomeCompleto passa a ser obrigatório (validado no domínio).
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() nomeCompleto?: string;

  @IsOptional() @IsString() matricula?: string;
  @IsOptional() @IsString() fotoUrl?: string;
  @IsOptional() @IsEmail() emailCorporativo?: string;
  @IsOptional() @IsEmail() emailPessoal?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() celular?: string;

  @IsOptional() @IsDateString() dataNascimento?: string;
  @IsOptional() @IsString() genero?: string;
  @IsOptional() @IsString() estadoCivil?: string;
  @IsOptional() @IsString() nacionalidade?: string;
  @IsOptional() @IsDateString() dataAdmissao?: string;
  @IsOptional() @IsDateString() dataDesligamento?: string;

  @IsOptional() @IsIn(EMPLOYEE_STATUS_VALUES) status?: string;

  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() squad?: string;
  @IsOptional() @IsString() especialidade?: string;
  @IsOptional() @IsString() senioridade?: string;
  @IsOptional() @IsString() gestorId?: string;

  @IsOptional() @IsNumber() jornadaHorasDia?: number;
  @IsOptional() @IsNumber() jornadaHorasMes?: number;
  @IsOptional() @IsString() turno?: string;
  @IsOptional() @IsString() escala?: string;
  @IsOptional() @IsString() tipoVinculo?: string;
}

/** Update não permite trocar o usuário vinculado — é operação à parte. */
export class AtualizarColaboradorDto {
  @IsOptional() @IsString() nomeCompleto?: string;
  @IsOptional() @IsString() matricula?: string;
  @IsOptional() @IsString() fotoUrl?: string;
  @IsOptional() @IsEmail() emailCorporativo?: string;
  @IsOptional() @IsEmail() emailPessoal?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() celular?: string;

  @IsOptional() @IsDateString() dataNascimento?: string;
  @IsOptional() @IsString() genero?: string;
  @IsOptional() @IsString() estadoCivil?: string;
  @IsOptional() @IsString() nacionalidade?: string;
  @IsOptional() @IsDateString() dataAdmissao?: string;

  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() squad?: string;
  @IsOptional() @IsString() especialidade?: string;
  @IsOptional() @IsString() senioridade?: string;
  @IsOptional() @IsString() gestorId?: string;

  @IsOptional() @IsNumber() jornadaHorasDia?: number;
  @IsOptional() @IsNumber() jornadaHorasMes?: number;
  @IsOptional() @IsString() turno?: string;
  @IsOptional() @IsString() escala?: string;
  @IsOptional() @IsString() tipoVinculo?: string;
}

/** Mudança de status é endpoint próprio: tem regra de transição e gera evento. */
export class MudarStatusDto {
  @IsIn(EMPLOYEE_STATUS_VALUES) status!: string;
  @IsOptional() @IsDateString() dataDesligamento?: string;
  @IsOptional() @IsString() motivo?: string;
}

const CAMPOS_ORDENAVEIS = ["nomeCompleto", "matricula", "cargo", "status", "dataAdmissao", "criadoEm"];

export class ListarColaboradoresQuery {
  @IsOptional() @IsString() busca?: string;
  @IsOptional() @IsIn(EMPLOYEE_STATUS_VALUES) status?: string;
  @IsOptional() @IsString() setorId?: string;
  @IsOptional() @IsString() positionId?: string;
  @IsOptional() @IsString() gestorId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  // Teto de 200: exportação usa endpoint próprio, com auditoria.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) tamanho?: number;

  @IsOptional() @IsIn(CAMPOS_ORDENAVEIS) ordenarPor?: string;
  @IsOptional() @IsIn(["asc", "desc"]) direcao?: "asc" | "desc";
}
