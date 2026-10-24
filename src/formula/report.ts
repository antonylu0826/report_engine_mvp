import { bandIsVisible, resolveControlAppearance } from './presentation';
import { childSchema } from '../report/dataSchema';
import type { CalculatedField, ControlDefinition, ReportDefinition } from '../types/report.ts';
import type { DataSourceSchema } from '../types/datasource.ts';
import { expandDetailBands } from '../compiler/bandPipeline.ts';
import { groupReportRows } from '../compiler/grouping.ts';
import { analyzeFormula, evaluateAst, executionContext, getNestedValue, isRenderTemplate, schemaField } from './engine.ts';
import { FormulaError, fail, type Ast, type FormulaContext, type FormulaDiagnostic, type FormulaValue } from './types.ts';
import { serializeValue, valueType } from './values.ts';

interface Plan {
  fields: Map<string, CalculatedField>;
  asts: Map<string, Ast>;
  dependencyOrder: string[];
  diagnostics: FormulaDiagnostic[];
}
function diagnosticsOf(error: unknown): FormulaDiagnostic[] {
  if (error instanceof FormulaError) return error.diagnostics;
  throw error;
}
export { childSchema } from '../report/dataSchema';
const planCache = new WeakMap<ReportDefinition, Map<string, Plan>>();
function compile(report: ReportDefinition, schema?: DataSourceSchema): Plan {
  const schemaKey = JSON.stringify([schema ?? null, report.calculatedFields, report.bands.map(b => [b.type, b.groupBy, b.visibleWhen, b.controls.map(c => [c.type, c.expression, c.fieldName, c.visibleWhen, c.styleRules, c.subReportBinding])])]);
  const cached = planCache.get(report)?.get(schemaKey);
  if (cached) return cached;
  const fields = new Map<string, CalculatedField>(), asts = new Map<string, Ast>(), dependencies = new Map<string, string[]>();
  const diagnostics: FormulaDiagnostic[] = [], dependencyOrder: string[] = [];
  const add = (items: FormulaDiagnostic[], path: string, extra: Partial<FormulaDiagnostic> = {}) => diagnostics.push(...items.map(item => ({ ...item, path, ...extra })));
  for (const [index, field] of (report.calculatedFields ?? []).entries()) {
    if (fields.has(field.name)) add([{ code: 'DUPLICATE_FIELD', message: `Duplicate calculated field ${field.name}` }], `calculatedFields[${index}].name`);
    fields.set(field.name, field);
  }
  for (const [index, field] of (report.calculatedFields ?? []).entries()) {
    const path = `calculatedFields[${index}].expression`, extra = { fieldName: field.name, scope: field.scope };
    try {
      const analysis = analyzeFormula(field.expression, { context: { schema }, calculatedFields: fields, calculatedScope: field.scope });
      add(analysis.diagnostics, path, extra);
      if (analysis.type.split('|').some(type => !['null', 'unknown', 'any', field.type].includes(type))) add([{ code: 'TYPE_MISMATCH', message: `${field.name} declares ${field.type}, formula returns ${analysis.type}` }], path, extra);
      asts.set(field.name, analysis.ast);
      dependencies.set(field.name, analysis.dependencies);
    } catch (error) { add(diagnosticsOf(error), path, extra); }
  }
  const visiting = new Set<string>(), complete = new Set<string>();
  const visit = (name: string, trail: string[]) => {
    if (visiting.has(name)) {
      const cycle = [...trail.slice(trail.indexOf(name)), name];
      add([{ code: 'CIRCULAR_REFERENCE', message: `Circular reference: ${cycle.join(' → ')}`, dependencyPath: cycle }], `calculatedFields[${(report.calculatedFields ?? []).findIndex(f => f.name === name)}].expression`, { fieldName: name });
      return;
    }
    if (complete.has(name) || !fields.has(name)) return;
    visiting.add(name);
    for (const dependency of dependencies.get(name) ?? []) visit(dependency, [...trail, name]);
    visiting.delete(name);
    complete.add(name);
    dependencyOrder.push(name);
  };
  fields.forEach((_, name) => visit(name, []));
  report.bands.forEach((band, bi) => {
    const context: FormulaContext = { schema, ...(['Detail','GroupHeader','GroupFooter'].includes(band.type) ? { currentRow: {}, groupRows: [] } : {}) };
    const check = (expression: string | undefined, path: string, controlId?: string, predicate = false) => {
      if (!expression || (!predicate && isRenderTemplate(expression))) return;
      try {
        const analysis = analyzeFormula(expression, { context, calculatedFields: fields });
        add(analysis.diagnostics, path, { bandId: band.id, controlId });
        if (predicate && analysis.type.split('|').some(type => !['boolean','null','unknown'].includes(type))) add([{code:'TYPE_MISMATCH',message:'Print conditions must return boolean or null'}], path, {bandId:band.id, controlId});
      } catch (error) { add(diagnosticsOf(error), path, {bandId:band.id, controlId}); }
    };
    if (band.groupBy && schema && !schemaField(schema.detailFields, band.groupBy)) add([{ code: 'UNKNOWN_FIELD', message: `Unknown grouping field ${band.groupBy}` }], `bands[${bi}].groupBy`, { bandId: band.id });
    check(band.visibleWhen, `bands[${bi}].visibleWhen`, undefined, true);
    band.controls.forEach((control, ci) => {
      const path = `bands[${bi}].controls[${ci}]`;
      check(control.type === 'Expression' ? control.expression : undefined, path+'.expression', control.id);
      check(control.fieldName, path+'.fieldName', control.id);
      check(control.visibleWhen, path+'.visibleWhen', control.id, true);
      control.styleRules?.forEach((rule,index)=>check(rule.when,`${path}.styleRules[${index}].when`,control.id,true));
      if (control.type === 'SubReport' && control.subReportBinding && schema) {
        const field = schemaField(schema.detailFields,control.subReportBinding);
        if (!field || field.type !== 'array') add([{code: field ? 'TYPE_MISMATCH' : 'UNKNOWN_FIELD', message:`Subreport binding ${control.subReportBinding} must reference an array field`}],path+'.subReportBinding',{bandId:band.id,controlId:control.id});
      }
    });
  });
  const plan = { fields, asts, dependencyOrder, diagnostics };
  const cache = planCache.get(report) ?? new Map<string, Plan>();
  if (cache.size >= 8) cache.clear();
  cache.set(schemaKey, plan);
  planCache.set(report, cache);
  return plan;
}
export function validateReportFormulas(report: ReportDefinition, options: FormulaContext & { execute?: boolean } = {}) {
  const diagnostics: FormulaDiagnostic[] = [];
  const orders: Record<string, string[]> = {};
  const check = (definition: ReportDefinition, schema: DataSourceSchema | undefined, prefix = '', subReportControlId?: string, depth = 0) => {
    if (depth > 16) { diagnostics.push({ code: 'LIMIT_EXCEEDED', message: 'Subreport depth exceeds 16', path: prefix }); return; }
    const plan = compile(definition, schema);
    orders[prefix || '$'] = plan.dependencyOrder;
    diagnostics.push(...plan.diagnostics.map(d => ({ ...d, path: prefix + d.path, ...(subReportControlId ? { subReportControlId } : {}) })));
    definition.bands.forEach((band, bi) => band.controls.forEach((control, ci) => {
      if (control.subReportDefinition) check(control.subReportDefinition, childSchema(control, schema), `${prefix}bands[${bi}].controls[${ci}].subReportDefinition.`, control.id, depth + 1);
    }));
  };
  check(report, options.schema);
  if (!diagnostics.length && options.execute) {
    try { preflight(report, createFormulaRun(report, options), diagnostics); }
    catch (error) { diagnostics.push(...diagnosticsOf(error)); }
  }
  return { valid: diagnostics.length === 0, diagnostics, dependencyOrder: orders };
}
export function assertReportFormulas(report: ReportDefinition, schema?: DataSourceSchema) {
  const result = validateReportFormulas(report, { schema });
  if (!result.valid) throw new FormulaError(result.diagnostics);
}

/** One run owns all value caches and its execution clock. No input data is mutated. */
export function createFormulaRun(report: ReportDefinition, input: FormulaContext = {}): FormulaContext {
  const plan = compile(report, input.schema);
  if (plan.diagnostics.length) throw new FormulaError(plan.diagnostics);
  const context = executionContext(input);
  context.calculatedFields = plan.fields;
  context.reportGroups = groupReportRows(report, context.dataSource ?? []);
  const reportValues = new Map<string, FormulaValue>();
  const groupValues = new WeakMap<object, Map<string, FormulaValue>>();
  const rowValues = new WeakMap<object, WeakMap<object, Map<string, FormulaValue>>>();
  const childRuns = new WeakMap<object, Map<ControlDefinition, FormulaContext>>();
  const noRow = {};
  context.resolveCalculated = (name, local) => {
    const field = plan.fields.get(name);
    if (!field) fail('UNKNOWN_FIELD', `Unknown calculated field ${name}`);
    let cache = reportValues;
    let key = name;
    if (field.scope === 'group') {
      if (!local.groupRows) fail('INVALID_SCOPE', `${name} requires a group context`);
      cache = groupValues.get(local.groupRows) ?? new Map();
      groupValues.set(local.groupRows, cache);
    } else if (field.scope === 'row') {
      if (!local.currentRow) fail('INVALID_SCOPE', `${name} requires a row context`);
      const partition = local.groupRows ?? local.dataSource ?? noRow;
      const rows = rowValues.get(partition) ?? new WeakMap<object, Map<string, FormulaValue>>();
      rowValues.set(partition, rows);
      cache = rows.get(local.currentRow) ?? new Map();
      rows.set(local.currentRow, cache);
      key = `${name}:${local.rowIndex ?? 0}`;
    }
    if (cache.has(key)) return cache.get(key)!;
    const fieldContext = field.scope === 'report' ? { ...local, groupRows: undefined, currentRow: undefined, rowIndex: undefined, groupKey: undefined, scope: field.scope }
      : field.scope === 'group' ? { ...local, currentRow: undefined, rowIndex: undefined, scope: field.scope } : { ...local, scope: field.scope };
    let value: FormulaValue;
    try {
      value = evaluateAst(plan.asts.get(name)!, fieldContext);
      if (value !== null && valueType(value) !== field.type) fail('TYPE_MISMATCH', `${name} expects ${field.type}, received ${valueType(value)}`);
    }
    catch (error) {
      throw new FormulaError(diagnosticsOf(error).map(d => ({
        ...d, fieldName: d.fieldName ?? name, scope: d.scope ?? field.scope,
        rowIndex: d.rowIndex ?? fieldContext.rowIndex, groupKey: d.groupKey ?? fieldContext.groupKey,
        path: d.path ?? `calculatedFields[${(report.calculatedFields ?? []).findIndex(f => f.name === name)}].expression`,
        dependencyPath: [name, ...(d.dependencyPath ?? [])],
      })));
    }
    cache.set(key, value);
    return value;
  };
  context.getChildContext = (control, parent) => {
    const owner = parent.currentRow ?? noRow;
    const runs = childRuns.get(owner) ?? new Map();
    childRuns.set(owner, runs);
    const existing = runs.get(control);
    if (existing) return existing;
    const value = getNestedValue(parent.currentRow, control.subReportBinding || 'serials');
    const rows = Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row)) : [];
    const child = createFormulaRun(control.subReportDefinition!, {
      dataSource: rows, reportParameters: parent.reportParameters, schema: childSchema(control, parent.schema),
      executionTime: context.executionTime, timeZone: context.timeZone,
    });
    runs.set(control, child);
    return child;
  };
  return context;
}
function preflight(report: ReportDefinition, context: FormulaContext, diagnostics: FormulaDiagnostic[], prefix = '') {
  const plan = compile(report, context.schema);
  const capture = (run: () => void, location: Partial<FormulaDiagnostic>) => {
    if (diagnostics.length >= 100) return;
    try { run(); } catch (error) { diagnostics.push(...diagnosticsOf(error).map(d => ({ ...location, ...d, path: d.path ? (d.path.startsWith(prefix) ? d.path : prefix+d.path) : location.path }))); }
  };
  const calculate = (local: FormulaContext, scope: CalculatedField['scope']) => (report.calculatedFields ?? []).forEach((field, index) => {
    if (field.scope !== scope) return;
    capture(() => { local.resolveCalculated!(field.name, local); }, { fieldName: field.name, scope, rowIndex: local.rowIndex, groupKey: local.groupKey, path: `${prefix}calculatedFields[${index}].expression` });
  });
  calculate(context, 'report');
  for (const group of context.reportGroups ?? []) {
    const local = { ...context, groupRows: group.rows, groupKey: group.key };
    calculate(local, 'group');
    group.rows.forEach((currentRow, rowIndex) => calculate({ ...local, currentRow, rowIndex }, 'row'));
  }
  const instances = [
    ...report.bands.filter(b => !['Detail', 'GroupHeader', 'GroupFooter'].includes(b.type)).map(band => ({ band, context })),
    ...expandDetailBands(report, context),
  ];
  for (const instance of instances) {
    const bi = report.bands.indexOf(instance.band), bandPath = `${prefix}bands[${bi}]`;
    let visible = false;
    capture(() => { visible = bandIsVisible(instance.band,instance.context,bandPath); }, {bandId:instance.band.id,rowIndex:instance.context.rowIndex,groupKey:instance.context.groupKey,path:bandPath+'.visibleWhen'});
    if (!visible) continue;
    instance.band.controls.forEach((control, ci) => {
      const path = `${bandPath}.controls[${ci}]`;
      const location = { bandId: instance.band.id, controlId: control.id, rowIndex: instance.context.rowIndex, groupKey: instance.context.groupKey };
      let resolved: ControlDefinition | null = null;
      capture(()=>{resolved=resolveControlAppearance(control,instance.context,path);},{...location,path});
      if (!resolved) return;
      for (const [key, source] of [['expression', control.type === 'Expression' ? control.expression : undefined], ['fieldName', control.fieldName]] as const) {
        if (!source || (key === 'expression' && isRenderTemplate(source))) continue;
        capture(() => {
          const analysis = analyzeFormula(source, { context: instance.context, calculatedFields: plan.fields });
          evaluateAst(analysis.ast, instance.context);
        }, { ...location, path: `${path}.${key}` });
      }
      if (control.subReportDefinition) capture(() => {
        const before = diagnostics.length;
        preflight(control.subReportDefinition!, context.getChildContext!(control, instance.context), diagnostics, `${path}.subReportDefinition.`);
        for (let i = before; i < diagnostics.length; i++) diagnostics[i].subReportControlId ??= control.id;
      }, { ...location, path });
    });
  }

}
export function prepareReport(report: ReportDefinition, input: FormulaContext): FormulaContext {
  assertReportFormulas(report, input.schema);
  const context = createFormulaRun(report, input), diagnostics: FormulaDiagnostic[] = [];
  preflight(report, context, diagnostics);
  if (diagnostics.length) throw new FormulaError(diagnostics);
  return context;
}
export function previewFormula(report: ReportDefinition, expression: string, input: FormulaContext = {}) {
  const context = createFormulaRun(report, input);
  const analysis = analyzeFormula(expression, { context, calculatedFields: compile(report, input.schema).fields });
  if (analysis.diagnostics.length) throw new FormulaError(analysis.diagnostics);
  const value = evaluateAst(analysis.ast, context);
  return { value: serializeValue(value), type: valueType(value), exactValue: value === null ? null : String(serializeValue(value)), executionTime: context.executionTime, timeZone: context.timeZone };
}
