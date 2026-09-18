export type PricingTier = "ECONOMY" | "STANDARD" | "PREMIUM" | "NICHE" | "LUXURY";

const TIERS: PricingTier[] = ["ECONOMY", "STANDARD", "PREMIUM", "NICHE", "LUXURY"];

export type TierMarkupRow = { tier: string; markupPercentage: number | string };

/** Pick effective markup: max among oils that have a tier; else STANDARD (or fallback %). */
export function resolveOilTierMarkup(
  oilTiers: Array<PricingTier | string | null | undefined>,
  markups: TierMarkupRow[] | Record<string, number> | undefined,
  fallbackPercentage = 50,
): { tier: PricingTier; markupPercentage: number } {
  const map = new Map<string, number>();
  if (Array.isArray(markups)) {
    for (const row of markups) map.set(row.tier, Number(row.markupPercentage));
  } else if (markups) {
    for (const [tier, value] of Object.entries(markups)) map.set(tier, Number(value));
  }
  for (const tier of TIERS) {
    if (!map.has(tier)) map.set(tier, fallbackPercentage);
  }

  let bestTier: PricingTier | null = null;
  let bestPct = -1;
  for (const raw of oilTiers) {
    if (!raw || !TIERS.includes(raw as PricingTier)) continue;
    const tier = raw as PricingTier;
    const pct = map.get(tier) ?? fallbackPercentage;
    if (pct > bestPct) {
      bestPct = pct;
      bestTier = tier;
    }
  }
  if (!bestTier) {
    return { tier: "STANDARD", markupPercentage: map.get("STANDARD") ?? fallbackPercentage };
  }
  return { tier: bestTier, markupPercentage: bestPct };
}
