import { offlineDb } from "./offline-db";

type SnapshotInventory = {
  itemId: string;
  name: string;
  onHand: number;
  unit: string;
  averageCost: number;
};

export async function previewCustomizedLocal(payload: {
  oilId: string;
  oils?: { oilId: string; qtyMl: number }[];
  concentrationId: string;
  bottleId: string;
  oilActualQtyMl: number;
  stabilizerId?: string;
  stabilizerQtyMl?: number;
  packagingId?: string;
  customerSuppliedBottle?: boolean;
}) {
  const oils = (await getCache<any[]>("/oils")) ?? [];
  const bottles = (await getCache<any[]>("/bottles")) ?? [];
  const alcohols = (await getCache<any[]>("/alcohols")) ?? [];
  const stabilizers = (await getCache<any[]>("/stabilizers")) ?? [];
  const packaging = (await getCache<any[]>("/packaging")) ?? [];
  const settings = await getCache<any>("/settings");
  const inventory = (await getCache<SnapshotInventory[]>("/inventory")) ?? [];

  const mix = payload.oils?.length
    ? payload.oils
    : [{ oilId: payload.oilId, qtyMl: payload.oilActualQtyMl }];
  const mixRows = mix.map((part) => {
    const oil = oils.find((o) => o.id === part.oilId);
    if (!oil) throw new Error("Catalog snapshot is incomplete. Connect to the internet once to refresh.");
    return { oil, qtyMl: Number(part.qtyMl) };
  });
  const bottle = bottles.find((b) => b.id === payload.bottleId);
  const concentration = (settings?.concentrations ?? []).find((c: any) => c.id === payload.concentrationId && c.active !== false);
  const alcohol = alcohols.find((a) => a.active !== false) ?? alcohols[0];
  if (!mixRows.length || !bottle || !concentration || !alcohol) {
    throw new Error("Catalog snapshot is incomplete. Connect to the internet once to refresh.");
  }

  const oilStandard = Number(bottle.sizeMl) * Number(concentration.oilPercentage) / 100;
  const oilActual = mixRows.reduce((sum, part) => sum + part.qtyMl, 0);
  const stabilizerQty = Number(payload.stabilizerQtyMl ?? 0);
  const alcoholQty = Number(bottle.sizeMl) - oilActual - stabilizerQty;
  if (alcoholQty < 0) throw new Error("Oil + stabilizer + alcohol cannot exceed bottle size");

  const stabilizer = payload.stabilizerId ? stabilizers.find((s) => s.id === payload.stabilizerId) : null;
  const pack = payload.packagingId ? packaging.find((p) => p.id === payload.packagingId) : null;
  const costOf = (itemId: string, qty: number) => {
    const row = inventory.find((i) => i.itemId === itemId);
    return (row?.averageCost ?? 0) * qty;
  };

  const components: { itemId: string; quantity: number; unit: "ML" | "PCS"; itemName: string }[] = [];
  const alcoholItemId = alcohol.inventoryItemId ?? alcohol.inventoryItem?.id;
  const bottleItemId = bottle.inventoryItemId ?? bottle.inventoryItem?.id;
  for (const part of mixRows) {
    const oilItemId = part.oil.inventoryItemId ?? part.oil.inventoryItem?.id;
    if (oilItemId) components.push({ itemId: oilItemId, quantity: part.qtyMl, unit: "ML", itemName: part.oil.name });
  }
  if (alcoholItemId) components.push({ itemId: alcoholItemId, quantity: alcoholQty, unit: "ML", itemName: alcohol.name });
  if (stabilizer) {
    const id = stabilizer.inventoryItemId ?? stabilizer.inventoryItem?.id;
    if (id) components.push({ itemId: id, quantity: stabilizerQty, unit: "ML", itemName: stabilizer.name });
  }
  if (!payload.customerSuppliedBottle && bottleItemId) {
    components.push({ itemId: bottleItemId, quantity: 1, unit: "PCS", itemName: bottle.design });
    const pump = bottle.pump;
    const pumpItemId = pump?.inventoryItemId ?? pump?.inventoryItem?.id;
    if (pumpItemId) components.push({ itemId: pumpItemId, quantity: 1, unit: "PCS", itemName: pump.name });
  }
  if (pack) {
    const id = pack.inventoryItemId ?? pack.inventoryItem?.id;
    if (id) components.push({ itemId: id, quantity: 1, unit: "PCS", itemName: pack.name });
  }

  let materialCost = 0;
  const shortages: { itemName: string; shortage: number; unit: string }[] = [];
  for (const c of components) {
    materialCost += costOf(c.itemId, c.quantity);
    const row = inventory.find((i) => i.itemId === c.itemId);
    const available = row?.onHand ?? 0;
    if (available < c.quantity) {
      shortages.push({ itemName: c.itemName, shortage: c.quantity - available, unit: c.unit });
    }
  }
  const markup = Number(settings?.pricing?.markupPercentage ?? 50);
  const calculatedPrice = materialCost * (1 + markup / 100);

  return {
    oilId: mixRows[0]!.oil.id,
    oilName: mixRows.map((part) => part.oil.name).join(" + "),
    oils: mixRows.map((part) => ({ oilId: part.oil.id, oilName: part.oil.name, qtyMl: part.qtyMl })),
    concentrationId: concentration.id,
    concentrationName: concentration.name,
    bottleId: bottle.id,
    bottleDesign: bottle.design,
    bottleSizeMl: bottle.sizeMl,
    oilStandardQtyMl: oilStandard,
    oilActualQtyMl: oilActual,
    alcoholQtyMl: alcoholQty,
    stabilizerId: stabilizer?.id,
    stabilizerQtyMl: stabilizerQty,
    packagingId: pack?.id,
    customerSuppliedBottle: Boolean(payload.customerSuppliedBottle),
    materialCost: Math.round(materialCost * 100) / 100,
    calculatedPrice: Math.round(calculatedPrice * 100) / 100,
    shortages,
  };
}

export async function getCache<T>(path: string) {
  const row = await offlineDb.cache.get(path);
  return row?.body as T | undefined;
}

export async function setCache(path: string, body: unknown) {
  await offlineDb.cache.put({ path, body, updatedAt: new Date().toISOString() });
}
