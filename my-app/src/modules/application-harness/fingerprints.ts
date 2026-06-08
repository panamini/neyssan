import type { SourceRefV1 } from "./schema";

const HASH_PREFIX = "ah1";
const HASH_NAMESPACE = "application-harness";
const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const FNV64_MASK = 0xffffffffffffffffn;
const textEncoder = new TextEncoder();

export type BuildJobHashInput = Readonly<{
  jobId: string;
  rawDescription: string;
  sourceUrl?: string;
  title?: string;
  company?: string;
}>;

export type BuildCandidateHashInput = Readonly<{
  cvId?: string;
  candidateEvidenceProfileId?: string;
  structuredSectionsHash?: string;
  cvSnapshotHash?: string;
}>;

export type BuildContextHashInput = Readonly<{
  jobHash: string;
  candidateHash: string;
  settingsHash: string;
}>;

export function stableSerialize(value: unknown): string {
  return serializeStableValue(value, new WeakSet<object>());
}

export function buildStableHash(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = FNV64_OFFSET_BASIS;

  for (const byte of textEncoder.encode(serialized)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV64_PRIME) & FNV64_MASK;
  }

  return `${HASH_PREFIX}:${hash.toString(16).padStart(16, "0")}`;
}

export function buildJobHash(input: BuildJobHashInput): string {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "job",
    version: 1,
    input,
  });
}

export function buildCandidateHash(input: BuildCandidateHashInput): string {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "candidate",
    version: 1,
    input,
  });
}

export function buildSettingsHash(settings: unknown): string {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "settings",
    version: 1,
    settings,
  });
}

export function buildContextHash(input: BuildContextHashInput): string {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "context",
    version: 1,
    input,
  });
}

export function buildSourceRefHash(sourceRef: SourceRefV1): string {
  return buildStableHash({
    namespace: HASH_NAMESPACE,
    type: "source-ref",
    version: 1,
    sourceRef,
  });
}

function serializeStableValue(value: unknown, seen: WeakSet<object>): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return `string:${JSON.stringify(value)}`;
  }

  if (typeof value === "number") {
    return serializeNumber(value);
  }

  if (typeof value === "boolean") {
    return `boolean:${value ? "true" : "false"}`;
  }

  if (typeof value === "bigint") {
    return `bigint:${value.toString()}`;
  }

  if (typeof value === "symbol") {
    return `symbol:${JSON.stringify(value.description ?? "")}`;
  }

  if (typeof value === "function") {
    throw new TypeError("stableSerialize does not support functions");
  }

  if (value instanceof Date) {
    return `date:${Number.isNaN(value.getTime()) ? "Invalid" : value.toISOString()}`;
  }

  if (Array.isArray(value)) {
    return serializeArray(value, seen);
  }

  return serializeObject(value as Record<string, unknown>, seen);
}

function serializeNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "number:NaN";
  }

  if (Object.is(value, -0)) {
    return "number:-0";
  }

  if (value === Infinity) {
    return "number:Infinity";
  }

  if (value === -Infinity) {
    return "number:-Infinity";
  }

  return `number:${value}`;
}

function serializeArray(value: readonly unknown[], seen: WeakSet<object>): string {
  if (seen.has(value)) {
    throw new TypeError("stableSerialize does not support circular arrays");
  }

  seen.add(value);

  try {
    const items: string[] = [];

    for (let index = 0; index < value.length; index += 1) {
      items.push(
        Object.prototype.hasOwnProperty.call(value, index)
          ? serializeStableValue(value[index], seen)
          : "array-hole",
      );
    }

    return `array:${value.length}:[${items.join(",")}]`;
  } finally {
    seen.delete(value);
  }
}

function serializeObject(value: Record<string, unknown>, seen: WeakSet<object>): string {
  if (seen.has(value)) {
    throw new TypeError("stableSerialize does not support circular objects");
  }

  seen.add(value);

  try {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serializeStableValue(value[key], seen)}`);

    return `object:{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}
