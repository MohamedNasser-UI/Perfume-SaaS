import { Prisma } from "@prisma/client";
import { SequenceType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const PREFIX: Record<SequenceType, string> = {
  SALE: "SALE",
  PURCHASE: "PO",
  RETURN: "RET",
  WASTE: "WST",
  ADJUSTMENT: "ADJ",
  PAYMENT: "PAY",
};

export async function nextNumber(
  tx: Prisma.TransactionClient | PrismaService,
  outletId: string,
  type: SequenceType,
): Promise<string> {
  const row = await tx.tenantSequence.update({
    where: { outletId_type: { outletId, type } },
    data: { nextNumber: { increment: 1 } },
  });
  const n = String(row.nextNumber - 1).padStart(6, "0");
  return `${PREFIX[type]}-${n}`;
}

export async function ensureSequences(
  tx: Prisma.TransactionClient | PrismaService,
  tenantId: string,
  outletId: string,
) {
  const types: SequenceType[] = ["SALE", "PURCHASE", "RETURN", "WASTE", "ADJUSTMENT", "PAYMENT"];
  for (const type of types) {
    await tx.tenantSequence.upsert({
      where: { outletId_type: { outletId, type } },
      update: {},
      create: { tenantId, outletId, type, nextNumber: 1 },
    });
  }
}
