import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "report-engine-consumer-"),
);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run using npm run test:package");
function command(args: string[], cwd = directory) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.status !== 0)
    throw new Error(result.error?.message ?? result.stdout + result.stderr);
  return result.stdout;
}
function cleanup() {
  const absolute = path.resolve(directory),
    parent = path.resolve(os.tmpdir());
  if (
    path.dirname(absolute) !== parent ||
    !path.basename(absolute).startsWith("report-engine-consumer-")
  )
    throw new Error("Unsafe consumer cleanup target");
  fs.rmSync(absolute, { recursive: true, force: true });
}
try {
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "report-engine-consumer-smoke",
      private: true,
      type: "module",
    }),
  );
  const packed = JSON.parse(
    command(
      [
        npmCli,
        "pack",
        path.join(root, "packages/report-engine"),
        "--json",
        "--pack-destination",
        directory,
      ],
      root,
    ),
  );
  const tarball = path.join(directory, packed[0].filename);
  console.log("Installing packed package into an independent consumer...");
  command([
    npmCli,
    "install",
    tarball,
    "react@^19",
    "react-dom@^19",
    "@types/react@^19",
    "@types/react-dom@^19",
    "typescript@~6.0.3",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ]);
  fs.writeFileSync(
    path.join(directory, "consumer.mjs"),
    `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { getFormulaCatalog, validateReportDocument, previewFormula, preflightDocument, resolveControlAppearance } from '@report-engine/report-engine/core';
import { renderReportPdf } from '@report-engine/report-engine/pdf';
import { createReportMcpServer, createDocumentRepository } from '@report-engine/report-engine/mcp';
import { ReportDesigner, createReportStore } from '@report-engine/report-engine/designer';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
const document = validateReportDocument({ formatVersion:1, report:{ id:'consumer',name:'Consumer',pageSettings:{size:'A4',orientation:'portrait',margins:{top:20,right:20,bottom:20,left:20}}, bands:[{id:'d',type:'Detail',height:24,controls:[{id:'f',type:'Field',fieldName:'price',x:0,y:0,width:100,height:20}]}]}, dataSource:{id:'consumer',name:'Consumer data',schema:{detailFields:[{name:'price',label:'Price',type:'number'}]},data:{items:[{price:12.5},{price:7.5}]}} });
assert.equal(getFormulaCatalog().functions.length,38);
const example=validateReportDocument(JSON.parse(fs.readFileSync(new URL('./node_modules/@report-engine/report-engine/dist/examples/custom-invoice.json',import.meta.url),'utf8')));
assert.equal(previewFormula(example.report,'=calc.total',{schema:example.dataSource.schema,dataSource:example.dataSource.data.items}).value,49);
const conditional=validateReportDocument(JSON.parse(fs.readFileSync(new URL('./node_modules/@report-engine/report-engine/dist/examples/conditional-invoice.json',import.meta.url),'utf8')));
assert.equal(preflightDocument(conditional).valid,true);
assert.equal(resolveControlAppearance({...document.report.bands[0].controls[0],visibleWhen:'=FALSE'},{}),null);
assert.equal(previewFormula(document.report,'=SUM(price)',{schema:document.dataSource.schema,dataSource:document.dataSource.data.items}).value,20);
const pdf = await renderReportPdf({report:document.report,dataSource:document.dataSource}); assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
const a=createReportStore(document),b=createReportStore(document); a.getState().updateControl('d','f',{x:5}); assert.equal(b.getState().report.bands[0].controls[0].x,0);
assert.ok(renderToString(createElement(ReportDesigner,{initialDocument:document,renderPdf:async()=>new Blob([pdf])})).includes('report-engine-designer'));
const repository=createDocumentRepository('consumer-layout.json',document);repository.initialize();
const server=createReportMcpServer({repository,initialDocument:document,outputDirectory:process.cwd()});
const client=new Client({name:'package-consumer',version:'1'});const [c,s]=InMemoryTransport.createLinkedPair(); await server.connect(s);await client.connect(c);
assert.equal((await client.listTools()).tools.length,22);
const result=await client.callTool({name:'preview_formula',arguments:{expression:'=SUM(price)'}});assert.equal(JSON.parse(result.content[0].text).value,20);
const preview=(await client.callTool({name:'preview_report_changes',arguments:{changes:{operations:[{type:'update_control',bandId:'d',controlId:'f',patch:{visibleWhen:'=price > 0'}}]}}})).structuredContent;
assert.equal(preview.success,true);assert.equal(preview.data.applied,false);
const applied=(await client.callTool({name:'apply_report_changes',arguments:{baseVersion:preview.version,changes:{operations:[{type:'update_control',bandId:'d',controlId:'f',patch:{visibleWhen:'=price > 0'}}]}}})).structuredContent;
assert.equal(applied.success,true);assert.equal(repository.read().report.bands[0].controls[0].visibleWhen,'=price > 0');
await client.close();await server.close();assert.ok(fs.existsSync('consumer-layout.json'));
console.log('Packed package passed: core, PDF/font asset, isolated designer, SSR and real MCP client.');
`,
  );
  console.log(command([path.join(directory, "consumer.mjs")]));
  fs.writeFileSync(
    path.join(directory, "consumer.ts"),
    `import { preflightDocument, type ReportDocument, type ReportPreflightResult } from '@report-engine/report-engine';
import { ReportDesigner, type ReportDesignerHandle } from '@report-engine/report-engine/designer';
import { renderReportPdf } from '@report-engine/report-engine/pdf';
import { createReportMcpServer, type ReportMcpOptions, type ReportToolOutcome, type ReportChanges } from '@report-engine/report-engine/mcp';
const api = (value: ReportDocument, ref: ReportDesignerHandle, options: ReportMcpOptions, changes: ReportChanges): [ReportPreflightResult, ReportToolOutcome, unknown[]] => { ref.setDocument(value); return [preflightDocument(value), { success:true, code:'OK', tool:'consumer', diagnostics:[], data:changes }, [ReportDesigner, renderReportPdf({ report: value.report, dataSource:value.dataSource }), createReportMcpServer(options)]]; };
export { api };
`,
  );
  command([
    path.join(directory, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--noUncheckedSideEffectImports",
    "--target",
    "es2023",
    "--module",
    "NodeNext",
    "--jsx",
    "react-jsx",
    "consumer.ts",
  ]);
  const assets = packed[0].files.map((file: { path: string }) => file.path);
  assert.ok(assets.includes("dist/assets/NotoSansTC.ttf"));
  assert.ok(assets.includes("dist/assets/OFL.txt"));
  assert.ok(assets.includes("dist/report-engine.css"));
  assert.ok(assets.includes("dist/docs/embedding.md"));
  assert.ok(assets.includes("dist/examples/custom-invoice.json"));
  assert.ok(assets.includes("dist/examples/conditional-invoice.json"));
  assert.ok(assets.includes("dist/docs/conditional-printing.md"));
  assert.ok(assets.includes("dist/docs/mcp-changes.md"));
  console.log(
    "Published ESM declarations typecheck in an independent NodeNext consumer.",
  );
} finally {
  cleanup();
}
