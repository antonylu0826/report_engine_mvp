import { schemaField } from '../data/schemaField';
import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import type { DataFieldSchema } from '../types/datasource.ts';
import { parseFormula, walkAst } from './parser.ts';
import { aggregateNames, assertArity, getFunction } from './registry.ts';
import { FormulaError, fail, type Ast, type FormulaContext, type FormulaDiagnostic, type FormulaType, type FormulaValue } from './types.ts';
import { checked, decimal, normalize, numberValue, valueType } from './values.ts';
import { getNestedValue } from '../report/dataPath.ts';
export { getNestedValue };

export { schemaField } from '../data/schemaField';

function resolveReference(path: string, context: FormulaContext): FormulaValue {
  if (['ROW_INDEX', 'INDEX'].includes(path.toUpperCase())) return decimal((context.rowIndex ?? 0) + 1);
  if (path.startsWith('calc.')) {
    if (!context.resolveCalculated) fail('UNKNOWN_FIELD', `Unknown calculated field ${path}`);
    return context.resolveCalculated(path.slice(5), context);
  }
  let value: unknown, field: DataFieldSchema | undefined;
  if (path.startsWith('params.')) {
    const name = path.slice(7);
    value = getNestedValue(context.reportParameters, name);
    field = schemaField(context.schema?.parameters, name);
  } else if (path.startsWith('row.')) {
    const name = path.slice(4);
    value = getNestedValue(context.currentRow, name);
    field = schemaField(context.schema?.detailFields, name);
  } else {
    value = getNestedValue(context.currentRow, path);
    field = schemaField(context.schema?.detailFields, path);
    // A declared row field remains null when missing, rather than changing to a same-named parameter.
    if (value === undefined && !field) {
      value = getNestedValue(context.reportParameters, path);
      field = schemaField(context.schema?.parameters, path);
    }
  }
  if (value === undefined && !field) {
    const rowPath = path.startsWith('row.') ? path.slice(4) : path;
    const knownRow = !path.startsWith('params.') && context.dataSource?.some(row => getNestedValue(row, rowPath) !== undefined);
    if (!knownRow) fail('UNKNOWN_FIELD', `Unknown field ${path}`);
  }
  if ((value === undefined || value === null) && field?.nullable === false) fail('MISSING_VALUE', `Required field ${path} is null or missing`);
  return normalize(value, field?.type, context);
}

export function executionContext(context: FormulaContext = {}): FormulaContext {
  const result = { ...context, executionTime: context.executionTime ?? new Date().toISOString(), timeZone: context.timeZone ?? 'UTC' };
  try { Temporal.Instant.from(result.executionTime).toZonedDateTimeISO(result.timeZone); }
  catch { fail('INVALID_DATE', 'Invalid executionTime or IANA timeZone'); }
  return result;
}
function compare(a: FormulaValue, b: FormulaValue): number {
  if (valueType(a) !== valueType(b)) fail('TYPE_MISMATCH', 'Comparison requires values of the same type');
  if (Decimal.isDecimal(a)) return a.cmp(numberValue(b));
  if (a instanceof Temporal.PlainDate && b instanceof Temporal.PlainDate) return Temporal.PlainDate.compare(a, b);
  if (a instanceof Temporal.Instant && b instanceof Temporal.Instant) return Temporal.Instant.compare(a, b);
  if (a === b) return 0;
  return a! < b! ? -1 : 1;
}
export function evaluateAst(ast: Ast, context: FormulaContext): FormulaValue {
  try {
    let result: FormulaValue;
    switch (ast.kind) {
      case 'number': return decimal(ast.value);
      case 'literal': return ast.value;
      case 'reference': return resolveReference(ast.path, context);
      case 'unary': {
        const value = evaluateAst(ast.value, context);
        return value === null ? null : ast.op === '-' ? numberValue(value).neg() : numberValue(value);
      }
      case 'binary': {
        const a = evaluateAst(ast.left, context), b = evaluateAst(ast.right, context);
        if (a === null || b === null) return null;
        if (['+', '-', '*', '/'].includes(ast.op)) {
          const x = numberValue(a), y = numberValue(b);
          if (ast.op === '/' && y.isZero()) fail('DIVISION_BY_ZERO', 'Divisor is zero');
          return checked(ast.op === '+' ? x.plus(y) : ast.op === '-' ? x.minus(y) : ast.op === '*' ? x.times(y) : x.div(y));
        }
        const order = compare(a, b);
        return ast.op === '=' || ast.op === '==' ? order === 0 : ast.op === '<>' || ast.op === '!=' ? order !== 0
          : ast.op === '<' ? order < 0 : ast.op === '>' ? order > 0 : ast.op === '<=' ? order <= 0 : order >= 0;
      }
      case 'call': {
        const entry = getFunction(ast.name);
        if (!entry) fail('UNKNOWN_FUNCTION', `Unknown function ${ast.name}`);
        assertArity(entry, ast.args.length);
        result = entry.execute(ast.args, { context, evaluate: (node, local = context) => evaluateAst(node, local) });
        if (typeof result === 'string' && result.length > 100_000) fail('LIMIT_EXCEEDED', 'Formula text result exceeds 100000 characters');
        return result;
      }
    }
  } catch (error) {
    if (error instanceof FormulaError) throw new FormulaError(error.diagnostics.map(d => ({ ...d, span: d.span ?? ast.span })));
    if (error instanceof RangeError) fail('INVALID_DATE', error.message, ast.span);
    throw error;
  }
}
export interface AnalysisOptions {
  context?: FormulaContext;
  calculatedFields?: ReadonlyMap<string, { type: FormulaType; scope: string }>;
  calculatedScope?: string;
}
export function analyzeFormula(expression: string, options: AnalysisOptions = {}) {
  const ast = parseFormula(expression);
  const dependencies = new Set<string>();
  const diagnostics: FormulaDiagnostic[] = [];
  walkAst(ast, (node, aggregateDepth) => {
    try {
      if (node.kind === 'call') {
        const entry = getFunction(node.name);
        if (!entry) fail('UNKNOWN_FUNCTION', `Unknown function ${node.name}`, node.span);
        assertArity(entry, node.args.length);
        if (entry.kind === 'aggregate' && (aggregateDepth > 0 || options.calculatedScope === 'row')) fail('INVALID_SCOPE', 'Nested aggregates and aggregates in row calculated fields are not allowed', node.span);
      }
      if (node.kind !== 'reference') return;
      if (['ROW_INDEX', 'INDEX'].includes(node.path.toUpperCase())) {
        if (options.calculatedScope && options.calculatedScope !== 'row' && !aggregateDepth) fail('INVALID_SCOPE', 'ROW_INDEX requires a row context', node.span);
        if (!options.calculatedScope && !options.context?.currentRow && options.context?.rowIndex === undefined && !aggregateDepth) fail('INVALID_SCOPE', 'ROW_INDEX requires a row context', node.span);
        return;
      }
      if (node.path.startsWith('calc.')) {
        const name = node.path.slice(5), field = options.calculatedFields?.get(name);
        if (!field) fail('UNKNOWN_FIELD', `Unknown calculated field ${name}`, node.span);
        dependencies.add(name);
        const targetScope = aggregateDepth ? 'row' : options.calculatedScope;
        if (targetScope && field.scope !== targetScope) fail('INVALID_SCOPE', `${node.path} has ${field.scope} scope, expected ${targetScope}`, node.span);
        if (!targetScope && !options.context?.currentRow && field.scope === 'row' && !aggregateDepth) fail('INVALID_SCOPE', `${node.path} needs a row or aggregate context`, node.span);
        if (field.scope === 'group' && !options.context?.groupRows && !options.calculatedScope) fail('INVALID_SCOPE', `${node.path} needs a group context`, node.span);
        return;
      }
      const schema = options.context?.schema;
      const explicitRow = node.path.startsWith('row.'), explicitParam = node.path.startsWith('params.');
      const path = explicitRow ? node.path.slice(4) : explicitParam ? node.path.slice(7) : node.path;
      const rowField = !explicitParam && schemaField(schema?.detailFields, path);
      const paramField = !explicitRow && schemaField(schema?.parameters, path);
      if (schema && !rowField && !paramField) fail('UNKNOWN_FIELD', `Unknown field ${node.path}`, node.span);
      if ((explicitRow || rowField) && options.calculatedScope && options.calculatedScope !== 'row' && !aggregateDepth) fail('INVALID_SCOPE', `${node.path} needs an aggregate in a ${options.calculatedScope} calculation`, node.span);
      if ((explicitRow || rowField) && !options.calculatedScope && !options.context?.currentRow && !aggregateDepth) fail('INVALID_SCOPE', `${node.path} needs a row or aggregate context`, node.span);
    } catch (error) {
      if (!(error instanceof FormulaError)) throw error;
      diagnostics.push(...error.diagnostics.map(d => ({ ...d, span: d.span ?? node.span })));
    }
  }, aggregateNames);
  // Infer types even for inactive branches; null is compatible with every declared type.
  const infer = (node: Ast): string => {
    if (node.kind === 'number') return 'number';
    if (node.kind === 'literal') return node.value === null ? 'null' : typeof node.value;
    if (node.kind === 'reference') {
      if (['ROW_INDEX', 'INDEX'].includes(node.path.toUpperCase())) return 'number';
      if (node.path.startsWith('calc.')) return options.calculatedFields?.get(node.path.slice(5))?.type ?? 'unknown';
      const schema = options.context?.schema;
      return (node.path.startsWith('params.') ? schemaField(schema?.parameters, node.path.slice(7))
        : node.path.startsWith('row.') ? schemaField(schema?.detailFields, node.path.slice(4))
        : schemaField(schema?.detailFields, node.path) ?? schemaField(schema?.parameters, node.path))?.type ?? 'unknown';
    }
    if (node.kind === 'unary' || node.kind === 'binary') {
      const children = node.kind === 'unary' ? [node.value] : [node.left, node.right];
      const types = children.map(infer);
      const arithmetic = ['+', '-', '*', '/'].includes(node.op);
      if (arithmetic && types.flatMap(type => type.split('|')).some(type => !['unknown', 'null', 'number'].includes(type))) diagnostics.push({ code: 'TYPE_MISMATCH', message: 'Arithmetic requires numbers; use an explicit conversion', span: node.span });
      if (!arithmetic && types.every(type => !['unknown', 'null'].includes(type)) && types[0] !== types[1]) diagnostics.push({ code: 'TYPE_MISMATCH', message: 'Comparison requires matching types', span: node.span });
      return arithmetic ? 'number' : 'boolean';
    }
    const entry = getFunction(node.name);
    const types = node.args.map(infer);
    if (!entry) return 'unknown';
    types.forEach((type, i) => {
      const expected = entry.parameters[Math.min(i, entry.parameters.length - 1)]?.type ?? 'any';
      if (type.split('|').some(actual => !['unknown', 'null', 'any'].includes(actual) && !expected.split('|').includes(actual)) && expected !== 'any') diagnostics.push({ code: 'TYPE_MISMATCH', message: `${entry.name} argument ${i + 1} expects ${expected}, received ${type}`, span: node.args[i].span });
    });
    if (node.name === 'IF' || node.name === 'COALESCE') return [...new Set((node.name === 'IF' ? types.slice(1) : types).flatMap(t => t.split('|')).filter(t => t !== 'null'))].join('|') || 'null';
    if (node.name === 'DATEADD') {
      if (types[2] === 'date' || types[2] === 'datetime') return types[2];
      const argument = node.args[2];
      if (argument?.kind === 'literal' && typeof argument.value === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(argument.value) ? 'date' : 'datetime';
      return 'unknown';
    }
    return entry.returnType;
  };
  const type = infer(ast);
  return { ast, dependencies: [...dependencies], diagnostics, type };
}

export function evaluateFormula(expression: string, input: FormulaContext = {}): FormulaValue {
  const context = executionContext(input);
  const analysis = analyzeFormula(expression, { context, calculatedFields: context.calculatedFields });
  if (analysis.diagnostics.length) throw new FormulaError(analysis.diagnostics);
  return evaluateAst(analysis.ast, context);
}

export function isRenderTemplate(expression: string) {
  return !expression.trimStart().startsWith('=') && /\[(?:PageNumber|TotalPages|ExecutionTime)\]/.test(expression);
}
