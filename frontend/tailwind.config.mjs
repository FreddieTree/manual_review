export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
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
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.07)",
        input: "0 1px 4px rgba(40,60,100,0.04)",
        navbar: "0 1px 10px rgba(40,60,100,0.05)",
        btn: "0 2px 6px rgba(80,120,200,0.18)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        bounceSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.6s ease-out both",
        bounceSlow: "bounceSlow 1.8s infinite",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "Arial", "sans-serif"],
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
      },
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
    },
  },
  plugins: [
    (await import('@tailwindcss/forms')).default,
    (await import('@tailwindcss/typography')).default,
    (await import('@tailwindcss/aspect-ratio')).default,
  ],
};