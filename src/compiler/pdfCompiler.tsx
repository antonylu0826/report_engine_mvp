import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type {
  ReportDefinition,
  BandDefinition,
  ControlDefinition,
} from '../types/report';
import { formatValue } from './formatters';
import { evaluateExpression, type EvalContext } from './evaluator';

// Construct font URL supporting both browser (origin) and Node/MCP (process.cwd)
const getFontUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/fonts/NotoSansTC.ttf`;
  }
  if (typeof process !== 'undefined' && process.cwd) {
    return `${process.cwd()}/public/fonts/NotoSansTC.ttf`.replace(/\\/g, '/');
  }
  return '/fonts/NotoSansTC.ttf';
};

// Register font with an unpolluted family name
Font.register({
  family: 'AppChineseFont',
  src: getFontUrl(),
});

// Avoid line wrapping issues with CJK fonts in react-pdf
Font.registerHyphenationCallback((word) => [word]);

/**
 * Maps ControlStyle to react-pdf compatible styles
 */
function mapControlStyle(control: ControlDefinition): Style {
  const s = control.style || {};
  return {
    position: 'absolute',
    left: control.x,
    top: control.y,
    width: control.width,
    height: control.height,
    fontFamily: 'AppChineseFont',
    fontSize: s.fontSize ?? 9,
    fontWeight: s.fontWeight ?? 'normal',
    color: s.color || '#1e293b',
    backgroundColor: s.backgroundColor || 'transparent',
    textAlign: s.textAlign || 'left',
    borderTopWidth: s.borderTopWidth ?? (s.borderWidth ?? 0),
    borderBottomWidth: s.borderBottomWidth ?? (s.borderWidth ?? 0),
    borderLeftWidth: s.borderLeftWidth ?? (s.borderWidth ?? 0),
    borderRightWidth: s.borderRightWidth ?? (s.borderWidth ?? 0),
    borderColor: s.borderColor || '#cbd5e1',
    borderStyle: s.borderStyle || 'solid',
    padding: s.padding ?? 0,
    paddingHorizontal: s.paddingHorizontal,
    paddingVertical: s.paddingVertical,
  };
}

/**
 * Render a single control
 */
function renderControl(
  control: ControlDefinition,
  context: EvalContext
): React.ReactElement {
  const style = mapControlStyle(control);

  if (control.type === 'Line') {
    const isVertical = control.lineOrientation === 'vertical';
    return (
      <View
        key={control.id}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: isVertical ? 1 : control.width,
          height: isVertical ? control.height : 1,
          backgroundColor: control.style?.color || '#cbd5e1',
        }}
      />
    );
  }

  // Calculate text content
  let text = '';
  if (control.type === 'Label') {
    text = control.text ?? '';
  } else if (control.type === 'Field') {
    const rawVal = evaluateExpression(undefined, control.fieldName, context);
    text = formatValue(rawVal, control.formatString);
  } else if (control.type === 'Expression') {
    // Check special dynamic page number pattern: e.g. "[PageNumber] / [TotalPages]"
    if (control.expression?.includes('[PageNumber]') || control.expression?.includes('[TotalPages]')) {
      return (
        <Text
          key={control.id}
          style={style}
          render={({ pageNumber, totalPages }) => {
            const pattern = control.expression ?? '';
            return pattern
              .replace(/\[PageNumber\]/g, String(pageNumber))
              .replace(/\[TotalPages\]/g, String(totalPages));
          }}
        />
      );
    }
    const rawVal = evaluateExpression(control.expression, undefined, context);
    text = formatValue(rawVal, control.formatString);
  }

  return (
    <Text key={control.id} style={style}>
      {text}
    </Text>
  );
}

/**
 * Render a Band instance
 */
function renderBand(
  band: BandDefinition,
  context: EvalContext,
  keyPrefix = ''
): React.ReactElement {
  return (
    <View
      key={`${keyPrefix}-${band.id}`}
      style={{
        position: 'relative',
        width: '100%',
        height: band.height,
      }}
      wrap={!band.keepTogether}
    >
      {band.controls.map((control) => renderControl(control, context))}
    </View>
  );
}

export interface PDFCompilerProps {
  report: ReportDefinition;
  data: Record<string, unknown>[];
  parameters?: Record<string, unknown>;
}

/**
 * Report PDF Document Component
 */
export const ReportPDFDocument: React.FC<PDFCompilerProps> = ({
  report,
  data,
  parameters = {},
}) => {
  const { pageSettings, bands } = report;

  const reportHeaderBand = bands.find((b) => b.type === 'ReportHeader');
  const pageHeaderBand = bands.find((b) => b.type === 'PageHeader');
  const detailBand = bands.find((b) => b.type === 'Detail');
  const groupHeaderBands = bands.filter((b) => b.type === 'GroupHeader');
  const groupFooterBands = bands.filter((b) => b.type === 'GroupFooter');
  const reportFooterBand = bands.find((b) => b.type === 'ReportFooter');
  const pageFooterBand = bands.find((b) => b.type === 'PageFooter');

  const globalContext: EvalContext = {
    dataSource: data,
    reportParameters: parameters,
  };

  const pagePadding = {
    paddingTop: pageSettings.margins.top,
    paddingRight: pageSettings.margins.right,
    paddingBottom: pageSettings.margins.bottom + (pageFooterBand?.height ?? 0),
    paddingLeft: pageSettings.margins.left,
  };

  const pdfPageSize = pageSettings.size === 'Letter' ? 'LETTER' : pageSettings.size;

  return (
    <Document title={report.name}>
      <Page
        size={pdfPageSize}
        orientation={pageSettings.orientation}
        style={[
          styles.page,
          pagePadding,
        ]}
      >
        {/* 1. Report Header (報表主標題/抬頭封面) */}
        {reportHeaderBand && renderBand(reportHeaderBand, globalContext, 'report-header')}

        {/* 2. Page Header (表格標題列，跨頁時每頁頂部自動重複) */}
        {pageHeaderBand && (
          <View fixed style={{ width: '100%', height: pageHeaderBand.height }}>
            {renderBand(pageHeaderBand, globalContext, 'fixed-page-header')}
          </View>
        )}

        {/* 3. Group Header */}
        {groupHeaderBands.map((gh, idx) =>
          renderBand(gh, globalContext, `gh-${idx}`)
        )}

        {/* 4. Detail Band: 逐筆展開所有資料列 */}
        {detailBand &&
          data.map((row, idx) => {
            const rowContext: EvalContext = {
              ...globalContext,
              currentRow: row,
              rowIndex: idx,
            };
            return renderBand(detailBand, rowContext, `detail-row-${idx}`);
          })}

        {/* 5. Group Footer */}
        {groupFooterBands.map((gf, idx) =>
          renderBand(gf, globalContext, `gf-${idx}`)
        )}

        {/* 6. Report Footer (全表總計與簽章區塊) */}
        {reportFooterBand && renderBand(reportFooterBand, globalContext, 'report-footer')}

        {/* 7. Page Footer (固定在每頁最底端) */}
        {pageFooterBand && (
          <View
            fixed
            style={{
              position: 'absolute',
              bottom: pageSettings.margins.bottom,
              left: pageSettings.margins.left,
              right: pageSettings.margins.right,
              height: pageFooterBand.height,
            }}
          >
            {renderBand(pageFooterBand, globalContext, 'fixed-page-footer')}
          </View>
        )}
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'AppChineseFont',
    fontSize: 9,
    color: '#0f172a',
  },
});
