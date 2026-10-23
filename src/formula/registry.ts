import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import { fail, type Ast, type FunctionEntry, type FunctionExample, type FunctionParameter, type FormulaValue, type FunctionRuntime } from './types.ts';
import { Numeric, booleanValue, checked, dateValue, decimal, integer, numberValue, plainDate, serializeValue, stringValue } from './values.ts';

const entries = new Map<string, FunctionEntry>();
const p = (name: string, type: string, optional = false, defaultValue?: unknown, variadic = false): FunctionParameter => ({ name, type, optional, ...(defaultValue === undefined ? {} : { default: defaultValue }), ...(variadic ? { variadic } : {}) });
const example = (expression: string, expected: FunctionExample['expected'], context?: FunctionExample['context']): FunctionExample => ({ expression, expected, ...(context ? { context } : {}) });
function define(name: string, category: string, description: string, parameters: FunctionParameter[], returnType: string,
  examples: FunctionExample[], execute: FunctionEntry['execute'], options: Partial<Pick<FunctionEntry, 'kind' | 'nullBehavior' | 'shortCircuit' | 'timeDependent' | 'errors'>> = {}) {
  const entry: FunctionEntry = {
    name, category, description, parameters, returnType, examples, execute, aliases: [], calculatedFieldScopes: options.kind === 'aggregate' ? ['group', 'report'] : ['row', 'group', 'report'],
    signature: `${name}(${parameters.map(param => param.name + (param.variadic ? '...' : '') + (param.optional ? '?' : '')).join(', ')})`,
    kind: 'scalar', scopes: ['row', 'group', 'report'], nullBehavior: 'Any null argument returns null.',
    shortCircuit: false, timeDependent: false, errors: ['TYPE_MISMATCH', 'INVALID_ARGUMENT', 'NUMERIC_OVERFLOW'], ...options,
  };
  entries.set(name, entry);
}
const values = (args: Ast[], runtime: FunctionRuntime) => args.map(arg => runtime.evaluate(arg));
function scalar(run: (values: FormulaValue[], runtime: FunctionRuntime) => FormulaValue): FunctionEntry['execute'] {
  return (args, runtime) => {
    const argsValues = values(args, runtime);
    return argsValues.includes(null) ? null : run(argsValues, runtime);
  };
}

define('ABS', 'number', '絕對值', [p('value', 'number')], 'number', [example('=ABS(-2.5)', 2.5), example('=ABS(NULL)', null)], scalar(([value]) => numberValue(value).abs()));
for (const [name, rounding] of [['ROUND', Decimal.ROUND_HALF_UP], ['ROUNDUP', Decimal.ROUND_UP], ['ROUNDDOWN', Decimal.ROUND_DOWN]] as const) {
  define(name, 'number', name === 'ROUND' ? '四捨五入；半值遠離零' : name === 'ROUNDUP' ? '朝遠離零的方向取整' : '朝零的方向取整',
    [p('value', 'number'), p('digits', 'number', true, 0)], 'number',
    [example(`=${name}(-1.25, 1)`, name === 'ROUNDDOWN' ? -1.2 : -1.3), example(`=${name}(125, -1)`, name === 'ROUNDDOWN' ? 120 : 130)],
    scalar(([value, digits]) => checked(numberValue(value).toNearest(new Numeric(10).pow(-integer(digits ?? decimal(0), -100, 100)), rounding))));
}
define('MOD', 'number', '餘數的正負號與除數相同', [p('value', 'number'), p('divisor', 'number')], 'number',
  [example('=MOD(-5, 3)', 1), example('=MOD(5, -3)', -1)], scalar(([value, divisor]) => {
    const d = numberValue(divisor);
    if (d.isZero()) fail('DIVISION_BY_ZERO', 'MOD divisor is zero');
    return checked(numberValue(value).mod(d));
  }), { errors: ['TYPE_MISMATCH', 'DIVISION_BY_ZERO'] });
define('IF', 'logical', '只計算選取的分支；空條件回傳 null', [p('condition', 'boolean'), p('whenTrue', 'any'), p('whenFalse', 'any')], 'any',
  [example('=IF(TRUE, 7, 1 / 0)', 7), example('=IF(NULL, 1, 2)', null)], (args, runtime) => {
    const condition = booleanValue(runtime.evaluate(args[0]));
    return condition === null ? null : runtime.evaluate(args[condition ? 1 : 2]);
  }, { shortCircuit: true, nullBehavior: 'Null condition returns null; only selected branch is evaluated.' });
for (const name of ['AND', 'OR'] as const) {
  define(name, 'logical', '三值布林，遇到可確定結果時停止計算', [p('conditions', 'boolean', false, undefined, true)], 'boolean',
    [example(`=${name}(TRUE, NULL)`, name === 'AND' ? null : true), example(`=${name}(FALSE, NULL)`, name === 'AND' ? false : null)],
    (args, runtime) => {
      let hasNull = false;
      for (const arg of args) {
        const value = booleanValue(runtime.evaluate(arg));
        if (value === (name === 'OR')) return value;
        if (value === null) hasNull = true;
      }
      return hasNull ? null : name === 'AND';
    }, { shortCircuit: true, nullBehavior: 'AND: false dominates null; OR: true dominates null. Otherwise null propagates.' });
}
define('NOT', 'logical', '布林反向', [p('condition', 'boolean')], 'boolean', [example('=NOT(TRUE)', false), example('=NOT(NULL)', null)], scalar(([value]) => !booleanValue(value)));
define('COALESCE', 'logical', '第一個非 null 值', [p('values', 'any', false, undefined, true)], 'any',
  [example('=COALESCE(NULL, 0, 1 / 0)', 0), example('=COALESCE(NULL, NULL)', null)], (args, runtime) => {
    for (const arg of args) { const value = runtime.evaluate(arg); if (value !== null) return value; }
    return null;
  }, { shortCircuit: true, nullBehavior: 'Skips null arguments, stops at first non-null value; all null returns null.' });
define('ISNULL', 'logical', '判斷是否為 null', [p('value', 'any')], 'boolean', [example('=ISNULL(NULL)', true), example('=ISNULL(0)', false)],
  (args, runtime) => runtime.evaluate(args[0]) === null, { nullBehavior: 'Returns true for null, false otherwise.' });

for (const name of ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'] as const) {
  define(name, 'aggregate', '對目前資料範圍逐列運算，忽略 null', [p('expression', name === 'COUNT' ? 'any' : 'number', name === 'COUNT')], 'number',
    [example(`=${name}(${name === 'COUNT' ? '' : 'amount'})`, name === 'COUNT' ? 3 : name === 'SUM' ? 30 : name === 'AVG' ? 15 : name === 'MIN' ? 10 : 20,
      { dataSource: [{ amount: 10 }, { amount: null }, { amount: 20 }] }),
    example(`=${name}(${name === 'COUNT' ? '' : 'amount'})`, name === 'SUM' || name === 'COUNT' ? 0 : null, { dataSource: [] })],
    (args, runtime) => {
      const rows = runtime.context.groupRows ?? runtime.context.dataSource ?? [];
      if (name === 'COUNT' && args.length === 0) return decimal(rows.length);
      let count = 0, total = decimal(0), extreme: Decimal | null = null;
      rows.forEach((row, rowIndex) => {
        const value = runtime.evaluate(args[0], { ...runtime.context, currentRow: row, rowIndex, scope: 'row' });
        if (value === null) return;
        count++;
        if (name === 'COUNT') return;
        const number = numberValue(value);
        if (name === 'SUM' || name === 'AVG') total = checked(total.plus(number));
        if (!extreme || (name === 'MIN' ? number.lt(extreme) : number.gt(extreme))) extreme = number;
      });
      if (name === 'COUNT') return decimal(count);
      if (name === 'SUM') return total;
      if (name === 'AVG') return count ? checked(total.div(count)) : null;
      return extreme;
    }, { kind: 'aggregate', nullBehavior: 'Ignores null. Empty SUM/COUNT = 0; AVG/MIN/MAX = null. COUNT() counts rows, COUNT(expression) counts non-null results.' });
}
define('CONCAT', 'text', '組合文字；用 COALESCE 明確替換空值', [p('texts', 'string', false, undefined, true)], 'string',
  [example('=CONCAT("客戶", "／", "甲")', '客戶／甲'), example('=CONCAT("a", NULL)', null)], scalar(v => {
    const strings = v.map(stringValue);
    if (strings.reduce((n, text) => n + text.length, 0) > 100_000) fail('LIMIT_EXCEEDED', 'Text result exceeds 100000 characters');
    return strings.join('');
  }));
define('LEN', 'text', 'Unicode code point 數量', [p('text', 'string')], 'number', [example('=LEN("中😀")', 2), example('=LEN("")', 0)], scalar(([v]) => decimal(Array.from(stringValue(v)).length)));
for (const name of ['LEFT', 'RIGHT'] as const) {
  define(name, 'text', '從左／右擷取 Unicode code points', [p('text', 'string'), p('count', 'number', true, 1)], 'string',
    [example(`=${name}("甲😀乙", 2)`, name === 'LEFT' ? '甲😀' : '😀乙'), example(`=${name}("abc", 0)`, '')],
    scalar(([text, count]) => {
      const chars = Array.from(stringValue(text)), length = integer(count ?? decimal(1), 0, 100_000);
      return (name === 'LEFT' ? chars.slice(0, length) : length ? chars.slice(-length) : []).join('');
    }));
}
define('MID', 'text', '從第 start 個字元擷取，索引從 1 開始', [p('text', 'string'), p('start', 'number'), p('count', 'number')], 'string',
  [example('=MID("甲😀乙", 2, 1)', '😀'), example('=MID("abc", 10, 2)', '')], scalar(([text, start, count]) => {
    const from = integer(start, 1, 100_000) - 1;
    return Array.from(stringValue(text)).slice(from, from + integer(count, 0, 100_000)).join('');
  }));
for (const name of ['TRIM', 'UPPER', 'LOWER'] as const) {
  define(name, 'text', name === 'TRIM' ? '移除頭尾 Unicode 空白，內部空白不變' : 'Unicode 大小寫轉換', [p('text', 'string')], 'string',
    [example(`=${name}(" aB ")`, name === 'TRIM' ? 'aB' : name === 'UPPER' ? ' AB ' : ' ab '), example(`=${name}(NULL)`, null)],
    scalar(([text]) => name === 'TRIM' ? stringValue(text).trim() : name === 'UPPER' ? stringValue(text).toUpperCase() : stringValue(text).toLowerCase()));
}
define('SUBSTITUTE', 'text', '替換所有符合的文字；不使用正規表示式', [p('text', 'string'), p('search', 'string'), p('replacement', 'string')], 'string',
  [example('=SUBSTITUTE("a.a", ".", "-")', 'a-a'), example('=SUBSTITUTE("abc", "x", "y")', 'abc')], scalar(([text, search, replacement]) => {
    const match = stringValue(search);
    if (!match) fail('INVALID_ARGUMENT', 'SUBSTITUTE search must not be empty');
    const parts = stringValue(text).split(match), substitution = stringValue(replacement);
    if (parts.reduce((n, part) => n + part.length, 0) + (parts.length - 1) * substitution.length > 100_000) fail('LIMIT_EXCEEDED', 'Text result exceeds 100000 characters');
    return parts.join(substitution);
  }));

define('DATE', 'date', '建立有效的 ISO 純日期，不自動溢位至下一月', [p('year', 'number'), p('month', 'number'), p('day', 'number')], 'date',
  [example('=DATE(2024, 2, 29)', '2024-02-29'), example('=DATE(2000, 1, 1)', '2000-01-01')], scalar(([year, month, day]) =>
    Temporal.PlainDate.from({ year: integer(year, 1, 9999), month: integer(month, 1, 12), day: integer(day, 1, 31) }, { overflow: 'reject' })), { errors: ['TYPE_MISMATCH', 'INVALID_ARGUMENT', 'INVALID_DATE'] });
for (const name of ['TODAY', 'NOW'] as const) {
  define(name, 'date', '使用本次執行固定的時間與時區', [], name === 'TODAY' ? 'date' : 'datetime',
    [example(`=${name}()`, name === 'TODAY' ? '2026-10-24' : '2026-10-23T18:00:00Z', { executionTime: '2026-10-23T18:00:00Z', timeZone: 'Asia/Taipei' }),
    example(`=${name}()`, name === 'TODAY' ? '2026-10-23' : '2026-10-23T18:00:00Z', { executionTime: '2026-10-23T18:00:00Z', timeZone: 'UTC' })],
    (_, { context }) => {
      const time = Temporal.Instant.from(context.executionTime!);
      return name === 'NOW' ? time : time.toZonedDateTimeISO(context.timeZone ?? 'UTC').toPlainDate();
    }, { timeDependent: true, nullBehavior: 'No arguments.', errors: ['INVALID_DATE'] });
}
for (const name of ['YEAR', 'MONTH', 'DAY'] as const) {
  define(name, 'date', '取得日期部分；datetime 先套用執行時區', [p('date', 'date|datetime|string')], 'number',
    [example(`=${name}("2024-02-29")`, name === 'YEAR' ? 2024 : name === 'MONTH' ? 2 : 29), example(`=${name}(NULL)`, null)],
    scalar(([value], { context }) => { const date = plainDate(value, context); return decimal(name === 'YEAR' ? date.year : name === 'MONTH' ? date.month : date.day); }));
}
const unitMap: Record<string, 'years' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds'> = { year: 'years', month: 'months', week: 'weeks', day: 'days', hour: 'hours', minute: 'minutes', second: 'seconds' };
function unit(value: FormulaValue) {
  const name = stringValue(value).toLowerCase();
  if (!Object.hasOwn(unitMap, name)) fail('INVALID_ARGUMENT', 'Date unit must be year, month, week, day, hour, minute, or second');
  return unitMap[name];
}
define('DATEADD', 'date', '日曆加減；月底截至最後一天，datetime 遵守執行時區及 DST', [p('unit', 'string'), p('amount', 'number'), p('date', 'date|datetime|string')], 'date|datetime',
  [example('=DATEADD("month", 1, "2024-01-31")', '2024-02-29'), example('=DATEADD("day", -1, "2024-03-01")', '2024-02-29')],
  scalar(([unitValue, amount, value], { context }) => {
    const key = unit(unitValue), date = dateValue(value, context), count = integer(amount);
    if (date instanceof Temporal.PlainDate) {
      if (['hours', 'minutes', 'seconds'].includes(key)) fail('INVALID_ARGUMENT', 'Pure dates only support year/month/week/day units');
      return date.add({ [key]: count }, { overflow: 'constrain' });
    }
    return date.toZonedDateTimeISO(context.timeZone ?? 'UTC').add({ [key]: count }, { overflow: 'constrain' }).toInstant();
  }));
define('DATEDIFF', 'date', '完整單位差，朝零截斷；day 為當地日曆天，hour/minute/second 為實際經過時間',
  [p('unit', 'string'), p('start', 'date|datetime|string'), p('end', 'date|datetime|string')], 'number',
  [example('=DATEDIFF("day", "2024-02-28", "2024-03-01")', 2), example('=DATEDIFF("day", "2024-03-01", "2024-02-28")', -2)],
  scalar(([unitValue, start, end], { context }) => {
    const key = unit(unitValue);
    if (['hours', 'minutes', 'seconds'].includes(key)) {
      const a = dateValue(start, context), b = dateValue(end, context);
      if (!(a instanceof Temporal.Instant) || !(b instanceof Temporal.Instant)) fail('TYPE_MISMATCH', 'Elapsed time units require datetime values');
      const milliseconds = decimal(b.epochMilliseconds).minus(a.epochMilliseconds);
      return milliseconds.div(key === 'hours' ? 3_600_000 : key === 'minutes' ? 60_000 : 1000).trunc();
    }
    const a = plainDate(start, context), b = plainDate(end, context);
    const difference = a.until(b, { largestUnit: key as 'years' | 'months' | 'weeks' | 'days' });
    return decimal(key === 'years' ? difference.years : key === 'months' ? difference.months : key === 'weeks' ? difference.weeks : difference.days);
  }));
define('FORMAT_DATE', 'date', '日期轉文字；YYYY/yyyy MM DD/dd HH mm ss，其他英文字母不接受', [p('value', 'date|datetime|string'), p('pattern', 'string')], 'string',
  [example('=FORMAT_DATE("2024-02-29", "YYYY/MM/DD")', '2024/02/29'), example('=FORMAT_DATE("2024-02-29T02:03:04Z", "MM-dd HH:mm:ss")', '02-29 02:03:04')],
  scalar(([value, patternValue], { context }) => {
    const valueDate = dateValue(value, context), pattern = stringValue(patternValue);
    const date = valueDate instanceof Temporal.Instant ? valueDate.toZonedDateTimeISO(context.timeZone ?? 'UTC') : valueDate;
    const tokens: Record<string, string> = {
      YYYY: String(date.year).padStart(4, '0'), yyyy: String(date.year).padStart(4, '0'), MM: String(date.month).padStart(2, '0'),
      DD: String(date.day).padStart(2, '0'), dd: String(date.day).padStart(2, '0'),
      HH: String('hour' in date ? date.hour : 0).padStart(2, '0'), mm: String('minute' in date ? date.minute : 0).padStart(2, '0'), ss: String('second' in date ? date.second : 0).padStart(2, '0'),
    };
    if ((pattern.match(/([A-Za-z])\1*/g) ?? []).some(token => !Object.hasOwn(tokens, token))) fail('INVALID_ARGUMENT', 'Unsupported date format token');
    return pattern.replace(/YYYY|yyyy|MM|DD|dd|HH|mm|ss/g, token => tokens[token]);
  }));
define('TO_NUMBER', 'conversion', '明確將十進位文字轉數值；拒絕空白及千分位', [p('value', 'number|string')], 'number',
  [example('=TO_NUMBER("12.30") + 0.2', 12.5), example('=TO_NUMBER(NULL)', null)], scalar(([value]) => {
    if (Decimal.isDecimal(value)) return value;
    const text = stringValue(value);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) fail('TYPE_MISMATCH', 'Invalid decimal text');
    return decimal(text);
  }));
define('TO_TEXT', 'conversion', '將純量轉為穩定文字；空值仍是 null', [p('value', 'any')], 'string',
  [example('=TO_TEXT(12.30)', '12.3'), example('=TO_TEXT(FALSE)', 'false')], scalar(([value]) => String(serializeValue(value))));
define('TO_DATE', 'conversion', 'ISO 日期或 datetime 轉純日期；datetime 先套用執行時區', [p('value', 'date|datetime|string')], 'date',
  [example('=TO_DATE("2024-02-29")', '2024-02-29'), example('=TO_DATE(NULL)', null)], scalar(([value], { context }) => plainDate(value, context)));
define('FORMAT_NUMBER', 'conversion', '固定小數位文字，不改變來源數值；半值遠離零', [p('value', 'number'), p('digits', 'number', true, 2)], 'string',
  [example('=FORMAT_NUMBER(1.25, 1)', '1.3'), example('=FORMAT_NUMBER(12)', '12.00')], scalar(([value, digits]) => numberValue(value).toFixed(integer(digits ?? decimal(2), 0, 20))));

export const aggregateNames = new Set([...entries.values()].filter(e => e.kind === 'aggregate').map(e => e.name));
export function getFunction(name: string) { return entries.get(name.toUpperCase()); }
export function assertArity(entry: FunctionEntry, count: number) {
  const minimum = entry.parameters.filter(p => !p.optional).length;
  const maximum = entry.parameters.some(p => p.variadic) ? 256 : entry.parameters.length;
  if (count < minimum || count > maximum) fail('ARGUMENT_COUNT', `${entry.signature}: received ${count} arguments`);
}
export function getFormulaCatalog(filter: { category?: string; name?: string } = {}) {
  return {
    version: '1.0.0',
    scopeRules: {
      calculatedFields: { row: 'row fields, parameters, other row calculations; no aggregates', group: 'parameters, other group calculations, aggregate(row expression)', report: 'parameters, other report calculations, aggregate(row expression)' },
      controls: 'Detail has current row/group/report; GroupHeader/Footer has first row/group/report; Report/Page headers/footers have report context. Aggregates use the current group or all rows.',
      child: 'Own rows and calculations; inherits master parameters and execution clock. No parent calculation references.',
    },
    syntax: { prefix: 'Optional =', operators: ['+', '-', '*', '/', '=', '==', '<>', '!=', '<', '>', '<=', '>='], precedence: ['parentheses / unary +/-', '* /', '+ -', 'comparison'], references: ['row.field', 'params.field', 'calc.name', 'bareField (row then params)'], literals: ['decimal', '"string" (double quote escape: "")', 'TRUE', 'FALSE', 'NULL'], functionCase: 'insensitive', fieldCase: 'sensitive', limits: { characters: 8192, tokens: 2048, nesting: 64, functionArguments: 256 } },
    numeric: { precision: 34, exponentRange: [-100, 100], rounding: 'half away from zero', json: 'number when exact round-trip, decimal string otherwise; type stays number', display: 'formatting does not change calculation values' },
    dates: { date: 'YYYY-MM-DD', datetime: 'ISO with explicit offset', defaultTimeZone: 'UTC', snapshot: 'one executionTime per run', units: Object.keys(unitMap), monthOverflow: 'constrain to last day', textIndex: 'Unicode code points; MID starts at 1; not grapheme clusters' },
    systemVariables: [
      { name: 'ROW_INDEX', aliases: ['INDEX'], expression: '=ROW_INDEX', stage: 'data', type: 'number', description: '1-based row index within current group' },
      { name: 'PageNumber', expression: '[PageNumber]', stage: 'render', type: 'number' },
      { name: 'TotalPages', expression: '[TotalPages]', stage: 'render', type: 'number' },
      { name: 'ExecutionTime', expression: '[ExecutionTime]', stage: 'render', type: 'datetime' },
    ],
    functions: [...entries.values()].filter(e => (!filter.category || e.category === filter.category) && (!filter.name || e.name === filter.name.toUpperCase()))
      .map(({ execute: _execute, ...spec }) => structuredClone(spec)),
  };
}
