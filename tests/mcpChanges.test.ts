import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createReportMcpServer } from "../src/mcp/server";
import { createDocumentRepository } from "../src/server/documentRepository";
import type { ReportToolOutcome } from "../src/mcp/results";
import type { ReportDocument } from "../src/types/document";
import { reportFixture, temporaryDirectory } from "./helpers";

test("MCP preview is read-only, apply is atomic, stale writes and invalid runtime/layout edits preserve bytes", async () => {
  const temporary = temporaryDirectory(),
    file = path.join(temporary.directory, "report.json");
  const document: ReportDocument = {
    formatVersion: 1,
    report: reportFixture(),
    dataSource: {
      id: "x",
      name: "X",
      schema: {
        detailFields: [{ name: "quantity", label: "Quantity", type: "number" }],
      },
      data: { items: [{ quantity: 0 }] },
    },
  };
  const repository = createDocumentRepository(file, document);
  repository.initialize();
  const server = createReportMcpServer({
    repository,
    initialDocument: document,
    outputDirectory: temporary.directory,
  });
  const client = new Client({ name: "atomic-test", version: "1" }),
    [c, s] = InMemoryTransport.createLinkedPair();
  await server.connect(s);
  await client.connect(c);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const value = result.structuredContent as unknown as ReportToolOutcome;
    assert.equal(typeof value.success, "boolean");
    assert.equal(typeof value.code, "string");
    return value;
  };
  try {
    assert.equal((await client.listTools()).tools.length, 22);
    const initial = repository.read(),
      before = fs.readFileSync(file, "utf8");
    const changes = {
      operations: [
        {
          type: "update_control",
          bandId: "detail",
          controlId: "label",
          patch: {
            text: "after",
            visibleWhen: "=quantity >= 0",
            styleRules: [
              { when: "=quantity = 0", style: { color: "#dc2626" } },
            ],
          },
        },
      ],
    };
    const preview = await call("preview_report_changes", {
      baseVersion: initial.version,
      changes,
    });
    assert.equal(preview.success, true);
    assert.equal((preview.data as { applied: boolean }).applied, false);
    assert.equal(fs.readFileSync(file, "utf8"), before);
    const applied = await call("apply_report_changes", {
      baseVersion: initial.version,
      changes,
    });
    assert.equal(applied.success, true);
    assert.notEqual(applied.version, initial.version);
    assert.equal(repository.read().report.bands[0].controls[0].text, "after");
    const saved = fs.readFileSync(file, "utf8");
    assert.equal(
      (
        await call("apply_report_changes", {
          baseVersion: initial.version,
          changes,
        })
      ).code,
      "VERSION_CONFLICT",
    );
    assert.equal(fs.readFileSync(file, "utf8"), saved);
    assert.equal(
      (
        await call("update_control", {
          expectedVersion: initial.version,
          bandId: "detail",
          controlId: "label",
          patch: { text: "stale" },
        })
      ).code,
      "VERSION_CONFLICT",
    );
    const invalid = {
      operations: [
        {
          type: "update_control",
          bandId: "detail",
          controlId: "label",
          patch: { type: "Expression", expression: "=1 / quantity" },
        },
      ],
    };
    const rejected = await call("apply_report_changes", {
      baseVersion: applied.version,
      changes: invalid,
    });
    assert.equal(rejected.code, "VALIDATION_FAILED");
    assert.ok(rejected.diagnostics.some((d) => d.code === "DIVISION_BY_ZERO"));
    assert.equal(fs.readFileSync(file, "utf8"), saved);
    const outside = await call("preview_report_changes", {
      changes: {
        operations: [
          {
            type: "update_control",
            bandId: "detail",
            controlId: "label",
            patch: { x: 10000 },
          },
        ],
      },
    });
    assert.equal(outside.code, "VALIDATION_FAILED");
    assert.ok(
      outside.diagnostics.some((d) => d.code === "CONTROL_WIDTH_OVERFLOW"),
    );
    const brokenBatch = await call("apply_report_changes", {
      baseVersion: applied.version,
      changes: {
        operations: [
          {
            type: "update_control",
            bandId: "detail",
            controlId: "label",
            patch: { text: "must not persist" },
          },
          { type: "delete_control", bandId: "detail", controlId: "missing" },
        ],
      },
    });
    assert.equal(brokenBatch.success, false);
    assert.equal(fs.readFileSync(file, "utf8"), saved);
    const noOp = await call("apply_report_changes", {
      baseVersion: applied.version,
      changes,
    });
    assert.equal(noOp.code, "NO_CHANGES");
    assert.equal(noOp.version, applied.version);
    assert.equal((await call("preflight_report")).success, true);
    const invalidDocument = await call("preflight_report", { document: null });
    assert.equal(invalidDocument.code, "VALIDATION_FAILED");
    assert.ok(
      invalidDocument.diagnostics.some((d) => d.category === "structure"),
    );
    assert.equal((await call("get_report_layout")).success, true);
    const invalidFormula = await call("validate_report_formulas", {
      report: {
        ...document.report,
        calculatedFields: [
          {
            name: "bad",
            scope: "report",
            type: "number",
            expression: "=UNKNOWN()",
          },
        ],
      },
    });
    assert.equal(invalidFormula.code, "VALIDATION_FAILED");
    assert.ok(
      invalidFormula.diagnostics.some((d) => d.code === "UNKNOWN_FUNCTION"),
    );
    // Another writer wins after candidate validation but before the repository commit.
    const write = repository.write.bind(repository);
    repository.write = (value, version) => {
      const latest = repository.read();
      write(
        { ...latest, report: { ...latest.report, name: "Concurrent edit" } },
        latest.version,
      );
      return write(value, version);
    };
    const raced = await call("apply_report_changes", {
      baseVersion: applied.version,
      changes: {
        operations: [
          {
            type: "update_control",
            bandId: "detail",
            controlId: "label",
            patch: { text: "must not overwrite concurrent edit" },
          },
        ],
      },
    });
    assert.equal(raced.code, "VERSION_CONFLICT");
    assert.equal(repository.read().report.name, "Concurrent edit");
    assert.equal(repository.read().report.bands[0].controls[0].text, "after");
    repository.write = write;
    // A concurrent write after a read must not attach its newer version to older report data.
    const read = repository.read.bind(repository);
    let intervened = false;
    repository.read = () => {
      const snapshot = read();
      if (!intervened) {
        intervened = true;
        write(
          { ...snapshot, report: { ...snapshot.report, name: "After read" } },
          snapshot.version,
        );
      }
      return snapshot;
    };
    const readOutcome = await call("get_report_layout");
    assert.equal(
      readOutcome.version,
      (readOutcome.data as { version: string }).version,
    );
    assert.notEqual(readOutcome.version, read().version);
    repository.read = read;
  } finally {
    await client.close();
    await server.close();
    temporary.cleanup();
  }
});
