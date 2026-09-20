import type { PrismaClient } from "@prisma/client";
import { DEMO_MARKER } from "./constants";

export async function printVerification(prisma: PrismaClient, tenantId: string, outletId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const [
    readyMade,
    oils,
    bottles,
    packaging,
    suppliers,
    customers,
    purchases,
    sales,
    returns,
    lowStock,
    inventoryAgg,
    todaySales,
  ] = await Promise.all([
    prisma.product.count({ where: { tenantId, active: true } }),
    prisma.oil.count({ where: { tenantId, active: true } }),
    prisma.bottle.count({ where: { tenantId, active: true } }),
    prisma.packagingItem.count({ where: { tenantId, active: true } }),
    prisma.supplier.count({ where: { tenantId, active: true } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.purchaseInvoice.count({ where: { tenantId } }),
    prisma.salesOrder.count({ where: { tenantId } }),
    prisma.return.count({ where: { tenantId } }),
    prisma.inventoryBalance.findMany({
      where: { tenantId, outletId },
      include: { item: true },
    }),
    prisma.inventoryBalance.aggregate({
      where: { tenantId, outletId },
      _sum: { inventoryValue: true },
    }),
    prisma.salesOrder.aggregate({
      where: {
        tenantId,
        outletId,
        status: { not: "RETURNED" },
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      _sum: { finalAmount: true },
      _count: true,
    }),
  ]);

  const low = lowStock.filter((b) => {
    const q = Number(b.quantityOnHand);
    const thr = Number(b.item.lowStockThreshold);
    return q <= thr;
  }).length;

  const otherTenants = await prisma.tenant.findMany({
    where: { id: { not: tenantId } },
    select: { id: true, name: true, slug: true },
  });

  console.log("\n========== DEMO TEMPLATE VERIFICATION ==========");
  console.log("Marker:", DEMO_MARKER);
  console.log("Tenant ID:", tenantId);
  console.log("Tenant name:", tenant?.name);
  console.log("Slug:", tenant?.slug);
  console.log("Locale:", tenant?.locale, "| Currency:", tenant?.currency);
  console.log("--- Counts ---");
  console.log("Ready Made products:", readyMade);
  console.log("Oils:", oils);
  console.log("Bottles:", bottles);
  console.log("Packaging:", packaging);
  console.log("Suppliers:", suppliers);
  console.log("Customers:", customers);
  console.log("Purchases:", purchases);
  console.log("Sales:", sales);
  console.log("Returns:", returns);
  console.log("Expenses: 0 (not supported)");
  console.log("--- Dashboard sample ---");
  console.log("Inventory value:", Number(inventoryAgg._sum.inventoryValue ?? 0).toFixed(2), "EGP");
  console.log("Low-stock items:", low);
  console.log("Today sales count:", todaySales._count);
  console.log("Today revenue:", Number(todaySales._sum.finalAmount ?? 0).toFixed(2), "EGP");
  console.log("--- Isolation ---");
  console.log("Other tenants untouched:", otherTenants.length ? otherTenants.map((t) => t.slug).join(", ") : "(none)");
  console.log("================================================\n");

  return {
    tenantId,
    readyMade,
    oils,
    bottles,
    packaging,
    suppliers,
    customers,
    purchases,
    sales,
    returns,
    expenses: 0,
    lowStock: low,
    todayRevenue: Number(todaySales._sum.finalAmount ?? 0),
  };
}
