import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateReturnInput } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { D, money } from "../../common/money";
import { nextNumber } from "../../common/sequences";

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list(tenantId: string, outletId: string) {
    return this.prisma.return.findMany({
      where: { tenantId, outletId },
      include: {
        originalOrder: { include: { customer: true } },
        lines: true,
        createdBy: { select: { displayName: true } },
      },
      orderBy: { returnDate: "desc" },
    });
  }

  async create(tenantId: string, outletId: string, userId: string, input: CreateReturnInput) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: input.originalOrderId, tenantId, outletId },
        include: {
          lines: { include: { product: true, configuration: true, finishedItem: true } },
        },
      });
      if (!order) throw new BadRequestException("Original order not found");

      let refundTotal = D(0);
      const createdLines: { originalOrderLineId: string; quantity: number; disposition: CreateReturnInput["lines"][number]["disposition"]; refundAmount: string }[] = [];

      for (const lineIn of input.lines) {
        const line = order.lines.find((l) => l.id === lineIn.originalOrderLineId);
        if (!line) throw new BadRequestException("Order line not found");
        const remaining = line.quantity - line.returnedQty;
        if (lineIn.quantity > remaining) throw new BadRequestException("Return quantity exceeds remaining quantity");

        const share = D(order.subtotal).eq(0)
          ? D(0)
          : D(line.lineTotal).div(order.subtotal).mul(order.finalAmount);
        const refund = share.div(line.quantity).mul(lineIn.quantity);
        refundTotal = refundTotal.add(refund);
        createdLines.push({
          originalOrderLineId: line.id,
          quantity: lineIn.quantity,
          disposition: lineIn.disposition,
          refundAmount: refund.toFixed(4),
        });
      }

      const number = await nextNumber(tx, outletId, "RETURN");
      const ret = await tx.return.create({
        data: {
          tenantId,
          outletId,
          originalOrderId: order.id,
          number,
          reason: input.reason,
          refundAmount: refundTotal.toFixed(4),
          createdById: userId,
          lines: { create: createdLines },
        },
        include: { lines: true },
      });

      for (const lineIn of input.lines) {
        const line = order.lines.find((l) => l.id === lineIn.originalOrderLineId)!;
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: { returnedQty: { increment: lineIn.quantity } },
        });

        if (line.lineType === "CUSTOMIZED" && line.configuration) {
          if (lineIn.disposition === "RETURN_TO_FINISHED_STOCK") {
            for (let i = 0; i < lineIn.quantity; i++) {
              const item = await tx.inventoryItem.create({
                data: {
                  tenantId,
                  code: `FC-${ret.number}-${i + 1}`,
                  name: `Returned ${line.configuration.bottleSizeMl}ml custom`,
                  itemType: "FINISHED_CUSTOMIZED",
                  purchaseUnit: "PCS",
                  stockUnit: "PCS",
                },
              });
              const finished = await tx.finishedCustomizedItem.create({
                data: {
                  tenantId,
                  outletId,
                  inventoryItemId: item.id,
                  configurationId: line.configuration.id,
                  originalOrderId: order.id,
                  status: "AVAILABLE",
                  materialCost: line.costAtSale,
                  sellingPrice: line.unitPrice,
                  availableForSale: true,
                  returnedAt: new Date(),
                },
              });
              await this.inventory.applyMovement(tx, {
                tenantId,
                outletId,
                itemId: item.id,
                quantity: 1,
                unit: "PCS",
                movementType: "RETURN",
                referenceType: "RETURN",
                referenceId: ret.id,
                inboundUnitCost: D(line.costAtSale).div(line.quantity),
                createdById: userId,
              });
              void finished;
            }
          }
        } else if (line.productId && line.product) {
          if (lineIn.disposition === "RETURN_TO_FINISHED_STOCK") {
            await this.inventory.applyMovement(tx, {
              tenantId,
              outletId,
              itemId: line.product.inventoryItemId,
              quantity: lineIn.quantity,
              unit: "PCS",
              movementType: "RETURN",
              referenceType: "RETURN",
              referenceId: ret.id,
              inboundUnitCost: D(line.costAtSale).div(line.quantity),
              createdById: userId,
            });
          }
        } else if (line.finishedItemId) {
          if (lineIn.disposition === "RETURN_TO_FINISHED_STOCK") {
            const finished = await tx.finishedCustomizedItem.update({
              where: { id: line.finishedItemId },
              data: { status: "AVAILABLE", availableForSale: true },
            });
            await this.inventory.applyMovement(tx, {
              tenantId,
              outletId,
              itemId: finished.inventoryItemId,
              quantity: 1,
              unit: "PCS",
              movementType: "RETURN",
              referenceType: "RETURN",
              referenceId: ret.id,
              inboundUnitCost: D(line.costAtSale),
              createdById: userId,
            });
          } else {
            await tx.finishedCustomizedItem.update({
              where: { id: line.finishedItemId },
              data: {
                status: lineIn.disposition === "DAMAGED" ? "DAMAGED" : "DISPOSED",
                availableForSale: false,
              },
            });
          }
        }
      }

      const lines = await tx.salesOrderLine.findMany({ where: { salesOrderId: order.id } });
      const allReturned = lines.every((l) => l.returnedQty >= l.quantity);
      const anyReturned = lines.some((l) => l.returnedQty > 0);
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: allReturned ? "RETURNED" : anyReturned ? "PARTIALLY_RETURNED" : "COMPLETED" },
      });

      return { ...ret, refundAmount: money(refundTotal) };
    });
  }

  listFinished(tenantId: string, outletId: string) {
    return this.prisma.finishedCustomizedItem.findMany({
      where: { tenantId, outletId, status: "AVAILABLE" },
      include: {
        configuration: { include: { oil: true, concentration: true, bottle: true, packaging: true } },
        inventoryItem: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
