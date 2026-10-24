import { useState } from "react";
import { useFormulaData } from "../../formula/useFormulaData";
import { useReportStoreApi } from "../../../store/useReportStore";
import { useCurrentLocale } from "../../../i18n";
import { conditionalStylesByControl } from "../../../report/presentationCapabilities";
import { patchControl, updateReportBand } from "../../../report/operations";
import { parseReport } from "../../../report/schema";
import {
  validateReportFormulas,
  createFormulaRun,
} from "../../../formula/report";
import {
  bandIsVisible,
  resolveControlAppearance,
} from "../../../formula/presentation";
import type { ControlDefinition } from "../../../types/report";
export function ConditionalPrintSection({
  bandId,
  control,
}: {
  bandId: string;
  control?: ControlDefinition;
}) {
  const { state, report, schema, data, parameters } = useFormulaData(),
    store = useReportStoreApi(),
    zh = useCurrentLocale().locale === "zh-TW";
  const band = report.bands.find((b) => b.id === bandId)!;
  const target = control ?? band;
  const [base, setBase] = useState(target),
    [visibleWhen, setVisible] = useState(target.visibleWhen ?? "");
  const [rules, setRules] = useState(
    () =>
      control?.styleRules?.map((rule) => ({
        when: rule.when,
        styleText: JSON.stringify(rule.style),
      })) ?? [],
  );
  const [message, setMessage] = useState("");
  const allowed = control ? conditionalStylesByControl[control.type] : [];
  const reload = () => {
    setBase(target);
    setVisible(target.visibleWhen ?? "");
    setRules(
      control?.styleRules?.map((rule) => ({
        when: rule.when,
        styleText: JSON.stringify(rule.style),
      })) ?? [],
    );
    setMessage("");
  };
  const apply = () => {
    try {
      if (target !== base)
        throw new Error(
          zh
            ? "目標已變更，請先載入目前設定。"
            : "Target changed; load current settings first.",
        );
      const styleRules = rules.length
        ? rules.map((rule) => ({
            when: rule.when,
            style: JSON.parse(rule.styleText),
          }))
        : undefined;
      const patch = {
        visibleWhen: visibleWhen.trim() || undefined,
        ...(control ? { styleRules } : {}),
      };
      const next = parseReport(
        control
          ? patchControl(report, bandId, control.id, patch)
          : updateReportBand(report, bandId, (b) => ({ ...b, ...patch })),
      );
      const validation = validateReportFormulas(next, { schema });
      if (!validation.valid)
        throw new Error(
          validation.diagnostics
            .map((d) => `${d.path}: ${d.message}`)
            .join("\n"),
        );
      if (control) state.updateControl(bandId, control.id, patch);
      else state.updateBand(bandId, patch);
      const current = store
        .getState()
        .getActiveReport()
        .bands.find((b) => b.id === bandId)!;
      setBase(
        control ? current.controls.find((c) => c.id === control.id)! : current,
      );
      setMessage(zh ? "條件設定已套用。" : "Conditions applied.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  let preview = "";
  try {
    const context = createFormulaRun(report, {
      schema,
      dataSource: data,
      reportParameters: parameters,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    const local = ["Detail", "GroupHeader", "GroupFooter"].includes(band.type)
      ? {
          ...context,
          currentRow: data[0],
          rowIndex: 0,
          groupRows: context.reportGroups?.[0]?.rows,
        }
      : context;
    const bandVisible = bandIsVisible(band, local);
    const appearance =
      control && bandVisible
        ? resolveControlAppearance(control, local)
        : undefined;
    const visible = bandVisible && (!control || !!appearance);
    preview = zh
      ? `目前範例：${visible ? "顯示" : "隱藏"}${control && appearance ? " · " + JSON.stringify(appearance.style ?? {}) : ""}`
      : `Current sample: ${visible ? "visible" : "hidden"}${control && appearance ? " · " + JSON.stringify(appearance.style ?? {}) : ""}`;
  } catch (error) {
    preview =
      (zh ? "範例診斷：" : "Sample diagnostic: ") +
      (error instanceof Error ? error.message : String(error));
  }
  return (
    <section
      className="border-t border-slate-200 pt-3 space-y-2"
      aria-label={zh ? "條件式列印" : "Conditional printing"}
    >
      <h3 className="font-medium">
        {zh ? "條件式列印" : "Conditional printing"}
      </h3>
      <label className="block space-y-1">
        <span>{zh ? "顯示條件" : "Visible when"}</span>
        <input
          aria-label={zh ? "顯示條件" : "Visible when"}
          value={visibleWhen}
          onChange={(e) => setVisible(e.target.value)}
          placeholder="=quantity > 0"
          className="w-full border rounded p-2 font-mono bg-transparent"
        />
      </label>
      <p className="text-[10px] text-slate-500">
        {zh
          ? "留空為顯示；公式須回傳 boolean，null 視為隱藏。區段隱藏會收起空間。"
          : "Empty means visible. Conditions return boolean; null means hidden. Hidden bands collapse their space."}
      </p>
      {allowed.length > 0 && (
        <>
          <p className="text-[10px] text-slate-500">
            {zh
              ? "樣式規則依序套用，後面的符合規則優先。可設定："
              : "Matching styles merge in order; later rules win. Supported: "}
            {allowed.join(", ")}
          </p>
          {rules.map((rule, index) => (
            <div key={index} className="border rounded p-2 space-y-1">
              <input
                aria-label={`${zh ? "樣式條件" : "Style condition"} ${index + 1}`}
                className="w-full bg-transparent border rounded p-1 font-mono"
                value={rule.when}
                placeholder="=calc.amount < 0"
                onChange={(e) =>
                  setRules((previous) =>
                    previous.map((r, i) =>
                      i === index ? { ...r, when: e.target.value } : r,
                    ),
                  )
                }
              />
              <textarea
                aria-label={`${zh ? "條件樣式 JSON" : "Conditional style JSON"} ${index + 1}`}
                className="w-full bg-transparent border rounded p-1 font-mono"
                value={rule.styleText}
                onChange={(e) =>
                  setRules((previous) =>
                    previous.map((r, i) =>
                      i === index ? { ...r, styleText: e.target.value } : r,
                    ),
                  )
                }
              />
              <button
                onClick={() =>
                  setRules((previous) => previous.filter((_, i) => i !== index))
                }
              >
                {zh ? "移除此規則" : "Remove rule"}
              </button>
            </div>
          ))}
          <button
            disabled={rules.length >= 32}
            onClick={() =>
              setRules((previous) => [
                ...previous,
                {
                  when: "=TRUE",
                  styleText: JSON.stringify({
                    [allowed[0]]:
                      allowed[0] === "color" ? "#dc2626" : "#fee2e2",
                  }),
                },
              ])
            }
            className="border rounded px-2 py-1"
          >
            {zh ? "新增樣式規則" : "Add style rule"}
          </button>
        </>
      )}
      {target !== base && (
        <p className="text-amber-600">
          {zh
            ? "設定已變更，草稿已保留。"
            : "Settings changed; your draft is preserved."}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={apply}
          className="rounded px-2 py-1 bg-blue-600 text-white"
        >
          {zh ? "套用條件" : "Apply conditions"}
        </button>
        <button onClick={reload} className="border rounded px-2 py-1">
          {zh ? "載入目前設定" : "Load current settings"}
        </button>
      </div>
      {message && (
        <p
          role="status"
          className="whitespace-pre-wrap break-all text-amber-600"
        >
          {message}
        </p>
      )}
      <p
        data-testid="condition-preview"
        className="text-[10px] break-all text-slate-500"
      >
        {preview}
      </p>
    </section>
  );
}
