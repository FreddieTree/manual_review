import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import unicorn from "eslint-plugin-unicorn";
import importPlugin from "eslint-plugin-import";
import sortExports from "eslint-plugin-sort-exports";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "build", "*.generated.*"]),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        React: "readonly"
      },
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: ["./tsconfig.json"]
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      unicorn,
      import: importPlugin,
      "sort-exports": sortExports,
      "react-refresh": reactRefresh
    },
    extends: [
      js.configs.recommended,
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jsx-a11y/recommended",
      "plugin:unicorn/recommended",
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:import/typescript",
      "plugin:react-refresh/recommended"
    ],
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "consistent-return": "error",
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "prefer-const": "error",
      "no-implicit-coercion": ["warn", { boolean: false }],

      // 风格
      "unicorn/prevent-abbreviations": "off",
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "sort-exports/sort-exports": ["warn", { sortDir: "asc", sortExportKind: true }],

      // 导入顺序
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "object", "type"],
          pathGroups: [
            { pattern: "react", group: "builtin", position: "before" },
            { pattern: "@/**", group: "internal" }
          ],
          pathGroupsExcludedImportTypes: ["react"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ],
      "import/no-unresolved": ["error", { ignore: ["\\$"] }],
      "import/no-duplicates": "error",
      "import/newline-after-import": ["error", { count: 1 }],

      // React
      "react/self-closing-comp": "warn",
      "react/jsx-props-no-spreading": "off",
      "react/jsx-key": "error",
      "react/function-component-definition": [
        "warn",
        { namedComponents: ["arrow-function", "function-declaration"], unnamedComponents: ["arrow-function"] }
      ],

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": ["warn", { additionalHooks: "(useMyCustomHook)" }],

      // 可达性
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": ["warn", { required: { some: ["nesting", "id"] } }],

      // Unicorn 调整
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-module": "off",
      "unicorn/explicit-length-check": "warn",

      // 变量
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", args: "after-used", ignoreRestSiblings: true }
      ]
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] }
      }
    },
    overrides: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        rules: { "@typescript-eslint/no-explicit-any": ["warn"] }
      },
      {
        files: ["*.config.js", "*.config.cjs", "*.config.mjs"],
        rules: { "unicorn/no-process-exit": "off" }
      }
    ]
  }
]);