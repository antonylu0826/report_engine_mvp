import type { SemanticTheme } from './types';

export interface ThemeColors {
  primary: string;
  subtitle: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  tableBorder: string;
  rowBorder: string;
  totalHighlight: string;
  divider: string;
}

export const THEME_PALETTES: Record<SemanticTheme, ThemeColors> = {
  slate: {
    primary: '#0f172a',
    subtitle: '#475569',
    tableHeaderBg: '#f1f5f9',
    tableHeaderText: '#1e293b',
    tableBorder: '#94a3b8',
    rowBorder: '#e2e8f0',
    totalHighlight: '#0284c7',
    divider: '#0f172a',
  },
  blue: {
    primary: '#1e3a8a',
    subtitle: '#2563eb',
    tableHeaderBg: '#dbeafe',
    tableHeaderText: '#1e40af',
    tableBorder: '#93c5fd',
    rowBorder: '#e0f2fe',
    totalHighlight: '#2563eb',
    divider: '#1d4ed8',
  },
  emerald: {
    primary: '#064e3b',
    subtitle: '#059669',
    tableHeaderBg: '#d1fae5',
    tableHeaderText: '#065f46',
    tableBorder: '#6ee7b7',
    rowBorder: '#ecfdf5',
    totalHighlight: '#059669',
    divider: '#047857',
  },
  purple: {
    primary: '#4c1d95',
    subtitle: '#7c3aed',
    tableHeaderBg: '#ede9fe',
    tableHeaderText: '#5b21b6',
    tableBorder: '#c4b5fd',
    rowBorder: '#f5f3ff',
    totalHighlight: '#7c3aed',
    divider: '#6d28d9',
  },
  amber: {
    primary: '#78350f',
    subtitle: '#b45309',
    tableHeaderBg: '#fef3c7',
    tableHeaderText: '#92400e',
    tableBorder: '#fcd34d',
    rowBorder: '#fffbeb',
    totalHighlight: '#d97706',
    divider: '#b45309',
  },
};
