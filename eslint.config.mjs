import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
export default defineConfig(
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
    ],
  },
  {
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "vite.config.ts",
      "test/**/*.ts",
      "vitest.config.ts",
      "drizzle.config.ts",
      "eslint.config.mjs",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.mjs",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
    },
  },
  {
    files: [
      "src/transports/web/client/**/*.ts",
      "src/transports/web/client/**/*.tsx",
    ],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.client.json",
      },
    },
  },
);
