import { Module, Controller, Patch, Get, Body, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsIn } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";

class UpdateStatusDto {
  @IsString()
  @IsIn(["disponivel","ocupado","reuniao","foco","ausente"])
  status: string;
}

@Controller("users/me")
class StatusController {
  constructor(private prisma: PrismaService) {}

  @Patch("status")
  @UseGuards(AuthGuard("jwt"))
  async updateStatus(@Body() dto: UpdateStatusDto, @Req() req: any) {
    await this.prisma.userProfile.upsert({
      where: { userId: req.user.id },
      update: { statusOnline: dto.status },
      create: { userId: req.user.id, statusOnline: dto.status },
    });
    return { status: dto.status };
  }

  @Get("status")
  @UseGuards(AuthGuard("jwt"))
  async getStatus(@Req() req: any) {
    const p = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    return { status: p?.statusOnline || "disponivel" };
  }
}

@Module({ controllers: [StatusController] })
export class StatusModule {}