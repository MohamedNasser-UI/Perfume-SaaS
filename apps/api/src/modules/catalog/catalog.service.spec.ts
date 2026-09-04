import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

function oilRow() {
  return { id: "oil-1", tenantId: "t1", inventoryItemId: "item-1", code: "OIL-A", name: "A" };
}

function makePrisma(over: Record<string, unknown> = {}) {
  return {
    oil: {
      findFirst: async () => oilRow(),
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...oilRow(), ...data }),
      delete: async () => oilRow(),
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "oil-1", ...data }),
    },
    inventoryItem: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "item-1", ...data }),
      delete: async () => ({ id: "item-1" }),
    },
    inventoryBalance: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    inventoryMovement: { count: async () => 0 },
    purchaseInvoiceLine: { count: async () => 0 },
    wasteTransaction: { count: async () => 0 },
    stockAdjustment: { count: async () => 0 },
    finishedCustomizedItem: { count: async () => 0 },
    customizedConfiguration: { count: async () => 0 },
    customerPreference: { count: async () => 0 },
    ...over,
  };
}

test("createOil without a client code stores OL1 on the oil and inventory item", async () => {
  let itemCode: string | undefined;
  let oilCode: string | undefined;
  const prisma = makePrisma({
    inventoryItem: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }: { data: { code: string; name: string } }) => {
        itemCode = data.code;
        return { id: "item-1", ...data };
      },
      delete: async () => ({ id: "item-1" }),
    },
    oil: {
      findFirst: async () => oilRow(),
      create: async ({ data }: { data: { code: string; name: string; inventoryItemId: string } }) => {
        oilCode = data.code;
        return { id: "oil-1", ...data, inventoryItem: { id: data.inventoryItemId, code: data.code } };
      },
      update: async () => oilRow(),
      delete: async () => oilRow(),
    },
  });
  const catalog = new CatalogService(prisma as never);
  await catalog.createOil("t1", { name: "Musk" });
  assert.equal(itemCode, "OL1");
  assert.equal(oilCode, "OL1");
});

test("createOil skips legacy OIL-MUSK codes when assigning the next OL number", async () => {
  let itemCode: string | undefined;
  const prisma = makePrisma({
    inventoryItem: {
      findMany: async () => [{ code: "OIL-MUSK" }, { code: "OL2" }],
      findUnique: async () => null,
      create: async ({ data }: { data: { code: string } }) => {
        itemCode = data.code;
        return { id: "item-1", ...data };
      },
      delete: async () => ({ id: "item-1" }),
    },
  });
  const catalog = new CatalogService(prisma as never);
  await catalog.createOil("t1", { name: "Amber" });
  assert.equal(itemCode, "OL3");
});

test("updateOil changes the name and does not rewrite the code", async () => {
  let oilUpdate: { code?: string; name?: string; inventoryItem: { update: { code?: string; name?: string } } } | undefined;
  const prisma = makePrisma({
    oil: {
      findFirst: async () => oilRow(),
      update: async ({ data }: { data: { code?: string; name: string; inventoryItem: { update: { code?: string; name?: string } } } }) => {
        oilUpdate = data;
        return { ...oilRow(), name: data.name, inventoryItem: data.inventoryItem.update };
      },
    },
  });
  const catalog = new CatalogService(prisma as never);
  await catalog.updateOil("t1", "oil-1", { name: "Musk" });
  assert.equal(oilUpdate?.name, "Musk");
  assert.equal(oilUpdate?.code, undefined);
  assert.equal(oilUpdate?.inventoryItem.update.code, undefined);
  assert.equal(oilUpdate?.inventoryItem.update.name, "Musk");
});

test("deleteOil refuses when any outlet has stock", async () => {
  const prisma = makePrisma({
    inventoryBalance: {
      findMany: async () => [{ quantityOnHand: "12.5" }],
      deleteMany: async () => ({ count: 0 }),
    },
  });
  const catalog = new CatalogService(prisma as never);
  await assert.rejects(() => catalog.deleteOil("t1", "oil-1"), (err: unknown) => {
    assert.ok(err instanceof BadRequestException);
    const body = err.getResponse() as { code: string; message: string };
    assert.equal(body.code, "ITEM_HAS_STOCK");
    assert.match(body.message, /stock/i);
    return true;
  });
});

test("deleteOil refuses when the oil was used on a sale", async () => {
  const prisma = makePrisma({
    customizedConfiguration: { count: async () => 1 },
  });
  const catalog = new CatalogService(prisma as never);
  await assert.rejects(() => catalog.deleteOil("t1", "oil-1"), (err: unknown) => {
    assert.ok(err instanceof BadRequestException);
    const body = err.getResponse() as { code: string };
    assert.equal(body.code, "ITEM_IN_USE");
    return true;
  });
});

test("deleteOil removes an unused zero-stock oil", async () => {
  let deletedOil = false;
  let deletedItem = false;
  const prisma = makePrisma({
    oil: {
      findFirst: async () => oilRow(),
      delete: async () => {
        deletedOil = true;
        return oilRow();
      },
    },
    inventoryItem: {
      findUnique: async () => null,
      delete: async () => {
        deletedItem = true;
        return { id: "item-1" };
      },
    },
  });
  const catalog = new CatalogService(prisma as never);
  const result = await catalog.deleteOil("t1", "oil-1");
  assert.deepEqual(result, { ok: true });
  assert.equal(deletedOil, true);
  assert.equal(deletedItem, true);
});
