import type { ReportDataSource } from '../types/datasource';

/**
 * Standard Catalog Items for Realistic Mock Generation
 */
export const baseProductCatalog = [
  { sku: 'IT-MBP16-M3M', productName: 'Apple MacBook Pro 16" (M3 Max / 36GB / 1TB)', unit: '台', unitPrice: 104900, category: '資訊運算設備' },
  { sku: 'IT-DELL-U2723QE', productName: 'Dell UltraSharp 27" 4K HDR USB-C 專業顯示器', unit: '台', unitPrice: 18900, category: '螢幕與視訊' },
  { sku: 'IT-MX-MASTER3S', productName: 'Logitech MX Master 3S 無線人體工學靜音滑鼠', unit: '隻', unitPrice: 3290, category: '周邊配件' },
  { sku: 'IT-KEYCHRON-Q1', productName: 'Keychron Q1 Pro 客製化全鋁機械鍵盤 (紅軸)', unit: '把', unitPrice: 5680, category: '周邊配件' },
  { sku: 'IT-CALDIGIT-TS4', productName: 'CalDigit TS4 Thunderbolt 4 旗艦擴充基座', unit: '組', unitPrice: 12500, category: '周邊配件' },
  { sku: 'IT-SONY-WH1000XM5', productName: 'Sony WH-1000XM5 頂級智慧降噪耳罩耳機', unit: '支', unitPrice: 10900, category: '視聽設備' },
  { sku: 'IT-HERMAN-AERON', productName: 'Herman Miller Aeron 人體工學辦公椅 (旗艦版)', unit: '張', unitPrice: 48000, category: '辦公設備' },
  { sku: 'IT-UGREEN-TB4', productName: 'UGREEN 40Gbps 雷電4 高速編織傳輸線 (1M)', unit: '條', unitPrice: 799, category: '周邊配件' },
  { sku: 'IT-SAN-EXTREME-2T', productName: 'SanDisk Extreme PRO 2TB 便攜式高速固態硬碟', unit: '個', unitPrice: 6290, category: '資訊運算設備' },
  { sku: 'IT-ANKER-PRIME-250', productName: 'Anker Prime 250W 多孔氮化鎵旗艦桌面充電器', unit: '個', unitPrice: 4290, category: '周邊配件' },
  { sku: 'IT-EPSON-ECOTANK', productName: 'Epson EcoTank L6580 旗艦商用彩色連續供墨事務機', unit: '台', unitPrice: 32900, category: '辦公設備' },
  { sku: 'IT-APPLE-STUDIO-DSP', productName: 'Apple Studio Display 27" 5K Retina 顯示器', unit: '台', unitPrice: 52900, category: '螢幕與視訊' },
  { sku: 'IT-SYNOLOGY-DS923', productName: 'Synology DS923+ 4-Bay 高效能企業級網路儲存伺服器', unit: '台', unitPrice: 18999, category: '資訊運算設備' },
  { sku: 'IT-SEAGATE-IRONWOLF', productName: 'Seagate IronWolf Pro 16TB 企業級 NAS 專用硬碟', unit: '顆', unitPrice: 11500, category: '資訊運算設備' },
];

/**
 * Standard Order Master Parameters
 */
export const defaultOrderParameters: Record<string, unknown> = {
  orderNo: 'ORD-2026-1020-0089',
  customerName: '台積光電科技股份有限公司',
  uniformInvoiceNo: '88765432',
  contactPerson: '陳建宏 (資深採購經理)',
  contactPhone: '(03) 578-9999 #203',
  deliveryAddress: '新竹市東區科學園區創新一路 88 號 5 樓 (研發總部)',
  poNumber: 'PO-TW-2026-904',
  paymentTerms: '月結 30 天 (電匯付款)',
  currency: '新台幣 NTD',
  deliveryDate: '2026-10-21',
  salesRep: '張啟銘 (業務部二組)',
  isUrgent: false,
  withInvoice: true,
  shippingWarehouse: '桃園第一保稅物流倉',
  shippingMethod: '常溫專車直配',
  remark: '本批次商品已完成入庫前 QC 檢驗，隨貨附正本發票與原廠保證書，抵達廠區前 30 分鐘請先電聯窗口。',
};

/**
 * Generate normalized detail item records
 */
export function generateOrderItems(count: number): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const p = baseProductCatalog[i % baseProductCatalog.length];
    const quantity = (i % 5) + 1;
    result.push({
      index: i + 1,
      sku: p.sku,
      category: p.category,
      productName: p.productName,
      unit: p.unit,
      quantity,
      unitPrice: p.unitPrice,
      amount: quantity * p.unitPrice,
      isInspected: i % 2 === 0,
      batchNo: `LOT-${20261000 + (i % 10)}`,
    });
  }
  return result;
}

export const sampleOrderData14 = generateOrderItems(14);
export const sampleOrderData45 = generateOrderItems(45);
export const sampleOrderData100 = generateOrderItems(100);
export const sampleOrderData = sampleOrderData14;

/**
 * Normalized DataSource Definition: Standard Enterprise Delivery Order
 */
export const sampleOrderDataSource: ReportDataSource = {
  id: 'ds-delivery-order',
  name: '企業標準銷貨出貨單資料源',
  schema: {
    parameters: [
      { name: 'orderNo', label: '出貨單號', type: 'string', description: 'ERP 唯一出貨單號 (支援條碼)' },
      { name: 'customerName', label: '客戶名稱', type: 'string', description: '交易客戶法定全銜' },
      { name: 'uniformInvoiceNo', label: '統一編號', type: 'string', description: '客戶營利事業統一編號' },
      { name: 'contactPerson', label: '聯絡人', type: 'string', description: '收貨/對帳負責窗口' },
      { name: 'contactPhone', label: '聯絡電話', type: 'string', description: '聯絡電話與分機' },
      { name: 'deliveryAddress', label: '交貨地址', type: 'string', description: '貨物配送實際卸貨廠址' },
      { name: 'poNumber', label: '客戶採購單號', type: 'string', description: '客戶方發行之採購訂單編號' },
      { name: 'paymentTerms', label: '付款條件', type: 'string', description: '商業會計結算約定條件' },
      { name: 'currency', label: '計價幣別', type: 'string', description: '報表結算基準幣別' },
      { name: 'deliveryDate', label: '預定出貨日', type: 'date', description: '預計交貨出庫日' },
      { name: 'salesRep', label: '負責業務', type: 'string', description: '專案業務工程師' },
      { name: 'isUrgent', label: '急件標記', type: 'boolean', description: '是否為優先急件配送 (支援 CheckBox)' },
      { name: 'withInvoice', label: '隨附發票', type: 'boolean', description: '是否隨貨附紙本統一發票' },
      { name: 'shippingWarehouse', label: '出貨倉庫', type: 'string', description: '出庫物流中心' },
      { name: 'shippingMethod', label: '配送方式', type: 'string', description: '物流承運方式' },
      { name: 'remark', label: '單據備註', type: 'string', description: '訂單重要注意事項' },
    ],
    detailFields: [
      { name: 'index', label: '項次', type: 'number', formatHint: 'N0', description: '明細流水項次序號' },
      { name: 'sku', label: '產品料號', type: 'string', description: '標準物料 SKU 編碼 (支援條碼/QRCode)' },
      { name: 'category', label: '產品品類', type: 'string', description: '產品分類歸屬' },
      { name: 'productName', label: '品名規格', type: 'string', description: '商品完整規格與技術描述' },
      { name: 'unit', label: '單位', type: 'string', description: '出貨計量單位 (台/個/箱)' },
      { name: 'quantity', label: '數量', type: 'number', formatHint: 'N0', description: '實交出貨數量' },
      { name: 'unitPrice', label: '單價', type: 'number', formatHint: 'C0', description: '未稅銷售單價' },
      { name: 'amount', label: '金額小計', type: 'number', formatHint: 'C0', description: '項目小計金額 (數量 × 單價)' },
      { name: 'isInspected', label: '驗收勾選', type: 'boolean', description: '現場實物驗收點收狀態 (支援 CheckBox)' },
      { name: 'batchNo', label: '製造批號', type: 'string', description: '原廠生產品質追溯批號' },
    ],
  },
  data: {
    parameters: defaultOrderParameters,
    items: sampleOrderData14,
  },
};
