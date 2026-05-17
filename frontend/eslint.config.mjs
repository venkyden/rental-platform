import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "**/*.d.ts",
      // Service worker — uses browser SW globals (self, caches, clients)
      "public/sw.js",
      // Exclude TS/TSX — VS Code tsserver handles type errors natively.
      // Re-enable with @typescript-eslint/parser once it's installed.
      "**/*.ts",
      "**/*.tsx",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
    },
    rules: {
      "no-debugger": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "warn",
      "no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
    },
  },
];
