import assert from "node:assert/strict";
import test from "node:test";
import { maxPosLineQty, type PosStockCatalog } from "./pos-stock";
import type { PosLine } from "./pos-store";

function catalog(over: Partial<PosStockCatalog> = {}): PosStockCatalog {
  return {
    products: [{ id: "p1", inventoryItemId: "inv-sauvage" }],
    oils: [{ id: "o1", inventoryItemId: "inv-oil" }],
    bottles: [{ id: "b1", inventoryItemId: "inv-bottle", sizeMl: 50, pump: { id: "pump1", inventoryItemId: "inv-pump" } }],
    alcohols: [{ id: "a1", inventoryItemId: "inv-alc", active: true }],
    stabilizers: [{ id: "s1", inventoryItemId: "inv-stab" }],
    packaging: [{ id: "pack1", inventoryItemId: "inv-pack" }],
    ...over,
  };
}

function ready(over: Partial<Extract<PosLine, { lineType: "ORIGINAL" }>> = {}): PosLine {
  return {
    key: "ready-1",
    lineType: "ORIGINAL",
    label: "Sauvage",
    qty: 1,
    unitPrice: 100,
    productId: "p1",
    ...over,
  };
}

function custom(over: Partial<Extract<PosLine, { lineType: "CUSTOMIZED" }>> = {}): PosLine {
  return {
    key: "custom-1",
    lineType: "CUSTOMIZED",
    label: "ROGE",
    qty: 1,
    unitPrice: 50,
    payload: {
      oilId: "o1",
      concentrationId: "c1",
      bottleId: "b1",
      oilActualQtyMl: 10,
      customerSuppliedBottle: false,
    },
    ...over,
  };
}

test("does not cap until inventory has loaded", () => {
  assert.equal(
    maxPosLineQty({ inventory: undefined, catalog: catalog(), lines: [ready()], lineKey: "ready-1" }),
    undefined,
  );
});

test("caps ready-made at on-hand for that product", () => {
  assert.equal(
    maxPosLineQty({
      inventory: [{ itemId: "inv-sauvage", onHand: 12 }],
      catalog: catalog(),
      lines: [ready()],
      lineKey: "ready-1",
    }),
    12,
  );
});

test("reserves the same SKU already on other cart lines", () => {
  assert.equal(
    maxPosLineQty({
      inventory: [{ itemId: "inv-sauvage", onHand: 5 }],
      catalog: catalog(),
      lines: [ready(), ready({ key: "ready-2", qty: 2 })],
      lineKey: "ready-1",
    }),
    3,
  );
});

test("customized max is the component bottleneck", () => {
  assert.equal(
    maxPosLineQty({
      inventory: [
        { itemId: "inv-oil", onHand: 25 },
        { itemId: "inv-alc", onHand: 1000 },
        { itemId: "inv-bottle", onHand: 80 },
        { itemId: "inv-pump", onHand: 80 },
      ],
      catalog: catalog(),
      lines: [custom()],
      lineKey: "custom-1",
    }),
    2,
  );
});

test("customized max accounts for other customized lines sharing oil", () => {
  assert.equal(
    maxPosLineQty({
      inventory: [
        { itemId: "inv-oil", onHand: 30 },
        { itemId: "inv-alc", onHand: 1000 },
        { itemId: "inv-bottle", onHand: 80 },
        { itemId: "inv-pump", onHand: 80 },
      ],
      catalog: catalog(),
      lines: [custom({ qty: 1 }), custom({ key: "custom-2", qty: 1 })],
      lineKey: "custom-1",
    }),
    2,
  );
});

test("zero on-hand yields a max of 0", () => {
  assert.equal(
    maxPosLineQty({
      inventory: [{ itemId: "inv-sauvage", onHand: 0 }],
      catalog: catalog(),
      lines: [ready()],
      lineKey: "ready-1",
    }),
    0,
  );
});
