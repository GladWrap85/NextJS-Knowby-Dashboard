// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [".next/**", "node_modules/**", "dist/**", "public/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "warn",
    },
  },
]);