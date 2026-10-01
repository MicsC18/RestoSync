import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        resto: {
          manteca: "#F9F6F0",
          ciruela: "#3A1124",
          oliva: "#4A5D23",
          dorado: "#E0A96D",
          acero: "#7393B3",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Playfair Display SC"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;