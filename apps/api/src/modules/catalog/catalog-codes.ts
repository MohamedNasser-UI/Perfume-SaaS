export const CATALOG_PREFIX = {
  OIL: "OL",
  ALCOHOL: "CO",
  STABILIZER: "ST",
  PUMP: "PM",
  BOTTLE: "BT",
  PACKAGING: "PK",
  READY_MADE: "RDY",
  OTHER: "OZ",
} as const;

export function nextCatalogCodeFromList(prefix: string, codes: string[]): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(\\d+)$`);
  let max = 0;
  for (const code of codes) {
    const match = re.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}
