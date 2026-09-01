import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

export const AUTH_RATE_KEY = "authRateLimit";
export const AuthRateLimit = (limit: number, windowMs: number) => SetMetadata(AUTH_RATE_KEY, { limit, windowMs });

type Bucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<{ limit: number; windowMs: number }>(AUTH_RATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? "unknown";
    const key = `${ip}|${req.method}|${req.path}`;
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      this.prune(now);
      return true;
    }
    existing.count += 1;
    if (existing.count > rule.limit) {
      throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private prune(now: number) {
    if (this.buckets.size < 500) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
