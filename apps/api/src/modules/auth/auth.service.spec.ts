import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthTokenType } from "@prisma/client";
import { AuthService } from "./auth.service";
import { LoginThrottle } from "./login-throttle";
import { hashToken } from "../../common/auth-tokens";
import { REFRESH_COOKIE } from "./auth-cookies";

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "owner@shop.test",
    passwordHash: bcrypt.hashSync("secret123", 4),
    displayName: "Owner",
    role: "OWNER",
    tenantId: "t1",
    active: true,
    staffPages: [],
    seeItemCost: true,
    outlets: [{ outletId: "o1" }],
    tenant: {
      id: "t1",
      name: "Shop",
      slug: "shop",
      status: "ACTIVE",
      currency: "EGP",
      timezone: "Africa/Cairo",
      locale: "en",
      country: "EG",
      theme: "gold",
    },
    ...over,
  };
}

function makePrisma() {
  const sessions: any[] = [];
  const tokens: any[] = [];
  const users = [userRow(), userRow({ id: "staff-1", email: "staff@shop.test", role: "STAFF", displayName: "Staff" })];
  const outlets = [{ id: "o1", name: "Main", tenantId: "t1", active: true }];
  return {
    sessions,
    tokens,
    users,
    user: {
      findUnique: async ({ where }: any) =>
        users.find((u) => u.id === where.id || u.email === where.email) ?? null,
      findFirst: async ({ where }: any) =>
        users.find((u) => u.id === where.id && u.tenantId === where.tenantId) ?? null,
      update: async ({ where, data }: any) => {
        const u = users.find((row) => row.id === where.id)!;
        Object.assign(u, data);
        return u;
      },
    },
    outlet: {
      findMany: async () => outlets,
    },
    authSession: {
      create: async ({ data }: any) => {
        const row = { id: `s${sessions.length + 1}`, revokedAt: null, lastUsedAt: new Date(), ...data };
        sessions.push(row);
        return row;
      },
      findUnique: async ({ where }: any) =>
        sessions.find((s) => s.id === where.id || s.tokenHash === where.tokenHash) ?? null,
      findFirst: async ({ where }: any) =>
        sessions.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
      findMany: async () => sessions,
      update: async ({ where, data }: any) => {
        const row = sessions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        for (const row of sessions) {
          if (typeof where.id === "string" && row.id !== where.id) continue;
          if (where.id?.not && row.id === where.id.not) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.revokedAt === null && row.revokedAt) continue;
          Object.assign(row, data);
        }
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
    },
    authOneTimeToken: {
      create: async ({ data }: any) => {
        const row = { id: `tok${tokens.length + 1}`, consumedAt: null, ...data };
        tokens.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const row = tokens.find((t) => t.tokenHash === where.tokenHash);
        if (!row) return null;
        return { ...row, user: users.find((u) => u.id === row.userId) };
      },
      update: async ({ where, data }: any) => {
        const row = tokens.find((t) => t.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        for (const row of tokens) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.type && row.type !== where.type) continue;
          if (where.consumedAt === null && row.consumedAt) continue;
          Object.assign(row, data);
        }
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
    },
    auditLog: { create: async () => ({}) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  emails: string[] = [],
  devices: { issueForLogin: (...args: unknown[]) => Promise<unknown> } = {
    issueForLogin: async () => ({ device: null, license: null }),
  },
) {
  const jwt = {
    signAsync: async (payload: { sub: string; sid: string }) => `jwt.${payload.sub}.${payload.sid}`,
    verifyAsync: async (token: string) => {
      const [, sub, sid] = token.split(".");
      return { sub, sid };
    },
  };
  const config = {
    get: (key: string) => {
      if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
      if (key === "REFRESH_TOKEN_EXPIRES_IN") return "7d";
      if (key === "APP_PUBLIC_URL") return "http://localhost:5173";
      if (key === "AUTH_COOKIE_SECURE") return "false";
      return undefined;
    },
  };
  const email = {
    sendPasswordReset: async (m: { resetUrl: string }) => emails.push(m.resetUrl),
    sendPasswordChanged: async () => emails.push("changed"),
  };
  return new AuthService(
    prisma as any,
    jwt as any,
    config as any,
    devices as any,
    email as any,
    new LoginThrottle(),
  );
}

function reqRes(cookie?: string) {
  const cookies: Record<string, string> = {};
  const req = {
    ip: "127.0.0.1",
    headers: { cookie, "user-agent": "test" },
    secure: false,
  } as any;
  const res = {
    cookie: (name: string, value: string) => {
      cookies[name] = value;
    },
    clearCookie: (name: string) => {
      delete cookies[name];
    },
  } as any;
  return { req, res, cookies };
}

test("login succeeds with valid credentials and sets a refresh cookie", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const { req, res, cookies } = reqRes();
  const result = await auth.login("owner@shop.test", "secret123", undefined, undefined, req, res);
  assert.ok(result.token.startsWith("jwt.user-1."));
  assert.equal(result.expiresIn, 900);
  assert.ok(cookies[REFRESH_COOKIE]);
  assert.equal(prisma.sessions.length, 1);
  assert.notEqual(prisma.sessions[0].tokenHash, cookies[REFRESH_COOKIE]);
});

test("login rejects a bad password", async () => {
  const auth = makeService(makePrisma());
  const { req, res } = reqRes();
  await assert.rejects(() => auth.login("owner@shop.test", "nope", undefined, undefined, req, res), UnauthorizedException);
});

test("login rejects an unknown email with the same error", async () => {
  const auth = makeService(makePrisma());
  const { req, res } = reqRes();
  await assert.rejects(() => auth.login("missing@shop.test", "secret123", undefined, undefined, req, res), UnauthorizedException);
});

test("login rejects an inactive user", async () => {
  const prisma = makePrisma();
  prisma.users[0].active = false;
  const auth = makeService(prisma);
  const { req, res } = reqRes();
  await assert.rejects(() => auth.login("owner@shop.test", "secret123", undefined, undefined, req, res), UnauthorizedException);
});

test("login rejects a suspended tenant", async () => {
  const prisma = makePrisma();
  prisma.users[0].tenant.status = "SUSPENDED";
  const auth = makeService(prisma);
  const { req, res } = reqRes();
  await assert.rejects(() => auth.login("owner@shop.test", "secret123", undefined, undefined, req, res), UnauthorizedException);
});

test("refresh rotates the token and rejects reuse", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  const raw = first.cookies[REFRESH_COOKIE];
  const second = reqRes(`${REFRESH_COOKIE}=${raw}`);
  const rotated = await auth.refresh(second.req, second.res);
  assert.ok(rotated.token);
  assert.notEqual(second.cookies[REFRESH_COOKIE], raw);
  const reuse = reqRes(`${REFRESH_COOKIE}=${raw}`);
  await assert.rejects(() => auth.refresh(reuse.req, reuse.res), UnauthorizedException);
});

test("refresh rejects a revoked session", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  prisma.sessions[0].revokedAt = new Date();
  const second = reqRes(`${REFRESH_COOKIE}=${first.cookies[REFRESH_COOKIE]}`);
  await assert.rejects(() => auth.refresh(second.req, second.res), UnauthorizedException);
});

test("refresh rejects an expired session", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  prisma.sessions[0].expiresAt = new Date(Date.now() - 1000);
  const second = reqRes(`${REFRESH_COOKIE}=${first.cookies[REFRESH_COOKIE]}`);
  await assert.rejects(() => auth.refresh(second.req, second.res), UnauthorizedException);
});

test("logout current session is idempotent", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  const second = reqRes(`${REFRESH_COOKIE}=${first.cookies[REFRESH_COOKIE]}`);
  await auth.logout(second.req, second.res);
  await auth.logout(second.req, second.res);
  assert.ok(prisma.sessions[0].revokedAt);
});

test("logout-all revokes every session", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const a = reqRes();
  const b = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, a.req, a.res);
  await auth.login("owner@shop.test", "secret123", undefined, undefined, b.req, b.res);
  await auth.logoutAll("user-1", "t1");
  assert.ok(prisma.sessions.every((s) => s.revokedAt));
});

test("forgot-password is generic and emails a hashed token", async () => {
  const prisma = makePrisma();
  const urls: string[] = [];
  const auth = makeService(prisma, urls);
  const known = await auth.forgotPassword("owner@shop.test");
  const unknown = await auth.forgotPassword("nope@shop.test");
  assert.equal(known.message, unknown.message);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /reset-password\?token=/);
  assert.equal(prisma.tokens[0].type, AuthTokenType.PASSWORD_RESET);
  const raw = new URL(urls[0]).searchParams.get("token")!;
  assert.equal(prisma.tokens[0].tokenHash, hashToken(raw));
});

test("reset-password updates the hash, consumes the token, and revokes sessions", async () => {
  const prisma = makePrisma();
  const urls: string[] = [];
  const auth = makeService(prisma, urls);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  await auth.forgotPassword("owner@shop.test");
  const raw = new URL(urls[0]).searchParams.get("token")!;
  await auth.resetPassword(raw, "newpass12");
  assert.ok(prisma.sessions[0].revokedAt);
  assert.ok(prisma.tokens[0].consumedAt);
  const again = reqRes();
  await assert.rejects(() => auth.login("owner@shop.test", "secret123", undefined, undefined, again.req, again.res), UnauthorizedException);
  const ok = await auth.login("owner@shop.test", "newpass12", undefined, undefined, reqRes().req, reqRes().res);
  assert.ok(ok.token);
  await assert.rejects(() => auth.resetPassword(raw, "another99"), BadRequestException);
});

test("reset-password rejects an expired token", async () => {
  const prisma = makePrisma();
  const urls: string[] = [];
  const auth = makeService(prisma, urls);
  await auth.forgotPassword("owner@shop.test");
  prisma.tokens[0].expiresAt = new Date(Date.now() - 1000);
  const raw = new URL(urls[0]).searchParams.get("token")!;
  await assert.rejects(() => auth.resetPassword(raw, "newpass12"), BadRequestException);
});

test("change-password requires the current password and keeps the current session", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  const first = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, first.req, first.res);
  const other = reqRes();
  await auth.login("owner@shop.test", "secret123", undefined, undefined, other.req, other.res);
  await assert.rejects(() => auth.changePassword("user-1", "wrong", "newpass12", prisma.sessions[0].id), UnauthorizedException);
  await auth.changePassword("user-1", "secret123", "newpass12", prisma.sessions[0].id);
  assert.equal(prisma.sessions[0].revokedAt, null);
  assert.ok(prisma.sessions[1].revokedAt);
});

test("owner cannot reset another owner via admin reset", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  await assert.rejects(
    () =>
      auth.adminResetPassword(
        { id: "user-1", role: "OWNER", tenantId: "t1" } as any,
        "t1",
        "user-1",
        "newpass12",
      ),
    ForbiddenException,
  );
});

test("owner can reset staff password", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma);
  await auth.adminResetPassword(
    { id: "user-1", role: "OWNER", tenantId: "t1" } as any,
    "t1",
    "staff-1",
    "newpass12",
  );
  const { req, res } = reqRes();
  const ok = await auth.login("staff@shop.test", "newpass12", undefined, undefined, req, res);
  assert.ok(ok.token);
});

test("login succeeds and returns license null when the device belongs to another business", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma, [], {
    issueForLogin: async () => {
      throw new ForbiddenException("This device is registered to another business");
    },
  });
  const { req, res } = reqRes();
  const result = await auth.login("owner@shop.test", "secret123", "DEVICE-old", "test", req, res);
  assert.ok(result.token.startsWith("jwt.user-1."));
  assert.equal(result.license, null);
  assert.equal(result.device, null);
  assert.ok(result.outlets.length);
});

test("login still fails for unexpected license errors", async () => {
  const prisma = makePrisma();
  const auth = makeService(prisma, [], {
    issueForLogin: async () => {
      throw new Error("license signing failed");
    },
  });
  const { req, res } = reqRes();
  await assert.rejects(
    () => auth.login("owner@shop.test", "secret123", "DEVICE-old", "test", req, res),
    /license signing failed/,
  );
});
