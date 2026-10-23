import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import { fail, type FormulaContext, type FormulaType, type FormulaValue } from './types.ts';

export const Numeric = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP, modulo: Decimal.ROUND_FLOOR });
export function checked(value: Decimal): Decimal {
  if (!value.isFinite() || (!value.isZero() && (value.e > 100 || value.e < -100))) fail('NUMERIC_OVERFLOW', 'Number must have an exponent between -100 and 100');
  return value;
}
export function decimal(value: string | number): Decimal {
  let result: Decimal;
  try { result = new Numeric(value); } catch { return fail('TYPE_MISMATCH', 'Expected a finite decimal number'); }
  if (result.sd() > 34) fail('NUMERIC_OVERFLOW', 'Number exceeds 34 significant digits');
  return checked(result);
}
export function numberValue(value: FormulaValue): Decimal {
  if (!Decimal.isDecimal(value)) fail('TYPE_MISMATCH', 'Expected number; use TO_NUMBER for explicit conversion');
  return value;
}
export function stringValue(value: FormulaValue): string {
  if (typeof value !== 'string') fail('TYPE_MISMATCH', 'Expected string; use TO_TEXT for explicit conversion');
  return value;
}
export function booleanValue(value: FormulaValue): boolean | null {
  if (value === null || typeof value === 'boolean') return value;
  return fail('TYPE_MISMATCH', 'Expected boolean');
}
export function integer(value: FormulaValue, minimum = -100_000, maximum = 100_000): number {
  const number = numberValue(value);
  if (!number.isInteger() || number.lt(minimum) || number.gt(maximum)) fail('INVALID_ARGUMENT', `Expected integer between ${minimum} and ${maximum}`);
  return number.toNumber();
}
export function valueType(value: FormulaValue): FormulaType | 'null' {
  if (value === null) return 'null';
  if (Decimal.isDecimal(value)) return 'number';
  if (value instanceof Temporal.PlainDate) return 'date';
  if (value instanceof Temporal.Instant) return 'datetime';
  return typeof value as 'string' | 'boolean';
}
export function plainDate(value: FormulaValue, context: FormulaContext): Temporal.PlainDate {
  if (value instanceof Temporal.PlainDate) return value;
  if (value instanceof Temporal.Instant) return value.toZonedDateTimeISO(context.timeZone ?? 'UTC').toPlainDate();
  const text = stringValue(value);
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Temporal.PlainDate.from(text, { overflow: 'reject' });
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return Temporal.Instant.from(text).toZonedDateTimeISO(context.timeZone ?? 'UTC').toPlainDate();
  } catch { /* mapped to a stable engine diagnostic */ }
  return fail('INVALID_DATE', 'Expected valid ISO YYYY-MM-DD or datetime with an explicit offset');
}
export function dateValue(value: FormulaValue, context: FormulaContext): Temporal.PlainDate | Temporal.Instant {
  if (value instanceof Temporal.PlainDate || value instanceof Temporal.Instant) return value;
  const text = stringValue(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return plainDate(text, context);
  try {
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) return Temporal.Instant.from(text);
  } catch { /* mapped below */ }
  return fail('INVALID_DATE', 'Expected valid ISO date or datetime with an explicit offset');
}
export function normalize(value: unknown, type?: string, context: FormulaContext = {}): FormulaValue {
  if (value === undefined || value === null) return null;
  if (type === 'date' || type === 'datetime') {
    if (typeof value !== 'string') fail('TYPE_MISMATCH', `Expected ${type} as ISO text`);
    const date = dateValue(value, context);
    if (type === 'date' && !(date instanceof Temporal.PlainDate)) fail('TYPE_MISMATCH', 'Expected pure YYYY-MM-DD date; use TO_DATE to convert datetime');
    if (type === 'datetime' && !(date instanceof Temporal.Instant)) fail('TYPE_MISMATCH', 'Expected datetime with an explicit offset');
    return date;
  }
  if (type && typeof value !== type) fail('TYPE_MISMATCH', `Expected ${type}, received ${typeof value}`);
  if (typeof value === 'number') return decimal(value);
  if (typeof value === 'string' && value.length > 100_000) fail('LIMIT_EXCEEDED', 'Formula text input exceeds 100000 characters');
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  return fail('TYPE_MISMATCH', 'Formula values must be scalar; use an aggregate for dataset rows');
}
/** Preserve exact decimals at the JSON boundary when a JS number cannot round-trip. */
export function serializeValue(value: FormulaValue): string | number | boolean | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Decimal.isDecimal(value)) {
    const num = value.toNumber();
    return Number.isFinite(num) && new Numeric(num).eq(value) ? num : value.toString();
  }
  return value.toString();
}
