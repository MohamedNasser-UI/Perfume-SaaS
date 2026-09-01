/**
 * Local offline user registry.
 *
 * Honest limitation: IndexedDB can be edited in DevTools. Argon2id + a signed
 * device license blocks casual abuse; it is not unbeatable DRM. See docs/offline-security.md.
 */
import { argon2id } from "hash-wasm";
import { offlineDb, type AuthorizedUser, type OfflineSession } from "./offline-db";
import { kvDelete, kvGet, kvSet } from "./offline-db";
import { DEFAULT_STAFF_PAGES } from "./staff-pages";

export type { AuthorizedUser, OfflineSession };

export const ARGON2_PARAMS = { iterations: 3, memorySize: 4096, parallelism: 1, hashLength: 32 };

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function argon2(password: string, salt: Uint8Array, params = ARGON2_PARAMS) {
  return argon2id({
    password,
    salt,
    iterations: params.iterations,
    memorySize: params.memorySize,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    outputType: "hex",
  });
}

export async function registerAuthorizedUser(input: {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: AuthorizedUser["role"];
  outletIds: string[];
  staffPages?: string[];
  seeItemCost?: boolean;
  password: string;
}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const verifier = await argon2(input.password, salt);
  const row: AuthorizedUser = {
    userId: input.userId,
    tenantId: input.tenantId,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    role: input.role,
    outletIds: input.outletIds,
    staffPages: input.staffPages ?? (input.role === "STAFF" ? [...DEFAULT_STAFF_PAGES] : []),
    seeItemCost: input.seeItemCost ?? true,
    verifier,
    salt: bytesToHex(salt),
    params: ARGON2_PARAMS,
    authorizedAt: new Date().toISOString(),
    active: true,
  };
  await offlineDb.users.put(row);
  return row;
}

export async function listAuthorizedUsers(tenantId?: string) {
  if (tenantId) return offlineDb.users.where("tenantId").equals(tenantId).toArray();
  return offlineDb.users.toArray();
}

export async function verifyLocalPassword(user: AuthorizedUser, password: string) {
  const hash = await argon2(password, hexToBytes(user.salt), user.params);
  return timingSafeEqual(hash, user.verifier);
}

export async function findAuthorizedUser(email: string) {
  return offlineDb.users.where("email").equals(email.toLowerCase()).first();
}

export async function saveSession(session: OfflineSession) {
  await kvSet("session", session);
}

export async function loadSession() {
  return kvGet<OfflineSession>("session");
}

export async function clearSession() {
  await kvDelete("session");
}
