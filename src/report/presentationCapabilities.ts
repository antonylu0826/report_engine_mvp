import type { ControlType, ConditionalControlStyle } from "../types/report";
export const conditionalStylesByControl: Record<
  ControlType,
  readonly (keyof ConditionalControlStyle)[]
> = {
  Label: ["color", "backgroundColor", "fontWeight", "textAlign", "borderColor"],
  Field: ["color", "backgroundColor", "fontWeight", "textAlign", "borderColor"],
  Expression: [
    "color",
    "backgroundColor",
    "fontWeight",
    "textAlign",
    "borderColor",
  ],
  Line: ["color"],
  Panel: ["backgroundColor", "borderColor"],
  CheckBox: ["color"],
  SubReport: ["backgroundColor", "borderColor"],
  Image: [],
  Barcode: [],
  QRCode: [],
};
