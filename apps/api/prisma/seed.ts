import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { seedTenantDefaults } from "../src/modules/platform/tenant-defaults";
import { ensureSequences } from "../src/common/sequences";
import { DEMO_SLUG, DEMO_TENANT_NAME, DEMO_OUTLET_NAME, DEMO_MARKER } from "./demo-template/constants";
import { seedCatalog } from "./demo-template/catalog";
import { seedParties } from "./demo-template/parties";
import { StockLedger } from "./demo-template/stock";
import { seedOpeningBalances, seedHistory } from "./demo-template/transactions";
import { printVerification } from "./demo-template/verify";

const prisma = new PrismaClient();

async function ensureDefaults(tenantId: string) {
  const count = await prisma.concentration.count({ where: { tenantId } });
  if (count === 0) {
    await seedTenantDefaults(prisma, tenantId);
  }
}

async function main() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@perfume.saas";
  const adminPass = process.env.PLATFORM_ADMIN_PASSWORD ?? "ChangeMe123!";
  const ownerEmail = process.env.DEMO_OWNER_EMAIL ?? "owner@noor.perfume";
  const ownerPass = process.env.DEMO_OWNER_PASSWORD ?? "ChangeMe123!";

  const adminHash = await bcrypt.hash(adminPass, 10);
  const ownerHash = await bcrypt.hash(ownerPass, 10);
  const staffHash = await bcrypt.hash("ChangeMe123!", 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      displayName: "Platform Admin",
      role: "PLATFORM_ADMIN",
    },
  });

  let tenant = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  const isNew = !tenant;
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: DEMO_TENANT_NAME,
        slug: DEMO_SLUG,
        currency: "EGP",
        timezone: "Africa/Cairo",
        locale: "ar-EG",
        country: "EG",
        notes: `MASTER DEMO TEMPLATE | ${DEMO_MARKER}`,
        status: "ACTIVE",
      },
    });
  } else {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: DEMO_TENANT_NAME,
        locale: "ar-EG",
        currency: "EGP",
        timezone: "Africa/Cairo",
        country: "EG",
        notes: `MASTER DEMO TEMPLATE | ${DEMO_MARKER}`,
        status: "ACTIVE",
      },
    });
  }

  await ensureDefaults(tenant.id);

  let outlet = await prisma.outlet.findFirst({ where: { tenantId: tenant.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: DEMO_OUTLET_NAME,
        address: "شارع 26 يوليو، الزمالك، القاهرة",
        phone: "0227360000",
      },
    });
  } else {
    outlet = await prisma.outlet.update({
      where: { id: outlet.id },
      data: {
        name: DEMO_OUTLET_NAME,
        address: "شارع 26 يوليو، الزمالك، القاهرة",
      },
    });
  }

  await ensureSequences(prisma, tenant.id, outlet.id);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { tenantId: tenant.id, displayName: "مالك المتجر التجريبي" },
    create: {
      tenantId: tenant.id,
      email: ownerEmail,
      passwordHash: ownerHash,
      displayName: "مالك المتجر التجريبي",
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
    update: { tenantId: tenant.id, displayName: "منى الكاشير" },
    create: {
      tenantId: tenant.id,
      email: "staff@noor.perfume",
      passwordHash: staffHash,
      displayName: "منى الكاشير",
      role: "STAFF",
    },
  });
  await prisma.userOutlet.upsert({
    where: { userId_outletId: { userId: staff.id, outletId: outlet.id } },
    update: {},
    create: { userId: staff.id, outletId: outlet.id },
  });

  console.log(isNew ? "Created demo tenant" : "Updated demo tenant", tenant.id);

  console.log("Seeding catalog…");
  const catalog = await seedCatalog(prisma, tenant.id);

  console.log("Seeding suppliers & customers…");
  const parties = await seedParties(prisma, tenant.id, owner.id);

  console.log("Seeding opening balances…");
  const ledger = new StockLedger();
  await seedOpeningBalances(prisma, tenant.id, outlet.id, owner.id, catalog, ledger);

  console.log("Seeding purchase/sales/return history…");
  const history = await seedHistory(prisma, {
    tenantId: tenant.id,
    outletId: outlet.id,
    ownerId: owner.id,
    catalog,
    parties,
    ledger,
    forceReseed: process.env.FORCE_DEMO_RESEED === "1",
  });

  const report = await printVerification(prisma, tenant.id, outlet.id);

  console.log("Seed complete");
  console.log("Platform admin:", adminEmail, adminPass);
  console.log("Tenant owner:", ownerEmail, ownerPass);
  console.log("Staff:", "staff@noor.perfume", "ChangeMe123!");
  console.log(
    "History:",
    history.skipped
      ? "skipped (already present)"
      : `purchases=${history.purchases} sales=${history.sales} returns=${history.returns}`,
  );
  void report;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
