import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { D } from "../../common/money";

@Injectable()
export class ConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const [concentrations, pricing, discounts, paymentMethods, profile] = await Promise.all([
      this.prisma.concentration.findMany({ where: { tenantId }, orderBy: { oilPercentage: "asc" } }),
      this.prisma.pricingConfiguration.findUnique({ where: { tenantId } }),
      this.prisma.discountConfiguration.findMany({ where: { tenantId }, orderBy: { percentage: "asc" } }),
      this.prisma.paymentMethod.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
    ]);
    return { profile, concentrations, pricing, discounts, paymentMethods };
  }

  async updateProfile(
    tenantId: string,
    userId: string,
    data: { name?: string; currency?: string; timezone?: string; locale?: string; country?: string },
  ) {
    const before = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "UPDATE",
        entity: "TENANT_PROFILE",
        entityId: tenantId,
        before: before ? { name: before.name, currency: before.currency } : undefined,
        after: data,
      },
    });
    return updated;
  }

  async updateTheme(tenantId: string, userId: string, theme: string) {
    const before = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { theme } });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "UPDATE",
        entity: "TENANT_THEME",
        entityId: tenantId,
        before: { theme: before?.theme },
        after: { theme },
      },
    });
    return updated;
  }

  createConcentration(tenantId: string, data: { name: string; oilPercentage: number; active?: boolean }) {
    return this.prisma.concentration.create({
      data: {
        tenantId,
        name: data.name.trim(),
        oilPercentage: D(data.oilPercentage).toFixed(2),
        active: data.active ?? true,
      },
    });
  }

  async updateConcentration(tenantId: string, id: string, userId: string, data: { name?: string; oilPercentage?: number; active?: boolean }) {
    const before = await this.prisma.concentration.findFirst({ where: { id, tenantId } });
    if (!before) throw new NotFoundException();
    const updated = await this.prisma.concentration.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        oilPercentage: data.oilPercentage !== undefined ? D(data.oilPercentage).toFixed(2) : undefined,
        active: data.active,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "UPDATE",
        entity: "CONCENTRATION",
        entityId: id,
        before: { oilPercentage: Number(before.oilPercentage) },
        after: { oilPercentage: data.oilPercentage },
      },
    });
    return updated;
  }

  async updateMarkup(tenantId: string, userId: string, markupPercentage: number) {
    const before = await this.prisma.pricingConfiguration.findUnique({ where: { tenantId } });
    const updated = await this.prisma.pricingConfiguration.upsert({
      where: { tenantId },
      update: { markupPercentage, effectiveFrom: new Date() },
      create: { tenantId, markupPercentage },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "UPDATE",
        entity: "MARKUP",
        entityId: updated.id,
        before: { markupPercentage: before ? Number(before.markupPercentage) : null },
        after: { markupPercentage },
      },
    });
    return updated;
  }

  createDiscount(tenantId: string, data: { name: string; percentage: number; active?: boolean }) {
    return this.prisma.discountConfiguration
      .create({
        data: {
          tenantId,
          name: data.name.trim(),
          percentage: D(data.percentage).toFixed(2),
          active: data.active ?? true,
        },
      })
      .catch((err) => {
        throw this.discountWriteError(err);
      });
  }

  async updateDiscount(
    tenantId: string,
    id: string,
    data: { active?: boolean; name?: string; percentage?: number },
  ) {
    const existing = await this.prisma.discountConfiguration.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Discount not found");
    try {
      return await this.prisma.discountConfiguration.update({
        where: { id },
        data: {
          name: data.name?.trim(),
          percentage: data.percentage !== undefined ? D(data.percentage).toFixed(2) : undefined,
          active: data.active,
        },
      });
    } catch (err) {
      throw this.discountWriteError(err);
    }
  }

  private discountWriteError(err: unknown): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new BadRequestException("A discount with this percentage already exists");
    }
    return err instanceof Error ? err : new BadRequestException("Could not save discount");
  }

  createPaymentMethod(tenantId: string, data: { name: string; code: string; active?: boolean }) {
    return this.prisma.paymentMethod.create({
      data: { tenantId, name: data.name, code: data.code.toUpperCase(), active: data.active ?? true },
    });
  }

  updatePaymentMethod(tenantId: string, id: string, data: { active?: boolean; name?: string }) {
    return this.prisma.paymentMethod.update({ where: { id }, data });
  }
}
