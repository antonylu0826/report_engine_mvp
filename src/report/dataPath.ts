/** Read own data properties without traversing prototypes. Kept independent of the formula runtime. */
export function getNestedValue(object: unknown, path: string): unknown {
  let value = object;
  for (const part of path.split('.')) {
    if (!part || value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
