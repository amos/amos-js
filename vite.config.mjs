import { playwright } from "@vitest/browser-playwright";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

const plugins = [
  dts({
    outDirs: "dist",
    entryRoot: "src",
    exclude: ["**/*.test.ts"],
    compilerOptions: { rootDir: "src" },
    beforeWriteFile: (filePath, content) => {
      const normalized = filePath.replaceAll("\\", "/");

      // Ensure downstream consumers get the global `google.payments.api.*`
      // types (provided by `@types/googlepay`) when they import
      // `@amos.com/amos-js`.
      if (normalized.endsWith("/dist/index.d.ts")) {
        return {
          content: `/// <reference types="googlepay" />\n${content}`,
        };
      }

      return { content };
    },
  }),
];

const build = {
  // Match amos-ui embed: native-ESM browsers (2018+). Syntax is
  // downleveled here; crypto.randomUUID / AbortController are handled in
  // src, not via core-js.
  target: ["chrome64", "firefox67", "safari12", "ios12", "edge79"],
  lib: {
    entry: {
      index: "src/index.ts",
    },
    formats: ["es", "cjs"],
  },
};

export default defineConfig({
  plugins,
  build,
  esbuild: {
    keepNames: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
