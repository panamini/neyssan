const APPLICATION_HARNESS_HASH_NAMESPACE = "application-harness";
const textEncoder = new TextEncoder();

type BuildCandidateHashInput =
  | Readonly<{
      sourceKind: "cv";
      cvId: string;
      structuredSectionsHash?: string;
      cvSnapshotHash: string;
    }>
  | Readonly<{
      sourceKind: "candidate_evidence_profile";
      candidateEvidenceProfileId: string;
      structuredSectionsHash?: string;
      cvSnapshotHash?: string;
    }>;

export function stableSerialize(value: unknown): string {
  return serializeStableValue(value, new WeakSet<object>());
}

export async function buildStableHash(value: unknown): Promise<string> {
  const serialized = stableSerialize(value);
  const bytes = textEncoder.encode(serialized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildRawJobTextHash(rawDescription: string): Promise<string> {
  if (typeof rawDescription !== "string") {
    throw new TypeError("buildRawJobTextHash requires rawDescription to be a string");
  }

  return buildStableHash({
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "raw-job-text",
    version: 1,
    rawDescription,
  });
}

export function buildJobHash(input: Readonly<{
  jobId: string;
  rawDescription: string;
  sourceUrl?: string;
  title?: string;
  company?: string;
}>): Promise<string> {
  return buildStableHash({
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "job",
    version: 1,
    input,
  });
}

export function buildCandidateHash(input: BuildCandidateHashInput): Promise<string> {
  assertCandidateHashInput(input);

  return buildStableHash({
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "candidate",
    version: 1,
    input,
  });
}

export function buildSettingsHash(settings: unknown): Promise<string> {
  return buildStableHash({
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "settings",
    version: 1,
    settings,
  });
}

export function buildContextHash(input: Readonly<{
  jobHash: string;
  jobBriefHash?: string;
  candidateHash: string;
  settingsHash: string;
}>): Promise<string> {
  return buildStableHash({
    namespace: APPLICATION_HARNESS_HASH_NAMESPACE,
    type: "context",
    version: 1,
    input,
  });
}

function assertCandidateHashInput(input: BuildCandidateHashInput): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildCandidateHash requires a candidate identity input");
  }

  if (input.sourceKind === "cv") {
    if (!input.cvId) {
      throw new TypeError('buildCandidateHash requires cvId when sourceKind is "cv"');
    }
    if (!input.cvSnapshotHash) {
      throw new TypeError('buildCandidateHash requires cvSnapshotHash when sourceKind is "cv"');
    }
    return;
  }

  if (!input.candidateEvidenceProfileId) {
    throw new TypeError(
      'buildCandidateHash requires candidateEvidenceProfileId when sourceKind is "candidate_evidence_profile"',
    );
  }
}

function serializeStableValue(value: unknown, seen: WeakSet<object>): string {
  if (value === undefined) {
    throw new TypeError("stableSerialize does not support undefined values outside object fields");
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
    throw new TypeError("stableSerialize does not support bigint values");
  }

  if (typeof value === "symbol") {
    throw new TypeError("stableSerialize does not support symbols");
  }

  if (typeof value === "function") {
    throw new TypeError("stableSerialize does not support functions");
  }

  if (value instanceof Date) {
    return serializeDate(value);
  }

  if (Array.isArray(value)) {
    return serializeArray(value, seen);
  }

  if (typeof value !== "object") {
    throw new TypeError(`stableSerialize does not support ${typeof value} values`);
  }

  return serializeObject(value, seen);
}

function serializeNumber(value: number): string {
  if (Number.isNaN(value)) {
    throw new TypeError("stableSerialize does not support NaN");
  }

  if (!Number.isFinite(value)) {
    throw new TypeError("stableSerialize does not support infinite numbers");
  }

  if (Object.is(value, -0)) {
    return "number:-0";
  }

  return `number:${value}`;
}

function serializeDate(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError("stableSerialize does not support invalid Date values");
  }

  return `date:${JSON.stringify(value.toISOString())}`;
}

function serializeArray(value: readonly unknown[], seen: WeakSet<object>): string {
  if (seen.has(value)) {
    throw new TypeError("stableSerialize does not support circular arrays");
  }

  seen.add(value);

  try {
    const items: string[] = [];

    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new TypeError("stableSerialize does not support sparse arrays");
      }

      items.push(serializeStableValue(value[index], seen));
    }

    return `array:${value.length}:[${items.join(",")}]`;
  } finally {
    seen.delete(value);
  }
}

function serializeObject(value: object, seen: WeakSet<object>): string {
  if (value instanceof Map) {
    throw new TypeError("stableSerialize does not support Map");
  }

  if (value instanceof Set) {
    throw new TypeError("stableSerialize does not support Set");
  }

  if (value instanceof RegExp) {
    throw new TypeError("stableSerialize does not support RegExp");
  }

  if (isPromiseLike(value)) {
    throw new TypeError("stableSerialize does not support Promise");
  }

  if (!isPlainObject(value)) {
    throw new TypeError("stableSerialize only supports plain objects");
  }

  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("stableSerialize does not support symbol object keys");
  }

  if (seen.has(value)) {
    throw new TypeError("stableSerialize does not support circular objects");
  }

  seen.add(value);

  try {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${serializeStableValue(record[key], seen)}`);

    return `object:{${entries.join(",")}}`;
  } finally {
    seen.delete(value);
  }
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPromiseLike(value: object): boolean {
  return typeof (value as { then?: unknown }).then === "function";
}
