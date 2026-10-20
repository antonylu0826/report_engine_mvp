/**
 * Semantic Spec Compiler
 * Transforms a high-level declarative SemanticReportSpec into a fully-resolved,
 * mathematically aligned Banded ReportDefinition.
 */

import type {
  ReportDefinition,
  BandDefinition,
  ControlDefinition,
  PageSettings,
} from '../types/report';
import { PAGE_SIZES } from '../types/report';
import type { SemanticReportSpec, SemanticColumn } from './types';
import { THEME_PALETTES } from './themes';

export function compileSemanticSpecToReport(
  spec: SemanticReportSpec
): ReportDefinition {
  const pageSize = spec.pageSettings?.size || 'A4';
  const orientation = spec.pageSettings?.orientation || 'portrait';
  const margins = spec.pageSettings?.margins || {
    top: 36,
    right: 36,
    bottom: 36,
    left: 36,
  };

  const pageSettings: PageSettings = {
    size: pageSize,
    orientation,
    margins,
  };

  const fullWidth = PAGE_SIZES[pageSize].width;
  const contentWidth = Math.floor(fullWidth - margins.left - margins.right);

  const themeName = spec.theme || 'slate';
  const theme = THEME_PALETTES[themeName] || THEME_PALETTES.slate;

  // 1. Calculate Columns Geometry
  const columns = spec.columns;
  const totalWeight = columns.reduce((acc, c) => acc + (c.widthWeight || 1), 0);

  let currentX = 0;
  interface ResolvedCol extends SemanticColumn {
    x: number;
    width: number;
  }

  const resolvedCols: ResolvedCol[] = columns.map((col, idx) => {
    const isLast = idx === columns.length - 1;
    let colWidth = Math.floor(((col.widthWeight || 1) / totalWeight) * contentWidth);
    if (isLast) {
      colWidth = contentWidth - currentX; // absorb rounding delta
    }
    const resolved: ResolvedCol = {
      ...col,
      x: currentX,
      width: colWidth,
    };
    currentX += colWidth;
    return resolved;
  });

  // 2. Build ReportHeader Band
  const reportHeaderControls: ControlDefinition[] = [];
  let headerHeight = 75;

  reportHeaderControls.push({
    id: 'ctl-main-title',
    type: 'Label',
    x: 0,
    y: 0,
    width: contentWidth,
    height: 24,
    text: spec.title,
    style: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.primary,
      textAlign: 'center',
    },
  });

  if (spec.subtitle) {
    reportHeaderControls.push({
      id: 'ctl-sub-title',
      type: 'Label',
      x: 0,
      y: 26,
      width: contentWidth,
      height: 18,
      text: spec.subtitle,
      style: {
        fontSize: 12,
        fontWeight: 'bold',
        color: theme.subtitle,
        textAlign: 'center',
      },
    });
  }

  if (spec.metaFields && spec.metaFields.length > 0) {
    const field1 = spec.metaFields[0];
    const field2 = spec.metaFields[1];
    if (field1) {
      reportHeaderControls.push({
        id: 'ctl-meta-1',
        type: 'Label',
        x: 0,
        y: 50,
        width: Math.floor(contentWidth * 0.5),
        height: 16,
        text: `${field1.label}：${field1.value}`,
        style: { fontSize: 9, color: '#334155' },
      });
    }
    if (field2) {
      reportHeaderControls.push({
        id: 'ctl-meta-2',
        type: 'Label',
        x: Math.floor(contentWidth * 0.5),
        y: 50,
        width: Math.floor(contentWidth * 0.5),
        height: 16,
        text: `${field2.label}：${field2.value}`,
        style: { fontSize: 9, color: '#334155', textAlign: 'right' },
      });
    }
  }

  reportHeaderControls.push({
    id: 'ctl-header-divider',
    type: 'Line',
    x: 0,
    y: 70,
    width: contentWidth,
    height: 1,
    style: { color: theme.divider },
  });

  const reportHeaderBand: BandDefinition = {
    id: 'band-report-header',
    type: 'ReportHeader',
    height: headerHeight,
    controls: reportHeaderControls,
  };

  // 3. Build PageHeader Band (Columns Table Header)
  const pageHeaderControls: ControlDefinition[] = [
    {
      id: 'th-background',
      type: 'Label',
      x: 0,
      y: 0,
      width: contentWidth,
      height: 22,
      text: '',
      style: {
        backgroundColor: theme.tableHeaderBg,
        borderBottomWidth: 1,
        borderTopWidth: 1,
        borderColor: theme.tableBorder,
      },
    },
  ];

  resolvedCols.forEach((col) => {
    pageHeaderControls.push({
      id: `th-${col.id}`,
      type: 'Label',
      x: col.x + (col.align === 'right' ? -4 : 4),
      y: 4,
      width: col.width,
      height: 16,
      text: col.label,
      style: {
        fontSize: 9,
        fontWeight: 'bold',
        color: theme.tableHeaderText,
        textAlign: col.align || 'left',
      },
    });
  });

  const pageHeaderBand: BandDefinition = {
    id: 'band-page-header',
    type: 'PageHeader',
    height: 24,
    controls: pageHeaderControls,
  };

  // 4. Build Detail Band (Row Template)
  const detailControls: ControlDefinition[] = [];

  resolvedCols.forEach((col) => {
    if (col.expression) {
      detailControls.push({
        id: `td-${col.id}`,
        type: 'Expression',
        x: col.x + (col.align === 'right' ? -4 : 4),
        y: 4,
        width: col.width,
        height: 14,
        expression: col.expression,
        formatString: col.format,
        style: {
          fontSize: 9,
          color: '#1e293b',
          textAlign: col.align || 'left',
        },
      });
    } else {
      detailControls.push({
        id: `td-${col.id}`,
        type: 'Field',
        x: col.x + (col.align === 'right' ? -4 : 4),
        y: 4,
        width: col.width,
        height: 14,
        fieldName: col.field,
        formatString: col.format,
        style: {
          fontSize: 9,
          color: '#0f172a',
          textAlign: col.align || 'left',
        },
      });
    }
  });

  detailControls.push({
    id: 'td-bottom-line',
    type: 'Line',
    x: 0,
    y: 21,
    width: contentWidth,
    height: 1,
    style: { color: theme.rowBorder },
  });

  const detailBand: BandDefinition = {
    id: 'band-detail',
    type: 'Detail',
    height: 22,
    keepTogether: true,
    controls: detailControls,
  };

  // 5. Build ReportFooter Band (Totals & Signatures)
  const reportFooterControls: ControlDefinition[] = [
    {
      id: 'rf-top-line',
      type: 'Line',
      x: 0,
      y: 4,
      width: contentWidth,
      height: 1.5,
      style: { color: theme.divider },
    },
    {
      id: 'rf-total-label',
      type: 'Label',
      x: 0,
      y: 12,
      width: 120,
      height: 16,
      text: '總計合計 (Total)：',
      style: { fontSize: 10, fontWeight: 'bold', color: theme.primary },
    },
  ];

  // Map aggregate summaries to corresponding column X & width
  resolvedCols.forEach((col) => {
    if (col.summary && col.field) {
      reportFooterControls.push({
        id: `rf-sum-${col.id}`,
        type: 'Expression',
        x: col.x + (col.align === 'right' ? -4 : 4),
        y: 12,
        width: col.width,
        height: 16,
        expression: `=${col.summary}(${col.field})`,
        formatString: col.format,
        style: {
          fontSize: 10,
          fontWeight: 'bold',
          color: theme.totalHighlight,
          textAlign: col.align || 'right',
        },
      });
    }
  });

  // Signatures
  const signatures = spec.signatures || ['主管核准簽章：_____________', '經辦簽收確認：_____________'];
  if (signatures[0]) {
    reportFooterControls.push({
      id: 'rf-sign-1',
      type: 'Label',
      x: 10,
      y: 45,
      width: 180,
      height: 16,
      text: `${signatures[0]}`,
      style: { fontSize: 8.5, color: '#64748b' },
    });
  }
  if (signatures[1]) {
    reportFooterControls.push({
      id: 'rf-sign-2',
      type: 'Label',
      x: contentWidth - 190,
      y: 45,
      width: 180,
      height: 16,
      text: `${signatures[1]}`,
      style: { fontSize: 8.5, color: '#64748b', textAlign: 'right' },
    });
  }

  const reportFooterBand: BandDefinition = {
    id: 'band-report-footer',
    type: 'ReportFooter',
    height: 70,
    keepTogether: true,
    controls: reportFooterControls,
  };

  // 6. Build PageFooter Band
  const pageFooterBand: BandDefinition = {
    id: 'band-page-footer',
    type: 'PageFooter',
    height: 20,
    controls: [
      {
        id: 'pf-system-note',
        type: 'Label',
        x: 0,
        y: 4,
        width: 250,
        height: 14,
        text: '由 TypeScript 報表引擎自動生成',
        style: { fontSize: 8, color: '#94a3b8' },
      },
      {
        id: 'pf-page-number',
        type: 'Expression',
        x: contentWidth - 160,
        y: 4,
        width: 160,
        height: 14,
        expression: '第 [PageNumber] 頁，共 [TotalPages] 頁',
        style: { fontSize: 8, color: '#64748b', textAlign: 'right' },
      },
    ],
  };

  return {
    id: spec.id,
    name: spec.name,
    pageSettings,
    bands: [
      reportHeaderBand,
      pageHeaderBand,
      detailBand,
      reportFooterBand,
      pageFooterBand,
    ],
  };
}
