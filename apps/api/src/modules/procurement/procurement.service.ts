import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { D, money } from "../../common/money";
import { nextNumber } from "../../common/sequences";
import { toStockQuantity, toStockUnitCost } from "../../common/units";

@Injectable()
export class ProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  list(tenantId: string, outletId: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: { tenantId, outletId },
      include: { supplier: true, lines: { include: { item: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.purchaseInvoice.findFirst({
      where: { id, tenantId },
      include: { supplier: true, lines: { include: { item: true } }, createdBy: { select: { displayName: true } } },
    });
  }

  async create(
    tenantId: string,
    outletId: string,
    userId: string,
    input: {
      supplierId: string;
      invoiceNumber: string;
      invoiceDate: string;
      notes?: string;
      lines: { itemId: string; quantity: number; unit: "ML" | "L" | "PCS"; unitCost: number }[];
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, outletId, "PURCHASE");
      const lineData = [];
      let total = D(0);
      for (const line of input.lines) {
        if (line.quantity <= 0 || line.unitCost <= 0) {
          throw new BadRequestException("Purchase quantity and unit cost must be greater than zero");
        }
        const item = await tx.inventoryItem.findFirst({ where: { id: line.itemId, tenantId } });
        if (!item) throw new BadRequestException("Item not found");
        const lineTotal = D(line.quantity).mul(line.unitCost);
        total = total.add(lineTotal);
        const stockQuantity = toStockQuantity(line.quantity, line.unit, item.stockUnit);
        const stockUnitCost = toStockUnitCost(line.unitCost, line.unit, item.stockUnit);
        lineData.push({
          itemId: line.itemId,
          quantity: D(line.quantity).toFixed(4),
          unit: line.unit,
          unitCost: D(line.unitCost).toFixed(6),
          lineTotal: lineTotal.toFixed(4),
          stockQuantity: stockQuantity.toFixed(4),
          stockUnitCost: stockUnitCost.toFixed(6),
        });
      }

      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
      if (!supplier) throw new BadRequestException("Supplier not found");
      const last = await tx.supplierLedger.findFirst({
        where: { supplierId: supplier.id },
        orderBy: { createdAt: "desc" },
      });
      const currentBalance = D(last?.balance ?? 0);
      const projected = currentBalance.add(total);
      const creditWarning =
        supplier.creditLimit && projected.gt(supplier.creditLimit)
          ? {
              creditLimit: money(supplier.creditLimit),
              currentBalance: money(currentBalance),
              projectedBalance: money(projected),
            }
          : null;

      const invoice = await tx.purchaseInvoice.create({
        data: {
          tenantId,
          outletId,
          supplierId: input.supplierId,
          number,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: new Date(input.invoiceDate),
          postingDate: new Date(),
          totalAmount: total.toFixed(4),
          status: "POSTED",
          notes: input.notes,
          createdById: userId,
          lines: { create: lineData },
        },
        include: { lines: true, supplier: true },
      });

      for (const line of invoice.lines) {
        await this.inventory.applyMovement(tx, {
          tenantId,
          outletId,
          itemId: line.itemId,
          quantity: line.quantity,
          unit: line.unit,
          movementType: "PURCHASE_RECEIPT",
          referenceType: "PURCHASE",
          referenceId: invoice.id,
          inboundUnitCost: line.unitCost,
          createdById: userId,
        });
      }

      const newBalance = currentBalance.add(total);
      await tx.supplierLedger.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          transactionType: "PURCHASE_INVOICE",
          referenceId: invoice.id,
          purchaseId: invoice.id,
          debit: total.toFixed(4),
          credit: 0,
          balance: newBalance.toFixed(4),
          transactionDate: invoice.invoiceDate,
          createdById: userId,
        },
      });

      return { ...invoice, creditWarning, totalAmount: money(total) };
    });
  }
}
