import type { BandDefinition, ControlDefinition } from "../types/report";
export const controlGrows = (control: ControlDefinition) =>
  control.type === "SubReport" ||
  !!(
    control.canGrow && ["Label", "Field", "Expression"].includes(control.type)
  );
export const isFlowBand = (band: BandDefinition) =>
  band.controls.some(controlGrows);
export const keepsFixedBandTogether = (band: BandDefinition) =>
  !isFlowBand(band) && band.keepTogether !== false;
