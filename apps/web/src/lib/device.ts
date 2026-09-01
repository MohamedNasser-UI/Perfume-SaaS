import { kvGet, kvSet } from "./offline-db";

const KEY = "deviceId";

/** Random Device ID, persisted in IndexedDB. Never derived from IP/MAC/fingerprint. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await kvGet<string>(KEY);
  if (existing) return existing;
  return rotateDeviceId();
}

/** Replace the persisted device id. Used when this browser is rebound to another tenant. */
export async function rotateDeviceId(): Promise<string> {
  const id = `DEVICE-${crypto.randomUUID()}`;
  await kvSet(KEY, id);
  return id;
}

export function deviceLabel() {
  const ua = navigator.userAgent.slice(0, 80);
  return ua || "POS device";
}
