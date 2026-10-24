import type { PDFCompilerProps } from '../types/render';
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Font,
  StyleSheet,
  type DocumentProps,
} from '@react-pdf/renderer';
import type {
  BandDefinition,
  ControlDefinition,
} from '../types/report.ts';
import { type EvalContext } from './evaluator.ts';
import { pdfControlRegistry } from '../controls/pdfRegistry.tsx';
import { expandDetailBands } from './bandPipeline.ts';
import { renderBandFrame } from './bandLayout';
import { prepareReportForPrint, ReportValidationError } from '../report/preflight';
import { bandIsVisible } from '../formula/presentation';

declare const __REPORT_ENGINE_FONT_RELATIVE_PATH__: string;

// Resolve the font independently of the caller's working directory.
const getFontUrl = () => {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/fonts/NotoSansTC.ttf`;
  }
  if (typeof process !== 'undefined') {
    const moduleUrl = import.meta.url;
    const url = new URL(typeof __REPORT_ENGINE_FONT_RELATIVE_PATH__ === 'string' ? __REPORT_ENGINE_FONT_RELATIVE_PATH__ : '../../public/fonts/NotoSansTC.ttf', moduleUrl);
    return decodeURIComponent(url.pathname).replace(/^\/([a-z]:\/)/i, '$1');
  }
  return '/fonts/NotoSansTC.ttf';
};

// Register font with an unpolluted family name
Font.register({
  family: 'AppChineseFont',
  src: getFontUrl(),
});

// Avoid line wrapping issues with CJK fonts in react-pdf
Font.registerHyphenationCallback((word) => Array.from(word));

/**
 * Render a single control using standardized Control Registry
 */
function renderControl(
  control: ControlDefinition,
  context: EvalContext
): React.ReactElement {
  const renderer = pdfControlRegistry.get(control.type);
  if (renderer) {
    const rendered = renderer({ control, context });
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
  keyPrefix = '',
  pageBreakBefore = band.pageBreakBefore,
): React.ReactElement | null {
  return renderBandFrame(band, context, `${keyPrefix}-${band.id}`, renderControl, pageBreakBefore);
}

export type { PDFCompilerProps } from '../types/render';

/**
 * Report PDF Document Component with Standardized Band Pipeline
 */
export function ReportPDFDocument({
  report,
  data,
  parameters,
  dataSource,
  executionTime,
  timeZone,
}: PDFCompilerProps): React.ReactElement<DocumentProps> {
  const { pageSettings, bands } = report;

  const actualData = data || dataSource?.data?.items || [];
  const actualParameters = {
    ...(dataSource?.data?.parameters || {}),
    ...(parameters || {}),
  };

  const prepared=prepareReportForPrint(report,{dataSource:actualData,reportParameters:actualParameters,schema:dataSource?.schema,executionTime,timeZone});
  if(!prepared.result.valid)throw new ReportValidationError(prepared.result.diagnostics.filter(d=>d.severity==='error'));
  const globalContext:EvalContext=prepared.context!;
  const reportHeaderBand=bands.find(b=>b.type==='ReportHeader');
  const pageHeaderBand=bands.find(b=>b.type==='PageHeader' && bandIsVisible(b,globalContext));
  const reportFooterBand=bands.find(b=>b.type==='ReportFooter');
  const pageFooterBand=bands.find(b=>b.type==='PageFooter' && bandIsVisible(b,globalContext));

  const pagePadding = {
    paddingTop: pageSettings.margins.top,
    paddingRight: pageSettings.margins.right,
    paddingBottom: pageSettings.margins.bottom + (pageFooterBand?.height ?? 0),
    paddingLeft: pageSettings.margins.left,
  };

  const pdfPageSize = pageSettings.size === 'Letter' ? 'LETTER' : pageSettings.size;

  const detailInstances = expandDetailBands(report, globalContext);

  return (
    <Document title={report.name} creationDate={new Date(globalContext.executionTime!)} modificationDate={new Date(globalContext.executionTime!)}>
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
        {detailInstances.map(instance => <React.Fragment key={instance.key}>
          {renderBand(instance.band, instance.context, instance.key, instance.pageBreakBefore)}
          {instance.pageBreakAfter && <View break />}
        </React.Fragment>)}

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
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    fontFamily: 'AppChineseFont',
    fontSize: 9,
    color: '#0f172a',
  },
});
