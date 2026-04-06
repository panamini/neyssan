import { safeParseCvDocument } from "../schemas/cvDocument.schema";
import type { CvDocument, CvSection } from "../types/cvDocument";
import {
  LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
  LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY,
  LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
  LOCAL_CV_LIBRARY_STORAGE_KEY,
} from "./cv-local-storage";

const LOCAL_DOC_PREFIXES = [
  LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
  LEGACY_LOCAL_CV_DOC_STORAGE_KEY_PREFIX,
];
const LOCAL_LIBRARY_KEYS = [
  LOCAL_CV_LIBRARY_STORAGE_KEY,
  LEGACY_LOCAL_CV_LIBRARY_STORAGE_KEY,
];
const parsedDocumentCache = new Map<string, CvDocument | null>();
const libraryDocumentsCache = new Map<string, CvDocument[]>();
const activeCvSnapshotCache = new Map<string, ActiveCvSnapshot>();
const ACTIVE_CV_STORAGE_KEY = "cvActiveId";
export const PROPOSAL_ATTACHED_CV_STORAGE_KEY =
  "dasti:proposal-attached-cv-id:v1";
export const PROPOSAL_ATTACHED_CV_UPDATED_EVENT =
  "dasti:proposal-attached-cv-updated";
const PROPOSAL_ATTACHED_CV_MIGRATION_KEY =
  "dasti:proposal-attached-cv-migrated:v1";
const MAX_SUMMARY_LENGTH = 240;
const MAX_SKILLS = 8;
const MAX_RECENT_EXPERIENCE = 3;
const MAX_HIGHLIGHTS_PER_EXPERIENCE = 2;
const MAX_HIGHLIGHT_LENGTH = 110;
const MAX_ACHIEVEMENTS = 4;
const MAX_ACHIEVEMENT_LENGTH = 140;
const SENTENCE_BOUNDARY_ABBREVIATIONS = [
  "Pvt.",
  "Ltd.",
  "St.",
  "Inc.",
  "Co.",
  "Corp.",
] as const;
const NUMERIC_RESIDUE_PATTERNS = [
  /^\d+\s+(?:month|months|year|years)\s+work experience\b/i,
  /^\d+\s+(?:month|months|year|years)\b/i,
] as const;
const MALFORMED_SNIPPET_PATTERNS = [
  /\b(?:which|that|who|while|because|although|though|and|but|or)\.$/i,
  /(?:[—-]|,\s*)(?:qualities?|skills?|strengths?|traits?|capabilities?)\.$/i,
  /\b(?:a|an|the)\s+(?:skill|strength|quality|trait|ability|capability)\.$/i,
] as const;

export interface ProposalPersonalizationContext {
  name?: string;
  summary?: string;
  desiredPosition?: string;
  topSkills?: string[];
  recentExperience?: Array<{
    company?: string;
    position?: string;
    highlights?: string[];
  }>;
  standoutAchievements?: string[];
}

export type ProposalPersonalizationRichness =
  | "none"
  | "minimal"
  | "sparse"
  | "rich";

export interface ActiveCvSnapshot {
  title: string;
  personalizationContext: ProposalPersonalizationContext | null;
  updatedAt?: string;
}

export interface LocalCvPickerOption {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  profileName?: string;
  desiredPosition?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  summarySnippet?: string;
  isActive: boolean;
}

export interface ProposalGenerationPersonalizationPayload {
  personalizationMode: "explicit_only";
  personalizationContext?: ProposalPersonalizationContext;
  personalizationRichness?: ProposalPersonalizationRichness;
}

export type ProposalApplicantHeaderData = {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  website: string | null;
  location: string | null;
  tag: string | null;
};

type CvDisplayIdentity = {
  title?: string | null;
  profileName?: string | null;
  desiredPosition?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  location?: string | null;
};

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" ? (value as LooseRecord) : null;
}

function readStringField(
  record: LooseRecord | null,
  key: string,
): string | undefined {
  if (!record) return undefined;
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readArrayField(record: LooseRecord | null, key: string): unknown[] {
  if (!record) return [];
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function hasLocalStorage(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  } catch {
    return false;
  }
}

function markProposalAttachedCvMigrationComplete(): void {
  if (!hasLocalStorage()) return;

  try {
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_MIGRATION_KEY, "1");
  } catch {
    /* best-effort */
  }
}

function dispatchProposalAttachedCvUpdated(): void {
  if (!hasLocalStorage()) return;

  try {
    window.dispatchEvent(new Event(PROPOSAL_ATTACHED_CV_UPDATED_EVENT));
  } catch {
    /* best-effort */
  }
}

function readStoredProposalAttachedCvId(): string {
  if (!hasLocalStorage()) {
    return "";
  }

  const storedAttachedCvId = compactWhitespace(
    window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY) ?? "",
  );
  if (storedAttachedCvId) {
    return storedAttachedCvId;
  }

  const hasMigrated =
    window.localStorage.getItem(PROPOSAL_ATTACHED_CV_MIGRATION_KEY) === "1";
  if (hasMigrated) {
    return "";
  }

  const legacyActiveCvId = compactWhitespace(
    window.localStorage.getItem(ACTIVE_CV_STORAGE_KEY) ?? "",
  );
  markProposalAttachedCvMigrationComplete();
  if (!legacyActiveCvId) {
    return "";
  }

  try {
    window.localStorage.setItem(
      PROPOSAL_ATTACHED_CV_STORAGE_KEY,
      legacyActiveCvId,
    );
  } catch {
    /* best-effort */
  }

  return legacyActiveCvId;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = compactWhitespace(value);
  if (!compact) return undefined;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function compactDisplayPart(value: unknown, maxLength = 80): string | undefined {
  const compact = clampText(value, maxLength);
  if (!compact) return undefined;
  if (compact.length > 56 && /[.!?]/.test(compact)) return undefined;
  return compact;
}

function isPlaceholderDisplayTitle(value: string | undefined): boolean {
  if (!value) return false;
  return /^(?:untitled cv|imported cv|draft resume|resume)$/i.test(value.trim());
}

export function formatCvDisplayTitle(identity: CvDisplayIdentity): string {
  const desiredPosition = compactDisplayPart(identity.desiredPosition, 72);
  const profileName = compactDisplayPart(identity.profileName, 72);
  const fallbackTitle = compactDisplayPart(identity.title, 120);

  if (desiredPosition && profileName) return `${desiredPosition} — ${profileName}`;
  if (desiredPosition) return desiredPosition;
  if (profileName) return profileName;
  if (fallbackTitle && !isPlaceholderDisplayTitle(fallbackTitle)) return fallbackTitle;
  return "Resume";
}

export function formatCvDisplaySubtitle(identity: CvDisplayIdentity): string | undefined {
  const displayTitle = formatCvDisplayTitle(identity).toLowerCase();
  const email = compactDisplayPart(identity.email, 96);
  const linkedin = compactDisplayPart(identity.linkedin, 96);
  const website = compactDisplayPart(identity.website, 96);
  const phone = compactDisplayPart(identity.phone, 48);
  const location = compactDisplayPart(identity.location, 80);

  const candidates = [email, linkedin, website, phone, location];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toLowerCase();
    if (displayTitle.includes(normalized)) continue;
    return candidate;
  }
  return undefined;
}

function dedupe(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function extractText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(extractText).join(" ");
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.summary === "string") return obj.summary;
    if (Array.isArray(obj.content))
      return obj.content.map(extractText).join(" ");
  }
  return "";
}

function splitIntoSnippets(value: string): string[] {
  const protectSentenceBoundaryAbbreviations = (input: string): string => {
    let protectedValue = input;
    for (const abbreviation of SENTENCE_BOUNDARY_ABBREVIATIONS) {
      const escaped = abbreviation.replace(".", "\\.");
      protectedValue = protectedValue.replace(
        new RegExp(`\\b${escaped}(?=\\s|$)`, "g"),
        abbreviation.replace(".", "__DOT__"),
      );
    }
    return protectedValue;
  };
  const restoreSentenceBoundaryAbbreviations = (input: string): string =>
    input.replace(/__DOT__/g, ".");
  const snippetLooksMalformed = (snippet: string): boolean => {
    const normalized = compactWhitespace(snippet);
    if (!normalized) return true;
    if (NUMERIC_RESIDUE_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return true;
    }
    if (MALFORMED_SNIPPET_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return true;
    }
    if (
      /^(?:the|this|these|those)\b/i.test(normalized) &&
      /\bi\s+(?:installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i.test(
        normalized,
      )
    ) {
      const match = normalized.match(
        /\bi\s+(installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i,
      );
      if (match?.index !== undefined) {
        const trailing = compactWhitespace(
          normalized.slice(match.index + match[0].length),
        );
        if (
          trailing &&
          !/\b(?:were|was|are|is|reduced|improved|increased|decreased|provided|gave|enabled|helped|supported|kept|led|resulted|cut|boosted|made)\b/i.test(
            trailing,
          )
        ) {
          return true;
        }
      }
    }
    return false;
  };
  const normalized = protectSentenceBoundaryAbbreviations(
    value.replace(/\r/g, "\n").replace(/[•·●◦]/g, "\n"),
  )
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((part) =>
      compactWhitespace(restoreSentenceBoundaryAbbreviations(part)),
    )
    .filter((part) => Boolean(part) && !snippetLooksMalformed(part));
  return dedupe(
    normalized.map((part) => clampText(part, MAX_HIGHLIGHT_LENGTH)),
  );
}

function getStructuredItems(section: CvSection | undefined): unknown[] {
  if (!section || !Array.isArray(section.structuredContent)) return [];
  return section.structuredContent as unknown[];
}

function getSectionByType(
  doc: CvDocument,
  type: CvSection["type"],
): CvSection | undefined {
  return Array.isArray(doc.sections)
    ? doc.sections.find((section) => section.type === type)
    : undefined;
}

function getTimestamp(doc: CvDocument): number {
  const updatedAt = Date.parse(String(doc.metadata?.updatedAt ?? ""));
  if (Number.isFinite(updatedAt)) return updatedAt;
  const createdAt = Date.parse(String(doc.metadata?.createdAt ?? ""));
  if (Number.isFinite(createdAt)) return createdAt;
  return 0;
}

function parseStoredDocument(raw: string): CvDocument | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const safe = safeParseCvDocument(parsed);
    if (safe.ok) return safe.value;
    const loose = asRecord(parsed);
    if (loose && typeof loose.id === "string") {
      return {
        id: String(loose.id),
        title: typeof loose.title === "string" ? loose.title : "Untitled CV",
        metadata: asRecord(loose.metadata) ?? {
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          version: 1,
        },
        sections: Array.isArray(loose.sections)
          ? (loose.sections as CvDocument["sections"])
          : [],
        tags: Array.isArray(loose.tags) ? (loose.tags as string[]) : undefined,
        summary: loose.summary,
      } as CvDocument;
    }
  } catch {
    // ignore malformed local entries
  }
  return null;
}

function getStoredDocumentById(id: string): CvDocument | null {
  if (!hasLocalStorage()) return null;

  let bestMatch: CvDocument | null = null;
  for (const prefix of LOCAL_DOC_PREFIXES) {
    const raw = window.localStorage.getItem(`${prefix}${id}`);
    if (!raw) continue;
    let doc = parsedDocumentCache.get(raw);
    if (doc === undefined) {
      doc = parseStoredDocument(raw);
      parsedDocumentCache.set(raw, doc);
    }
    if (!doc) continue;
    if (!bestMatch || getTimestamp(doc) >= getTimestamp(bestMatch)) {
      bestMatch = doc;
    }
  }

  return bestMatch;
}

function getLibraryDocuments(): CvDocument[] {
  if (!hasLocalStorage()) return [];

  for (const key of LOCAL_LIBRARY_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const cached = libraryDocumentsCache.get(raw);
    if (cached) {
      return cached;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      const docs = parsed
        .map((entry) => parseStoredDocument(JSON.stringify(entry)))
        .filter((doc): doc is CvDocument => Boolean(doc));
      libraryDocumentsCache.set(raw, docs);
      return docs;
    } catch {
      // ignore malformed library entries and try the next key
    }
  }

  return [];
}

function readSummary(doc: CvDocument): string | undefined {
  const topLevel = clampText(extractText(doc.summary), MAX_SUMMARY_LENGTH);
  if (topLevel) return topLevel;

  const summarySection = getSectionByType(doc, "summary");
  const summaryItem = asRecord(getStructuredItems(summarySection)[0]);
  const structured = clampText(
    extractText(summaryItem?.summary),
    MAX_SUMMARY_LENGTH,
  );
  if (structured) return structured;

  const block = summarySection?.blocks?.[0];
  return clampText(
    extractText(block?.plainText ?? block?.content),
    MAX_SUMMARY_LENGTH,
  );
}

function readTopSkills(doc: CvDocument): string[] | undefined {
  const skillsSection = getSectionByType(doc, "skills");
  const skillItems = getStructuredItems(skillsSection);
  const fromStructured = skillItems.map((item) => {
    const record = asRecord(item);
    return clampText(
      readStringField(record, "name") ?? (typeof item === "string" ? item : ""),
      40,
    );
  });
  const fromTags = Array.isArray(doc.tags)
    ? doc.tags.map((tag) => clampText(tag, 40))
    : [];
  const topSkills = dedupe([...fromStructured, ...fromTags]).slice(
    0,
    MAX_SKILLS,
  );
  return topSkills.length > 0 ? topSkills : undefined;
}

function readProfileIdentity(doc: CvDocument): {
  name?: string;
  desiredPosition?: string;
} {
  const profileSection = getSectionByType(doc, "profile");
  const profileItem = asRecord(getStructuredItems(profileSection)[0]);
  const name = clampText(readStringField(profileItem, "name"), 80);
  const desiredPosition = clampText(
    readStringField(profileItem, "desiredPosition") ??
      readStringField(profileItem, "title"),
    80,
  );
  return { name, desiredPosition };
}

function readProfileContact(doc: CvDocument): {
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  location?: string;
} {
  const profileSection = getSectionByType(doc, "profile");
  const profileItem = asRecord(getStructuredItems(profileSection)[0]);
  return {
    ...(clampText(readStringField(profileItem, "email"), 120)
      ? { email: clampText(readStringField(profileItem, "email"), 120) }
      : {}),
    ...(clampText(readStringField(profileItem, "phone"), 48)
      ? { phone: clampText(readStringField(profileItem, "phone"), 48) }
      : {}),
    ...(clampText(readStringField(profileItem, "linkedin"), 120)
      ? { linkedin: clampText(readStringField(profileItem, "linkedin"), 120) }
      : {}),
    ...(clampText(readStringField(profileItem, "website"), 120)
      ? { website: clampText(readStringField(profileItem, "website"), 120) }
      : {}),
    ...(clampText(readStringField(profileItem, "location"), 120)
      ? { location: clampText(readStringField(profileItem, "location"), 120) }
      : {}),
  };
}

function readRecentExperience(
  doc: CvDocument,
): ProposalPersonalizationContext["recentExperience"] {
  const experienceSection = getSectionByType(doc, "experience");
  const experienceItems = getStructuredItems(experienceSection);
  const recentExperience = experienceItems
    .slice(0, MAX_RECENT_EXPERIENCE)
    .map((item) => {
      const record = asRecord(item);
      const position = clampText(
        readStringField(record, "position") ?? readStringField(record, "title"),
        80,
      );
      const company = clampText(readStringField(record, "company"), 80);

      const highlightCandidates: string[] = [];
      const achievements = readArrayField(record, "achievements");
      if (achievements.length > 0) {
        highlightCandidates.push(
          ...achievements
            .map((value) => (typeof value === "string" ? value : undefined))
            .filter((value): value is string => Boolean(value)),
        );
      }
      const responsibilityBullets = readArrayField(
        record,
        "responsibilityBullets",
      );
      if (responsibilityBullets.length > 0) {
        highlightCandidates.push(
          ...responsibilityBullets
            .map((value) => (typeof value === "string" ? value : undefined))
            .filter((value): value is string => Boolean(value)),
        );
      }
      const responsibilitiesText = extractText(record?.responsibilities);
      const descriptionText = extractText(record?.description);
      if (responsibilitiesText)
        highlightCandidates.push(...splitIntoSnippets(responsibilitiesText));
      if (descriptionText)
        highlightCandidates.push(...splitIntoSnippets(descriptionText));

      const highlights = dedupe(
        highlightCandidates.map((candidate) =>
          clampText(candidate, MAX_HIGHLIGHT_LENGTH),
        ),
      ).slice(0, MAX_HIGHLIGHTS_PER_EXPERIENCE);

      if (!position && !company && highlights.length === 0) return null;
      return {
        ...(company ? { company } : {}),
        ...(position ? { position } : {}),
        ...(highlights.length > 0 ? { highlights } : {}),
      };
    })
    .filter(Boolean) as ProposalPersonalizationContext["recentExperience"];

  return recentExperience && recentExperience.length > 0
    ? recentExperience
    : undefined;
}

function readStandoutAchievements(doc: CvDocument): string[] | undefined {
  const achievementsSection = getSectionByType(doc, "achievements");
  const explicitAchievements = getStructuredItems(achievementsSection).flatMap(
    (item) => {
      const record = asRecord(item);
      return splitIntoSnippets(
        readStringField(record, "text") ?? (typeof item === "string" ? item : ""),
      ).map((snippet) => clampText(snippet, MAX_ACHIEVEMENT_LENGTH));
    },
  );

  const experienceFallback = getStructuredItems(
    getSectionByType(doc, "experience"),
  )
    .flatMap((item) => {
      const record = asRecord(item);
      return readArrayField(record, "achievements");
    })
    .flatMap((value) =>
      typeof value === "string"
        ? splitIntoSnippets(value).map((snippet) =>
            clampText(snippet, MAX_ACHIEVEMENT_LENGTH),
          )
        : [],
    );

  const standoutAchievements = dedupe([
    ...explicitAchievements,
    ...experienceFallback,
  ]).slice(0, MAX_ACHIEVEMENTS);
  return standoutAchievements.length > 0 ? standoutAchievements : undefined;
}

export function extractPersonalizationContextFromCvDocument(
  doc: CvDocument,
): ProposalPersonalizationContext | null {
  const identity = readProfileIdentity(doc);
  const summary = readSummary(doc);
  const topSkills = readTopSkills(doc);
  const recentExperience = readRecentExperience(doc);
  const standoutAchievements = readStandoutAchievements(doc);
  const fallbackHeadline = recentExperience?.[0]?.position;

  const context: ProposalPersonalizationContext = {
    ...(identity.name ? { name: identity.name } : {}),
    ...(summary ? { summary } : {}),
    ...(identity.desiredPosition ?? fallbackHeadline
      ? { desiredPosition: identity.desiredPosition ?? fallbackHeadline }
      : {}),
    ...(topSkills ? { topSkills } : {}),
    ...(recentExperience ? { recentExperience } : {}),
    ...(standoutAchievements ? { standoutAchievements } : {}),
  };

  return Object.keys(context).length > 0 ? context : null;
}

export function classifyPersonalizationRichness(
  context: ProposalPersonalizationContext | null | undefined,
): ProposalPersonalizationRichness {
  if (!context) return "none";

  const hasSummary = Boolean(context.summary);
  const hasHeadline = Boolean(context.desiredPosition);
  const skillCount = context.topSkills?.length ?? 0;
  const experienceCount = context.recentExperience?.length ?? 0;
  const highlightedExperienceCount =
    context.recentExperience?.filter(
      (entry) => (entry.highlights?.length ?? 0) > 0,
    ).length ?? 0;
  const achievementCount = context.standoutAchievements?.length ?? 0;

  const hasUsableSupport =
    hasSummary ||
    hasHeadline ||
    skillCount > 0 ||
    experienceCount > 0 ||
    achievementCount > 0;

  if (!hasUsableSupport) return "none";

  if (
    experienceCount >= 2 ||
    achievementCount >= 2 ||
    (experienceCount >= 1 && achievementCount >= 1) ||
    (experienceCount >= 1 && hasSummary && skillCount >= 2) ||
    (highlightedExperienceCount >= 1 && skillCount >= 4)
  ) {
    return "rich";
  }

  if (
    experienceCount >= 1 ||
    achievementCount >= 1 ||
    skillCount >= 4 ||
    (hasSummary && skillCount >= 2) ||
    (hasHeadline && skillCount >= 2)
  ) {
    return "sparse";
  }

  return "minimal";
}

export function buildActiveCvSnapshotFromCvDocument(
  doc: CvDocument,
): ActiveCvSnapshot {
  const snapshotCacheKey = [
    String(doc.id ?? ""),
    String(doc.title ?? ""),
    String(doc.metadata?.updatedAt ?? ""),
    Array.isArray(doc.sections) ? doc.sections.length : 0,
  ].join("::");
  const cached = activeCvSnapshotCache.get(snapshotCacheKey);
  if (cached) {
    return cached;
  }

  const personalizationContext =
    extractPersonalizationContextFromCvDocument(doc);
  const richness = classifyPersonalizationRichness(personalizationContext);

  const snapshot = {
    title: formatCvDisplayTitle({
      title: clampText(doc.title, 120),
      profileName: personalizationContext?.name,
      desiredPosition: personalizationContext?.desiredPosition,
    }),
    personalizationContext: richness === "none" ? null : personalizationContext,
    ...(typeof doc.metadata?.updatedAt === "string"
      ? { updatedAt: doc.metadata.updatedAt }
      : {}),
  };
  activeCvSnapshotCache.set(snapshotCacheKey, snapshot);
  return snapshot;
}

export function getLocalActiveCvSnapshotById(
  id: string,
): ActiveCvSnapshot | null {
  const nextId = compactWhitespace(id);
  if (!nextId) return null;

  const libraryDoc =
    getLibraryDocuments().find((doc) => String(doc.id) === nextId) ?? null;
  const doc = getStoredDocumentById(nextId) ?? libraryDoc;
  if (!doc) return null;

  return buildActiveCvSnapshotFromCvDocument(doc);
}

export function getActiveLocalPersonalizationSource(): {
  title: string | null;
  personalizationContext: ProposalPersonalizationContext | null;
  richness?: ProposalPersonalizationRichness;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  location?: string | null;
} {
  if (!hasLocalStorage()) {
    return { title: null, personalizationContext: null };
  }

  const activeCvId = readStoredProposalAttachedCvId();
  if (!activeCvId) {
    return { title: null, personalizationContext: null };
  }

  // Mirror the same two-step resolution used in getLocalActiveCvSnapshotById()
  // and listLocalCvPickerOptions(): check prefixed keys first, then fall back
  // to the library array. Without this, CVs stored only in cvDocuments/cvLibrary
  // appear selected in the picker but arrive as null personalization at generation.
  const libraryDoc =
    getLibraryDocuments().find((doc) => String(doc.id) === activeCvId) ?? null;
  const activeDoc = getStoredDocumentById(activeCvId) ?? libraryDoc;
  if (!activeDoc) {
    return { title: null, personalizationContext: null };
  }

  const snapshot = buildActiveCvSnapshotFromCvDocument(activeDoc);
  const richness = classifyPersonalizationRichness(
    snapshot.personalizationContext,
  );
  const contact = readProfileContact(activeDoc);

  return {
    title: snapshot.title,
    personalizationContext: snapshot.personalizationContext,
    richness,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    linkedin: contact.linkedin ?? null,
    website: contact.website ?? null,
    location: contact.location ?? null,
  };
}

export function getProposalApplicantIdentity(source: {
  personalizationContext: ProposalPersonalizationContext | null;
}): {
  name: string | null;
  role: string | null;
} {
  const context = source.personalizationContext;

  return {
    name: compactDisplayPart(context?.name, 72) ?? null,
    role:
      compactDisplayPart(
        context?.desiredPosition ?? context?.recentExperience?.[0]?.position,
        88,
      ) ?? null,
  };
}

export function getProposalApplicantHeaderData(source: {
  personalizationContext: ProposalPersonalizationContext | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  location?: string | null;
}): ProposalApplicantHeaderData {
  const identity = getProposalApplicantIdentity(source);
  const context = source.personalizationContext;

  return {
    name: identity.name,
    role: identity.role,
    email: compactDisplayPart(source.email ?? undefined, 120) ?? null,
    phone: compactDisplayPart(source.phone ?? undefined, 48) ?? null,
    linkedin: compactDisplayPart(source.linkedin ?? undefined, 120) ?? null,
    website: compactDisplayPart(source.website ?? undefined, 120) ?? null,
    location: compactDisplayPart(source.location ?? undefined, 120) ?? null,
    tag:
      compactDisplayPart(context?.topSkills?.[0], 48) ??
      compactDisplayPart(context?.recentExperience?.[0]?.company, 48) ??
      null,
  };
}

export function buildAppProposalPersonalizationPayload(source: {
  personalizationContext: ProposalPersonalizationContext | null;
  richness?: ProposalPersonalizationRichness;
}): ProposalGenerationPersonalizationPayload {
  return {
    personalizationMode: "explicit_only",
    ...(source.richness ? { personalizationRichness: source.richness } : {}),
    ...(source.personalizationContext
      ? { personalizationContext: source.personalizationContext }
      : {}),
  };
}

export function listLocalCvPickerOptions(): LocalCvPickerOption[] {
  if (!hasLocalStorage()) return [];

  const activeCvId = readStoredProposalAttachedCvId();
  const libraryDocs = getLibraryDocuments();
  const candidateIds = new Set<string>();

  for (const doc of libraryDocs) {
    if (doc?.id) candidateIds.add(String(doc.id));
  }
  if (activeCvId) candidateIds.add(activeCvId);

  const options = Array.from(candidateIds)
    .map((id) => {
      const libraryDoc =
        libraryDocs.find((doc) => String(doc.id) === id) ?? null;
      const doc = getStoredDocumentById(id) ?? libraryDoc;
      if (!doc) return null;

      const identity = readProfileIdentity(doc);
      const contact = readProfileContact(doc);
      const summarySnippet = readSummary(doc);
      const updatedAt =
        typeof doc.metadata?.updatedAt === "string"
          ? doc.metadata.updatedAt
          : undefined;
      const createdAt =
        typeof doc.metadata?.createdAt === "string"
          ? doc.metadata.createdAt
          : undefined;

      return {
        id: String(doc.id),
        title: formatCvDisplayTitle({
          title: clampText(doc.title, 120),
          profileName: identity.name,
          desiredPosition: identity.desiredPosition,
        }),
        ...(updatedAt ? { updatedAt } : {}),
        ...(createdAt ? { createdAt } : {}),
        ...(identity.name ? { profileName: identity.name } : {}),
        ...(identity.desiredPosition
          ? { desiredPosition: identity.desiredPosition }
          : {}),
        ...(contact.email ? { email: contact.email } : {}),
        ...(contact.phone ? { phone: contact.phone } : {}),
        ...(contact.linkedin ? { linkedin: contact.linkedin } : {}),
        ...(contact.website ? { website: contact.website } : {}),
        ...(summarySnippet
          ? { summarySnippet: clampText(summarySnippet, 120) }
          : {}),
        isActive: activeCvId === String(doc.id),
      } satisfies LocalCvPickerOption;
    })
    .filter((option): option is LocalCvPickerOption => Boolean(option))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTs = Date.parse(a.updatedAt ?? a.createdAt ?? "") || 0;
      const bTs = Date.parse(b.updatedAt ?? b.createdAt ?? "") || 0;
      return bTs - aTs;
    });

  return options;
}

export function getProposalAttachedCvId(): string | null {
  const activeCvId = readStoredProposalAttachedCvId();
  return activeCvId || null;
}

export function getProposalAttachedCvLocalDocument(): CvDocument | null {
  const attachedCvId = getProposalAttachedCvId();
  if (!attachedCvId) {
    return null;
  }

  const libraryDoc =
    getLibraryDocuments().find((doc) => String(doc.id) === attachedCvId) ?? null;

  return getStoredDocumentById(attachedCvId) ?? libraryDoc;
}

export function setProposalAttachedCvId(id: string): void {
  if (!hasLocalStorage()) return;
  const nextId = compactWhitespace(id);
  if (!nextId) return;
  markProposalAttachedCvMigrationComplete();
  try {
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, nextId);
  } catch {
    /* best-effort */
  }

  dispatchProposalAttachedCvUpdated();
}

export function clearProposalAttachedCvId(): void {
  if (!hasLocalStorage()) return;
  markProposalAttachedCvMigrationComplete();
  try {
    window.localStorage.removeItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY);
  } catch {
    /* best-effort */
  }

  dispatchProposalAttachedCvUpdated();
}

export function setActiveLocalCvId(id: string): void {
  setProposalAttachedCvId(id);
}

export function clearActiveLocalCvId(): void {
  clearProposalAttachedCvId();
}
