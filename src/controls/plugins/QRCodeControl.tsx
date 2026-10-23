import React from 'react';
import { useState, useEffect } from 'react';
import { QrCode as QrCodeIcon } from 'lucide-react';
import type { ReportControlPlugin } from '../types';
import { generateQrCodeDataUrl, getQrCodeDataUrlSync } from '../barcodeUtils';

export const QRCodeControl: ReportControlPlugin = {
  type: 'QRCode',
  displayName: 'QR Code',
  category: 'code',
  categoryName: '碼別與識別',
  description: '支援行動裝置掃描、數位簽署、驗證連結與單據追蹤',
  icon: QrCodeIcon,
  defaultWidth: 60,
  defaultHeight: 60,
  createDefault: (overrides) => ({
    type: 'QRCode',
    text: 'https://example.com/verify?id=ORD-20261020-0089',
    qrErrorLevel: 'M',
    width: 60,
    height: 60,
    style: {
      backgroundColor: '#ffffff',
    },
    ...overrides,
  }),
  DesignerComponent: ({ control }): React.ReactElement => {
    const rawVal = control.fieldName
      ? `[${control.fieldName}]`
      : (control.text || 'https://example.com');

    const [qrUrl, setQrUrl] = useState(() =>
      getQrCodeDataUrlSync(rawVal, { errorCorrectionLevel: control.qrErrorLevel })
    );

    useEffect(() => {
      let active = true;
      generateQrCodeDataUrl(rawVal, { errorCorrectionLevel: control.qrErrorLevel }).then(
        (url) => {
          if (active) setQrUrl(url);
        }
      );
      return () => {
        active = false;
      };
    }, [rawVal, control.qrErrorLevel]);

    return (
      <div className="w-full h-full flex items-center justify-center bg-white p-0.5 overflow-hidden">
        <img
          src={qrUrl}
          alt={rawVal}
          className="max-w-full max-h-full object-contain pointer-events-none select-none"
        />
      </div>
    );
  },
};
