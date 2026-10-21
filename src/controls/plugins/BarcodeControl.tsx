import React from 'react';
import { Barcode as BarcodeIcon } from 'lucide-react';
import { Image as PdfImage } from '@react-pdf/renderer';
import type { ReportControlPlugin } from '../types';
import { generateBarcodeDataUrl } from '../barcodeUtils';
import { evaluateExpression } from '@/compiler/evaluator';

export const BarcodeControl: ReportControlPlugin = {
  type: 'Barcode',
  displayName: '一維條碼',
  category: 'code',
  categoryName: '碼別與識別',
  description: '支援 Code128 等標準條碼，可綁定單號或 SKU 掃描',
  icon: BarcodeIcon,
  defaultWidth: 160,
  defaultHeight: 40,
  createDefault: (overrides) => ({
    type: 'Barcode',
    text: 'ORD-20261020-0089',
    barcodeFormat: 'CODE128',
    displayValue: true,
    width: 160,
    height: 40,
    style: {
      backgroundColor: '#ffffff',
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }) => {
    const rawVal = control.fieldName
      ? `[${control.fieldName}]`
      : (control.text || 'CODE128-DEMO');

    const barcodeUrl = generateBarcodeDataUrl(rawVal.replace(/^\[|\]$/g, ''), {
      format: control.barcodeFormat || 'CODE128',
      displayValue: control.displayValue ?? true,
    });

    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white overflow-hidden p-0.5">
        <img
          src={barcodeUrl}
          alt={rawVal}
          className="max-w-full max-h-full object-contain pointer-events-none select-none"
        />
      </div>
    );
  },
  renderPdf: ({ control, context }) => {
    let val = control.text ?? '';
    if (control.fieldName) {
      const bound = evaluateExpression(undefined, control.fieldName, context);
      if (bound !== undefined && bound !== null) {
        val = String(bound);
      }
    }
    const barcodeUrl = generateBarcodeDataUrl(val || '00000000', {
      format: control.barcodeFormat || 'CODE128',
      displayValue: control.displayValue ?? true,
    });

    return (
      <PdfImage
        key={control.id}
        src={barcodeUrl}
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
};
