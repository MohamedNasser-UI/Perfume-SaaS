import type { PrismaClient, Unit } from "@prisma/client";
import { DEMO_MARKER } from "./constants";

export type StockState = {
  qty: number;
  avgCost: number;
};

export class StockLedger {
  private map = new Map<string, StockState>();

  get(itemId: string): StockState {
    return this.map.get(itemId) ?? { qty: 0, avgCost: 0 };
  }

  set(itemId: string, qty: number, avgCost: number) {
    this.map.set(itemId, { qty, avgCost });
  }

  /** Inbound: weighted average cost */
  inbound(itemId: string, qty: number, unitCost: number): StockState {
    const cur = this.get(itemId);
    const newQty = cur.qty + qty;
    const newAvg = newQty <= 0 ? 0 : (cur.qty * cur.avgCost + qty * unitCost) / newQty;
    const next = { qty: newQty, avgCost: newAvg };
    this.map.set(itemId, next);
    return next;
  }

  /** Outbound: use current avg cost; throws if insufficient */
  outbound(itemId: string, qty: number): StockState {
    const cur = this.get(itemId);
    if (cur.qty + 1e-9 < qty) {
      throw new Error(`Insufficient stock for ${itemId}: need ${qty}, have ${cur.qty}`);
    }
    const next = { qty: cur.qty - qty, avgCost: cur.qty - qty <= 0 ? 0 : cur.avgCost };
    this.map.set(itemId, next);
    return next;
  }

  entries() {
    return [...this.map.entries()];
  }
}

export async function writeBalanceAndMovement(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    outletId: string;
    itemId: string;
    movementType:
      | "OPENING_BALANCE"
      | "PURCHASE_RECEIPT"
      | "READY_MADE_SALE"
      | "CUSTOMIZED_SALE_CONSUMPTION"
      | "RETURN";
    quantity: number;
    unit: Unit;
    unitCost: number;
    balanceAfter: number;
    createdById: string;
    referenceType: string;
    referenceId: string;
    createdAt: Date;
    reason?: string;
  },
) {
  const avgCost = opts.unitCost;
  await prisma.inventoryBalance.upsert({
    where: { outletId_itemId: { outletId: opts.outletId, itemId: opts.itemId } },
    update: {
      quantityOnHand: opts.balanceAfter,
      averageCost: avgCost,
      inventoryValue: opts.balanceAfter * avgCost,
    },
    create: {
      tenantId: opts.tenantId,
      outletId: opts.outletId,
      itemId: opts.itemId,
      quantityOnHand: opts.balanceAfter,
      averageCost: avgCost,
      inventoryValue: opts.balanceAfter * avgCost,
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      tenantId: opts.tenantId,
      outletId: opts.outletId,
      itemId: opts.itemId,
      movementType: opts.movementType,
      quantity: opts.quantity,
      unit: opts.unit,
      unitCost: opts.unitCost,
      totalCost: Math.abs(opts.quantity) * opts.unitCost,
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
      balanceAfter: opts.balanceAfter,
      reason: opts.reason ?? DEMO_MARKER,
      createdById: opts.createdById,
      createdAt: opts.createdAt,
    },
  });
}

export async function syncBalance(
  prisma: PrismaClient,
  tenantId: string,
  outletId: string,
  itemId: string,
  state: StockState,
) {
  await prisma.inventoryBalance.upsert({
    where: { outletId_itemId: { outletId, itemId } },
    update: {
      quantityOnHand: state.qty,
      averageCost: state.avgCost,
      inventoryValue: state.qty * state.avgCost,
    },
    create: {
      tenantId,
      outletId,
      itemId,
      quantityOnHand: state.qty,
      averageCost: state.avgCost,
      inventoryValue: state.qty * state.avgCost,
    },
  });
}
