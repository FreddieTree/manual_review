// scripts/build-design-tokens.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import chokidar from "chokidar";
import deepEqual from "fast-deep-equal";
import { tokens } from "../src/design-tokens.js"; // assumed ESM export

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default dark overrides (can be extended / loaded externally)
const DEFAULT_DARK_OVERRIDES = {
    "color-background": "#0f172a",
    "color-surface": "#1f2a44",
    "color-text": "#e2e8ff",
    "color-muted": "#1e2a44",
    // Apple-style subtle glow and accent tweaks for dark
    "shadow-elevation-low": "0 4px 18px rgba(255,255,255,0.04)",
    "shadow-elevation-medium": "0 16px 40px rgba(0,0,0,0.25)",
};

const DEFAULT_EXTRA_TOKENS = {
    radius: {
        base: "14px",
        large: "22px",
        pill: "9999px",
    },
    transition: {
        base: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
        subtle: "all 0.18s cubic-bezier(0.3,0,0.1,1)",
    },
    spacing: {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
    },
    shadow: {
        light: "0 20px 60px -10px rgba(0,0,0,0.08)",
        heavy: "0 30px 90px -15px rgba(0,0,0,0.12)",
    },
};

/**
 * Flatten nested token object into CSS variable map.
 * e.g., { color: { background: "#fff" } } -> { '--color-background': '#fff' }
 */
function flatten(obj, prefix = "") {
    return Object.entries(obj).reduce((acc, [k, v]) => {
        const key = prefix ? `${prefix}-${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            Object.assign(acc, flatten(v, key));
        } else {
            acc[`--${key}`] = v;
        }
        return acc;
    }, {});
}

/**
 * Build CSS block from variable map under a selector.
 */
function buildCSS(vars, selector = ":root") {
    const lines = Object.entries(vars)
        .map(([k, v]) => `  ${k}: ${v};`)
        .sort();
    return `${selector} {\n${lines.join("\n")}\n}\n`;
}

/**
 * Build extra helper classes for Apple-style visuals.
 */
function buildHelperClasses() {
    return `
/* Utility helpers for Apple-like aesthetic */
.theme-transition {
  transition: var(--transition-base);
}
.glass-card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px);
  border-radius: var(--radius-base);
  box-shadow: var(--shadow-light);
  border: 1px solid rgba(255,255,255,0.3);
}
.dark .glass-card {
  background: rgba(31, 41, 55, 0.75);
}
.rounded-apple {
  border-radius: var(--radius-large);
}
.soft-focus {
  box-shadow: 0 0 40px rgba(99, 102, 241, 0.2);
}
`;
}

/**
 * Merge two variable maps, preferring overrides for collisions.
 */
function mergeVars(base, override) {
    const merged = { ...base };
    Object.entries(override).forEach(([k, v]) => {
        if (merged[k] && merged[k] !== v) {
            console.warn(`Overriding token ${k}: "${merged[k]}" -> "${v}"`);
        }
        merged[k] = v;
    });
    return merged;
}

/**
 * Main generation routine.
 */
async function generate({ watch = false, outCss = "src/generated-tokens.css", outJson = "src/generated-tokens.json" } = {}) {
    async function run() {
        try {
            // Combine tokens with extra defaults (without mutating original)
            const mergedTokens = { ...tokens, ...DEFAULT_EXTRA_TOKENS };

            // Flatten light theme vars
            const lightVars = flatten(mergedTokens);

            // Prepare dark overrides mapped to CSS var names
            const darkOverrideVars = Object.fromEntries(
                Object.entries(DEFAULT_DARK_OVERRIDES).map(([k, v]) => [`--${k}`, v])
            );

            // Build theme blocks
            const cssLight = buildCSS(lightVars, ":root");
            const cssDark = buildCSS(mergeVars(lightVars, darkOverrideVars), '[data-theme="dark"]');

            // Compose full CSS with helpers
            const fullCSS = `
/* Generated design tokens - do not edit by hand (source: src/design-tokens.js) */
${cssLight}

${cssDark}

/* System switch helper: automatically apply dark based on preference */
@media (prefers-color-scheme: dark) {
  :root { --_prefers-dark: 1; }
  [data-theme="auto"] { /* fallback container using auto */
    color-scheme: dark;
  }
}

/* Apple-style helper utilities */
${buildHelperClasses()}
`;

            // Write CSS
            await fs.writeFile(path.resolve(__dirname, "..", outCss), fullCSS, "utf-8");

            // Also emit JSON snapshot for UI/inspector
            const jsonOutput = {
                generatedAt: new Date().toISOString(),
                themes: {
                    light: lightVars,
                    dark: mergeVars(lightVars, darkOverrideVars),
                },
                meta: {
                    appleStyle: {
                        radius: DEFAULT_EXTRA_TOKENS.radius,
                        transition: DEFAULT_EXTRA_TOKENS.transition,
                        shadow: DEFAULT_EXTRA_TOKENS.shadow,
                    },
                },
            };
            await fs.writeFile(path.resolve(__dirname, "..", outJson), JSON.stringify(jsonOutput, null, 2), "utf-8");

            console.log(`[design-tokens] ✅ Generated CSS (${outCss}) and JSON (${outJson})`);
        } catch (e) {
            console.error("[design-tokens] ❌ Failed to generate", e);
        }
    }

    await run();

    if (watch) {
        const tokenPath = path.resolve(__dirname, "../src/design-tokens.js");
        console.log("[design-tokens] Watching for changes in", tokenPath);
        chokidar.watch(tokenPath).on("change", async () => {
            console.log("[design-tokens] Detected change, regenerating...");
            await run();
        });
    }
}

// CLI entry
const args = process.argv.slice(2);
const options = {
    watch: args.includes("--watch") || args.includes("-w"),
    outCss: (() => {
        const idx = args.indexOf("--out");
        if (idx !== -1 && args[idx + 1]) return args[idx + 1];
        return "src/generated-tokens.css";
    })(),
    outJson: (() => {
        const idx = args.indexOf("--json");
        if (idx !== -1 && args[idx + 1]) return args[idx + 1];
        return "src/generated-tokens.json";
    })(),
};

generate(options);