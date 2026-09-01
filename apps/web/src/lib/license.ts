import { evaluateLicenseClock } from "./clock";
import { getOrCreateDeviceId } from "./device";
import { kvGet, kvSet, type ClockState } from "./offline-db";

export type LicensePayload = {
  licenseId: string;
  tenantId: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  subscriptionStatus: "active" | "suspended";
  licenseVersion: number;
  serverTime: string;
};

export type SignedLicense = {
  payload: LicensePayload;
  signature: string;
};

export type LicenseCheck =
  | { ok: true; license: SignedLicense }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "device" | "tenant" | "suspended" };

function canonicalLicenseJson(payload: LicensePayload): string {
  const ordered: LicensePayload = {
    deviceId: payload.deviceId,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    licenseId: payload.licenseId,
    licenseVersion: payload.licenseVersion,
    serverTime: payload.serverTime,
    subscriptionStatus: payload.subscriptionStatus,
    tenantId: payload.tenantId,
  };
  return JSON.stringify(ordered);
}

function pemToSpki(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function publicKeyPem() {
  return (import.meta.env.VITE_LICENSE_PUBLIC_KEY ?? "").replace(/\\n/g, "\n").trim();
}

async function importPublicKey() {
  const pem = publicKeyPem();
  if (!pem) throw new Error("VITE_LICENSE_PUBLIC_KEY is not configured");
  return crypto.subtle.importKey("spki", pemToSpki(pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

export async function verifyLicenseSignature(license: SignedLicense): Promise<boolean> {
  try {
    const key = await importPublicKey();
    const data = new TextEncoder().encode(canonicalLicenseJson(license.payload));
    const sig = Uint8Array.from(atob(license.signature), (c) => c.charCodeAt(0));
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, data);
  } catch {
    return false;
  }
}

export async function storeLicense(license: SignedLicense) {
  await kvSet("license", license);
  const clock = (await kvGet<ClockState>("clock")) ?? {
    lastServerTime: license.payload.serverTime,
    lastLocalNow: Date.now(),
    durationHours: 168,
  };
  clock.lastServerTime = license.payload.serverTime;
  clock.lastLocalNow = Math.max(clock.lastLocalNow, Date.now());
  await kvSet("clock", clock);
}

export async function loadLicense() {
  return kvGet<SignedLicense>("license");
}

export async function checkLicense(opts?: { tenantId?: string; deviceId?: string }): Promise<LicenseCheck> {
  const license = await loadLicense();
  if (!license) return { ok: false, reason: "missing" };
  const deviceId = opts?.deviceId ?? (await getOrCreateDeviceId());
  if (license.payload.deviceId !== deviceId) return { ok: false, reason: "device" };
  if (opts?.tenantId && license.payload.tenantId !== opts.tenantId) return { ok: false, reason: "tenant" };
  if (license.payload.subscriptionStatus !== "active") return { ok: false, reason: "suspended" };
  const signed = await verifyLicenseSignature(license);
  if (!signed) return { ok: false, reason: "invalid" };

  const clock = (await kvGet<ClockState>("clock")) ?? {
    lastServerTime: license.payload.serverTime,
    lastLocalNow: 0,
    durationHours: 168,
  };
  const durationMs = Math.max(1, clock.durationHours) * 60 * 60 * 1000;
  const nowMs = Date.now();
  const evalResult = evaluateLicenseClock({
    expiresAt: license.payload.expiresAt,
    serverTime: license.payload.serverTime,
    durationMs,
    nowMs,
    lastLocalNowMs: clock.lastLocalNow,
  });
  await kvSet("clock", {
    ...clock,
    lastLocalNow: evalResult.clockRollback ? clock.lastLocalNow : Math.max(clock.lastLocalNow, nowMs),
  });
  if (!evalResult.valid) return { ok: false, reason: "expired" };
  return { ok: true, license };
}
