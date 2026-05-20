import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: "dist",
      beforeWriteFile: (filePath, content) => {
        const normalized = filePath.replaceAll("\\", "/");

        // Ensure downstream consumers get the global `google.payments.api.*`
        // types (provided by `@types/googlepay`) when they import
        // `@amos.com/amos-js`.
        if (normalized.endsWith("/dist/index.d.ts")) {
          const referenceLine = '/// <reference types="googlepay" />\n';
          if (!content.includes(referenceLine)) {
            return { content: referenceLine + content };
          }
        }
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: "src/index.ts",
      },
      formats: ["es", "cjs"],
    },
  },
  esbuild: {
    keepNames: true,
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "test/", "vite.config.js"],
    },
  },
});
