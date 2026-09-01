import { createSign, createVerify, createPublicKey, createPrivateKey, KeyObject } from "crypto";

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

/** Stable JSON used for ECDSA signatures. Key order must match the web verifier. */
export function canonicalLicenseJson(payload: LicensePayload): string {
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

export function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

export function signLicense(payload: LicensePayload, privateKeyPem: string): SignedLicense {
  const key = createPrivateKey(normalizePem(privateKeyPem));
  const signer = createSign("SHA256");
  signer.update(canonicalLicenseJson(payload));
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64");
  return { payload, signature };
}

export function verifyLicense(license: SignedLicense, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(normalizePem(publicKeyPem));
    const verifier = createVerify("SHA256");
    verifier.update(canonicalLicenseJson(license.payload));
    verifier.end();
    return verifier.verify({ key, dsaEncoding: "ieee-p1363" }, Buffer.from(license.signature, "base64"));
  } catch {
    return false;
  }
}

export function loadKeyObjects(privateKeyPem: string, publicKeyPem: string): { privateKey: KeyObject; publicKey: KeyObject } {
  return {
    privateKey: createPrivateKey(normalizePem(privateKeyPem)),
    publicKey: createPublicKey(normalizePem(publicKeyPem)),
  };
}

/**
 * Clock-rollback rule: a jump backward must not extend the lease.
 * Evaluate expiry against max(now, lastObservedLocal) and min(expiresAt, serverTime + duration).
 */
export function evaluateLicenseClock(input: {
  expiresAt: string;
  serverTime: string;
  durationMs: number;
  nowMs: number;
  lastLocalNowMs: number;
}): { valid: boolean; evalTimeMs: number; effectiveExpiryMs: number; clockRollback: boolean } {
  const expiresAtMs = Date.parse(input.expiresAt);
  const serverTimeMs = Date.parse(input.serverTime);
  const hardExpiryMs = Number.isFinite(serverTimeMs) ? serverTimeMs + input.durationMs : expiresAtMs;
  const effectiveExpiryMs = Math.min(
    Number.isFinite(expiresAtMs) ? expiresAtMs : hardExpiryMs,
    Number.isFinite(hardExpiryMs) ? hardExpiryMs : expiresAtMs,
  );
  const clockRollback = input.nowMs < input.lastLocalNowMs;
  const evalTimeMs = Math.max(input.nowMs, input.lastLocalNowMs);
  return {
    valid: Number.isFinite(effectiveExpiryMs) && evalTimeMs < effectiveExpiryMs,
    evalTimeMs,
    effectiveExpiryMs,
    clockRollback,
  };
}
