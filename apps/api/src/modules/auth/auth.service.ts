import { Injectable, Logger, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { AuthTokenType } from "@prisma/client";
import { Request, Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { RequestUser, StaffPage } from "../../common/context";
import { STAFF_PAGES } from "@perfume/validation";
import { JwtPayload } from "./jwt.strategy";
import { DevicesService } from "../devices/devices.service";
import { EmailService } from "../email/email.service";
import { generateOpaqueToken, hashToken, parseDuration, readCookie } from "../../common/auth-tokens";
import { clearRefreshCookie, REFRESH_COOKIE, refreshCookieMaxAge, setRefreshCookie } from "./auth-cookies";
import { LoginThrottle } from "./login-throttle";

const RESET_TTL_MS = 20 * 60 * 1000;
const GENERIC_RESET_MESSAGE = "If an account exists for this email, a password reset link has been sent.";
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-dummy", 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly devices: DevicesService,
    private readonly email: EmailService,
    private readonly loginThrottle: LoginThrottle,
  ) {}

  accessExpiresIn() {
    return this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
  }

  accessExpiresSeconds() {
    return Math.floor(parseDuration(this.accessExpiresIn(), 15 * 60 * 1000) / 1000);
  }

  async login(
    email: string,
    password: string,
    deviceId: string | undefined,
    deviceLabel: string | undefined,
    req: Request,
    res: Response,
  ) {
    const key = this.loginThrottle.key(email, req.ip ?? "unknown");
    await this.loginThrottle.wait(key);

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { outlets: true, tenant: true },
    });
    const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.active || !ok) {
      this.loginThrottle.fail(key);
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.role !== "PLATFORM_ADMIN" && user.tenant?.status === "SUSPENDED") {
      this.loginThrottle.fail(key);
      throw new UnauthorizedException("This business account is suspended");
    }
    this.loginThrottle.reset(key);

    const session = await this.createSession(user.id, req, deviceId);
    const token = await this.signAccessToken(user.id, session.id);
    setRefreshCookie(res, req, this.config, session.rawToken);

    const mapped = this.mapUser(user);
    const outlets =
      user.role === "PLATFORM_ADMIN"
        ? []
        : await this.prisma.outlet.findMany({
            where: {
              tenantId: user.tenantId!,
              active: true,
              ...(user.role === "OWNER" ? {} : { id: { in: user.outlets.map((o) => o.outletId) } }),
            },
            orderBy: { name: "asc" },
          });

    let device: { id: string; tenantId: string; lastLicenseExpiresAt: Date | null } | null = null;
    let license: Awaited<ReturnType<DevicesService["issue"]>>["license"] | null = null;
    if (user.role !== "PLATFORM_ADMIN" && user.tenantId && deviceId) {
      try {
        const issued = await this.devices.issueForLogin({
          tenantId: user.tenantId,
          userId: user.id,
          deviceId,
          deviceLabel,
          tenantStatus: user.tenant!.status,
        });
        device = issued.device;
        license = issued.license;
      } catch (err) {
        if (this.isOtherBusinessLicenseError(err)) {
          this.logger.warn(`license issuance failed during login user=${user.id} device=${deviceId}`);
          device = null;
          license = null;
        } else {
          throw err;
        }
      }
    }

    await this.audit(user.tenantId, user.id, "LOGIN_SUCCESS", "USER", user.id);

    return {
      token,
      expiresIn: this.accessExpiresSeconds(),
      user: mapped,
      tenant: user.tenant ? this.mapTenant(user.tenant) : null,
      outlets,
      device,
      license,
    };
  }

  async refresh(req: Request, res: Response) {
    const raw = readCookie(req.headers.cookie, REFRESH_COOKIE);
    if (!raw) throw new UnauthorizedException();
    const tokenHash = hashToken(raw);
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      clearRefreshCookie(res, req, this.config);
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { tenant: true },
    });
    if (!user || !user.active) {
      await this.revokeSession(session.id);
      clearRefreshCookie(res, req, this.config);
      throw new UnauthorizedException();
    }
    if (user.role !== "PLATFORM_ADMIN" && user.tenant?.status === "SUSPENDED") {
      await this.revokeSession(session.id);
      clearRefreshCookie(res, req, this.config);
      throw new UnauthorizedException("This business account is suspended");
    }

    const rotated = await this.createSession(user.id, req, session.deviceId ?? undefined);
    await this.revokeSession(session.id);
    setRefreshCookie(res, req, this.config, rotated.rawToken);
    const token = await this.signAccessToken(user.id, rotated.id);
    return { token, expiresIn: this.accessExpiresSeconds() };
  }

  async logout(req: Request, res: Response) {
    const raw = readCookie(req.headers.cookie, REFRESH_COOKIE);
    if (raw) {
      const session = await this.prisma.authSession.findUnique({ where: { tokenHash: hashToken(raw) } });
      if (session && !session.revokedAt) {
        await this.revokeSession(session.id);
        await this.audit(null, session.userId, "LOGOUT", "AUTH_SESSION", session.id);
      }
    }
    const bearer = req.headers.authorization;
    if (typeof bearer === "string" && bearer.startsWith("Bearer ")) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(bearer.slice(7));
        if (payload.sid) await this.revokeSession(payload.sid);
      } catch {
        /* expired access token is fine */
      }
    }
    clearRefreshCookie(res, req, this.config);
    return { ok: true };
  }

  async logoutAll(userId: string, tenantId: string | null) {
    await this.revokeAllSessions(userId);
    await this.audit(tenantId, userId, "LOGOUT", "USER", userId, { scope: "all" });
    return { ok: true };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        userAgent: true,
        ipAddress: true,
        deviceId: true,
      },
    });
    return sessions.map((row) => ({ ...row, current: row.id === currentSessionId }));
  }

  async revokeOwnSession(userId: string, sessionId: string) {
    const session = await this.prisma.authSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException();
    if (!session.revokedAt) await this.revokeSession(session.id);
    await this.audit(null, userId, "SESSION_REVOKED", "AUTH_SESSION", sessionId);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { outlets: true, tenant: true },
    });
    if (!user) throw new UnauthorizedException();
    const outlets =
      user.role === "PLATFORM_ADMIN"
        ? []
        : await this.prisma.outlet.findMany({
            where: {
              tenantId: user.tenantId!,
              active: true,
              ...(user.role === "OWNER" ? {} : { id: { in: user.outlets.map((o) => o.outletId) } }),
            },
            orderBy: { name: "asc" },
          });
    return { user: this.mapUser(user), tenant: user.tenant ? this.mapTenant(user.tenant) : null, outlets };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });
    if (user?.active && (user.role === "PLATFORM_ADMIN" || user.tenant?.status !== "SUSPENDED")) {
      await this.prisma.authOneTimeToken.updateMany({
        where: { userId: user.id, type: AuthTokenType.PASSWORD_RESET, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      const raw = generateOpaqueToken();
      await this.prisma.authOneTimeToken.create({
        data: {
          userId: user.id,
          type: AuthTokenType.PASSWORD_RESET,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
      const appUrl = (this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:5173").replace(/\/$/, "");
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(raw)}`;
      try {
        await this.email.sendPasswordReset({
          to: user.email,
          displayName: user.displayName,
          resetUrl,
          expiresMinutes: 20,
        });
      } catch (err) {
        this.logger.error(err);
      }
      await this.audit(user.tenantId, user.id, "PASSWORD_RESET_REQUESTED", "USER", user.id);
    }
    return { message: GENERIC_RESET_MESSAGE };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = hashToken(rawToken);
    const record = await this.prisma.authOneTimeToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !record ||
      record.type !== AuthTokenType.PASSWORD_RESET ||
      record.consumedAt ||
      record.expiresAt <= new Date()
    ) {
      throw new BadRequestException("Invalid or expired reset token");
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.authOneTimeToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
    ]);
    await this.revokeAllSessions(record.userId);
    await this.audit(record.user.tenantId, record.userId, "PASSWORD_RESET_COMPLETED", "USER", record.userId);
    try {
      await this.email.sendPasswordChanged({ to: record.user.email, displayName: record.user.displayName });
    } catch (err) {
      this.logger.error(err);
    }
    return { ok: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.revokeOtherSessions(userId, keepSessionId);
    await this.audit(user.tenantId, userId, "PASSWORD_CHANGED", "USER", userId);
    try {
      await this.email.sendPasswordChanged({ to: user.email, displayName: user.displayName });
    } catch (err) {
      this.logger.error(err);
    }
    return { ok: true };
  }

  async adminResetPassword(actor: RequestUser, tenantId: string, targetId: string, newPassword: string) {
    const target = await this.prisma.user.findFirst({ where: { id: targetId, tenantId } });
    if (!target) throw new NotFoundException();
    if (target.role !== "STAFF") {
      throw new ForbiddenException("Only staff passwords can be reset here");
    }
    if (actor.role !== "OWNER" && actor.role !== "PLATFORM_ADMIN") {
      throw new ForbiddenException();
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    await this.revokeAllSessions(target.id);
    await this.audit(tenantId, actor.id, "PASSWORD_CHANGED", "USER", target.id, { by: "admin" });
    try {
      await this.email.sendPasswordChanged({ to: target.email, displayName: target.displayName });
    } catch (err) {
      this.logger.error(err);
    }
    return { ok: true };
  }

  async resolveUser(userId: string): Promise<RequestUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { outlets: true },
    });
    if (!user || !user.active) return null;
    return this.mapUser(user);
  }

  async assertSession(sessionId: string, userId: string) {
    const session = await this.prisma.authSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= new Date()) {
      return false;
    }
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);
    return true;
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  private isOtherBusinessLicenseError(err: unknown) {
    if (!(err instanceof ForbiddenException)) return false;
    const body = err.getResponse();
    const message = typeof body === "string" ? body : typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : err.message;
    return message.includes("another business");
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async cleanupExpired() {
    const now = new Date();
    const retain = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tokens = await this.prisma.authOneTimeToken.deleteMany({ where: { expiresAt: { lt: now } } });
    const sessions = await this.prisma.authSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null, lt: retain } }],
      },
    });
    return { tokens: tokens.count, sessions: sessions.count };
  }

  private async revokeOtherSessions(userId: string, keepSessionId?: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeSession(id: string) {
    await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(userId: string, req: Request, deviceId?: string) {
    const rawToken = generateOpaqueToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + refreshCookieMaxAge(this.config)),
        lastUsedAt: new Date(),
        ipAddress: req.ip?.slice(0, 64) ?? null,
        userAgent: req.headers["user-agent"]?.toString().slice(0, 180) ?? null,
        deviceId: deviceId?.slice(0, 80) ?? null,
      },
    });
    return { ...session, rawToken };
  }

  private async signAccessToken(userId: string, sessionId: string) {
    const payload: JwtPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload, { expiresIn: this.accessExpiresSeconds() });
  }

  private async audit(
    tenantId: string | null,
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    after?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { tenantId, userId, action, entity, entityId, after: after ? JSON.parse(JSON.stringify(after)) : undefined },
      });
    } catch (err) {
      this.logger.warn(`Audit log failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  private mapTenant(tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    timezone: string;
    locale: string;
    country: string;
    theme: string;
  }) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      currency: tenant.currency,
      timezone: tenant.timezone,
      locale: tenant.locale,
      country: tenant.country,
      theme: tenant.theme,
    };
  }

  private mapUser(user: {
    id: string;
    email: string;
    displayName: string;
    role: RequestUser["role"];
    tenantId: string | null;
    staffPages?: string[];
    seeItemCost?: boolean;
    outlets: { outletId: string }[];
  }): RequestUser {
    const stored = (user.staffPages ?? []).filter((p): p is StaffPage =>
      (STAFF_PAGES as readonly string[]).includes(p),
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      tenantId: user.tenantId,
      outletIds: user.outlets.map((o) => o.outletId),
      staffPages: user.role === "STAFF" ? stored : [...STAFF_PAGES],
      seeItemCost: user.role === "STAFF" ? user.seeItemCost !== false : true,
    };
  }
}
