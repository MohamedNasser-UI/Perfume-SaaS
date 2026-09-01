/**
 * Clock-rollback rule: a jump backward must not extend the lease.
 * Mirrors apps/api/src/modules/license/license.crypto.ts evaluateLicenseClock.
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
