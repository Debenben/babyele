const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");
const importPlugin = require("eslint-plugin-import");

module.exports = [
  {
    ...js.configs.recommended,
    files: ["**/*.ts", "**/*.tsx"],
  },

  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [".webpack/**"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        browser: true,
        node: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "off",

      "import/no-unresolved": "error",
      "import/no-duplicates": "warn",
    },
  },
];

