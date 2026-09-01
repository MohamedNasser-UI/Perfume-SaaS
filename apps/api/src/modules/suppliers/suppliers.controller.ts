import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { supplierPaymentSchema, supplierSchema, supplierUpdateSchema } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser, OutletId, RequestUser, TenantId } from "../../common/context";
import { RequirePage, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";
import { D, money } from "../../common/money";
import { nextNumber } from "../../common/sequences";

@RequirePage("suppliers")
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly prisma: PrismaService) {}

  @SkipOutlet()
  @Get()
  async list(@TenantId() tenantId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    const withBalance = await Promise.all(
      suppliers.map(async (s) => {
        const last = await this.prisma.supplierLedger.findFirst({
          where: { supplierId: s.id },
          orderBy: { createdAt: "desc" },
        });
        return { ...s, balance: money(last?.balance ?? 0), creditLimit: s.creditLimit ? money(s.creditLimit) : null };
      }),
    );
    return withBalance;
  }

  @SkipOutlet()
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(supplierSchema))
    body: {
      name: string;
      phone?: string;
      address?: string;
      contactPerson?: string;
      creditTerms?: string;
      creditLimit?: number;
      openingBalance?: number;
      notes?: string;
      active?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          tenantId,
          name: body.name,
          phone: body.phone,
          address: body.address,
          contactPerson: body.contactPerson,
          creditTerms: body.creditTerms?.trim() ?? "",
          creditLimit: body.creditLimit,
          notes: body.notes,
          active: body.active ?? true,
        },
      });
      const opening = D(body.openingBalance ?? 0);
      if (opening.gt(0)) {
        await tx.supplierLedger.create({
          data: {
            tenantId,
            supplierId: supplier.id,
            transactionType: "OPENING_BALANCE",
            debit: opening.toFixed(4),
            credit: 0,
            balance: opening.toFixed(4),
            transactionDate: new Date(),
            createdById: user.id,
          },
        });
      }
      return supplier;
    });
  }

  @SkipOutlet()
  @Patch(":id")
  async update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(supplierUpdateSchema))
    body: {
      name?: string;
      phone?: string;
      address?: string;
      contactPerson?: string;
      creditTerms?: string;
      creditLimit?: number | null;
      notes?: string;
      active?: boolean;
    },
  ) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException();
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        address: body.address,
        contactPerson: body.contactPerson,
        creditTerms: body.creditTerms?.trim(),
        creditLimit: body.creditLimit,
        notes: body.notes,
        active: body.active,
      },
    });
  }

  @SkipOutlet()
  @Get(":id")
  async get(@TenantId() tenantId: string, @Param("id") id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException();
    const ledger = await this.prisma.supplierLedger.findMany({
      where: { supplierId: id, tenantId },
      orderBy: { transactionDate: "asc" },
    });
    const payments = await this.prisma.supplierPayment.findMany({
      where: { supplierId: id, tenantId },
      orderBy: { paymentDate: "desc" },
    });
    const last = ledger[ledger.length - 1];
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      supplier: {
        ...supplier,
        balance: money(last?.balance ?? 0),
        totalPaid: money(totalPaid),
        creditLimit: supplier.creditLimit ? money(supplier.creditLimit) : null,
      },
      ledger: ledger.map((l) => ({
        ...l,
        debit: money(l.debit),
        credit: money(l.credit),
        balance: money(l.balance),
      })),
      payments: payments.map((p) => ({ ...p, amount: money(p.amount) })),
    };
  }

  @Post(":id/payments")
  async pay(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body(new ZodPipe(supplierPaymentSchema))
    body: {
      supplierId: string;
      amount: number;
      paymentMethod: "CASH" | "BANK_TRANSFER";
      paymentDate: string;
      reference?: string;
      notes?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.supplierLedger.findFirst({
        where: { supplierId: id, tenantId },
        orderBy: { createdAt: "desc" },
      });
      const current = D(last?.balance ?? 0);
      const amount = D(body.amount);
      const newBalance = current.sub(amount);
      const number = await nextNumber(tx, outletId, "PAYMENT");
      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          outletId,
          supplierId: id,
          number,
          amount: amount.toFixed(4),
          paymentMethod: body.paymentMethod,
          paymentDate: new Date(body.paymentDate),
          reference: body.reference,
          notes: body.notes,
          createdById: user.id,
        },
      });
      await tx.supplierLedger.create({
        data: {
          tenantId,
          supplierId: id,
          transactionType: "PAYMENT",
          referenceId: payment.id,
          debit: 0,
          credit: amount.toFixed(4),
          balance: newBalance.toFixed(4),
          transactionDate: new Date(body.paymentDate),
          createdById: user.id,
        },
      });
      return payment;
    });
  }
}
