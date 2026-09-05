import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { CreateSaleInput, PricingPreviewInput } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { D, Decimal, money, qty } from "../../common/money";
import { nextNumber } from "../../common/sequences";

type BuiltCustom = {
  oilId: string;
  concentrationId: string;
  bottleId: string;
  bottleSizeMl: number;
  oilStandardQtyMl: Decimal;
  oilActualQtyMl: Decimal;
  alcoholQtyMl: Decimal;
  stabilizerId?: string;
  stabilizerQtyMl: Decimal;
  pumpId?: string | null;
  packagingId?: string;
  customerSuppliedBottle: boolean;
  materialCost: Decimal;
  calculatedPrice: Decimal;
  components: { itemId: string; quantity: Decimal; unit: "ML" | "PCS" }[];
  oilName: string;
  concentrationName: string;
  bottleDesign: string;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async preview(tenantId: string, outletId: string, input: PricingPreviewInput) {
    return this.prisma.$transaction(async (tx) => {
      const built = await this.buildCustomized(tx, tenantId, outletId, input);
      const shortages = await this.inventory.checkAvailability(
        tx,
        tenantId,
        outletId,
        built.components.map((c) => ({ itemId: c.itemId, quantity: c.quantity, unit: c.unit })),
      );
      return {
        ...this.serializeCustom(built),
        shortages,
      };
    });
  }

  async create(tenantId: string, outletId: string, userId: string, input: CreateSaleInput) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId } });
      if (!customer) throw new BadRequestException("Customer not found");

      const payment = await tx.paymentMethod.findFirst({
        where: { id: input.paymentMethodId, tenantId, active: true },
      });
      if (!payment) throw new BadRequestException("Invalid payment method");

      let discountPct = D(0);
      let discountId: string | undefined;
      if (input.discountId) {
        const disc = await tx.discountConfiguration.findFirst({
          where: { id: input.discountId, tenantId, active: true },
        });
        if (!disc) throw new BadRequestException("Invalid discount");
        discountPct = D(disc.percentage);
        discountId = disc.id;
      }

      const pricing = await tx.pricingConfiguration.findUnique({ where: { tenantId } });
      if (!pricing) throw new BadRequestException("Markup is not configured");

      const prepared: {
        lineType: CreateSaleInput["lines"][number]["lineType"];
        quantity: number;
        unitPrice: Decimal;
        costAtSale: Decimal;
        productId?: string;
        finishedItemId?: string;
        custom?: BuiltCustom;
      }[] = [];

      const requirements: { itemId: string; quantity: Decimal; unit: "ML" | "PCS" }[] = [];

      for (const line of input.lines) {
        if (line.lineType === "CUSTOMIZED") {
          const custom = await this.buildCustomized(tx, tenantId, outletId, line);
          for (let i = 0; i < line.quantity; i++) {
            prepared.push({
              lineType: "CUSTOMIZED",
              quantity: 1,
              unitPrice: custom.calculatedPrice,
              costAtSale: custom.materialCost,
              custom,
            });
            for (const c of custom.components) {
              requirements.push(c);
            }
          }
        } else if (line.lineType === "FINISHED_CUSTOMIZED") {
          const finished = await tx.finishedCustomizedItem.findFirst({
            where: {
              id: line.finishedItemId,
              tenantId,
              outletId,
              status: "AVAILABLE",
              availableForSale: true,
            },
            include: { inventoryItem: true },
          });
          if (!finished) throw new BadRequestException("Finished customized item is not available");
          prepared.push({
            lineType: "FINISHED_CUSTOMIZED",
            quantity: 1,
            unitPrice: D(finished.sellingPrice),
            costAtSale: D(finished.materialCost),
            finishedItemId: finished.id,
          });
          requirements.push({ itemId: finished.inventoryItemId, quantity: D(1), unit: "PCS" });
        } else {
          const product = await tx.product.findFirst({
            where: { id: line.productId, tenantId, active: true },
            include: { inventoryItem: true },
          });
          if (!product) throw new BadRequestException("Product not found");
          if (product.classification !== line.lineType) {
            throw new BadRequestException("Product classification mismatch");
          }
          prepared.push({
            lineType: line.lineType,
            quantity: line.quantity,
            unitPrice: D(product.sellingPrice),
            costAtSale: await this.inventory.currentCost(tx, outletId, product.inventoryItemId),
            productId: product.id,
          });
          requirements.push({
            itemId: product.inventoryItemId,
            quantity: D(line.quantity),
            unit: "PCS",
          });
        }
      }

      const shortages = await this.inventory.checkAvailability(tx, tenantId, outletId, requirements);
      if (shortages.length) {
        throw new BadRequestException({ message: "Insufficient inventory", shortages });
      }

      const subtotal = prepared.reduce((sum, l) => sum.add(l.unitPrice.mul(l.quantity)), D(0));
      const materialCost = prepared.reduce((sum, l) => sum.add(l.costAtSale.mul(l.quantity)), D(0));
      const discountAmount = subtotal.mul(discountPct).div(100);
      const finalAmount = subtotal.sub(discountAmount);
      const grossProfit = finalAmount.sub(materialCost);
      const orderNumber = await nextNumber(tx, outletId, "SALE");

      const order = await tx.salesOrder.create({
        data: {
          tenantId,
          outletId,
          customerId: customer.id,
          orderNumber,
          subtotal: subtotal.toFixed(4),
          discountId,
          discountPercentage: discountPct.toFixed(2),
          discountAmount: discountAmount.toFixed(4),
          finalAmount: finalAmount.toFixed(4),
          materialCost: materialCost.toFixed(4),
          grossProfit: grossProfit.toFixed(4),
          paymentMethodId: payment.id,
          paymentReference: input.paymentReference,
          status: "COMPLETED",
          createdById: userId,
        },
      });

      for (const line of prepared) {
        const created = await tx.salesOrderLine.create({
          data: {
            salesOrderId: order.id,
            lineType: line.lineType,
            productId: line.productId,
            finishedItemId: line.finishedItemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice.toFixed(4),
            lineTotal: line.unitPrice.mul(line.quantity).toFixed(4),
            costAtSale: line.costAtSale.mul(line.quantity).toFixed(4),
          },
        });

        if (line.custom) {
          await tx.customizedConfiguration.create({
            data: {
              salesOrderLineId: created.id,
              oilId: line.custom.oilId,
              concentrationId: line.custom.concentrationId,
              bottleId: line.custom.bottleId,
              bottleSizeMl: line.custom.bottleSizeMl,
              oilStandardQtyMl: line.custom.oilStandardQtyMl.toFixed(4),
              oilActualQtyMl: line.custom.oilActualQtyMl.toFixed(4),
              alcoholQtyMl: line.custom.alcoholQtyMl.toFixed(4),
              stabilizerId: line.custom.stabilizerId,
              stabilizerQtyMl: line.custom.stabilizerQtyMl.toFixed(4),
              pumpId: line.custom.pumpId,
              packagingId: line.custom.packagingId,
              customerSuppliedBottle: line.custom.customerSuppliedBottle,
              materialCost: line.custom.materialCost.toFixed(4),
              calculatedPrice: line.custom.calculatedPrice.toFixed(4),
              finalPrice: line.custom.calculatedPrice.toFixed(4),
            },
          });
          for (const c of line.custom.components) {
            await this.inventory.applyMovement(tx, {
              tenantId,
              outletId,
              itemId: c.itemId,
              quantity: c.quantity.neg(),
              unit: c.unit,
              movementType: "CUSTOMIZED_SALE_CONSUMPTION",
              referenceType: "SALE",
              referenceId: order.id,
              createdById: userId,
            });
          }
        } else if (line.lineType === "FINISHED_CUSTOMIZED" && line.finishedItemId) {
          const finished = await tx.finishedCustomizedItem.update({
            where: { id: line.finishedItemId },
            data: { status: "SOLD", availableForSale: false },
          });
          await this.inventory.applyMovement(tx, {
            tenantId,
            outletId,
            itemId: finished.inventoryItemId,
            quantity: D(-1),
            unit: "PCS",
            movementType: "FINISHED_CUSTOMIZED_SALE",
            referenceType: "SALE",
            referenceId: order.id,
            createdById: userId,
          });
        } else if (line.productId) {
          const product = await tx.product.findUniqueOrThrow({ where: { id: line.productId } });
          await this.inventory.applyMovement(tx, {
            tenantId,
            outletId,
            itemId: product.inventoryItemId,
            quantity: D(-line.quantity),
            unit: "PCS",
            movementType: "READY_MADE_SALE",
            referenceType: "SALE",
            referenceId: order.id,
            createdById: userId,
          });
        }
      }

      await this.refreshPreferences(tx, customer.id);

      return this.getById(tx, tenantId, order.id);
    });
  }

  async list(tenantId: string, outletId: string, query: { q?: string; customerId?: string }) {
    return this.prisma.salesOrder.findMany({
      where: {
        tenantId,
        outletId,
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.q
          ? {
              OR: [
                { orderNumber: { contains: query.q, mode: "insensitive" } },
                { customer: { name: { contains: query.q, mode: "insensitive" } } },
                { customer: { mobile: { contains: query.q } } },
              ],
            }
          : {}),
      },
      include: {
        customer: true,
        paymentMethod: true,
        createdBy: { select: { displayName: true } },
        lines: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(tenantId: string, id: string) {
    const order = await this.getById(this.prisma, tenantId, id);
    if (!order) throw new NotFoundException("Sale not found");
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { referenceType: "SALE", referenceId: id },
      include: { item: true },
    });
    return { ...order, movements };
  }

  private async getById(db: Prisma.TransactionClient | PrismaService, tenantId: string, id: string) {
    return db.salesOrder.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        paymentMethod: true,
        discount: true,
        createdBy: { select: { displayName: true } },
        outlet: true,
        lines: {
          include: {
            product: true,
            finishedItem: { include: { configuration: { include: { oil: true, concentration: true, bottle: true } } } },
            configuration: {
              include: { oil: true, concentration: true, bottle: true, pump: true, packaging: true, stabilizer: true },
            },
          },
        },
      },
    });
  }

  private serializeCustom(built: BuiltCustom) {
    return {
      oilId: built.oilId,
      oilName: built.oilName,
      concentrationId: built.concentrationId,
      concentrationName: built.concentrationName,
      bottleId: built.bottleId,
      bottleDesign: built.bottleDesign,
      bottleSizeMl: built.bottleSizeMl,
      oilStandardQtyMl: qty(built.oilStandardQtyMl),
      oilActualQtyMl: qty(built.oilActualQtyMl),
      alcoholQtyMl: qty(built.alcoholQtyMl),
      stabilizerId: built.stabilizerId,
      stabilizerQtyMl: qty(built.stabilizerQtyMl),
      pumpId: built.pumpId,
      packagingId: built.packagingId,
      customerSuppliedBottle: built.customerSuppliedBottle,
      materialCost: money(built.materialCost, 2),
      calculatedPrice: money(built.calculatedPrice, 2),
      components: built.components.map((c) => ({
        itemId: c.itemId,
        quantity: qty(c.quantity),
        unit: c.unit,
      })),
    };
  }

  private async buildCustomized(
    tx: Prisma.TransactionClient,
    tenantId: string,
    outletId: string,
    input: PricingPreviewInput & { quantity?: number },
  ): Promise<BuiltCustom> {
    const oil = await tx.oil.findFirst({
      where: { id: input.oilId, tenantId, active: true },
      include: { inventoryItem: true },
    });
    if (!oil) throw new BadRequestException("Oil not found");
    const concentration = await tx.concentration.findFirst({
      where: { id: input.concentrationId, tenantId, active: true },
    });
    if (!concentration) throw new BadRequestException("Concentration not found");
    const bottle = await tx.bottle.findFirst({
      where: { id: input.bottleId, tenantId, active: true },
      include: { inventoryItem: true, pump: { include: { inventoryItem: true } } },
    });
    if (!bottle) throw new BadRequestException("Bottle not found");

    const alcohol = await tx.alcohol.findFirst({
      where: { tenantId, active: true },
      include: { inventoryItem: true },
    });
    if (!alcohol) throw new BadRequestException("No alcohol is configured");

    const oilStandard = D(bottle.sizeMl).mul(concentration.oilPercentage).div(100);
    const oilActual = D(input.oilActualQtyMl);
    const stabilizerQty = D(input.stabilizerQtyMl ?? 0);
    const alcoholQty = D(bottle.sizeMl).sub(oilActual).sub(stabilizerQty);
    if (alcoholQty.lt(0) || oilActual.add(stabilizerQty).gt(bottle.sizeMl)) {
      throw new BadRequestException("Oil + stabilizer + alcohol cannot exceed bottle size");
    }

    let stabilizer = null;
    if (input.stabilizerId && stabilizerQty.gt(0)) {
      stabilizer = await tx.stabilizer.findFirst({
        where: { id: input.stabilizerId, tenantId, active: true },
        include: { inventoryItem: true },
      });
      if (!stabilizer) throw new BadRequestException("Stabilizer not found");
    }

    let packaging = null;
    if (input.packagingId) {
      packaging = await tx.packagingItem.findFirst({
        where: { id: input.packagingId, tenantId, active: true },
        include: { inventoryItem: true },
      });
      if (!packaging) throw new BadRequestException("Packaging not found");
    }

    if (!input.customerSuppliedBottle && bottle.pumpId && !bottle.pump) {
      throw new BadRequestException("Selected bottle has no compatible pump");
    }

    const components: BuiltCustom["components"] = [
      { itemId: oil.inventoryItemId, quantity: oilActual, unit: "ML" },
      { itemId: alcohol.inventoryItemId, quantity: alcoholQty, unit: "ML" },
    ];
    if (stabilizer) {
      components.push({ itemId: stabilizer.inventoryItemId, quantity: stabilizerQty, unit: "ML" });
    }
    if (!input.customerSuppliedBottle) {
      components.push({ itemId: bottle.inventoryItemId, quantity: D(1), unit: "PCS" });
      if (bottle.pump) {
        components.push({ itemId: bottle.pump.inventoryItemId, quantity: D(1), unit: "PCS" });
      }
    }
    if (packaging) {
      components.push({ itemId: packaging.inventoryItemId, quantity: D(1), unit: "PCS" });
    }

    let materialCost = D(0);
    for (const c of components) {
      const avg = await this.inventory.currentCost(tx, outletId, c.itemId);
      materialCost = materialCost.add(avg.mul(c.quantity));
    }

    const pricing = await tx.pricingConfiguration.findUnique({ where: { tenantId } });
    const markup = D(pricing?.markupPercentage ?? 50);
    const calculatedPrice = materialCost.mul(D(1).add(markup.div(100)));

    return {
      oilId: oil.id,
      concentrationId: concentration.id,
      bottleId: bottle.id,
      bottleSizeMl: bottle.sizeMl,
      oilStandardQtyMl: oilStandard,
      oilActualQtyMl: oilActual,
      alcoholQtyMl: alcoholQty,
      stabilizerId: stabilizer?.id,
      stabilizerQtyMl: stabilizerQty,
      pumpId: input.customerSuppliedBottle ? null : bottle.pumpId,
      packagingId: packaging?.id,
      customerSuppliedBottle: input.customerSuppliedBottle,
      materialCost,
      calculatedPrice,
      components,
      oilName: oil.name,
      concentrationName: concentration.name,
      bottleDesign: bottle.design,
    };
  }

  private async refreshPreferences(tx: Prisma.TransactionClient, customerId: string) {
    const configs = await tx.customizedConfiguration.findMany({
      where: { line: { order: { customerId } } },
      include: { oil: true, concentration: true, packaging: true },
    });
    if (!configs.length) return;
    const count = <T extends string>(key: (c: (typeof configs)[number]) => T | null | undefined) => {
      const map = new Map<T, number>();
      for (const c of configs) {
        const v = key(c);
        if (!v) continue;
        map.set(v, (map.get(v) ?? 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    };
    const favoriteOilId = count((c) => c.oilId);
    const preferredConcentrationId = count((c) => c.concentrationId);
    const preferredPackagingId = count((c) => c.packagingId);
    const size = count((c) => String(c.bottleSizeMl));
    await tx.customerPreference.upsert({
      where: { customerId },
      update: {
        favoriteOilId,
        preferredConcentrationId,
        preferredPackagingId,
        preferredBottleSize: size ? Number(size) : undefined,
      },
      create: {
        customerId,
        favoriteOilId,
        preferredConcentrationId,
        preferredPackagingId,
        preferredBottleSize: size ? Number(size) : undefined,
      },
    });
  }
}
