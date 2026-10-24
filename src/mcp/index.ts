#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createReportMcpServer } from './server';
import { createDocumentRepository } from '../server/documentRepository';
import { sampleOrderReport, sampleOrderDataSource } from '../mock/sampleReport';
import type { ReportDocument } from '../types/document';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const initialDocument: ReportDocument = { formatVersion: 1, report: sampleOrderReport, dataSource: sampleOrderDataSource };
const repository = createDocumentRepository(process.env.REPORT_ENGINE_LAYOUT_FILE ?? path.join(root, 'current_report_layout.json'), initialDocument);
repository.initialize();
const server = createReportMcpServer({ repository, initialDocument, outputDirectory: root, assetsDirectory: process.env.REPORT_ENGINE_ASSETS_DIR });
server.connect(new StdioServerTransport()).then(() => console.error('Report Engine MCP ready')).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
