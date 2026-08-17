/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.03)",
          raised: "rgba(255, 255, 255, 0.06)",
          hover: "rgba(255, 255, 255, 0.09)",
          subtle: "rgba(255, 255, 255, 0.015)"
        },
        border: {
          glass: "rgba(255, 255, 255, 0.08)",
          subtle: "rgba(255, 255, 255, 0.04)",
          highlight: "rgba(255, 255, 255, 0.16)"
        },
        status: {
          paid: "#10b981",
          holding: "#3b82f6",
          working: "#8b5cf6",
          pending: "#f59e0b",
          escrow: "#3b82f6",
          progress: "#8b5cf6",
          invoiced: "#f59e0b"
        }
      },
      fontFamily: {
        sans: ['Inter', 'IRANYekanRd', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['IoskeleyMono', 'monospace'],
        farsi: ['IRANYekanRd', 'sans-serif']
      },
      backdropBlur: {
        '2xl': '24px',
        '3xl': '32px'
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.7)',
        'specular': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.25)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.25)'
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
