import { evaluateFormula, getNestedValue, isRenderTemplate } from '../formula/engine.ts';
import type { FormulaContext } from '../formula/types.ts';
import { serializeValue } from '../formula/values.ts';

export { getNestedValue };
export type EvalContext = FormulaContext;

/** Shared binding and formula evaluator. Invalid formulas always produce diagnostics. */
export function evaluateExpression(expression: string | undefined, fieldName: string | undefined, context: EvalContext): unknown {
  const source = fieldName || expression;
  if (!source) return undefined;
  if (!fieldName && isRenderTemplate(source)) return source.replace(/\[ExecutionTime\]/g, context.executionTime ?? '');
  return serializeValue(evaluateFormula(source, context));
}
