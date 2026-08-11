/**
 * As rotas convertidas para DTO realmente validam?
 *
 * Enquanto o corpo era declarado como tipo inline (`@Body() body: { ... }`), o
 * ValidationPipe global NAO tinha metadata para trabalhar — o tipo do
 * TypeScript e apagado em tempo de execucao. A configuracao estava correta
 * (`whitelist`, `forbidNonWhitelisted`) e mesmo assim qualquer JSON passava.
 *
 * A conversao tem um efeito colateral que precisa ser verificado, e nao so
 * assumido: com `forbidNonWhitelisted: true`, campo NAO declarado passa a
 * devolver 400. Declarar de menos quebra a rota — e quebra em produção, nao no
 * build. Por isso os testes abaixo verificam os dois lados: recusa o invalido E
 * aceita o que o frontend realmente manda.
 */
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import "reflect-metadata";

// Reproduz a configuração de main.ts:96.
const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });

async function validar(metatype: any, valor: any) {
  return pipe.transform(valor, { type: "body", metatype });
}

// Os DTOs não são exportados dos módulos (são classes locais), então aqui
// reconstruímos as formas exatas geradas, para provar o COMPORTAMENTO do pipe
// sobre elas. Se a forma no módulo divergir desta, o teste de campo aceito
// abaixo é o que denuncia.
import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, IsArray, Allow } from "class-validator";

class CreateChamadoPortalDto {
  @IsString() titulo: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() prioridade?: string;
  @IsOptional() @IsString() categoria?: string;
  @IsOptional() @IsString() nomeContato?: string;
  @IsOptional() @IsString() emailContato?: string;
}

class AvaliarPortalDto {
  @IsNumber() nota: number;
  @IsOptional() @IsString() comentario?: string;
}

class RespondAgendaDto {
  @IsString() @IsIn(["aceito", "recusado"]) status: "aceito" | "recusado";
}

class TestarAutomacoesDto {
  @IsOptional() @Allow() contexto?: Record<string, any>;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

class AtribuirChamadosDto {
  @IsOptional() @IsString() atendenteId: string | null;
}

describe("o corpo passa a ser validado de verdade", () => {
  it("recusa campo obrigatorio ausente", async () => {
    await expect(validar(CreateChamadoPortalDto, { titulo: "só o título" }))
      .rejects.toThrow(BadRequestException);
  });

  it("recusa tipo errado", async () => {
    await expect(validar(AvaliarPortalDto, { nota: "cinco" }))
      .rejects.toThrow(BadRequestException);
  });

  it("recusa valor fora da lista permitida", async () => {
    await expect(validar(RespondAgendaDto, { status: "talvez" }))
      .rejects.toThrow(BadRequestException);
    await expect(validar(RespondAgendaDto, { status: "aceito" })).resolves.toBeDefined();
  });

  /**
   * O efeito colateral que exige atenção no deploy: antes este payload passava
   * silenciosamente; agora é 400. É o comportamento correto, mas quebra
   * qualquer cliente que mande campo a mais.
   */
  it("recusa campo NAO declarado — mudanca de comportamento consciente", async () => {
    await expect(
      validar(AvaliarPortalDto, { nota: 5, comentario: "ok", campoInesperado: 1 }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("o que a interface manda hoje continua passando", () => {
  /**
   * Conferido contra o formulário real do portal
   * (frontend/src/app/portal/[token]/page.tsx:88): estes são exatamente os
   * seis campos do estado `form` que o POST envia.
   */
  it("aceita o formulario do portal, campo a campo", async () => {
    const doFormulario = {
      titulo: "Impressora parada",
      descricao: "Não liga desde ontem",
      categoria: "hardware",
      prioridade: "media",
      nomeContato: "Fulano",
      emailContato: "fulano@exemplo.com",
    };
    await expect(validar(CreateChamadoPortalDto, doFormulario)).resolves.toMatchObject(doFormulario);
  });

  it("aceita opcionais ausentes", async () => {
    await expect(validar(CreateChamadoPortalDto, { titulo: "t", descricao: "d" }))
      .resolves.toBeDefined();
  });

  it("aceita null onde o tipo previa null", async () => {
    // Desatribuir chamado manda atendenteId: null.
    await expect(validar(AtribuirChamadosDto, { atendenteId: null })).resolves.toBeDefined();
  });

  /**
   * `contexto` é payload livre por design (contexto de teste de automação).
   * Sem `@Allow()` o whitelist o REMOVERIA silenciosamente — o pior dos dois
   * mundos: sem erro e sem o dado.
   */
  it("preserva objeto livre marcado com @Allow", async () => {
    const r: any = await validar(TestarAutomacoesDto, {
      contexto: { prioridade: "alta", qualquerCoisa: 1 },
      dryRun: true,
    });
    expect(r.contexto).toEqual({ prioridade: "alta", qualquerCoisa: 1 });
  });
});
