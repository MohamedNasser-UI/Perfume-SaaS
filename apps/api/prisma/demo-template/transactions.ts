import type { PrismaClient, LineType } from "@prisma/client";
import { nextNumber } from "../../src/common/sequences";
import { DEMO_MARKER } from "./constants";
import type { CatalogIds } from "./catalog";
import type { PartiesIds } from "./parties";
import { StockLedger, writeBalanceAndMovement, syncBalance } from "./stock";

function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, 15, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

export type HistoryResult = {
  purchases: number;
  sales: number;
  returns: number;
  skipped: boolean;
};

export async function seedOpeningBalances(
  prisma: PrismaClient,
  tenantId: string,
  outletId: string,
  ownerId: string,
  catalog: CatalogIds,
  ledger: StockLedger,
) {
  const openingDate = daysAgo(60, 8);
  // Deduplicate openings by itemId (legacy + new codes may share intent; last wins for initial set)
  const byItem = new Map<string, (typeof catalog.openings)[0]>();
  for (const row of catalog.openings) {
    if (!byItem.has(row.itemId)) byItem.set(row.itemId, row);
  }

  for (const row of byItem.values()) {
    const existing = await prisma.inventoryBalance.findUnique({
      where: { outletId_itemId: { outletId, itemId: row.itemId } },
    });
    if (existing) {
      ledger.set(row.itemId, Number(existing.quantityOnHand), Number(existing.averageCost));
      continue;
    }

    ledger.set(row.itemId, row.qty, row.cost);
    await writeBalanceAndMovement(prisma, {
      tenantId,
      outletId,
      itemId: row.itemId,
      movementType: "OPENING_BALANCE",
      quantity: row.qty,
      unit: row.unit,
      unitCost: row.cost,
      balanceAfter: row.qty,
      createdById: ownerId,
      referenceType: "OPENING",
      referenceId: DEMO_MARKER,
      createdAt: openingDate,
      reason: `${DEMO_MARKER} opening`,
    });
    await syncBalance(prisma, tenantId, outletId, row.itemId, ledger.get(row.itemId));
  }
}

export async function seedHistory(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    outletId: string;
    ownerId: string;
    catalog: CatalogIds;
    parties: PartiesIds;
    ledger: StockLedger;
    forceReseed?: boolean;
  },
): Promise<HistoryResult> {
  const { tenantId, outletId, ownerId, catalog, parties, ledger, forceReseed } = opts;

  if (forceReseed) {
    console.error(
      "FORCE_DEMO_RESEED=1 is set. Refusing destructive reseed without interactive confirmation.\n" +
        "Unset FORCE_DEMO_RESEED to seed history on an empty demo tenant, or ask for assisted cleanup of demo-only transactions.",
    );
    throw new Error("FORCE_DEMO_RESEED refused without confirmation");
  }

  const demoPurchases = await prisma.purchaseInvoice.count({
    where: { tenantId, notes: DEMO_MARKER },
  });
  if (demoPurchases > 0) {
    console.log(`Demo history already present (${demoPurchases} marked purchases) — skipping transactional seed.`);
    return { purchases: 0, sales: 0, returns: 0, skipped: true };
  }

  // Load current on-hand into ledger for any items not yet tracked (e.g. prior tenant activity)
  const balances = await prisma.inventoryBalance.findMany({ where: { tenantId, outletId } });
  for (const b of balances) {
    if (!ledger.get(b.itemId).qty && Number(b.quantityOnHand) > 0) {
      ledger.set(b.itemId, Number(b.quantityOnHand), Number(b.averageCost));
    } else if (Number(b.quantityOnHand) > 0) {
      // Prefer live DB qty if ledger was only set from opening defaults that were skipped
      const cur = ledger.get(b.itemId);
      if (cur.qty === 0) {
        ledger.set(b.itemId, Number(b.quantityOnHand), Number(b.averageCost));
      }
    }
  }

  const paymentMethods = await prisma.paymentMethod.findMany({ where: { tenantId, active: true } });
  if (!paymentMethods.length) throw new Error("No payment methods for demo tenant");

  const concentrations = await prisma.concentration.findMany({ where: { tenantId, active: true } });
  if (!concentrations.length) throw new Error("No concentrations for demo tenant");

  // Prefer primary (non-legacy) catalog for transactions
  const readyMade = catalog.products.filter((p) => p.sku.startsWith("RDY-"));
  const oils = catalog.oils.filter((o) => o.code.startsWith("OL-"));
  const bottles = catalog.bottles.filter((b) => b.code.startsWith("BT-"));
  const packaging = catalog.packaging.filter((p) => p.code.startsWith("PK-") && !p.code.startsWith("PKG-"));

  let purchaseCount = 0;
  let saleCount = 0;
  let returnCount = 0;

  // --- Purchases over ~60 days ---
  const purchasePlan: { day: number; supplierIdx: number; kind: "ready" | "oil" | "bottle" | "pack" }[] = [
    { day: 55, supplierIdx: 2, kind: "ready" },
    { day: 52, supplierIdx: 0, kind: "oil" },
    { day: 48, supplierIdx: 1, kind: "bottle" },
    { day: 45, supplierIdx: 1, kind: "pack" },
    { day: 40, supplierIdx: 2, kind: "ready" },
    { day: 35, supplierIdx: 0, kind: "oil" },
    { day: 30, supplierIdx: 4, kind: "bottle" },
    { day: 25, supplierIdx: 3, kind: "oil" },
    { day: 20, supplierIdx: 2, kind: "ready" },
    { day: 15, supplierIdx: 5, kind: "oil" },
    { day: 12, supplierIdx: 1, kind: "pack" },
    { day: 8, supplierIdx: 6, kind: "ready" },
    { day: 5, supplierIdx: 0, kind: "oil" },
    { day: 3, supplierIdx: 4, kind: "bottle" },
    { day: 1, supplierIdx: 2, kind: "ready" },
  ];

  for (let pi = 0; pi < purchasePlan.length; pi++) {
    const plan = purchasePlan[pi]!;
    const supplier = pick(parties.suppliers, plan.supplierIdx);
    const when = daysAgo(plan.day, 9);
    const number = await nextNumber(prisma, outletId, "PURCHASE");

    type LineSpec = { itemId: string; qty: number; unit: "PCS" | "ML" | "L"; unitCost: number; stockQty: number; stockUnitCost: number };
    const lines: LineSpec[] = [];

    if (plan.kind === "ready") {
      for (let j = 0; j < 4; j++) {
        const p = pick(readyMade, pi * 4 + j);
        const qty = 4 + ((pi + j) % 5);
        lines.push({
          itemId: p.inventoryItemId,
          qty,
          unit: "PCS",
          unitCost: p.costHint,
          stockQty: qty,
          stockUnitCost: p.costHint,
        });
      }
    } else if (plan.kind === "oil") {
      for (let j = 0; j < 5; j++) {
        const o = pick(oils, pi * 5 + j);
        const liters = 1 + ((pi + j) % 3);
        lines.push({
          itemId: o.inventoryItemId,
          qty: liters,
          unit: "L",
          unitCost: o.costPerMl * 1000,
          stockQty: liters * 1000,
          stockUnitCost: o.costPerMl,
        });
      }
    } else if (plan.kind === "bottle") {
      for (let j = 0; j < 3; j++) {
        const b = pick(bottles, pi * 3 + j);
        const qty = 20 + ((pi + j) % 10) * 2;
        lines.push({
          itemId: b.inventoryItemId,
          qty,
          unit: "PCS",
          unitCost: b.cost,
          stockQty: qty,
          stockUnitCost: b.cost,
        });
      }
    } else {
      for (let j = 0; j < 2; j++) {
        const pk = pick(packaging, pi * 2 + j);
        const qty = 30 + ((pi + j) % 8) * 5;
        lines.push({
          itemId: pk.inventoryItemId,
          qty,
          unit: "PCS",
          unitCost: pk.cost,
          stockQty: qty,
          stockUnitCost: pk.cost,
        });
      }
    }

    const totalAmount = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
    const invoice = await prisma.purchaseInvoice.create({
      data: {
        tenantId,
        outletId,
        supplierId: supplier.id,
        number,
        invoiceNumber: `DEMO-INV-${String(pi + 1).padStart(3, "0")}`,
        invoiceDate: when,
        postingDate: when,
        totalAmount,
        status: "POSTED",
        notes: DEMO_MARKER,
        createdById: ownerId,
        createdAt: when,
        updatedAt: when,
        lines: {
          create: lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.qty,
            unit: l.unit,
            unitCost: l.unitCost,
            lineTotal: l.qty * l.unitCost,
            stockQuantity: l.stockQty,
            stockUnitCost: l.stockUnitCost,
          })),
        },
      },
    });

    for (const l of lines) {
      const state = ledger.inbound(l.itemId, l.stockQty, l.stockUnitCost);
      await writeBalanceAndMovement(prisma, {
        tenantId,
        outletId,
        itemId: l.itemId,
        movementType: "PURCHASE_RECEIPT",
        quantity: l.stockQty,
        unit: l.unit === "L" ? "ML" : l.unit,
        unitCost: l.stockUnitCost,
        balanceAfter: state.qty,
        createdById: ownerId,
        referenceType: "PURCHASE",
        referenceId: invoice.id,
        createdAt: when,
      });
      await syncBalance(prisma, tenantId, outletId, l.itemId, state);
    }

    const lastLedger = await prisma.supplierLedger.findFirst({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
    });
    const prevBal = lastLedger ? Number(lastLedger.balance) : 0;
    await prisma.supplierLedger.create({
      data: {
        tenantId,
        supplierId: supplier.id,
        transactionType: "PURCHASE_INVOICE",
        referenceId: invoice.id,
        purchaseId: invoice.id,
        debit: totalAmount,
        credit: 0,
        balance: prevBal + totalAmount,
        transactionDate: when,
        createdById: ownerId,
        createdAt: when,
      },
    });

    purchaseCount++;
  }

  // --- Sales over ~60 days (heavy on last 7 + today) ---
  const saleDays: number[] = [];
  for (let d = 58; d >= 8; d -= 2) saleDays.push(d);
  for (let d = 7; d >= 1; d--) {
    saleDays.push(d, d); // two per recent day
  }
  saleDays.push(0, 0, 0, 0); // today — several for dashboard

  const readyMadeSaleOrders: { orderId: string; lineId: string; productInventoryId: string; qty: number; unitPrice: number; cost: number; day: number }[] = [];

  for (let si = 0; si < saleDays.length; si++) {
    const day = saleDays[si]!;
    const when = daysAgo(day, 11 + (si % 6));
    const customer = pick(parties.customers, si);
    const pm = pick(paymentMethods, si);
    const number = await nextNumber(prisma, outletId, "SALE");

    const isCustom = si % 5 === 0;
    if (isCustom && oils.length && bottles.length) {
      // Customized sale
      const oil = pick(oils, si);
      const bottle = pick(bottles, si);
      const pack = packaging.length ? pick(packaging, si) : null;
      const conc = pick(concentrations, si);
      const oilPct = Number(conc.oilPercentage);
      const oilMl = (bottle.sizeMl * oilPct) / 100;
      const alcoholMl = bottle.sizeMl - oilMl;

      const oilState = ledger.get(oil.inventoryItemId);
      const alcState = ledger.get(catalog.alcohol.inventoryItemId);
      const bottleState = ledger.get(bottle.inventoryItemId);
      const pumpState = ledger.get(catalog.pump.inventoryItemId);
      const packState = pack ? ledger.get(pack.inventoryItemId) : null;

      // Skip if not enough stock
      if (
        oilState.qty < oilMl ||
        alcState.qty < alcoholMl ||
        bottleState.qty < 1 ||
        pumpState.qty < 1 ||
        (pack && packState && packState.qty < 1)
      ) {
        // Fall through to ready-made instead
      } else {
        const materialCost =
          oilMl * oilState.avgCost +
          alcoholMl * alcState.avgCost +
          1 * bottleState.avgCost +
          1 * pumpState.avgCost +
          (pack && packState ? packState.avgCost : 0);
        const unitPrice = Math.round(materialCost * 1.5 * 100) / 100;

        const order = await prisma.salesOrder.create({
          data: {
            tenantId,
            outletId,
            customerId: customer.id,
            orderNumber: number,
            subtotal: unitPrice,
            discountPercentage: 0,
            discountAmount: 0,
            finalAmount: unitPrice,
            amountReceived: unitPrice,
            changeAmount: 0,
            materialCost,
            grossProfit: unitPrice - materialCost,
            paymentMethodId: pm.id,
            salesChannel: si % 4 === 0 ? "ONLINE" : "IN_SHOP",
            status: "COMPLETED",
            createdById: ownerId,
            createdAt: when,
            lines: {
              create: {
                lineType: "CUSTOMIZED",
                quantity: 1,
                unitPrice,
                lineTotal: unitPrice,
                discountAmount: 0,
                netLineTotal: unitPrice,
                costAtSale: materialCost,
              },
            },
          },
          include: { lines: true },
        });

        const line = order.lines[0]!;
        const config = await prisma.customizedConfiguration.create({
          data: {
            salesOrderLineId: line.id,
            oilId: oil.id,
            concentrationId: conc.id,
            bottleId: bottle.id,
            bottleSizeMl: bottle.sizeMl,
            oilStandardQtyMl: oilMl,
            oilActualQtyMl: oilMl,
            alcoholQtyMl: alcoholMl,
            stabilizerQtyMl: 0,
            pumpId: catalog.pump.id,
            packagingId: pack?.id,
            customerSuppliedBottle: false,
            materialCost,
            calculatedPrice: unitPrice,
            finalPrice: unitPrice,
            pricingTier: "STANDARD",
            oilComponents: {
              create: [{ oilId: oil.id, qtyMl: oilMl, sortOrder: 0 }],
            },
          },
        });
        void config;

        const consumptions: { itemId: string; qty: number; unit: "ML" | "PCS" }[] = [
          { itemId: oil.inventoryItemId, qty: oilMl, unit: "ML" },
          { itemId: catalog.alcohol.inventoryItemId, qty: alcoholMl, unit: "ML" },
          { itemId: bottle.inventoryItemId, qty: 1, unit: "PCS" },
          { itemId: catalog.pump.inventoryItemId, qty: 1, unit: "PCS" },
        ];
        if (pack) consumptions.push({ itemId: pack.inventoryItemId, qty: 1, unit: "PCS" });

        for (const c of consumptions) {
          const before = ledger.get(c.itemId);
          const state = ledger.outbound(c.itemId, c.qty);
          await writeBalanceAndMovement(prisma, {
            tenantId,
            outletId,
            itemId: c.itemId,
            movementType: "CUSTOMIZED_SALE_CONSUMPTION",
            quantity: -c.qty,
            unit: c.unit,
            unitCost: before.avgCost,
            balanceAfter: state.qty,
            createdById: ownerId,
            referenceType: "SALE",
            referenceId: order.id,
            createdAt: when,
          });
          await syncBalance(prisma, tenantId, outletId, c.itemId, state);
        }

        saleCount++;
        continue;
      }
    }

    // Ready-made sale (default)
    const product = pick(readyMade, si);
    const qty = 1 + (si % 3 === 0 ? 1 : 0);
    const stock = ledger.get(product.inventoryItemId);
    if (stock.qty < qty) continue;

    const unitPrice = product.sellingPrice;
    const lineTotal = unitPrice * qty;
    const costAtSale = stock.avgCost * qty;
    const lineType: LineType = product.classification === "HIGH_COPY" ? "HIGH_COPY" : "ORIGINAL";

    const order = await prisma.salesOrder.create({
      data: {
        tenantId,
        outletId,
        customerId: customer.id,
        orderNumber: number,
        subtotal: lineTotal,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: lineTotal,
        amountReceived: lineTotal,
        changeAmount: 0,
        materialCost: costAtSale,
        grossProfit: lineTotal - costAtSale,
        paymentMethodId: pm.id,
        salesChannel: si % 5 === 1 ? "ONLINE" : "IN_SHOP",
        status: "COMPLETED",
        createdById: ownerId,
        createdAt: when,
        lines: {
          create: {
            lineType,
            productId: product.id,
            quantity: qty,
            unitPrice,
            lineTotal,
            discountAmount: 0,
            netLineTotal: lineTotal,
            costAtSale,
          },
        },
      },
      include: { lines: true },
    });

    const state = ledger.outbound(product.inventoryItemId, qty);
    await writeBalanceAndMovement(prisma, {
      tenantId,
      outletId,
      itemId: product.inventoryItemId,
      movementType: "READY_MADE_SALE",
      quantity: -qty,
      unit: "PCS",
      unitCost: stock.avgCost,
      balanceAfter: state.qty,
      createdById: ownerId,
      referenceType: "SALE",
      referenceId: order.id,
      createdAt: when,
    });
    await syncBalance(prisma, tenantId, outletId, product.inventoryItemId, state);

    readyMadeSaleOrders.push({
      orderId: order.id,
      lineId: order.lines[0]!.id,
      productInventoryId: product.inventoryItemId,
      qty,
      unitPrice,
      cost: stock.avgCost,
      day,
    });
    saleCount++;
  }

  // --- Returns (small number) ---
  const returnCandidates = readyMadeSaleOrders.filter((o) => o.day >= 10 && o.day <= 40).slice(0, 5);
  for (let ri = 0; ri < returnCandidates.length; ri++) {
    const cand = returnCandidates[ri]!;
    const when = daysAgo(Math.max(0, cand.day - 3), 14);
    const number = await nextNumber(prisma, outletId, "RETURN");
    const disposition = ri % 2 === 0 ? "RETURN_TO_FINISHED_STOCK" : "DAMAGED";
    const returnQty = 1;
    const refund = cand.unitPrice * returnQty;

    const ret = await prisma.return.create({
      data: {
        tenantId,
        outletId,
        originalOrderId: cand.orderId,
        number,
        returnDate: when,
        reason: ri % 2 === 0 ? "العميل غير راضٍ عن الرائحة" : "عبوة تالفة عند الاستلام",
        refundAmount: refund,
        createdById: ownerId,
        status: "COMPLETED",
        lines: {
          create: {
            originalOrderLineId: cand.lineId,
            quantity: returnQty,
            disposition,
            refundAmount: refund,
          },
        },
      },
    });

    await prisma.salesOrderLine.update({
      where: { id: cand.lineId },
      data: { returnedQty: { increment: returnQty } },
    });

    const line = await prisma.salesOrderLine.findUnique({ where: { id: cand.lineId } });
    const allReturned = line && line.returnedQty >= line.quantity;
    await prisma.salesOrder.update({
      where: { id: cand.orderId },
      data: { status: allReturned ? "RETURNED" : "PARTIALLY_RETURNED" },
    });

    if (disposition === "RETURN_TO_FINISHED_STOCK") {
      const state = ledger.inbound(cand.productInventoryId, returnQty, cand.cost);
      await writeBalanceAndMovement(prisma, {
        tenantId,
        outletId,
        itemId: cand.productInventoryId,
        movementType: "RETURN",
        quantity: returnQty,
        unit: "PCS",
        unitCost: cand.cost,
        balanceAfter: state.qty,
        createdById: ownerId,
        referenceType: "RETURN",
        referenceId: ret.id,
        createdAt: when,
      });
      await syncBalance(prisma, tenantId, outletId, cand.productInventoryId, state);
    }

    returnCount++;
  }

  return { purchases: purchaseCount, sales: saleCount, returns: returnCount, skipped: false };
}
