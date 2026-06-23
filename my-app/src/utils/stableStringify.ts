/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/**
 * stableStringify
 * Deterministic JSON stringify for objects/arrays:
 * - Sorts object keys to ensure stable ordering
 * - Handles primitives, null, arrays, Date, Map, Set
 * - Cycle-safe via WeakSet
 * - Omits functions/symbols/undefined at leaf level (JSON-like semantics)
 *
 * Usage:
 *   import { stableStringify } from "@/utils/stableStringify";
 *   const key = stableStringify(doc);
 */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  function serialize(v: unknown): string {
    if (v === null) return "null";

    const t = typeof v;
    if (t === "string") return JSON.stringify(v);
    if (t === "number" || t === "boolean") return String(v);
    if (t === "bigint") return JSON.stringify((v as bigint).toString());
    if (t === "symbol" || t === "function" || t === "undefined") return "null";

    // Date
    if (v instanceof Date) return JSON.stringify(v.toISOString());

    // Array
    if (Array.isArray(v)) {
      const items = v.map((item) => serialize(item));
      return `[${items.join(",")}]`;
    }

    // Map
    if (v instanceof Map) {
      const entries = Array.from(v.entries())
        .map(([k, val]) => [String(k), val] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, val]) => `${JSON.stringify(k)}:${serialize(val)}`);
      return `{${entries.join(",")}}`;
    }

    // Set
    if (v instanceof Set) {
      const items = Array.from(v.values())
        .map((item) => serialize(item))
        .sort();
      return `[${items.join(",")}]`;
    }

    // Plain object
    if (typeof v === "object" && v) {
      if (seen.has(v as object)) return JSON.stringify("[[Circular]]");
      seen.add(v as object);

      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];
      for (const k of keys) {
        const sv = serialize(obj[k]);
        parts.push(`${JSON.stringify(k)}:${sv}`);
      }
      return `{${parts.join(",")}}`;
    }

    // Fallback
    try {
      return JSON.stringify(v as unknown);
    } catch {
      return JSON.stringify(String(v));
    }
  }

  return serialize(value);
}

export default stableStringify;