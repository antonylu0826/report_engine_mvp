/**
 * Agent Mutation Tools
 * High-level atomic operations for AI Agents to manipulate report specifications without touching raw coordinates.
 */

import type { SemanticReportSpec, SemanticColumn, SemanticTheme } from './types';

export function addColumn(
  spec: SemanticReportSpec,
  column: SemanticColumn,
  afterColumnId?: string
): SemanticReportSpec {
  const newCols = [...spec.columns];
  if (afterColumnId) {
    const idx = newCols.findIndex((c) => c.id === afterColumnId);
    if (idx !== -1) {
      newCols.splice(idx + 1, 0, column);
      return { ...spec, columns: newCols };
    }
  }
  newCols.push(column);
  return { ...spec, columns: newCols };
}

export function removeColumn(
  spec: SemanticReportSpec,
  columnId: string
): SemanticReportSpec {
  return {
    ...spec,
    columns: spec.columns.filter((c) => c.id !== columnId),
  };
}

export function updateColumn(
  spec: SemanticReportSpec,
  columnId: string,
  patch: Partial<SemanticColumn>
): SemanticReportSpec {
  return {
    ...spec,
    columns: spec.columns.map((col) =>
      col.id === columnId ? { ...col, ...patch } : col
    ),
  };
}

export function setTheme(
  spec: SemanticReportSpec,
  theme: SemanticTheme
): SemanticReportSpec {
  return {
    ...spec,
    theme,
  };
}

export function setReportTitle(
  spec: SemanticReportSpec,
  title: string,
  subtitle?: string
): SemanticReportSpec {
  return {
    ...spec,
    title,
    subtitle: subtitle !== undefined ? subtitle : spec.subtitle,
  };
}
