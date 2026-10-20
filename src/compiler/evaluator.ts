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
  }

  // 2. No expression provided
  if (!expression) {
    return undefined;
  }

  const expr = expression.trim();
  const dataset = context.groupRows || context.dataSource;

  // Aggregate: SUM(fieldname)
  const sumMatch = expr.match(/^=?(?:SUM|sum)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)$/);
  if (sumMatch && dataset) {
    const targetField = sumMatch[1];
    return dataset.reduce((acc, row) => {
      const val = Number(getNestedValue(row, targetField)) || 0;
      return acc + val;
    }, 0);
  }

  // Aggregate: COUNT()
  const countMatch = expr.match(/^=?(?:COUNT|count)\s*\(\s*\)$/);
  if (countMatch && dataset) {
    return dataset.length;
  }

  // Aggregate: AVG(fieldname)
  const avgMatch = expr.match(/^=?(?:AVG|avg)\s*\(\s*([a-zA-Z0-9_.]+)\s*\)$/);
  if (avgMatch && dataset && dataset.length > 0) {
    const targetField = avgMatch[1];
    const total = dataset.reduce((acc, row) => {
      const val = Number(getNestedValue(row, targetField)) || 0;
      return acc + val;
    }, 0);
    return total / dataset.length;
  }

  // Row Index: ROW_INDEX or INDEX
  if (expr === '=ROW_INDEX' || expr === '=INDEX') {
    return (context.rowIndex ?? 0) + 1;
  }

  // Fallback to literal if not recognized
  return expr.startsWith('=') ? expr.slice(1) : expr;
}
