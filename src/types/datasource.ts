/**
 * Normalized DataSource Schema
 * Standardized data model designed for host application embedding and AI Agent interoperability.
 */

export type FieldDataType = 'string' | 'number' | 'boolean' | 'date';

export interface DataFieldSchema {
  /** Property key used in binding, e.g. 'unitPrice', 'customerName' */
  name: string;
  /** Human-readable display label, e.g. '產品單價', '客戶名稱' */
  label: string;
  /** Primitive data type */
  type: FieldDataType;
  /** Suggested formatting string, e.g. 'C0', 'N0', 'yyyy-MM-dd' */
  formatHint?: string;
  /** Optional field description for tooltips and AI prompt context */
  description?: string;
}

export interface DataSourceSchema {
  /** Master/Header parameters (single value per document, e.g. orderNo, customerName, taxRate) */
  parameters?: DataFieldSchema[];
  /** Detail list fields (repeating items per row, e.g. sku, productName, quantity, unitPrice) */
  detailFields: DataFieldSchema[];
}

export interface DataSourceData {
  /** Master/Header record key-value pairs */
  parameters?: Record<string, unknown>;
  /** Detail records array */
  items: Record<string, unknown>[];
}

export interface ReportDataSource {
  /** Unique identifier of the data source */
  id: string;
  /** Human-readable name of the dataset */
  name: string;
  /** Formal schema definition of available fields */
  schema: DataSourceSchema;
  /** Runtime or mock data payload */
  data: DataSourceData;
}
