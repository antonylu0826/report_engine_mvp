/**
 * Evaluation Engine for Data Binding and Formulas
 */

// Safely access nested property like "customer.address.city"
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    if (!Object.hasOwn(current, part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export interface EvalContext {
  currentRow?: Record<string, unknown>;
  rowIndex?: number;
  groupRows?: Record<string, unknown>[];
  dataSource?: Record<string, unknown>[];
  reportParameters?: Record<string, unknown>;
}

/**
 * Evaluates an expression or field value
 */
export function evaluateExpression(
  expression: string | undefined,
  fieldName: string | undefined,
  context: EvalContext
): unknown {
  // 1. Direct Field Binding
  if (fieldName) {
    const val = getNestedValue(context.currentRow, fieldName);
    if (val !== undefined) return val;

    // Fallback: check Master/Header reportParameters
    if (context.reportParameters) {
      const paramVal = getNestedValue(context.reportParameters, fieldName);
      if (paramVal !== undefined) return paramVal;
    }
  }

  // 2. No expression provided
  if (!expression) {
    return undefined;
  }

  const expr = expression.trim();
  const dataset = context.groupRows ?? context.dataSource ?? [];

  // Aggregate: SUM(fieldname)
  const sumMatch = expr.match(/^=?SUM\s*\(\s*([a-zA-Z0-9_.]+)\s*\)$/i);
  if (sumMatch) {
    const targetField = sumMatch[1];
    return dataset.reduce((acc, row) => {
      const val = Number(getNestedValue(row, targetField));
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
  }

  // Aggregate: COUNT()
  const countMatch = expr.match(/^=?COUNT\s*\(\s*\)$/i);
  if (countMatch) {
    return dataset.length;
  }

  // Aggregate: AVG(fieldname)
  const avgMatch = expr.match(/^=?AVG\s*\(\s*([a-zA-Z0-9_.]+)\s*\)$/i);
  if (avgMatch) {
    const targetField = avgMatch[1];
    const total = dataset.reduce((acc, row) => {
      const val = Number(getNestedValue(row, targetField));
      return acc + (Number.isFinite(val) ? val : 0);
    }, 0);
    return dataset.length ? total / dataset.length : 0;
  }

  // Row Index: ROW_INDEX or INDEX
  if (expr === '=ROW_INDEX' || expr === '=INDEX') {
    return (context.rowIndex ?? 0) + 1;
  }

  // Fallback to literal if not recognized
  return expr.startsWith('=') ? expr.slice(1) : expr;
}
