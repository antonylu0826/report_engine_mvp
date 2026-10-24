import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderReportPdf } from "../src/server/pdfService";
import { pdfFixtures } from "../tests/pdfFixtures";
const update = process.argv.includes("--update");
const directory = path.resolve("tmp/pdfs/regression");
fs.mkdirSync(directory, { recursive: true });
const baselineFile = path.resolve("tests/fixtures/pdf-baseline.json");
type PageBaseline = { geometry: string; hash: string };
const result: Record<string, PageBaseline[]> = {};
function differenceHash(canvas: Canvas) {
  const small = createCanvas(33, 32),
    context = small.getContext("2d");
  context.drawImage(canvas, 0, 0, 33, 32);
  const pixels = context.getImageData(0, 0, 33, 32).data;
  let bits = "";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const at = (y * 33 + x) * 4;
      const a = pixels[at] + pixels[at + 1] + pixels[at + 2],
        b = pixels[at + 4] + pixels[at + 5] + pixels[at + 6];
      bits += a > b ? "1" : "0";
    }
  return bits
    .match(/.{4}/g)!
    .map((bits) => parseInt(bits, 2).toString(16))
    .join("");
}
for (const fixture of pdfFixtures()) {
  // Remove only this fixture's old page images so a shorter run has no stale pages.
  for (const name of fs.readdirSync(directory)) {
    if (new RegExp(`^${fixture.name}-\\d+\\.png$`).test(name)) fs.unlinkSync(path.join(directory, name));
  }
  const bytes = await renderReportPdf({
    ...fixture,
    executionTime: "2026-10-24T00:00:00Z",
    timeZone: "Asia/Taipei",
  });
  fs.writeFileSync(path.join(directory, fixture.name + ".pdf"), bytes);
  const loading = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    standardFontDataUrl:
      path
        .join(
          path.dirname(
            fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")),
          ),
          "standard_fonts",
        )
        .split(path.sep)
        .join("/") + "/",
  });
  const pdf = await loading.promise;
  const allText: string[] = [];
  let redPixels=0;
  result[fixture.name] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n),
      content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item);
    const text = items.map((item) => item.str).join(" ");
    allText.push(text);
    if (fixture.name === "nested")
      assert.ok(
        text.includes("CHILD HEADER"),
        `nested page ${n}: missing repeated child header`,
      );
    assert.ok(
      text.includes("TABLE HEADER"),
      `${fixture.name} page ${n}: missing repeated header`,
    );
    assert.ok(
      text.includes(`PAGE ${n} / ${pdf.numPages}`),
      `${fixture.name} page ${n}: wrong footer`,
    );
    for (const item of items) {
      assert.ok(
        item.transform[4] >= 19 &&
          item.transform[4] + item.width <= page.view[2] - 19,
        `${fixture.name} page ${n}: text outside horizontal margins: ${item.str}`,
      );
      assert.ok(
        item.transform[5] >= 19 && item.transform[5] <= page.view[3] - 19,
        `${fixture.name} page ${n}: text outside vertical margins: ${item.str}`,
      );
    }
    const viewport = page.getViewport({ scale: 1 }),
      canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
    await page.render({
      canvas: canvas as never,
      canvasContext: canvas.getContext("2d") as never,
      viewport,
    }).promise;
    if(fixture.requireRedPixels){
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i+1]<100&&pixels[i+2]<100)redPixels++;
    }
    fs.writeFileSync(
      path.join(directory, `${fixture.name}-${n}.png`),
      canvas.toBuffer("image/png"),
    );
    const geometry = createHash("sha256")
      .update(
        JSON.stringify(
          items.map((item) => [
            item.str,
            item.transform.map((v) => Math.round(v * 100) / 100),
            Math.round(item.width * 100) / 100,
          ]),
        ),
      )
      .digest("hex");
    result[fixture.name].push({ geometry, hash: differenceHash(canvas) });
    page.cleanup();
  }
  for (const marker of fixture.expected)
    assert.equal(
      allText.join(" ").split(marker).length - 1,
      1,
      `${fixture.name}: ${marker} must appear exactly once`,
    );
  for(const marker of fixture.absent ?? [])assert.ok(!allText.join(' ').includes(marker),`${fixture.name}: hidden marker was printed: ${marker}`);
  for(const [marker,page] of Object.entries(fixture.markersOnPages ?? {}))assert.equal(allText.findIndex(text=>text.includes(marker))+1,page,`${fixture.name}: ${marker} moved to the wrong page`);
  if(fixture.requireRedPixels)assert.ok(redPixels>20,`${fixture.name}: negative amount did not render in red`);
  await loading.destroy();
  console.log(
    `${fixture.name}: ${result[fixture.name].length} pages; all content markers and margins verified`,
  );
}
if (update) {
  fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
  fs.writeFileSync(baselineFile, JSON.stringify(result, null, 2) + "\n");
} else {
  const baseline = JSON.parse(
    fs.readFileSync(baselineFile, "utf8"),
  ) as typeof result;
  assert.deepEqual(Object.keys(result), Object.keys(baseline));
  for (const [name, pages] of Object.entries(result)) {
    assert.equal(
      pages.length,
      baseline[name].length,
      `${name}: page count changed`,
    );
    pages.forEach((page, i) => {
      assert.equal(
        page.geometry,
        baseline[name][i].geometry,
        `${name} page ${i + 1}: text geometry changed`,
      );
      let distance = 0;
      for (let j = 0; j < page.hash.length; j++)
        distance +=
          (parseInt(page.hash[j], 16) ^ parseInt(baseline[name][i].hash[j], 16))
            .toString(2)
            .split("1").length - 1;
      assert.ok(
        distance <= 12,
        `${name} page ${i + 1}: visual regression (${distance} changed bits)`,
      );
    });
  }
}
fs.writeFileSync(
  path.join(directory, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>PDF regression review</title><style>body{font:14px sans-serif;background:#e2e8f0;padding:20px}img{width:420px;border:1px solid #94a3b8;margin:8px}section{margin-bottom:28px}</style><h1>PDF regression review</h1>${Object.entries(
    result,
  )
    .map(
      ([name, pages]) =>
        `<section><h2><a href="${name}.pdf">${name}</a> (${pages.length} pages)</h2>${pages.map((_, i) => `<a href="${name}-${i + 1}.png"><img alt="${name} page ${i + 1}" src="${name}-${i + 1}.png"></a>`).join("")}</section>`,
    )
    .join("")}`,
);
console.log(
  `PDF visual regression passed. Review: ${path.join(directory, "index.html")}`,
);
