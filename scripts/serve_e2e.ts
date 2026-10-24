import fs from "node:fs";
import path from "node:path";
// This runner owns only scratch/e2e/layout.json. It never reads or writes the user's saved layout.
const directory = path.resolve("scratch/e2e");
fs.mkdirSync(directory, { recursive: true });
const file = path.join(directory, "layout.json");
fs.writeFileSync(file, fs.readFileSync("examples/custom-invoice.json", "utf8"));
process.env.REPORT_ENGINE_LAYOUT_FILE = file;
const { createServer } = await import("vite");
const { default: configuration } = await import("../vite.config");
const server = await createServer({
  ...configuration,
  configFile: false,
  server: {
    ...configuration.server,
    host: "127.0.0.1",
    port: 5189,
    strictPort: true,
  },
});
await server.listen();
console.log("Isolated E2E server: http://127.0.0.1:5189");
const close = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
