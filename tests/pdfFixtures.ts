import type { ReportDefinition } from "../src/types/report";
import { label, reportFixture } from "./helpers";
export interface PdfFixture {
  name: string;
  report: ReportDefinition;
  data: Record<string, unknown>[];
  expected: string[];
  absent?: string[];
  markersOnPages?: Record<string,number>;
  requireRedPixels?: boolean;
}
function table(): ReportDefinition {
  const report = reportFixture();
  report.name = "Pagination regression";
  report.bands = [
    {
      id: "header",
      type: "PageHeader",
      height: 28,
      controls: [
        label({ id: "page-heading", text: "TABLE HEADER 每頁表頭", width: 400, height: 22 }),
      ],
    },
    {
      id: "detail",
      type: "Detail",
      height: 24,
      keepTogether: true,
      controls: [
        label({ type: "Field", id: "row-code", fieldName: "code", width: 100, height: 22 }),
        label({
          id: "desc",
          type: "Field",
          fieldName: "description",
          x: 110,
          width: 360,
          height: 22,
        }),
      ],
    },
    {
      id: "total",
      type: "ReportFooter",
      height: 30,
      controls: [label({ id: "report-end", text: "REPORT-END 報表結尾", width: 400 })],
    },
    {
      id: "footer",
      type: "PageFooter",
      height: 22,
      controls: [
        label({
          type: "Expression",
          id: "page-number", expression: "PAGE [PageNumber] / [TotalPages]",
          width: 400,
        }),
      ],
    },
  ];
  return report;
}
export function pdfFixtures(): PdfFixture[] {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      code: `ROW-${String(i + 1).padStart(4, "0")}`,
      description: `第 ${i + 1} 筆 · Mixed language text`,
    }));
  const empty = table(),
    large = table(),
    long = table(),
    nested = table(),
    grouped = table(),
    longTable = table();
  long.bands[1].controls = [
    label({ type: "Field", fieldName: "text", width: 470, canGrow: true }),
    label({ id: "following", text: "AFTER-TEXT 下方內容", y: 22, width: 400 }),
  ];
  const child = table();
  child.pageSettings = nested.pageSettings;
  child.bands = child.bands.filter(
    (b) =>
      b.type === "PageHeader" ||
      b.type === "Detail" ||
      b.type === "ReportFooter",
  );
  child.bands[0].controls[0].text = "CHILD HEADER 子報表表頭";
  child.bands.at(-1)!.controls[0].text = "CHILD-END 子報表結尾";
  child.bands[1].controls[1].width = 300;
  nested.bands[1].controls = [
    label({ text: "PARENT-START 父報表", width: 400 }),
    label({
      id: "child",
      type: "SubReport",
      y: 24,
      width: 500,
      height: 20,
      subReportBinding: "children",
      subReportDefinition: child,
    }),
    label({
      id: "parent-after",
      text: "PARENT-AFTER 子報表後方內容",
      y: 46,
      width: 400,
    }),
  ];
  nested.bands[1].height = 70;
  grouped.bands.splice(1, 0, {
    id: "group-header",
    type: "GroupHeader",
    height: 24,
    groupBy: "category",
    pageBreakBefore: true,
    controls: [label({ type: "Field", id: "group-heading", fieldName: "category", width: 400 })],
  });
  grouped.bands.splice(3, 0, {
    id: "group-footer",
    type: "GroupFooter",
    height: 24,
    controls: [
      label({ type: "Expression", id: "group-count", expression: "=COUNT(code)", width: 400 }),
    ],
  });
  longTable.bands[1].controls[1].canGrow = true;
  const longTableRows = rows(20).map((row, i) => ({
    ...row,
    description:
      Array.from(
        { length: 7 },
        (_, j) => `第 ${i + 1} 筆第 ${j + 1} 行：長欄位也應保留完整內容。`,
      ).join("\n") + `\nTAIL-${String(i + 1).padStart(4, "0")}`,
  }));
  const conditional=table();
  conditional.bands[1].visibleWhen='=quantity > 0';
  conditional.bands[1].controls[1].fieldName='amount';
  conditional.bands[1].controls[1].styleRules=[{when:'=amount < 0',style:{color:'#dc2626'}}];
  const together=table();together.bands[1].height=600;
  together.bands[2]={id:'total',type:'ReportFooter',height:240,keepTogether:true,controls:[label({id:'first',text:'BLOCK-FIRST',width:400,height:50}),label({id:'last',text:'BLOCK-LAST',width:400,y:140,height:50})]};
  const split=structuredClone(together);split.bands[2].keepTogether=false;
  return [
    {name:'conditional',report:conditional,data:[{code:'POSITIVE-CODE',amount:12.5,quantity:1},{code:'NEGATIVE-CODE',amount:-123.45,quantity:1},{code:'HIDDEN-CODE',amount:3,quantity:0}],expected:['POSITIVE-CODE','NEGATIVE-CODE','REPORT-END'],absent:['HIDDEN-CODE'],requireRedPixels:true},
    {name:'keep-together',report:together,data:rows(1),expected:['ROW-0001','BLOCK-FIRST','BLOCK-LAST'],markersOnPages:{'BLOCK-FIRST':2,'BLOCK-LAST':2}},
    {name:'split-fixed-band',report:split,data:rows(1),expected:['ROW-0001','BLOCK-FIRST','BLOCK-LAST'],markersOnPages:{'BLOCK-FIRST':1,'BLOCK-LAST':2}},
    {
      name: "empty",
      report: empty,
      data: [],
      expected: ["TABLE HEADER", "REPORT-END", "PAGE 1 / 1"],
    },
    {
      name: "table",
      report: table(),
      data: rows(95),
      expected: rows(95)
        .map((r) => r.code)
        .concat("REPORT-END"),
    },
    {
      name: "long-text",
      report: long,
      data: [
        {
          text: Array.from(
            { length: 95 },
            (_, i) =>
              `LINE-${String(i + 1).padStart(4, "0")} 中文長文字測試 · Mixed text continues safely to the next page.`,
          ).join("\n"),
        },
      ],
      expected: Array.from(
        { length: 95 },
        (_, i) => `LINE-${String(i + 1).padStart(4, "0")}`,
      ).concat("AFTER-TEXT", "REPORT-END"),
    },
    {
      name: "long-table",
      report: longTable,
      data: longTableRows,
      expected: longTableRows
        .map((r) => r.code)
        .concat(
          longTableRows.map((_, i) => `TAIL-${String(i + 1).padStart(4, "0")}`),
          "REPORT-END",
        ),
    },
    {
      name: "nested",
      report: nested,
      data: [{ children: rows(95) }],
      expected: rows(95)
        .map((r) => r.code)
        .concat("CHILD-END", "PARENT-START", "PARENT-AFTER", "REPORT-END"),
    },
    {
      name: "groups",
      report: grouped,
      data: rows(40).map((row, i) => ({
        ...row,
        category: i < 20 ? "GROUP-A" : "GROUP-B",
      })),
      expected: rows(40)
        .map((r) => r.code)
        .concat("GROUP-A", "GROUP-B", "REPORT-END"),
    },
    {
      name: "large",
      report: large,
      data: rows(1000),
      expected: rows(1000)
        .map((r) => r.code)
        .concat("REPORT-END"),
    },
  ];
}
