import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import type { DataSourceSchema } from '../types/datasource.ts';
import type { ControlDefinition } from '../types/report.ts';

export type FormulaScope = 'row' | 'group' | 'report';
export type FormulaType = 'number' | 'string' | 'boolean' | 'date' | 'datetime';
export type FormulaValue = Decimal | string | boolean | Temporal.PlainDate | Temporal.Instant | null;
export interface Span { start: number; end: number }
export interface FormulaDiagnostic {
  code: string; message: string; span?: Span; path?: string; fieldName?: string;
  scope?: FormulaScope; bandId?: string; controlId?: string; subReportControlId?: string;
  rowIndex?: number; groupKey?: unknown; dependencyPath?: string[];
}
export class FormulaError extends Error {
  readonly diagnostics: FormulaDiagnostic[];
  constructor(diagnostic: FormulaDiagnostic | FormulaDiagnostic[]) {
    const diagnostics = Array.isArray(diagnostic) ? diagnostic : [diagnostic];
    super(diagnostics.map(d => {
      const location = [d.path, d.groupKey !== undefined ? `group ${String(d.groupKey)}` : '', d.rowIndex !== undefined ? `row ${d.rowIndex + 1}` : ''].filter(Boolean).join(' / ');
      const dependency = d.dependencyPath && d.dependencyPath.length > 1 ? ` (${d.dependencyPath.join(' → ')})` : '';
      return `${location ? location + ': ' : ''}${d.message}${dependency}`;
    }).join('\n'));
    this.name = 'FormulaError';
    this.diagnostics = diagnostics;
  }
}
export function fail(code: string, message: string, span?: Span): never {
  throw new FormulaError({ code, message, span });
}
export interface FormulaContext {
  currentRow?: Record<string, unknown>; rowIndex?: number;
  groupRows?: Record<string, unknown>[]; dataSource?: Record<string, unknown>[];
  reportParameters?: Record<string, unknown>; schema?: DataSourceSchema;
  executionTime?: string; timeZone?: string; scope?: FormulaScope;
  groupKey?: string;
  reportGroups?: { key: string; field: string; rows: Record<string, unknown>[] }[];
  calculatedFields?: ReadonlyMap<string, { type: FormulaType; scope: FormulaScope }>;
  resolveCalculated?: (name: string, context: FormulaContext) => FormulaValue;
  getChildContext?: (control: ControlDefinition, parent: FormulaContext) => FormulaContext;
}
export type Ast =
  | { kind: 'number'; value: string; span: Span }
  | { kind: 'literal'; value: string | boolean | null; span: Span }
  | { kind: 'reference'; path: string; span: Span }
  | { kind: 'unary'; op: string; value: Ast; span: Span }
  | { kind: 'binary'; op: string; left: Ast; right: Ast; span: Span }
  | { kind: 'call'; name: string; args: Ast[]; span: Span };

export interface FunctionParameter { name: string; type: string; optional?: boolean; default?: unknown; variadic?: boolean }
export interface FunctionExample {
  expression: string; expected: string | number | boolean | null;
  context?: Pick<FormulaContext, 'dataSource' | 'currentRow' | 'reportParameters' | 'executionTime' | 'timeZone'>;
}
export interface FunctionSpec {
  name: string; category: string; description: string; signature: string;
  aliases: string[];
  calculatedFieldScopes: FormulaScope[];
  parameters: FunctionParameter[]; returnType: string; kind: 'scalar' | 'aggregate';
  scopes: FormulaScope[]; nullBehavior: string; shortCircuit: boolean;
  timeDependent: boolean; errors: string[]; examples: FunctionExample[];
}
export interface FunctionRuntime {
  context: FormulaContext;
  evaluate: (ast: Ast, context?: FormulaContext) => FormulaValue;
}
export interface FunctionEntry extends FunctionSpec {
  execute: (args: Ast[], runtime: FunctionRuntime) => FormulaValue;
}
