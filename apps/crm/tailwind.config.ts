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
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Public Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
