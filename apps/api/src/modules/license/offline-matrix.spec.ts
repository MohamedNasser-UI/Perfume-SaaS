import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLicenseClock } from "./license.crypto";

/**
 * Automated coverage for the offline auth/license/sync matrix.
 * Cases that need a browser or a live API are documented in docs/offline-test-matrix.md.
 */
const WEEK = 7 * 24 * 60 * 60 * 1000;

test("matrix: valid license within duration", () => {
  const now = Date.parse("2026-01-03T00:00:00.000Z");
  const result = evaluateLicenseClock({
    expiresAt: "2026-01-08T00:00:00.000Z",
    serverTime: "2026-01-01T00:00:00.000Z",
    durationMs: WEEK,
    nowMs: now,
    lastLocalNowMs: now,
  });
  assert.equal(result.valid, true);
});

test("matrix: expired license is rejected", () => {
  const now = Date.parse("2026-01-10T00:00:00.000Z");
  const result = evaluateLicenseClock({
    expiresAt: "2026-01-08T00:00:00.000Z",
    serverTime: "2026-01-01T00:00:00.000Z",
    durationMs: WEEK,
    nowMs: now,
    lastLocalNowMs: now,
  });
  assert.equal(result.valid, false);
});

test("matrix: tampered future expiresAt cannot outrun serverTime + duration", () => {
  const now = Date.parse("2026-01-10T00:00:00.000Z");
  const result = evaluateLicenseClock({
    expiresAt: "2099-01-01T00:00:00.000Z",
    serverTime: "2026-01-01T00:00:00.000Z",
    durationMs: WEEK,
    nowMs: now,
    lastLocalNowMs: now,
  });
  assert.equal(result.valid, false);
});

test("matrix: deviceId in payload is part of signed bytes (canonical includes deviceId)", async () => {
  const { canonicalLicenseJson } = await import("./license.crypto");
  const json = canonicalLicenseJson({
    licenseId: "a",
    tenantId: "t",
    deviceId: "DEVICE-1",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-08T00:00:00.000Z",
    subscriptionStatus: "active",
    licenseVersion: 1,
    serverTime: "2026-01-01T00:00:00.000Z",
  });
  assert.match(json, /DEVICE-1/);
});
