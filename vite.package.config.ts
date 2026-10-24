import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
const pkg = JSON.parse(
  fs.readFileSync("packages/report-engine/package.json", "utf8"),
);
const external = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: { alias: { "@": path.resolve("src") } },
  define: {
    __REPORT_ENGINE_FONT_RELATIVE_PATH__: JSON.stringify(
      "./assets/NotoSansTC.ttf",
    ),
  },
  build: {
    outDir: "packages/report-engine/dist",
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        core: "src/public/core.ts",
        pdf: "src/public/pdf.ts",
        designer: "src/public/designer.ts",
        mcp: "src/public/mcp.ts",
      },
      formats: ["es"],
      cssFileName: "report-engine",
    },
    rolldownOptions: {
      external: (id) =>
        id.startsWith("node:") ||
        ["fs", "path", "url"].includes(id) ||
        external.some((name) => id === name || id.startsWith(name + "/")),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "shared-[name]-[hash].js",
      },
    },
  },
});
