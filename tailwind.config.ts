import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        muted: "var(--muted)",
        navy: {
          600: "var(--color-navy)",
          700: "var(--color-navy-dark)",
          light: "var(--color-navy-light)",
        },
        "accent-blue": "var(--color-accent-blue)",
        "accent-green": "var(--color-accent-green)",
        "accent-orange": "var(--color-accent-orange)",
        "accent-red": "var(--color-accent-red)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
