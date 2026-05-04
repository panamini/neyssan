import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  canonicalizeUserProfileMetadata,
  userProfileMetadataValidator,
} from "./lib/userProfileMetadata";
import {
  getPrimaryProfileForClerk,
  resolveCanonicalProfileKeywordsForWrite,
} from "./lib/userProfiles";

export function resolvePatchProfileRow<T extends { clerkId?: string | undefined }>(
  rows: T[],
  clerkSubject: string | undefined,
): T | null {
  if (!rows.length) {
    return null;
  }

  if (clerkSubject) {
    const owned = rows.find((row) => row.clerkId === clerkSubject);
    if (owned) {
      return owned;
    }
  }

  const unclaimed = rows.find((row) => !row.clerkId);
  return unclaimed ?? null;
}

function compactScoringText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dedupeScoringStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const text = compactScoringText(value);
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(text);
  }

  return out;
}

function extractTextFromRichValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return compactScoringText(value);
  }

  if (Array.isArray(value)) {
    return compactScoringText(value.map(extractTextFromRichValue).join(" "));
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  const direct = [
    record.text,
    record.plainText,
    record.summary,
    record.name,
    record.company,
    record.title,
    record.position,
    record.description,
    record.responsibilities,
    record.responsibilityBullets,
    record.achievements,
  ]
    .map(extractTextFromRichValue)
    .filter(Boolean);
  const nested = [record.content, record.children, record.contentText]
    .map(extractTextFromRichValue)
    .filter(Boolean);

  return compactScoringText([...direct, ...nested].join(" "));
}

function extractSectionText(section: Record<string, any>): string {
  const structuredText = extractTextFromRichValue(section.structuredContent);
  const blockText = Array.isArray(section.blocks)
    ? section.blocks.map(extractTextFromRichValue).join(" ")
    : "";

  return compactScoringText([structuredText, blockText].join(" "));
}

function extractSummarySectionText(section: Record<string, any>): string {
  return (
    compactScoringText(extractTextFromRichValue(section.structuredContent)) ||
    compactScoringText(
      Array.isArray(section.blocks)
        ? section.blocks.map(extractTextFromRichValue).join(" ")
        : "",
    )
  );
}

function coerceCvExperienceEntry(entry: Record<string, any>) {
  const description = compactScoringText(
    [
      extractTextFromRichValue(entry.description),
      extractTextFromRichValue(entry.responsibilities),
      extractTextFromRichValue(entry.responsibilityBullets),
      extractTextFromRichValue(entry.achievements),
    ].join(" "),
  );
  const company = compactScoringText(entry.company ?? entry.employer ?? "");
  const title = compactScoringText(entry.title ?? entry.position ?? entry.jobTitle ?? "");

  if (!company && !title && !description) {
    return null;
  }

  return {
    company,
    title,
    ...(entry.startDate !== undefined ? { startDate: entry.startDate } : {}),
    ...(entry.endDate !== undefined ? { endDate: entry.endDate } : {}),
    ...(description ? { description } : {}),
  };
}

export function buildScoringProfileFieldsFromCvDocument(
  cvDocument: unknown,
): {
  summary?: string;
  skills: string[];
  experience: Array<{
    company: string;
    title: string;
    startDate?: string | number | null;
    endDate?: string | number | null;
    description?: string;
  }>;
  raw_text?: string;
} {
  if (!cvDocument || typeof cvDocument !== "object") {
    return { skills: [], experience: [] };
  }

  const cv = cvDocument as Record<string, any>;
  const sections = Array.isArray(cv.sections) ? cv.sections : [];
  const rawTextParts: string[] = [];
  const skills: unknown[] = [];
  const experience: Array<{
    company: string;
    title: string;
    startDate?: string | number | null;
    endDate?: string | number | null;
    description?: string;
  }> = [];
  let summary = compactScoringText(extractTextFromRichValue(cv.summary)) || undefined;

  for (const section of sections) {
    if (!section || typeof section !== "object") {
      continue;
    }

    const sectionRecord = section as Record<string, any>;
    const sectionText = extractSectionText(sectionRecord);
    if (sectionText) {
      rawTextParts.push(sectionText);
    }

    if (sectionRecord.type === "summary" && !summary) {
      summary = extractSummarySectionText(sectionRecord) || undefined;
    }

    if (sectionRecord.type === "skills") {
      let foundStructuredSkills = false;
      if (Array.isArray(sectionRecord.structuredContent)) {
        for (const item of sectionRecord.structuredContent) {
          if (item && typeof item === "object") {
            skills.push((item as Record<string, unknown>).name ?? item);
            foundStructuredSkills = true;
          } else {
            skills.push(item);
            foundStructuredSkills = true;
          }
        }
      }
      if (!foundStructuredSkills && sectionText) {
        skills.push(...sectionText.split(/[,•\n]/g));
      }
    }

    if (
      sectionRecord.type === "experience" &&
      Array.isArray(sectionRecord.structuredContent)
    ) {
      for (const item of sectionRecord.structuredContent) {
        if (!item || typeof item !== "object") {
          continue;
        }

        const nextEntry = coerceCvExperienceEntry(item as Record<string, any>);
        if (nextEntry) {
          experience.push(nextEntry);
        }
      }
    }
  }

  const raw_text = compactScoringText(rawTextParts.join("\n\n")) || undefined;

  return {
    ...(summary ? { summary } : {}),
    skills: dedupeScoringStrings(skills),
    experience,
    ...(raw_text ? { raw_text } : {}),
  };
}

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await getPrimaryProfileForClerk(ctx, identity.subject);
  },
});

export const upsert = internalMutation({
  args: {
    preferences: v.object({
      writingStyle: v.string(),
      tonePreference: v.string(),
      autoSend: v.boolean(),
      rateLimits: v.optional(v.object({})),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await getPrimaryProfileForClerk(ctx, identity.subject);

    if (existing) {
      return ctx.db.patch(existing._id, {
        preferences: args.preferences,
        version: (existing.version ?? 1) + 1,
        updatedAt: Date.now(),
      });
    } else {
      return ctx.db.insert("userProfiles", {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
        preferences: args.preferences,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const patch = mutation({
  args: {
    // Accept either a full `profile` object (legacy) OR a `patch` payload coming from the autosave client.
    profile: v.optional(
      v.object({
        name: v.optional(v.string()),
        summary: v.optional(v.string()),
        rawText: v.optional(v.string()),
        raw_text: v.optional(v.string()),
        linkedIn: v.optional(v.string()),
        skills: v.optional(v.array(v.string())),
        keywords: v.optional(v.array(v.string())),
        experience: v.optional(
          v.array(
            v.object({
              company: v.string(),
              title: v.string(),
              startDate: v.optional(v.number()),
              endDate: v.optional(v.number()),
              description: v.optional(v.string()),
            })
          )
        ),
        education: v.optional(
          v.array(
            v.object({
              school: v.string(),
              degree: v.optional(v.string()),
              fieldOfStudy: v.optional(v.string()),
              startDate: v.optional(v.number()),
              endDate: v.optional(v.number()),
            })
          )
        ),
        metadata: v.optional(
          userProfileMetadataValidator,
        ),
      })
    ),
    profileId: v.optional(v.string()),
    patch: v.optional(v.any()),
    source: v.optional(v.string()),
    version: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const identity = await ctx.auth.getUserIdentity();

    // Resolve existing document. Prefer profileId (autosave flows), otherwise use authenticated clerk user.
    let existing: any = null;
    if (args.profileId) {
      const rows = await ctx.db
        .query("userProfiles")
        .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
        .collect();
      existing = resolvePatchProfileRow(rows, identity?.subject);
    } else {
      if (!identity) throw new Error("Not authenticated");
      existing = await getPrimaryProfileForClerk(ctx, identity.subject);
    }

    if (existing?.clerkId) {
      if (!identity || existing.clerkId !== identity.subject) {
        throw new Error("Not authorized to access this profile");
      }
    }

    // If no existing doc and profileId was provided, create a new draft document (autosave can create drafts).
    if (!existing && args.profileId) {
      const incoming: any = (args.profile as any) || {};
      const patchPayload: any =
        args.patch && typeof args.patch === "object" ? args.patch : {};
      const patchKeys = Object.keys(patchPayload);
      const incomingKeys = Object.keys(incoming);
      const isMetadataOnlyPatch =
        patchKeys.length > 0 &&
        patchKeys.every((key) => key === "metadata") &&
        incomingKeys.length === 0;

      if (isMetadataOnlyPatch) {
        return {
          profileId: args.profileId,
          updatedAt: now,
          written: false,
          reason: "not_found_metadata_only",
        };
      }

      const cvScoringFields = buildScoringProfileFieldsFromCvDocument(
        patchPayload.cvDocument ?? incoming.cvDocument,
      );
      const rawText =
        patchPayload && Array.isArray(patchPayload.rawSections)
          ? patchPayload.rawSections
              .map((s: any) => String(s.content ?? ""))
              .join("\n\n")
          : (incoming.rawText ??
            incoming.raw_text ??
            patchPayload.rawText ??
            patchPayload.raw_text ??
            cvScoringFields.raw_text);
      const summary =
        incoming.summary ?? patchPayload.summary ?? cvScoringFields.summary;
      const skills =
        Array.isArray(incoming.skills) && incoming.skills.length > 0
          ? incoming.skills
          : Array.isArray(patchPayload.skills) && patchPayload.skills.length > 0
            ? patchPayload.skills
            : cvScoringFields.skills;
      const experience =
        Array.isArray(incoming.experience) && incoming.experience.length > 0
          ? incoming.experience
          : Array.isArray(patchPayload.experience) &&
              patchPayload.experience.length > 0
            ? patchPayload.experience
            : cvScoringFields.experience;
      const explicitKeywords =
        Array.isArray(incoming.keywords) && incoming.keywords.length > 0
          ? incoming.keywords
          : Array.isArray(patchPayload.keywords) && patchPayload.keywords.length > 0
            ? patchPayload.keywords
            : undefined;
      const doc: any = {
        profileId: args.profileId,
        clerkId: identity?.subject ?? undefined,
        email: incoming.email ?? patchPayload.email ?? identity?.email ?? "",
        achievements: incoming.achievements ?? [],
        skills,
        keywords: resolveCanonicalProfileKeywordsForWrite({
          nextKeywords: explicitKeywords,
          summary,
          skills,
          experience,
          rawText,
        }),
        languages: incoming.languages ?? patchPayload.languages ?? [],
        experience,
        education: incoming.education ?? patchPayload.education ?? [],
        contact: incoming.contact ?? patchPayload.contact ?? undefined,
        name: incoming.name ?? patchPayload.name ?? identity?.name ?? undefined,
        summary,
        idempotencyKeys: Array.isArray(incoming.idempotencyKeys) ? incoming.idempotencyKeys : [],
        preferences: patchPayload.preferences ?? incoming.preferences ?? {
          autoSend: false,
          rateLimits: undefined,
          tonePreference: "neutral",
          writingStyle: "conversational",
        },
        createdAt: now,
        updatedAt: now,
        version: args.version ?? 1,
      };

      const initialMetadata = canonicalizeUserProfileMetadata(
        patchPayload.metadata ?? incoming.metadata,
      );
      if (initialMetadata !== undefined) {
        doc.metadata = initialMetadata;
      }

      if (patchPayload.cvDocument !== undefined) {
        doc.cvDocument = patchPayload.cvDocument;
      } else if (incoming.cvDocument !== undefined) {
        doc.cvDocument = incoming.cvDocument;
      }

      if (rawText) {
        doc.raw_text = rawText;
      }

      const convexId = await ctx.db.insert("userProfiles", doc as any);
      return { profileId: args.profileId, convexId, updatedAt: doc.updatedAt, written: true };
    }

    if (!existing) throw new Error("User profile not found");

    const existingPatchPayload: any =
      args.patch && typeof args.patch === "object" ? args.patch : null;
    const existingPatchKeys = existingPatchPayload
      ? Object.keys(existingPatchPayload)
      : [];
    const isExistingMetadataOnlyPatch =
      !args.profile &&
      existingPatchKeys.length > 0 &&
      existingPatchKeys.every((key) => key === "metadata");

    if (isExistingMetadataOnlyPatch) {
      const md = {
        ...((existing.metadata ?? {}) as Record<string, unknown>),
        ...(canonicalizeUserProfileMetadata(
          existingPatchPayload.metadata,
        ) as Record<string, unknown>),
      };
      delete md.updatedAt;
      delete md.version;
      delete md.authoritativeResume;

      await ctx.db.patch(existing._id, {
        metadata: md,
        updatedAt: now,
        version: (existing.version || 1) + 1,
      });

      return {
        profileId: existing.profileId ?? args.profileId ?? undefined,
        convexId: existing._id,
        updatedAt: now,
        written: true,
      };
    }

    // If caller provided a full `profile` object, update specific fields (legacy behavior).
    if (args.profile) {
      const updates: any = {
        updatedAt: now,
        version: (existing.version || 1) + 1,
      };

      if (identity && !existing.clerkId) {
        updates.clerkId = identity.subject;
        if (!existing.email && identity.email) updates.email = identity.email;
        if (!existing.name && identity.name) updates.name = identity.name;
      }

      if (args.profile.summary !== undefined) updates.summary = args.profile.summary;
      if (args.profile.skills !== undefined) updates.skills = args.profile.skills;
      if (args.profile.keywords !== undefined) updates.keywords = args.profile.keywords;
      if (args.profile.experience !== undefined) updates.experience = args.profile.experience;
      if (args.profile.education !== undefined) updates.education = args.profile.education;
      if (args.profile.name !== undefined) updates.name = args.profile.name;
      if (args.profile.rawText !== undefined) updates.raw_text = args.profile.rawText;
      if (args.profile.raw_text !== undefined) updates.raw_text = args.profile.raw_text;
      if (args.profile.linkedIn !== undefined) updates.linkedIn = args.profile.linkedIn;
      if (args.profile.metadata !== undefined) {
        const md = {
          ...(canonicalizeUserProfileMetadata(args.profile.metadata) as Record<
            string,
            unknown
          >),
        };
        delete md.updatedAt;
        delete md.version;
        updates.metadata = md;
      }

      updates.keywords = resolveCanonicalProfileKeywordsForWrite({
        nextKeywords: args.profile.keywords,
        summary: updates.summary ?? existing.summary,
        skills: updates.skills ?? existing.skills,
        experience: updates.experience ?? existing.experience,
        rawText: updates.raw_text ?? existing.raw_text,
      });

      return ctx.db.patch(existing._id, updates);
    }

    // If caller provided a `patch` payload (autosave), sanitize and apply only allowed fields.
    if (args.patch && typeof args.patch === "object") {
      // Allowed top-level fields according to table validator
      const allowed = new Set([
        "name",
        "summary",
        "raw_text",
        "rawText",
        "email",
        "skills",
        "keywords",
        "languages",
        "contact",
        "experience",
        "education",
        "achievements",
        "metadata",
        "cvDocument",
        "idempotencyKeys",
        "preferences",
      ]);

      const updates: any = {};
      for (const key of Object.keys(args.patch)) {
        if (key === "rawSections" && Array.isArray(args.patch.rawSections)) {
          updates.raw_text = args.patch.rawSections.map((s: any) => String(s.content ?? "")).join("\n\n");
          continue;
        }
        if (allowed.has(key)) {
          // Map rawText -> raw_text for schema compatibility
          if (key === "rawText") updates.raw_text = args.patch[key];
          else updates[key] = args.patch[key];
        }
      }

      const cvScoringFields = buildScoringProfileFieldsFromCvDocument(
        args.patch.cvDocument,
      );
      if (
        updates.summary === undefined &&
        !compactScoringText(existing.summary ?? "") &&
        cvScoringFields.summary
      ) {
        updates.summary = cvScoringFields.summary;
      }
      if (
        updates.skills === undefined &&
        (existing.skills?.length ?? 0) === 0 &&
        cvScoringFields.skills.length > 0
      ) {
        updates.skills = cvScoringFields.skills;
      }
      if (
        updates.experience === undefined &&
        (existing.experience?.length ?? 0) === 0 &&
        cvScoringFields.experience.length > 0
      ) {
        updates.experience = cvScoringFields.experience;
      }
      if (
        updates.raw_text === undefined &&
        !compactScoringText(existing.raw_text ?? "") &&
        cvScoringFields.raw_text
      ) {
        updates.raw_text = cvScoringFields.raw_text;
      }

      if (identity && !existing.clerkId) {
        updates.clerkId = identity.subject;
        if (!existing.email && identity.email) updates.email = identity.email;
        if (!existing.name && identity.name) updates.name = identity.name;
      }

      updates.updatedAt = now;
      updates.version = (existing.version || 1) + 1;

      // Defensive: don't send empty updates
      const keys = Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "version");
      if (keys.length === 0) {
        // Nothing meaningful to persist
        return { profileId: existing.profileId ?? undefined, convexId: existing._id, updatedAt: updates.updatedAt, written: false };
      }

      // Defensive: remove updatedAt and version from metadata if present in patch
      if (updates.metadata) {
        const md = {
          ...(canonicalizeUserProfileMetadata(updates.metadata) as Record<
            string,
            unknown
          >),
        };
        delete md.updatedAt;
        delete md.version;
        delete md.authoritativeResume;
        updates.metadata = md;
      }

      updates.keywords = resolveCanonicalProfileKeywordsForWrite({
        nextKeywords: Array.isArray(args.patch.keywords)
          ? args.patch.keywords
          : undefined,
        summary: updates.summary ?? existing.summary,
        skills: updates.skills ?? existing.skills,
        experience: updates.experience ?? existing.experience,
        rawText: updates.raw_text ?? existing.raw_text,
      });

      return ctx.db.patch(existing._id, updates);
    }

    // No recognized payload provided
    throw new Error("Invalid arguments: expected `profile` or `patch`");
  },
});
 
// Public, idempotent save endpoint used by the UI as a reliable fallback.
// Accepts an external profileId and a profile payload and performs an upsert.
export const saveProfile = mutation({
  args: {
    profileId: v.string(),
    idempotencyKey: v.optional(v.string()),
    source: v.optional(v.string()),
    version: v.optional(v.number()),
    profile: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incoming = args.profile || {};
    const dedupeStrings = (arr: any) => {
      if (!Array.isArray(arr)) return [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const it of arr) {
        if (it == null) continue;
        const s = String(it).trim();
        if (!s) continue;
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
        }
      }
      return out;
    };
 
    const normalizedProfile = {
      profileId: args.profileId,
      name: incoming.name ?? undefined,
      email: incoming.email ?? "",
      summary: incoming.summary ?? undefined,
      skills: dedupeStrings(incoming.skills),
      keywords: dedupeStrings(incoming.keywords),
      languages: dedupeStrings(incoming.languages),
      contact: incoming.contact ?? undefined,
      experience: incoming.experience ?? [],
      education: incoming.education ?? [],
      achievements: dedupeStrings(incoming.achievements),
      updatedAt: now,
    };
 
    const existingRows = await ctx.db
      .query("userProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .take(1);
 
    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
      const existingKeys = Array.isArray(existing.idempotencyKeys) ? existing.idempotencyKeys : [];
      if (args.idempotencyKey && existingKeys.includes(args.idempotencyKey)) {
        return { profileId: args.profileId, convexId: existing._id, updatedAt: existing.updatedAt ?? existing.updatedAt, written: false };
      }
 
      const merged: any = {
        profileId: args.profileId,
        idempotencyKeys: args.idempotencyKey ? Array.from(new Set([...existingKeys, args.idempotencyKey])) : existingKeys,
        name: normalizedProfile.name ?? existing.name ?? undefined,
        email: normalizedProfile.email ?? existing.email ?? "",
        summary: normalizedProfile.summary ?? existing.summary ?? undefined,
        languages: (normalizedProfile.languages && normalizedProfile.languages.length > 0) ? normalizedProfile.languages : (existing.languages ?? []),
        contact: normalizedProfile.contact ?? existing.contact ?? undefined,
        skills: (normalizedProfile.skills && normalizedProfile.skills.length > 0) ? normalizedProfile.skills : (existing.skills ?? []),
        keywords: resolveCanonicalProfileKeywordsForWrite({
          nextKeywords:
            normalizedProfile.keywords && normalizedProfile.keywords.length > 0
              ? normalizedProfile.keywords
              : undefined,
          summary: normalizedProfile.summary ?? existing.summary,
          skills:
            (normalizedProfile.skills && normalizedProfile.skills.length > 0)
              ? normalizedProfile.skills
              : (existing.skills ?? []),
          experience:
            (normalizedProfile.experience && normalizedProfile.experience.length > 0)
              ? normalizedProfile.experience
              : (existing.experience ?? []),
          rawText: existing.raw_text,
        }),
        experience: (normalizedProfile.experience && normalizedProfile.experience.length > 0) ? normalizedProfile.experience : (existing.experience ?? []),
        education: (normalizedProfile.education && normalizedProfile.education.length > 0) ? normalizedProfile.education : (existing.education ?? []),
        achievements: (normalizedProfile.achievements && normalizedProfile.achievements.length > 0) ? normalizedProfile.achievements : (existing.achievements ?? []),
        // Ensure preferences always exist to satisfy the table schema validator.
        preferences: incoming.preferences ?? existing.preferences ?? {
          autoSend: false,
          rateLimits: undefined,
          tonePreference: "neutral",
          writingStyle: "conversational",
        },
        updatedAt: now,
      };
 
      await ctx.db.patch(existing._id, merged as any);
      return { profileId: args.profileId, convexId: existing._id, updatedAt: merged.updatedAt, written: true };
    } else {
      const doc: any = {
        profileId: args.profileId,
        idempotencyKeys: args.idempotencyKey ? [args.idempotencyKey] : [],
        ...(normalizedProfile.name !== undefined && { name: normalizedProfile.name }),
        email: normalizedProfile.email,
        ...(normalizedProfile.summary !== undefined && { summary: normalizedProfile.summary }),
        ...(normalizedProfile.languages !== undefined && { languages: normalizedProfile.languages }),
        ...(normalizedProfile.contact !== undefined && { contact: normalizedProfile.contact }),
        skills: normalizedProfile.skills,
        keywords: resolveCanonicalProfileKeywordsForWrite({
          nextKeywords:
            normalizedProfile.keywords.length > 0
              ? normalizedProfile.keywords
              : undefined,
          summary: normalizedProfile.summary,
          skills: normalizedProfile.skills,
          experience: normalizedProfile.experience,
        }),
        experience: normalizedProfile.experience,
        education: normalizedProfile.education,
        achievements: normalizedProfile.achievements,
        // Default preferences to satisfy schema if caller did not provide them.
        preferences: incoming.preferences ?? {
          autoSend: false,
          rateLimits: undefined,
          tonePreference: "neutral",
          writingStyle: "conversational",
        },
        version: args.version ?? 1,
        createdAt: now,
        updatedAt: normalizedProfile.updatedAt,
      };
      const convexId = await ctx.db.insert("userProfiles", doc as any);
      return { profileId: args.profileId, convexId, updatedAt: normalizedProfile.updatedAt, written: true };
    }
  },
});
