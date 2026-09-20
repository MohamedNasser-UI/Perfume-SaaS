import type { PrismaClient } from "@prisma/client";
import { SUPPLIERS, CUSTOMERS } from "./parties-data";
import { DEMO_MARKER } from "./constants";

export type PartiesIds = {
  suppliers: { id: string; key: string; name: string }[];
  customers: { id: string; name: string; mobile: string }[];
};

export async function seedParties(
  prisma: PrismaClient,
  tenantId: string,
  createdById: string,
): Promise<PartiesIds> {
  const suppliers: PartiesIds["suppliers"] = [];
  const customers: PartiesIds["customers"] = [];

  // Rename leftover English supplier from old seed
  const legacy = await prisma.supplier.findFirst({
    where: { tenantId, name: "Cairo Oils Co" },
  });
  if (legacy) {
    await prisma.supplier.update({
      where: { id: legacy.id },
      data: {
        name: "مؤسسة الفجر للزيوت العطرية",
        contactPerson: "حسن عبد الله",
        phone: "01011112222",
        address: "شارع الجمهورية، وسط البلد، القاهرة",
        notes: `${DEMO_MARKER} | migrated from Cairo Oils Co`,
      },
    });
  }

  for (const def of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({
      where: { tenantId, name: def.name },
    });
    const row = existing
      ? await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            contactPerson: def.contactPerson,
            phone: def.phone,
            address: def.address,
            creditTerms: def.creditTerms,
            creditLimit: def.creditLimit,
            notes: `${DEMO_MARKER} | ${def.notes}`,
            active: true,
          },
        })
      : await prisma.supplier.create({
          data: {
            tenantId,
            name: def.name,
            contactPerson: def.contactPerson,
            phone: def.phone,
            address: def.address,
            creditTerms: def.creditTerms,
            creditLimit: def.creditLimit,
            notes: `${DEMO_MARKER} | ${def.notes}`,
            active: true,
          },
        });

    // Opening balance once
    const hasOpening = await prisma.supplierLedger.findFirst({
      where: { supplierId: row.id, transactionType: "OPENING_BALANCE" },
    });
    if (!hasOpening) {
      const opening = 5000 + suppliers.length * 1500;
      await prisma.supplierLedger.create({
        data: {
          tenantId,
          supplierId: row.id,
          transactionType: "OPENING_BALANCE",
          debit: opening,
          credit: 0,
          balance: opening,
          transactionDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          createdById,
        },
      });
    }

    suppliers.push({ id: row.id, key: def.key, name: def.name });
  }

  for (const def of CUSTOMERS) {
    const row = await prisma.customer.upsert({
      where: { tenantId_mobile: { tenantId, mobile: def.mobile } },
      update: { name: def.name, gender: def.gender, notes: def.notes ?? DEMO_MARKER },
      create: {
        tenantId,
        name: def.name,
        mobile: def.mobile,
        gender: def.gender,
        notes: def.notes ?? DEMO_MARKER,
      },
    });
    customers.push({ id: row.id, name: def.name, mobile: def.mobile });
  }

  // Fix old English customer name if still present under same mobile
  await prisma.customer.updateMany({
    where: { tenantId, name: "Ahmed Hassan" },
    data: { name: "أحمد حسن محمود" },
  });

  return { suppliers, customers };
}
