import type { ProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";

export type ProposalSourceSummary = {
  role: string | null;
  company: string | null;
  location: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  responsibilities: string[];
  keywords: string[];
  toneCues: string[];
};

const KEYWORD_STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "along",
  "also",
  "and",
  "applicant",
  "are",
  "build",
  "building",
  "candidate",
  "company",
  "create",
  "drive",
  "description",
  "from",
  "for",
  "have",
  "help",
  "ideal",
  "into",
  "join",
  "job",
  "looking",
  "must",
  "need",
  "needs",
  "our",
  "role",
  "support",
  "team",
  "their",
  "they",
  "this",
  "through",
  "the",
  "with",
  "work",
  "working",
  "your",
]);

const LOW_SIGNAL_KEYWORDS = new Set([
  "audiences",
  "dedicated",
  "external",
  "fields",
  "flagged",
  "gain",
  "independent",
  "issue",
  "issues",
  "later",
  "offer",
  "offers",
  "original",
  "review",
  "thrive",
  "visibility",
]);

const KEYWORD_ALLOWLIST = new Set([
  "api",
  "apis",
  "b2b",
  "b2c",
  "crm",
  "erp",
  "figma",
  "seo",
  "sql",
  "ux",
  "ui",
]);

const LOCATION_REJECT_TOKENS = new Set([
  "analytics",
  "automation",
  "business",
  "campaign",
  "communications",
  "community",
  "data",
  "design",
  "digital",
  "engineering",
  "finance",
  "health",
  "healthcare",
  "innovative",
  "innovation",
  "legal",
  "manufacturing",
  "marketing",
  "medicine",
  "operations",
  "pharma",
  "platform",
  "policy",
  "product",
  "quality",
  "research",
  "sales",
  "science",
  "stakeholder",
  "strategy",
  "support",
  "systems",
  "technology",
]);

const REMOTE_LOCATION_PATTERN = /\b(remote|hybrid|on-site|onsite)\b/i;
const PLACE_SEGMENT_PATTERN =
  /^(?:[A-Z][A-Za-z.'’-]+|[A-Z]{2,3})(?:[\s-](?:[A-Z][A-Za-z.'’-]+|[A-Z]{2,3}))*$/;

function normalizeWhitespace(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function splitMetadataLines(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabeledValue(value: string, labels: string[]): string | null {
  const labelPattern = labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  for (const line of splitMetadataLines(value)) {
    const match = line.match(
      new RegExp(`^(?:${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i"),
    );
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return null;
}

function extractRole(rawJobDescription: string): string | null {
  return extractLabeledValue(rawJobDescription, [
    "role",
    "job title",
    "position",
    "title",
  ]);
}

function titleCaseKeyword(value: string): string {
  if (value.toUpperCase() === value && value.length <= 5) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function sanitizeProposalCompanyName(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const wordCount = normalized.split(/\s+/).length;
  const sentenceLike =
    /[.!?]/.test(normalized) ||
    /\b(?:our|we|you|your|hq|headquarters|situated|located|position|application|provided|coverage|benefits?|medical|dental|insurance|salary|compensation)\b/i.test(
      normalized,
    );

  if (sentenceLike || wordCount > 5) {
    return null;
  }

  if (/^(?:hr|human resources)$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractCompany(rawJobDescription: string): string | null {
  const labeledValue = extractLabeledValue(rawJobDescription, [
    "company",
    "employer",
    "organization",
    "organisation",
  ]);
  if (labeledValue) {
    return sanitizeProposalCompanyName(labeledValue);
  }

  const normalized = normalizeWhitespace(rawJobDescription);
  const contextMatch = normalized.match(
    /\b(?:[Jj]oin|[Aa]t|[Ww]ith|[Ff]or)\s+([A-Z][A-Za-z0-9&.'’ -]{2,52}?)(?=\s+(?:in|to|that|who|where|as)\b|[.,;:]|$)/,
  );
  return sanitizeProposalCompanyName(contextMatch?.[1] ?? null);
}

function normalizePlaceLikeValue(value: string | null): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const wordCount = normalized.split(/\s+/).length;
  if (wordCount > 6) {
    return null;
  }

  return normalized;
}

function containsRejectedLocationToken(value: string): boolean {
  return (
    value
      .toLowerCase()
      .match(/[a-z][a-z'-]+/g)
      ?.some((token) => LOCATION_REJECT_TOKENS.has(token)) ?? false
  );
}

function hasPlaceShape(value: string): boolean {
  const normalized = normalizeWhitespace(value).replace(/[()]/g, "");
  if (!normalized) {
    return false;
  }

  if (REMOTE_LOCATION_PATTERN.test(normalized)) {
    return true;
  }

  const segments = normalized
    .split(",")
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);
  const candidateSegments = segments.length > 0 ? segments : [normalized];

  return candidateSegments.every((segment) => {
    const compact = segment.replace(/\b(?:remote|hybrid|on-site|onsite)\b/gi, "").trim();
    if (!compact) {
      return true;
    }

    const tokenCount = compact.split(/\s+/).length;
    if (tokenCount > 3) {
      return false;
    }

    return PLACE_SEGMENT_PATTERN.test(compact);
  });
}

function isHighConfidenceLocation(
  value: string | null,
  options: { allowSingleSegment?: boolean } = {},
): string | null {
  const normalized = normalizePlaceLikeValue(value);
  if (!normalized) {
    return null;
  }

  if (REMOTE_LOCATION_PATTERN.test(normalized)) {
    return normalized;
  }

  if (containsRejectedLocationToken(normalized)) {
    return null;
  }

  if (!options.allowSingleSegment && !normalized.includes(",")) {
    return null;
  }

  return hasPlaceShape(normalized) ? normalized : null;
}

function extractLocation(rawJobDescription: string): string | null {
  const normalized = normalizeWhitespace(rawJobDescription);
  const remoteMatch = normalized.match(REMOTE_LOCATION_PATTERN);
  if (remoteMatch?.[1]) {
    return normalizeWhitespace(remoteMatch[1]);
  }

  const labeledValue = extractLabeledValue(rawJobDescription, [
    "location",
    "city",
    "based in",
    "located in",
    "work model",
    "workplace",
  ]);
  const normalizedLabeledValue = isHighConfidenceLocation(labeledValue, {
    allowSingleSegment: true,
  });
  if (normalizedLabeledValue) {
    return normalizedLabeledValue;
  }

  const company = extractCompany(rawJobDescription);
  if (company) {
    const companyContextMatch = normalized.match(
      new RegExp(
        `${escapeRegExp(company)}\\s+in\\s+([A-Z][A-Za-z.'’-]+(?:[\\s-][A-Z][A-Za-z.'’-]+){0,2}(?:,\\s*[A-Z][A-Za-z.'’-]+(?:[\\s-][A-Z][A-Za-z.'’-]+){0,2})?)(?=\\s+(?:to|and|where|while|with|for|who|that)\\b|[.;]|$)`,
      ),
    );
    const contextualCompanyLocation = isHighConfidenceLocation(
      companyContextMatch?.[1] ?? null,
      { allowSingleSegment: true },
    );
    if (contextualCompanyLocation) {
      return contextualCompanyLocation;
    }
  }

  const contextMatch = normalized.match(
    /\b(?:[Bb]ased in|[Ll]ocated in|[Ww]orking from|[Pp]osition in)\s+([A-Z][A-Za-z.'’-]+(?:[\s-][A-Z][A-Za-z.'’-]+){0,2}(?:,\s*[A-Z][A-Za-z.'’-]+(?:[\s-][A-Z][A-Za-z.'’-]+){0,2})?)(?=\s+(?:to|and|where|while|with|for|who|that)\b|[.;]|$)/,
  );
  return isHighConfidenceLocation(contextMatch?.[1] ?? null, {
    allowSingleSegment: true,
  });
}

function extractCity(rawJobDescription: string, location: string | null): string | null {
  const labeledValue = extractLabeledValue(rawJobDescription, ["city", "town"]);
  if (labeledValue) {
    return isHighConfidenceLocation(labeledValue, {
      allowSingleSegment: true,
    });
  }

  if (!location) {
    return null;
  }

  if (/^(remote|hybrid|on-site|onsite)$/i.test(location)) {
    return null;
  }

  const [firstSegment] = location.split(",");
  return isHighConfidenceLocation(firstSegment ?? null, {
    allowSingleSegment: true,
  });
}

function extractAddress(rawJobDescription: string): string | null {
  return extractLabeledValue(rawJobDescription, [
    "address",
    "office address",
    "headquarters",
  ]);
}

function extractEmail(rawJobDescription: string): string | null {
  const labeledValue = extractLabeledValue(rawJobDescription, [
    "email",
    "contact email",
    "contact",
  ]);
  const labeledEmail = labeledValue?.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  )?.[0];
  if (labeledEmail) {
    return labeledEmail;
  }

  return (
    rawJobDescription.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ??
    null
  );
}

function extractPhone(rawJobDescription: string): string | null {
  const labeledValue = extractLabeledValue(rawJobDescription, [
    "phone",
    "telephone",
    "mobile",
    "contact phone",
  ]);
  const candidateMatches = [labeledValue].filter(Boolean) as string[];

  for (const line of splitMetadataLines(rawJobDescription)) {
    if (!/\b(phone|telephone|tel|mobile|call|contact)\b/i.test(line)) {
      continue;
    }
    const contextualPhone =
      line.match(
        /(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{2,4}\)?[\s().-]*){2,5}\d{2,4}/,
      )?.[0] ?? null;
    if (contextualPhone) {
      candidateMatches.push(contextualPhone);
    }
  }

  for (const candidate of candidateMatches) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) {
      return normalizeWhitespace(candidate);
    }
  }

  return null;
}

function splitResponsibilityCandidates(jobDescription: string): string[] {
  return jobDescription
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((chunk) => chunk.replace(/^[-*•]\s*/, "").trim())
    .map((chunk) => chunk.replace(/\s+/g, " "))
    .filter((chunk) => chunk.length >= 30);
}

function extractResponsibilities(jobDescription: string): string[] {
  const seen = new Set<string>();

  return splitResponsibilityCandidates(jobDescription)
    .filter((chunk) => {
      const normalized = chunk.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return !/^about\b/i.test(chunk);
    })
    .slice(0, 4);
}

function collectExcludedKeywordTokens(values: Array<string | null | undefined>): Set<string> {
  const excluded = new Set<string>();

  values.forEach((value) => {
    const tokens = normalizeWhitespace(value)
      .match(/[A-Za-z][A-Za-z+./-]{2,}/g)
      ?.map((token) => token.toLowerCase()) ?? [];

    tokens.forEach((token) => excluded.add(token));
  });

  return excluded;
}

function extractKeywords(
  jobDescription: string,
  jobTitle: string,
  excludedValues: Array<string | null | undefined>,
): string[] {
  const frequency = new Map<string, number>();
  const sourceText = `${jobTitle} ${jobDescription}`;
  const tokens = sourceText.match(/[A-Za-z][A-Za-z+./-]{2,}/g) ?? [];
  const titleTokens = jobTitle.match(/[A-Za-z][A-Za-z+./-]{2,}/g) ?? [];
  const excludedTokens = collectExcludedKeywordTokens(excludedValues);

  tokens.forEach((token) => {
    const normalized = token.toLowerCase();
    if (KEYWORD_STOPWORDS.has(normalized) || excludedTokens.has(normalized)) {
      return;
    }
    frequency.set(normalized, (frequency.get(normalized) ?? 0) + 1);
  });

  titleTokens.forEach((token) => {
    const normalized = token.toLowerCase();
    if (KEYWORD_STOPWORDS.has(normalized) || excludedTokens.has(normalized)) {
      return;
    }
    frequency.set(normalized, (frequency.get(normalized) ?? 0) + 2);
  });

  return [...frequency.entries()]
    .filter(([keyword, score]) => {
      if (LOW_SIGNAL_KEYWORDS.has(keyword)) {
        return false;
      }
      if (KEYWORD_ALLOWLIST.has(keyword)) {
        return true;
      }
      if (keyword.length < 4) {
        return false;
      }
      if (score < 2 && keyword.length < 6) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 6)
    .map(([keyword]) => titleCaseKeyword(keyword));
}

function extractToneCues(
  jobDescription: string,
  voicePreset: ProposalVoicePreset | null | undefined,
): string[] {
  const cues = new Set<string>();
  const normalized = jobDescription.toLowerCase();
  const presetCue =
    voicePreset === "signature"
      ? "Natural"
      : voicePreset === "expert"
        ? "Formal"
        : voicePreset === "engaging"
          ? "Warm"
          : null;
  const shouldIncludePresetCue =
    Boolean(presetCue) &&
    normalized.split(/\s+/).filter(Boolean).length >= 12;

  if (presetCue && shouldIncludePresetCue) {
    cues.add(presetCue);
  }

  if (/stakeholder|collabor|cross-functional|partner/.test(normalized)) {
    cues.add("Collaborative");
  }
  if (/detail|accuracy|precise|quality/.test(normalized)) {
    cues.add("Detail-oriented");
  }
  if (/ownership|own|drive|lead/.test(normalized)) {
    cues.add("Ownership");
  }
  if (/pace|deadline|rapid|fast/.test(normalized)) {
    cues.add("Fast-paced");
  }

  return [...cues].slice(0, 4);
}

export function buildProposalSourceSummary(args: {
  jobTitle: string;
  jobDescription: string;
  voicePreset?: ProposalVoicePreset | null;
}): ProposalSourceSummary {
  const jobTitle = normalizeWhitespace(args.jobTitle);
  const rawJobDescription =
    typeof args.jobDescription === "string" ? args.jobDescription.trim() : "";
  const jobDescription = normalizeWhitespace(rawJobDescription);
  const role = extractRole(rawJobDescription);
  const company = extractCompany(rawJobDescription);
  const location = extractLocation(rawJobDescription);
  const city = extractCity(rawJobDescription, location);
  const address = extractAddress(rawJobDescription);
  const email = extractEmail(rawJobDescription);
  const phone = extractPhone(rawJobDescription);

  return {
    role,
    company,
    location,
    city,
    address,
    email,
    phone,
    responsibilities: extractResponsibilities(rawJobDescription),
    keywords: extractKeywords(jobDescription, jobTitle, [
      jobTitle,
      company,
      location,
      city,
      address,
      email,
      phone,
    ]),
    toneCues: extractToneCues(jobDescription, args.voicePreset),
  };
}
