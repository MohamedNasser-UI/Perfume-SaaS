import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_PURCHASE_FILTER,
  filterPurchases,
  hasPurchaseFilter,
  type FilterablePurchase,
  type PurchaseFilter,
} from "./purchase-filter";

function filter(over: Partial<PurchaseFilter> = {}): PurchaseFilter {
  return { ...EMPTY_PURCHASE_FILTER, ...over };
}

const invoices: FilterablePurchase[] = [
  {
    invoiceDate: "2026-01-10T00:00:00.000Z",
    supplierId: "sup-a",
    lines: [{ itemId: "item-oud" }, { itemId: "item-bottle" }],
  },
  {
    invoiceDate: "2026-02-20T00:00:00.000Z",
    supplierId: "sup-b",
    lines: [{ itemId: "item-bottle" }],
  },
  {
    invoiceDate: "2026-03-05T00:00:00.000Z",
    supplier: { id: "sup-a" },
    lines: [{ itemId: "item-alcohol" }],
  },
];

test("no filter keeps every invoice", () => {
  assert.equal(filterPurchases(invoices, filter()).length, 3);
  assert.equal(hasPurchaseFilter(filter()), false);
});

test("date range is inclusive on both ends", () => {
  const onFrom = filterPurchases(invoices, filter({ dateFrom: "2026-02-20" }));
  assert.deepEqual(onFrom.map((i) => i.supplierId ?? i.supplier?.id), ["sup-b", "sup-a"]);

  const onTo = filterPurchases(invoices, filter({ dateTo: "2026-01-10" }));
  assert.equal(onTo.length, 1);

  const between = filterPurchases(invoices, filter({ dateFrom: "2026-02-01", dateTo: "2026-02-28" }));
  assert.equal(between.length, 1);
  assert.equal(between[0]!.supplierId, "sup-b");
});

test("supplier matches whether the id is flat or nested", () => {
  const bySupplier = filterPurchases(invoices, filter({ supplierId: "sup-a" }));
  assert.equal(bySupplier.length, 2);
});

test("item matches any line on the invoice", () => {
  assert.equal(filterPurchases(invoices, filter({ itemId: "item-bottle" })).length, 2);
  assert.equal(filterPurchases(invoices, filter({ itemId: "item-oud" })).length, 1);
  assert.equal(filterPurchases(invoices, filter({ itemId: "missing" })).length, 0);
});

test("filled fields combine with AND", () => {
  const both = filterPurchases(invoices, filter({ supplierId: "sup-a", itemId: "item-bottle" }));
  assert.equal(both.length, 1);
  assert.equal(both[0]!.supplierId, "sup-a");

  const conflicting = filterPurchases(invoices, filter({ supplierId: "sup-b", itemId: "item-oud" }));
  assert.equal(conflicting.length, 0);

  const all = filterPurchases(
    invoices,
    filter({ dateFrom: "2026-01-01", dateTo: "2026-01-31", supplierId: "sup-a", itemId: "item-oud" }),
  );
  assert.equal(all.length, 1);
});

test("hasPurchaseFilter detects any single filled field", () => {
  assert.equal(hasPurchaseFilter(filter({ dateFrom: "2026-01-01" })), true);
  assert.equal(hasPurchaseFilter(filter({ itemId: "item-oud" })), true);
});
