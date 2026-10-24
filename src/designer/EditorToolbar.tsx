import { useReportStore, type ArrangeMode } from "../store/useReportStore";
import { useCurrentLocale } from "../i18n";
export function EditorToolbar() {
  const state = useReportStore();
  const zh = useCurrentLocale().locale === "zh-TW";
  const labels: [ArrangeMode, string, string][] = [
    ["left", "靠左", "Left"],
    ["center", "水平置中", "Center"],
    ["right", "靠右", "Right"],
    ["top", "靠上", "Top"],
    ["middle", "垂直置中", "Middle"],
    ["bottom", "靠下", "Bottom"],
    ["horizontal", "水平等距", "Distribute H"],
    ["vertical", "垂直等距", "Distribute V"],
  ];
  const button =
    "px-2 py-1 rounded border border-slate-300 disabled:opacity-35 hover:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <div
      role="toolbar"
      aria-label={zh ? "編輯工具" : "Editing tools"}
      className="shrink-0 flex flex-wrap gap-1 items-center px-3 py-1 bg-white border-b text-xs dark:bg-slate-950 dark:text-slate-200"
    >
      <button
        className={button}
        disabled={!state.canUndo}
        onClick={state.undo}
        title="Ctrl/Cmd+Z"
      >
        {zh ? "復原" : "Undo"}
      </button>
      <button
        className={button}
        disabled={!state.canRedo}
        onClick={state.redo}
        title="Ctrl/Cmd+Shift+Z"
      >
        {zh ? "重做" : "Redo"}
      </button>
      {state.activeTab === "designer" && (
        <>
          <button
            className={button}
            disabled={!state.selectedControlIds.length}
            onClick={state.copySelection}
          >
            {zh ? "複製" : "Copy"}
          </button>
          <button
            className={button}
            disabled={!state.selectedBandId}
            onClick={state.pasteSelection}
          >
            {zh ? "貼上" : "Paste"}
          </button>
          <button
            className={button}
            disabled={!state.selectedControlIds.length}
            onClick={state.deleteSelection}
          >
            {zh ? "刪除" : "Delete"}
          </button>
          {labels.map(([mode, chinese, english]) => (
            <button
              className={button}
              key={mode}
              disabled={
                state.selectedControlIds.length <
                (["horizontal", "vertical"].includes(mode) ? 3 : 2)
              }
              onClick={() => state.arrangeSelection(mode)}
            >
              {zh ? chinese : english}
            </button>
          ))}
          <span className="text-slate-500 ml-2">
            {zh
              ? `已選 ${state.selectedControlIds.length} 個 · Shift 點選可多選`
              : `${state.selectedControlIds.length} selected · Shift-click to add`}
          </span>
        </>
      )}
    </div>
  );
}
