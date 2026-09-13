export type MixOil = { oilId: string; qtyMl: number };

function roundStep(value: number, step: number) {
  return Number((Math.round(value / step) * step).toFixed(1));
}

/** Split `total` ml across `count` oils in `step` increments; leftover goes on the last oil. */
export function evenSplitMl(total: number, count: number, step = 0.1): number[] {
  if (count <= 0) return [];
  const safeTotal = Math.max(0, roundStep(total, step));
  if (count === 1) return [safeTotal];
  const raw = safeTotal / count;
  const base = Math.floor(raw / step + 1e-9) * step;
  const parts = Array.from({ length: count }, () => roundStep(base, step));
  const used = parts.slice(0, -1).reduce((sum, part) => sum + part, 0);
  parts[count - 1] = roundStep(safeTotal - used, step);
  return parts;
}

export function mixTotalMl(oils: MixOil[]) {
  return Number(oils.reduce((sum, oil) => sum + Number(oil.qtyMl || 0), 0).toFixed(1));
}

export function splitMix(oilIds: string[], totalMl: number): MixOil[] {
  const parts = evenSplitMl(totalMl, oilIds.length);
  return oilIds.map((oilId, index) => ({ oilId, qtyMl: parts[index] ?? 0 }));
}

export function primaryOilId(oils: MixOil[], fallback = "") {
  return oils[0]?.oilId || fallback;
}

export function mixLabel(names: string[]) {
  return names.filter(Boolean).join(" + ");
}
