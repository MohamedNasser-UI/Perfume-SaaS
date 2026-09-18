import assert from "node:assert/strict";
import test from "node:test";
import { resolveOilTierMarkup } from "./pricing-tier";

test("uses STANDARD when no oil has a tier", () => {
  const resolved = resolveOilTierMarkup([null, undefined], [
    { tier: "ECONOMY", markupPercentage: 30 },
    { tier: "STANDARD", markupPercentage: 40 },
    { tier: "PREMIUM", markupPercentage: 50 },
  ]);
  assert.deepEqual(resolved, { tier: "STANDARD", markupPercentage: 40 });
});

test("picks the highest markup among assigned oil tiers", () => {
  const resolved = resolveOilTierMarkup(["ECONOMY", "LUXURY"], {
    ECONOMY: 20,
    STANDARD: 40,
    PREMIUM: 50,
    NICHE: 60,
    LUXURY: 80,
  });
  assert.deepEqual(resolved, { tier: "LUXURY", markupPercentage: 80 });
});
