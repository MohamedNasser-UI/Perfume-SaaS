import type { PrismaClient } from "@prisma/client";
import {
  READY_MADE,
  LEGACY_READY_MADE_REMAP,
  OILS,
  LEGACY_OILS,
  BOTTLES,
  PACKAGING,
  COMPONENTS,
  type ReadyMadeDef,
  type OilDef,
  type BottleDef,
  type PackagingDef,
  type ComponentDef,
} from "./catalog-data";

export type CatalogIds = {
  products: { id: string; sku: string; inventoryItemId: string; classification: string; sellingPrice: number; name: string; costHint: number }[];
  oils: { id: string; code: string; inventoryItemId: string; name: string; costPerMl: number }[];
  bottles: { id: string; code: string; inventoryItemId: string; sizeMl: number; pumpId: string | null; cost: number }[];
  packaging: { id: string; code: string; inventoryItemId: string; cost: number }[];
  alcohol: { id: string; inventoryItemId: string; cost: number };
  stabilizer: { id: string; inventoryItemId: string; cost: number };
  pump: { id: string; inventoryItemId: string; cost: number };
  /** All inventory items with opening hints */
  openings: { itemId: string; qty: number; cost: number; unit: "ML" | "PCS"; code: string }[];
};

async function upsertItem(
  prisma: PrismaClient,
  tenantId: string,
  code: string,
  name: string,
  itemType: "OIL" | "ALCOHOL" | "STABILIZER" | "BOTTLE" | "PUMP" | "PACKAGING" | "READY_MADE",
  purchaseUnit: "L" | "ML" | "PCS",
  stockUnit: "L" | "ML" | "PCS",
  threshold: number,
) {
  return prisma.inventoryItem.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { name, lowStockThreshold: threshold, active: true, itemType },
    create: {
      tenantId,
      code,
      name,
      itemType,
      purchaseUnit,
      stockUnit,
      lowStockThreshold: threshold,
      active: true,
    },
  });
}

async function seedReadyMade(
  prisma: PrismaClient,
  tenantId: string,
  defs: ReadyMadeDef[],
  openings: CatalogIds["openings"],
  products: CatalogIds["products"],
) {
  for (const def of defs) {
    const item = await upsertItem(
      prisma,
      tenantId,
      def.sku,
      def.name,
      "READY_MADE",
      "PCS",
      "PCS",
      def.lowStockThreshold,
    );
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku: def.sku } },
      update: {
        name: def.name,
        brand: `${def.brand} · ${def.styleNote}`,
        classification: def.classification,
        sizeMl: def.sizeMl,
        barcode: def.barcode,
        sellingPrice: def.sellingPrice,
        active: true,
      },
      create: {
        tenantId,
        inventoryItemId: item.id,
        sku: def.sku,
        name: def.name,
        brand: `${def.brand} · ${def.styleNote}`,
        classification: def.classification,
        sizeMl: def.sizeMl,
        barcode: def.barcode,
        sellingPrice: def.sellingPrice,
        active: true,
      },
    });
    products.push({
      id: product.id,
      sku: def.sku,
      inventoryItemId: item.id,
      classification: def.classification,
      sellingPrice: def.sellingPrice,
      name: def.name,
      costHint: def.cost,
    });
    openings.push({ itemId: item.id, qty: def.openingQty, cost: def.cost, unit: "PCS", code: def.sku });
  }
}

async function seedOils(
  prisma: PrismaClient,
  tenantId: string,
  defs: OilDef[],
  openings: CatalogIds["openings"],
  oils: CatalogIds["oils"],
) {
  for (const def of defs) {
    const item = await upsertItem(prisma, tenantId, def.code, def.name, "OIL", "L", "ML", def.lowStockThreshold);
    const oil = await prisma.oil.upsert({
      where: { tenantId_code: { tenantId, code: def.code } },
      update: { name: def.name, pricingTier: def.pricingTier, active: true },
      create: {
        tenantId,
        inventoryItemId: item.id,
        code: def.code,
        name: def.name,
        pricingTier: def.pricingTier,
        active: true,
      },
    });
    oils.push({
      id: oil.id,
      code: def.code,
      inventoryItemId: item.id,
      name: def.name,
      costPerMl: def.costPerMl,
    });
    openings.push({ itemId: item.id, qty: def.openingQty, cost: def.costPerMl, unit: "ML", code: def.code });
  }
}

export async function seedCatalog(prisma: PrismaClient, tenantId: string): Promise<CatalogIds> {
  const openings: CatalogIds["openings"] = [];
  const products: CatalogIds["products"] = [];
  const oils: CatalogIds["oils"] = [];
  const bottles: CatalogIds["bottles"] = [];
  const packaging: CatalogIds["packaging"] = [];

  // Components first (pump needed for bottles)
  const componentRows: Record<string, { id: string; inventoryItemId: string; cost: number; kind: ComponentDef["kind"] }> = {};
  for (const def of COMPONENTS) {
    const item = await upsertItem(
      prisma,
      tenantId,
      def.code,
      def.name,
      def.kind,
      def.purchaseUnit,
      def.stockUnit,
      def.lowStockThreshold,
    );
    openings.push({ itemId: item.id, qty: def.openingQty, cost: def.cost, unit: def.stockUnit, code: def.code });

    if (def.kind === "ALCOHOL") {
      const row = await prisma.alcohol.upsert({
        where: { tenantId_code: { tenantId, code: def.code } },
        update: { name: def.name, active: true },
        create: { tenantId, inventoryItemId: item.id, code: def.code, name: def.name, active: true },
      });
      componentRows[def.code] = { id: row.id, inventoryItemId: item.id, cost: def.cost, kind: def.kind };
    } else if (def.kind === "STABILIZER") {
      const row = await prisma.stabilizer.upsert({
        where: { tenantId_code: { tenantId, code: def.code } },
        update: { name: def.name, active: true },
        create: { tenantId, inventoryItemId: item.id, code: def.code, name: def.name, active: true },
      });
      componentRows[def.code] = { id: row.id, inventoryItemId: item.id, cost: def.cost, kind: def.kind };
    } else {
      const row = await prisma.pump.upsert({
        where: { tenantId_code: { tenantId, code: def.code } },
        update: { name: def.name, active: true },
        create: { tenantId, inventoryItemId: item.id, code: def.code, name: def.name, active: true },
      });
      componentRows[def.code] = { id: row.id, inventoryItemId: item.id, cost: def.cost, kind: def.kind };
    }
  }

  const primaryPump = componentRows["PM-A"] ?? componentRows["PMP-A"]!;
  const primaryAlcohol = componentRows["CO-01"] ?? componentRows["ALC-01"]!;
  const primaryStabilizer = componentRows["ST-01"] ?? componentRows["STB-01"]!;

  for (const def of BOTTLES) {
    await seedBottle(prisma, tenantId, def, primaryPump.id, openings, bottles);
  }

  for (const def of PACKAGING) {
    await seedPackaging(prisma, tenantId, def, openings, packaging);
  }

  await seedOils(prisma, tenantId, [...LEGACY_OILS, ...OILS], openings, oils);
  await seedReadyMade(prisma, tenantId, [...LEGACY_READY_MADE_REMAP, ...READY_MADE], openings, products);

  return {
    products,
    oils,
    bottles,
    packaging,
    alcohol: { id: primaryAlcohol.id, inventoryItemId: primaryAlcohol.inventoryItemId, cost: primaryAlcohol.cost },
    stabilizer: { id: primaryStabilizer.id, inventoryItemId: primaryStabilizer.inventoryItemId, cost: primaryStabilizer.cost },
    pump: { id: primaryPump.id, inventoryItemId: primaryPump.inventoryItemId, cost: primaryPump.cost },
    openings,
  };
}

async function seedBottle(
  prisma: PrismaClient,
  tenantId: string,
  def: BottleDef,
  pumpId: string,
  openings: CatalogIds["openings"],
  bottles: CatalogIds["bottles"],
) {
  const name = `${def.design} ${def.sizeMl} مل`;
  const item = await upsertItem(prisma, tenantId, def.code, name, "BOTTLE", "PCS", "PCS", def.lowStockThreshold);
  const bottle = await prisma.bottle.upsert({
    where: { tenantId_code: { tenantId, code: def.code } },
    update: { design: def.design, sizeMl: def.sizeMl, pumpId, active: true },
    create: {
      tenantId,
      inventoryItemId: item.id,
      code: def.code,
      design: def.design,
      sizeMl: def.sizeMl,
      pumpId,
      active: true,
    },
  });
  bottles.push({
    id: bottle.id,
    code: def.code,
    inventoryItemId: item.id,
    sizeMl: def.sizeMl,
    pumpId,
    cost: def.cost,
  });
  openings.push({ itemId: item.id, qty: def.openingQty, cost: def.cost, unit: "PCS", code: def.code });
}

async function seedPackaging(
  prisma: PrismaClient,
  tenantId: string,
  def: PackagingDef,
  openings: CatalogIds["openings"],
  packaging: CatalogIds["packaging"],
) {
  const item = await upsertItem(prisma, tenantId, def.code, def.name, "PACKAGING", "PCS", "PCS", def.lowStockThreshold);
  const row = await prisma.packagingItem.upsert({
    where: { tenantId_code: { tenantId, code: def.code } },
    update: { name: def.name, type: def.type, active: true },
    create: {
      tenantId,
      inventoryItemId: item.id,
      code: def.code,
      name: def.name,
      type: def.type,
      active: true,
    },
  });
  packaging.push({ id: row.id, code: def.code, inventoryItemId: item.id, cost: def.cost });
  openings.push({ itemId: item.id, qty: def.openingQty, cost: def.cost, unit: "PCS", code: def.code });
}
