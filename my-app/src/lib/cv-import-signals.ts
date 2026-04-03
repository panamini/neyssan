import type {
  CvDocument,
  IExperienceItem,
  IProfileItem,
  ISummaryItem,
} from "../types/cvDocument";

export type CvImportSignal = {
  id: string;
  title: string;
  description: string;
};

const GENERIC_CV_TITLES = new Set([
  "cv",
  "resume",
  "curriculum vitae",
  "imported cv",
  "imported resume",
  "untitled cv",
  "untitled resume",
  "my cv",
  "my resume",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function extractLooseText(value: unknown): string {
  const parts: string[] = [];
  const visited = new Set<unknown>();

  function walk(node: unknown): void {
    if (node == null || visited.has(node)) {
      return;
    }
    if (typeof node === "object") {
      visited.add(node);
    }
    if (typeof node === "string") {
      const normalized = normalizeText(node);
      if (normalized) {
        parts.push(normalized);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      Object.entries(node as Record<string, unknown>).forEach(([key, entry]) => {
        if (
          key === "id" ||
          key === "type" ||
          key === "attrs" ||
          key === "attributes" ||
          key === "order" ||
          key === "collapsed" ||
          key === "precision" ||
          key === "title"
        ) {
          return;
        }
        walk(entry);
      });
    }
  }

  walk(value);
  return normalizeText(parts.join(" "));
}

function looksLikePlaceholder(value: string): boolean {
  return /(?:not set|tbd|n\/a|unknown|placeholder)/i.test(value);
}

function normalizeComparisonText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looksLikeGenericCvTitle(value: string): boolean {
  const normalized = normalizeComparisonText(value);
  if (!normalized) {
    return false;
  }

  if (GENERIC_CV_TITLES.has(normalized)) {
    return true;
  }

  return /^(imported|parsed|uploaded|generated)\s+(cv|resume)$/.test(
    normalized,
  );
}

function looksLikePlaceholderContent(value: string): boolean {
  if (!value) {
    return false;
  }

  return /(?:lorem ipsum|placeholder|summary here|insert .* here|write .* here|to be completed|coming soon)/i.test(
    value,
  );
}

function looksAllCapsContent(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized || normalized.split(/\s+/).length < 4) {
    return false;
  }

  const letters = normalized.match(/[A-Za-z]/g) ?? [];
  if (letters.length < 18) {
    return false;
  }

  const uppercaseLetters = normalized.match(/[A-Z]/g) ?? [];
  return uppercaseLetters.length / letters.length >= 0.82;
}

function hasMeaningfulExperienceContent(experience: IExperienceItem | undefined): boolean {
  if (!experience) {
    return false;
  }

  const startDate = normalizeText(experience.startDate);
  const endDate = normalizeText(experience.endDate);

  return (
    normalizeText(experience.company).length > 0 ||
    normalizeText(experience.position).length > 0 ||
    normalizeText(experience.location).length > 0 ||
    extractLooseText(
      experience.responsibilities ??
        experience.description ??
        experience.achievements,
    ).length > 0 ||
    (startDate.length > 0 && startDate !== "1970-01-01T00:00:00.000Z") ||
    endDate.length > 0 ||
    experience.isCurrent === true ||
    experience.currentlyWorking === true
  );
}

function looksLikeNameNoise(value: string): boolean {
  if (!value) {
    return false;
  }
  if (/@|https?:\/\/|www\./i.test(value)) {
    return true;
  }
  if (/\d{2,}/.test(value)) {
    return true;
  }
  if (value.split(/\s+/).length > 6) {
    return true;
  }
  return /\b(resume|curriculum|profile|security guard|experience|education)\b/i.test(
    value,
  );
}

function looksRepeated(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.length < 80) {
    return false;
  }
  const midpoint = Math.floor(normalized.length / 2);
  const left = normalized.slice(0, midpoint).trim();
  const right = normalized.slice(midpoint).trim();
  if (left && right && left === right) {
    return true;
  }

  const sentenceMatches = normalized.match(/[^.!?]+[.!?]?/g) ?? [];
  const seen = new Set<string>();
  for (const rawSentence of sentenceMatches) {
    const sentence = rawSentence.replace(/\s+/g, " ").trim();
    if (sentence.length < 24) {
      continue;
    }
    if (seen.has(sentence)) {
      return true;
    }
    seen.add(sentence);
  }

  return false;
}

export function inspectCvImportSignals(
  cv: CvDocument | null | undefined,
): CvImportSignal[] {
  if (!cv) {
    return [];
  }

  const profileSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => section.type === "profile")
    : undefined;
  const summarySection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => section.type === "summary")
    : undefined;
  const experienceSection = Array.isArray(cv.sections)
    ? cv.sections.find((section) => section.type === "experience")
    : undefined;

  const profileItem = Array.isArray(profileSection?.structuredContent)
    ? (profileSection.structuredContent[0] as IProfileItem | undefined)
    : undefined;
  const summaryItem = Array.isArray(summarySection?.structuredContent)
    ? (summarySection.structuredContent[0] as ISummaryItem | undefined)
    : undefined;
  const experiences = Array.isArray(experienceSection?.structuredContent)
    ? (experienceSection.structuredContent as IExperienceItem[])
    : [];

  const profileName = normalizeText(profileItem?.name);
  const desiredPosition = normalizeText(profileItem?.desiredPosition);
  const documentTitle = normalizeText(cv.title);
  const summaryText = extractLooseText(summaryItem?.summary ?? cv.summary);
  const signals: CvImportSignal[] = [];

  if (documentTitle && looksLikeGenericCvTitle(documentTitle)) {
    signals.push({
      id: "document-title-generic",
      title: "Resume title looks generic",
      description:
        "The imported document title still looks system-generated. Rename it so the saved profile is easier to trust and find later.",
    });
  }

  if (profileName && looksLikeNameNoise(profileName)) {
    signals.push({
      id: "profile-name-noise",
      title: "Check the imported name",
      description:
        "The profile name looks like combined resume text rather than a clean person name.",
    });
  }

  if (summaryText) {
    if (looksRepeated(summaryText)) {
      signals.push({
        id: "summary-repeated",
        title: "Summary may contain repeated text",
        description:
          "The imported summary looks duplicated or over-merged. Trim it before generating proposals.",
      });
    } else if (
      /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(summaryText) &&
      summaryText.length > 160
    ) {
      signals.push({
        id: "summary-noisy",
        title: "Summary may include timeline debris",
        description:
          "The summary reads like stitched experience fragments rather than a concise professional overview.",
      });
    }
  }

  const primaryExperience = experiences[0];
  const primaryCompany = normalizeText(primaryExperience?.company);
  const primaryTitle = normalizeText(primaryExperience?.position);
  const primaryDescription = extractLooseText(
    primaryExperience?.responsibilities ??
      primaryExperience?.description ??
      primaryExperience?.achievements,
  );
  const hasMeaningfulProfile = profileName.length > 0 || desiredPosition.length > 0;
  const hasMeaningfulSummary = summaryText.length > 0;
  const hasMeaningfulExperience = experiences.some(hasMeaningfulExperienceContent);

  if (
    !hasMeaningfulProfile &&
    !hasMeaningfulSummary &&
    !hasMeaningfulExperience
  ) {
    signals.push({
      id: "document-template-skeleton",
      title: "Imported CV still looks like a blank skeleton",
      description:
        "The document still has empty core sections. Fill the profile, summary, and experience before trusting it for proposals.",
    });
  }

  if (
    documentTitle &&
    primaryTitle &&
    normalizeComparisonText(documentTitle) ===
      normalizeComparisonText(primaryTitle)
  ) {
    signals.push({
      id: "document-title-role-duplicate",
      title: "Resume title may mirror the first role",
      description:
        "The saved CV title matches the first experience role. This often means the parser used a job title instead of a real document name.",
    });
  }

  if (
    profileName &&
    primaryCompany &&
    primaryCompany.toLowerCase() === profileName.toLowerCase()
  ) {
    signals.push({
      id: "experience-company-name-match",
      title: "Company name may be misparsed",
      description:
        "The first experience company matches the candidate name, which usually means the parser merged fields incorrectly.",
    });
  }

  if (
    primaryCompany &&
    primaryTitle &&
    /guard|manager|engineer|assistant|designer|developer|analyst|specialist/i.test(
      primaryCompany,
    ) &&
    !/inc|ltd|llc|corp|company|studio|group|school|agency|university|hospital/i.test(
      primaryCompany,
    )
  ) {
    signals.push({
      id: "experience-title-company-inversion",
      title: "Role and company may be inverted",
      description:
        "The company field looks like a job title. Review the first experience entry before using it for personalization.",
    });
  }

  if (
    looksLikePlaceholder(normalizeText(primaryExperience?.startDate)) ||
    looksLikePlaceholder(normalizeText(primaryExperience?.endDate))
  ) {
    signals.push({
      id: "experience-placeholder-dates",
      title: "Experience dates need cleanup",
      description:
        "One or more imported dates look like placeholders. Replace them so proposal details stay credible.",
    });
  }

  if (
    experiences.some((experience) => {
      const startDate = normalizeText(experience?.startDate);
      const endDate = normalizeText(experience?.endDate);
      return !startDate && !endDate;
    })
  ) {
    signals.push({
      id: "experience-missing-dates",
      title: "Some experience dates are missing",
      description:
        "One or more imported roles do not have any dates yet. Add them before using the CV for personalization.",
    });
  }

  if (primaryDescription && looksRepeated(primaryDescription)) {
    signals.push({
      id: "experience-description-duplicate",
      title: "Experience description may be duplicated",
      description:
        "The first experience description appears to repeat itself, which usually comes from noisy PDF extraction.",
    });
  }

  if (
    (summaryText && looksLikePlaceholderContent(summaryText)) ||
    (primaryDescription && looksLikePlaceholderContent(primaryDescription))
  ) {
    signals.push({
      id: "content-placeholder-copy",
      title: "Some imported text still looks like placeholder copy",
      description:
        "Part of the summary or experience content still reads like filler text. Replace it before generating proposals.",
    });
  }

  if (
    (summaryText && looksAllCapsContent(summaryText)) ||
    (primaryDescription && looksAllCapsContent(primaryDescription))
  ) {
    signals.push({
      id: "content-all-caps",
      title: "Imported content may be shouting",
      description:
        "Some imported text is mostly uppercase, which usually comes from extraction noise and should be normalized.",
    });
  }

  return signals;
}
