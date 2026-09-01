import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionContext, HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthRateLimitGuard } from "./auth-rate-limit";

function ctx(path: string, ip = "1.1.1.1"): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ ip, method: "POST", path }) }),
  } as unknown as ExecutionContext;
}

test("AuthRateLimitGuard allows traffic under the limit then blocks", () => {
  const reflector = {
    getAllAndOverride: () => ({ limit: 2, windowMs: 60_000 }),
  } as unknown as Reflector;
  const guard = new AuthRateLimitGuard(reflector);
  assert.equal(guard.canActivate(ctx("/auth/login")), true);
  assert.equal(guard.canActivate(ctx("/auth/login")), true);
  assert.throws(() => guard.canActivate(ctx("/auth/login")), HttpException);
});
