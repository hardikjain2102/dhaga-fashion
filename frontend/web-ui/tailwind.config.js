/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#faf8f5",
        sand: { 100: "#f3efe9", 200: "#e7e0d6", 300: "#d6ccbd" },
        ink: "#1c1917",
        muted: "#6b645c",
        thread: { DEFAULT: "#8c3b2a", dark: "#6e2d20", soft: "#f4e4de" },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
