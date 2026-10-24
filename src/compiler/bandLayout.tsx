import React from "react";
import { View } from "@react-pdf/renderer";
import type { BandDefinition, ControlDefinition } from "../types/report";
import type { EvalContext } from "./evaluator";
import {
  controlGrows as grows,
  keepsFixedBandTogether,
} from "../report/pagination";
import {
  bandIsVisible,
  resolveControlAppearance,
} from "../formula/presentation";
export { isFlowBand } from "../report/pagination";
interface Row {
  top: number;
  bottom: number;
  controls: ControlDefinition[];
}
/** Preserve overlapping controls in a row, then let native text layout displace following rows. */
export function renderBandFrame(
  band: BandDefinition,
  context: EvalContext,
  key: string,
  render: (control: ControlDefinition, context: EvalContext) => React.ReactNode,
  pageBreakBefore = band.pageBreakBefore,
  fixed = false,
) {
  if (!bandIsVisible(band, context)) return null;
  band = {
    ...band,
    controls: band.controls
      .map((c) => resolveControlAppearance(c, context))
      .filter((c): c is ControlDefinition => c !== null),
  };
  // react-pdf tests for the presence of `fixed`, even when false, before honoring page breaks.
  // Omit the prop on ordinary bands so keepTogether and pageBreakBefore remain effective.
  if (keepsFixedBandTogether(band))
    return (
      <View
        key={key}
        {...(fixed ? { fixed: true } : {})}
        wrap={false}
        break={pageBreakBefore}
        style={{ position: "relative", width: "100%", height: band.height }}
      >
        {band.controls.map((c) => (
          <React.Fragment key={c.id}>{render(c, context)}</React.Fragment>
        ))}
      </View>
    );
  const decoration = band.controls.filter(
    (c) => c.type === "Line" || c.type === "Panel",
  );
  const controls = band.controls
    .filter((c) => !decoration.includes(c))
    .sort((a, b) => a.y - b.y);
  const rows: Row[] = [];
  for (const control of controls) {
    const previous = rows.at(-1);
    if (previous && control.y < previous.bottom) {
      previous.controls.push(control);
      previous.bottom = Math.max(previous.bottom, control.y + control.height);
    } else
      rows.push({
        top: control.y,
        bottom: control.y + control.height,
        controls: [control],
      });
  }
  let bottom = 0;
  return (
    <View
      key={key}
      {...(fixed ? { fixed: true } : {})}
      break={pageBreakBefore}
      wrap
      style={{ position: "relative", width: "100%", minHeight: band.height }}
    >
      {decoration.map((c) => (
        <React.Fragment key={c.id}>{render(c, context)}</React.Fragment>
      ))}
      {rows.map((row) => {
        const marginTop = Math.max(0, row.top - bottom);
        bottom = row.bottom;
        const dynamic = row.controls.filter(grows).sort((a, b) => a.x - b.x);
        let right = 0;
        return (
          <View
            key={row.top}
            wrap={dynamic.length > 0}
            style={{
              position: "relative",
              minHeight: row.bottom - row.top,
              flexDirection: "row",
              alignItems: "flex-start",
              marginTop,
            }}
          >
            {row.controls
              .filter((c) => !grows(c))
              .map((c) => (
                <React.Fragment key={c.id}>
                  {render({ ...c, y: c.y - row.top }, context)}
                </React.Fragment>
              ))}
            {dynamic.map((c) => {
              const marginLeft = c.x - right;
              right = c.x + c.width;
              return (
                <View
                  key={c.id}
                  wrap
                  style={{
                    position: "relative",
                    width: c.width,
                    minHeight: c.height,
                    marginLeft,
                    marginTop: c.y - row.top,
                    flexShrink: 0,
                  }}
                >
                  {render({ ...c, x: 0, y: 0 }, context)}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
