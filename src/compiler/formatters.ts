import { Decimal } from 'decimal.js';

const NumericFormat = Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP });
const numberFormats = new Map<string, Intl.NumberFormat>();

/** Presentation never feeds a rounded or formatted result back into calculations. */
export function formatValue(value: unknown, formatString?: string, timeZone = 'UTC'): string {
  if (value === null || value === undefined) return '';
  if (!formatString) return String(value);
  const format = formatString.trim();
  const standard = /^([CNP])(\d{0,2})$/i.exec(format);
  const numeric = /^(?:number:|#,##)(0)(?:\.(0+))?$/i.exec(format);
  const alias = format.toLowerCase();
  if (standard || numeric || alias === 'currency' || alias === 'percent') {
    if ((typeof value !== 'number' && typeof value !== 'string') || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value))) return String(value);
    const number = new NumericFormat(value);
    if (!number.isFinite() || Math.abs(number.e) > 100) return String(value);
    const kind = standard?.[1].toUpperCase() ?? (alias === 'currency' ? 'C' : alias === 'percent' ? 'P' : 'N');
    const decimals = standard ? (standard[2] ? Number(standard[2]) : kind === 'N' ? 0 : 2)
      : numeric ? (numeric[2]?.length ?? 0) : 2;
    if (decimals > 20) return String(value);
    const key = kind + decimals;
    let formatter = numberFormats.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat('zh-TW', {
        ...(kind === 'C' ? { style: 'currency', currency: 'TWD' } : kind === 'P' ? { style: 'percent' } : {}),
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      });
      numberFormats.set(key, formatter);
    }
    const fixed = (kind === 'P' ? number.times(100) : number).toFixed(decimals);
    const negative = fixed.startsWith('-');
    const [whole, fraction] = (negative ? fixed.slice(1) : fixed).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Intl supplies the locale's signs and currency/percent affixes; Decimal supplies exact digits.
    return formatter.formatToParts(negative ? -1 : 1).map(part => part.type === 'integer' ? grouped
      : part.type === 'fraction' ? fraction : part.type === 'group' ? '' : part.value).join('');
  }
  if (alias === 'date' || alias.startsWith('date:')) {
    let parts: Record<string, string>;
    const pure = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (pure) parts = { year: pure[1], month: pure[2], day: pure[3], hour: '00', minute: '00', second: '00' };
    else if (value instanceof Date) parts = {
      year: String(value.getFullYear()), month: String(value.getMonth() + 1).padStart(2, '0'), day: String(value.getDate()).padStart(2, '0'),
      hour: String(value.getHours()).padStart(2, '0'), minute: String(value.getMinutes()).padStart(2, '0'), second: String(value.getSeconds()).padStart(2, '0'),
    };
    else {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return String(value);
      try { parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value])); }
      catch { return String(value); }
    }
    const tokens: Record<string, string> = { YYYY: parts.year, yyyy: parts.year, MM: parts.month, DD: parts.day, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second };
    const pattern = format.includes(':') ? format.slice(5) : 'YYYY-MM-DD';
    return pattern.replace(/YYYY|yyyy|MM|DD|dd|HH|mm|ss/g, token => tokens[token]);
  }
  return String(value);
}
