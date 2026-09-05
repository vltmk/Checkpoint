/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#e4e4e7",
        card: {
          DEFAULT: "#121215",
          foreground: "#e4e4e7"
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
