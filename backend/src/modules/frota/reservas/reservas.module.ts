import { Module } from "@nestjs/common";
import { ReservasController } from "./reservas.controller";
import { ReservasService } from "./reservas.service";
import { AuditModule } from "../../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
