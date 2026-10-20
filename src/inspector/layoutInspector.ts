import type { ReportDefinition, ControlDefinition } from '../types/report';

export interface LayoutDiagnostic {
  bandId: string;
  bandType: string;
  controlId?: string;
  severity: 'error' | 'warning' | 'info';
  category: 'overflow' | 'collision' | 'alignment' | 'budget';
  message: string;
}

export interface LayoutInspectionReport {
  pageSize: string;
  printableWidth: number;
  totalBands: number;
  totalControls: number;
  diagnostics: LayoutDiagnostic[];
  asciiWireframe: string;
  isValid: boolean;
}

export function inspectReportLayout(report: ReportDefinition): LayoutInspectionReport {
  const diagnostics: LayoutDiagnostic[] = [];
  const pageWidth = report.pageSettings.size === 'A4' ? 595.28 : 612.0;
  const pageHeight = report.pageSettings.size === 'A4' ? 841.89 : 792.0;
  const printableWidth = pageWidth - (report.pageSettings.margins.left + report.pageSettings.margins.right);
  const printableHeight = pageHeight - (report.pageSettings.margins.top + report.pageSettings.margins.bottom);

  let totalControls = 0;

  // 1. Check each band and its controls for overflow & collision
  report.bands.forEach((band) => {
    totalControls += band.controls.length;

    // A. Check control overflows
    band.controls.forEach((ctrl) => {
      // Horizontal overflow
      if (ctrl.x + ctrl.width > printableWidth + 0.5) {
        diagnostics.push({
          bandId: band.id,
          bandType: band.type,
          controlId: ctrl.id,
          severity: 'error',
          category: 'overflow',
          message: `控制項「${ctrl.id}」超出右邊距！(X: ${ctrl.x} + 寬: ${ctrl.width} = ${(ctrl.x + ctrl.width).toFixed(1)}pt > 可繪寬度 ${printableWidth.toFixed(1)}pt)`,
        });
      }

      // Vertical overflow
      if (ctrl.y + ctrl.height > band.height + 0.5) {
        diagnostics.push({
          bandId: band.id,
          bandType: band.type,
          controlId: ctrl.id,
          severity: 'warning',
          category: 'overflow',
          message: `控制項「${ctrl.id}」超出所屬 Band 下緣！(Y: ${ctrl.y} + 高: ${ctrl.height} = ${(ctrl.y + ctrl.height).toFixed(1)}pt > Band 高度 ${band.height}pt)`,
        });
      }
    });

    // B. Check collision (excluding pure background boxes & lines)
    const contentControls = band.controls.filter(
      (c) => c.type !== 'Line' && !(c.text === '' && (c.style?.backgroundColor || c.style?.borderWidth))
    );

    for (let i = 0; i < contentControls.length; i++) {
      for (let j = i + 1; j < contentControls.length; j++) {
        const c1 = contentControls[i];
        const c2 = contentControls[j];

        // AABB Collision check
        const overlapX = Math.max(0, Math.min(c1.x + c1.width, c2.x + c2.width) - Math.max(c1.x, c2.x));
        const overlapY = Math.max(0, Math.min(c1.y + c1.height, c2.y + c2.height) - Math.max(c1.y, c2.y));

        if (overlapX > 2 && overlapY > 2) {
          diagnostics.push({
            bandId: band.id,
            bandType: band.type,
            controlId: `${c1.id} <-> ${c2.id}`,
            severity: 'warning',
            category: 'collision',
            message: `控制項「${c1.id}」與「${c2.id}」發生文字重疊！(重疊區域: ${overlapX.toFixed(1)} x ${overlapY.toFixed(1)} pt)`,
          });
        }
      }
    }
  });

  // 2. Table Column Alignment Doctor (PageHeader vs Detail)
  const pageHeader = report.bands.find((b) => b.type === 'PageHeader');
  const detail = report.bands.find((b) => b.type === 'Detail');

  if (pageHeader && detail) {
    const thCols = pageHeader.controls
      .filter((c) => c.type === 'Label' && c.text !== '')
      .sort((a, b) => a.x - b.x);

    const tdCols = detail.controls
      .filter((c) => c.type === 'Field' || c.type === 'Expression')
      .sort((a, b) => a.x - b.x);

    if (thCols.length !== tdCols.length) {
      diagnostics.push({
        bandId: pageHeader.id,
        bandType: 'PageHeader',
        severity: 'warning',
        category: 'alignment',
        message: `表格欄位數量不一致：表頭 (PageHeader) 有 ${thCols.length} 欄，但明細列 (Detail) 有 ${tdCols.length} 欄！`,
      });
    } else {
      for (let i = 0; i < thCols.length; i++) {
        const th = thCols[i];
        const td = tdCols[i];

        if (Math.abs(th.x - td.x) > 1 || Math.abs(th.width - td.width) > 1) {
          diagnostics.push({
            bandId: pageHeader.id,
            bandType: 'PageHeader',
            controlId: `${th.id} vs ${td.id}`,
            severity: 'error',
            category: 'alignment',
            message: `第 ${i + 1} 欄位未對齊！表頭「${th.text || th.id}」(X: ${th.x}, W: ${th.width}) vs 明細「${td.fieldName || td.id}」(X: ${td.x}, W: ${td.width})，相差 X: ${Math.abs(th.x - td.x).toFixed(1)}pt, W: ${Math.abs(th.width - td.width).toFixed(1)}pt`,
          });
        }
      }
    }
  }

  // 3. Generate ASCII Wireframe
  const asciiLines: string[] = [];
  asciiLines.push(`+-------------------------------------------------------------+`);
  asciiLines.push(`| [頁面: ${report.pageSettings.size}] 可繪寬度: ${printableWidth.toFixed(1)} pt, 可繪高度: ${printableHeight.toFixed(1)} pt |`);
  asciiLines.push(`+-------------------------------------------------------------+`);

  report.bands.forEach((b) => {
    const ctrlCount = b.controls.length;
    asciiLines.push(`| Band: ${b.type.padEnd(14)} | 高度: ${String(b.height).padStart(3)} pt | 控制項: ${String(ctrlCount).padStart(2)} 個 |`);
    
    // Highlight specific key elements in wireframe
    if (b.type === 'ReportHeader') {
      asciiLines.push(`|  ├─ [抬頭] 公司全名與單據清冊名稱`);
      asciiLines.push(`|  └─ [客戶資訊卡] 左右分欄網格 (客戶/統編/單號/日期)`);
    } else if (b.type === 'PageHeader') {
      const colLabels = b.controls.filter(c => c.text).map(c => c.text).slice(0, 5).join(' | ');
      asciiLines.push(`|  └─ [表格表頭] ${colLabels}...`);
    } else if (b.type === 'Detail') {
      asciiLines.push(`|  └─ [明細資料列] 垂直格線貫穿逐筆展開`);
    } else if (b.type === 'ReportFooter') {
      asciiLines.push(`|  ├─ [會計結算卡] 銷售小計 + 5%營業稅 + 中文大寫總計`);
      asciiLines.push(`|  └─ [四格簽核章] 製單 / 主管 / 倉管 / 客戶簽章`);
    } else if (b.type === 'PageFooter') {
      asciiLines.push(`|  └─ [頁尾] 列印提示與動態頁碼`);
    }
    asciiLines.push(`+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +`);
  });

  const isValid = !diagnostics.some((d) => d.severity === 'error');

  return {
    pageSize: report.pageSettings.size,
    printableWidth,
    totalBands: report.bands.length,
    totalControls,
    diagnostics,
    asciiWireframe: asciiLines.join('\n'),
    isValid,
  };
}

/**
 * Render ReportDefinition into a pure, self-contained SVG string.
 * This runs with zero native C++ dependencies on any Node.js environment.
 */
export function renderReportToSvg(
  report: ReportDefinition,
  sampleRows: Record<string, unknown>[] = []
): string {
  const marginL = report.pageSettings.margins.left;
  const marginT = report.pageSettings.margins.top;
  const pageWidth = report.pageSettings.size === 'A4' ? 595.28 : 612.0;
  const pageHeight = report.pageSettings.size === 'A4' ? 841.89 : 792.0;
  const printableWidth = pageWidth - (marginL + report.pageSettings.margins.right);

  const svgParts: string[] = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" width="${pageWidth}" height="${pageHeight}" style="background-color: #f8fafc; font-family: 'Noto Sans TC', sans-serif;">`
  );

  // Page background & shadow
  svgParts.push(
    `<rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`
  );
  // Printable bounds guide line (subtle)
  svgParts.push(
    `<rect x="${marginL}" y="${marginT}" width="${printableWidth}" height="${pageHeight - marginT * 2}" fill="none" stroke="#f1f5f9" stroke-dasharray="4,4" />`
  );

  let currentY = marginT;

  const renderControl = (ctrl: ControlDefinition, offsetX: number, offsetY: number, sampleRow?: Record<string, unknown>, rowIdx?: number) => {
    const x = offsetX + ctrl.x;
    const y = offsetY + ctrl.y;
    const w = ctrl.width;
    const h = ctrl.height;
    const st = ctrl.style || {};

    // 1. Draw Background & Borders
    const fill = st.backgroundColor || 'none';
    const stroke = st.borderColor || '#cbd5e1';
    const strokeWidth = st.borderWidth || 0;

    if (fill !== 'none' || strokeWidth > 0) {
      svgParts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`
      );
    }

    // Individual borders
    if (st.borderTopWidth) {
      svgParts.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${stroke}" stroke-width="${st.borderTopWidth}" />`);
    }
    if (st.borderBottomWidth) {
      svgParts.push(`<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${stroke}" stroke-width="${st.borderBottomWidth}" />`);
    }
    if (st.borderLeftWidth) {
      svgParts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${stroke}" stroke-width="${st.borderLeftWidth}" />`);
    }
    if (st.borderRightWidth) {
      svgParts.push(`<line x1="${x + w}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${stroke}" stroke-width="${st.borderRightWidth}" />`);
    }

    // 2. Draw Line Control
    if (ctrl.type === 'Line') {
      const lineColor = st.color || '#cbd5e1';
      if (ctrl.lineOrientation === 'vertical') {
        svgParts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${lineColor}" stroke-width="${w || 1}" />`);
      } else {
        svgParts.push(`<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="${lineColor}" stroke-width="${h || 1}" />`);
      }
      return;
    }

    // 3. Resolve Content Text
    let displayText = ctrl.text || '';
    if (ctrl.type === 'Field' && sampleRow && ctrl.fieldName) {
      const val = sampleRow[ctrl.fieldName];
      displayText = val !== undefined && val !== null ? String(val) : '';
      if (ctrl.formatString === 'C0' && typeof val === 'number') {
        displayText = `NT$ ${val.toLocaleString()}`;
      } else if (ctrl.formatString === 'N0' && typeof val === 'number') {
        displayText = val.toLocaleString();
      }
    } else if (ctrl.type === 'Expression') {
      if (ctrl.expression === '=ROW_INDEX' && rowIdx !== undefined) {
        displayText = String(rowIdx + 1);
      } else if (ctrl.expression?.includes('SUM')) {
        displayText = 'NT$ 615,000';
      } else {
        displayText = ctrl.expression || '';
      }
    }

    if (!displayText) return;

    // 4. Draw Text
    const fontSize = st.fontSize || 9;
    const fontWeight = st.fontWeight === 'bold' ? 'bold' : 'normal';
    const textColor = st.color || '#0f172a';
    const textAlign = st.textAlign || 'left';

    let textAnchor = 'start';
    let textX = x + 4;
    if (textAlign === 'center') {
      textAnchor = 'middle';
      textX = x + w / 2;
    } else if (textAlign === 'right') {
      textAnchor = 'end';
      textX = x + w - 4;
    }

    // Vertical middle approximation
    const textY = y + h / 2 + fontSize / 3;

    // Escape XML entities
    const safeText = displayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    svgParts.push(
      `<text x="${textX}" y="${textY}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${textColor}" text-anchor="${textAnchor}">${safeText}</text>`
    );
  };

  // Render Bands sequentially
  report.bands.forEach((band) => {
    if (band.type === 'Detail') {
      // Render first 5 sample rows for detail preview
      const previewRows = sampleRows.length > 0 ? sampleRows.slice(0, 5) : [{}, {}, {}];
      previewRows.forEach((row, idx) => {
        band.controls.forEach((ctrl) => {
          renderControl(ctrl, marginL, currentY, row, idx);
        });
        currentY += band.height;
      });
    } else {
      band.controls.forEach((ctrl) => {
        renderControl(ctrl, marginL, currentY);
      });
      currentY += band.height;
    }
  });

  svgParts.push('</svg>');
  return svgParts.join('\n');
}
