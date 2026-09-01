import { BadRequestException, Injectable } from "@nestjs/common";
import { ItemType, MovementType, Prisma, Unit } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { D, Decimal, money, qty } from "../../common/money";
import { toStockQuantity, toStockUnitCost } from "../../common/units";
import { nextNumber } from "../../common/sequences";

export type MovementInput = {
  tenantId: string;
  outletId: string;
  itemId: string;
  quantity: Decimal.Value;
  unit: Unit;
  movementType: MovementType;
  referenceType: string;
  referenceId: string;
  inboundUnitCost?: Decimal.Value;
  reason?: string;
  createdById: string;
  allowNegative?: boolean;
};

export type Shortage = {
  itemId: string;
  itemName: string;
  required: number;
  available: number;
  shortage: number;
  unit: Unit;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateBalance(tx: Prisma.TransactionClient, tenantId: string, outletId: string, itemId: string) {
    const existing = await tx.inventoryBalance.findUnique({
      where: { outletId_itemId: { outletId, itemId } },
    });
    if (existing) return existing;
    return tx.inventoryBalance.create({
      data: { tenantId, outletId, itemId, quantityOnHand: 0, averageCost: 0, inventoryValue: 0 },
    });
  }

  async applyMovement(tx: Prisma.TransactionClient, input: MovementInput) {
    const item = await tx.inventoryItem.findFirst({
      where: { id: input.itemId, tenantId: input.tenantId },
    });
    if (!item) throw new BadRequestException("Inventory item not found");

    const stockQty = toStockQuantity(input.quantity, input.unit, item.stockUnit);
    const balance = await this.getOrCreateBalance(tx, input.tenantId, input.outletId, input.itemId);
    const oldQty = D(balance.quantityOnHand);
    const oldAvg = D(balance.averageCost);
    const oldValue = oldQty.mul(oldAvg);

    let newQty: Decimal;
    let newAvg: Decimal;
    let unitCost: Decimal;

    if (stockQty.gte(0)) {
      unitCost = input.inboundUnitCost
        ? toStockUnitCost(input.inboundUnitCost, input.unit, item.stockUnit)
        : oldAvg;
      newQty = oldQty.add(stockQty);
      const newValue = oldValue.add(stockQty.mul(unitCost));
      newAvg = newQty.eq(0) ? D(0) : newValue.div(newQty);
    } else {
      const absQty = stockQty.abs();
      if (oldQty.lt(absQty) && !input.allowNegative) {
        throw new BadRequestException({
          message: "Insufficient inventory",
          shortage: {
            itemId: item.id,
            itemName: item.name,
            required: qty(absQty),
            available: qty(oldQty),
            shortage: qty(absQty.sub(oldQty)),
            unit: item.stockUnit,
          },
        });
      }
      unitCost = oldAvg;
      newQty = oldQty.add(stockQty);
      newAvg = newQty.eq(0) ? D(0) : oldAvg;
    }

    const newValue = newQty.mul(newAvg);
    await tx.inventoryBalance.update({
      where: { id: balance.id },
      data: {
        quantityOnHand: newQty.toFixed(4),
        averageCost: newAvg.toFixed(6),
        inventoryValue: newValue.toFixed(4),
      },
    });

    return tx.inventoryMovement.create({
      data: {
        tenantId: input.tenantId,
        outletId: input.outletId,
        itemId: input.itemId,
        movementType: input.movementType,
        quantity: stockQty.toFixed(4),
        unit: item.stockUnit,
        unitCost: unitCost.toFixed(6),
        totalCost: stockQty.abs().mul(unitCost).toFixed(4),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        balanceAfter: newQty.toFixed(4),
        reason: input.reason,
        createdById: input.createdById,
      },
    });
  }

  async checkAvailability(
    tx: Prisma.TransactionClient,
    tenantId: string,
    outletId: string,
    requirements: { itemId: string; quantity: Decimal.Value; unit: Unit }[],
  ): Promise<Shortage[]> {
    const shortages: Shortage[] = [];
    for (const req of requirements) {
      const item = await tx.inventoryItem.findFirst({
        where: { id: req.itemId, tenantId },
      });
      if (!item) throw new BadRequestException("Inventory item not found");
      const needed = toStockQuantity(req.quantity, req.unit, item.stockUnit);
      const balance = await this.getOrCreateBalance(tx, tenantId, outletId, req.itemId);
      const available = D(balance.quantityOnHand);
      if (available.lt(needed)) {
        shortages.push({
          itemId: item.id,
          itemName: item.name,
          required: qty(needed),
          available: qty(available),
          shortage: qty(needed.sub(available)),
          unit: item.stockUnit,
        });
      }
    }
    return shortages;
  }

  async currentCost(tx: Prisma.TransactionClient, outletId: string, itemId: string): Promise<Decimal> {
    const balance = await tx.inventoryBalance.findUnique({
      where: { outletId_itemId: { outletId, itemId } },
    });
    return D(balance?.averageCost ?? 0);
  }

  async overview(tenantId: string, outletId: string, itemType?: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        ...(itemType ? { itemType: itemType as ItemType } : {}),
      },
      include: {
        balances: { where: { outletId }, take: 1 },
        bottle: true,
        packaging: true,
        product: true,
      },
      orderBy: [{ itemType: "asc" }, { name: "asc" }],
    });
    return items.map((item) => {
      const balance = item.balances[0];
      const onHand = qty(balance?.quantityOnHand ?? 0);
      return {
        itemId: item.id,
        code: item.code,
        name: item.name,
        itemType: item.itemType,
        onHand,
        unit: item.stockUnit,
        averageCost: Number(balance?.averageCost ?? 0),
        value: money(balance?.inventoryValue ?? 0),
        lowStockThreshold: qty(item.lowStockThreshold),
        isLowStock: D(onHand).lte(item.lowStockThreshold),
        active: item.active,
        design: item.bottle?.design ?? null,
        sizeMl: item.bottle?.sizeMl ?? item.product?.sizeMl ?? null,
        packagingType: item.packaging?.type ?? null,
        classification: item.product?.classification ?? null,
        brand: item.product?.brand ?? null,
      };
    });
  }

  async movements(tenantId: string, outletId: string, itemId?: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { tenantId, outletId, ...(itemId ? { itemId } : {}) },
      include: { item: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createWaste(
    tenantId: string,
    outletId: string,
    userId: string,
    body: {
      itemId: string;
      quantity: number;
      unit: Unit;
      reason: "SPILLAGE" | "DAMAGE" | "WRONG_MIX" | "OTHER";
      notes?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: body.itemId, tenantId },
      });
      if (!item) throw new BadRequestException("Item not found");
      const number = await nextNumber(tx, outletId, "WASTE");
      const avg = await this.currentCost(tx, outletId, body.itemId);
      const stockQty = toStockQuantity(body.quantity, body.unit, item.stockUnit);
      const totalCost = stockQty.mul(avg);
      const waste = await tx.wasteTransaction.create({
        data: {
          tenantId,
          outletId,
          itemId: body.itemId,
          number,
          quantity: D(body.quantity).toFixed(4),
          unit: body.unit,
          reason: body.reason,
          notes: body.notes,
          totalCost: totalCost.toFixed(4),
          createdById: userId,
        },
      });
      const movementType =
        body.reason === "SPILLAGE" ? "SPILLAGE" : body.reason === "DAMAGE" ? "DAMAGE" : "WASTE";
      await this.applyMovement(tx, {
        tenantId,
        outletId,
        itemId: body.itemId,
        quantity: D(body.quantity).neg(),
        unit: body.unit,
        movementType,
        referenceType: "WASTE",
        referenceId: waste.id,
        reason: body.reason,
        createdById: userId,
      });
      return { ...waste, totalCost: money(totalCost) };
    });
  }

  async createAdjustment(
    tenantId: string,
    outletId: string,
    userId: string,
    body: {
      itemId: string;
      quantity: number;
      unit: Unit;
      reason: string;
      notes?: string;
      isOpeningBalance?: boolean;
      isStockCount?: boolean;
      unitCost?: number;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, outletId, "ADJUSTMENT");
      const adj = await tx.stockAdjustment.create({
        data: {
          tenantId,
          outletId,
          itemId: body.itemId,
          number,
          quantity: D(body.quantity).toFixed(4),
          unit: body.unit,
          reason: body.reason,
          notes: body.notes,
          isOpeningBalance: body.isOpeningBalance ?? false,
          isStockCount: body.isStockCount ?? false,
          createdById: userId,
        },
      });
      const movementType = body.isOpeningBalance
        ? "OPENING_BALANCE"
        : body.isStockCount
          ? "STOCK_COUNT_ADJUSTMENT"
          : "STOCK_ADJUSTMENT";
      await this.applyMovement(tx, {
        tenantId,
        outletId,
        itemId: body.itemId,
        quantity: body.quantity,
        unit: body.unit,
        movementType,
        referenceType: "ADJUSTMENT",
        referenceId: adj.id,
        inboundUnitCost: body.quantity > 0 ? (body.unitCost ?? 0) : undefined,
        reason: body.reason,
        createdById: userId,
        allowNegative: true,
      });
      return adj;
    });
  }
}
