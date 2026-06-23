/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
const CONTACT_REGEX = /(@|https?:\/\/|www\.|linkedin|github|portfolio|\||\+?\d[\d\s().-]{5,})/i;
const PLACEHOLDER_REGEX = /^(pdf|image)\s*bytes?/i;

function sanitize(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

function isContactLike(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return CONTACT_REGEX.test(trimmed);
}

function looksLikeSentence(value: string): boolean {
  if (!/[.!?]/.test(value)) {
    return false;
  }
  if (!/\b[a-zA-Z]{2,}\b/.test(value)) {
    return false;
  }
  if (/@|https?:\/\/|www\./i.test(value)) {
    return false;
  }
  return /[.!?]\s+[A-Z]/.test(value) || /[.!?]$/.test(value);
}

function buildExperienceLine(entry: any): string | null {
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.experience)) return null;
  const item = entry.experience.find((exp: any) => {
    const company = sanitize(exp?.company);
    const position = sanitize(exp?.position);
    return Boolean(company) && Boolean(position);
  });
  if (!item) return null;
  const company = sanitize(item.company);
  const position = sanitize(item.position);
  if (!company || !position) return null;
  return `${company} — ${position}`;
}

function buildEducationLine(entry: any): string | null {
  if (!entry || typeof entry !== "object" || !Array.isArray(entry.education)) return null;
  const item = entry.education.find((edu: any) => {
    const institution = sanitize(
      edu?.institution ?? edu?.school ?? edu?.university ?? edu?.organization
    );
    const degree = sanitize(edu?.degree ?? edu?.qualification ?? edu?.program);
    return Boolean(institution) && Boolean(degree);
  });
  if (!item) return null;
  const institution = sanitize(
    item?.institution ?? item?.school ?? item?.university ?? item?.organization
  );
  const degree = sanitize(item?.degree ?? item?.qualification ?? item?.program);
  if (!institution || !degree) return null;
  return `${institution} — ${degree}`;
}

function buildAchievementLine(entry: any): string | null {
  if (!entry || typeof entry !== "object") return null;
  const achievements = Array.isArray(entry.achievements)
    ? entry.achievements
    : entry.achievements?.items ?? [];
  if (!Array.isArray(achievements) || achievements.length === 0) return null;
  const first = achievements.find((ach: any) => {
    if (typeof ach === "string") return sanitize(ach).length > 0;
    if (ach && typeof ach === "object" && typeof ach.text === "string") {
      return sanitize(ach.text).length > 0;
    }
    return false;
  });
  if (!first) return null;
  return typeof first === "string" ? sanitize(first) : sanitize(first.text);
}

function cleanSentence(value: string): string {
  return value.replace(/^[,;:\-\|\s]+/, "").trim();
}

export function getCollapsedLine(entry: any, diagnostics?: any): string | null {
  if (!entry || typeof entry !== "object") return null;

  const experienceLine = buildExperienceLine(entry);
  if (experienceLine) {
    return cleanSentence(experienceLine);
  }

  const summaryTextRaw = sanitize(entry?.summary?.text ?? entry?.summaryFirstSentence ?? "");
  const summaryIsContact = isContactLike(summaryTextRaw);
  if (
    summaryTextRaw &&
    summaryTextRaw.length <= 180 &&
    !PLACEHOLDER_REGEX.test(summaryTextRaw) &&
    (!summaryIsContact || looksLikeSentence(summaryTextRaw))
  ) {
    const cleaned = cleanSentence(summaryTextRaw);
    if (cleaned) return cleaned;
  }

  const educationLine = buildEducationLine(entry);
  if (educationLine) {
    return cleanSentence(educationLine);
  }

  const achievementLine = buildAchievementLine(entry);
  if (achievementLine) {
    return cleanSentence(achievementLine);
  }

  const emptyReason = sanitize(diagnostics?.empty_reason ?? diagnostics?.error ?? "");
  if (emptyReason) {
    return cleanSentence(emptyReason);
  }

  return null;
}

export default getCollapsedLine;
