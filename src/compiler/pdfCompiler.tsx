import React from 'react';
(globalThis as any).React = React;
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
} from '@react-pdf/renderer';
import type {
  ReportDefinition,
  BandDefinition,
  ControlDefinition,
} from '../types/report';
import { type EvalContext } from './evaluator';
import { controlRegistry } from '../controls/registry';
import { groupDataRows } from './grouping';

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
 * Render a single control using standardized Control Registry
 */
function renderControl(
  control: ControlDefinition,
  context: EvalContext
): React.ReactElement {
  const plugin = controlRegistry.get(control.type);
  if (plugin) {
    const rendered = plugin.renderPdf({ control, context });
    return <React.Fragment key={control.id}>{rendered}</React.Fragment>;
  }

  // Fallback if plugin not found
  return (
    <Text
      key={control.id}
      style={{
        position: 'absolute',
        left: control.x,
        top: control.y,
        fontSize: control.style?.fontSize ?? 9,
      }}
    >
      {control.text ?? ''}
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
  const hasSubReport = band.controls.some((c) => c.type === 'SubReport');

  return (
    <View
      key={`${keyPrefix}-${band.id}`}
      style={{
        position: 'relative',
        width: '100%',
        ...(hasSubReport ? { minHeight: band.height } : { height: band.height }),
      }}
      wrap={!band.keepTogether}
      break={band.pageBreakBefore}
    >
      {band.controls.map((control) => renderControl(control, context))}
    </View>
  );
}

export interface PDFCompilerProps {
  report: ReportDefinition;
  data?: Record<string, unknown>[];
  parameters?: Record<string, unknown>;
  dataSource?: import('../types/datasource').ReportDataSource;
}

/**
 * Report PDF Document Component with Standardized Band Pipeline
 */
export const ReportPDFDocument: React.FC<PDFCompilerProps> = ({
  report,
  data,
  parameters,
  dataSource,
}) => {
  const { pageSettings, bands } = report;

  const actualData = data || dataSource?.data?.items || [];
  const actualParameters = {
    ...(dataSource?.data?.parameters || {}),
    ...(parameters || {}),
  };

  const reportHeaderBand = bands.find((b) => b.type === 'ReportHeader');
  const pageHeaderBand = bands.find((b) => b.type === 'PageHeader');
  const detailBand = bands.find((b) => b.type === 'Detail');
  const groupHeaderBand = bands.find((b) => b.type === 'GroupHeader');
  const groupFooterBand = bands.find((b) => b.type === 'GroupFooter');
  const reportFooterBand = bands.find((b) => b.type === 'ReportFooter');
  const pageFooterBand = bands.find((b) => b.type === 'PageFooter');

  const globalContext: EvalContext = {
    dataSource: actualData,
    reportParameters: actualParameters,
  };

  const pagePadding = {
    paddingTop: pageSettings.margins.top,
    paddingRight: pageSettings.margins.right,
    paddingBottom: pageSettings.margins.bottom + (pageFooterBand?.height ?? 0),
    paddingLeft: pageSettings.margins.left,
  };

  const pdfPageSize = pageSettings.size === 'Letter' ? 'LETTER' : pageSettings.size;

  // Determine grouping field from GroupHeader or GroupFooter
  const groupByField = groupHeaderBand?.groupBy || groupFooterBand?.groupBy;
  const groupSortOrder = groupHeaderBand?.groupSortOrder || groupFooterBand?.groupSortOrder || 'asc';
  const hasGrouping = Boolean(groupHeaderBand || groupFooterBand);

  // Group data rows
  const groups = hasGrouping
    ? groupDataRows(actualData, groupByField, groupSortOrder)
    : [{ key: 'all', field: '', rows: actualData }];

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
        {/* 1. Report Header (報表主抬頭/首頁封面) */}
        {reportHeaderBand && renderBand(reportHeaderBand, globalContext, 'report-header')}

        {/* 2. Page Header (表格欄位標題，跨頁時固定於每頁頂端) */}
        {pageHeaderBand && (
          <View fixed style={{ width: '100%', height: pageHeaderBand.height }}>
            {renderBand(pageHeaderBand, globalContext, 'fixed-page-header')}
          </View>
        )}

        {/* 3. Group & Detail Pipeline (分組表頭 -> 明細資料列 -> 分組小計) */}
        {groups.map((group, gIdx) => {
          const groupContext: EvalContext = {
            ...globalContext,
            groupRows: group.rows,
            currentRow: group.rows[0] || {},
          };

          return (
            <View
              key={`group-${group.key}-${gIdx}`}
              break={gIdx > 0 && (groupHeaderBand?.pageBreakBefore ?? false)}
            >
              {/* Group Header (群組表頭) */}
              {groupHeaderBand &&
                renderBand(groupHeaderBand, groupContext, `gh-${gIdx}`)}

              {/* Detail Rows for this group */}
              {detailBand &&
                group.rows.map((row, rIdx) => {
                  const rowContext: EvalContext = {
                    ...groupContext,
                    currentRow: row,
                    rowIndex: rIdx,
                  };
                  return renderBand(detailBand, rowContext, `detail-${gIdx}-${rIdx}`);
                })}

              {/* Group Footer (群組小計/統計) */}
              {groupFooterBand &&
                renderBand(groupFooterBand, groupContext, `gf-${gIdx}`)}

              {/* Optional page break after group */}
              {groupFooterBand?.pageBreakAfter && gIdx < groups.length - 1 && (
                <View break />
              )}
            </View>
          );
        })}

        {/* 4. Report Footer (全表總計與簽章區塊) */}
        {reportFooterBand && renderBand(reportFooterBand, globalContext, 'report-footer')}

        {/* 5. Page Footer (固定在每頁最底端) */}
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
