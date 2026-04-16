"use strict";
 
import { parseCvDocumentStrict, CvDocumentSchema } from "../schemas/cvDocument.schema";
import type { CvDocument, CvDocumentStrict } from "../schemas/cvDocument.schema";
import {
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import type { INormalizedProfile } from "../types/profile";
 
/**
 * ConvexUserProfile
 *
 * Local stable type that mirrors the public shape returned by
 * `convex/profilesPublic.get`. Keeping this local avoids editing generated
 * files and still gives us strong typing for normalization logic.
 */
export interface ConvexUserProfile {
  _id: unknown;
  _creationTime: number;
  profileId?: string | undefined;
  clerkId?: string | undefined;
  email: string;
  name?: string | undefined;
  version: number;
  createdAt: number;
  updatedAt: number;
  preferences: {
    rateLimits?: unknown;
    writingStyle: string;
    tonePreference: string;
    autoSend: boolean;
  };
  summary?: string | undefined;
  skills?: string[] | undefined;
  experience?: Array<{
    company: string;
    title: string;
    startDate?: string | number | null | undefined;
    endDate?: string | number | null | undefined;
    description?: string | undefined;
  }> | undefined;
  education?: Array<{
    school: string;
    degree?: string | undefined;
    fieldOfStudy?: string | undefined;
    startDate?: string | number | null | undefined;
    endDate?: string | number | null | undefined;
  }> | undefined;
  linkedIn?: string | undefined;
  raw_text?: string | undefined;
  metadata?: {
    source?: string;
    importedAt?: number;
    confidence?: number;
    filename?: string;
    verbatiStyle?: {
      layout?: string;
      typography?: string;
      palette?: string;
      accentHex?: string;
    };
  } | undefined;
  cvDocument?: unknown;
}
 
/**
 * normalizeConvexProfile
 *
 * Safely convert a raw Convex `profilesPublic.get` result into a stable
 * INormalizedProfile shape that the rest of the frontend expects. This avoids
 * sprinkling `any` casts across the codebase and centralizes conversions.
 */
export function normalizeConvexProfile(raw: ConvexUserProfile | null | undefined): INormalizedProfile {
  if (!raw) return {};
  const experience = Array.isArray(raw.experience)
    ? raw.experience.map((e) => ({
        company: typeof e.company === "string" ? e.company : undefined,
        title: typeof e.title === "string" ? e.title : undefined,
        startDate: e?.startDate == null ? undefined : String(e.startDate),
        endDate: e?.endDate == null ? undefined : String(e.endDate),
        description: typeof e.description === "string" ? e.description : undefined,
      }))
    : undefined;
  const education = Array.isArray(raw.education)
    ? raw.education.map((ed) => ({
        institution: typeof ed.school === "string" ? ed.school : undefined,
        degree: typeof ed.degree === "string" ? ed.degree : undefined,
        fieldOfStudy: typeof ed.fieldOfStudy === "string" ? ed.fieldOfStudy : undefined,
        startDate: ed?.startDate == null ? undefined : String(ed.startDate),
        endDate: ed?.endDate == null ? undefined : String(ed.endDate),
        description: undefined,
      }))
    : undefined;
  const skills = Array.isArray(raw.skills) ? raw.skills.filter((s) => typeof s === "string") : undefined;
  const metadata = raw.metadata ?? undefined;
  const summary = raw.summary ?? raw.raw_text ?? undefined;
  const achievements = undefined;
  return {
    id: raw._id ? String(raw._id) : undefined,
    name: raw.name ?? undefined,
    email: raw.email ?? undefined,
    summary: typeof summary === "string" ? summary : undefined,
    skills,
    experience: experience && experience.length ? experience : undefined,
    education: education && education.length ? education : undefined,
    achievements,
    rawText: raw.raw_text ?? undefined,
    confidence: metadata?.confidence ?? undefined,
    metadata,
    version: typeof raw.version === "number" ? raw.version : undefined,
  };
}

/**
 * mapProfileToCvDocument
 *
 * Pure, best-effort converter from the app's INormalizedProfile shape to a
 * CvDocument (lenient shape). This is intentionally permissive: it produces a
 * CvDocument that matches the lenient schema (CvDocument) and is safe for UI use.
 *
 * The second `forcedId` parameter lets callers supply a target id (used by
 * StorageAdapter when mapping a persisted profile into a CvDocument).
 */
export function mapProfileToCvDocument(profile: any, forcedId?: string): CvDocument | null {
  if (!profile) return null;

  const id = String(forcedId ?? profile.id ?? `cv-${Math.random().toString(36).slice(2, 9)}`);

  const title = profile.name || profile.email || "Untitled CV";

  const nowIso = new Date().toISOString();
  const persistedMetadata =
    profile.metadata && typeof profile.metadata === "object"
      ? (profile.metadata as Record<string, unknown>)
      : null;

  const metadata = {
    createdAt: nowIso,
    updatedAt: nowIso,
    version: typeof profile.version === "number" ? profile.version : 1,
    locale: undefined,
    authorId: undefined,
    lastEditedBy: undefined,
    source:
      typeof persistedMetadata?.source === "string"
        ? persistedMetadata.source
        : undefined,
    importedAt:
      typeof persistedMetadata?.importedAt === "number"
        ? persistedMetadata.importedAt
        : undefined,
    confidence:
      typeof persistedMetadata?.confidence === "number"
        ? persistedMetadata.confidence
        : undefined,
    filename:
      typeof persistedMetadata?.filename === "string"
        ? persistedMetadata.filename
        : undefined,
    verbatiStyle:
      persistedMetadata?.verbatiStyle &&
      typeof persistedMetadata.verbatiStyle === "object"
        ? serializeVerbatiStyle(
            resolveVerbatiStyle(
              persistedMetadata.verbatiStyle as {
                layout?: string;
                typography?: string;
                palette?: string;
                accentHex?: string;
              },
            ),
          )
        : undefined,
  };

  const sections: CvDocument["sections"] = [];

  if (profile.summary && String(profile.summary).trim().length > 0) {
    sections.push({
      id: "summary",
      title: "Summary",
      type: "summary",
      blocks: [
        {
          id: "summary-block",
          type: "text",
          content: typeof profile.summary === "string" ? { type: "text", text: profile.summary } as any : (profile.summary as any),
          plainText: typeof profile.summary === "string" ? profile.summary : undefined,
          order: 0,
        },
      ],
      structuredContent: null,
      collapsed: false,
    });
  }

  if (Array.isArray(profile.skills) && profile.skills.length > 0) {
    sections.push({
      id: "skills",
      title: "Skills",
      type: "skills",
      blocks: [
        {
          id: "skills-block",
          type: "text",
          content: { type: "text", text: profile.skills.join(", ") } as any,
          plainText: profile.skills.join(", "),
          order: 0,
        },
      ],
      structuredContent: null,
      collapsed: false,
    });
  }

  if (Array.isArray(profile.experience) && profile.experience.length > 0) {
    sections.push({
      id: "experience",
      title: "Experience",
      type: "experience",
      blocks: [],
      structuredContent: profile.experience as any,
      collapsed: false,
    });
  }

  if (Array.isArray(profile.education) && profile.education.length > 0) {
    sections.push({
      id: "education",
      title: "Education",
      type: "education",
      blocks: [],
      structuredContent: profile.education as any,
      collapsed: false,
    });
  }

  if (Array.isArray(profile.achievements) && profile.achievements.length > 0) {
    sections.push({
      id: "achievements",
      title: "Achievements",
      type: "text",
      blocks: [
        {
          id: "achievements-block",
          type: "text",
          content: { type: "text", text: profile.achievements.join("\n") } as any,
          plainText: profile.achievements.join("\n"),
          order: 0,
        },
      ],
      structuredContent: null,
      collapsed: false,
    });
  }

  const cv: CvDocument = {
    id,
    title,
    metadata,
    sections,
    tags: Array.isArray(profile.skills) ? profile.skills : undefined,
    summary: profile.summary ?? undefined,
  };

  // Keep this lenient mapper conservative: return null if essential fields absent
  if (!cv.id || !cv.title) return null;
  return cv;
}

/**
 * mapProfileToCvDocumentStrict
 *
 * Convert a profile into a CvDocumentStrict by first mapping with the lenient
 * mapper and then validating with the strict parser. This will throw if the
 * result doesn't match the strict schema.
 */
export function mapProfileToCvDocumentStrict(profile: any, forcedId?: string): CvDocumentStrict {
  const loose = mapProfileToCvDocument(profile, forcedId);
  if (!loose) throw new Error("Unable to map profile to CvDocument");
  // Validate strict shape — parseCvDocumentStrict will throw on invalid input.
  return parseCvDocumentStrict(loose) as CvDocumentStrict;
}
