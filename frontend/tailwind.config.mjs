import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import aspectRatio from '@tailwindcss/aspect-ratio';
import plugin from 'tailwindcss/plugin';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: ['class', 'media'], // respect system and override via class
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        // semantic with CSS variable fallback for ultimate theming control
        background: "var(--color-background, #f7fafd)",
        surface: "var(--color-surface, #ffffff)",
        muted: "var(--color-muted, #f1f5fa)",
        text: "var(--color-text, #1e2a44)",
        border: "var(--color-border, #d9e2ef)",
        primary: {
          DEFAULT: "hsl(227, 72%, 55%)", // #2b5dd7
          light: "hsl(223, 83%, 75%)",
          dark: "hsl(227, 72%, 40%)",
        },
        accent: {
          DEFAULT: "hsl(47, 95%, 64%)", // #f9c846
          light: "hsl(50, 92%, 80%)",
        },
        success: {
          DEFAULT: "hsl(145, 63%, 41%)",
          bg: "hsl(145, 63%, 95%)",
        },
        warning: {
          DEFAULT: "hsl(45, 88%, 52%)",
          bg: "hsl(45, 88%, 95%)",
        },
        danger: {
          DEFAULT: "hsl(359, 79%, 63%)",
          bg: "hsl(359, 79%, 95%)",
        },
        slate: {
          50: "#f9fafc",
          100: "#f1f5fa",
          300: "#cfd8ec",
          500: "#8f9bb3",
          700: "#4a5568",
          900: "#1f2a44",
        },
        // legacy / utility
        darkbg: "#0f172a",
      },
      boxShadow: {
        card: "0 24px 64px -12px rgba(43,93,215,0.15), 0 8px 24px -4px rgba(31,41,55,0.08)",
        input: "0 12px 32px -4px rgba(40,60,100,0.08)",
        navbar: "0 8px 40px -8px rgba(40,60,100,0.08)",
        btn: "0 12px 44px -6px rgba(43,93,215,0.25)",
        glow: "0 0 32px 0 rgba(99,102,241,0.35)",
      },
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "1rem",
        xl: "1.25rem",
        "2xl": "1.75rem",
        "3xl": "2rem",
        full: "9999px",
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(.22,.11,.28,1)',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: "translateY(6px)" },
          '100%': { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          '0%,100%': { transform: "translateY(0)" },
          '50%': { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.85 },
          '100%': { opacity: 1 },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.5s var(--tw-transition-timing-function) both",
        float: "float 5s ease-in-out infinite",
        pulseSoft: "pulseSoft 3s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        mono: ["SFMono-Regular", "Menlo", "Monaco", "Consolas", "ui-monospace", "monospace"],
      },
      spacing: {
        '7': '1.75rem',
        '9': '2.25rem',
        '14': '3.5rem',
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
    },
  },
  plugins: [
    forms,
    typography({
      className: 'prose',
      modifiers: [],
      inject: false,
      // Customize default prose to feel soft / Apple-like
      // You can also move this into a separate `typography` theme file.
      // (Tailwind doesn’t yet support deep type inference here, so we keep explicit)
      theme: {
        DEFAULT: {
          css: {
            color: "rgba(31,41,55,0.9)",
            a: {
              color: "hsl(227,72%,55%)",
              textDecoration: "none",
              fontWeight: "500",
              transition: "color .25s ease",
            },
            "a:hover": {
              color: "hsl(227,72%,45%)",
              textDecoration: "underline",
            },
            h1: {
              fontWeight: "700",
              letterSpacing: "-0.5px",
              marginTop: "0",
              marginBottom: "0.35em",
            },
            h2: {
              fontWeight: "600",
              marginTop: "0",
              marginBottom: "0.4em",
            },
            strong: {
              fontWeight: "600",
            },
            code: {
              background: "rgba(243,244,246,1)",
              padding: "0.2em 0.4em",
              borderRadius: "6px",
              fontSize: "0.85em",
              color: "#1f2a44",
            },
            pre: {
              background: "#1f2a44",
              color: "#f0f6ff",
              padding: "1rem 1.25rem",
              borderRadius: "1rem",
              overflow: "auto",
              fontSize: "0.8rem",
              lineHeight: "1.4",
            },
            blockquote: {
              borderLeftColor: "hsl(227,72%,55%)",
              backgroundColor: "rgba(235,241,255,0.6)",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
            },
          },
        },
        dark: {
          css: {
            color: "rgba(229,237,255,0.9)",
            a: {
              color: "hsl(214, 100%, 75%)",
            },
            code: {
              background: "rgba(31,41,55,1)",
              color: "#e2e8f0",
            },
            pre: {
              background: "#0f172a",
            },
            blockquote: {
              backgroundColor: "rgba(20,34,66,0.6)",
              borderLeftColor: "hsl(214, 100%, 75%)",
            },
          },
        },
      },
    }),
    aspectRatio,
    // custom utilities for focus glow / subtle elevation
    plugin(function ({ addUtilities, theme }) {
      addUtilities({
        ".focus-glow": {
          position: "relative",
          transition: "box-shadow .25s ease, transform .2s ease",
          boxShadow: theme("boxShadow.glow"),
        },
        ".apple-radius": {
          borderRadius: theme("borderRadius.2xl"),
        },
        ".soft-transition": {
          transition: "all 250ms cubic-bezier(.22,.11,.28,1)",
        },
      });
    }),
  ],
  safelist: [
    "bg-success-bg",
    "bg-warning-bg",
    "bg-danger-bg",
    "bg-emerald-100",
    "bg-red-100",
    "bg-yellow-100",
    "text-emerald-800",
    "text-red-800",
    "text-yellow-800",
    "dark",
    "prose",
  ],
};