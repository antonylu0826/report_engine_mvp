import type { BandDefinition, ControlDefinition } from "../types/report";
import type { FormulaContext } from "./types";
import { FormulaError, fail } from "./types";
import { evaluateFormula } from "./engine";
export const conditionalStyleProperties = [
  "color",
  "backgroundColor",
  "fontWeight",
  "textAlign",
  "borderColor",
] as const;
/** A predicate accepts only boolean or null. Null means false; no JavaScript coercion is used. */
export function evaluatePredicate(
  expression: string,
  context: FormulaContext,
  path?: string,
): boolean {
  try {
    const result = evaluateFormula(expression, context);
    if (result !== null && typeof result !== "boolean")
      fail("TYPE_MISMATCH", "Print conditions must return boolean or null");
    return result === true;
  } catch (error) {
    if (path && error instanceof FormulaError)
      throw new FormulaError(
        error.diagnostics.map((d) => ({ ...d, path: d.path ?? path })),
      );
    throw error;
  }
}
export function bandIsVisible(
  band: BandDefinition,
  context: FormulaContext,
  path?: string,
): boolean {
  return (
    !band.visibleWhen ||
    evaluatePredicate(
      band.visibleWhen,
      context,
      path ? path + ".visibleWhen" : undefined,
    )
  );
}
/** Visibility is evaluated first. Hidden controls do not execute their style rules or content. */
export function resolveControlAppearance(
  control: ControlDefinition,
  context: FormulaContext,
  path?: string,
): ControlDefinition | null {
  if (
    control.visibleWhen &&
    !evaluatePredicate(
      control.visibleWhen,
      context,
      path ? path + ".visibleWhen" : undefined,
    )
  )
    return null;
  let style = control.style;
  for (const [index, rule] of (control.styleRules ?? []).entries()) {
    if (
      evaluatePredicate(
        rule.when,
        context,
        path ? `${path}.styleRules[${index}].when` : undefined,
      )
    )
      style = { ...style, ...rule.style };
  }
  return style === control.style ? control : { ...control, style };
}
