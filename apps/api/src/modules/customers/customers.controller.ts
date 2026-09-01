import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { customerSchema } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantId } from "../../common/context";
import { SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";
import { normalizeMobile } from "../../common/mobile";
import { money } from "../../common/money";

@SkipOutlet()
@Controller("customers")
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@TenantId() tenantId: string, @Query("q") q?: string) {
    const customers = await this.prisma.customer.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { mobile: { contains: q.replace(/\D/g, "") } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { salesOrders: true } },
        salesOrders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, finalAmount: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    });
    const withSpend = await Promise.all(
      customers.map(async (c) => {
        const agg = await this.prisma.salesOrder.aggregate({
          where: { customerId: c.id },
          _sum: { finalAmount: true },
        });
        return {
          ...c,
          orders: c._count.salesOrders,
          totalSpend: money(agg._sum.finalAmount ?? 0),
          lastPurchase: c.salesOrders[0]?.createdAt ?? null,
        };
      }),
    );
    return withSpend;
  }

  @Get("search")
  async search(@TenantId() tenantId: string, @Query("mobile") mobile?: string) {
    if (!mobile) return null;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const normalized = normalizeMobile(mobile, tenant?.country ?? "EG");
    return this.prisma.customer.findUnique({
      where: { tenantId_mobile: { tenantId, mobile: normalized } },
      include: { preference: true },
    });
  }

  @Get("suggest")
  async suggest(@TenantId() tenantId: string, @Query("mobile") mobile?: string) {
    const digits = (mobile ?? "").replace(/\D/g, "");
    if (digits.length < 3) return [];
    const prefixes = new Set([digits]);
    if (!digits.startsWith("0")) prefixes.add(`0${digits}`);
    if (digits.startsWith("20") && digits.length >= 5) prefixes.add(`0${digits.slice(2)}`);
    return this.prisma.customer.findMany({
      where: {
        tenantId,
        OR: [...prefixes].map((prefix) => ({ mobile: { startsWith: prefix } })),
      },
      select: { id: true, name: true, mobile: true },
      orderBy: { mobile: "asc" },
      take: 8,
    });
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(customerSchema))
    body: { id?: string; name: string; mobile: string; gender?: "MALE" | "FEMALE" | "OTHER"; notes?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const mobile = normalizeMobile(body.mobile, tenant?.country ?? "EG");
    const exists = await this.prisma.customer.findUnique({
      where: { tenantId_mobile: { tenantId, mobile } },
    });
    if (exists) throw new BadRequestException("A customer with this mobile number already exists");
    return this.prisma.customer.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        tenantId,
        name: body.name,
        mobile,
        gender: body.gender,
        notes: body.notes,
      },
    });
  }

  @Get(":id")
  async get(@TenantId() tenantId: string, @Param("id") id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: { preference: { include: { favoriteOil: true, concentration: true, packaging: true } } },
    });
    if (!customer) throw new BadRequestException("Customer not found");
    const orders = await this.prisma.salesOrder.findMany({
      where: { customerId: id },
      include: {
        lines: {
          include: {
            product: true,
            configuration: {
              include: { oil: true, concentration: true, bottle: true, packaging: true, stabilizer: true },
            },
          },
        },
        paymentMethod: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const totalSpend = orders.reduce((s, o) => s + Number(o.finalAmount), 0);
    return { ...customer, orders, totalSpend: money(totalSpend), orderCount: orders.length };
  }
}
