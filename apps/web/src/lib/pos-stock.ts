import type { PosLine } from "./pos-store";

export type InventoryOnHand = { itemId: string; onHand: number };

type ItemRef = {
  id: string;
  inventoryItemId?: string;
  inventoryItem?: { id: string };
  active?: boolean;
};

export type PosStockCatalog = {
  products: ItemRef[];
  oils: ItemRef[];
  bottles: Array<
    ItemRef & {
      sizeMl: number;
      design?: string;
      pump?: ItemRef & { name?: string };
    }
  >;
  alcohols: ItemRef[];
  stabilizers: ItemRef[];
  packaging: ItemRef[];
};

export type PosStockInput = {
  inventory: InventoryOnHand[] | undefined;
  catalog: PosStockCatalog;
  lines: PosLine[];
  lineKey: string;
};

function catalogItemId(row?: ItemRef | null) {
  return row?.inventoryItemId ?? row?.inventoryItem?.id;
}

function onHandByItem(inventory: InventoryOnHand[]) {
  const map = new Map<string, number>();
  for (const row of inventory) map.set(row.itemId, Number(row.onHand) || 0);
  return map;
}

function customizedComponentsPerBottle(line: Extract<PosLine, { lineType: "CUSTOMIZED" }>, catalog: PosStockCatalog) {
  const oil = catalog.oils.find((o) => o.id === line.payload.oilId);
  const bottle = catalog.bottles.find((b) => b.id === line.payload.bottleId);
  const alcohol = catalog.alcohols.find((a) => a.active !== false) ?? catalog.alcohols[0];
  if (!oil || !bottle || !alcohol) return null;

  const oilActual = Number(line.payload.oilActualQtyMl);
  const stabilizerQty = Number(line.payload.stabilizerQtyMl ?? 0);
  const alcoholQty = Number(bottle.sizeMl) - oilActual - stabilizerQty;
  if (alcoholQty < 0) return null;

  const components: { itemId: string; quantity: number }[] = [];
  const oilItemId = catalogItemId(oil);
  const alcoholItemId = catalogItemId(alcohol);
  const bottleItemId = catalogItemId(bottle);
  if (oilItemId) components.push({ itemId: oilItemId, quantity: oilActual });
  if (alcoholItemId) components.push({ itemId: alcoholItemId, quantity: alcoholQty });

  if (line.payload.stabilizerId) {
    const stabilizer = catalog.stabilizers.find((s) => s.id === line.payload.stabilizerId);
    const id = catalogItemId(stabilizer);
    if (id) components.push({ itemId: id, quantity: stabilizerQty });
  }

  if (!line.payload.customerSuppliedBottle && bottleItemId) {
    components.push({ itemId: bottleItemId, quantity: 1 });
    const pumpItemId = catalogItemId(bottle.pump);
    if (pumpItemId) components.push({ itemId: pumpItemId, quantity: 1 });
  }

  if (line.payload.packagingId) {
    const pack = catalog.packaging.find((p) => p.id === line.payload.packagingId);
    const id = catalogItemId(pack);
    if (id) components.push({ itemId: id, quantity: 1 });
  }

  return components;
}

function reservedByOtherLines(lines: PosLine[], exceptKey: string, catalog: PosStockCatalog) {
  const reserved = new Map<string, number>();
  const add = (itemId: string | undefined, quantity: number) => {
    if (!itemId || quantity <= 0) return;
    reserved.set(itemId, (reserved.get(itemId) ?? 0) + quantity);
  };

  for (const line of lines) {
    if (line.key === exceptKey) continue;
    if (line.lineType === "ORIGINAL" || line.lineType === "HIGH_COPY" || line.lineType === "OTHER") {
      const product = catalog.products.find((p) => p.id === line.productId);
      add(catalogItemId(product), line.qty);
    } else if (line.lineType === "CUSTOMIZED") {
      const perBottle = customizedComponentsPerBottle(line, catalog);
      if (!perBottle) continue;
      for (const c of perBottle) add(c.itemId, c.quantity * line.qty);
    }
  }
  return reserved;
}

/** Max sellable qty for a line. `undefined` means inventory is not loaded (do not cap). */
export function maxPosLineQty(input: PosStockInput): number | undefined {
  if (!input.inventory) return undefined;
  const line = input.lines.find((l) => l.key === input.lineKey);
  if (!line) return undefined;
  if (line.lineType === "FINISHED_CUSTOMIZED") return 1;

  const stock = onHandByItem(input.inventory);
  const reserved = reservedByOtherLines(input.lines, line.key, input.catalog);

  if (line.lineType === "ORIGINAL" || line.lineType === "HIGH_COPY" || line.lineType === "OTHER") {
    const product = input.catalog.products.find((p) => p.id === line.productId);
    const itemId = catalogItemId(product);
    if (!itemId) return undefined;
    return Math.max(0, Math.floor(stock.get(itemId) ?? 0) - (reserved.get(itemId) ?? 0));
  }

  const perBottle = customizedComponentsPerBottle(line, input.catalog);
  if (!perBottle?.length) return undefined;

  let max = Number.POSITIVE_INFINITY;
  for (const c of perBottle) {
    if (c.quantity <= 0) continue;
    const available = (stock.get(c.itemId) ?? 0) - (reserved.get(c.itemId) ?? 0);
    max = Math.min(max, Math.floor(available / c.quantity));
  }
  return Number.isFinite(max) ? Math.max(0, max) : undefined;
}
