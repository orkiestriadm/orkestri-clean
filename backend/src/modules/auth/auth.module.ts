import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { TrialScheduler } from "./trial.scheduler";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    PassportModule,
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get("JWT_SECRET", "fallback_secret"), signOptions: { expiresIn: "8h" } }),
      inject: [ConfigService],
    }),
    NotificationsModule,
  ],
  providers: [AuthService, JwtStrategy, TrialScheduler],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
