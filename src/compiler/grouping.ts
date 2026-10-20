import { getNestedValue } from './evaluator';

export interface ReportGroup {
  key: string;
  field: string;
  rows: Record<string, unknown>[];
}

/**
 * Group raw dataset rows by a designated field name
 */
export function groupDataRows(
  data: Record<string, unknown>[],
  groupByField?: string,
  sortOrder: 'asc' | 'desc' = 'asc'
): ReportGroup[] {
  if (!data || data.length === 0) return [];

  // If no group field specified, return all items in a single default group
  if (!groupByField) {
    return [
      {
        key: 'all',
        field: '',
        rows: [...data],
      },
    ];
  }

  const map = new Map<string, Record<string, unknown>[]>();

  for (const row of data) {
    const rawKey = getNestedValue(row, groupByField);
    const key = rawKey !== undefined && rawKey !== null ? String(rawKey) : '未分類';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }

  const groups: ReportGroup[] = [];
  for (const [key, rows] of map.entries()) {
    groups.push({
      key,
      field: groupByField,
      rows,
    });
  }

  // Sort groups by key
  groups.sort((a, b) => {
    const cmp = a.key.localeCompare(b.key, 'zh-Hant');
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  return groups;
}
