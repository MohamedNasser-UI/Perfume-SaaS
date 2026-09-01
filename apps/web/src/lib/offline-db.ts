import Dexie, { type Table } from "dexie";

export type AuthorizedUser = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: "PLATFORM_ADMIN" | "OWNER" | "STAFF";
  outletIds: string[];
  staffPages?: string[];
  seeItemCost?: boolean;
  verifier: string;
  salt: string;
  params: { iterations: number; memorySize: number; parallelism: number; hashLength: number };
  authorizedAt: string;
  active: boolean;
};

export type OfflineSession = {
  mode: "offline" | "online";
  userId: string;
  tenantId: string;
  deviceId: string;
  role: AuthorizedUser["role"];
  email: string;
  displayName: string;
  outletIds: string[];
  createdAt: string;
  licenseId: string;
};

export type OutboxItem = {
  localId: string;
  deviceId: string;
  userId: string;
  type: string;
  path: string;
  method: string;
  payload: unknown;
  createdAt: string;
  status: "pending" | "syncing" | "applied" | "rejected";
  error?: string;
  serverId?: string;
  outletId?: string;
};

export type ClockState = {
  lastServerTime: string;
  lastLocalNow: number;
  durationHours: number;
};

class OfflineDB extends Dexie {
  kv!: Table<{ key: string; value: unknown }, string>;
  users!: Table<AuthorizedUser, string>;
  outbox!: Table<OutboxItem, string>;
  cache!: Table<{ path: string; body: unknown; updatedAt: string }, string>;

  constructor() {
    super("perfume-offline");
    this.version(1).stores({
      kv: "key",
      users: "userId, tenantId, email",
      outbox: "localId, status, type, createdAt",
      cache: "path",
    });
  }
}

export const offlineDb = new OfflineDB();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await offlineDb.kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown) {
  await offlineDb.kv.put({ key, value });
}

export async function kvDelete(key: string) {
  await offlineDb.kv.delete(key);
}
