/**
 * Strict deep equality check for JSON-serializable values and common JS types.
 * - Uses function declaration (project style)
 * - Handles primitives, arrays, plain objects and Date objects
 * - Avoids adding external dependencies like lodash
 *
 * Note: This intentionally keeps the implementation focused and predictable for
 * comparing stored CV state. It is not a fully generic circular-reference aware
 * deep equal implementation (which would require more complexity).
 */

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a === null || b === null || a === undefined || b === undefined) return a === b;

  // Date objects: compare time value
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  // If one is date and other isn't, not equal
  if (a instanceof Date || b instanceof Date) return false;

  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) return false;

  // Primitive types (string, number, boolean, symbol, bigint)
  if (typeA !== 'object') return a === b;

  // Arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== (b as unknown[]).length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual((a as unknown[])[i], (b as unknown[])[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;

  // Plain objects
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  // Compare keys in deterministic order
  aKeys.sort();
  bKeys.sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }

  for (const key of aKeys) {
    const av = (a as Record<string, unknown>)[key];
    const bv = (b as Record<string, unknown>)[key];
    if (!deepEqual(av, bv)) return false;
  }

  return true;
}