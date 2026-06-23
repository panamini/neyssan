/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { remirrorJsonToString } from "../lib/utils";

export type PersistedRemirrorJson = {
  kind: "remirror_json";
  version: 1;
  json: string;
  plainText?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isRawRemirrorDoc(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.type === "doc" &&
    Array.isArray(value.content)
  );
}

export function isPersistedRemirrorJson(value: unknown): value is PersistedRemirrorJson {
  return (
    isRecord(value) &&
    value.kind === "remirror_json" &&
    value.version === 1 &&
    typeof value.json === "string"
  );
}

export function encodeCvDocumentForConvex<T>(value: T): T {
  if (isRawRemirrorDoc(value)) {
    return {
      kind: "remirror_json",
      version: 1,
      json: JSON.stringify(value),
    } as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeCvDocumentForConvex(item)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        encodeCvDocumentForConvex(entry),
      ]),
    ) as T;
  }

  return value;
}

export function decodeCvDocumentFromConvex<T>(value: T): T {
  if (isPersistedRemirrorJson(value)) {
    try {
      const parsed = JSON.parse(value.json);
      return parsed as T;
    } catch {
      return { type: "doc", content: [] } as T;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeCvDocumentFromConvex(item)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        decodeCvDocumentFromConvex(entry),
      ]),
    ) as T;
  }

  return value;
}

export function getMaxNestingDepth(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map(getMaxNestingDepth));
}
