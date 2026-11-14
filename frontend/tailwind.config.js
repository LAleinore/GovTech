/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          canvas: "var(--surface-canvas)",
          panel: "var(--surface-panel)",
          muted: "var(--surface-muted)",
        },
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)",
        },
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        brand: {
          DEFAULT: "var(--brand-industrial)",
          hover: "var(--brand-industrial-hover)",
        },
        status: {
          normal: "var(--status-normal)",
          warning: "var(--status-warning)",
          alarm: "var(--status-alarm)",
          fault: "var(--status-fault)",
          demo: "var(--tag-demo)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

