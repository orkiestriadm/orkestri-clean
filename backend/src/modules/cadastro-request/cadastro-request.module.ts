import {
  Module, Controller, Get, Post, Patch, Body, Param,
  UseGuards, Req, ForbiddenException, NotFoundException,
  BadRequestException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcryptjs';

// ─── DTOs ────────────────────────────────────────────────────────────────────

class CreateCadastroRequestDto {
  nomeOrg: string;
  slugOrg?: string;
  planoSolicitado?: string;
  contatoNome?: string;
  contatoEmail: string;
  contatoWhatsapp?: string;
  clienteId?: string;
  observacoes?: string;
}

class RejectCadastroRequestDto {
  motivo: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CadastroRequestService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cadastroRequest.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string) {
    const req = await this.prisma.cadastroRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Solicitação não encontrada');
    return req;
  }

  async create(dto: CreateCadastroRequestDto, userId: string, orgId: string) {
    const existing = await this.prisma.cadastroRequest.findFirst({
      where: { contatoEmail: dto.contatoEmail, status: 'PENDENTE' },
    });
    if (existing)
      throw new BadRequestException('Já existe uma solicitação pendente para este e-mail.');

    const slug =
      dto.slugOrg ||
      dto.nomeOrg
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return this.prisma.cadastroRequest.create({
      data: {
        organizationId: orgId,
        clienteId: dto.clienteId || null,
        nomeOrg: dto.nomeOrg,
        slugOrg: slug,
        planoSolicitado: dto.planoSolicitado || 'starter',
        contatoNome: dto.contatoNome || null,
        contatoEmail: dto.contatoEmail,
        contatoWhatsapp: dto.contatoWhatsapp || null,
        observacoes: dto.observacoes || null,
        criadoPorId: userId,
        status: 'PENDENTE',
      },
    });
  }

  async aprovar(id: string, aprovadoPorId: string) {
    const req = await this.findOne(id);
    if (req.status !== 'PENDENTE')
      throw new BadRequestException('Apenas solicitações pendentes podem ser aprovadas.');

    // 1. Garante slug único
    let slug = req.slugOrg || req.nomeOrg.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const slugExiste = await this.prisma.organization.findUnique({ where: { slug } });
    if (slugExiste) slug = `${slug}-${Date.now()}`;

    // 2. Cria a organização
    const org = await this.prisma.organization.create({
      data: {
        nome: req.nomeOrg,
        slug,
        plano: req.planoSolicitado,
        ativo: true,
        statusOperacional: 'ativo',
        statusComercial: 'ativo',
        crmClienteId: req.clienteId || null,
        modulosAtivos: [],
      },
    });

    // 3. Gera senha temporária
    const senhaTemp = `Orkiestri@${Math.floor(1000 + Math.random() * 9000)}`;
    const senhaHash = await bcrypt.hash(senhaTemp, 10);

    // 4. Cria usuário master na nova org
    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        nome: req.contatoNome || req.nomeOrg,
        email: req.contatoEmail,
        senhaHash,
        ativo: true,
        primeiroAcesso: true,
      },
    });

    // 5. Atribui role master
    const masterRole = await this.prisma.role.findFirst({ where: { isMaster: true } });
    if (masterRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: masterRole.id, atribuidoPorId: aprovadoPorId },
      });
    }

    // 6. Cria UserProfile
    await this.prisma.userProfile.create({
      data: {
        userId: user.id,
        modulos: JSON.stringify(['projetos', 'keep', 'gantt', 'relatorios', 'chamados', 'clientes', 'contratos']),
      },
    });

    // 7. Atualiza CadastroRequest
    await this.prisma.cadastroRequest.update({
      where: { id },
      data: {
        status: 'PROVISIONADO',
        aprovadoPorId,
        aprovadoEm: new Date(),
        provisionadoEm: new Date(),
        orgProvisionadaId: org.id,
      },
    });

    // 8. Vincula cliente CRM à org (se havia cliente)
    if (req.clienteId) {
      await this.prisma.cliente
        .update({
          where: { id: req.clienteId },
          data: { tenantOrgId: org.id, statusLead: 'ativo' },
        })
        .catch(() => {});
    }

    // 9. Audit log
    await this.prisma.auditLog
      .create({
        data: {
          organizationId: req.organizationId,
          userId: aprovadoPorId,
          modulo: 'cadastro_request',
          tabela: 'cadastro_requests',
          registroId: id,
          acao: 'APROVAR',
          descricao: `Org "${org.nome}" provisionada. Acesso: ${user.email}`,
          dados: { orgId: org.id, userId: user.id },
        },
      })
      .catch(() => {});

    return {
      message: 'Organização provisionada com sucesso.',
      organizationId: org.id,
      userId: user.id,
      senhaTemporaria: senhaTemp,
      email: user.email,
    };
  }

  async rejeitar(id: string, aprovadoPorId: string, motivo: string) {
    const req = await this.findOne(id);
    if (req.status !== 'PENDENTE')
      throw new BadRequestException('Apenas solicitações pendentes podem ser rejeitadas.');
    return this.prisma.cadastroRequest.update({
      where: { id },
      data: { status: 'REJEITADO', aprovadoPorId, aprovadoEm: new Date(), rejectionReason: motivo },
    });
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller('cadastro-requests')
@UseGuards(AuthGuard('jwt'))
export class CadastroRequestController {
  constructor(private service: CadastroRequestService) {}

  @Get()
  findAll(@Req() req: any) {
    if (!req.user?.isMaster) throw new ForbiddenException('Apenas Super Admin pode acessar.');
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    if (!req.user?.isMaster) throw new ForbiddenException('Apenas Super Admin pode acessar.');
    return this.service.findOne(id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateCadastroRequestDto) {
    if (!req.user?.isMaster)
      throw new ForbiddenException('Apenas Super Admin pode criar solicitações de provisionamento.');
    return this.service.create(dto, req.user.sub, req.user.organizationId);
  }

  @Patch(':id/aprovar')
  @HttpCode(HttpStatus.OK)
  aprovar(@Req() req: any, @Param('id') id: string) {
    if (!req.user?.isMaster) throw new ForbiddenException('Apenas Super Admin pode aprovar.');
    return this.service.aprovar(id, req.user.sub);
  }

  @Patch(':id/rejeitar')
  @HttpCode(HttpStatus.OK)
  rejeitar(@Req() req: any, @Param('id') id: string, @Body() dto: RejectCadastroRequestDto) {
    if (!req.user?.isMaster) throw new ForbiddenException('Apenas Super Admin pode rejeitar.');
    return this.service.rejeitar(id, req.user.sub, dto.motivo);
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

@Module({
  controllers: [CadastroRequestController],
  providers: [CadastroRequestService],
})
export class CadastroRequestModule {}
