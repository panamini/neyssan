import type { CvDocument } from "../../types/cvDocument";
import { buildCandidateFactHash } from "./fingerprints";
import type {
  CandidateEvidenceVisibilityV1,
  CandidateFactReviewStateV1,
  CandidateFactV1,
  CandidateCvItemReferenceV1,
} from "./schema";
import { resolveCandidateCvItemReference } from "./cvItemReferences";

const CANDIDATE_FACT_REVIEW_STATES = new Set<CandidateFactReviewStateV1>([
  "pending",
  "approved",
  "rejected",
  "needs_review",
]);

const CANDIDATE_EVIDENCE_VISIBILITIES =
  new Set<CandidateEvidenceVisibilityV1>([
    "private",
    "use_in_applications",
    "never_use",
  ]);

export type BuildCandidateCvFactsInputV1 = Readonly<{
  userId: string;
  sourceDocumentId: string;
  document: Readonly<CvDocument>;
  references: readonly CandidateCvItemReferenceV1[];
  reviewState: CandidateFactReviewStateV1;
  visibility: CandidateEvidenceVisibilityV1;
  createdAt: number;
  updatedAt: number;
}>;

export async function buildCandidateCvFacts(
  input: BuildCandidateCvFactsInputV1,
): Promise<readonly CandidateFactV1[]> {
  assertCandidateCvFactsInput(input);

  const referenceIds = new Set<string>();
  const facts = await Promise.all(
    input.references.map(async (reference) => {
      if (referenceIds.has(reference.id)) {
        throw new TypeError(
          `duplicate candidate CV item reference: ${reference.id}`,
        );
      }
      referenceIds.add(reference.id);

      const resolved = resolveCandidateCvItemReference(
        input.document,
        reference,
      );
      const value = cloneSourceValue(resolved.item, "candidate CV item");
      const normalizedText = collectSourceText(value);
      const hashInput = {
        userId: input.userId,
        sourceDocumentId: input.sourceDocumentId,
        sourcePath: resolved.reference.sourcePath,
        factType: resolved.reference.sectionType,
        value,
        ...(normalizedText ? { normalizedText } : {}),
      };
      const hash = await buildCandidateFactHash(hashInput);

      return {
        id: `candidate-fact:${hash}`,
        ...hashInput,
        reviewState: input.reviewState,
        visibility: input.visibility,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        version: 1,
      } satisfies CandidateFactV1;
    }),
  );

  return facts.sort((left, right) => left.id.localeCompare(right.id));
}

function assertCandidateCvFactsInput(
  input: BuildCandidateCvFactsInputV1,
): void {
  if (!input || typeof input !== "object") {
    throw new TypeError("buildCandidateCvFacts requires an input object");
  }
  if (typeof input.userId !== "string" || !input.userId.trim()) {
    throw new TypeError("buildCandidateCvFacts requires userId");
  }
  if (
    typeof input.sourceDocumentId !== "string" ||
    !input.sourceDocumentId.trim()
  ) {
    throw new TypeError("buildCandidateCvFacts requires sourceDocumentId");
  }
  if (!Array.isArray(input.references)) {
    throw new TypeError("buildCandidateCvFacts requires references");
  }
  if (!CANDIDATE_FACT_REVIEW_STATES.has(input.reviewState)) {
    throw new TypeError("buildCandidateCvFacts requires a valid reviewState");
  }
  if (!CANDIDATE_EVIDENCE_VISIBILITIES.has(input.visibility)) {
    throw new TypeError("buildCandidateCvFacts requires a valid visibility");
  }
  if (!Number.isFinite(input.createdAt) || !Number.isFinite(input.updatedAt)) {
    throw new TypeError("buildCandidateCvFacts requires numeric timestamps");
  }
}

function cloneSourceValue(
  value: unknown,
  path: string,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must contain finite numbers`);
    }
    return value;
  }
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object") {
    throw new TypeError(`${path} must contain source JSON values`);
  }
  if (seen.has(value)) {
    throw new TypeError(`${path} must not contain circular values`);
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => {
        const cloned = cloneSourceValue(entry, `${path}[${index}]`, seen);
        if (cloned === undefined) {
          throw new TypeError(`${path}[${index}] must not be undefined`);
        }
        return cloned;
      });
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must contain plain source objects`);
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [
          key,
          cloneSourceValue(entry, `${path}.${key}`, seen),
        ]),
    );
  } finally {
    seen.delete(value);
  }
}

function collectSourceText(value: unknown): string | undefined {
  const fragments: string[] = [];
  collectSourceTextFragments(value, fragments);

  const seen = new Set<string>();
  const normalized = fragments.filter((fragment) => {
    const key = fragment.toLocaleLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return normalized.length > 0 ? normalized.join(" · ") : undefined;
}

function collectSourceTextFragments(
  value: unknown,
  fragments: string[],
): void {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/gu, " ").trim();
    if (normalized) {
      fragments.push(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSourceTextFragments(entry, fragments));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (key === "id") {
      continue;
    }
    collectSourceTextFragments(
      (value as Record<string, unknown>)[key],
      fragments,
    );
  }
}
