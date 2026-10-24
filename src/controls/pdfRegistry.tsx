import React from 'react';
import { Text, View, Svg, Rect, Image as PdfImage } from '@react-pdf/renderer';
import type { ControlType } from '../types/report.ts';
import type { PdfControlRenderer } from './types.ts';
import { mapControlStyle } from './styleUtils.ts';
import { evaluateExpression, getNestedValue } from '../compiler/evaluator.ts';
import { formatValue } from '../compiler/formatters.ts';
import { getBarcodePattern, generateQrCodeDataUrl } from './barcodeUtils.ts';
import { renderBandFrame } from '../compiler/bandLayout';
import { getSubReportBands } from '../report/subReport.ts';
import { getSubReportGeometry } from '../report/geometry.ts';

// PDF rendering has no dependency on designer components or their state.
const renderers: Record<ControlType, PdfControlRenderer> = {
  Label: ({ control }): React.ReactNode => {
    const style = mapControlStyle(control);
    return (
      <Text key={control.id} style={style}>
        {control.text ?? ''}
      </Text>
    );
  },
  Field: ({ control, context }): React.ReactNode => {
    const style = mapControlStyle(control);
    const rawVal = evaluateExpression(undefined, control.fieldName, context);
    const text = formatValue(rawVal, control.formatString, context.timeZone);
    return (
      <Text key={control.id} style={style}>
        {text}
      </Text>
    );
  },
  Expression: ({ control, context }): React.ReactNode => {
    const style = mapControlStyle(control);
    // Dynamic page numbers handled by react-pdf render prop
    if (control.expression?.includes('[PageNumber]') || control.expression?.includes('[TotalPages]') || control.expression?.includes('[ExecutionTime]')) {
      return (
        <Text
          key={control.id}
          style={style}
          render={({ pageNumber, totalPages }) => {
            const pattern = control.expression ?? '';
            return pattern
              .replace(/\[PageNumber\]/g, String(pageNumber))
              .replace(/\[TotalPages\]/g, String(totalPages))
              .replace(/\[ExecutionTime\]/g, context.executionTime ?? '');
          }}
        />
      );
    }

    const rawVal = evaluateExpression(control.expression, undefined, context);
    const text = formatValue(rawVal, control.formatString, context.timeZone);
    return (
      <Text key={control.id} style={style}>
        {text}
      </Text>
    );
  },
  Line: ({ control }): React.ReactNode => {
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
  },
  Barcode: ({ control, context }): React.ReactNode => {
    let val = control.text ?? '';
    if (control.fieldName) {
      const bound = evaluateExpression(undefined, control.fieldName, context);
      if (bound !== undefined && bound !== null) {
        val = String(bound);
      }
    }
    if (!val) return null;
    const pattern = getBarcodePattern(val, control.barcodeFormat || 'CODE128');
    const showText = control.displayValue ?? true;
    const quietZone = 10;
    const width = pattern.data.length + quietZone * 2;
    const height = showText ? 60 : 44;

    return (
      <Svg
        key={control.id}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
        }}
      >
        <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {Array.from(pattern.data).map((bit, index) => bit === '1'
          ? <Rect key={index} x={index + quietZone} y={2} width={1} height={40} fill="#000000" />
          : null)}
        {showText && <Text x={width / 2} y={54} textAnchor="middle" style={{ fontSize: 10 }}>{pattern.text}</Text>}
      </Svg>
    );
  },
  QRCode: ({ control, context }): React.ReactNode => {
    let val = control.text ?? '';
    if (control.fieldName) {
      const bound = evaluateExpression(undefined, control.fieldName, context);
      if (bound !== undefined && bound !== null) {
        val = String(bound);
      }
    }
    if (!val) return null;
    const text = val;

    return (
      <PdfImage
        key={control.id}
        src={() => generateQrCodeDataUrl(text, { errorCorrectionLevel: control.qrErrorLevel })}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
        }}
      />
    );
  },
  Image: ({ control }): React.ReactNode => {
    if (!control.src) {
      return (
        <View
          key={control.id}
          style={{
            position: 'absolute',
            left: control.x,
            top: control.y,
            width: control.width,
            height: control.height,
          }}
        />
      );
    }

    return (
      <PdfImage
        key={control.id}
        src={control.src}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
          objectFit: control.objectFit || 'contain',
        }}
      />
    );
  },
  CheckBox: ({ control, context }) => {
    // Determine checked state dynamically from row data or static property
    let isChecked = !!control.checked;
    if (control.fieldName && context.currentRow) {
      const val = getNestedValue(context.currentRow, control.fieldName);
      isChecked = val === true || val === 1 || val === '1' || val === 'true' || val === 'TRUE' || val === 'Y';
    }

    const labelText = control.checkText || '';

    return (
      <View
        key={control.id}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 9,
            height: 9,
            borderWidth: 1,
            borderColor: '#334155',
            backgroundColor: isChecked ? '#1e293b' : '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
          }}
        >
          {isChecked && (
            <Text
              style={{
                fontSize: 7,
                color: '#ffffff',
                fontFamily: 'Helvetica',
                marginTop: -1,
              }}
            >
              ✓
            </Text>
          )}
        </View>
        {labelText ? (
          <Text
            style={{
              fontSize: control.style?.fontSize || 9,
              color: control.style?.color || '#0f172a',
              fontFamily: control.style?.fontFamily || 'Helvetica',
            }}
          >
            {labelText}
          </Text>
        ) : null}
      </View>
    );
  },
  Panel: ({ control }): React.ReactNode => {
    return (
      <View
        key={control.id}
        style={{
          position: 'absolute',
          left: control.x,
          top: control.y,
          width: control.width,
          height: control.height,
          backgroundColor: control.style?.backgroundColor || 'transparent',
          borderWidth: control.style?.borderWidth ?? 1,
          borderColor: control.style?.borderColor || '#cbd5e1',
          borderStyle: control.style?.borderStyle || 'solid',
          borderRadius: control.style?.borderRadius || 0,
        }}
      />
    );
  },
  SubReport: ({ control, context }) => {
    const instances = getSubReportBands(control, context);
    if (instances.length === 0) return null;
    const { indent, width } = getSubReportGeometry(control);
    return (
      <View key={control.id} style={{
        position: 'relative', width: control.width, marginLeft: control.x,
        marginTop: control.y, marginBottom: 2, paddingLeft: indent,
      }}>
        <View style={{
          width, borderLeftWidth: 2, borderLeftColor: control.style?.borderColor ?? '#0284c7',
          borderWidth: 0.5, borderColor: control.style?.borderColor ?? '#cbd5e1', backgroundColor: control.style?.backgroundColor ?? '#f8fafc', paddingVertical: 2,
        }}>
          {instances.map(instance => <React.Fragment key={instance.key}>
            {renderBandFrame(instance.band, instance.context, instance.key, (child, childContext) => pdfControlRegistry.get(child.type)?.({ control: child, context: childContext }), instance.pageBreakBefore, instance.band.type === 'PageHeader')}
            {instance.pageBreakAfter && <View break />}
          </React.Fragment>)}

        </View>
      </View>
    );
  },
};

class PdfControlRegistry {
  private renderers = new Map<ControlType, PdfControlRenderer>(Object.entries(renderers) as [ControlType, PdfControlRenderer][]);
  register(type: ControlType, renderer: PdfControlRenderer) { this.renderers.set(type, renderer); }
  get(type: ControlType) { return this.renderers.get(type); }
}

export const pdfControlRegistry = new PdfControlRegistry();
