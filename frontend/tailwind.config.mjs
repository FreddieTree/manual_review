import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import aspectRatio from '@tailwindcss/aspect-ratio';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2b5dd7",
          dark: "#173b84",
          light: "#4a8cf2",
        },
        accent: {
          DEFAULT: "#f9c846",
          light: "#f6e4a0",
        },
        background: "#f7fafd",
        surface: "#ffffff",
        muted: "#f1f5fa",
        darkbg: "#0f172a",
      },
      boxShadow: {
        card: "0 16px 48px -8px rgba(43,93,215,0.15)",
        input: "0 6px 20px rgba(40,60,100,0.08)",
        navbar: "0 4px 30px rgba(40,60,100,0.08)",
        btn: "0 8px 28px rgba(43,93,215,0.2)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.45s ease-out both",
        float: "float 4s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "system-ui", "Segoe UI", "Arial", "sans-serif"],
        mono: ["Menlo", "Monaco", "Consolas", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [forms, typography, aspectRatio],
  safelist: [
    // if dynamic classes used (e.g., decision badges)
    "bg-emerald-100",
    "bg-red-100",
    "bg-yellow-100",
    "text-emerald-800",
    "text-red-800",
    "text-yellow-800",
  ],
};