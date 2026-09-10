import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { randomUUID } from "crypto";
import * as path from "path";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.module";
import { CasoRepository } from "../infrastructure/caso.repository";
import { DocumentoStorageService } from "../infrastructure/documento-storage.service";
import { CasoService } from "./caso.service";
import { Usuario, podeRegistrar } from "./contexto";
import { CATEGORIAS_DOCUMENTO } from "../domain/caso.entity";
import { DocumentoDto } from "./dto/estrategico.dto";

export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024;

const EXTENSOES = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "xlsm", "csv", "ppt", "pptx", "txt", "rtf", "odt", "ods",
  "png", "jpg", "jpeg", "gif", "webp", "msg", "eml", "zip",
]);

const MIMES: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  csv: "text/csv", txt: "text/plain", zip: "application/zip",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * Repositório de documentos e evidências do caso.
 *
 * VERSIONAMENTO: uma nova versão aponta para a PRIMEIRA (`documentoOrigemId`)
 * e recebe o próximo número. As anteriores continuam baixáveis — o parecer que
 * embasou a decisão de março não pode ser substituído pelo de setembro.
 */
@Injectable()
export class DocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CasoRepository,
    private readonly casos: CasoService,
    private readonly storage: DocumentoStorageService,
    private readonly audit: AuditService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async listar(user: Usuario, casoId: string) {
    await this.casos.exigir(user, casoId);
    const docs = await this.db.estrategicoDocumento.findMany({
      where: { casoId, organizationId: user.organizationId, deletedAt: null },
      orderBy: [{ criadoEm: "desc" }],
    });
    const ids = [...new Set(docs.map((d: any) => d.criadoPorId).filter(Boolean))];
    const usuarios = ids.length ? await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : [];
    const nomes = new Map(usuarios.map((u: any) => [u.id, u.nome]));
    return docs.map((d: any) => ({
      ...d,
      grupoId: d.documentoOrigemId ?? d.id,
      categoriaRotulo: CATEGORIAS_DOCUMENTO.find(c => c.id === d.categoria)?.rotulo ?? d.categoria,
      enviadoPor: d.criadoPorId ? nomes.get(d.criadoPorId) ?? null : null,
    }));
  }

  async enviar(user: Usuario, casoId: string, dados: DocumentoDto, arquivo: any, ip?: string) {
    const caso = await this.casos.exigir(user, casoId);
    if (!podeRegistrar(user, caso)) throw new ForbiddenException("Sem permissão para anexar documentos neste assunto.");
    if (!arquivo?.buffer?.length) throw new BadRequestException("Selecione um arquivo.");
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) throw new BadRequestException("Arquivo acima de 25 MB.");

    const nomeOriginal = Buffer.from(arquivo.originalname ?? "arquivo", "latin1").toString("utf8");
    const ext = path.extname(nomeOriginal).slice(1).toLowerCase();
    if (!EXTENSOES.has(ext)) throw new BadRequestException(`Tipo de arquivo não aceito (.${ext || "?"}).`);

    let versao = 1;
    let origemId: string | null = null;
    let categoria = dados.categoria ?? "outro";
    if (dados.documentoOrigemId) {
      const base = await this.db.estrategicoDocumento.findFirst({
        where: { id: dados.documentoOrigemId, casoId, organizationId: user.organizationId },
      });
      if (!base) throw new BadRequestException("Documento de origem não encontrado neste assunto.");
      origemId = base.documentoOrigemId ?? base.id;
      const ultima = await this.db.estrategicoDocumento.aggregate({
        where: { OR: [{ id: origemId }, { documentoOrigemId: origemId }] },
        _max: { versao: true },
      });
      versao = (ultima._max.versao ?? 1) + 1;
      categoria = dados.categoria ?? base.categoria;
    }

    const id = randomUUID();
    const ref = await this.storage.gravar(user.organizationId, casoId, `${id}.${ext}`, arquivo.buffer);
    const doc = await this.db.estrategicoDocumento.create({
      data: {
        id, organizationId: user.organizationId, casoId, categoria,
        titulo: dados.titulo?.trim() || nomeOriginal, nomeOriginal, arquivoRef: ref,
        mime: MIMES[ext] ?? arquivo.mimetype ?? "application/octet-stream", tamanho: arquivo.size,
        versao, documentoOrigemId: origemId, eventoId: dados.eventoId ?? null, tarefaId: dados.tarefaId ?? null,
        observacoes: dados.observacoes ?? null, criadoPorId: user.id,
      },
    });
    await this.repo.historico(user.organizationId, casoId, {
      userId: user.id, acao: "anexou", ip,
      descricao: `Documento anexado: ${doc.titulo}${versao > 1 ? ` (versão ${versao})` : ""}.`,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_documentos",
      registroId: doc.id, acao: "anexar", descricao: `${caso.codigo}: ${doc.titulo}`, ip,
    });
    return doc;
  }

  async paraDownload(user: Usuario, id: string, ip?: string) {
    const doc = await this.db.estrategicoDocumento.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null, caso: { deletedAt: null } },
    });
    if (!doc) throw new NotFoundException("Documento não encontrado");
    if (!this.storage.existe(doc.arquivoRef)) throw new NotFoundException("Arquivo não encontrado no armazenamento");
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_documentos",
      registroId: doc.id, acao: "baixar", descricao: doc.titulo, ip,
    });
    return { stream: this.storage.abrirLeitura(doc.arquivoRef), nomeOriginal: doc.nomeOriginal, mime: doc.mime ?? "application/octet-stream" };
  }

  async excluir(user: Usuario, id: string, ip?: string) {
    const doc = await this.db.estrategicoDocumento.findFirst({ where: { id, organizationId: user.organizationId, deletedAt: null } });
    if (!doc) throw new NotFoundException("Documento não encontrado");
    await this.db.estrategicoDocumento.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.repo.historico(user.organizationId, doc.casoId, {
      userId: user.id, acao: "removeu_anexo", ip, descricao: `Documento removido: ${doc.titulo} (versão ${doc.versao}).`,
    });
    await this.audit.log({
      organizationId: user.organizationId, userId: user.id, modulo: "estrategico", tabela: "estrategico_documentos",
      registroId: id, acao: "excluir", descricao: doc.titulo, ip,
    });
    return { ok: true };
  }
}
