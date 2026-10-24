import fs from "node:fs";
import path from "node:path";
const directory = path.resolve("packages/report-engine/dist");
fs.mkdirSync(path.join(directory, "assets"), { recursive: true });
fs.copyFileSync(
  "public/fonts/NotoSansTC.ttf",
  path.join(directory, "assets/NotoSansTC.ttf"),
);
fs.copyFileSync("public/fonts/OFL.txt", path.join(directory, "assets/OFL.txt"));
for (const name of ['embedding.md', 'pdf-pagination.md', 'conditional-printing.md', 'mcp-changes.md']) {
  fs.mkdirSync(path.join(directory, 'docs'), { recursive: true });
  fs.copyFileSync(path.join('docs',name), path.join(directory, 'docs', name));
}
fs.mkdirSync(path.join(directory,'examples'), { recursive: true });
for (const name of ['custom-invoice.json', 'conditional-invoice.json']) {
  fs.copyFileSync(path.join('examples',name),path.join(directory,'examples',name));
}
// Declaration files contain public, portable ESM paths, including private reachable types.
function visit(folder: string) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) visit(file);
    else if (file.endsWith(".d.ts")) {
      const source = fs
        .readFileSync(file, "utf8")
        .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "")
        .replace(
          /(['"])(@\/[^'"]+|\.\.?\/[^'"]+)\1/g,
          (_, quote, specifier: string) => {
            let relative = specifier.startsWith("@/")
              ? path
                  .relative(
                    path.dirname(file),
                    path.join(directory, "types", specifier.slice(2)),
                  )
                  .split(path.sep)
                  .join("/")
              : specifier;
            if (!relative.startsWith(".")) relative = "./" + relative;
            const withoutExtension = relative.replace(/\.(tsx?|jsx?)$/, "");
            const base = path.resolve(path.dirname(file), withoutExtension);
            const target = fs.existsSync(base + '.d.ts') ? withoutExtension + '.js'
              : fs.existsSync(path.join(base,'index.d.ts')) ? withoutExtension + '/index.js' : withoutExtension + '.js';
            return quote + target + quote;
          },
        );
      fs.writeFileSync(file, source);
    }
  }
}
visit(path.join(directory, "types"));
console.log("Package assets and declarations prepared.");
