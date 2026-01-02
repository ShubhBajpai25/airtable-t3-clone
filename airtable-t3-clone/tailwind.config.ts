import type { Config } from "tailwindcss";

export default {
  // Scan ALL possible locations for Tailwind classes
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // If you're using the ~/app alias
    "./**/*.{js,ts,jsx,tsx,mdx}",
  ],
  
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