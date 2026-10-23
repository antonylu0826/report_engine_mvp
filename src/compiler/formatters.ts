/** Supported formats are explicit so malformed input never reaches Intl options. */
const numberFormats = new Map<string, Intl.NumberFormat>();

export function formatValue(value: unknown, formatString?: string): string {
  if (value === null || value === undefined) return '';
  if (!formatString) return String(value);
  const format = formatString.trim();
  const standard = /^([CNP])(\d{0,2})$/i.exec(format);
  const numeric = /^(?:number:|#,##)(0)(?:\.(0+))?$/i.exec(format);
  const alias = format.toLowerCase();
  if (standard || numeric || alias === 'currency' || alias === 'percent') {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
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
    return formatter.format(num);
  }
  if (alias === 'date' || alias.startsWith('date:')) {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const pattern = format.includes(':') ? format.slice(5) : 'YYYY-MM-DD';
    return pattern.replace(/yyyy|MM|dd/gi, token => token.toLowerCase() === 'yyyy' ? year : token.toLowerCase() === 'mm' ? month : day);
  }
  return String(value);
}
