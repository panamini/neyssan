import {
  CanonicalCVSchema,
  CandidateSourceSchema,
  ConfidenceSummarySchema,
  FieldMetaSchema,
  TelemetryEventSchema,
  type CanonicalCV,
} from "../../../../src/schemas/canonicalCV.schema";
import type { z } from "zod";
import type {
  StrictEducationItem,
  StrictExperienceItem,
  StrictLanguageItem,
  StrictProfile,
  StrictSkillItem,
} from "../../schemas/profileStrict.schema";

type CandidateSource = z.infer<typeof CandidateSourceSchema>;
type FieldMeta = z.infer<typeof FieldMetaSchema>;
type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
type ConfidenceSummary = z.infer<typeof ConfidenceSummarySchema>;

type WorkArray = NonNullable<CanonicalCV["work"]>;
type EducationArray = NonNullable<CanonicalCV["education"]>;
type SkillArray = NonNullable<CanonicalCV["skills"]>;
type LanguageArray = NonNullable<CanonicalCV["languages"]>;

type ExperienceConf = NonNullable<StrictExperienceItem["confidences"]>;
type ExperienceProv = NonNullable<StrictExperienceItem["provenance"]>;
type EducationConf = NonNullable<StrictEducationItem["confidences"]>;
type EducationProv = NonNullable<StrictEducationItem["provenance"]>;
type SkillConf = NonNullable<StrictSkillItem["confidences"]>;
type SkillProv = NonNullable<StrictSkillItem["provenance"]>;
type LanguageConf = NonNullable<StrictLanguageItem["confidences"]>;
type LanguageProv = NonNullable<StrictLanguageItem["provenance"]>;

type WrapOptions = {
  conf?: number | null | undefined;
  source?: string | null | undefined;
  section?: string | null | undefined;
  bonusApplied?: boolean | null | undefined;
  traces?: FieldMeta["traces"];
};

type RecordedField<T> = {
  value: T | null;
  meta: FieldMeta;
};

const DEFAULT_SOURCE: CandidateSource = "unknown";

const clampConfidence = (conf?: number | null): number | null => {
  if (typeof conf !== "number" || Number.isNaN(conf)) return null;
  if (conf < 0) return 0;
  if (conf > 1) return 1;
  return conf;
};

const normaliseValue = <T>(value: T | null | undefined): T | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? (trimmed as unknown as T) : null;
  }
  return value;
};

const resolveSource = (
  source: string | null | undefined
): { base: CandidateSource; trace: string | null } => {
  if (!source) {
    return { base: DEFAULT_SOURCE, trace: null };
  }
  const trimmed = source.trim();
  if (!trimmed) {
    return { base: DEFAULT_SOURCE, trace: null };
  }
  const [primary, ...rest] = trimmed.split(":");
  const baseCandidate = primary.trim() || trimmed;
  const parsed = CandidateSourceSchema.safeParse(baseCandidate);
  if (parsed.success) {
    const subtag = rest.length > 0 ? trimmed : null;
    return { base: parsed.data, trace: subtag };
  }
  const fallback = CandidateSourceSchema.safeParse(trimmed);
  if (fallback.success) {
    return { base: fallback.data, trace: null };
  }
  return { base: DEFAULT_SOURCE, trace: trimmed || null };
};

const cleanBulletLine = (input: unknown): string => {
  if (typeof input !== "string") return "";
  return input
    .replace(/^[\s•*+\-–—\d.)]+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;.!?])/g, "$1")
    .trim();
};

const normalizeHighlights = (input: unknown): string[] => {
  const raw: string[] = [];
  if (Array.isArray(input)) {
    raw.push(
      ...input
        .map((value) => (typeof value === "string" ? value : ""))
        .filter((value) => value.length > 0)
    );
  } else if (typeof input === "string") {
    raw.push(...input.split(/\r?\n+/));
  }
  if (!raw.length) return [];

  const merged: string[] = [];
  for (const entry of raw) {
    const cleaned = cleanBulletLine(entry);
    if (!cleaned) continue;
    if (merged.length > 0 && /^[a-z]/.test(cleaned)) {
      const lastIdx = merged.length - 1;
      merged[lastIdx] = `${merged[lastIdx]} ${cleaned}`.replace(/\s{2,}/g, " ").trim();
      continue;
    }
    merged.push(cleaned);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const line of merged) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }
  return deduped;
};

function wrapField<T>(
  value: T | null | undefined,
  options: WrapOptions,
  slot: string | null,
  telemetry: TelemetryEvent[],
  summary: ConfidenceSummary[]
): RecordedField<T> {
  const normalised = normaliseValue(value);
  const conf = clampConfidence(options.conf);
  const { base: resolvedSource, trace } = resolveSource(options.source);
  const meta: FieldMeta = {
    source: resolvedSource,
  };
  if (conf !== null) meta.conf = conf;
  if (options.section != null) meta.section = options.section ?? null;
  if (options.bonusApplied !== undefined) meta.bonusApplied = options.bonusApplied ?? undefined;
  const traces: FieldMeta["traces"] = options.traces ? [...options.traces] : [];
  if (trace) {
    traces?.push({
      value: trace,
      conf,
      source: resolvedSource,
      section: meta.section ?? null,
    });
  }
  if (traces && traces.length > 0) {
    meta.traces = traces;
  }

  if (slot) {
    telemetry.push({
      slot,
      winnerSource: meta.source,
      winnerConf: meta.conf ?? null,
      bonusApplied: meta.bonusApplied ?? undefined,
      section: meta.section ?? undefined,
    });
    summary.push({
      slot,
      conf: meta.conf ?? null,
      source: meta.source,
    });
  }

  return {
    value: normalised,
    meta,
  };
}

export function mapStrictProfileToCanonical(strict: StrictProfile): CanonicalCV {
  const telemetry: TelemetryEvent[] = [];
  const confidenceSummary: ConfidenceSummary[] = [];

  const rootConf = strict.confidences ?? {};
  const rootProv = strict.provenance ?? {};

  const basicsName = wrapField(strict.name, {
    conf: rootConf.name,
    source: rootProv.name?.source,
    section: rootProv.name?.section ?? "profile",
    bonusApplied: rootProv.name?.bonusApplied,
  }, "basics.name", telemetry, confidenceSummary);

  const basicsEmail = wrapField(strict.email, {
    conf: rootConf.email,
    source: rootProv.email?.source,
    section: rootProv.email?.section ?? "contact",
    bonusApplied: rootProv.email?.bonusApplied,
  }, "basics.email", telemetry, confidenceSummary);

  const basicsPhone = wrapField(strict.phone, {
    conf: rootConf.phone,
    source: rootProv.phone?.source,
    section: rootProv.phone?.section ?? "contact",
    bonusApplied: rootProv.phone?.bonusApplied,
  }, "basics.phone", telemetry, confidenceSummary);

  const locationFormatted = wrapField(strict.location, {
    conf: rootConf.location,
    source: rootProv.location?.source,
    section: rootProv.location?.section ?? "location",
    bonusApplied: rootProv.location?.bonusApplied,
  }, "basics.location.formatted", telemetry, confidenceSummary);

  const basics: CanonicalCV["basics"] = {
    name: basicsName,
    email: basicsEmail,
    phone: basicsPhone,
    location: {
      formatted: locationFormatted,
    },
  };

  const work = (strict.experience ?? []).map((item, index) =>
    mapExperienceItem(item as StrictExperienceItem, index, telemetry, confidenceSummary)
  );
  const education = (strict.education ?? []).map((item, index) =>
    mapEducationItem(item as StrictEducationItem, index, telemetry, confidenceSummary)
  );
  const skills = (strict.skills ?? []).map((item, index) =>
    mapSkillItem(item as StrictSkillItem, index, telemetry, confidenceSummary)
  );
  const languages = (strict.languages ?? []).map((item, index) =>
    mapLanguageItem(item as StrictLanguageItem, index, telemetry, confidenceSummary)
  );

  const achievementsProv = rootProv.achievements;
  const achievements = (strict.achievements ?? []).map((text, index) =>
    wrapField(text, {
      conf: null,
      source: achievementsProv?.source,
      section: achievementsProv?.section ?? "achievements",
      bonusApplied: achievementsProv?.bonusApplied,
    }, `achievements[${index}]`, telemetry, confidenceSummary)
  );

  const canonical: CanonicalCV = {
    basics,
    meta: {
      telemetry,
      confidenceSummary,
    },
  };

  canonical.work = work;
  canonical.education = education;
  canonical.skills = skills;
  canonical.languages = languages;
  canonical.achievements = achievements;

  return CanonicalCVSchema.parse(canonical);
}

function mapExperienceItem(
  item: StrictExperienceItem,
  index: number,
  telemetry: TelemetryEvent[],
  summary: ConfidenceSummary[]
): WorkArray[number] {
  const baseSlot = `work[${index}]`;
  const conf: Partial<ExperienceConf> = item.confidences ?? {};
  const prov: Partial<ExperienceProv> = item.provenance ?? {};

  const company = wrapField(item.company ?? null, {
    conf: conf.company,
    source: prov.company?.source,
    section: prov.company?.section ?? "experience",
    bonusApplied: prov.company?.bonusApplied,
  }, `${baseSlot}.company`, telemetry, summary);

  const position = wrapField(item.position ?? null, {
    conf: conf.position,
    source: prov.position?.source,
    section: prov.position?.section ?? "experience",
    bonusApplied: prov.position?.bonusApplied,
  }, `${baseSlot}.position`, telemetry, summary);

  const startDate = wrapField(item.startDate ?? null, {
    conf: conf.startDate,
    source: prov.startDate?.source,
    section: prov.startDate?.section ?? "experience",
    bonusApplied: prov.startDate?.bonusApplied,
  }, `${baseSlot}.startDate`, telemetry, summary);

  const endDate = wrapField(item.endDate ?? null, {
    conf: conf.endDate,
    source: prov.endDate?.source,
    section: prov.endDate?.section ?? "experience",
    bonusApplied: prov.endDate?.bonusApplied,
  }, `${baseSlot}.endDate`, telemetry, summary);

  const isCurrent = wrapField(item.isCurrent ?? null, {
    conf: conf.isCurrent,
    source: prov.isCurrent?.source,
    section: prov.isCurrent?.section ?? "experience",
    bonusApplied: prov.isCurrent?.bonusApplied,
  }, `${baseSlot}.isCurrent`, telemetry, summary);

  const summaryValue =
    typeof item.summary === "string"
      ? item.summary
      : typeof item.responsibilities === "string"
      ? item.responsibilities
      : null;
  const summaryField = wrapField(summaryValue, {
    conf: conf.summary ?? conf.responsibilities,
    source: prov.summary?.source ?? prov.responsibilities?.source,
    section: prov.summary?.section ?? prov.responsibilities?.section ?? "experience",
    bonusApplied: prov.summary?.bonusApplied ?? prov.responsibilities?.bonusApplied,
  }, `${baseSlot}.summary`, telemetry, summary);

  const achievementProv = prov.achievements;
  const achievements = (item.achievements ?? []).map((text, achIndex) =>
    wrapField(text, {
      conf: conf.achievements,
      source: achievementProv?.source,
      section: achievementProv?.section ?? "experience",
      bonusApplied: achievementProv?.bonusApplied,
    }, `${baseSlot}.achievements[${achIndex}]`, telemetry, summary)
  );

  const highlightTexts = normalizeHighlights(item.responsibilityBullets ?? item.responsibilities);
  const highlights = highlightTexts.map((text, hlIndex) =>
    wrapField(text, {
      conf: conf.responsibilities ?? conf.achievements ?? conf.summary ?? null,
      source: prov.responsibilities?.source ?? prov.achievements?.source ?? prov.company?.source,
      section: prov.responsibilities?.section ?? "experience",
      bonusApplied: prov.responsibilities?.bonusApplied ?? prov.achievements?.bonusApplied,
    }, `${baseSlot}.highlights[${hlIndex}]`, telemetry, summary)
  );

  const workItem: WorkArray[number] = {
    company,
    position,
    startDate,
    endDate,
    isCurrent,
    achievements,
    summary: summaryField,
  };
  if (highlights.length) {
    workItem.highlights = highlights;
  }
  return workItem;
}

function mapEducationItem(
  item: StrictEducationItem,
  index: number,
  telemetry: TelemetryEvent[],
  summary: ConfidenceSummary[]
): EducationArray[number] {
  const baseSlot = `education[${index}]`;
  const conf: Partial<EducationConf> = item.confidences ?? {};
  const prov: Partial<EducationProv> = item.provenance ?? {};

  const institution = wrapField(item.institution ?? null, {
    conf: conf.institution,
    source: prov.institution?.source,
    section: prov.institution?.section ?? "education",
    bonusApplied: prov.institution?.bonusApplied,
  }, `${baseSlot}.institution`, telemetry, summary);

  const area = wrapField(item.area ?? null, {
    conf: conf.area,
    source: prov.area?.source,
    section: prov.area?.section ?? "education",
    bonusApplied: prov.area?.bonusApplied,
  }, `${baseSlot}.area`, telemetry, summary);

  const studyType = wrapField(item.studyType ?? null, {
    conf: conf.studyType,
    source: prov.studyType?.source,
    section: prov.studyType?.section ?? "education",
    bonusApplied: prov.studyType?.bonusApplied,
  }, `${baseSlot}.studyType`, telemetry, summary);

  const startDate = wrapField(item.startDate ?? null, {
    conf: conf.startDate,
    source: prov.startDate?.source,
    section: prov.startDate?.section ?? "education",
    bonusApplied: prov.startDate?.bonusApplied,
  }, `${baseSlot}.startDate`, telemetry, summary);

  const endDate = wrapField(item.endDate ?? null, {
    conf: conf.endDate,
    source: prov.endDate?.source,
    section: prov.endDate?.section ?? "education",
    bonusApplied: prov.endDate?.bonusApplied,
  }, `${baseSlot}.endDate`, telemetry, summary);

  const score = wrapField(item.score ?? null, {
    conf: conf.score,
    source: prov.score?.source,
    section: prov.score?.section ?? "education",
    bonusApplied: prov.score?.bonusApplied,
  }, `${baseSlot}.score`, telemetry, summary);

  const location = wrapField(item.location ?? null, {
    conf: conf.location,
    source: prov.location?.source,
    section: prov.location?.section ?? "education",
    bonusApplied: prov.location?.bonusApplied,
  }, `${baseSlot}.location`, telemetry, summary);

  const achievementProv = prov.achievements;
  const achievements = (item.achievements ?? []).map((text, achIndex) =>
    wrapField(text, {
      conf: conf.achievements,
      source: achievementProv?.source,
      section: achievementProv?.section ?? "education",
      bonusApplied: achievementProv?.bonusApplied,
    }, `${baseSlot}.achievements[${achIndex}]`, telemetry, summary)
  );

  const educationItem: EducationArray[number] = {
    institution,
    area,
    studyType,
    startDate,
    endDate,
    score,
    location,
    achievements,
  };

  return educationItem;
}

function mapSkillItem(
  item: StrictSkillItem,
  index: number,
  telemetry: TelemetryEvent[],
  summary: ConfidenceSummary[]
): SkillArray[number] {
  const baseSlot = `skills[${index}]`;
  const conf: Partial<SkillConf> = item.confidences ?? {};
  const prov: Partial<SkillProv> = item.provenance ?? {};

  const name = wrapField(item.name ?? null, {
    conf: conf.name,
    source: prov.name?.source,
    section: prov.name?.section ?? "skills",
    bonusApplied: prov.name?.bonusApplied,
  }, `${baseSlot}.name`, telemetry, summary);

  const level = wrapField(item.level ?? null, {
    conf: conf.level,
    source: prov.level?.source,
    section: prov.level?.section ?? "skills",
    bonusApplied: prov.level?.bonusApplied,
  }, `${baseSlot}.level`, telemetry, summary);

  const skillGroup: SkillArray[number] = {
    name,
    level,
    keywords: [],
  };

  return skillGroup;
}

function mapLanguageItem(
  item: StrictLanguageItem,
  index: number,
  telemetry: TelemetryEvent[],
  summary: ConfidenceSummary[]
): LanguageArray[number] {
  const baseSlot = `languages[${index}]`;
  const conf: Partial<LanguageConf> = item.confidences ?? {};
  const prov: Partial<LanguageProv> = item.provenance ?? {};

  const language = wrapField(item.language ?? null, {
    conf: conf.language,
    source: prov.language?.source,
    section: prov.language?.section ?? "languages",
    bonusApplied: prov.language?.bonusApplied,
  }, `${baseSlot}.language`, telemetry, summary);

  const fluency = wrapField(item.fluency ?? null, {
    conf: conf.fluency,
    source: prov.fluency?.source,
    section: prov.fluency?.section ?? "languages",
    bonusApplied: prov.fluency?.bonusApplied,
  }, `${baseSlot}.fluency`, telemetry, summary);

  const languageItem: LanguageArray[number] = {
    language,
    fluency,
  };

  return languageItem;
}
