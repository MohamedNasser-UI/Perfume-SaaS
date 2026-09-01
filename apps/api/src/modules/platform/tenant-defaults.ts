import { Prisma, PrismaClient } from "@prisma/client";

export async function seedTenantDefaults(
  tx: Prisma.TransactionClient | PrismaClient,
  tenantId: string,
) {
  await tx.concentration.createMany({
    data: [
      { tenantId, name: "EDT", oilPercentage: 15, active: true },
      { tenantId, name: "EDP", oilPercentage: 20, active: true },
      { tenantId, name: "Parfum", oilPercentage: 30, active: true },
    ],
  });

  await tx.pricingConfiguration.create({
    data: { tenantId, markupPercentage: 50, active: true },
  });

  await tx.discountConfiguration.createMany({
    data: [
      { tenantId, name: "5%", percentage: 5, active: true },
      { tenantId, name: "10%", percentage: 10, active: true },
      { tenantId, name: "15%", percentage: 15, active: true },
    ],
  });

  await tx.paymentMethod.createMany({
    data: [
      { tenantId, name: "Cash", code: "CASH", active: true },
      { tenantId, name: "Visa", code: "VISA", active: true },
      { tenantId, name: "Instapay", code: "INSTAPAY", active: true },
    ],
  });
}
