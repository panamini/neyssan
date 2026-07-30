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

function readStableId(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function stableLegacyValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableLegacyValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, entry]) => key !== "id" && entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableLegacyValue(entry)]),
    );
  }
  return typeof value === "bigint" ? value.toString() : typeof value;
}

function buildLegacyFingerprint(value: unknown): string {
  const serialized = JSON.stringify(stableLegacyValue(value));
  let left = 0xdeadbeef ^ serialized.length;
  let right = 0x41c6ce57 ^ serialized.length;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    left = Math.imul(left ^ code, 2654435761);
    right = Math.imul(right ^ code, 1597334677);
  }
  left =
    Math.imul(left ^ (left >>> 16), 2246822507) ^
    Math.imul(right ^ (right >>> 13), 3266489909);
  right =
    Math.imul(right ^ (right >>> 16), 2246822507) ^
    Math.imul(left ^ (left >>> 13), 3266489909);
  return [left, right]
    .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

function encodeSourcePathSegment(value: string): string {
  return Array.from(value)
    .map((character) =>
      /^[A-Za-z0-9-]$/u.test(character)
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
  return buildCandidateCvItemReferenceEntries(document, false).map(
    ({ reference }) => reference,
  );
}

export function buildReviewableCandidateCvItemReferences(
  document: Readonly<CvDocument>,
): CandidateCvItemReferenceV1[] {
  return buildCandidateCvItemReferenceEntries(document, true).map(
    ({ reference }) => reference,
  );
}

function buildCandidateCvItemReferenceEntries(
  document: Readonly<CvDocument>,
  allowLegacyIds: boolean,
): Array<{
  reference: CandidateCvItemReferenceV1;
  section: CvSection;
  item: CandidateCvStructuredItem;
}> {
  const cvId = requireStableId(document?.id, "source CV");
  const entries: Array<{
    reference: CandidateCvItemReferenceV1;
    section: CvSection;
    item: CandidateCvStructuredItem;
  }> = [];
  const referenceIds = new Set<string>();
  const referenceableSections = (document.sections ?? []).filter(
    (section) =>
      REFERENCEABLE_SECTION_TYPES.has(section.type) &&
      Array.isArray(section.structuredContent),
  );
  const legacySectionBases = referenceableSections.map((section) => {
    const sectionType = REFERENCEABLE_SECTION_TYPES.get(section.type)!;
    const itemFingerprints = (section.structuredContent ?? [])
      .map((item) => buildLegacyFingerprint(item))
      .sort();
    return `legacy-section-${sectionType}-${buildLegacyFingerprint({
      type: section.type,
      title: section.title,
      items: itemFingerprints,
    })}`;
  });
  const legacySectionTotals = new Map<string, number>();
  for (const base of legacySectionBases) {
    legacySectionTotals.set(base, (legacySectionTotals.get(base) ?? 0) + 1);
  }
  const legacySectionOccurrences = new Map<string, number>();

  for (const [sectionIndex, section] of referenceableSections.entries()) {
    const sectionType = REFERENCEABLE_SECTION_TYPES.get(section.type);
    if (!sectionType || !Array.isArray(section.structuredContent)) {
      continue;
    }

    const legacySectionBase = legacySectionBases[sectionIndex];
    const legacySectionOccurrence =
      (legacySectionOccurrences.get(legacySectionBase) ?? 0) + 1;
    legacySectionOccurrences.set(
      legacySectionBase,
      legacySectionOccurrence,
    );
    const sectionId =
      readStableId(section.id) ??
      (allowLegacyIds
        ? legacySectionTotals.get(legacySectionBase) === 1
          ? legacySectionBase
          : `${legacySectionBase}-${legacySectionOccurrence}`
        : requireStableId(section.id, `${sectionType} section`));
    const legacyItemBases = section.structuredContent.map(
      (item) =>
        `legacy-item-${sectionType}-${buildLegacyFingerprint(item)}`,
    );
    const legacyItemTotals = new Map<string, number>();
    for (const base of legacyItemBases) {
      legacyItemTotals.set(base, (legacyItemTotals.get(base) ?? 0) + 1);
    }
    const legacyItemOccurrences = new Map<string, number>();

    for (const [itemIndex, item] of section.structuredContent.entries()) {
      if (!item || typeof item !== "object") {
        throw new TypeError(
          `${sectionType} item requires a stable item id; normalize and persist the source CV first`,
        );
      }

      const legacyItemBase = legacyItemBases[itemIndex];
      const legacyItemOccurrence =
        (legacyItemOccurrences.get(legacyItemBase) ?? 0) + 1;
      legacyItemOccurrences.set(legacyItemBase, legacyItemOccurrence);
      const itemId =
        readStableId((item as { id?: unknown }).id) ??
        (allowLegacyIds
          ? legacyItemTotals.get(legacyItemBase) === 1
            ? legacyItemBase
            : `${legacyItemBase}-${legacyItemOccurrence}`
          : requireStableId(
              (item as { id?: unknown }).id,
              `${sectionType} item`,
            ));
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
      entries.push({
        reference,
        section,
        item: item as CandidateCvStructuredItem,
      });
    }
  }

  return entries;
}

export function resolveCandidateCvItemReference(
  document: Readonly<CvDocument>,
  reference: CandidateCvItemReferenceV1,
): ResolvedCandidateCvItemReferenceV1 {
  return resolveCandidateCvItemReferenceInternal(
    document,
    reference,
    false,
  );
}

export function resolveReviewableCandidateCvItemReference(
  document: Readonly<CvDocument>,
  reference: CandidateCvItemReferenceV1,
): ResolvedCandidateCvItemReferenceV1 {
  return resolveCandidateCvItemReferenceInternal(
    document,
    reference,
    true,
  );
}

function resolveCandidateCvItemReferenceInternal(
  document: Readonly<CvDocument>,
  reference: CandidateCvItemReferenceV1,
  allowLegacyIds: boolean,
): ResolvedCandidateCvItemReferenceV1 {
  const cvId = requireStableId(document?.id, "source CV");
  if (!reference || reference.cvId !== cvId || reference.version !== 1) {
    throw new TypeError("candidate CV item reference does not match the source CV");
  }

  const resolved = buildCandidateCvItemReferenceEntries(
    document,
    allowLegacyIds,
  ).find(
    (entry) =>
      entry.reference.id === reference.id &&
      entry.reference.sourcePath === reference.sourcePath,
  );
  if (
    !resolved ||
    resolved.reference.sectionType !== reference.sectionType ||
    resolved.reference.sectionId !== reference.sectionId ||
    resolved.reference.itemId !== reference.itemId
  ) {
    throw new TypeError("candidate CV item reference does not match the source CV");
  }

  return {
    reference: resolved.reference,
    section: resolved.section,
    item: resolved.item,
  };
}
