import tailwind from "tailwindcss";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#0A3622",    // Deep Green
        secondary: "#15593B",
        accent: "#1A7F56",
      },
    },
  },
  plugins: [
    /** @param {{ addVariant: (name: string, pattern: string) => void }} param0 */
    function({ addVariant }) {
      // Add 'light' variant for light mode styling
      addVariant('light', '.light &')
    }
  ],
}; 