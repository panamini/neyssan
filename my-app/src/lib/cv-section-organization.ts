import type { CvDocument, CvSection } from "../types/cvDocument";
import {
  getCanonicalSectionType,
  type ResumeCanonicalSectionType,
} from "../features/verbati/resumeLinking";

const HIDDEN_SECTION_STORAGE_KEY_PREFIX =
  "dasti:cv-organize-hidden-sections:v1:";

export const ADDITIONAL_INFORMATION_SECTION_TITLE = "Additional information";

export const CANONICAL_SECTION_ORDER: readonly ResumeCanonicalSectionType[] = [
  "profile",
  "summary",
  "experience",
  "achievements",
  "projects",
  "certifications",
  "skills",
  "education",
  "languages",
  "affiliations",
  "additional_information",
  "hobbies",
  "custom",
];

const REORDER_LOCKED_SECTION_TYPES = new Set<ResumeCanonicalSectionType>([
  "profile",
  "summary",
]);

const HIDE_LOCKED_SECTION_TYPES = new Set<ResumeCanonicalSectionType>([
  "profile",
]);

const REMOVABLE_SECTION_TYPES = new Set<ResumeCanonicalSectionType>([
  "achievements",
  "languages",
  "projects",
  "certifications",
  "affiliations",
  "hobbies",
  "additional_information",
  "custom",
]);

const SECTION_TYPE_LABELS: Record<ResumeCanonicalSectionType, string> = {
  profile: "Core profile",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  projects: "Projects",
  achievements: "Achievements",
  certifications: "Certifications",
  affiliations: "Affiliations",
  hobbies: "Hobbies",
  additional_information: ADDITIONAL_INFORMATION_SECTION_TITLE,
  custom: "Custom section",
};

export type SectionOrganizationControlPolicy = {
  showDragHandle: boolean;
  showMoveControls: boolean;
  showVisibilityToggle: boolean;
  showDeleteControl: boolean;
};

const DEFAULT_SECTION_CONTROL_POLICY: SectionOrganizationControlPolicy = {
  showDragHandle: true,
  showMoveControls: true,
  showVisibilityToggle: true,
  showDeleteControl: true,
};

const SECTION_CONTROL_POLICY_BY_TYPE: Partial<
  Record<ResumeCanonicalSectionType, SectionOrganizationControlPolicy>
> = {
  profile: {
    showDragHandle: false,
    showMoveControls: false,
    showVisibilityToggle: false,
    showDeleteControl: false,
  },
  summary: {
    showDragHandle: false,
    showMoveControls: false,
    showVisibilityToggle: true,
    showDeleteControl: true,
  },
};

function getHiddenSectionStorageKey(cvId: string) {
  return `${HIDDEN_SECTION_STORAGE_KEY_PREFIX}${cvId}`;
}

function getCanonicalType(section: CvSection): ResumeCanonicalSectionType {
  return getCanonicalSectionType(section) ?? "custom";
}

function formatAllCapsSectionTitle(title: string) {
  const hasAlphabeticCharacters = /[A-Za-z]/.test(title);
  const isAllCaps =
    hasAlphabeticCharacters &&
    title === title.toUpperCase() &&
    title !== title.toLowerCase();

  if (!isAllCaps) {
    return title;
  }

  const lowerCasedTitle = title.toLocaleLowerCase();
  return `${lowerCasedTitle.charAt(0).toLocaleUpperCase()}${lowerCasedTitle.slice(1)}`;
}

function getCanonicalOrderIndex(
  sectionOrType: CvSection | ResumeCanonicalSectionType,
): number {
  const canonicalType =
    typeof sectionOrType === "string"
      ? sectionOrType
      : getCanonicalType(sectionOrType);
  return CANONICAL_SECTION_ORDER.indexOf(canonicalType);
}

export function getSectionOrganizationTypeLabel(section: CvSection): string {
  return SECTION_TYPE_LABELS[getCanonicalType(section)];
}

export function formatSectionDisplayTitle(
  section: Pick<CvSection, "title" | "type"> | null | undefined,
  options?: { fallback?: string },
): string {
  const canonicalType = section
    ? getCanonicalSectionType(section as CvSection)
    : null;

  if (canonicalType === "additional_information") {
    return ADDITIONAL_INFORMATION_SECTION_TITLE;
  }

  const trimmedTitle = String(section?.title ?? "").trim();
  if (!trimmedTitle) {
    return options?.fallback ?? "";
  }

  return formatAllCapsSectionTitle(trimmedTitle);
}

export function isSectionReorderLocked(section: CvSection): boolean {
  return REORDER_LOCKED_SECTION_TYPES.has(getCanonicalType(section));
}

export function isSectionHideLocked(section: CvSection): boolean {
  return HIDE_LOCKED_SECTION_TYPES.has(getCanonicalType(section));
}

export function isSectionRemovableInOrganization(section: CvSection): boolean {
  return REMOVABLE_SECTION_TYPES.has(getCanonicalType(section));
}

export function getSectionOrganizationControlPolicy(
  section: CvSection,
): SectionOrganizationControlPolicy {
  const sectionType = getCanonicalType(section);
  return (
    SECTION_CONTROL_POLICY_BY_TYPE[sectionType] ??
    DEFAULT_SECTION_CONTROL_POLICY
  );
}

export function compareSectionsByRecommendedOrder(
  left: CvSection,
  right: CvSection,
): number {
  const leftRank = getCanonicalOrderIndex(left);
  const rightRank = getCanonicalOrderIndex(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const leftTitle = String(left.title ?? "").trim().toLowerCase();
  const rightTitle = String(right.title ?? "").trim().toLowerCase();
  return leftTitle.localeCompare(rightTitle);
}

export function insertSectionByCanonicalOrder(
  sections: CvSection[],
  newSection: CvSection,
): CvSection[] {
  const normalizedSections = normalizeCvSectionOrder(sections);
  const newSectionRank = getCanonicalOrderIndex(newSection);
  let sameRankIndex = -1;
  let precedingRankIndex = -1;
  let followingRankIndex = -1;

  normalizedSections.forEach((section, index) => {
    const sectionRank = getCanonicalOrderIndex(section);

    if (sectionRank === newSectionRank) {
      sameRankIndex = index;
      return;
    }

    if (sectionRank < newSectionRank) {
      precedingRankIndex = index;
      return;
    }

    if (followingRankIndex === -1) {
      followingRankIndex = index;
    }
  });

  const insertionIndex =
    sameRankIndex !== -1
      ? sameRankIndex + 1
      : precedingRankIndex !== -1
        ? precedingRankIndex + 1
        : followingRankIndex !== -1
          ? followingRankIndex
          : sections.length;

  return [
    ...normalizedSections.slice(0, insertionIndex),
    newSection,
    ...normalizedSections.slice(insertionIndex),
  ];
}

export function normalizeCvSectionOrder(sections: CvSection[]): CvSection[] {
  const lockedTopSections: CvSection[] = [];
  const remainingSections: CvSection[] = [];

  sections.forEach((section) => {
    const canonicalType = getCanonicalType(section);
    if (canonicalType === "profile" || canonicalType === "summary") {
      lockedTopSections.push(section);
      return;
    }
    remainingSections.push(section);
  });

  const orderedLockedSections = [...lockedTopSections].sort((left, right) => {
    const leftRank = getCanonicalOrderIndex(left);
    const rightRank = getCanonicalOrderIndex(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return sections.indexOf(left) - sections.indexOf(right);
  });
  const orderedSections = [...orderedLockedSections, ...remainingSections];

  const changed =
    orderedSections.some((section, index) => section !== sections[index]) ||
    orderedSections.some((section, index) => section.order !== index);

  if (!changed) return sections;

  return orderedSections.map((section, order) => ({
    ...section,
    order,
  }));
}

export function sanitizeHiddenSectionIds(
  sections: CvSection[],
  hiddenSectionIds: string[],
): string[] {
  const allowedIds = new Set(
    sections
      .filter((section) => !isSectionHideLocked(section))
      .map((section) => String(section.id ?? "")),
  );

  return Array.from(
    new Set(
      hiddenSectionIds.filter((sectionId) =>
        allowedIds.has(String(sectionId ?? "").trim()),
      ),
    ),
  );
}

export function applyHiddenSectionsToCvDocument(
  document: CvDocument | null | undefined,
  hiddenSectionIds: string[],
): CvDocument | null {
  if (!document) {
    return null;
  }

  const sanitizedHiddenIds = sanitizeHiddenSectionIds(
    document.sections ?? [],
    hiddenSectionIds,
  );
  if (sanitizedHiddenIds.length === 0) {
    return document;
  }

  const hiddenIds = new Set(sanitizedHiddenIds);
  return {
    ...document,
    sections: (document.sections ?? []).filter(
      (section) => !hiddenIds.has(String(section.id ?? "")),
    ),
  };
}

export function readStoredHiddenSectionIds(cvId: string | null | undefined) {
  if (!cvId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(getHiddenSectionStorageKey(cvId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeStoredHiddenSectionIds(
  cvId: string | null | undefined,
  hiddenSectionIds: string[],
) {
  if (!cvId || typeof window === "undefined") {
    return;
  }

  const storageKey = getHiddenSectionStorageKey(cvId);
  if (hiddenSectionIds.length === 0) {
    window.sessionStorage.removeItem(storageKey);
    return;
  }

  window.sessionStorage.setItem(storageKey, JSON.stringify(hiddenSectionIds));
}
