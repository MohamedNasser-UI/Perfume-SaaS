import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateTenantInput } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { ensureSequences } from "../../common/sequences";
import { seedTenantDefaults } from "./tenant-defaults";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: { select: { outlets: true, users: true, customers: true } },
        outlets: { select: { id: true, name: true, active: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        outlets: true,
        users: { select: { id: true, email: true, displayName: true, role: true, active: true } },
      },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  async createTenant(input: CreateTenantInput, actorId: string) {
    const exists = await this.prisma.tenant.findUnique({ where: { slug: input.slug } });
    if (exists) throw new BadRequestException("Slug already in use");
    const emailTaken = await this.prisma.user.findUnique({
      where: { email: input.ownerEmail.toLowerCase() },
    });
    if (emailTaken) throw new BadRequestException("Owner email already in use");

    const passwordHash = await this.auth.hashPassword(input.ownerPassword);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          currency: input.currency ?? "EGP",
          timezone: input.timezone ?? "Africa/Cairo",
          locale: input.locale ?? "en-EG",
          country: input.country ?? "EG",
          notes: input.notes,
          status: "ACTIVE",
        },
      });

      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: input.outletName,
          address: input.outletAddress,
          phone: input.outletPhone,
        },
      });

      await ensureSequences(tx, tenant.id, outlet.id);

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.ownerEmail.toLowerCase(),
          passwordHash,
          displayName: input.ownerName,
          role: "OWNER",
        },
      });

      await tx.userOutlet.create({ data: { userId: owner.id, outletId: outlet.id } });
      await seedTenantDefaults(tx, tenant.id);
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: actorId,
          action: "CREATE",
          entity: "TENANT",
          entityId: tenant.id,
          after: { name: tenant.name, slug: tenant.slug },
        },
      });

      return { tenant, outlet, owner: { id: owner.id, email: owner.email, displayName: owner.displayName } };
    });
  }

  async updateStatus(id: string, status: "ACTIVE" | "SUSPENDED", notes: string | undefined, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException("Tenant not found");
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status, notes: notes ?? tenant.notes },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        userId: actorId,
        action: status === "SUSPENDED" ? "SUSPEND" : "ACTIVATE",
        entity: "TENANT",
        entityId: id,
        before: { status: tenant.status },
        after: { status },
      },
    });
    return updated;
  }
}
