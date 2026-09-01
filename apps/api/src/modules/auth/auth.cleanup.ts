import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthCleanup implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthCleanup.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly auth: AuthService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.handle();
    }, 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handle() {
    const result = await this.auth.cleanupExpired();
    if (result.tokens || result.sessions) {
      this.logger.log(`Cleaned ${result.tokens} tokens and ${result.sessions} sessions`);
    }
  }
}
