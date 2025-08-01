// Central design tokens for colors / spacing / typography etc.
// Exported for JS use and CSS variable generation.
export const tokens = {
    color: {
        primary: "#2b5dd7",
        primaryDark: "#173b84",
        primaryLight: "#4a8cf2",
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
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        baseSize: "16px",
        scale: {
            "0": "0.75rem", // caption
            "1": "0.875rem", // small
            "2": "1rem", // body
            "3": "1.25rem", // subtitle
            "4": "1.5rem", // heading
            "5": "2rem", // hero
        },
        weight: {
            regular: 400,
            medium: 500,
            bold: 700,
        },
    },
};