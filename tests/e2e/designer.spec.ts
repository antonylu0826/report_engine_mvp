import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ReportDocument } from "../../src/types/document";
import type { ReportToolOutcome } from "../../src/mcp/results";
const fixture = () =>
  JSON.parse(
    fs.readFileSync("examples/custom-invoice.json", "utf8"),
  ) as ReportDocument;
async function saved(request: APIRequestContext) {
  return (await request.get("/api/report-layout")).json();
}
async function reset(request: APIRequestContext) {
  const current = await saved(request);
  expect(
    (
      await request.post("/api/report-layout", {
        headers: { "If-Match": current.version },
        data: fixture(),
      })
    ).ok(),
  ).toBeTruthy();
}
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText("自訂資料來源範例");
  await expect(page.getByRole("button", { name: "雙向已同步" })).toBeVisible();
}
async function pdfText(bytes: Buffer) {
  const loading = getDocument({ data: new Uint8Array(bytes) });
  try {
    const pdf = await loading.promise;
    let text = "";
    for (let n = 1; n <= pdf.numPages; n++)
      text += (await (await pdf.getPage(n)).getTextContent()).items
        .filter((item) => "str" in item)
        .map((item) => item.str)
        .join(" ");
    return text;
  } finally {
    await loading.destroy();
  }
}
test.beforeEach(async ({ request }) => reset(request));
test("imported conditions reach the actual PDF; drafts validate and supported styles persist", async ({
  page,
  request,
}, info) => {
  await ready(page);
  await page.getByRole("button", { name: "資料來源", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("examples/conditional-invoice.json"));
  await expect(page.getByRole("banner")).toContainText("條件式列印範例");
  await expect
    .poll(async () => (await saved(request)).dataSource.id)
    .toBe("conditional-data");
  await page.getByRole("button", { name: "報表設計", exact: true }).click();
  await page.locator('[data-control-id="amount"]').click();
  await expect(page.getByLabel("樣式條件 1", { exact: true })).toHaveValue(
    "=calc.amount < 0",
  );
  await page.getByLabel("顯示條件", { exact: true }).fill("=quantity");
  await page.getByRole("button", { name: "套用條件", exact: true }).click();
  await expect(
    page.getByText("Print conditions must return boolean or null", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    (await saved(request)).report.bands[1].controls[1].visibleWhen,
  ).toBeUndefined();
  await page.getByLabel("顯示條件", { exact: true }).fill("=quantity > 0");
  await page.getByRole("button", { name: "套用條件", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await saved(request)).report.bands[1].controls[1].visibleWhen,
    )
    .toBe("=quantity > 0");
  await page.getByRole("button", { name: "列印健檢", exact: true }).click();
  await expect(page.getByTestId("preflight-summary")).toContainText("0 個錯誤");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/report-pdf") && r.status() === 200,
  );
  await page.getByRole("button", { name: "即時預覽", exact: true }).click();
  const pdfResponse = await response;
  await expect(page.getByTitle("PDF Preview")).toHaveAttribute("src", /^blob:/);
  const href = await page
    .getByRole("link", { name: "下載 PDF" })
    .getAttribute("href");
  expect(
    (await page.getByTitle("PDF Preview").getAttribute("src"))!.startsWith(
      href!,
    ),
  ).toBeTruthy();
  // Read the actual preview/download Blob; Chromium's PDF viewer can omit the DevTools response body.
  const bytes = Buffer.from(
    await page.evaluate(
      async (url) =>
        Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
      href,
    ),
  );
  expect(bytes.length).toBe(Number(pdfResponse.headers()["content-length"]));
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const text = await pdfText(bytes);
  expect(text).toContain("POSITIVE-ITEM");
  expect(text).toContain("NEGATIVE-ITEM");
  expect(text).not.toContain("HIDDEN-ITEM");
  expect(text).toContain("20");
  await fs.promises.writeFile(
    info.outputPath("conditional-preview.pdf"),
    bytes,
  );
  await expect(page.getByRole("button", { name: /rows/ })).toHaveCount(0);
});
test("preflight diagnostics navigate to the exact control and block invalid PDF output", async ({
  page,
  request,
}) => {
  await ready(page);
  const report = fixture().report;
  report.bands[1].controls[0].x = 1000;
  await page.getByRole("button", { name: "規格定義", exact: true }).click();
  await page.locator("textarea").fill(JSON.stringify(report));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /套用/ }).click();
  await page.getByRole("button", { name: "列印健檢", exact: true }).click();
  await expect(page.getByTestId("preflight-summary")).toContainText("列印受阻");
  await expect(
    page.getByText("CONTROL_WIDTH_OVERFLOW", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "定位 description", exact: true })
    .click();
  await expect(page.locator('[data-control-id="description"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const result = await request.post("/api/report-pdf", {
    data: { report, dataSource: fixture().dataSource },
  });
  expect(result.status()).toBe(422);
  expect(
    (await result.json()).diagnostics.some(
      (d: { code: string }) => d.code === "CONTROL_WIDTH_OVERFLOW",
    ),
  ).toBeTruthy();
});
test("multi-drag is one undo step and copy, redo and input-native shortcuts remain scoped", async ({
  page,
}) => {
  await ready(page);
  const description = page.locator('[data-control-id="description"]'),
    amount = page.locator('[data-control-id="amount"]');
  await description.click();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(
    page.locator('[data-control-id][aria-selected="true"]'),
  ).toHaveCount(2);
  const bounds = (await description.boundingBox())!;
  await page.mouse.move(bounds.x + 30, bounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 70, bounds.y + 10, { steps: 8 });
  await page.mouse.up();
  await expect(description).not.toHaveCSS("left", "0px");
  await expect(
    page.locator('[data-control-id][aria-selected="true"]'),
  ).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+z");
  expect(await description.evaluate((e) => (e as HTMLElement).style.left)).toBe(
    "0pt",
  );
  expect(await amount.evaluate((e) => (e as HTMLElement).style.left)).toBe(
    "330pt",
  );
  await page.keyboard.press("ControlOrMeta+d");
  await expect(page.locator("[data-control-id]")).toHaveCount(7);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator("[data-control-id]")).toHaveCount(5);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.locator("[data-control-id]")).toHaveCount(7);
  const input = page.getByLabel("顯示條件", { exact: true });
  await input.fill("=TRUE");
  await input.press("ControlOrMeta+a");
  await input.press("Backspace");
  await expect(page.locator("[data-control-id]")).toHaveCount(7);
});
test("real MCP changes synchronize into the designer and stale versions preserve newer UI edits", async ({
  page,
  request,
}) => {
  await ready(page);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--import",
      import.meta.resolve("tsx"),
      path.resolve("src/mcp/index.ts"),
    ],
    cwd: path.resolve("scratch/e2e"),
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      TSX_TSCONFIG_PATH: path.resolve("tsconfig.app.json"),
      REPORT_ENGINE_LAYOUT_FILE: path.resolve("scratch/e2e/layout.json"),
      REPORT_ENGINE_ASSETS_DIR: path.resolve("scratch/e2e"),
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "browser-mcp", version: "1" });
  await client.connect(transport);
  try {
    const call = async (name: string, args: Record<string, unknown>) =>
      (await client.callTool({ name, arguments: args }))
        .structuredContent as unknown as ReportToolOutcome;
    const before = await saved(request),
      changes = {
        operations: [
          { type: "update_band", bandId: "detail", patch: { height: 60 } },
          {
            type: "add_control",
            bandId: "detail",
            control: {
              id: "agent-added",
              type: "Label",
              x: 0,
              y: 30,
              width: 200,
              height: 20,
              text: "AGENT-APPLIED",
            },
          },
        ],
      };
    const preview = await call("preview_report_changes", {
      baseVersion: before.version,
      changes,
    });
    expect(preview.success).toBeTruthy();
    expect((await saved(request)).version).toBe(before.version);
    const applied = await call("apply_report_changes", {
      baseVersion: before.version,
      changes,
    });
    expect(applied.success).toBeTruthy();
    await expect(page.locator('[data-control-id="agent-added"]')).toBeVisible();
    await page.locator('[data-control-id="description"]').click();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await saved(request)).report.bands[1].controls[0].x)
      .toBe(1);
    const stale = await call("apply_report_changes", {
      baseVersion: applied.version,
      changes,
    });
    expect(stale.code).toBe("VERSION_CONFLICT");
    expect((await saved(request)).report.bands[1].controls[0].x).toBe(1);
  } finally {
    await client.close();
  }
});
test("two built-package designers isolate state, history, clipboard and callbacks", async ({
  page,
}) => {
  await page.goto("/examples/embedded.html");
  const left = page.locator("#left-designer"),
    right = page.locator("#right-designer");
  await page.getByRole("button", { name: "Change left title" }).click();
  await expect(left.getByRole("banner")).toContainText("LEFT ONLY");
  await expect(right.getByRole("banner")).toContainText("自訂資料來源範例");
  await left.locator('[data-control-id="description"]').click();
  await page.keyboard.press("ControlOrMeta+d");
  await expect(left.locator("[data-control-id]")).toHaveCount(6);
  await expect(right.locator("[data-control-id]")).toHaveCount(5);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(left.locator("[data-control-id]")).toHaveCount(5);
  await expect(page.getByTestId("changes")).toContainText("/ Right: 0");
  await right.locator('[data-control-id="description"]').click();
  await page.keyboard.press("ControlOrMeta+v");
  await expect(right.locator("[data-control-id]")).toHaveCount(5);
  expect(
    await left
      .locator(".report-engine-designer")
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(650);
});
