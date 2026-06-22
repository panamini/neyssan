import type { IExperienceItem, IExperienceDiagnostics } from "./cvMapper";
import { isTemplateNoiseLine, SECTION_TOKEN_RE, isValidLocationCandidate } from "./mapping_utils";

const KNOWN_HEADINGS = new Set([
  "SUMMARY",
  "PROFILE",
  "SKILLS",
  "LANGUAGES",
  "EXPERIENCE",
  "EDUCATION",
  "HOBBIES",
  "INTERESTS",
  "LINKS",
  "DETAILS",
  "CONTACT",
]);

const ACHIEVEMENT_LIMIT = 8;

type CanonicalSummary = {
  text?: string;
  confidence?: number;
} | null;

type CanonicalProfile = Record<string, unknown> & { location?: string | null };

type DiagnosticsValidation = {
  warnings?: string[];
  counts?: Record<string, number>;
  needsReview?: Record<string, boolean>;
} | undefined;

type DiagnosticsPayload = {
  debleed_removed_count?: Record<string, number>;
  validation?: DiagnosticsValidation;
  [key: string]: unknown;
};

type NormalizedExperienceEntry = IExperienceItem & { responsibilityBullets?: string[] | null };

type CanonicalNormalized = {
  summary?: CanonicalSummary;
  experience?: NormalizedExperienceEntry[] | null;
  profile?: CanonicalProfile | null;
  [key: string]: unknown;
};

function normalizeText(value: string): string {
  return String(value || "").replace(/[\s\u00A0]+/g, " ").trim();
}

function isHeadingLine(value: string): boolean {
  const text = normalizeText(value).toUpperCase();
  if (!text) return false;
  if (!/^[A-Z\s]+$/.test(text)) return false;
  return KNOWN_HEADINGS.has(text);
}

function isExperienceArray(value: CanonicalNormalized["experience"]): value is NormalizedExperienceEntry[] {
  return Array.isArray(value);
}

function filterDebleedLine(line: string, tracker: { removed: number }): boolean {
  const normalized = normalizeText(line);
  if (!normalized) {
    tracker.removed += 1;
    return false;
  }
  if (isTemplateNoiseLine(normalized)) {
    tracker.removed += 1;
    return false;
  }
  if (SECTION_TOKEN_RE.test(normalized)) {
    tracker.removed += 1;
    return false;
  }
  if (isHeadingLine(normalized)) {
    tracker.removed += 1;
    return false;
  }
  return true;
}

function rebuildExperienceContent(entry: IExperienceItem): void {
  const segments: string[] = [];
  const headerParts: string[] = [];
  if (entry.position) headerParts.push(normalizeText(entry.position));
  if (entry.company) headerParts.push(normalizeText(entry.company));
  const headerLine = headerParts.filter(Boolean).join(" — ");
  const rangeText = entry.startDate ? `${entry.startDate} — ${entry.endDate ?? "Present"}` : "";
  const composed = [headerLine, rangeText].filter(Boolean).join(" | ");
  if (composed) segments.push(composed);
  if (entry.location) segments.push(normalizeText(entry.location));
  if (Array.isArray(entry.responsibilities)) segments.push(...entry.responsibilities);
  if (Array.isArray(entry.achievements)) segments.push(...entry.achievements);
  entry.content = segments.join("\n").trim();
}

function monthIndex(value: string | null | undefined): number | null {
  if (!value) return null;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr ?? "1");
  if (!Number.isFinite(year)) return null;
  const monthIdx = Number.isFinite(month) ? month : 1;
  return year * 12 + (monthIdx - 1);
}

export function applyFinalValidation(normalized: CanonicalNormalized, diagnostics: DiagnosticsPayload): void {
  if (!diagnostics || typeof diagnostics !== "object") return;
  const debleedCounts: Record<string, number> = typeof diagnostics.debleed_removed_count === "object" && diagnostics.debleed_removed_count !== null
    ? { ...(diagnostics.debleed_removed_count) }
    : {};
  const validationSection = diagnostics.validation;
  const warnings: string[] = Array.isArray(validationSection?.warnings)
    ? [...validationSection.warnings]
    : [];
  const needsReview: Record<string, boolean> = validationSection?.needsReview
    ? { ...validationSection.needsReview }
    : {};
  const validationCounts: Record<string, number> = validationSection?.counts
    ? { ...validationSection.counts }
    : {};

  let summaryLength: number | undefined;
  if (normalized?.summary?.text) {
    const tracker = { removed: 0 };
    const lines = String(normalized.summary.text)
      .split(/\n+/)
      .filter((line: string) => filterDebleedLine(line, tracker));
    normalized.summary.text = lines.join("\n").trim();
    if (tracker.removed > 0) {
      debleedCounts.summary = (debleedCounts.summary ?? 0) + tracker.removed;
    }
    summaryLength = normalized.summary.text.length;
    const summaryConfidence = Number(normalized.summary?.confidence ?? 0);
    if (summaryLength > 0 && summaryLength < 120 && summaryConfidence >= 0.6) {
      if (!warnings.includes("summary_below_threshold")) warnings.push("summary_below_threshold");
      needsReview.summary = true;
    }
  }

  let experienceRemoved = 0;
  let achievementsDeduped = 0;
  const experienceEntries: NormalizedExperienceEntry[] = isExperienceArray(normalized.experience)
    ? normalized.experience
    : [];

  if (experienceEntries.length) {
    for (const entry of experienceEntries) {
      if (!Array.isArray(entry.responsibilities) && Array.isArray(entry.responsibilityBullets)) {
        entry.responsibilities = [...entry.responsibilityBullets];
      }
      const trackerResp = { removed: 0 };
      const trackerAch = { removed: 0 };
      if (Array.isArray(entry.responsibilities)) {
        entry.responsibilities = entry.responsibilities
          .map((line: string) => normalizeText(line))
          .filter((line: string) => filterDebleedLine(line, trackerResp));
      }
      if (Array.isArray(entry.achievements)) {
        entry.achievements = entry.achievements
          .map((line: string) => normalizeText(line))
          .filter((line: string) => filterDebleedLine(line, trackerAch));
      }
      experienceRemoved += trackerResp.removed + trackerAch.removed;

      let dedupDuplicates = 0;
      if (Array.isArray(entry.achievements)) {
        const deduped: string[] = [];
        const seen = new Set<string>();
        for (const ach of entry.achievements) {
          const key = ach.toLowerCase();
          if (seen.has(key)) {
            achievementsDeduped += 1;
            dedupDuplicates += 1;
            continue;
          }
          seen.add(key);
          deduped.push(ach);
          if (deduped.length >= ACHIEVEMENT_LIMIT) break;
        }
        entry.achievements = deduped;
      }

      rebuildExperienceContent(entry);

      if (!entry.diagnostics) {
        const diagnosticsTemplate: IExperienceDiagnostics = {
          header_signals: {
            match: "none",
            titleFound: Boolean(entry.position),
            orgFound: Boolean(entry.company),
            locFound: Boolean(entry.location),
            dateFound: Boolean(entry.startDate || entry.endDate != null),
          },
          date_range: {
            start: entry.startDate,
            end: entry.endDate ?? null,
            confidence: entry.dateConfidence ?? null,
          },
          counts: {
            responsibilities: Array.isArray(entry.responsibilities) ? entry.responsibilities.length : 0,
            achievements: Array.isArray(entry.achievements) ? entry.achievements.length : 0,
            droppedDuplicates: trackerResp.removed + trackerAch.removed + dedupDuplicates,
          },
          summarySource: entry.summarySource ?? null,
        };
        entry.diagnostics = diagnosticsTemplate;
      } else {
        const counts = entry.diagnostics.counts ?? { responsibilities: 0, achievements: 0, droppedDuplicates: 0 };
        entry.diagnostics.counts = {
          responsibilities: Array.isArray(entry.responsibilities) ? entry.responsibilities.length : 0,
          achievements: Array.isArray(entry.achievements) ? entry.achievements.length : 0,
          droppedDuplicates: (counts.droppedDuplicates ?? 0) + trackerResp.removed + trackerAch.removed + dedupDuplicates,
        };
        entry.diagnostics.summarySource = entry.summarySource ?? entry.diagnostics.summarySource ?? null;
      }

      if (!entry.company && !entry.position) {
        needsReview.entryHeader = true;
        if (!warnings.includes("experience_missing_header")) warnings.push("experience_missing_header");
      }
    }
  }
  if (experienceRemoved > 0) {
    debleedCounts.experience = (debleedCounts.experience ?? 0) + experienceRemoved;
  }

  if (!normalized.profile) normalized.profile = {};
  const profileLocation = normalized.profile?.location;
  if (typeof profileLocation === "string" && !isValidLocationCandidate(profileLocation)) {
    normalized.profile.location = undefined;
    needsReview.profileLocation = true;
    if (!warnings.includes("invalid_profile_location")) warnings.push("invalid_profile_location");
  }

  // Overlap detection per organization
  if (experienceEntries.length) {
    const byOrg = new Map<string, Array<{ start: number | null; end: number | null }>>();
    for (const entry of experienceEntries) {
      const orgKey = entry.company ? String(entry.company).toLowerCase() : null;
      if (!orgKey) continue;
      const startIdx = monthIndex(entry.startDate ?? null);
      const endIdx = entry.endDate === null ? Number.POSITIVE_INFINITY : monthIndex(entry.endDate ?? null);
      if (!byOrg.has(orgKey)) byOrg.set(orgKey, []);
      byOrg.get(orgKey)!.push({ start: startIdx, end: endIdx });
    }
    let overlapCount = 0;
    for (const [, ranges] of byOrg.entries()) {
      const filtered = ranges.filter((r) => r.start !== null);
      filtered.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
      for (let i = 1; i < filtered.length; i += 1) {
        const prev = filtered[i - 1];
        const curr = filtered[i];
        if (prev.end == null || curr.start == null) continue;
        const prevEnd = prev.end ?? Number.POSITIVE_INFINITY;
        const currStart = curr.start ?? Number.POSITIVE_INFINITY;
        if (prevEnd >= currStart) {
          overlapCount += 1;
          if (!warnings.includes("experience_date_overlap")) warnings.push("experience_date_overlap");
          needsReview.dateOverlap = true;
          break;
        }
      }
    }
    if (overlapCount > 0) {
      validationCounts.overlapWarnings = (validationCounts.overlapWarnings ?? 0) + overlapCount;
    }
  }

  validationCounts.achievementsDeduped = (validationCounts.achievementsDeduped ?? 0) + achievementsDeduped;
  if (typeof summaryLength === "number") {
    validationCounts.summaryLength = summaryLength;
  }

  diagnostics.debleed_removed_count = debleedCounts;
  diagnostics.validation = {
    warnings,
    counts: validationCounts,
    needsReview,
  };
}
