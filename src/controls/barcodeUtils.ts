import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

// Cache generated images to optimize rendering speed
const barcodeCache = new Map<string, string>();
const qrCache = new Map<string, string>();

/**
 * Generate a PNG Data URL for a 1D Barcode (e.g. Code128)
 */
export function generateBarcodeDataUrl(
  text: string,
  options: {
    format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
    displayValue?: boolean;
    height?: number;
    width?: number;
  } = {}
): string {
  const cleanText = text || '00000000';
  const format = options.format || 'CODE128';
  const displayValue = options.displayValue ?? false;
  const cacheKey = `${format}_${displayValue}_${cleanText}`;

  if (barcodeCache.has(cacheKey)) {
    return barcodeCache.get(cacheKey)!;
  }

  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, cleanText, {
        format,
        displayValue,
        fontSize: 10,
        margin: 2,
        height: 40,
        width: 1.5,
      });
      const dataUrl = canvas.toDataURL('image/png');
      barcodeCache.set(cacheKey, dataUrl);
      return dataUrl;
    }
  } catch (err) {
    console.warn('Failed to generate barcode dataUrl:', err);
  }

  // Fallback 1x1 transparent pixel
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}

/**
 * Generate a PNG Data URL for a 2D QR Code
 */
export async function generateQrCodeDataUrl(
  text: string,
  options: {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
  } = {}
): Promise<string> {
  const cleanText = text || 'https://example.com';
  const level = options.errorCorrectionLevel || 'M';
  const cacheKey = `${level}_${cleanText}`;

  if (qrCache.has(cacheKey)) {
    return qrCache.get(cacheKey)!;
  }

  try {
    const dataUrl = await QRCode.toDataURL(cleanText, {
      errorCorrectionLevel: level,
      margin: options.margin ?? 1,
      width: 256,
    });
    qrCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn('Failed to generate QR code dataUrl:', err);
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }
}

/**
 * Synchronous QR Code dataUrl generator using pre-warmed cache or fallback placeholder
 */
export function getQrCodeDataUrlSync(
  text: string,
  options: {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  } = {}
): string {
  const cleanText = text || 'https://example.com';
  const level = options.errorCorrectionLevel || 'M';
  const cacheKey = `${level}_${cleanText}`;

  if (qrCache.has(cacheKey)) {
    return qrCache.get(cacheKey)!;
  }

  // Asynchronously generate for next render
  generateQrCodeDataUrl(cleanText, options).catch(() => {});

  // Fallback while generating
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}
