import type { ReportDefinition } from "../types/report";
import type { ReportDiagnostic } from "../types/diagnostics";
import { getPageGeometry, getSubReportGeometry } from "./geometry";
import { isFlowBand } from "./pagination";
/** Static geometry uses the same page body and flow classification as the PDF compiler. */
export function getLayoutDiagnostics(
  report: ReportDefinition,
): ReportDiagnostic[] {
  const diagnostics: ReportDiagnostic[] = [];
  const geometry = getPageGeometry(report.pageSettings);
  const header = report.bands.find((b) => b.type === "PageHeader"),
    footer = report.bands.find((b) => b.type === "PageFooter");
  const bodyHeight =
    geometry.printableHeight - (header?.height ?? 0) - (footer?.height ?? 0);
  if (bodyHeight <= 0)
    diagnostics.push({
      code: "NO_PRINTABLE_BODY",
      severity: "error",
      category: "pagination",
      message: "Page header and footer leave no space for report content",
      bandId: header?.id ?? footer?.id,
      path: "pageSettings",
    });
  function inspect(
    definition: ReportDefinition,
    width: number,
    parents: string[] = [],
    prefix = "",
    depth = 0,
  ) {
    if (depth > 16 || diagnostics.length >= 200) return;
    definition.bands.forEach((band, bi) => {
      const bandPath = `${prefix}bands[${bi}]`,
        location = { bandId: band.id, subReportControlPath: parents };
      const add = (
        code: string,
        message: string,
        path: string,
        extra: Partial<ReportDiagnostic> = {},
      ) => {
        if (diagnostics.length < 200)
          diagnostics.push({
            code,
            message,
            path,
            severity: "error",
            category: "layout",
            ...location,
            ...extra,
          });
      };
      const flow = isFlowBand(band);
      const fixedRegion = ["PageHeader", "PageFooter"].includes(band.type);
      const availableHeight = fixedRegion
        ? geometry.printableHeight
        : bodyHeight;
      if (band.height > availableHeight)
        add(
          "BAND_TOO_TALL",
          "Band minimum height exceeds its printable area; reduce it and use canGrow for long text",
          bandPath + ".height",
          { category: "pagination" },
        );
      if (["PageHeader", "PageFooter"].includes(band.type) && flow)
        add(
          "GROWING_FIXED_REGION",
          "Page headers and footers require fixed controls",
          bandPath,
          { category: "pagination" },
        );
      if (flow && band.keepTogether === true)
        add(
          "FLOW_BAND_PAGINATION",
          "Growing bands flow across pages; keepTogether only applies to fixed bands",
          bandPath + ".keepTogether",
          { category: "pagination", severity: "warning" },
        );
      const content = band.controls.filter(
        (c) => !["Line", "Panel"].includes(c.type),
      );
      band.controls.forEach((control, ci) => {
        const path = `${bandPath}.controls[${ci}]`,
          item = { controlId: control.id };
        if (control.x + control.width > width + 0.5)
          add(
            "CONTROL_WIDTH_OVERFLOW",
            `Control exceeds available width ${width.toFixed(1)} pt`,
            path,
            item,
          );
        if (!flow && control.y + control.height > band.height + 0.5)
          add(
            "CONTROL_HEIGHT_OVERFLOW",
            `Control exceeds band height ${band.height} pt`,
            path,
            item,
          );
        if (control.height > availableHeight)
          add(
            "CONTROL_TOO_TALL",
            "Control minimum height exceeds its printable area",
            path + ".height",
            { ...item, category: "pagination" },
          );
        if (control.subReportDefinition)
          inspect(
            control.subReportDefinition,
            getSubReportGeometry(control).width,
            [...parents, control.id],
            path + ".subReportDefinition.",
            depth + 1,
          );
      });
      for (let i = 0; i < content.length && diagnostics.length < 200; i++)
        for (
          let j = i + 1;
          j < content.length && diagnostics.length < 200;
          j++
        ) {
          const a = content[i],
            b = content[j];
          const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
            y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (x > 2 && y > 2)
            add(
              "CONTROL_OVERLAP",
              `${a.id} overlaps ${b.id}`,
              `${bandPath}.controls[${band.controls.indexOf(a)}]`,
              { severity: "warning", controlId: a.id, relatedControlId: b.id },
            );
        }
    });
  }
  inspect(report, geometry.printableWidth);
  return diagnostics;
}
