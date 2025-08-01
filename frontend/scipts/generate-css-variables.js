// Node script to emit CSS variables from tokens
import fs from "fs";
import { tokens } from "../src/design-tokens.js";

function flatten(obj, prefix = "") {
    return Object.entries(obj).reduce((acc, [k, v]) => {
        const key = prefix ? `${prefix}-${k}` : k;
        if (typeof v === "object" && v !== null) {
            Object.assign(acc, flatten(v, key));
        } else {
            acc[`--${key}`] = v;
        }
        return acc;
    }, {});
}

function buildCSS(vars, selector = ":root") {
    const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
    return `${selector} {\n${lines.join("\n")}\n}\n`;
}

const lightVars = flatten(tokens);
const darkOverrides = {
    "--color-background": "#0f172a",
    "--color-surface": "#1f2a44",
    "--color-text": "#e2e8ff",
    "--color-muted": "#1e2a44",
};

const css = buildCSS(lightVars) + "\n" + buildCSS(darkOverrides, '[data-theme="dark"]');

fs.writeFileSync("src/generated-tokens.css", css);
console.log("Generated CSS variables at src/generated-tokens.css");