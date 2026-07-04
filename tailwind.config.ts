import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        mist: "#F8FAFC",
        sand: "#FFF6E9",
        accent: "#F97316",
        teal: "#0F766E",
        gold: "#D97706",
        border: "rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular"]
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.08)"
      },
      backgroundImage: {
        "hero-grid":
          "radial-gradient(circle at top left, rgba(249, 115, 22, 0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(15, 118, 110, 0.16), transparent 26%)"
      }
    }
  },
  plugins: []
};

export default config;
