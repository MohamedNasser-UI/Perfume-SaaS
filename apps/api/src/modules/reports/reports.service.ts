import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { D, money } from "../../common/money";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string, outletId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayFilter = { tenantId, outletId, createdAt: { gte: start }, status: { not: "RETURNED" as const } };

    const [todayAgg, todayCount, inventory, lowStock, wasteToday, suppliers, newCustomers, returning] =
      await Promise.all([
        this.prisma.salesOrder.aggregate({
          where: todayFilter,
          _sum: { finalAmount: true, discountAmount: true, grossProfit: true, materialCost: true },
        }),
        this.prisma.salesOrder.count({ where: todayFilter }),
        this.prisma.inventoryBalance.aggregate({
          where: { tenantId, outletId },
          _sum: { inventoryValue: true },
        }),
        this.prisma.inventoryItem.findMany({
          where: { tenantId, active: true },
          include: { balances: { where: { outletId }, take: 1 } },
        }),
        this.prisma.wasteTransaction.aggregate({
          where: { tenantId, outletId, createdAt: { gte: start } },
          _sum: { totalCost: true },
        }),
        this.prisma.supplier.findMany({ where: { tenantId, active: true } }),
        this.prisma.customer.count({ where: { tenantId, createdAt: { gte: start } } }),
        this.prisma.salesOrder.groupBy({
          by: ["customerId"],
          where: todayFilter,
        }),
      ]);

    const low = lowStock
      .filter((item) => {
        const onHand = D(item.balances[0]?.quantityOnHand ?? 0);
        const threshold = D(item.lowStockThreshold);
        const outOfStock = onHand.lte(0);
        const belowThreshold = threshold.gt(0) && onHand.lte(threshold);
        return outOfStock || belowThreshold;
      })
      .sort((a, b) => {
        const aQty = Number(a.balances[0]?.quantityOnHand ?? 0);
        const bQty = Number(b.balances[0]?.quantityOnHand ?? 0);
        return aQty - bQty || a.name.localeCompare(b.name);
      })
      .slice(0, 40);
    const supplierBalances = await Promise.all(
      suppliers.map(async (s) => {
        const last = await this.prisma.supplierLedger.findFirst({
          where: { supplierId: s.id },
          orderBy: { createdAt: "desc" },
        });
        return { ...s, balance: money(last?.balance ?? 0), creditLimit: s.creditLimit ? money(s.creditLimit) : null };
      }),
    );
    const outstanding = supplierBalances.reduce((s, x) => s + x.balance, 0);
    const nearLimit = supplierBalances.filter(
      (s) => s.creditLimit && s.creditLimit > 0 && s.balance / s.creditLimit >= 0.8,
    );

    const revenue = money(todayAgg._sum.finalAmount ?? 0);
    const profit = money(todayAgg._sum.grossProfit ?? 0);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const agg = await this.prisma.salesOrder.aggregate({
        where: { tenantId, outletId, createdAt: { gte: day, lt: next }, status: { not: "RETURNED" } },
        _sum: { finalAmount: true },
        _count: true,
      });
      last7.push({
        date: day.toISOString().slice(0, 10),
        revenue: money(agg._sum.finalAmount ?? 0),
        orders: agg._count,
      });
    }

    const byType = await this.prisma.salesOrderLine.groupBy({
      by: ["lineType"],
      where: { order: { tenantId, outletId, createdAt: { gte: start } } },
      _sum: { lineTotal: true },
    });

    const oilConsumption = await this.prisma.inventoryMovement.aggregate({
      where: {
        tenantId,
        outletId,
        createdAt: { gte: start },
        movementType: "CUSTOMIZED_SALE_CONSUMPTION",
        item: { itemType: "OIL" },
      },
      _sum: { quantity: true },
    });

    return {
      sales: {
        revenue,
        orders: todayCount,
        averageOrderValue: todayCount ? money(revenue / todayCount) : 0,
        discounts: money(todayAgg._sum.discountAmount ?? 0),
        grossProfit: profit,
        grossMargin: revenue ? money((profit / revenue) * 100) : 0,
      },
      inventory: {
        totalValue: money(inventory._sum.inventoryValue ?? 0),
        lowStock: low.map((item) => ({
          id: item.id,
          name: item.name,
          onHand: Number(item.balances[0]?.quantityOnHand ?? 0),
          threshold: Number(item.lowStockThreshold),
          unit: item.stockUnit,
        })),
        oilConsumptionMl: Math.abs(Number(oilConsumption._sum.quantity ?? 0)),
        wasteValue: money(wasteToday._sum.totalCost ?? 0),
      },
      suppliers: {
        outstanding,
        approachingLimit: nearLimit,
      },
      customers: {
        newToday: newCustomers,
        returningToday: returning.length,
      },
      charts: {
        last7,
        byType: byType.map((t) => ({ type: t.lineType, total: money(t._sum.lineTotal ?? 0) })),
      },
    };
  }

  async sales(tenantId: string, outletId: string, from?: string, to?: string) {
    const where = {
      tenantId,
      outletId,
      ...(from || to
        ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
        : {}),
    };
    const orders = await this.prisma.salesOrder.findMany({
      where,
      include: { customer: true, paymentMethod: true, lines: true, createdBy: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const agg = await this.prisma.salesOrder.aggregate({
      where,
      _sum: { finalAmount: true, discountAmount: true, grossProfit: true, materialCost: true },
      _count: true,
      _avg: { finalAmount: true },
    });
    return {
      summary: {
        orders: agg._count,
        revenue: money(agg._sum.finalAmount ?? 0),
        discounts: money(agg._sum.discountAmount ?? 0),
        materialCost: money(agg._sum.materialCost ?? 0),
        grossProfit: money(agg._sum.grossProfit ?? 0),
        averageOrderValue: money(agg._avg.finalAmount ?? 0),
      },
      orders,
    };
  }

  async inventory(tenantId: string, outletId: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { tenantId, outletId },
      include: { item: true },
    });
    const waste = await this.prisma.wasteTransaction.findMany({
      where: { tenantId, outletId },
      include: { item: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      valuation: money(balances.reduce((s, b) => s + Number(b.inventoryValue), 0)),
      balances: balances.map((b) => ({
        name: b.item.name,
        type: b.item.itemType,
        onHand: Number(b.quantityOnHand),
        unit: b.item.stockUnit,
        averageCost: Number(b.averageCost),
        value: money(b.inventoryValue),
      })),
      waste,
    };
  }

  async procurement(tenantId: string, outletId: string) {
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: { tenantId, outletId, status: "POSTED" },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    const payments = await this.prisma.supplierPayment.findMany({
      where: { tenantId, outletId },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      purchaseTotal: money(purchases.reduce((s, p) => s + Number(p.totalAmount), 0)),
      paymentTotal: money(payments.reduce((s, p) => s + Number(p.amount), 0)),
      purchases,
      payments,
    };
  }

  async customers(tenantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      include: { _count: { select: { salesOrders: true } } },
    });
    const oils = await this.prisma.customizedConfiguration.groupBy({
      by: ["oilId"],
      where: { line: { order: { tenantId } } },
      _count: true,
    });
    const oilNames = await this.prisma.oil.findMany({ where: { tenantId } });
    return {
      total: customers.length,
      oils: oils
        .map((o) => ({
          name: oilNames.find((x) => x.id === o.oilId)?.name ?? o.oilId,
          count: o._count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async profitability(tenantId: string, outletId: string) {
    const byType = await this.prisma.salesOrderLine.groupBy({
      by: ["lineType"],
      where: { order: { tenantId, outletId } },
      _sum: { lineTotal: true, costAtSale: true },
    });
    return {
      byType: byType.map((t) => {
        const revenue = money(t._sum.lineTotal ?? 0);
        const cost = money(t._sum.costAtSale ?? 0);
        return {
          type: t.lineType,
          revenue,
          cost,
          profit: money(revenue - cost),
          margin: revenue ? money(((revenue - cost) / revenue) * 100) : 0,
        };
      }),
    };
  }

  audit(tenantId: string) {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
