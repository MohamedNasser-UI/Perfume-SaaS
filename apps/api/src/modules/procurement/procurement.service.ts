import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { D, money } from "../../common/money";
import { nextNumber } from "../../common/sequences";
import { toStockQuantity, toStockUnitCost } from "../../common/units";

type PurchaseInput = {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  notes?: string;
  lines: { itemId: string; quantity: number; unit: "ML" | "L" | "PCS"; unitCost: number }[];
};

const purchaseInclude = {
  supplier: true,
  lines: { include: { item: true } },
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
} as const;

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
      include: purchaseInclude,
    });
  }

  async create(tenantId: string, outletId: string, userId: string, input: PurchaseInput) {
    return this.prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, outletId, "PURCHASE");
      const { lineData, total } = await this.prepareLines(tx, tenantId, input.lines);

      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
      if (!supplier) throw new BadRequestException("Supplier not found");
      const currentBalance = await this.currentSupplierBalance(tx, supplier.id);
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

  async update(tenantId: string, outletId: string, userId: string, id: string, input: PurchaseInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseInvoice.findFirst({
        where: { id, tenantId, outletId },
        include: { lines: true },
      });
      if (!existing) throw new NotFoundException("Purchase not found");
      if (existing.status !== "POSTED") throw new BadRequestException("Only posted purchases can be edited");

      const { lineData, total } = await this.prepareLines(tx, tenantId, input.lines);
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, tenantId } });
      if (!supplier) throw new BadRequestException("Supplier not found");

      const previousSupplierId = existing.supplierId;

      for (const line of existing.lines) {
        await this.inventory.reversePurchaseReceipt(tx, {
          tenantId,
          outletId,
          itemId: line.itemId,
          stockQuantity: line.stockQuantity,
          stockUnitCost: line.stockUnitCost,
          referenceId: existing.id,
          createdById: userId,
          reason: "purchase edit",
        });
      }

      await tx.purchaseInvoiceLine.deleteMany({ where: { purchaseInvoiceId: existing.id } });

      const invoiceDate = new Date(input.invoiceDate);
      await tx.purchaseInvoice.update({
        where: { id: existing.id },
        data: {
          supplierId: supplier.id,
          invoiceNumber: input.invoiceNumber,
          invoiceDate,
          totalAmount: total.toFixed(4),
          notes: input.notes,
          updatedById: userId,
          lines: { create: lineData },
        },
      });

      const updated = await tx.purchaseInvoice.findFirstOrThrow({
        where: { id: existing.id },
        include: { lines: true },
      });

      for (const line of updated.lines) {
        await this.inventory.applyMovement(tx, {
          tenantId,
          outletId,
          itemId: line.itemId,
          quantity: line.quantity,
          unit: line.unit,
          movementType: "PURCHASE_RECEIPT",
          referenceType: "PURCHASE",
          referenceId: updated.id,
          inboundUnitCost: line.unitCost,
          createdById: userId,
        });
      }

      const ledger = await tx.supplierLedger.findFirst({
        where: { purchaseId: existing.id, transactionType: "PURCHASE_INVOICE" },
      });
      if (ledger) {
        await tx.supplierLedger.update({
          where: { id: ledger.id },
          data: {
            supplierId: supplier.id,
            debit: total.toFixed(4),
            credit: 0,
            transactionDate: invoiceDate,
          },
        });
      } else {
        await tx.supplierLedger.create({
          data: {
            tenantId,
            supplierId: supplier.id,
            transactionType: "PURCHASE_INVOICE",
            referenceId: existing.id,
            purchaseId: existing.id,
            debit: total.toFixed(4),
            credit: 0,
            balance: total.toFixed(4),
            transactionDate: invoiceDate,
            createdById: userId,
          },
        });
      }

      await this.recomputeSupplierBalances(tx, previousSupplierId);
      if (previousSupplierId !== supplier.id) {
        await this.recomputeSupplierBalances(tx, supplier.id);
      }

      const saved = await tx.purchaseInvoice.findFirstOrThrow({
        where: { id: existing.id },
        include: purchaseInclude,
      });
      const currentBalance = await this.currentSupplierBalance(tx, supplier.id);
      const creditWarning =
        supplier.creditLimit && currentBalance.gt(supplier.creditLimit)
          ? {
              creditLimit: money(supplier.creditLimit),
              currentBalance: money(currentBalance),
              projectedBalance: money(currentBalance),
            }
          : null;
      return { ...saved, creditWarning, totalAmount: money(total) };
    });
  }

  private async prepareLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: PurchaseInput["lines"],
  ) {
    const lineData: Prisma.PurchaseInvoiceLineUncheckedCreateWithoutInvoiceInput[] = [];
    let total = D(0);
    for (const line of lines) {
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
    if (!lineData.length) throw new BadRequestException("Add at least one purchase line");
    return { lineData, total };
  }

  private async currentSupplierBalance(tx: Prisma.TransactionClient, supplierId: string) {
    const last = await tx.supplierLedger.findFirst({
      where: { supplierId },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });
    return D(last?.balance ?? 0);
  }

  private async recomputeSupplierBalances(tx: Prisma.TransactionClient, supplierId: string) {
    const rows = await tx.supplierLedger.findMany({
      where: { supplierId },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });
    let balance = D(0);
    for (const row of rows) {
      balance = balance.add(D(row.debit)).sub(D(row.credit));
      await tx.supplierLedger.update({
        where: { id: row.id },
        data: { balance: balance.toFixed(4) },
      });
    }
  }
}
