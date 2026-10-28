import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export type ContextoWhats = "PESSOAL" | "EMPRESA";

export function contextoSolicitado(texto: string): ContextoWhats | null {
  if (/^(?:contexto\s+)?pessoal[.!?]*$/i.test(texto.trim())) return "PESSOAL";
  if (/^(?:contexto\s+)?empresa[.!?]*$/i.test(texto.trim())) return "EMPRESA";
  return null;
}

// A organização nunca vem do texto ou do payload do provedor.
export function comandoEmpresarial(texto: string): boolean {
  return /^(?:\/?(?:meus?\s+|minhas?\s+)?(?:projetos?|demandas?|equipe|chamados?|contas?)(?:\b|:)|(?:novo|criar)\s+projeto\b|(?:nova|lançar|lancar)\s+conta\b|(?:abrir\s+)?(?:chamado|suporte|ticket)\b|(?:relatório|relatorio|resumo)\s+(?:de\s+)?contas?\b|(?:buscar|procurar|pesquisar|busca)\s*[:\-]?|(?:iniciar|concluir|reabrir|revisar|atribuir)\s+D-|adicionar\s+U-)/i.test(texto.trim());
}

@Injectable()
export class WhatsappContextoService {
  constructor(private prisma: PrismaService) {}

  async obter(user: { id: string; organizationId: string }, instancia: string, conversa: string): Promise<ContextoWhats> {
    const rows: any[] = await this.prisma.$queryRaw`
      SELECT contexto FROM whatsapp_contextos WHERE user_id=${user.id} AND organization_id=${user.organizationId}
        AND instancia=${instancia} AND conversa=${conversa}
    `;
    return rows[0]?.contexto === "EMPRESA" ? "EMPRESA" : "PESSOAL";
  }

  async trocar(user: { id: string; organizationId: string }, instancia: string, conversa: string, contexto: ContextoWhats) {
    await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`
        INSERT INTO whatsapp_contextos(user_id,organization_id,instancia,conversa,contexto)
        VALUES (${user.id},${user.organizationId},${instancia},${conversa},${contexto})
        ON CONFLICT(user_id,instancia,conversa) DO UPDATE SET organization_id=EXCLUDED.organization_id,
          contexto=EXCLUDED.contexto, atualizado_em=CURRENT_TIMESTAMP
      `;
      await tx.$executeRaw`DELETE FROM whatsapp_inicio WHERE user_id=${user.id} AND instancia=${instancia} AND conversa=${conversa}`;
      await tx.$executeRaw`DELETE FROM whatsapp_previas WHERE user_id=${user.id} AND instancia=${instancia} AND conversa=${conversa}`;
    });
  }

  mensagem(contexto: ContextoWhats) {
    return contexto === "PESSOAL"
      ? "👤 *Contexto pessoal*\nSua agenda, gastos, notas e tarefas pessoais. Envie *empresa* para projetos, demandas e contas da organização."
      : "🏢 *Contexto empresa*\nProjetos, demandas, chamados e contas da sua organização, conforme suas permissões. Envie *pessoal* para sua vida pessoal.";
  }
}
