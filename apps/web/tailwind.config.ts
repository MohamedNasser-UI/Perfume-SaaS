import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          hover: "var(--ink-hover)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          light: "var(--gold-light)",
        },
        paper: "var(--paper)",
      },
      fontFamily: {
        sans: ["DM Sans", "Cairo", "ui-sans-serif", "system-ui"],
        serif: ["Fraunces", "Cairo", "ui-serif", "Georgia"],
        arabic: ["Cairo", "DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
