import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { TenantGuard } from "./tenant.guard";
import { RolesGuard, PageAccessGuard } from "../../common/guards";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { DevicesModule } from "../devices/devices.module";
import { EmailModule } from "../email/email.module";
import { AuthCleanup } from "./auth.cleanup";
import { LoginThrottle } from "./login-throttle";
import { AuthRateLimitGuard } from "./auth-rate-limit";
import { parseDuration } from "../../common/auth-tokens";

@Module({
  imports: [
    DevicesModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "change-me-to-a-long-random-string",
        signOptions: {
          expiresIn: Math.floor(parseDuration(config.get<string>("JWT_ACCESS_EXPIRES_IN"), 15 * 60 * 1000) / 1000),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TenantGuard,
    JwtAuthGuard,
    AuthCleanup,
    LoginThrottle,
    AuthRateLimitGuard,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PageAccessGuard,
    },
  ],
  exports: [AuthService, TenantGuard],
})
export class AuthModule {}
