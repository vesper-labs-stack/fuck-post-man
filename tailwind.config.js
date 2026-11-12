/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Neutrals / materials (theme-switched via CSS variables)
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        fill: "var(--fill)",
        fill2: "var(--fill-2)",
        separator: "var(--separator)",
        label: "var(--label)",
        label2: "var(--label-2)",
        label3: "var(--label-3)",
        material: "var(--material)",
        // iOS system accents (RGB triplets so /opacity modifiers work)
        accent: "rgb(var(--accent) / <alpha-value>)",
        green: "rgb(var(--green) / <alpha-value>)",
        red: "rgb(var(--red) / <alpha-value>)",
        orange: "rgb(var(--orange) / <alpha-value>)",
        purple: "rgb(var(--purple) / <alpha-value>)",
        teal: "rgb(var(--teal) / <alpha-value>)",
        indigo: "rgb(var(--indigo) / <alpha-value>)",
        pink: "rgb(var(--pink) / <alpha-value>)",
        yellow: "rgb(var(--yellow) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Helvetica Neue",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Cascadia Code",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        ios: "0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
        "ios-lg": "0 12px 48px rgba(0,0,0,0.22)",
        pill: "0 1px 3px rgba(0,0,0,0.12)",
      },
      keyframes: {
        "menu-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "sheet-in": {
          from: { opacity: "0", transform: "translateY(14px) scale(0.97)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "none" },
        },
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "none" },
        },
      },
      animation: {
        "menu-in": "menu-in .14s cubic-bezier(.2,.8,.3,1)",
        "sheet-in": "sheet-in .24s cubic-bezier(.2,.8,.3,1)",
        "fade-in": "fade-in .18s ease-out",
        "rise-in": "rise-in .28s cubic-bezier(.2,.8,.3,1)",
        "drawer-in": "drawer-in .28s cubic-bezier(.2,.8,.3,1)",
      },
    },
  },
  plugins: [],
};