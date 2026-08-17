/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        card: {
          DEFAULT: "#121215",
          foreground: "#fafafa"
        },
        muted: {
          DEFAULT: "#18181b",
          foreground: "#a1a1aa"
        },
        border: {
          DEFAULT: "#27272a",
          subtle: "#1f1f23"
        }
      },
      fontFamily: {
        sans: ['Inter', 'IRANYekanRd', 'IranYekanRd', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IoskeleyMono', 'IRANYekanRd', 'IranYekanRd', 'monospace'],
        farsi: ['IRANYekanRd', 'IranYekanRd', 'sans-serif']
      }
    },
  },
  plugins: [],
}
