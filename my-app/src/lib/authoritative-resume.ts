import type { CvDocument } from "../types/cvDocument";

type UnknownRecord = Record<string, unknown>;

export type AuthoritativeResume = {
  source: "mistral_v3";
  trusted: boolean;
  fallbackToLegacy: boolean;
  normalized: UnknownRecord | null;
};

export type AuthoritativeResumeProfile = {
  name: string;
  desiredPosition?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
  github?: string;
  portfolio?: string;
};

export type AuthoritativeResumeExperience = {
  company?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  summary?: string;
  responsibilityBullets: string[];
  achievements: string[];
};

export type AuthoritativeResumeEducation = {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string;
};

export type AuthoritativeResumeSkill = {
  name: string;
};

export type AuthoritativeResumeLanguage = {
  name: string;
  level?: string;
};

export type AuthoritativeResumeProject = {
  title?: string;
  meta?: string;
  summary?: string;
};

export type AuthoritativeResumeCertification = {
  name: string;
  issuer?: string;
  date?: string;
  credentialId?: string;
};

export type AuthoritativeResumeExportModel = {
  schemaVersion: 1;
  profile: AuthoritativeResumeProfile;
  summary?: string;
  experience: AuthoritativeResumeExperience[];
  education: AuthoritativeResumeEducation[];
  skills: AuthoritativeResumeSkill[];
  languages: AuthoritativeResumeLanguage[];
  projects: AuthoritativeResumeProject[];
  certifications: AuthoritativeResumeCertification[];
  achievements: string[];
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function cleanOptionalString(value: unknown): string | undefined {
  const cleaned = cleanString(value);
  return cleaned || undefined;
}

function cleanStringArray(value: unknown): string[] {
  return asArray(value)
    .map((entry) => cleanString(entry))
    .filter(Boolean);
}

function readString(record: UnknownRecord | null, ...keys: string[]): string {
  for (const key of keys) {
    const value = cleanString(record?.[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function readOptionalString(
  record: UnknownRecord | null,
  ...keys: string[]
): string | undefined {
  const value = readString(record, ...keys);
  return value || undefined;
}

function toAchievementTextList(value: unknown): string[] {
  return asArray(value)
    .map((entry) => {
      const record = asRecord(entry);
      return cleanString(record?.text ?? entry);
    })
    .filter(Boolean);
}

export function coerceAuthoritativeResume(value: unknown): AuthoritativeResume | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (record.source !== "mistral_v3") {
    return null;
  }

  const normalized = asRecord(record.normalized);

  return {
    source: "mistral_v3",
    trusted: record.trusted === true,
    fallbackToLegacy: record.fallbackToLegacy === true,
    normalized,
  };
}

export function hasTrustedAuthoritativeResume(
  value: unknown,
): value is AuthoritativeResume {
  const authoritativeResume = coerceAuthoritativeResume(value);
  return Boolean(
    authoritativeResume &&
      authoritativeResume.trusted === true &&
      authoritativeResume.fallbackToLegacy === false &&
      authoritativeResume.normalized,
  );
}

export function readAuthoritativeResumeFromCv(
  doc: CvDocument | null | undefined,
): AuthoritativeResume | null {
  return coerceAuthoritativeResume(doc?.metadata?.authoritativeResume);
}

export function buildAuthoritativeResumeExportModel(
  value: unknown,
): AuthoritativeResumeExportModel | null {
  const authoritativeResume = coerceAuthoritativeResume(value);
  if (
    !authoritativeResume ||
    authoritativeResume.trusted !== true ||
    authoritativeResume.fallbackToLegacy === true ||
    !authoritativeResume.normalized
  ) {
    return null;
  }

  const normalized = authoritativeResume.normalized;
  const profileRecord = asRecord(normalized.profile);
  const contactRecord = asRecord(normalized.contact);
  const summaryRecord = asRecord(normalized.summary);

  const profile: AuthoritativeResumeProfile = {
    name:
      readString(profileRecord, "name") ||
      readString(contactRecord, "name") ||
      cleanString(normalized.name) ||
      "Candidate",
    desiredPosition:
      readOptionalString(profileRecord, "desiredPosition") ??
      readOptionalString(contactRecord, "desiredPosition"),
    email:
      readOptionalString(profileRecord, "email") ??
      readOptionalString(contactRecord, "email"),
    phone:
      readOptionalString(profileRecord, "phone") ??
      readOptionalString(contactRecord, "phone"),
    location:
      readOptionalString(profileRecord, "location") ??
      readOptionalString(contactRecord, "location"),
    linkedin:
      readOptionalString(profileRecord, "linkedin") ??
      readOptionalString(contactRecord, "linkedin"),
    website:
      readOptionalString(profileRecord, "website") ??
      readOptionalString(contactRecord, "website", "portfolio"),
    github: readOptionalString(contactRecord, "github"),
    portfolio: readOptionalString(contactRecord, "portfolio"),
  };

  const summary = readOptionalString(summaryRecord, "text");

  const experience = asArray(normalized.experience)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const company = readOptionalString(record, "company");
      const position = readOptionalString(record, "position");
      const bullets = cleanStringArray(record.responsibilityBullets);
      const achievements = cleanStringArray(record.achievements);
      const summaryText = readOptionalString(record, "summary");

      if (!company && !position && bullets.length === 0 && achievements.length === 0 && !summaryText) {
        return null;
      }

      return {
        company,
        position,
        location: readOptionalString(record, "location"),
        startDate: readOptionalString(record, "startDate"),
        endDate: readOptionalString(record, "endDate") ?? null,
        isCurrent: record.isCurrent === true,
        summary: summaryText,
        responsibilityBullets: bullets,
        achievements,
      } satisfies AuthoritativeResumeExperience;
    })
    .filter((entry): entry is AuthoritativeResumeExperience => entry !== null);

  const education = asArray(normalized.education)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const institution = readOptionalString(record, "institution");
      const degree = readOptionalString(record, "degree");
      const fieldOfStudy = readOptionalString(record, "fieldOfStudy");
      const description = readOptionalString(record, "description");
      if (!institution && !degree && !fieldOfStudy && !description) {
        return null;
      }
      return {
        institution,
        degree,
        fieldOfStudy,
        startDate: readOptionalString(record, "startDate"),
        endDate: readOptionalString(record, "endDate") ?? null,
        isCurrent: record.isCurrent === true,
        description,
      } satisfies AuthoritativeResumeEducation;
    })
    .filter((entry): entry is AuthoritativeResumeEducation => entry !== null);

  const skills = asArray(normalized.skills)
    .map((entry) => {
      const record = asRecord(entry);
      const name = readString(record, "name");
      return name ? ({ name } satisfies AuthoritativeResumeSkill) : null;
    })
    .filter((entry): entry is AuthoritativeResumeSkill => entry !== null);

  const languages = asArray(normalized.languages)
    .map((entry) => {
      const record = asRecord(entry);
      const name = readString(record, "name");
      if (!name) {
        return null;
      }
      return {
        name,
        level: readOptionalString(record, "level"),
      } satisfies AuthoritativeResumeLanguage;
    })
    .filter((entry): entry is AuthoritativeResumeLanguage => entry !== null);

  const projects = asArray(normalized.projects)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const title =
        readOptionalString(record, "title") ?? readOptionalString(record, "name");
      const meta =
        readOptionalString(record, "meta") ?? readOptionalString(record, "subtitle");
      const summaryText =
        readOptionalString(record, "summary") ??
        readOptionalString(record, "description");
      if (!title && !meta && !summaryText) {
        return null;
      }
      return {
        title,
        meta,
        summary: summaryText,
      } satisfies AuthoritativeResumeProject;
    })
    .filter((entry): entry is AuthoritativeResumeProject => entry !== null);

  const certifications = asArray(normalized.certifications)
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const name =
        readString(record, "certificationName") || readString(record, "name");
      if (!name) {
        return null;
      }
      return {
        name,
        issuer:
          readOptionalString(record, "issuingOrganization") ??
          readOptionalString(record, "issuer"),
        date: readOptionalString(record, "issueDate", "date"),
        credentialId: readOptionalString(record, "credentialId"),
      } satisfies AuthoritativeResumeCertification;
    })
    .filter((entry): entry is AuthoritativeResumeCertification => entry !== null);

  return {
    schemaVersion: 1,
    profile,
    ...(summary ? { summary } : {}),
    experience,
    education,
    skills,
    languages,
    projects,
    certifications,
    achievements: toAchievementTextList(normalized.achievements),
  };
}
