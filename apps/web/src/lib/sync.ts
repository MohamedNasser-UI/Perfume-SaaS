import { liveApi, ApiError } from "./http";
import { getOrCreateDeviceId, rotateDeviceId } from "./device";
import { storeLicense, type SignedLicense } from "./license";
import { withOtherBusinessRetry } from "./license-recovery";
import { offlineDb, type OutboxItem } from "./offline-db";
import { loadSession } from "./offline-auth";
import { getCache, setCache } from "./offline-pricing";

export type Snapshot = {
  serverTime: string;
  oils: unknown[];
  alcohols: unknown[];
  stabilizers: unknown[];
  bottles: unknown[];
  pumps: unknown[];
  packaging: unknown[];
  products: unknown[];
  others: unknown[];
  settings: unknown;
  customers: unknown[];
  suppliers: unknown[];
  inventory: unknown[];
  finished: unknown[];
  sales: unknown[];
  purchases: unknown[];
  waste: unknown[];
  adjustments: unknown[];
  items: unknown[];
  outlets: unknown[];
};

export async function applySnapshot(snapshot: Snapshot) {
  await Promise.all([
    setCache("/snapshot", snapshot),
    setCache("/oils", snapshot.oils),
    setCache("/alcohols", snapshot.alcohols),
    setCache("/stabilizers", snapshot.stabilizers),
    setCache("/bottles", snapshot.bottles),
    setCache("/pumps", snapshot.pumps),
    setCache("/packaging", snapshot.packaging),
    setCache("/products", snapshot.products),
    setCache("/others", snapshot.others ?? []),
    setCache("/settings", snapshot.settings),
    setCache("/customers", snapshot.customers),
    setCache("/suppliers", snapshot.suppliers),
    setCache("/inventory", snapshot.inventory),
    setCache("/finished-customized", snapshot.finished),
    setCache("/sales", snapshot.sales),
    setCache("/purchases", snapshot.purchases),
    setCache("/inventory/waste", snapshot.waste),
    setCache("/inventory/adjustments", snapshot.adjustments),
    setCache("/catalog/items", snapshot.items),
    setCache("/outlets", snapshot.outlets),
  ]);
}

export async function pullSnapshot() {
  const snapshot = await liveApi<Snapshot>("/sync/snapshot");
  await applySnapshot(snapshot);
  return snapshot;
}

export async function renewLicense() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return withOtherBusinessRetry(
    async () => {
      const deviceId = await getOrCreateDeviceId();
      const data = await liveApi<{ license: SignedLicense }>("/devices/license", {
        method: "POST",
        body: JSON.stringify({ deviceId, deviceLabel: navigator.userAgent.slice(0, 80) }),
      });
      if (data.license) await storeLicense(data.license);
      return data.license;
    },
    () => rotateDeviceId(),
  );
}

export async function enqueueMutation(item: Omit<OutboxItem, "status" | "createdAt"> & { createdAt?: string }) {
  const row: OutboxItem = {
    ...item,
    status: "pending",
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
  await offlineDb.outbox.put(row);
  return row;
}

export async function pendingOutbox() {
  return offlineDb.outbox.where("status").equals("pending").toArray();
}

export async function flushOutbox() {
  const token = localStorage.getItem("token");
  if (!token || !navigator.onLine) return [];
  const pending = await pendingOutbox();
  if (!pending.length) {
    await pullSnapshot().catch(() => undefined);
    return [];
  }
  const deviceId = await getOrCreateDeviceId();
  const session = await loadSession();
  for (const row of pending) {
    await offlineDb.outbox.update(row.localId, { status: "syncing" });
  }
  try {
    const result = await liveApi<{
      results: { localId: string; status: string; serverId?: string; error?: string }[];
    }>("/sync/push", {
      method: "POST",
      body: JSON.stringify({
        deviceId,
        operations: pending.map((p) => ({
          localId: p.localId,
          type: p.type,
          payload: p.payload,
          createdAt: p.createdAt,
          userId: p.userId || session?.userId,
          outletId: p.outletId,
        })),
      }),
    });
    for (const item of result.results) {
      await offlineDb.outbox.update(item.localId, {
        status: item.status === "REJECTED" ? "rejected" : "applied",
        serverId: item.serverId,
        error: item.error,
      });
    }
    await pullSnapshot().catch(() => undefined);
    return result.results;
  } catch (err) {
    for (const row of pending) {
      await offlineDb.outbox.update(row.localId, { status: "pending" });
    }
    if (err instanceof ApiError) throw err;
    throw err;
  }
}

export function mutationTypeFor(method: string, path: string): string | null {
  const [base, id] = splitPath(path);
  if (method === "POST" && base === "/sales") return "SALE";
  if (method === "POST" && base === "/customers") return "CUSTOMER";
  if (method === "POST" && base === "/purchases") return "PURCHASE";
  if (method === "POST" && base === "/returns") return "RETURN";
  if (method === "POST" && path === "/inventory/waste") return "WASTE";
  if (method === "POST" && path === "/inventory/adjustments") return "ADJUSTMENT";
  if (method === "POST" && base === "/oils") return "OIL_CREATE";
  if (method === "PATCH" && base === "/oils" && id) return "OIL_UPDATE";
  if (method === "DELETE" && base === "/oils" && id) return "OIL_DELETE";
  if (method === "POST" && base === "/bottles") return "BOTTLE_CREATE";
  if (method === "PATCH" && base === "/bottles" && id) return "BOTTLE_UPDATE";
  if (method === "DELETE" && base === "/bottles" && id) return "BOTTLE_DELETE";
  if (method === "POST" && base === "/alcohols") return "ALCOHOL_CREATE";
  if (method === "PATCH" && base === "/alcohols" && id) return "ALCOHOL_UPDATE";
  if (method === "DELETE" && base === "/alcohols" && id) return "ALCOHOL_DELETE";
  if (method === "POST" && base === "/stabilizers") return "STABILIZER_CREATE";
  if (method === "PATCH" && base === "/stabilizers" && id) return "STABILIZER_UPDATE";
  if (method === "DELETE" && base === "/stabilizers" && id) return "STABILIZER_DELETE";
  if (method === "POST" && base === "/pumps") return "PUMP_CREATE";
  if (method === "PATCH" && base === "/pumps" && id) return "PUMP_UPDATE";
  if (method === "DELETE" && base === "/pumps" && id) return "PUMP_DELETE";
  if (method === "POST" && base === "/packaging") return "PACKAGING_CREATE";
  if (method === "PATCH" && base === "/packaging" && id) return "PACKAGING_UPDATE";
  if (method === "DELETE" && base === "/packaging" && id) return "PACKAGING_DELETE";
  if (method === "POST" && base === "/products") return "PRODUCT_CREATE";
  if (method === "PATCH" && base === "/products" && id) return "PRODUCT_UPDATE";
  if (method === "DELETE" && base === "/products" && id) return "PRODUCT_DELETE";
  if (method === "POST" && base === "/others") return "OTHER_CREATE";
  if (method === "PATCH" && base === "/others" && id) return "OTHER_UPDATE";
  if (method === "DELETE" && base === "/others" && id) return "OTHER_DELETE";
  if (method === "POST" && path === "/settings/concentrations") return "CONCENTRATION_CREATE";
  if (method === "PATCH" && path.startsWith("/settings/concentrations/")) return "CONCENTRATION_UPDATE";
  if (method === "POST" && path === "/settings/discounts") return "DISCOUNT_CREATE";
  if (method === "PATCH" && path.startsWith("/settings/discounts/")) return "DISCOUNT_UPDATE";
  if (method === "POST" && path === "/settings/payment-methods") return "PAYMENT_METHOD_CREATE";
  if (method === "POST" && base === "/suppliers") return "SUPPLIER_CREATE";
  return null;
}

function splitPath(path: string) {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 1) return [`/${parts[0]}`, ""] as const;
  if (parts.length >= 2) return [`/${parts[0]}`, parts[1]] as const;
  return [clean, ""] as const;
}

export async function readOfflineGet(path: string): Promise<unknown | undefined> {
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search ?? "");

  if (pathname === "/customers/suggest") {
    const digits = (params.get("mobile") ?? "").replace(/\D/g, "");
    if (digits.length < 3) return [];
    const customers = (await getCache<{ id: string; name: string; mobile: string }[]>("/customers")) ?? [];
    return customers.filter((c) => c.mobile.replace(/\D/g, "").startsWith(digits) || c.mobile.includes(digits)).slice(0, 8);
  }
  if (pathname === "/customers/search") {
    const mobile = (params.get("mobile") ?? "").replace(/\D/g, "");
    const customers = (await getCache<{ id: string; name: string; mobile: string }[]>("/customers")) ?? [];
    return customers.find((c) => c.mobile.replace(/\D/g, "").endsWith(mobile) || c.mobile.replace(/\D/g, "") === mobile) ?? null;
  }
  if (pathname.startsWith("/products/barcode/")) {
    const barcode = decodeURIComponent(pathname.slice("/products/barcode/".length));
    const products = (await getCache<{ barcode?: string }[]>("/products")) ?? [];
    return products.find((p) => p.barcode === barcode) ?? null;
  }
  if (pathname.startsWith("/customers/") && pathname !== "/customers") {
    const id = pathname.slice("/customers/".length);
    const customers = (await getCache<any[]>("/customers")) ?? [];
    return customers.find((c) => c.id === id);
  }
  if (pathname.startsWith("/sales/") && pathname !== "/sales") {
    const id = pathname.slice("/sales/".length);
    const sales = (await getCache<any[]>("/sales")) ?? [];
    const pending = (await offlineDb.outbox.where("type").equals("SALE").toArray()).filter((o) => o.status === "pending");
    return sales.find((s) => s.id === id) ?? pending.find((p) => p.localId === id)?.payload;
  }
  if (pathname === "/sales") {
    const sales = (await getCache<any[]>("/sales")) ?? [];
    const pending = await offlineDb.outbox.where("type").equals("SALE").toArray();
    const extras = pending
      .filter((p) => p.status === "pending" || p.status === "syncing")
      .map((p) => ({
        id: p.localId,
        orderNumber: `OFF-${p.localId.slice(0, 8)}`,
        pending: true,
        createdAt: p.createdAt,
        ...(p.payload as object),
      }));
    return [...extras, ...sales];
  }

  return getCache(pathname);
}

export async function writeThroughCache(method: string, path: string, payload: unknown, localId: string) {
  if (method === "POST" && path === "/customers" && payload && typeof payload === "object") {
    const body = payload as { id?: string; name: string; mobile: string };
    const id = body.id ?? localId;
    const customers = (await getCache<any[]>("/customers")) ?? [];
    await setCache("/customers", [{ id, ...body }, ...customers.filter((c) => c.id !== id)]);
    return { id, ...body };
  }
  if (method === "POST" && path === "/sales") {
    return { id: localId, orderNumber: `OFF-${localId.slice(0, 8)}`, pending: true };
  }
  return { id: localId, pending: true };
}
