import { validateReportDocument } from "../../report/validateDocument";
import { useState } from "react";
import { useReportStore } from "../../store/useReportStore";
import { useCurrentLocale } from "../../i18n";
export function DataSourceEditor() {
  const state = useReportStore(),
    zh = useCurrentLocale().locale === "zh-TW";
  const [base, setBase] = useState(() => state.getDocument());
  const [text, setText] = useState(() =>
    JSON.stringify(base.dataSource, null, 2),
  );
  const [reportText, setReportText] = useState(() =>
    JSON.stringify(base.report, null, 2),
  );
  const [replaceReport, setReplaceReport] = useState(false);
  const [message, setMessage] = useState("");
  const changed = base !== state.getDocument();
  const reload = () => {
    const next = state.getDocument();
    setBase(next);
    setText(JSON.stringify(next.dataSource, null, 2));
    setReportText(JSON.stringify(next.report, null, 2));
    setMessage("");
  };
  const exportDocument = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state.getDocument(), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.report.name || "report"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importDocument = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Document exceeds 20 MiB");
      const before = state.getDocument(),
        value = JSON.parse(await file.text());
      if (state.getDocument() !== before)
        throw new Error(
          zh
            ? "讀取期間文件已變更，請重試匯入。"
            : "Document changed while reading; retry the import.",
        );
      state.setDocument(validateReportDocument(value));
      reload();
      setMessage(
        zh
          ? "已匯入文件，可使用復原還原。"
          : "Document imported. Undo is available.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const apply = () => {
    try {
      if (changed)
        throw new Error(
          zh
            ? "文件已變更，請先載入目前版本再套用。"
            : "Document changed. Load the current version before applying.",
        );
      state.setDocument(
        validateReportDocument({
          formatVersion: 1,
          dataSource: JSON.parse(text),
          report: replaceReport ? JSON.parse(reportText) : state.report,
        }),
      );
      setBase(state.getDocument());
      setMessage(
        zh ? "已套用資料來源與範本。" : "Data source and report applied.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="flex-1 p-5 flex flex-col gap-3 bg-slate-950 text-slate-100 h-[calc(100vh-6rem)] overflow-auto">
      <div className="flex gap-3 items-center">
        <h2 className="font-semibold">{zh ? "資料來源" : "Data source"}</h2>
        <span className="text-xs text-slate-400">
          {state.dataSource.name} · {state.data.length} {zh ? "筆資料" : "rows"}
        </span>
        <button onClick={apply} className="px-3 py-1 rounded bg-blue-600">
          {zh ? "驗證並套用" : "Validate and apply"}
        </button>
        <button onClick={reload} className="px-3 py-1 rounded bg-slate-700">
          {zh ? "載入目前版本" : "Load current version"}
        </button>
      </div>
      <div className="flex gap-3 items-center text-xs">
        <button
          onClick={exportDocument}
          className="px-3 py-1 rounded bg-slate-700"
        >
          {zh ? "匯出文件 JSON" : "Export document JSON"}
        </button>
        <label>
          {zh ? "匯入文件 JSON：" : "Import document JSON: "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void importDocument(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-sm text-slate-400">
        {zh
          ? "設定 schema、data.parameters 與 data.items。MCP、公式與 PDF 將使用同一份資料；切換 schema 時可一併更新報表。"
          : "Define schema, data.parameters and data.items. MCP, formulas and PDF use these saved values. Replace the report together when switching schemas."}
      </p>
      {changed && (
        <p role="alert" className="text-amber-300">
          {zh
            ? "文件已變更；編輯內容已保留，請先載入目前版本。"
            : "Document changed; your draft is preserved. Load the current version."}
        </p>
      )}
      {message && (
        <pre
          role="status"
          className="text-sm whitespace-pre-wrap text-amber-200"
        >
          {message}
        </pre>
      )}
      <textarea
        aria-label="Data source JSON"
        spellCheck={false}
        className="flex-1 min-h-72 bg-slate-900 border border-slate-700 rounded p-3 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="text-sm flex gap-2">
        <input
          type="checkbox"
          checked={replaceReport}
          onChange={(e) => setReplaceReport(e.target.checked)}
        />
        {zh
          ? "同時更新報表範本（原子套用）"
          : "Replace report in the same transaction"}
      </label>
      {replaceReport && (
        <textarea
          aria-label="Compatible report JSON"
          spellCheck={false}
          className="min-h-72 bg-slate-900 p-3 font-mono text-xs"
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
        />
      )}
    </section>
  );
}
