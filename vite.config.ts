import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "EncoreTraceWidget",
      formats: ["iife"],
      fileName: () => "encore-trace-widget.js",
    },
  },
});
