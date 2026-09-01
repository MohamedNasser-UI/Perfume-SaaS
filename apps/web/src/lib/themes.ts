export const THEME_IDS = ["gold", "oud", "rose", "emerald", "midnight", "terracotta"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeVars = {
  ink: string;
  inkHover: string;
  gold: string;
  goldLight: string;
  paper: string;
};

export const THEME_VARS: Record<ThemeId, ThemeVars> = {
  gold: { ink: "#1c1917", inkHover: "#292524", gold: "#b0894a", goldLight: "#d4b483", paper: "#f7f3ee" },
  oud: { ink: "#14110f", inkHover: "#2a2420", gold: "#c9a227", goldLight: "#e0c36a", paper: "#f6f0e4" },
  rose: { ink: "#4a1c2a", inkHover: "#5c2436", gold: "#c4846a", goldLight: "#e0b4a4", paper: "#f8ecec" },
  emerald: { ink: "#1a2e24", inkHover: "#243d30", gold: "#8a9a5b", goldLight: "#b5c48a", paper: "#eef3ea" },
  midnight: { ink: "#1a2744", inkHover: "#243456", gold: "#6b8cae", goldLight: "#9bb4cc", paper: "#eef1f5" },
  terracotta: { ink: "#4a2c22", inkHover: "#5c382c", gold: "#c46b3a", goldLight: "#e09a6e", paper: "#f4ebe3" },
};

export const THEMES = THEME_IDS.map((id) => ({
  id,
  preview: { ink: THEME_VARS[id].ink, gold: THEME_VARS[id].gold, paper: THEME_VARS[id].paper },
}));

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export function applyTheme(theme?: string | null) {
  const id = isThemeId(theme) ? theme : "gold";
  const palette = THEME_VARS[id];
  const root = document.documentElement;
  root.dataset.theme = id;
  root.style.setProperty("--ink", palette.ink);
  root.style.setProperty("--ink-hover", palette.inkHover);
  root.style.setProperty("--gold", palette.gold);
  root.style.setProperty("--gold-light", palette.goldLight);
  root.style.setProperty("--paper", palette.paper);
}

export function themeRgb(name: "ink" | "gold" | "gold-light" | "paper") {
  const key = name === "gold-light" ? "goldLight" : name;
  const current = document.documentElement.dataset.theme;
  const id = isThemeId(current) ? current : "gold";
  return THEME_VARS[id][key];
}
