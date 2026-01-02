import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        airtable: "0 2px 8px rgba(0,0,0,0.1)",
        "airtable-hover": "0 4px 12px rgba(0,0,0,0.15)",
      },
    },
  },
};

export default config;