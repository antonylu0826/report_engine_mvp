import { replaceFileAtomically } from './atomicFile';
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ReportDocument } from "../types/document.ts";
import { parseReport } from "../report/schema.ts";
import { parseReportDocument } from "../report/document";
import { validateReportDocument } from "../report/validateDocument";
import { ReportConflictError } from "./reportRepository.ts";

/** Reads legacy report JSON without rewriting it; subsequent saves atomically include its data contract. */
export function createDocumentRepository(
  filePath: string,
  initial: ReportDocument,
) {
  const versionOf = (content: string) =>
    createHash("sha256").update(content).digest("hex");
  return {
    read() {
      const content = fs.readFileSync(filePath, "utf8"),
        value = JSON.parse(content);
      const legacy = value.formatVersion === undefined;
      const document = legacy
        ? {
            formatVersion: 1 as const,
            report: parseReport(value),
            dataSource: structuredClone(initial.dataSource),
          }
        : parseReportDocument(value);
      return {
        ...document,
        legacy,
        version: versionOf(content),
        mtime: fs.statSync(filePath).mtimeMs,
      };
    },
    write(value: ReportDocument, expectedVersion?: string) {
      const document = validateReportDocument({
        formatVersion: value.formatVersion,
        report: value.report,
        dataSource: value.dataSource,
      });
      if (expectedVersion !== undefined) {
        const actual = fs.existsSync(filePath)
          ? versionOf(fs.readFileSync(filePath, "utf8"))
          : "";
        if (actual !== expectedVersion) throw new ReportConflictError();
      }
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${randomUUID()}.tmp`,
        content = JSON.stringify(document, null, 2);
      try {
        fs.writeFileSync(temporary, content, "utf8");
        replaceFileAtomically(temporary, filePath, { beforeReplace: () => {
          if (expectedVersion !== undefined) {
            const actual=fs.existsSync(filePath) ? versionOf(fs.readFileSync(filePath,'utf8')) : '';
            if (actual !== expectedVersion) throw new ReportConflictError();
          }
        } });
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
      return {
        ...document,
        legacy: false,
        version: versionOf(content),
        mtime: fs.statSync(filePath).mtimeMs,
      };
    },
    initialize() {
      if (!fs.existsSync(filePath)) this.write(initial, "");
    },
  };
}
