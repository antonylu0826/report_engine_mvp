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

  // 3. Deep SubReport Nested Hierarchy & Column Alignment Doctor
  const subReportControls = report.bands.flatMap((b) =>
    b.controls.filter((c) => c.type === 'SubReport' && c.subReportDefinition)
  );

  subReportControls.forEach((subCtrl) => {
    const subDef = subCtrl.subReportDefinition!;
    const subIndent = 35; // Standard hierarchical indentation for subreport
    const subAvailableWidth = printableWidth - subIndent; // Typically 480pt on A4

    subDef.bands.forEach((subBand) => {
      totalControls += subBand.controls.length;

      // Check sub-control overflow within subreport container
      subBand.controls.forEach((c) => {
        if (c.x + c.width > subAvailableWidth + 0.5) {
          diagnostics.push({
            bandId: subBand.id,
            bandType: `SubReport[${subBand.type}]`,
            controlId: c.id,
            severity: 'error',
            category: 'overflow',
            message: `子報表控制項「${c.id}」超出子表格右邊界！(X: ${c.x} + 寬: ${c.width} = ${(c.x + c.width).toFixed(1)}pt > 可用寬度 ${subAvailableWidth.toFixed(1)}pt)`,
          });
        }
      });
    });

    // Check SubReport internal column alignment (sub-header vs sub-detail)
    const subHeader = subDef.bands.find((b) => b.type === 'PageHeader' || b.type === 'ReportHeader');
    const subDetail = subDef.bands.find((b) => b.type === 'Detail');

    if (subHeader && subDetail) {
      const subThCols = subHeader.controls.filter((c) => c.text !== '').sort((a, b) => a.x - b.x);
      const subTdCols = subDetail.controls.filter((c) => c.fieldName || c.text).sort((a, b) => a.x - b.x);

      if (subThCols.length === subTdCols.length) {
        for (let i = 0; i < subThCols.length; i++) {
          const th = subThCols[i];
          const td = subTdCols[i];
          if (Math.abs(th.x - td.x) > 1 || Math.abs(th.width - td.width) > 1) {
            diagnostics.push({
              bandId: subHeader.id,
              bandType: `SubReport[Header vs Detail]`,
              controlId: `${th.id} vs ${td.id}`,
              severity: 'error',
              category: 'alignment',
              message: `子報表第 ${i + 1} 欄未對齊！子表頭「${th.text || th.id}」(X: ${th.x}, W: ${th.width}) vs 子明細「${td.fieldName || td.id}」(X: ${td.x}, W: ${td.width})，相差 X: ${Math.abs(th.x - td.x).toFixed(1)}pt`,
            });
          }
        }
      }
    }
  });

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

    // 2.5 Draw SubReport Mini Table Hierarchy in SVG
    if (ctrl.type === 'SubReport') {
      const subX = x + 35; // 35pt hierarchical indentation
      const subW = 480;
      const subH = h;
      
      // SubReport Container Card
      svgParts.push(
        `<rect x="${subX}" y="${y}" width="${subW}" height="${subH}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.5" />`
      );
      // Cyan accent marker on left border
      svgParts.push(
        `<line x1="${subX}" y1="${y}" x2="${subX}" y2="${y + subH}" stroke="#0284c7" stroke-width="2" />`
      );

      const subDef = ctrl.subReportDefinition;
      if (subDef && subDef.bands) {
        const subHeader = subDef.bands.find((b) => b.type === 'PageHeader' || b.type === 'ReportHeader');
        const subDetail = subDef.bands.find((b) => b.type === 'Detail');

        // Draw SubReport Header
        if (subHeader) {
          svgParts.push(
            `<rect x="${subX}" y="${y}" width="${subW}" height="${subHeader.height}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5" />`
          );
          subHeader.controls.forEach((th) => {
            const thX = subX + th.x + 4;
            const thY = y + subHeader.height / 2 + 3;
            svgParts.push(
              `<text x="${thX}" y="${thY}" font-size="7" font-weight="bold" fill="#475569">${th.text || ''}</text>`
            );
          });
        }

        // Draw Mock Sub-Detail Rows
        if (subDetail) {
          const binding = ctrl.subReportBinding || 'serials';
          const nestedItems = (sampleRow && sampleRow[binding] ? (sampleRow[binding] as any[]) : []) as Record<string, unknown>[];
          const displayItems = nestedItems.length > 0 ? nestedItems.slice(0, 1) : [{ serialNo: 'MBP-2026-001', lotNo: 'LOT-20261001', location: '倉位 1-01', qcStatus: '合格 PASS' }];
          
          let rowY = y + (subHeader?.height || 16);
          displayItems.forEach((subItem) => {
            subDetail.controls.forEach((td) => {
              const tdX = subX + td.x + 4;
              const tdY = rowY + subDetail.height / 2 + 2;
              let txt = String(subItem[td.fieldName || ''] || td.text || '');
              let color = '#334155';
              let weight = 'normal';

              if (td.type === 'Barcode') {
                txt = '||||||||||||||||||||||||';
                color = '#0284c7';
              } else if (td.fieldName === 'qcStatus') {
                color = '#059669';
                weight = 'bold';
              }

              svgParts.push(
                `<text x="${tdX}" y="${tdY}" font-size="7" font-weight="${weight}" fill="${color}">${txt}</text>`
              );
            });
            rowY += subDetail.height;
          });
        }
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
