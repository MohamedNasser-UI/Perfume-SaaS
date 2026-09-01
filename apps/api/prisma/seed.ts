import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { seedTenantDefaults } from "../src/modules/platform/tenant-defaults";
import { ensureSequences } from "../src/common/sequences";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@perfume.saas";
  const adminPass = process.env.PLATFORM_ADMIN_PASSWORD ?? "ChangeMe123!";
  const ownerEmail = process.env.DEMO_OWNER_EMAIL ?? "owner@noor.perfume";
  const ownerPass = process.env.DEMO_OWNER_PASSWORD ?? "ChangeMe123!";

  const adminHash = await bcrypt.hash(adminPass, 10);
  const ownerHash = await bcrypt.hash(ownerPass, 10);
  const staffHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      displayName: "Platform Admin",
      role: "PLATFORM_ADMIN",
    },
  });

  let tenant = await prisma.tenant.findUnique({ where: { slug: "noor-perfume" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Noor Perfume",
        slug: "noor-perfume",
        currency: "EGP",
        timezone: "Africa/Cairo",
        locale: "en-EG",
        country: "EG",
        notes: "Demo tenant",
        status: "ACTIVE",
      },
    });
    await seedTenantDefaults(prisma, tenant.id);
  }

  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: { tenantId: tenant.id, name: "Zamalek Outlet", address: "26 July St, Zamalek, Cairo", phone: "0227360000" },
    });
  }
  await ensureSequences(prisma, tenant.id, outlet.id);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      email: ownerEmail,
      passwordHash: ownerHash,
      displayName: "Noor Owner",
      role: "OWNER",
    },
  });
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: owner.id, outletId: outlet.id } },
    update: {},
    create: { userId: owner.id, outletId: outlet.id },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@noor.perfume" },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "staff@noor.perfume",
      passwordHash: staffHash,
      displayName: "Mona Cashier",
      role: "STAFF",
    },
  });
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: staff.id, outletId: outlet.id } },
    update: {},
    create: { userId: staff.id, outletId: outlet.id },
  });

  async function item(
    code: string,
    name: string,
    type: "OIL" | "ALCOHOL" | "STABILIZER" | "BOTTLE" | "PUMP" | "PACKAGING" | "READY_MADE",
    purchaseUnit: "L" | "ML" | "PCS",
    stockUnit: "L" | "ML" | "PCS",
    threshold = 0,
  ) {
    return prisma.inventoryItem.upsert({
      where: { tenantId_code: { tenantId: tenant!.id, code } },
      update: {},
      create: {
        tenantId: tenant!.id,
        code,
        name,
        itemType: type,
        purchaseUnit,
        stockUnit,
        lowStockThreshold: threshold,
      },
    });
  }

  const oudItem = await item("OIL-OUD", "Oud", "OIL", "L", "ML", 500);
  const muskItem = await item("OIL-MUSK", "Musk", "OIL", "L", "ML", 500);
  const roseItem = await item("OIL-ROSE", "Rose", "OIL", "L", "ML", 300);
  const alcItem = await item("ALC-01", "Perfume Alcohol", "ALCOHOL", "L", "ML", 2000);
  const stabItem = await item("STB-01", "Stabilizer", "STABILIZER", "L", "ML", 100);
  const pumpAItem = await item("PMP-A", "Pump Type A", "PUMP", "PCS", "PCS", 10);
  const b30 = await item("BTL-CL-30", "Classic 30ml", "BOTTLE", "PCS", "PCS", 10);
  const b50 = await item("BTL-CL-50", "Classic 50ml", "BOTTLE", "PCS", "PCS", 10);
  const b100 = await item("BTL-CL-100", "Classic 100ml", "BOTTLE", "PCS", "PCS", 10);
  const boxItem = await item("PKG-STD", "Standard Box", "PACKAGING", "PCS", "PCS", 10);
  const giftItem = await item("PKG-GIFT", "Gift Box", "PACKAGING", "PCS", "PCS", 5);
  const sauvageItem = await item("RM-SAUVAGE", "Dior Sauvage 100ml", "READY_MADE", "PCS", "PCS", 3);
  const copyItem = await item("RM-SAUV-HC", "Sauvage Style 100ml", "READY_MADE", "PCS", "PCS", 5);

  const pumpA = await prisma.pump.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PMP-A" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: pumpAItem.id, code: "PMP-A", name: "Pump Type A" },
  });

  await prisma.oil.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "OIL-OUD" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: oudItem.id, code: "OIL-OUD", name: "Oud" },
  });
  await prisma.oil.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "OIL-MUSK" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: muskItem.id, code: "OIL-MUSK", name: "Musk" },
  });
  await prisma.oil.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "OIL-ROSE" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: roseItem.id, code: "OIL-ROSE", name: "Rose" },
  });
  await prisma.alcohol.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "ALC-01" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: alcItem.id, code: "ALC-01", name: "Perfume Alcohol" },
  });
  await prisma.stabilizer.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "STB-01" } },
    update: {},
    create: { tenantId: tenant.id, inventoryItemId: stabItem.id, code: "STB-01", name: "Stabilizer" },
  });

  for (const [code, design, size, itemRow] of [
    ["BTL-CL-30", "Classic", 30, b30],
    ["BTL-CL-50", "Classic", 50, b50],
    ["BTL-CL-100", "Classic", 100, b100],
  ] as const) {
    await prisma.bottle.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { pumpId: pumpA.id },
      create: {
        tenantId: tenant.id,
        inventoryItemId: itemRow.id,
        code,
        design,
        sizeMl: size,
        pumpId: pumpA.id,
      },
    });
  }

  await prisma.packagingItem.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PKG-STD" } },
    update: {},
    create: {
      tenantId: tenant.id,
      inventoryItemId: boxItem.id,
      code: "PKG-STD",
      name: "Standard Box",
      type: "STANDARD_BOX",
    },
  });
  await prisma.packagingItem.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PKG-GIFT" } },
    update: {},
    create: {
      tenantId: tenant.id,
      inventoryItemId: giftItem.id,
      code: "PKG-GIFT",
      name: "Gift Box",
      type: "PREMIUM_BOX",
    },
  });

  await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "RM-SAUVAGE" } },
    update: {},
    create: {
      tenantId: tenant.id,
      inventoryItemId: sauvageItem.id,
      sku: "RM-SAUVAGE",
      name: "Dior Sauvage 100ml",
      brand: "Dior",
      classification: "ORIGINAL",
      sizeMl: 100,
      barcode: "3348901368254",
      sellingPrice: 2000,
    },
  });
  await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "RM-SAUV-HC" } },
    update: {},
    create: {
      tenantId: tenant.id,
      inventoryItemId: copyItem.id,
      sku: "RM-SAUV-HC",
      name: "Sauvage Style 100ml",
      brand: "House Blend",
      classification: "HIGH_COPY",
      sizeMl: 100,
      barcode: "6220000000001",
      sellingPrice: 250,
    },
  });

  const openings: { itemId: string; qty: number; cost: number; unit: "ML" | "PCS" }[] = [
    { itemId: oudItem.id, qty: 5000, cost: 5.25, unit: "ML" },
    { itemId: muskItem.id, qty: 3000, cost: 4.0, unit: "ML" },
    { itemId: roseItem.id, qty: 2000, cost: 6.0, unit: "ML" },
    { itemId: alcItem.id, qty: 20000, cost: 0.8, unit: "ML" },
    { itemId: stabItem.id, qty: 1000, cost: 2.0, unit: "ML" },
    { itemId: pumpAItem.id, qty: 120, cost: 5, unit: "PCS" },
    { itemId: b30.id, qty: 80, cost: 18, unit: "PCS" },
    { itemId: b50.id, qty: 90, cost: 24, unit: "PCS" },
    { itemId: b100.id, qty: 100, cost: 30, unit: "PCS" },
    { itemId: boxItem.id, qty: 60, cost: 8, unit: "PCS" },
    { itemId: giftItem.id, qty: 40, cost: 10, unit: "PCS" },
    { itemId: sauvageItem.id, qty: 12, cost: 1400, unit: "PCS" },
    { itemId: copyItem.id, qty: 30, cost: 90, unit: "PCS" },
  ];

  for (const row of openings) {
    const existing = await prisma.inventoryBalance.findUnique({
      where: { outletId_itemId: { outletId: outlet.id, itemId: row.itemId } },
    });
    if (existing && Number(existing.quantityOnHand) > 0) continue;
    await prisma.inventoryBalance.upsert({
      where: { outletId_itemId: { outletId: outlet.id, itemId: row.itemId } },
      update: {
        quantityOnHand: row.qty,
        averageCost: row.cost,
        inventoryValue: row.qty * row.cost,
      },
      create: {
        tenantId: tenant.id,
        outletId: outlet.id,
        itemId: row.itemId,
        quantityOnHand: row.qty,
        averageCost: row.cost,
        inventoryValue: row.qty * row.cost,
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        itemId: row.itemId,
        movementType: "OPENING_BALANCE",
        quantity: row.qty,
        unit: row.unit,
        unitCost: row.cost,
        totalCost: row.qty * row.cost,
        referenceType: "OPENING",
        referenceId: "seed",
        balanceAfter: row.qty,
        createdById: owner.id,
        reason: "Demo opening balance",
      },
    });
  }

  const exists = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, name: "Cairo Oils Co" } });
  if (!exists) {
    await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: "Cairo Oils Co",
        phone: "01000000001",
        contactPerson: "Hassan",
        creditTerms: "30 days",
        creditLimit: 100000,
      },
    });
  }

  await prisma.customer.upsert({
    where: { tenantId_mobile: { tenantId: tenant.id, mobile: "01012345678" } },
    update: {},
    create: { tenantId: tenant.id, name: "Ahmed Hassan", mobile: "01012345678", gender: "MALE" },
  });

  console.log("Seed complete");
  console.log("Platform admin:", adminEmail, adminPass);
  console.log("Tenant owner:", ownerEmail, ownerPass);
  console.log("Staff:", "staff@noor.perfume", "ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
