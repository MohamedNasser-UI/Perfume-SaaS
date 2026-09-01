import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync } from "crypto";
import {
  canonicalLicenseJson,
  evaluateLicenseClock,
  LicensePayload,
  signLicense,
  verifyLicense,
} from "./license.crypto";

function keys() {
  return generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function payload(over: Partial<LicensePayload> = {}): LicensePayload {
  return {
    licenseId: "lic-1",
    tenantId: "tenant-1",
    deviceId: "DEVICE-11111111-1111-1111-1111-111111111111",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    subscriptionStatus: "active",
    licenseVersion: 1,
    serverTime: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

test("ECDSA P-256 signature verifies with the matching public key", () => {
  const { publicKey, privateKey } = keys();
  const license = signLicense(payload(), privateKey);
  assert.equal(verifyLicense(license, publicKey), true);
});

test("tampered payload fails verification", () => {
  const { publicKey, privateKey } = keys();
  const license = signLicense(payload(), privateKey);
  license.payload.expiresAt = "2099-01-01T00:00:00.000Z";
  assert.equal(verifyLicense(license, publicKey), false);
});

test("wrong public key fails verification", () => {
  const a = keys();
  const b = keys();
  const license = signLicense(payload(), a.privateKey);
  assert.equal(verifyLicense(license, b.publicKey), false);
});

test("canonical JSON is stable regardless of object insertion order", () => {
  const a = payload();
  const b = {
    serverTime: a.serverTime,
    tenantId: a.tenantId,
    licenseVersion: a.licenseVersion,
    deviceId: a.deviceId,
    subscriptionStatus: a.subscriptionStatus,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
    licenseId: a.licenseId,
  } as LicensePayload;
  assert.equal(canonicalLicenseJson(a), canonicalLicenseJson(b));
});

test("clock rollback does not extend a still-valid lease", () => {
  const durationMs = 7 * 24 * 60 * 60 * 1000;
  const server = Date.parse("2026-01-01T00:00:00.000Z");
  const lastLocal = server + 3 * 24 * 60 * 60 * 1000;
  const rolledBack = server + 1 * 24 * 60 * 60 * 1000;
  const result = evaluateLicenseClock({
    expiresAt: "2026-01-08T00:00:00.000Z",
    serverTime: "2026-01-01T00:00:00.000Z",
    durationMs,
    nowMs: rolledBack,
    lastLocalNowMs: lastLocal,
  });
  assert.equal(result.clockRollback, true);
  assert.equal(result.evalTimeMs, lastLocal);
  assert.equal(result.valid, true);
});

test("clock rollback treats license expired if duration already elapsed", () => {
  const durationMs = 7 * 24 * 60 * 60 * 1000;
  const server = Date.parse("2026-01-01T00:00:00.000Z");
  const lastLocal = server + 8 * 24 * 60 * 60 * 1000;
  const rolledBack = server + 2 * 24 * 60 * 60 * 1000;
  const result = evaluateLicenseClock({
    expiresAt: "2099-01-01T00:00:00.000Z",
    serverTime: "2026-01-01T00:00:00.000Z",
    durationMs,
    nowMs: rolledBack,
    lastLocalNowMs: lastLocal,
  });
  assert.equal(result.clockRollback, true);
  assert.equal(result.valid, false);
});
