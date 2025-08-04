// frontend/eslint.config.js

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import unicorn from "eslint-plugin-unicorn";
import importPlugin from "eslint-plugin-import";
import sortExports from "eslint-plugin-sort-exports";
import reactRefresh from "eslint-plugin-react-refresh";

const compat = new FlatCompat({
    recommendedConfig: js.configs.recommended,
});

export default [
    // Base JS rules
    js.configs.recommended,

    // Legacy/shareable plugin configs
    ...compat.extends("plugin:react/recommended"),
    ...compat.extends("plugin:react-hooks/recommended"),
    ...compat.extends("plugin:jsx-a11y/recommended"),
    ...compat.extends("plugin:unicorn/recommended"),
    ...compat.extends("plugin:import/errors"),
    ...compat.extends("plugin:import/warnings"),
    ...compat.extends("plugin:import/typescript"),
    ...compat.extends("plugin:@typescript-eslint/recommended"),

    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                ecmaFeatures: { jsx: true },
                project: ["./tsconfig.json"],
            },
        },
        plugins: {
            react,
            "react-hooks": reactHooks,
            "jsx-a11y": jsxA11y,
            unicorn,
            import: importPlugin,
            "sort-exports": sortExports,
            "react-refresh": reactRefresh,
        },
        settings: {
            react: { version: "detect" },
            "import/resolver": {
                node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
            },
        },
        rules: {
            // React / JSX
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            "react/self-closing-comp": "warn",
            "react/jsx-key": "error",
            "react/function-component-definition": [
                "warn",
                {
                    namedComponents: ["arrow-function", "function-declaration"],
                    unnamedComponents: ["arrow-function"],
                },
            ],
            "react/jsx-props-no-spreading": "off",

            // Hooks
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": ["warn"],

            // General
            "consistent-return": "error",
            eqeqeq: ["warn", "always", { null: "ignore" }],
            "no-console": ["warn", { allow: ["warn", "error", "info"] }],
            "prefer-const": "error",
            "no-implicit-coercion": ["warn", { boolean: false }],

            // Unicorn adjustments
            "unicorn/prevent-abbreviations": "off",
            "unicorn/filename-case": ["error", { case: "kebabCase" }],
            "unicorn/consistent-function-scoping": "off",
            "unicorn/no-null": "off",
            "unicorn/prefer-module": "off",
            "unicorn/explicit-length-check": "warn",

            // sort-exports
            // "sort-exports/sort-exports": ["warn", { sortDir: "asc" }],

            // Import ordering
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        ["parent", "sibling", "index"],
                        "object",
                        "type",
                    ],
                    pathGroups: [
                        { pattern: "react", group: "builtin", position: "before" },
                        { pattern: "@/**", group: "internal" },
                    ],
                    pathGroupsExcludedImportTypes: ["react"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "import/no-unresolved": ["error", { ignore: ["\\$"] }],
            "import/no-duplicates": "error",
            "import/newline-after-import": ["error", { count: 1 }],

            // Accessibility
            "jsx-a11y/anchor-is-valid": "warn",
            "jsx-a11y/click-events-have-key-events": "error",
            "jsx-a11y/no-noninteractive-element-interactions": "warn",
            "jsx-a11y/label-has-associated-control": [
                "warn",
                { required: { some: ["nesting", "id"] } },
            ],

            // TypeScript / variables
            "no-unused-vars": [
                "error",
                { varsIgnorePattern: "^[A-Z_]", args: "after-used", ignoreRestSiblings: true },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
];