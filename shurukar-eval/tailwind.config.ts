import type { Config } from "tailwindcss";

/**
 * ShuruKar design tokens. Colours are CSS variables (src/app/globals.css) so
 * the palette lives in one place; components use the semantic names below,
 * never a raw hex.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        muted: "var(--muted)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
          fg: "var(--brand-fg)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 29, 82, 0.04), 0 4px 16px rgba(31, 29, 82, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
