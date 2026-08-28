import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        navy: "var(--navy)",
        "on-navy": "var(--on-navy)",
        crimson: "var(--crimson)",
        gold: "var(--gold)",
        // Accessible text variants of --gold — see packages/ui/tokens.css
        // for the contrast rationale. Use these for small/body-sized gold
        // text; keep `gold` for borders, backgrounds, and large text.
        "gold-text": "var(--gold-text)",
        "gold-on-navy": "var(--gold-on-navy)",
        success: "var(--success)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Public Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        modal: "var(--shadow-modal)",
      },
    },
  },
  plugins: [],
} satisfies Config;
