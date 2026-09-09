export const FRAGRANCE_FAMILIES = [
  "Citrus",
  "Floral",
  "Fruity",
  "Woody",
  "Green",
  "Spicy",
  "Amber",
  "Gourmand",
  "Musk",
  "Aquatic",
  "Aromatic",
  "Powdery",
  "Leather",
  "Smoky",
] as const;

export type FragranceFamily = (typeof FRAGRANCE_FAMILIES)[number];

/** Premium family hues — used for card background, glow, and legend. No per-card random. */
export const familyColors: Record<FragranceFamily, string> = {
  Citrus: "#e4c15a",
  Floral: "#e8a0bf",
  Fruity: "#e07a5f",
  Woody: "#a67c52",
  Green: "#6f9a72",
  Spicy: "#c45c26",
  Amber: "#d4a017",
  Gourmand: "#c4a07a",
  Musk: "#c9b8c4",
  Aquatic: "#5aa7c7",
  Aromatic: "#7d9b6a",
  Powdery: "#d7c4d0",
  Leather: "#8a5a44",
  Smoky: "#8a8478",
};

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function familyRgba(family: FragranceFamily, alpha: number): string {
  const { r, g, b } = hexToRgb(familyColors[family]);
  return `rgba(${r},${g},${b},${alpha})`;
}
