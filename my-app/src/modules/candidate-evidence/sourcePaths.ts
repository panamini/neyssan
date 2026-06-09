import type { CandidateFactV1 } from "./schema";

const MAX_SOURCE_PATH_LENGTH = 240;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const SAFE_SOURCE_PATH_PATTERN = /^[A-Za-z0-9_.[\]-]+$/u;

const FORBIDDEN_SINGLE_TOKENS = new Set([
  "artifact",
  "artifacts",
  "proposal",
  "proposals",
  "generated",
  "polished",
  "marketing",
]);

const FORBIDDEN_TOKEN_PAIRS = new Set([
  "application:artifact",
  "application:artifacts",
  "cover:letter",
  "cover:letters",
  "generated:resume",
  "generated:resumes",
  "generated:artifact",
  "generated:artifacts",
  "generated:proposal",
  "generated:proposals",
  "marketing:copy",
  "polished:text",
  "final:copy",
]);

const FORBIDDEN_FACT_VALUE_KEYS = new Set([
  "artifactId",
  "applicationArtifactId",
  "coverLetterId",
  "finalCopy",
  "generatedArtifactId",
  "generatedResumeId",
  "generatedText",
  "marketingCopy",
  "polishedText",
  "proposalId",
  "resumeVariantArtifactId",
]);

export function normalizeSourcePath(sourcePath: string): string {
  if (typeof sourcePath !== "string") {
    throw new TypeError("sourcePath must be a string");
  }

  return sourcePath.trim().replace(/\[\s*(\d+)\s*\]/gu, (_match, index: string) => {
    return `[${Number(index)}]`;
  });
}

export function validateSourcePath(sourcePath: string): boolean {
  try {
    assertValidSourcePath(sourcePath);
    return true;
  } catch {
    return false;
  }
}

export function assertFactUsesSourceMaterial(
  fact: Readonly<Pick<CandidateFactV1, "sourcePath" | "value">>,
): void {
  assertValidSourcePath(fact.sourcePath);
  assertValueDoesNotLookLikeGeneratedArtifact(fact.value, "value", new WeakSet<object>());
}

export function assertValidSourcePath(sourcePath: string): string {
  const normalized = normalizeSourcePath(sourcePath);

  if (!normalized) {
    throw new TypeError("sourcePath must not be empty");
  }

  if (normalized.length > MAX_SOURCE_PATH_LENGTH) {
    throw new TypeError("sourcePath is too long");
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new TypeError("sourcePath must not contain control characters");
  }

  if (!SAFE_SOURCE_PATH_PATTERN.test(normalized)) {
    throw new TypeError("sourcePath contains unsafe characters");
  }

  if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.includes("..")) {
    throw new TypeError("sourcePath must use simple dot/bracket segments");
  }

  if (sourcePathLooksLikeGeneratedArtifact(normalized)) {
    throw new TypeError("sourcePath must point to source material, not generated artifacts");
  }

  return normalized;
}

function sourcePathLooksLikeGeneratedArtifact(sourcePath: string): boolean {
  const comparable = sourcePath.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
  const tokens = comparable.split(/[^a-z0-9]+/u).filter(Boolean);

  for (const token of tokens) {
    if (FORBIDDEN_SINGLE_TOKENS.has(token)) {
      return true;
    }
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (FORBIDDEN_TOKEN_PAIRS.has(`${tokens[index]}:${tokens[index + 1]}`)) {
      return true;
    }
  }

  return false;
}

function assertValueDoesNotLookLikeGeneratedArtifact(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertValueDoesNotLookLikeGeneratedArtifact(value[index], `${path}[${index}]`, seen);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_FACT_VALUE_KEYS.has(key)) {
      throw new TypeError(
        `candidate fact value must preserve source truth; generated artifact field ${path}.${key} is not allowed`,
      );
    }
    assertValueDoesNotLookLikeGeneratedArtifact(record[key], `${path}.${key}`, seen);
  }
}
