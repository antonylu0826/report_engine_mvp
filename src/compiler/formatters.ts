/**
 * Value formatters for report fields and expressions
 */

export function formatValue(value: unknown, formatString?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (!formatString) {
    return String(value);
  }

  const format = formatString.trim();

  // Currency: e.g. "C", "C0", "C2", "currency"
  if (format.startsWith('C') || format.toLowerCase() === 'currency') {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    const decimals = format.length > 1 && !isNaN(Number(format.slice(1))) ? Number(format.slice(1)) : 2;
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  // Number with thousand separator: e.g. "N", "N0", "N2"
  if (format.startsWith('N') || format.startsWith('#,##0')) {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    const decimals = format.startsWith('N') && format.length > 1 && !isNaN(Number(format.slice(1))) 
      ? Number(format.slice(1)) 
      : 0;
    return new Intl.NumberFormat('zh-TW', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  // Percentage: e.g. "P", "P1", "P2"
  if (format.startsWith('P') || format.toLowerCase() === 'percent') {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    const decimals = format.length > 1 && !isNaN(Number(format.slice(1))) ? Number(format.slice(1)) : 2;
    return new Intl.NumberFormat('zh-TW', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  // Date format: e.g. "date:YYYY-MM-DD" or standard ISO
  if (format.startsWith('date:') || format.toLowerCase() === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (isNaN(date.getTime())) return String(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return String(value);
}
