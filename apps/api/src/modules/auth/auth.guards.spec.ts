import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PageAccessGuard, RolesGuard } from "../../common/guards";
import { RequestUser } from "../../common/context";

function ctx(user?: Partial<RequestUser>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

test("RolesGuard allows matching role", () => {
  const reflector = {
    getAllAndOverride: () => ["OWNER"],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  assert.equal(guard.canActivate(ctx({ role: "OWNER" })), true);
});

test("RolesGuard rejects the wrong role", () => {
  const reflector = {
    getAllAndOverride: () => ["OWNER"],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  assert.throws(() => guard.canActivate(ctx({ role: "STAFF" })), ForbiddenException);
});

test("RolesGuard rejects missing user", () => {
  const reflector = {
    getAllAndOverride: () => ["OWNER"],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  assert.throws(() => guard.canActivate(ctx(undefined)), UnauthorizedException);
});

test("PageAccessGuard allows owner", () => {
  const reflector = {
    getAllAndOverride: () => "settings",
  } as unknown as Reflector;
  const guard = new PageAccessGuard(reflector);
  assert.equal(guard.canActivate(ctx({ role: "OWNER", staffPages: [] })), true);
});

test("PageAccessGuard rejects staff without the page", () => {
  const reflector = {
    getAllAndOverride: () => "settings",
  } as unknown as Reflector;
  const guard = new PageAccessGuard(reflector);
  assert.throws(
    () => guard.canActivate(ctx({ role: "STAFF", staffPages: ["dashboard"] })),
    ForbiddenException,
  );
});

test("PageAccessGuard allows staff with the page", () => {
  const reflector = {
    getAllAndOverride: () => "settings",
  } as unknown as Reflector;
  const guard = new PageAccessGuard(reflector);
  assert.equal(guard.canActivate(ctx({ role: "STAFF", staffPages: ["settings"] })), true);
});
