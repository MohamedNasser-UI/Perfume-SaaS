import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LicenseService } from "../license/license.service";
import { SignedLicense } from "../license/license.crypto";

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenses: LicenseService,
  ) {}

  async issueForLogin(input: {
    tenantId: string;
    userId: string;
    deviceId: string;
    deviceLabel?: string;
    tenantStatus: "ACTIVE" | "SUSPENDED";
  }): Promise<{ device: { id: string; tenantId: string; lastLicenseExpiresAt: Date | null }; license: SignedLicense }> {
    if (input.tenantStatus !== "ACTIVE") {
      throw new ForbiddenException("This business account is suspended");
    }
    return this.issue(input);
  }

  async issue(input: { tenantId: string; userId: string; deviceId: string; deviceLabel?: string }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    if (tenant.status !== "ACTIVE") {
      throw new ForbiddenException("This business account is suspended");
    }

    const existing = await this.prisma.device.findUnique({ where: { id: input.deviceId } });
    if (existing && existing.tenantId !== input.tenantId) {
      throw new ForbiddenException("This device is registered to another business");
    }

    const now = new Date();
    const license = this.licenses.issue({
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      subscriptionStatus: "active",
    });
    const expiresAt = new Date(license.payload.expiresAt);

    const device = await this.prisma.device.upsert({
      where: { id: input.deviceId },
      create: {
        id: input.deviceId,
        tenantId: input.tenantId,
        label: input.deviceLabel,
        lastSeenAt: now,
        lastLicenseExpiresAt: expiresAt,
      },
      update: {
        lastSeenAt: now,
        lastLicenseExpiresAt: expiresAt,
        ...(input.deviceLabel ? { label: input.deviceLabel } : {}),
      },
    });

    await this.prisma.deviceUser.upsert({
      where: { deviceId_userId: { deviceId: input.deviceId, userId: input.userId } },
      create: { deviceId: input.deviceId, userId: input.userId, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now },
    });

    await this.prisma.licenseIssue.create({
      data: {
        tenantId: input.tenantId,
        deviceId: input.deviceId,
        issuedAt: now,
        expiresAt,
        payload: license.payload as Prisma.InputJsonValue,
      },
    });

    return {
      device: {
        id: device.id,
        tenantId: device.tenantId,
        lastLicenseExpiresAt: expiresAt,
      },
      license,
    };
  }


  async listForTenant(tenantId: string) {
    const devices = await this.prisma.device.findMany({
      where: { tenantId },
      include: {
        users: {
          include: { user: { select: { id: true, email: true, displayName: true, role: true, active: true } } },
        },
        _count: { select: { syncMutations: true } },
      },
      orderBy: { lastSeenAt: "desc" },
    });
    return devices.map((d) => ({
      id: d.id,
      label: d.label,
      lastSeenAt: d.lastSeenAt,
      lastLicenseExpiresAt: d.lastLicenseExpiresAt,
      createdAt: d.createdAt,
      pendingMutations: d._count.syncMutations,
      users: d.users.map((u) => ({
        userId: u.user.id,
        email: u.user.email,
        displayName: u.user.displayName,
        role: u.user.role,
        active: u.user.active,
        firstSeenAt: u.firstSeenAt,
        lastSeenAt: u.lastSeenAt,
      })),
    }));
  }
}
