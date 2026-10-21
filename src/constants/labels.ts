import type { BandType, ControlType, PageOrientation } from '@/types/report';

/**
 * Pure Traditional Chinese Label Mappings
 * Centralized for immediate clean UI rendering and future i18n support.
 */

export const BAND_NAMES: Record<BandType, string> = {
  ReportHeader: '報表表頭',
  PageHeader: '頁首',
  GroupHeader: '群組首',
  Detail: '明細區',
  GroupFooter: '群組尾',
  ReportFooter: '報表表尾',
  PageFooter: '頁尾',
};

export const CONTROL_NAMES: Record<ControlType, string> = {
  Label: '文字標籤',
  Field: '資料欄位',
  Expression: '計算運算式',
  Line: '分隔線',
  Image: '圖片影像',
  Barcode: '一維條碼',
  QRCode: '二維碼',
  CheckBox: '核取方塊',
  Panel: '面板容器',
  SubReport: '子報表',
};

export const ORIENTATION_NAMES: Record<PageOrientation, string> = {
  portrait: '直向',
  landscape: '橫向',
};

export const DATA_TYPE_NAMES: Record<string, string> = {
  string: '字串',
  number: '數值',
  date: '日期',
  boolean: '布林',
  array: '陣列/清單',
};
