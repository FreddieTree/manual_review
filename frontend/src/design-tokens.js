// src/design-tokens.js

/**
 * Utility: parse hex color to {r,g,b}
 * @param {string} hex
 * @returns {{r:number, g:number, b:number}}
 */
function hexToRgb(hex) {
    let h = hex.replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const int = parseInt(h, 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    };
}

/**
 * Utility: convert hex or rgb to CSS rgba string with alpha
 * @param {string} color - hex like #rrggbb or rgb/rgba string
 * @param {number} alpha - 0..1
 * @returns {string}
 */
function toRgba(color, alpha = 1) {
    if (color.startsWith("#")) {
        const { r, g, b } = hexToRgb(color);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith("rgb")) {
        // Provided as rgb or rgba, inject alpha if needed.
        if (color.startsWith("rgba")) {
            return color; // assume already has alpha
        }
        return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
    }
    return color;
}

/**
 * Utility: relative luminance per WCAG
 * @param {string} hex
 * @returns {number}
 */
function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const srgb = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    // Rec. 709 luminance
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Utility: contrast ratio between two colors (hex)
 * @param {string} a
 * @param {string} b
 * @returns {number} ratio (e.g., 4.5)
 */
function contrastRatio(a, b) {
    const L1 = luminance(a);
    const L2 = luminance(b);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose best readable foreground (black or white) against a background.
 * @param {string} backgroundHex
 * @param {number} minContrast desired minimum contrast ratio (default 4.5)
 * @returns {string} "#000" or "#fff"
 */
function readableTextColor(backgroundHex, minContrast = 4.5) {
    const blackContrast = contrastRatio(backgroundHex, "#000000");
    const whiteContrast = contrastRatio(backgroundHex, "#ffffff");
    if (blackContrast >= minContrast && blackContrast >= whiteContrast) return "#000000";
    if (whiteContrast >= minContrast) return "#ffffff";
    // fallback to whichever is higher
    return blackContrast > whiteContrast ? "#000000" : "#ffffff";
}

/**
 * Core raw tokens (design system foundation)
 */
const raw = {
    color: {
        // palette
        blue: {
            50: "#f0f5ff",
            100: "#d7e2fe",
            200: "#b0c4fb",
            300: "#8aa6f8",
            400: "#6388f4",
            500: "#2b5dd7", // primary
            600: "#244aa8",
            700: "#1d3780",
            800: "#16265b",
            900: "#0f172a",
        },
        gray: {
            50: "#f9fafb",
            100: "#f1f5fa",
            200: "#e2e8f0",
            300: "#cbd5e1",
            400: "#94a3b8",
            500: "#64748b",
            600: "#475569",
            700: "#334155",
            800: "#1e2a44",
            900: "#111827",
        },
        green: {
            50: "#ecfbf2",
            100: "#d1f6e1",
            500: "#16a34a",
        },
        yellow: {
            50: "#fffbeb",
            100: "#fef3c7",
            500: "#f9c846",
        },
        red: {
            50: "#fef2f2",
            100: "#fde8e8",
            500: "#dc2626",
        },
        indigo: {
            500: "#6366f1",
        },
        // semantic core (can be themed)
        primary: "#2b5dd7",
        accent: "#f9c846",
        background: "#f7fafd",
        surface: "#ffffff",
        muted: "#f1f5fa",
        border: "#d9e2ef",
        text: "#1e2a44",
        inverseText: "#f0f4ff",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#0ea5e9",
        radius: "1rem",
        shadow: "0 16px 48px -8px rgba(43,93,215,0.15)",
    },
    spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
    },
    typography: {
        fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        baseSize: 16, // px
        scale: {
            caption: "0.75rem",
            small: "0.875rem",
            body: "1rem",
            subtitle: "1.25rem",
            heading: "1.5rem",
            hero: "2rem",
        },
        weight: {
            regular: 400,
            medium: 500,
            bold: 700,
        },
        lineHeight: {
            normal: 1.5,
            tight: 1.2,
            relaxed: 1.6,
        },
    },
    radii: {
        sm: "0.5rem",
        md: "0.75rem",
        default: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        full: "9999px",
    },
    motion: {
        duration: {
            short: "120ms",
            base: "200ms",
            medium: "350ms",
            long: "600ms",
        },
        easing: {
            standard: "cubic-bezier(0.4, 0, 0.2, 1)",
            expressive: "cubic-bezier(0.2, 0, 0, 1)",
        },
    },
    breakpoints: {
        sm: "480px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
    },
    zIndex: {
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modal: 1050,
        popover: 1070,
        tooltip: 1100,
    },
};

/**
 * Themes: light / dark, can merge with raw to create semantic tokens
 */
const themes = {
    light: {
        semantic: {
            background: raw.color.background,
            surface: raw.color.surface,
            text: raw.color.gray[800],
            muted: raw.color.gray[100],
            border: raw.color.gray[200],
            primary: raw.color.primary,
            accent: raw.color.accent,
            success: raw.color.success,
            warning: raw.color.warning,
            danger: raw.color.danger,
            info: raw.color.info,
            inverseText: raw.color.inverseText,
        },
    },
    dark: {
        semantic: {
            background: "#0f172a",
            surface: "#1f2a44",
            text: "#e3e8ff",
            muted: "#1e2a44",
            border: "#2a3658",
            primary: "#4a8cf2",
            accent: "#f9c846",
            success: "#16a34a",
            warning: "#d97706",
            danger: "#dc2626",
            info: "#0ea5e9",
            inverseText: "#0f172a",
        },
    },
};

/**
 * Build a theme object merging raw + semantic for given mode
 * @param {"light"|"dark"} mode
 */
function buildTheme(mode = "light") {
    const base = raw;
    const semantic = themes[mode]?.semantic || themes.light.semantic;

    return {
        ...base,
        color: {
            ...base.color,
            semantic, // easy access to semantic palette
            get background() {
                return semantic.background;
            },
            get surface() {
                return semantic.surface;
            },
            get text() {
                return semantic.text;
            },
            get muted() {
                return semantic.muted;
            },
            get border() {
                return semantic.border;
            },
            get primary() {
                return semantic.primary;
            },
            get accent() {
                return semantic.accent;
            },
            get success() {
                return semantic.success;
            },
            get warning() {
                return semantic.warning;
            },
            get danger() {
                return semantic.danger;
            },
            get info() {
                return semantic.info;
            },
            get inverseText() {
                return semantic.inverseText;
            },
        },
        themeName: mode,
        utils: {
            hexToRgb,
            toRgba,
            contrastRatio,
            luminance,
            readableTextColor,
        },
    };
}

// Default exports
export const lightTheme = buildTheme("light");
export const darkTheme = buildTheme("dark");

// Helper to access theme by attribute
export const themesMap = {
    light: lightTheme,
    dark: darkTheme,
};

// For convenience, export a merged default (light)
export default lightTheme;