import { useMemo, useState } from "react";
import { useReportStore } from "../../store/useReportStore";
import { preflightDocument } from "../../report/preflight";
import { useCurrentLocale } from "../../i18n";
export function ReportPreflightPanel() {
  const { report, dataSource, focusDiagnostic } = useReportStore(),
    zh = useCurrentLocale().locale === "zh-TW";
  const [revision, setRevision] = useState(0);
  const result = useMemo(() => {
    void revision;
    return preflightDocument(
      { formatVersion: 1, report, dataSource },
      { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    );
  }, [report, dataSource, revision]);
  return (
    <section
      className="flex-1 min-h-0 overflow-auto p-5 bg-slate-50 dark:bg-slate-950"
      aria-label={zh ? "列印健檢" : "Print preflight"}
    >
      <div className="flex gap-3 items-center mb-3">
        <h2 className="font-semibold">{zh ? "列印健檢" : "Print preflight"}</h2>
        <button
          onClick={() => setRevision((v) => v + 1)}
          className="border rounded px-3 py-1 text-xs"
        >
          {zh ? "重新檢查" : "Check again"}
        </button>
      </div>
      <p
        role="status"
        data-testid="preflight-summary"
        className={`p-3 rounded mb-3 ${result.valid ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
      >
        {zh
          ? `${result.valid ? "可列印" : "列印受阻"} · ${result.errorCount} 個錯誤、${result.warningCount} 個警告`
          : `${result.valid ? "Ready to print" : "Printing blocked"} · ${result.errorCount} errors, ${result.warningCount} warnings`}
      </p>
      <p className="text-xs text-slate-500 mb-4">
        {zh
          ? "點選問題可定位控制項或區段；資料問題會開啟資料來源。健檢與 PDF 使用相同驗證。"
          : "Select an issue to locate its control or band. Data issues open the data source. Preflight and PDF share validation."}
      </p>
      <ul className="space-y-2">
        {[...result.diagnostics]
          .sort((a, b) =>
            a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
          )
          .map((diagnostic, index) => (
            <li
              key={index}
              className="rounded border border-slate-300 dark:border-slate-700 p-3"
            >
              <div className="flex flex-wrap gap-2 items-center">
                <span
                  className={
                    diagnostic.severity === "error"
                      ? "text-red-600"
                      : "text-amber-600"
                  }
                >
                  {diagnostic.severity === "error"
                    ? zh
                      ? "錯誤"
                      : "Error"
                    : zh
                      ? "警告"
                      : "Warning"}
                </span>
                <code className="text-xs">{diagnostic.code}</code>
                {(diagnostic.bandId ||
                  diagnostic.controlId ||
                  diagnostic.fieldName ||
                  diagnostic.category === "data") && (
                  <button
                    aria-label={`${zh ? "定位" : "Locate"} ${diagnostic.controlId ?? diagnostic.bandId ?? diagnostic.fieldName ?? "data"}`}
                    onClick={() => focusDiagnostic(diagnostic)}
                    className="ml-auto text-xs rounded px-2 py-1 bg-blue-600 text-white"
                  >
                    {zh ? "定位" : "Locate"}
                  </button>
                )}
              </div>
              <p className="text-sm mt-1 whitespace-pre-wrap">
                {diagnostic.message}
              </p>
              <p className="text-xs text-slate-500 break-all">
                {diagnostic.path}
                {diagnostic.rowIndex !== undefined
                  ? ` · row ${diagnostic.rowIndex + 1}`
                  : ""}
                {diagnostic.subReportControlPath?.length
                  ? ` · ${diagnostic.subReportControlPath.join(" / ")}`
                  : ""}
              </p>
            </li>
          ))}
      </ul>
      {!result.diagnostics.length && (
        <p className="text-sm text-slate-500">
          {zh
            ? "未發現結構、繫結、公式或分頁問題。"
            : "No structure, binding, formula or pagination issues found."}
        </p>
      )}
    </section>
  );
}
