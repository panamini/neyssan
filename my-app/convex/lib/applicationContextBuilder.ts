import {
  buildCandidateHash,
  buildContextHash,
  buildJobHash,
  buildRawJobTextHash,
  buildSettingsHash,
  buildStableHash,
} from "./applicationHarnessHashes";

type LooseRecord = Record<string, unknown>;

type SourceRefV1 = Readonly<{
  sourceType:
    | "job"
    | "cv"
    | "candidate_source_document"
    | "candidate_fact"
    | "proposal"
    | "artifact";
  sourceId: string;
  sourcePath?: string;
  sourceHash?: string;
}>;

type ApplicationContextV1 = Readonly<{
  id: string;
  userId: string;
  job: Readonly<{
    jobId: string;
    sourceUrl?: string;
    title?: string;
    company?: string;
    rawTextHash: string;
    jobBriefHash?: string;
  }>;
  candidate:
    | Readonly<{
        sourceKind: "cv";
        cvId: string;
        candidateHash: string;
        selectedLanguage?: string;
        market?: string;
      }>
    | Readonly<{
        sourceKind: "candidate_evidence_profile";
        candidateEvidenceProfileId: string;
        candidateHash: string;
        selectedLanguage?: string;
        market?: string;
      }>;
  settingsHash: string;
  contextHash: string;
  reviewState: "draft" | "needs_review" | "approved" | "superseded";
  sourceRefs: readonly SourceRefV1[];
  createdAt: number;
  updatedAt: number;
  version: 1;
}>;

export type ApplicationContextBuilderJob = LooseRecord & {
  _id?: unknown;
  id?: unknown;
  sourceUrl?: unknown;
  title?: unknown;
  company?: unknown;
  rawDescription?: unknown;
};

export type ApplicationContextBuilderCandidateProfile = LooseRecord & {
  _id?: unknown;
  profileId?: unknown;
  defaultResumeId?: unknown;
  defaultResumeName?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  linkedin?: unknown;
  website?: unknown;
  location?: unknown;
  summary?: unknown;
  skills?: unknown;
  keywords?: unknown;
  experience?: unknown;
  education?: unknown;
  languages?: unknown;
  contact?: unknown;
  achievements?: unknown;
  raw_text?: unknown;
  cvDocument?: unknown;
};

export type ApplicationContextBuildSettings = Readonly<{
  selectedLanguage?: string;
  market?: string;
}>;

export type BuildApplicationContextFromExistingDataInput = Readonly<{
  userId: string;
  job: ApplicationContextBuilderJob;
  candidateProfile: ApplicationContextBuilderCandidateProfile;
  settings?: ApplicationContextBuildSettings;
  now?: number;
}>;

export type BuildApplicationContextFromExistingDataResult = Readonly<{
  context: ApplicationContextV1;
  rawTextHash: string;
  jobHash: string;
  jobBriefHash: string;
  structuredSectionsHash?: string;
  cvSnapshotHash: string;
  candidateHash: string;
  settingsHash: string;
  contextHash: string;
}>;

export async function buildApplicationContextV1FromExistingData(
  input: BuildApplicationContextFromExistingDataInput,
): Promise<BuildApplicationContextFromExistingDataResult> {
  const now = normalizeTimestamp(input.now);
  const jobId = resolveStableId(input.job, "job");
  const cvId = resolveCanonicalCvId(input.candidateProfile);
  const rawDescription = readString(input.job.rawDescription) ?? "";
  const title = readString(input.job.title);
  const company = readString(input.job.company);
  const sourceUrl = readString(input.job.sourceUrl);

  const rawTextHash = await buildRawJobTextHash(rawDescription);
  const jobBriefHash = await buildStableHash({
    type: "canonical-job-brief-demands",
    version: 1,
    jobId,
    mustHaves: normalizeJobBriefDemandList(input.job.mustHaves),
    responsibilities: normalizeJobBriefDemandList(input.job.responsibilities),
    keywords: normalizeJobBriefDemandList(input.job.keywords),
  });
  const jobHash = await buildJobHash({
    jobId,
    rawDescription,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(title ? { title } : {}),
    ...(company ? { company } : {}),
  });

  const structuredSectionsSnapshot = extractStructuredSectionsSnapshot(
    input.candidateProfile.cvDocument,
  );
  const structuredSectionsHash = structuredSectionsSnapshot
    ? await buildStableHash({
        type: "cv-structured-sections",
        version: 1,
        sections: structuredSectionsSnapshot,
      })
    : undefined;
  const cvSnapshotHash = await buildStableHash({
    type: "cv-profile-snapshot",
    version: 1,
    snapshot: await buildCandidateProfileSnapshot(input.candidateProfile, cvId),
  });
  const candidateHash = await buildCandidateHash({
    sourceKind: "cv",
    cvId,
    ...(structuredSectionsHash ? { structuredSectionsHash } : {}),
    cvSnapshotHash,
  });
  const settings = normalizeSettings(input.settings);
  const settingsHash = await buildSettingsHash(settings);
  const contextHash = await buildContextHash({
    jobHash,
    jobBriefHash,
    candidateHash,
    settingsHash,
  });
  const contextId = `application-context:${contextHash}`;
  const sourceRefs: SourceRefV1[] = [
    {
      sourceType: "job",
      sourceId: jobId,
      sourceHash: jobHash,
    },
    {
      sourceType: "cv",
      sourceId: cvId,
      sourceHash: candidateHash,
    },
  ];

  const context: ApplicationContextV1 = {
    id: contextId,
    userId: input.userId,
    job: {
      jobId,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(title ? { title } : {}),
      ...(company ? { company } : {}),
      rawTextHash,
      jobBriefHash,
    },
    candidate: {
      sourceKind: "cv",
      cvId,
      candidateHash,
      ...(settings.selectedLanguage ? { selectedLanguage: settings.selectedLanguage } : {}),
      ...(settings.market ? { market: settings.market } : {}),
    },
    settingsHash,
    contextHash,
    reviewState: "draft",
    sourceRefs,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };

  return {
    context,
    rawTextHash,
    jobHash,
    jobBriefHash,
    ...(structuredSectionsHash ? { structuredSectionsHash } : {}),
    cvSnapshotHash,
    candidateHash,
    settingsHash,
    contextHash,
  };
}

function normalizeTimestamp(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

function normalizeSettings(settings: ApplicationContextBuildSettings | undefined) {
  return {
    ...(readString(settings?.selectedLanguage) ? { selectedLanguage: readString(settings?.selectedLanguage) } : {}),
    ...(readString(settings?.market) ? { market: readString(settings?.market) } : {}),
    version: 1,
  };
}

function resolveStableId(record: LooseRecord, label: string): string {
  const id = readString(record._id) ?? readString(record.id) ?? readString(record.profileId);
  if (!id) {
    throw new Error(`ApplicationContext builder requires ${label} identity`);
  }
  return id;
}

function resolveCanonicalCvId(profile: ApplicationContextBuilderCandidateProfile): string {
  const cvDocument = asRecord(profile.cvDocument);
  return readString(cvDocument?.id) ?? resolveStableId(profile, "cv");
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const compact = value.replace(/\s+/g, " ").trim();
  return compact || undefined;
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function buildCandidateProfileSnapshot(
  profile: ApplicationContextBuilderCandidateProfile,
  cvId: string,
) {
  const rawText = readString(profile.raw_text);

  return {
    cvId,
    ...(readString(profile.profileId) ? { profileId: readString(profile.profileId) } : {}),
    ...(readString(profile.defaultResumeId) ? { defaultResumeId: readString(profile.defaultResumeId) } : {}),
    ...(readString(profile.defaultResumeName) ? { defaultResumeName: readString(profile.defaultResumeName) } : {}),
    ...(readString(profile.name) ? { name: readString(profile.name) } : {}),
    ...(readString(profile.email) ? { email: readString(profile.email) } : {}),
    ...(readString(profile.phone) ? { phone: readString(profile.phone) } : {}),
    ...(readString(profile.linkedin) ? { linkedin: readString(profile.linkedin) } : {}),
    ...(readString(profile.website) ? { website: readString(profile.website) } : {}),
    ...(readString(profile.location) ? { location: readString(profile.location) } : {}),
    ...(readString(profile.summary) ? { summary: readString(profile.summary) } : {}),
    skills: compactStringArray(profile.skills),
    keywords: compactStringArray(profile.keywords),
    experience: normalizeExperience(profile.experience),
    education: normalizeEducation(profile.education),
    languages: compactStringArray(profile.languages),
    achievements: compactStringArray(profile.achievements),
    contact: normalizeContact(profile.contact),
    ...(rawText ? { rawTextHash: await buildStableHash({ type: "candidate-raw-text", version: 1, rawText }) } : {}),
    cvDocument: normalizeCvDocumentMetadata(profile.cvDocument),
  };
}

function compactStringArray(value: unknown): string[] {
  return readArray(value)
    .map(readString)
    .filter((item): item is string => Boolean(item));
}

function normalizeJobBriefDemandList(value: unknown): string[] {
  return [
    ...new Set(
      compactStringArray(value).map((item) =>
        item.normalize("NFKC").toLowerCase(),
      ),
    ),
  ].sort();
}

function normalizeExperience(value: unknown) {
  return readArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      return compactObject({
        company: readString(record.company),
        title: readString(record.title) ?? readString(record.position),
        startDate: readString(record.startDate) ?? readNumber(record.startDate),
        endDate: readString(record.endDate) ?? readNumber(record.endDate),
        description: readString(record.description),
        current: typeof record.current === "boolean" ? record.current : undefined,
      });
    })
    .filter(Boolean);
}

function normalizeEducation(value: unknown) {
  return readArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      return compactObject({
        school: readString(record.school) ?? readString(record.institution),
        degree: readString(record.degree),
        fieldOfStudy: readString(record.fieldOfStudy),
        startDate: readString(record.startDate) ?? readNumber(record.startDate),
        endDate: readString(record.endDate) ?? readNumber(record.endDate),
      });
    })
    .filter(Boolean);
}

function normalizeContact(value: unknown) {
  const record = asRecord(value);
  if (!record) return undefined;
  return compactObject({
    name: readString(record.name),
    email: readString(record.email),
    phone: readString(record.phone),
    linkedin: readString(record.linkedin),
    website: readString(record.website),
    location: readString(record.location),
    address: readString(record.address),
  });
}

function normalizeCvDocumentMetadata(value: unknown) {
  const cvDocument = asRecord(value);
  if (!cvDocument) return undefined;
  const metadata = asRecord(cvDocument.metadata);

  return compactObject({
    id: readString(cvDocument.id),
    title: readString(cvDocument.title),
    summary: readPlainText(cvDocument.summary),
    tags: compactStringArray(cvDocument.tags),
    metadata: metadata
      ? compactObject({
          createdAt: readString(metadata.createdAt),
          updatedAt: readString(metadata.updatedAt),
          version: readNumber(metadata.version),
          locale: readString(metadata.locale),
          resumeTemplateId: readString(metadata.resumeTemplateId),
        })
      : undefined,
  });
}

function extractStructuredSectionsSnapshot(cvDocumentValue: unknown) {
  const cvDocument = asRecord(cvDocumentValue);
  const sections = readArray(cvDocument?.sections);
  if (sections.length === 0) {
    return undefined;
  }

  return sections
    .map((section) => {
      const record = asRecord(section);
      if (!record) return null;
      const structuredContent = record.structuredContent ?? null;
      const blocks = readArray(record.blocks)
        .map((block) => {
          const blockRecord = asRecord(block);
          if (!blockRecord) return null;
          return compactObject({
            id: readString(blockRecord.id),
            title: readString(blockRecord.title),
            type: readString(blockRecord.type),
            plainText: readString(blockRecord.plainText),
            contentText: readPlainText(blockRecord.content),
            order: readNumber(blockRecord.order),
          });
        })
        .filter(Boolean);

      return compactObject({
        id: readString(record.id),
        title: readString(record.title),
        type: readString(record.type),
        order: readNumber(record.order),
        structuredContent: structuredContent === null ? undefined : normalizeStructuredContent(structuredContent),
        blocks,
        skillCategories: normalizeSkillCategories(record.skillCategories),
      });
    })
    .filter(Boolean);
}

function normalizeStructuredContent(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeStructuredContent).filter((item) => item !== undefined);
  }
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: LooseRecord = {};
  for (const key of Object.keys(record).sort()) {
    const next = normalizeStructuredContent(record[key]);
    if (next !== undefined) {
      normalized[key] = next;
    }
  }
  return normalized;
}

function normalizeSkillCategories(value: unknown) {
  return readArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) return null;
      return compactObject({
        id: readString(record.id),
        label: readString(record.label),
        source: readString(record.source),
        locked: typeof record.locked === "boolean" ? record.locked : undefined,
      });
    })
    .filter(Boolean);
}

function readPlainText(value: unknown): string | undefined {
  if (typeof value === "string") return readString(value);
  if (Array.isArray(value)) {
    return readString(value.map(readPlainText).filter(Boolean).join(" "));
  }
  const record = asRecord(value);
  if (!record) return undefined;
  if (typeof record.text === "string") return readString(record.text);
  return readString(
    [record.plainText, record.summary, record.content, record.children]
      .map(readPlainText)
      .filter(Boolean)
      .join(" "),
  );
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compactObject<T extends LooseRecord>(record: T): Partial<T> | undefined {
  const next: LooseRecord = {};
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isPlainEmptyObject(value)) continue;
    next[key] = value;
  }

  return Object.keys(next).length > 0 ? (next as Partial<T>) : undefined;
}

function isPlainEmptyObject(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype &&
      Object.keys(value).length === 0,
  );
}
