import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.tsx"],
  darkMode: "class",
  theme: {
    extend: {
      boxShadow: {
        'airtable': '0 2px 8px rgba(0,0,0,0.1)',
        'airtable-hover': '0 4px 12px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
} satisfies Config;