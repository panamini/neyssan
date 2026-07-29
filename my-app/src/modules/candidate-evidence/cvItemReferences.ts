import type { CvDocument, CvSection } from "../../types/cvDocument";
import type {
  CandidateCvItemKindV1,
  CandidateCvItemReferenceV1,
} from "./schema";
import { assertValidSourcePath } from "./sourcePaths";

const REFERENCEABLE_SECTION_TYPES = new Map<
  CvSection["type"],
  CandidateCvItemKindV1
>([
  ["experience", "experience"],
  ["education", "education"],
  ["skills", "skill"],
]);

type CandidateCvStructuredItem = NonNullable<
  CvSection["structuredContent"]
>[number];

export type ResolvedCandidateCvItemReferenceV1 = Readonly<{
  reference: CandidateCvItemReferenceV1;
  section: CvSection;
  item: CandidateCvStructuredItem;
}>;

function requireStableId(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new TypeError(
      `${label} requires a stable item id; normalize and persist the source CV first`,
    );
  }
  return normalized;
}

function encodeSourcePathSegment(value: string): string {
  return Array.from(value)
    .map((character) =>
      /^[A-Za-z0-9_-]$/u.test(character)
        ? character
        : `_${character.codePointAt(0)?.toString(16) ?? "0"}_`,
    )
    .join("");
}

function buildReferenceId(args: {
  cvId: string;
  sectionType: CandidateCvItemKindV1;
  sectionId: string;
  itemId: string;
}): string {
  return [
    "candidate-cv-item",
    "v1",
    encodeURIComponent(args.cvId),
    args.sectionType,
    encodeURIComponent(args.sectionId),
    encodeURIComponent(args.itemId),
  ].join(":");
}

function buildCandidateCvItemReference(args: {
  cvId: string;
  sectionId: string;
  sectionType: CandidateCvItemKindV1;
  itemId: string;
}): CandidateCvItemReferenceV1 {
  const sourcePath = assertValidSourcePath(
    [
      "document",
      "sectionsById",
      encodeSourcePathSegment(args.sectionId),
      "structuredContentById",
      encodeSourcePathSegment(args.itemId),
    ].join("."),
  );

  return {
    id: buildReferenceId(args),
    cvId: args.cvId,
    sectionId: args.sectionId,
    sectionType: args.sectionType,
    itemId: args.itemId,
    sourcePath,
    version: 1,
  };
}

export function buildCandidateCvItemReferences(
  document: Readonly<CvDocument>,
): CandidateCvItemReferenceV1[] {
  const cvId = requireStableId(document?.id, "source CV");
  const references: CandidateCvItemReferenceV1[] = [];
  const referenceIds = new Set<string>();

  for (const section of document.sections ?? []) {
    const sectionType = REFERENCEABLE_SECTION_TYPES.get(section.type);
    if (!sectionType || !Array.isArray(section.structuredContent)) {
      continue;
    }

    const sectionId = requireStableId(
      section.id,
      `${sectionType} section`,
    );

    for (const item of section.structuredContent) {
      if (!item || typeof item !== "object") {
        throw new TypeError(
          `${sectionType} item requires a stable item id; normalize and persist the source CV first`,
        );
      }

      const itemId = requireStableId(
        (item as { id?: unknown }).id,
        `${sectionType} item`,
      );
      const reference = buildCandidateCvItemReference({
        cvId,
        sectionType,
        sectionId,
        itemId,
      });

      if (referenceIds.has(reference.id)) {
        throw new TypeError(
          `duplicate stable CV item reference for ${sectionType} item ${itemId}`,
        );
      }
      referenceIds.add(reference.id);
      references.push(reference);
    }
  }

  return references;
}

export function resolveCandidateCvItemReference(
  document: Readonly<CvDocument>,
  reference: CandidateCvItemReferenceV1,
): ResolvedCandidateCvItemReferenceV1 {
  const cvId = requireStableId(document?.id, "source CV");
  if (!reference || reference.cvId !== cvId || reference.version !== 1) {
    throw new TypeError("candidate CV item reference does not match the source CV");
  }

  const section = (document.sections ?? []).find(
    (candidate) => candidate.id === reference.sectionId,
  );
  const sectionType = section
    ? REFERENCEABLE_SECTION_TYPES.get(section.type)
    : undefined;
  if (!section || !sectionType || sectionType !== reference.sectionType) {
    throw new TypeError("candidate CV item reference does not match the source CV");
  }

  const item = Array.isArray(section.structuredContent)
    ? section.structuredContent.find(
        (candidate) =>
          candidate &&
          typeof candidate === "object" &&
          (candidate as { id?: unknown }).id === reference.itemId,
      )
    : undefined;
  if (!item) {
    throw new TypeError("candidate CV item reference is stale for the source CV");
  }

  const expected = buildCandidateCvItemReference({
    cvId,
    sectionId: requireStableId(section.id, `${sectionType} section`),
    sectionType,
    itemId: requireStableId(
      (item as { id?: unknown }).id,
      `${sectionType} item`,
    ),
  });
  if (
    expected.id !== reference.id ||
    expected.sourcePath !== reference.sourcePath
  ) {
    throw new TypeError("candidate CV item reference does not match the source CV");
  }

  return {
    reference: expected,
    section,
    item,
  };
}
