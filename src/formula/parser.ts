import { fail, type Ast, type Span } from './types.ts';

interface Token { kind: 'number' | 'string' | 'identifier' | 'symbol' | 'end'; text: string; span: Span }
const priorities: Record<string, number> = { '=': 1, '==': 1, '<>': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '+': 2, '-': 2, '*': 3, '/': 3 };
const cache = new Map<string, Ast>();

/** Bounded grammar: no property calls, indexing, assignments, or executable JavaScript. */
export function parseFormula(source: string): Ast {
  const cached = cache.get(source);
  if (cached) return cached;
  if (source.length > 8192) fail('LIMIT_EXCEEDED', 'Formula exceeds 8192 characters');
  const tokens: Token[] = [];
  let cursor = source.match(/^\s*=/)?.[0].length ?? 0;
  while (cursor < source.length) {
    if (/\s/u.test(source[cursor])) { cursor++; continue; }
    const start = cursor;
    const rest = source.slice(cursor);
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const identifier = /^[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)*/u.exec(rest);
    if (number) {
      cursor += number[0].length;
      tokens.push({ kind: 'number', text: number[0], span: { start, end: cursor } });
    } else if (source[cursor] === '"' || source[cursor] === "'") {
      const quote = source[cursor++];
      let value = '', closed = false;
      while (cursor < source.length) {
        const char = source[cursor++];
        if (char === quote) {
          if (source[cursor] === quote) { value += quote; cursor++; }
          else { closed = true; break; }
        } else if (char === '\\') {
          const escaped = source[cursor++];
          if (escaped === 'n') value += '\n';
          else if (escaped === 't') value += '\t';
          else if (escaped === quote || escaped === '\\') value += escaped;
          else fail('SYNTAX_ERROR', 'Invalid string escape', { start: cursor - 2, end: cursor });
        } else value += char;
      }
      if (!closed) fail('SYNTAX_ERROR', 'Unterminated string', { start, end: cursor });
      tokens.push({ kind: 'string', text: value, span: { start, end: cursor } });
    } else if (identifier) {
      cursor += identifier[0].length;
      tokens.push({ kind: 'identifier', text: identifier[0], span: { start, end: cursor } });
    } else {
      const symbol = /^(?:<=|>=|<>|!=|==|[+*/(),=<>-])/.exec(rest)?.[0];
      if (!symbol) fail('SYNTAX_ERROR', `Unexpected character ${source[cursor]}`, { start, end: start + 1 });
      cursor += symbol.length;
      tokens.push({ kind: 'symbol', text: symbol, span: { start, end: cursor } });
    }
    if (tokens.length > 2048) fail('LIMIT_EXCEEDED', 'Formula exceeds 2048 tokens');
  }
  tokens.push({ kind: 'end', text: '', span: { start: cursor, end: cursor } });
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const expect = (symbol: string) => {
    if (peek().text !== symbol) fail('SYNTAX_ERROR', `Expected ${symbol}`, peek().span);
    return take();
  };
  const expression = (minimum = 0, depth = 0): Ast => {
    if (depth > 64) fail('LIMIT_EXCEEDED', 'Formula nesting exceeds 64 levels', peek().span);
    const token = take();
    let left: Ast;
    if (token.kind === 'number') left = { kind: 'number', value: token.text, span: token.span };
    else if (token.kind === 'string') left = { kind: 'literal', value: token.text, span: token.span };
    else if (token.text === '+' || token.text === '-') {
      const value = expression(4, depth + 1);
      left = { kind: 'unary', op: token.text, value, span: { start: token.span.start, end: value.span.end } };
    } else if (token.text === '(') {
      left = expression(0, depth + 1);
      expect(')');
    } else if (token.kind === 'identifier') {
      const upper = token.text.toUpperCase();
      if (['TRUE', 'FALSE', 'NULL'].includes(upper)) left = { kind: 'literal', value: upper === 'NULL' ? null : upper === 'TRUE', span: token.span };
      else if (peek().text === '(') {
        take();
        const args: Ast[] = [];
        if (peek().text !== ')') {
          args.push(expression(0, depth + 1));
          while (peek().text === ',') {
            take();
            args.push(expression(0, depth + 1));
          }
        }
        const end = expect(')').span.end;
        left = { kind: 'call', name: upper, args, span: { start: token.span.start, end } };
      } else left = { kind: 'reference', path: token.text, span: token.span };
    } else fail('SYNTAX_ERROR', 'Expected a value, field, or function', token.span);
    while (peek().kind === 'symbol' && (priorities[peek().text] ?? -1) >= minimum) {
      const op = take().text;
      const right = expression(priorities[op] + 1, depth + 1);
      left = { kind: 'binary', op, left, right, span: { start: left.span.start, end: right.span.end } };
    }
    return left;
  };
  const ast = expression();
  if (peek().kind !== 'end') fail('SYNTAX_ERROR', `Unexpected token ${peek().text}`, peek().span);
  const pending: { node: Ast; depth: number }[] = [{ node: ast, depth: 1 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth > 64) fail('LIMIT_EXCEEDED', 'Formula tree exceeds 64 levels', node.span);
    const children = node.kind === 'unary' ? [node.value] : node.kind === 'binary' ? [node.left, node.right] : node.kind === 'call' ? node.args : [];
    children.forEach(child => pending.push({ node: child, depth: depth + 1 }));
    Object.freeze(node.span);
    if (node.kind === 'call') Object.freeze(node.args);
    Object.freeze(node);
  }
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(source, ast);
  return ast;
}

export function walkAst(ast: Ast, visit: (node: Ast, aggregateDepth: number) => void, aggregateNames: ReadonlySet<string>, depth = 0) {
  visit(ast, depth);
  if (ast.kind === 'unary') walkAst(ast.value, visit, aggregateNames, depth);
  if (ast.kind === 'binary') {
    walkAst(ast.left, visit, aggregateNames, depth);
    walkAst(ast.right, visit, aggregateNames, depth);
  }
  if (ast.kind === 'call') ast.args.forEach(arg => walkAst(arg, visit, aggregateNames, depth + (aggregateNames.has(ast.name) ? 1 : 0)));
}
