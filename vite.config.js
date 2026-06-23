import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDirs: "dist",
      entryRoot: ".",
      beforeWriteFile: (filePath, content) => {
        const normalized = filePath.replaceAll("\\", "/");

        // Ensure downstream consumers get the global `google.payments.api.*`
        // types (provided by `@types/googlepay`) when they import
        // `@amos.com/amos-js`.
        if (normalized.endsWith("/dist/index.d.ts")) {
          return {
            content:
              '/// <reference types="googlepay" />\nexport * from "./src/index";\n',
          };
        }

        return { content };
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
});
