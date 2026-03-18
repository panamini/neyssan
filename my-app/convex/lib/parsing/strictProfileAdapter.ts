import * as ProfileSchemaMod from "../schemas/profileStrict.schema";
import { extractEmail, extractPhone, extractLocation, extractName } from "../parsing_shared/contactHeuristics";
import { extractContactFromText } from "./contactExtractor";

// pipeline-note: fuses LLM output with heuristic contact/name extraction under
// the StrictProfile schema. Any scoring tweaks for identity/contact should be
// added here (or contactExtractor/contactHeuristics) so downstream callers stay
// consistent.

const SECTION_ALIGNMENT_BONUS = 0.15;
const SECTION_ALIGNMENT_MAP: Record<string, string> = {
  SKILL: "skills",
  ROLE: "experience",
  DEGREE: "education",
};

type CandidateSource = "llm" | "heuristic" | "ner" | "validator" | "manual" | "fallback" | "unknown";

interface Candidate {
  value: string | null;
  conf: number | null;
  source: CandidateSource;
  section?: string | null;
  bonusApplied?: boolean;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

function normalizeCandidateValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function makeCandidate(
  value: string | null | undefined,
  confidence: number | null | undefined,
  source: CandidateSource,
  section?: string | null
): Candidate {
  const normalizedValue = normalizeCandidateValue(value);
  const normalizedConf = confidence == null ? null : clamp01(confidence);
  return {
    value: normalizedValue,
    conf: normalizedConf,
    source,
    section: section ?? null,
    bonusApplied: false,
  };
}

function sectionsAlign(candidateSection: string | null | undefined, targetSection?: string | null): boolean {
  if (!candidateSection || !targetSection) return false;
  const candidateNorm = candidateSection.toLowerCase();
  const targetNorm = targetSection.toLowerCase();
  if (candidateNorm === targetNorm) return true;
  const mapped = SECTION_ALIGNMENT_MAP[candidateSection.toUpperCase?.() ?? candidateSection];
  if (mapped && mapped.toLowerCase() === targetNorm) return true;
  return false;
}

function applySectionBonus(candidate: Candidate, targetSection?: string | null): Candidate {
  if (!candidate.value || candidate.conf == null) return candidate;
  if (!sectionsAlign(candidate.section ?? null, targetSection)) return candidate;
  candidate.conf = clamp01((candidate.conf ?? 0) + SECTION_ALIGNMENT_BONUS);
  candidate.bonusApplied = true;
  return candidate;
}

function pickBestCandidate(
  llmCandidate: Candidate | null,
  heurCandidate: Candidate | null,
  threshold: number,
  targetSection?: string | null
): Candidate {
  const llm = llmCandidate && llmCandidate.value ? applySectionBonus({ ...llmCandidate }, targetSection) : null;
  const heur = heurCandidate && heurCandidate.value ? applySectionBonus({ ...heurCandidate }, targetSection) : null;

  if (llm && !heur) return llm;
  if (!llm && heur) return heur;
  if (!llm && !heur) return makeCandidate(null, null, "fallback");

  const llmConf = llm?.conf ?? 0;
  const heurConf = heur?.conf ?? 0;

  if (llm && llmConf >= threshold) return llm;
  if (heur && heurConf >= threshold && llmConf < threshold) return heur;

  if (llm && heur && (llm.value ?? "").toLowerCase() === (heur.value ?? "").toLowerCase()) {
    return llmConf >= heurConf ? llm : heur;
  }

  if (llmConf >= heurConf) return llm!;
  return heur!;
}
export { pickBestCandidate };
// Access schema in a way that tolerates TS module resolution hiccups
const Schema = (ProfileSchemaMod as unknown as { StrictProfileSchema: import("zod").ZodTypeAny }).StrictProfileSchema;
type StrictProfileOut = ReturnType<typeof Schema["parse"]>;

/**
 * Map parseCV result into a StrictProfile with per-slot confidences,
 * fusing LLM metadata and local heuristics. Validated via Zod at the end.
 */
export function mapParsedToStrict(params: {
  rawText: string;
  parsedSections: Array<{ title: string; content: string; fieldKey: string; confidence: number }>;
  metadata: { name: string | null; email: string | null; phone: string | null; linkedinUrl: string | null } | null;
  mappedCv?: unknown | null;
}): StrictProfileOut {
  const { rawText } = params;
  const sections = Array.isArray(params.parsedSections) ? params.parsedSections : [];
  const metadata = params.metadata ?? null;

  function average(nums: number[]): number {
    if (!nums.length) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  // Feature flag reader with safe defaults (server-only, tolerant when process.env is not available)
  function readFlag(name: string, defaultVal: boolean): boolean {
    try {
      const raw = (process as any)?.env?.[name];
      if (typeof raw === "string") {
        const v = raw.trim();
        if (!v) return defaultVal;
        return !/^(0|false|no|off)$/i.test(v);
      }
    } catch {
      /* ignore: environments without process/env */
    }
    return defaultVal;
  }

  const DEBUG = readFlag("DEBUG_CV_PARSE", false);
  
  function logSlot(slot: string, payload: unknown) {
    if (!DEBUG) return;
    try {
      // Single line, JSON payload for easier grepping in Convex logs
      console.log(`[fusion.debug] slot=${slot} ${JSON.stringify(payload)}`);
    } catch {
      /* ignore */
    }
  }
  
  // Lightweight telemetry (console-based) to observe fusion decisions in QA
  const ENABLE_STRICT_TELEMETRY = readFlag("ENABLE_STRICT_TELEMETRY", false);
  type TelemetrySource = "llm" | "validator" | "heuristic" | "ner" | "unknown";
  type TelemetrySlot = string;

  // Module-local telemetry sink for QA aggregation.
  const TELEMETRY_SINK: {
    events: Array<{ slot: TelemetrySlot; source: TelemetrySource; reason?: string }>;
    counters: Record<string, Record<TelemetrySource, number>>;
  } = { events: [], counters: {} };

  function emitTelemetry(event: {
    slot: TelemetrySlot;
    source: TelemetrySource;
    reason?: string;
    extra?: Record<string, unknown>;
  }) {
    // Aggregate counters regardless of console flag.
    try {
      TELEMETRY_SINK.events.push({ slot: event.slot, source: event.source, reason: event.reason });
      const slotKey = event.slot;
      TELEMETRY_SINK.counters[slotKey] = TELEMETRY_SINK.counters[slotKey] || { llm: 0, validator: 0, heuristic: 0, ner: 0, unknown: 0 };
      TELEMETRY_SINK.counters[slotKey][event.source] = (TELEMETRY_SINK.counters[slotKey][event.source] ?? 0) + 1;
    } catch {
      /* ignore */
    }

    if (!ENABLE_STRICT_TELEMETRY) return;
    try {
      console.log(`[fusion.telemetry] ${JSON.stringify(event)}`);
    } catch {
      /* ignore */
    }
  }

  const asTelemetrySource = (source: CandidateSource | null | undefined): TelemetrySource => {
    switch (source) {
      case "llm":
      case "heuristic":
      case "ner":
      case "validator":
        return source;
      default:
        return "unknown";
    }
  };

  const candidateTelemetrySource = (candidate: Candidate | null | undefined): TelemetrySource => {
    if (!candidate || !candidate.value) return "unknown";
    return asTelemetrySource(candidate.source);
  };

  const candidateToProvenance = (candidate: Candidate | null | undefined) => {
    if (!candidate) return undefined;
    return {
      source: candidate.source,
      section: candidate.section ?? null,
      bonusApplied: candidate.bonusApplied ?? undefined,
    };
  };

  function drainFusionTelemetry() {
    const out = { events: [...TELEMETRY_SINK.events], counters: { ...TELEMETRY_SINK.counters } };
    TELEMETRY_SINK.events = [];
    TELEMETRY_SINK.counters = {};
    return out;
  }

  // Blacklist tokens that must never be chosen as a person's name (used later in name sanitation)
  const NAME_BLACKLIST = new Set([
    "united states",
    "united kingdom",
    "usa",
    "uk",
    "france",
    "germany",
    "spain",
    "italy",
    "canada",
    "australia",
    "los angeles",
    "new york",
    "san francisco",
    "paris",
    "london",
  ]);
// Helper: strip header/link noise before location/name heuristics
function stripHeaderNoise(text: string): string {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim());

  const isNoisy = (l: string) =>
    /\[.+?\]\(.+?\)/.test(l) || // markdown link [x](y)
    /linkedin|portfolio|resume templates|pinterest/i.test(l);

  // Remove noise from the first ~20 lines; keep other lines intact
  const cleaned = lines.map((l, i) => (i < 20 && isNoisy(l) ? "" : l)).filter(Boolean);
  return cleaned.join("\n");
}

// Helper: infer default country from a canonicalized location string
function inferDefaultCountry(loc: string | null): string | undefined {
  if (!loc) return undefined;
  // US heuristic: "City, ST 12345" pattern
  if (/\b[A-Z]{2}\s+\d{5}\b/.test(loc)) return "US";
  // Extend here with other patterns if needed
  return undefined;
}

// Helper: derive achievements (bullets) from text/sections when mappedCv is missing
function deriveAchievementsFromText(text: string): string[] {
  const out: string[] = [];
  const lines = String(text || "").split(/\r?\n/);
  for (const raw of lines) {
    const l = String(raw || "").trim();
    if (!l) continue;
    const m = /^(\*|\-|•|\u2022|–)\s+(.*)$/.exec(l);
    if (m) {
      const item = m[2].trim().replace(/\s+/g, " ");
      if (item.length >= 6) out.push(item);
    }
    if (out.length >= 6) break;
  }
  return out;
}

  // Heuristic: extract desired position from top header lines when present (e.g., "SECURITY GUARD LOS ANGELES, CA 90291 ...")
  function extractDesiredPositionHeuristic(text: string): { value: string | null; confidence: number | null } {
    const s = String(text || "");
    const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
    const isMostlyUpper = (str: string) => {
      const letters = str.replace(/[^A-Za-z]/g, "");
      if (!letters) return false;
      const upper = letters.replace(/[^A-Z]/g, "");
      return upper.length / letters.length >= 0.7;
    };
    const stopToken = (w: string) => /[,]|^\d{4,}$|^\d{2,}[-\s]?\d{2,}$|^UNITED$|^STATES$|^[A-Z]{2}$/.test(w);

    // Known job-title keywords to prefer when slicing header lines
    const JOB_KEYWORDS = ["guard", "officer", "security", "protection", "certified", "developer", "engineer", "manager", "analyst", "consultant"];
    // Words that commonly follow a leading job keyword to form a two-word title (e.g., "Security Guard")
    const TITLE_AFTER = new Set(["guard", "officer", "engineer", "manager", "analyst", "consultant", "architect", "specialist", "lead"]);

    for (const line of lines) {
      if (!line || line.length < 6) continue;
      if (!isMostlyUpper(line)) continue;
      if (!(/[,\d]|UNITED|STATES|[A-Z]{2}\b/.test(line))) continue;
      const words = line.split(/\s+/).filter(Boolean);
      const kept: string[] = [];
      for (const w of words) {
        const clean = w.replace(/[^\w\-']/g, "");
        if (!clean || stopToken(clean)) break;
        kept.push(clean);
        if (kept.length >= 6) break; // allow slightly longer capture for multi-word titles
      }
      const title = kept.join(" ").trim();
      if (!title) continue;

      // Normalize to Title Case and get lowercased tokens for logic
      const normTitle = title.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
      const low = title.toLowerCase().split(/\s+/);
      const normParts = normTitle.split(/\s+/);

      // 1) Prefer explicit two-token titles like "Security Guard" / "Security Officer"
      for (let i = 0; i < low.length - 1; i++) {
        const curr = low[i];
        const next = low[i + 1];
        if (JOB_KEYWORDS.includes(curr) && TITLE_AFTER.has(next)) {
          const final2 = `${normParts[i]} ${normParts[i + 1]}`.trim();
          if (final2.length >= 6) return { value: final2, confidence: 0.85 };
        }
      }

      // 2) Fallback: prefer the first job keyword token plus the next token if not a location short token
      for (let i = 0; i < low.length; i++) {
        if (JOB_KEYWORDS.some((k) => low[i].includes(k))) {
          // try to include the next token if it doesn't look like a location short token (e.g., "Los")
          const next = i + 1 < normParts.length ? normParts[i + 1] : null;
          if (next && next.length > 3 && !/^(Los|New|San)$/i.test(next)) {
            const final2 = `${normParts[i]} ${next}`.trim();
            if (final2.length >= 6) return { value: final2, confidence: 0.8 };
          }
          // otherwise single-token title as last resort
          const single = normParts[i];
          if (single && single.length >= 6) return { value: single, confidence: 0.75 };
          break;
        }
      }

      // 3) Last resort: drop trailing short tokens from the normalized header slice
      const parts = normTitle.split(/\s+/);
      while (parts.length > 0 && parts[parts.length - 1].length <= 3) parts.pop();
      if (parts.length > 0) {
        const final = parts.join(" ").trim();
        if (final.length >= 6) return { value: final, confidence: 0.7 };
      }
    }
    return { value: null, confidence: null };
  }

  // Global LLM confidence proxy derived from section confidences; default 0.7 if none present.
  const globalLLMConf = sections.length ? clamp01(average(sections.map((s) => clamp01(Number(s.confidence ?? 0))))) : 0.7;

  // If LLM provides a value with confidence >= this threshold, prefer it over heuristics.
  const TRUST_LLM_THRESHOLD = 0.7;
  const SLOT_THRESHOLDS = { name: 0.7, email: 0.8, phone: 0.8 } as const;

  // Helper: choose best candidate between LLM-provided value (uniform confidence) and heuristic extraction.
  const buildLLMCandidate = (value: string | null | undefined, conf: number | null | undefined): Candidate | null => {
    const normalizedValue = normalizeCandidateValue(value);
    if (!normalizedValue) return null;
    return makeCandidate(normalizedValue, conf ?? 0.6, "llm");
  };

  const buildHeuristicCandidate = (
    result: { value: string | null; confidence: number | null; section?: string | null },
    sectionFallback?: string | null
  ): Candidate | null => {
    if (!result) return null;
    const normalizedValue = normalizeCandidateValue(result.value);
    if (!normalizedValue) return null;
    return makeCandidate(normalizedValue, result.confidence ?? 0.6, "heuristic", result.section ?? sectionFallback ?? null);
  };

  function pickBest(
    llmValue: string | null | undefined,
    llmConf: number | null,
    heur: { value: string | null; confidence: number | null; section?: string | null },
    threshold: number = TRUST_LLM_THRESHOLD,
    targetSection?: string | null
  ): Candidate {
    const llmCandidate = buildLLMCandidate(llmValue, llmConf);
    const heuristicCandidate = buildHeuristicCandidate(heur, targetSection);
    return pickBestCandidate(llmCandidate, heuristicCandidate, threshold, targetSection);
  }

  // LLM-provided uniform confidences for present metadata values
  const llmMetaConf = (present: boolean) => (present ? Math.min(0.9, 0.6 + 0.4 * globalLLMConf) : null);

  // Heuristics
  // Clean noisy header/link lines before location/name heuristics
  const cleanedText = stripHeaderNoise(rawText);
  const heurEmail = extractEmail(rawText);
  const heurPhone = extractPhone(rawText);
  const heurLocation = extractLocation(cleanedText);
  const heurName = extractName(cleanedText, metadata?.email ?? heurEmail.value);
  const heurDesired = extractDesiredPositionHeuristic(rawText);

  // Optional NER (Option C): consume mappedCv._ner when provided by the action layer.
  // Shape expectation (tolerant): { entities: [{ label, text, start, end, score? }], layout?: { blocks: [...] } }
  const nerData: unknown =
    params.mappedCv && typeof params.mappedCv === "object" ? (params.mappedCv as Record<string, unknown>)._ner : null;
  const nerEntities: Array<unknown> = (nerData && typeof nerData === "object" && Array.isArray((nerData as any).entities))
    ? (nerData as any).entities as unknown[]
    : [];

  function asEntity(x: unknown): { label: string; text: string; start: number; end: number; score?: number } | null {
    if (!x || typeof x !== "object") return null;
    const o = x as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label : "";
    const text = typeof o.text === "string" ? o.text : "";
    const start = Number.isFinite(o.start) ? Number(o.start) : -1;
    const end = Number.isFinite(o.end) ? Number(o.end) : -1;
    const score = Number.isFinite(o.score) ? Number(o.score) : undefined;
    if (!label || !text || start < 0 || end < 0) return null;
    return { label, text, start, end, score };
  }

  const parsedNER = nerEntities.map(asEntity).filter((e): e is NonNullable<ReturnType<typeof asEntity>> => !!e);
  const nerConfBase = clamp01(0.7 * (0.75 + 0.25 * globalLLMConf));

  // Build NER candidates (prefer earliest/top of document)
  const nerPER = parsedNER.filter(e => e.label.toUpperCase() === "PER").sort((a, b) => a.start - b.start);
  const nerLOC = parsedNER.filter(e => {
    const lab = e.label.toUpperCase();
    return lab === "GPE" || lab === "LOC";
  }).sort((a, b) => a.start - b.start);

  const getEntitySection = (entity: any): string | null => {
    if (!entity || typeof entity !== "object") return null;
    return (
      entity.section ??
      entity.parentSection ??
      entity.fieldKey ??
      entity.sectionLabel ??
      entity.label ??
      null
    ) as string | null;
  };

  const nerNameCandidate = nerPER.length > 0
    ? makeCandidate(String(nerPER[0].text).trim() || null, nerConfBase, "ner", getEntitySection(nerPER[0]))
    : makeCandidate(null, null, "ner");

  const nerLocationCandidate = nerLOC.length > 0
    ? makeCandidate(String(nerLOC[0].text).trim() || null, nerConfBase, "ner", getEntitySection(nerLOC[0]))
    : makeCandidate(null, null, "ner");

  // DATE tokens (ordered) for optional experience fallback pairing
  const nerDATE = parsedNER
    .filter((e) => e.label.toUpperCase() === "DATE")
    .sort((a, b) => a.start - b.start);
  const nerDateTexts: string[] = nerDATE.map((e) => String(e.text));

  // Runtime feature flags (safe defaults true)
  const ENABLE_PHONE_NORMALIZATION = readFlag("ENABLE_PHONE_NORMALIZATION", true);
  const TRUST_LLM_METADATA_STRICT = readFlag("TRUST_LLM_METADATA_STRICT", true);
  const ACCEPT_SPANLESS_VALUES = readFlag("ACCEPT_SPANLESS_VALUES", true);

  if (DEBUG) {
    try {
      console.log(
        `[fusion.flags] ${JSON.stringify({
          ENABLE_PHONE_NORMALIZATION,
          TRUST_LLM_METADATA_STRICT,
          ACCEPT_SPANLESS_VALUES,
          TRUST_LLM_THRESHOLD,
          globalLLMConf,
        })}`
      );
    } catch {
      /* ignore */
    }
  }

  // Contacts: initial fuse LLM metadata with heuristics
  let fusedEmail = pickBest(metadata?.email ?? null, llmMetaConf(Boolean(metadata?.email)), heurEmail, SLOT_THRESHOLDS.email);
  let fusedPhone = pickBest(metadata?.phone ?? null, llmMetaConf(Boolean(metadata?.phone)), heurPhone, SLOT_THRESHOLDS.phone);

  if (DEBUG) {
    logSlot("email.pre", {
      llm: { value: metadata?.email ?? null, conf: llmMetaConf(Boolean(metadata?.email)) },
      heur: heurEmail,
      final: fusedEmail,
    });
    logSlot("phone.pre", {
      llm: { value: metadata?.phone ?? null, conf: llmMetaConf(Boolean(metadata?.phone)) },
      heur: heurPhone,
      final: fusedPhone,
    });
  }

  let validatorNameCandidate: Candidate | null = null;

  // Validator/backfill stage: use robust extractor (E.164 phones, validated emails/links)
  try {
    const locForHint = heurLocation.value ?? null;
    const defaultCountry = inferDefaultCountry(locForHint);
    // contactExtractor signature expects CountryCode | undefined as the second parameter
    const contact = extractContactFromText(rawText, defaultCountry as any);
    // Helper to compare phone equality ignoring separators
    const digits = (s: string) => s.replace(/\D/g, "");

    // Email fusion: prefer LLM when confident; otherwise adopt validator first value
    if (Array.isArray(contact.emails) && contact.emails.length > 0) {
      const firstEmail = String(contact.emails[0]);
      const llmConf = fusedEmail.conf ?? 0;
      const hasHighLLM = TRUST_LLM_METADATA_STRICT ? llmConf >= SLOT_THRESHOLDS.email : false;

      const suspiciousEmail = (s: string) =>
        /\.\./.test(s) || /[.,;:!?]$/.test(s) || /@[.-]|[.-]@/.test(s);

      if (fusedEmail.value) {
        const llmVal = String(fusedEmail.value);
        const matchesValidator = contact.emails.some((e) => e.toLowerCase() === llmVal.toLowerCase());
        const llmSuspicious = suspiciousEmail(llmVal);

        // Override only if LLM is not high-confidence OR looks suspicious
        if (!matchesValidator && ACCEPT_SPANLESS_VALUES && (!hasHighLLM || llmSuspicious)) {
          fusedEmail = makeCandidate(firstEmail, Math.max(0.8, llmConf || 0.6), "validator");
        }
        // if matchesValidator or high LLM confidence and not suspicious, keep LLM value as-is
      } else {
        // No LLM/heuristic value -> adopt validator (only if allowed)
        if (ACCEPT_SPANLESS_VALUES) {
          fusedEmail = makeCandidate(firstEmail, 0.85, "validator");
        }
      }

      logSlot("email.post", {
        llm: { value: metadata?.email ?? null, conf: llmMetaConf(Boolean(metadata?.email)) },
        validator: { emails: contact.emails },
        heur: heurEmail,
        final: fusedEmail,
        flags: { TRUST_LLM_METADATA_STRICT, ACCEPT_SPANLESS_VALUES },
      });
      // Telemetry source inference for email
      try {
        const finalVal = fusedEmail.value ? String(fusedEmail.value) : null;
        const source: TelemetrySource =
          finalVal == null ? "unknown"
          : contact.emails?.some((e) => String(e).toLowerCase() === finalVal.toLowerCase()) ? "validator"
          : (metadata?.email && String(metadata.email).trim() && String(metadata.email).toLowerCase() === finalVal.toLowerCase()) ? "llm"
          : (heurEmail.value && String(heurEmail.value).toLowerCase() === finalVal.toLowerCase()) ? "heuristic"
          : "unknown";
        const reason =
          source === "validator"
            ? (fusedEmail.conf ?? 0) >= (llmMetaConf(Boolean(metadata?.email)) ?? 0)
              ? (String(metadata?.email ?? "").includes("..") ? "suspicious" : "threshold")
              : "improvement"
            : undefined;
        emitTelemetry({
          slot: "email",
          source,
          reason,
          extra: {
            llmConf: llmMetaConf(Boolean(metadata?.email)),
            hadHeur: Boolean(heurEmail.value),
            validatorCount: contact.emails?.length ?? 0,
            winnerSource: fusedEmail.source,
            winnerConf: fusedEmail.conf,
            winnerSection: fusedEmail.section ?? null,
          },
        });
      } catch {
        /* ignore */
      }
    }

    // Phone fusion: digits-equal normalization to E.164 when possible; LLM-first precedence
    if (Array.isArray(contact.phones) && contact.phones.length > 0) {
      const validatorPhones = contact.phones.map(String);
      const firstPhone = validatorPhones[0];
      const llmConf = fusedPhone.conf ?? 0;
      const hasHighLLM = TRUST_LLM_METADATA_STRICT ? llmConf >= SLOT_THRESHOLDS.phone : false;

      if (fusedPhone.value) {
        const llmVal = String(fusedPhone.value);
        const llmDigits = digits(llmVal);
        const match = validatorPhones.find((p) => digits(p) === llmDigits);
        let phoneOverrideBySanity = false;

        const isValidDigits = (s: string) => {
          const d = digits(s);
          return d.length >= 10 && d.length <= 16;
        };

        // Sanity gate: if LLM is implausible (<10 digits), allow validator override even if TRUST_LLM is true
        if (llmDigits.length > 0 && llmDigits.length < 10 && validatorPhones.length > 0 && ACCEPT_SPANLESS_VALUES) {
          fusedPhone = makeCandidate(firstPhone, Math.max(0.8, llmConf || 0.6), "validator");
          phoneOverrideBySanity = true;
        } else if (match && ENABLE_PHONE_NORMALIZATION) {
          // Normalize to E.164 (validator) but preserve LLM confidence
          if (match !== llmVal) fusedPhone = makeCandidate(match, fusedPhone.conf, fusedPhone.source ?? "validator", fusedPhone.section);
        } else if (!hasHighLLM && ACCEPT_SPANLESS_VALUES && isValidDigits(firstPhone) && digits(firstPhone) > llmDigits) {
          // LLM present but not confident; prefer validator only when it has valid digits and dominates digit-count
          fusedPhone = makeCandidate(firstPhone, Math.max(0.8, llmConf || 0.6), "validator");
        }

        logSlot("phone.post", {
          llm: { value: llmVal, conf: llmConf },
          validator: { phones: validatorPhones },
          heur: heurPhone,
          derived: {
            digitsEqual: Boolean(match),
            llmDigitsLen: llmDigits.length,
            phoneOverrideBySanity,
          },
          final: fusedPhone,
          flags: { TRUST_LLM_METADATA_STRICT, ACCEPT_SPANLESS_VALUES, ENABLE_PHONE_NORMALIZATION },
        });
        // Telemetry source inference for phone
        try {
          const finalVal = fusedPhone.value ? String(fusedPhone.value) : null;
          const source: TelemetrySource =
            finalVal == null ? "unknown"
            : validatorPhones.some((p) => p.replace(/\D/g, "") === (finalVal ?? "").replace(/\D/g, "")) ? "validator"
            : (metadata?.phone && String(metadata.phone).replace(/\D/g, "") === (finalVal ?? "").replace(/\D/g, "")) ? "llm"
            : (heurPhone.value && heurPhone.value.replace(/\D/g, "") === (finalVal ?? "").replace(/\D/g, "")) ? "heuristic"
            : "unknown";
          const reason = phoneOverrideBySanity
            ? "sanity"
            : (match ? "digits-equal" : (validatorPhones[0] && (validatorPhones[0].replace(/\D/g, "").length > (llmVal || "").replace(/\D/g, "").length) ? "dominance" : undefined));
          emitTelemetry({
            slot: "phone",
            source,
            reason,
          extra: {
            llmConf,
            llmDigits: (llmVal || "").replace(/\D/g, "").length,
            validatorCount: validatorPhones.length,
            winnerSource: fusedPhone.source,
            winnerConf: fusedPhone.conf,
            winnerSection: fusedPhone.section ?? null,
          },
        });
        } catch {
          /* ignore */
        }
      } else {
        // No LLM/heuristic phone -> adopt validator (only if allowed)
        if (ACCEPT_SPANLESS_VALUES) {
          fusedPhone = makeCandidate(firstPhone, 0.85, "validator");
        }

        logSlot("phone.post", {
          llm: { value: null, conf: null },
          validator: { phones: validatorPhones },
          heur: heurPhone,
          derived: { digitsEqual: null, llmDigitsLen: 0, phoneOverrideBySanity: false },
          final: fusedPhone,
          flags: { TRUST_LLM_METADATA_STRICT, ACCEPT_SPANLESS_VALUES, ENABLE_PHONE_NORMALIZATION },
        });
        try {
          emitTelemetry({
            slot: "phone",
            source: "validator",
            reason: "fill",
            extra: { validatorCount: validatorPhones.length },
          });
        } catch {
          /* ignore */
        }
      }
    }

    if (Array.isArray(contact.names) && contact.names.length > 0) {
      const primaryName = contact.names.find((n) => typeof n === "string" && n.trim().length >= 2) ?? null;
      if (primaryName) {
        const evaluated = extractName(
          typeof contact.raw === "string" && contact.raw.trim() ? contact.raw : rawText,
          metadata?.email ?? fusedEmail.value ?? heurEmail.value ?? null
        );
        const evaluatedNorm = evaluated.value ? evaluated.value.trim().toLowerCase() : null;
        const candidateNorm = primaryName.trim().toLowerCase();
        let conf = evaluatedNorm && evaluatedNorm === candidateNorm
          ? evaluated.confidence ?? 0.78
          : 0.72;
        if (!Number.isFinite(conf)) conf = 0.72;
        validatorNameCandidate = makeCandidate(primaryName.trim(), conf, "validator", "profile");
      }
    }
  } catch {
    // Best-effort: never throw from validator stage
  }

  let fusedLocation = pickBest(null, null, heurLocation);

  // Name and desired position fusion
  let fusedName = pickBest(metadata?.name ?? null, llmMetaConf(Boolean(metadata?.name)), heurName, SLOT_THRESHOLDS.name);

  if (validatorNameCandidate && validatorNameCandidate.value) {
    const fusedRaw = fusedName.value ? String(fusedName.value).trim().toLowerCase() : null;
    const validatorRaw = String(validatorNameCandidate.value).trim().toLowerCase();
    const valuesDiffer = !fusedRaw || fusedRaw !== validatorRaw;
    const fusedConf = fusedName.conf ?? 0;
    const validatorConf = validatorNameCandidate.conf ?? 0;
    const primaryWeak = !fusedName.value || fusedConf < SLOT_THRESHOLDS.name;
    const significantGain = validatorConf > fusedConf + 0.05;

    if (primaryWeak || (valuesDiffer && significantGain)) {
      fusedName = validatorNameCandidate;
    }
  }
  const fusedDesired = pickBest(
    (metadata as any)?.desiredPosition ?? null,
    llmMetaConf(Boolean((metadata as any)?.desiredPosition)),
    heurDesired,
    SLOT_THRESHOLDS.name,
    "experience"
  );

  // NER overrides (non-breaking): prefer NER when it provides higher confidence and
  // current fusion is below slot threshold or missing.
  if (nerNameCandidate.value) {
    const currentConf = fusedName.conf ?? 0;
    const nerConf = nerNameCandidate.conf ?? 0;
    const currentRaw = fusedName.value ? String(fusedName.value).trim() : "";
    const nerRaw = String(nerNameCandidate.value).trim();
    const currentVal = currentRaw.toLowerCase();
    const nerVal = nerRaw.toLowerCase();
    const casingDiffersOnly = currentRaw && nerRaw && currentVal === nerVal && currentRaw !== nerRaw;
    const confidenceTie = Math.abs(nerConf - currentConf) < 1e-6;

    const shouldOverride =
      !fusedName.value ||
      (nerConf > currentConf && currentConf < SLOT_THRESHOLDS.name && currentVal !== nerVal) ||
      casingDiffersOnly ||
      (confidenceTie && currentVal !== nerVal);

    if (shouldOverride) {
      const overrideCandidate = makeCandidate(nerNameCandidate.value, nerConf, "ner", nerNameCandidate.section ?? null);
      fusedName = applySectionBonus(overrideCandidate, "profile");
      emitTelemetry({
        slot: "name",
        source: "ner",
        reason: "override",
        extra: {
          currentConf,
          nerConf,
          winnerSource: fusedName.source,
          winnerConf: fusedName.conf,
          winnerSection: fusedName.section ?? null,
        }
      });
    }
  }

  if (nerLocationCandidate.value) {
    const currentConf = fusedLocation.conf ?? 0;
    const nerConf = nerLocationCandidate.conf ?? 0;
    const currentVal = fusedLocation.value ? String(fusedLocation.value).trim().toLowerCase() : "";
    const nerVal = String(nerLocationCandidate.value).trim().toLowerCase();
    const heurContainsNer = currentVal && nerVal && currentVal !== nerVal && (currentVal.startsWith(nerVal) || currentVal.includes(`${nerVal},`));
    // location has no LLM source in most cases; accept NER if better than current heuristics
    const shouldOverride =
      !fusedLocation.value ||
      (nerConf > currentConf && currentVal !== nerVal) ||
      heurContainsNer;

    if (shouldOverride) {
      const overrideCandidate = makeCandidate(nerLocationCandidate.value, nerConf, "ner", nerLocationCandidate.section ?? null);
      fusedLocation = applySectionBonus(overrideCandidate, "location");
      emitTelemetry({
        slot: "location",
        source: "ner",
        reason: "override",
        extra: {
          currentConf,
          nerConf,
          winnerSource: fusedLocation.source,
          winnerConf: fusedLocation.conf,
          winnerSection: fusedLocation.section ?? null,
        }
      });
    }
  }

  // Sanitize name: reject values that look like countries/locations or that appear inside the chosen location string.
  if (fusedName.value) {
    const nv = String(fusedName.value).trim().toLowerCase();
    const lv = String(fusedLocation.value ?? "").toLowerCase();
    if ((nv.length > 0 && NAME_BLACKLIST.has(nv)) || (nv.length > 2 && lv.includes(nv))) {
      logSlot("name.sanitized", { before: fusedName, location: fusedLocation });
      fusedName = makeCandidate(null, null, fusedName.source ?? "fallback", fusedName.section ?? null);
    }
  }

  if (DEBUG) {
    logSlot("location.post", {
      heur: heurLocation,
      final: fusedLocation,
    });
    logSlot("name.post", {
      llm: { value: metadata?.name ?? null, conf: llmMetaConf(Boolean(metadata?.name)) },
      heur: heurName,
      final: fusedName,
    });
    logSlot("desiredPosition.post", {
      llm: { value: (metadata as any)?.desiredPosition ?? null, conf: llmMetaConf(Boolean((metadata as any)?.desiredPosition)) },
      heur: heurDesired,
      final: fusedDesired,
    });
  }

  emitTelemetry({
    slot: "name",
    source: candidateTelemetrySource(fusedName),
    reason: "final",
    extra: {
      winnerSource: fusedName.source,
      winnerConf: fusedName.conf,
      winnerSection: fusedName.section ?? null,
      bonusApplied: fusedName.bonusApplied ?? false,
      hasValue: Boolean(fusedName.value),
    },
  });

  emitTelemetry({
    slot: "location",
    source: candidateTelemetrySource(fusedLocation),
    reason: "final",
    extra: {
      winnerSource: fusedLocation.source,
      winnerConf: fusedLocation.conf,
      winnerSection: fusedLocation.section ?? null,
      bonusApplied: fusedLocation.bonusApplied ?? false,
      hasValue: Boolean(fusedLocation.value),
    },
  });

  emitTelemetry({
    slot: "desiredPosition",
    source: candidateTelemetrySource(fusedDesired),
    reason: "final",
    extra: {
      winnerSource: fusedDesired.source,
      winnerConf: fusedDesired.conf,
      winnerSection: fusedDesired.section ?? null,
      bonusApplied: fusedDesired.bonusApplied ?? false,
      hasValue: Boolean(fusedDesired.value),
    },
  });

  // Experience normalization
  interface RawExpItem {
    company?: unknown;
    position?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    isCurrent?: unknown;
    achievements?: unknown;
    summary?: unknown;
    responsibilities?: unknown;
    description?: unknown;
    // Allow additional unknown keys; we only read known ones.
    [key: string]: unknown;
  }

  interface RawEducationItem {
    institution?: unknown;
    area?: unknown;
    studyType?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    score?: unknown;
    location?: unknown;
    achievements?: unknown;
    title?: unknown;
    content?: unknown;
    confidence?: unknown;
  }

  interface RawSkillSource {
    text?: unknown;
    confidence?: unknown;
  }

  interface RawLanguageSource {
    text?: unknown;
    confidence?: unknown;
    raw?: unknown;
    tokens?: unknown;
  }

  const DEGREE_REGEX = /\b((?:Associate|Bachelor(?:'s)?|B\.\s?A\.?|B\.\s?Sc\.?|BSc|BA|BEng|BE|BTech|Master(?:'s)?|M\.\s?A\.?|M\.\s?Sc\.?|MS|MSc|MBA|MEng|MTech|Doctor(?:ate)?|Ph\.\s?D\.?|PhD|JD|LLB|LLM)(?:\s+of\s+[A-Za-z&'\/\s]+)?)\b/i;
  const INSTITUTION_REGEX = /\b([A-Z][A-Za-z&.,'\-]*(?:\s+[A-Z][A-Za-z&.,'\-]*)*\s+(?:University|College|Institute|Polytechnic|Academy|School(?:\s+of)?))\b/;
  const GPA_REGEX = /(GPA|CGPA)[:\s]*([0-4](?:\.\d{1,2})?(?:\s*\/\s*[0-4](?:\.\d{1,2})?)?)/i;
  const MONTH_YEAR_MATCH = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+\d{4}/gi;
  const YEAR_MATCH = /\b(19|20)\d{2}\b/g;
  const PRESENT_RE = /present|current|ongoing/i;
  const LIST_SPLIT_REGEX = /[,;\u2022•\u25CF\n\t\|]+/;

  // Normalize localized month tokens (FR/ES) to English to improve Date.parse reliability.
  function normalizeMonthTokens(input: string): string {
    let s = input;
    // French (full and common abbr.)
    const frMap: Record<string, string> = {
      "janvier": "January", "janv": "Jan",
      "février": "February", "fevrier": "February", "févr": "Feb", "fevr": "Feb",
      "mars": "March",
      "avril": "April", "avr": "Apr",
      "mai": "May",
      "juin": "June",
      "juillet": "July", "juil": "Jul",
      "août": "August", "aout": "August", "aoû": "Aug",
      "septembre": "September", "sept": "Sep",
      "octobre": "October", "oct": "Oct",
      "novembre": "November", "nov": "Nov",
      "décembre": "December", "decembre": "December", "déc": "Dec", "dec": "Dec"
    };
    // Spanish (full and common abbr.)
    const esMap: Record<string, string> = {
      "enero": "January", "ene": "Jan",
      "febrero": "February", "feb": "Feb",
      "marzo": "March", "mar": "Mar",
      "abril": "April", "abr": "Apr",
      "mayo": "May", "may": "May",
      "junio": "June", "jun": "Jun",
      "julio": "July", "jul": "Jul",
      "agosto": "August", "ago": "Aug",
      "septiembre": "September", "setiembre": "September", "sep": "Sep", "set": "Sep",
      "octubre": "October", "oct": "Oct",
      "noviembre": "November", "nov": "Nov",
      "diciembre": "December", "dic": "Dec"
    };
    const replaceTokens = (map: Record<string, string>) => {
      for (const [k, v] of Object.entries(map)) {
        const re = new RegExp(`\\b${k}\\.?\\b`, "gi");
        s = s.replace(re, v);
      }
    };
    s = s.normalize("NFC");
    replaceTokens(frMap);
    replaceTokens(esMap);
    // Normalize unicode dashes to ASCII dash for downstream regex
    s = s.replace(/[\u2012\u2013\u2014\u2015]/g, "-");
    return s;
  }
  function toISOOrYear(input: unknown): { value: string | null; conf: number | null } {
    if (typeof input !== "string") return { value: null, conf: null };
    const sRaw = input.trim();
    if (!sRaw) return { value: null, conf: null };
    // Year-only pattern
    if (/^(19|20)\d{2}$/.test(sRaw)) return { value: sRaw, conf: 0.6 };
    const s = normalizeMonthTokens(sRaw);
    const lower = sRaw.toLowerCase();
    if (/^(present|présent|current|actuel|actual)$/i.test(lower)) {
      return { value: null, conf: 0.75 };
    }
    const monthLookup: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sept: 8, sep: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11,
    };

    const monthYearMatch = /^([A-Za-z]+)\s+(\d{4})$/.exec(s.trim());
    if (monthYearMatch) {
      const monthIdx = monthLookup[monthYearMatch[1].toLowerCase()];
      if (typeof monthIdx === "number") {
        const yearNum = Number(monthYearMatch[2]);
        const iso = `${yearNum}-${String(monthIdx + 1).padStart(2, "0")}-01`;
        return { value: iso, conf: 0.8 };
      }
    }

    const t = Date.parse(s);
    if (!Number.isNaN(t)) {
      const parsedDate = new Date(t);
      const iso = `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}-${String(parsedDate.getUTCDate()).padStart(2, "0")}`;
      // Guardrail: avoid accidental epoch if original string didn't include 1970 explicitly
      if (iso === "1970-01-01" && !/1970/.test(sRaw)) return { value: sRaw, conf: null };
      return { value: iso, conf: 0.8 };
    }
    return { value: sRaw, conf: null };
  }

  const normalizeWhitespace = (text: string | null | undefined): string =>
    String(text ?? "")
      .replace(/\s+/g, " ")
      .trim();

  const buildFieldProvenance = (
    source: CandidateSource,
    section: string | null | undefined,
    bonusApplied?: boolean | null
  ) => ({
    source,
    section: section ?? null,
    bonusApplied: bonusApplied ?? undefined,
  });

  function splitList(text: string | null | undefined): string[] {
    if (!text) return [];
    return String(text)
      .split(LIST_SPLIT_REGEX)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function extractDateRange(text: string): {
    startDate: { value: string | null; conf: number | null };
    endDate: { value: string | null; conf: number | null };
    isCurrent: boolean;
  } {
    const cleaned = String(text || "");
    const explicitRange = /([A-Za-z]{3,9}\s+\d{4}|(19|20)\d{2})\s*(?:[-–—to]+)\s*((?:[A-Za-z]{3,9}\s+\d{4})|((19|20)\d{2})|present|current)/i.exec(cleaned);
    if (explicitRange) {
      const startRaw = explicitRange[1];
      const endRaw = explicitRange[3];
      const start = toISOOrYear(startRaw);
      if (/present|current/i.test(endRaw ?? "")) {
        return {
          startDate: start,
          endDate: { value: null, conf: null },
          isCurrent: true,
        };
      }
      const end = toISOOrYear(endRaw);
      return {
        startDate: start,
        endDate: end,
        isCurrent: false,
      };
    }

    const monthMatches = Array.from(cleaned.matchAll(MONTH_YEAR_MATCH));
    if (monthMatches.length >= 2) {
      const start = toISOOrYear(monthMatches[0][0]);
      const endToken = monthMatches[1][0];
      const isCurrent = PRESENT_RE.test(endToken);
      const end = isCurrent ? { value: null, conf: null } : toISOOrYear(endToken);
      return { startDate: start, endDate: end, isCurrent };
    }

    const years = Array.from(cleaned.matchAll(YEAR_MATCH)).map((m) => m[0]);
    if (years.length >= 2) {
      const start = toISOOrYear(years[0]);
      const endToken = years[1];
      const end = PRESENT_RE.test(endToken) ? { value: null, conf: null } : toISOOrYear(endToken);
      const isCurrent = end.value == null && PRESENT_RE.test(cleaned);
      return { startDate: start, endDate: end, isCurrent };
    }

    if (years.length === 1) {
      const start = toISOOrYear(years[0]);
      return { startDate: start, endDate: { value: null, conf: null }, isCurrent: PRESENT_RE.test(cleaned) };
    }

    return {
      startDate: { value: null, conf: null },
      endDate: { value: null, conf: null },
      isCurrent: false,
    };
  }

  function deriveEducationFromText(
    text: string,
    confidence: number,
    source: CandidateSource,
    section: string | null | undefined
  ): StrictProfileOut["education"][number] {
    const baseConf = clamp01(confidence);
    const normalized = normalizeWhitespace(text);
    const lines = String(text || "")
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const degreeMatch = DEGREE_REGEX.exec(normalized);
    const studyType = degreeMatch ? normalizeWhitespace(degreeMatch[0]) : "";
    let area = "";
    if (studyType && degreeMatch) {
      const sliceStart = degreeMatch.index + degreeMatch[0].length;
      const areaMatch = /(?:in|of)\s+([A-Za-z&'\/\s]{3,})/i.exec(
        normalized.slice(sliceStart)
      );
      if (areaMatch) area = normalizeWhitespace(areaMatch[1]);
    }

    const institutionMatch = INSTITUTION_REGEX.exec(normalized);
    let institution = institutionMatch ? normalizeWhitespace(institutionMatch[0]) : "";
    if (!institution && lines.length) {
      institution = normalizeWhitespace(lines[lines.length - 1]);
    }

    const gpaMatch = GPA_REGEX.exec(normalized);
    const score = gpaMatch ? normalizeWhitespace(gpaMatch[0]) : "";

    const { startDate, endDate, isCurrent } = extractDateRange(normalized);

    const achievements: string[] = [];
    for (const line of lines.slice(1)) {
      const bullet = /^[-•\u2022\*]\s*(.*)$/.exec(line);
      if (bullet) {
        const trimmed = normalizeWhitespace(bullet[1]);
        if (trimmed.length >= 4) achievements.push(trimmed);
      }
    }

    const itemConf = {
      institution: institution ? baseConf : null,
      area: area ? baseConf : null,
      studyType: studyType ? baseConf : null,
      startDate: startDate.value ? startDate.conf ?? baseConf : null,
      endDate: endDate.value ? endDate.conf ?? baseConf : null,
      score: score ? baseConf : null,
      location: null,
      achievements: achievements.length > 0 ? baseConf : null,
    } as StrictProfileOut["education"][number]["confidences"];

    const provenanceBase = buildFieldProvenance(source, section ?? "education");

    return {
      institution,
      area,
      studyType,
      startDate: startDate.value,
      endDate: isCurrent ? null : endDate.value,
      score,
      location: "",
      achievements,
      confidences: itemConf,
      provenance: {
        institution: institution ? provenanceBase : undefined,
        area: area ? provenanceBase : undefined,
        studyType: studyType ? provenanceBase : undefined,
        startDate: startDate.value ? provenanceBase : undefined,
        endDate: endDate.value || isCurrent ? provenanceBase : undefined,
        score: score ? provenanceBase : undefined,
        location: undefined,
        achievements: achievements.length ? provenanceBase : undefined,
      },
    };
  }

  function deriveSkillItems(
    text: string | null | undefined,
    confidence: number | null | undefined,
    source: CandidateSource,
    section: string | null | undefined
  ): StrictProfileOut["skills"] {
    if (!text) return [];
    const tokens = splitList(text);
    if (!tokens.length) return [];
    const baseConf = clamp01(Number(confidence ?? 0.6) || 0.6);
    const provenanceBase = buildFieldProvenance(source, section ?? "skills");
    const seen = new Set<string>();
    const out: StrictProfileOut["skills"] = [];
    for (const rawToken of tokens) {
      const token = normalizeWhitespace(rawToken);
      if (!token) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const levelMatch = /\(([^)]+)\)$/i.exec(token);
      const level = levelMatch ? normalizeWhitespace(levelMatch[1]) : null;
      const name = levelMatch ? normalizeWhitespace(token.replace(levelMatch[0], "")) : token;
      out.push({
        name,
        level,
        confidences: {
          name: name ? baseConf : null,
          level: level ? baseConf : null,
        },
        provenance: {
          name: provenanceBase,
          level: level ? provenanceBase : undefined,
        },
      });
    }
    return out;
  }

  function deriveLanguageItems(
    text: string | null | undefined,
    confidence: number | null | undefined,
    source: CandidateSource,
    section: string | null | undefined
  ): StrictProfileOut["languages"] {
    if (!text) return [];
    const tokens = splitList(text);
    if (!tokens.length) return [];
    const baseConf = clamp01(Number(confidence ?? 0.6) || 0.6);
    const provenanceBase = buildFieldProvenance(source, section ?? "languages");
    const seen = new Set<string>();
    const out: StrictProfileOut["languages"] = [];
    for (const rawToken of tokens) {
      const token = normalizeWhitespace(rawToken);
      if (!token) continue;
      const levelMatch = /\(([^)]+)\)$/i.exec(token);
      const fluency = levelMatch ? normalizeWhitespace(levelMatch[1]) : "";
      const languageName = levelMatch ? normalizeWhitespace(token.replace(levelMatch[0], "")) : token;
      const key = languageName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        language: languageName,
        fluency,
        confidences: {
          language: languageName ? baseConf : null,
          fluency: fluency ? baseConf : null,
        },
        provenance: {
          language: provenanceBase,
          fluency: fluency ? provenanceBase : undefined,
        },
      });
    }
    return out;
  }

  const dedupeEducation = (items: StrictProfileOut["education"]): StrictProfileOut["education"] => {
    const seen = new Set<string>();
    return items.filter((item: StrictProfileOut["education"][number]) => {
      const key = [item.institution, item.studyType, item.area, item.startDate, item.endDate]
        .map((v) => (v || "").toLowerCase())
        .join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(item.institution || item.studyType || item.area);
    });
  };

  const dedupeSkills = (items: StrictProfileOut["skills"]): StrictProfileOut["skills"] => {
    const seen = new Set<string>();
    return items.filter((item: StrictProfileOut["skills"][number]) => {
      const key = (item.name || "").toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const dedupeLanguages = (items: StrictProfileOut["languages"]): StrictProfileOut["languages"] => {
    const seen = new Set<string>();
    return items.filter((item: StrictProfileOut["languages"][number]) => {
      const key = (item.language || "").toLowerCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const mappedCv = params.mappedCv as unknown;
  const rawExperience: RawExpItem[] =
    mappedCv && typeof mappedCv === "object" && Array.isArray((mappedCv as any).experience)
      ? ((mappedCv as any).experience as RawExpItem[])
      : [];

  const expItems = rawExperience
    .map((it) => (it && typeof it === "object" ? (it as RawExpItem) : null))
    .filter((x): x is RawExpItem => !!x);

  const textConfBase = 0.6 * (0.75 + 0.25 * globalLLMConf);

  const normalizedExperience = expItems.map((item) => {
    const company = typeof item.company === "string" ? item.company.trim() : "";
    const position = typeof item.position === "string" ? item.position.trim() : "";
    const sd = toISOOrYear(item.startDate);
    const ed = toISOOrYear(item.endDate);

    const hasIsCurrent = typeof item.isCurrent === "boolean";
    const isCurrent = hasIsCurrent ? Boolean(item.isCurrent) : false;

    const ach: string[] = Array.isArray(item.achievements)
      ? (item.achievements as unknown[]).map((a) => (typeof a === "string" ? a.trim() : "")).filter((s) => s.length > 0)
      : [];

    const rawResponsibilities: string = (() => {
      const fromMapped = (item as any).responsibilities;
      if (Array.isArray(fromMapped)) {
        return fromMapped
          .map((entry: unknown) => (typeof entry === "string" ? entry : ""))
          .filter((entry) => entry.length > 0)
          .join(" ");
      }
      if (typeof fromMapped === "string") return fromMapped;
      if (typeof (item as any).summary === "string") return (item as any).summary;
      if (typeof (item as any).description === "string") return (item as any).description;
      return "";
    })();
    const responsibilities = normalizeWhitespace(rawResponsibilities);

    return {
      company,
      position,
      startDate: sd.value,
      endDate: isCurrent ? null : ed.value,
      isCurrent,
      achievements: ach,
      responsibilities: responsibilities || null,
      confidences: {
        company: company ? clamp01(textConfBase) : null,
        position: position ? clamp01(textConfBase) : null,
        startDate: sd.value ? sd.conf : null,
        endDate: ed.value ? ed.conf : null,
        isCurrent: hasIsCurrent ? 0.8 : null,
        achievements: ach.length > 0 ? 0.7 : null,
        responsibilities: responsibilities ? clamp01(textConfBase) : null,
      },
      provenance: {
        company: company ? buildFieldProvenance("llm", "experience") : undefined,
        position: position ? buildFieldProvenance("llm", "experience") : undefined,
        startDate: sd.value ? buildFieldProvenance("llm", "experience") : undefined,
        endDate: ed.value ? buildFieldProvenance("llm", "experience") : undefined,
        isCurrent: hasIsCurrent ? buildFieldProvenance("llm", "experience") : undefined,
        achievements: ach.length > 0 ? buildFieldProvenance("llm", "experience") : undefined,
        responsibilities: responsibilities ? buildFieldProvenance("llm", "experience") : undefined,
      },
    };
  });

  // Experience fallback: derive from parsedSections/rawText when mappedCv experience is absent
  const experienceFromSections: StrictProfileOut["experience"] = (() => {
    const expSection = sections.find(
      (s) =>
        String(s.fieldKey || "").toLowerCase() === "experience" ||
        /experience|employment/i.test(String(s.title || ""))
    );
    const source =
      typeof expSection?.content === "string" && expSection.content.trim().length > 0
        ? expSection.content
        : rawText;
    const lines = String(source || "")
      .split(/\r?\n/)
      .map((l) => l.trim());

    const items: StrictProfileOut["experience"] = [];
    const buildHeuristicExperienceCandidate = (
      value: string | null | undefined,
      conf: number | null | undefined
    ) => applySectionBonus(makeCandidate(value, conf, "heuristic", "experience"), "experience");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // Header pattern: "Position at Company" possibly with trailing noise
      const m = /^(.+?)\s+at\s+(.+?)\s*(?:[—-].*)?$/i.exec(line);
      if (!m) continue;
      const posRaw = m[1].trim();
      const compRaw = m[2].trim().replace(/\s*[—-]\s*$/, "");
      if (!posRaw || !compRaw) continue;

      // Dates: search same line or next few lines
      let startDate: string | null = null;
      let endDate: string | null = null;
      let isCurrent = false;
      const searchWindow = [line, lines[i + 1] || "", lines[i + 2] || "", lines[i + 3] || ""].join(" ");
      const normalizedWindow = normalizeMonthTokens(searchWindow);
      const dm = /([A-Za-z]{3,9}\s+\d{4})\s*[-]\s*(Present|[A-Za-z]{3,9}\s+\d{4})/i.exec(normalizedWindow);
      if (dm) {
        const sd = dm[1];
        const ed = dm[2];
        const sdNorm = toISOOrYear(sd);
        const edNorm = /present/i.test(ed) ? { value: null, conf: null } : toISOOrYear(ed);
        startDate = sdNorm.value;
        endDate = edNorm.value;
        isCurrent = /present/i.test(ed);
      } else {
        // Year-only range: "YYYY — YYYY|Present"
        const yOnly = /(?:^|\s)(\d{4})\s*[—-]\s*(Present|\d{4})(?:\s|$)/i.exec(searchWindow);
        if (yOnly) {
          const ys = yOnly[1];
          const ye = yOnly[2];
          const sdNorm = toISOOrYear(ys);
          const edNorm = /present/i.test(ye) ? { value: null, conf: null } : toISOOrYear(ye);
          startDate = sdNorm.value;
          endDate = edNorm.value;
          isCurrent = /present/i.test(ye);
        }
      }

      // Achievements & responsibilities: collect bullet and non-bullet lines after header
      const ach: string[] = [];
      const descriptionParts: string[] = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
        const l2 = lines[j];
        if (!l2) break;
        if (/^\s*$/.test(l2)) break;
        if (/^.+\s+at\s+.+$/i.test(l2)) break;
        const bm = /^(\*|\-|•|\u2022|–)\s+(.*)$/.exec(l2);
        if (bm) {
          const txt = bm[2].trim().replace(/\s+/g, " ");
          if (txt.length > 4) ach.push(txt);
        } else {
          const txt = l2.trim();
          if (txt.length > 4) descriptionParts.push(txt);
        }
      }
      const responsibilitiesText = descriptionParts.length ? normalizeWhitespace(descriptionParts.join(" ")) : "";

      const confBase = clamp01(0.55 * (0.75 + 0.25 * globalLLMConf));
      const sdConf = startDate ? (/\d{4}-\d{2}-\d{2}/.test(startDate) ? 0.75 : 0.55) : null;
      const edConf = endDate ? (/\d{4}-\d{2}-\d{2}/.test(endDate) ? 0.75 : 0.55) : null;

      const companyCandidate = buildHeuristicExperienceCandidate(compRaw, compRaw ? confBase : null);
      const positionCandidate = buildHeuristicExperienceCandidate(posRaw, posRaw ? confBase : null);
      const startCandidate = buildHeuristicExperienceCandidate(startDate, startDate ? sdConf : null);
      const endCandidate = buildHeuristicExperienceCandidate(endDate, endDate ? edConf : null);

      items.push({
        company: (companyCandidate.value ?? "").replace(/\s{2,}/g, " "),
        position: positionCandidate.value ?? "",
        startDate: startCandidate.value ?? null,
        endDate: endCandidate.value ?? null,
        isCurrent,
        achievements: ach,
        responsibilities: responsibilitiesText || null,
        confidences: {
          company: companyCandidate.conf ?? null,
          position: positionCandidate.conf ?? null,
          startDate: startCandidate.conf ?? null,
          endDate: endCandidate.conf ?? null,
          isCurrent: typeof isCurrent === "boolean" ? 0.7 : null,
          achievements: ach.length > 0 ? 0.65 : null,
          responsibilities: responsibilitiesText ? confBase : null,
        },
        provenance: {
          company: companyCandidate.value ? candidateToProvenance(companyCandidate) : undefined,
          position: positionCandidate.value ? candidateToProvenance(positionCandidate) : undefined,
          startDate: startCandidate.value ? candidateToProvenance(startCandidate) : undefined,
          endDate: endCandidate.value ? candidateToProvenance(endCandidate) : undefined,
          isCurrent: typeof isCurrent === "boolean" ? buildFieldProvenance("heuristic", "experience") : undefined,
          achievements: ach.length > 0 ? buildFieldProvenance("heuristic", "experience") : undefined,
          responsibilities: responsibilitiesText ? buildFieldProvenance("heuristic", "experience") : undefined,
        },
      });

      if (items.length >= 4) break;
    }
    return items;
  })();

  // NER-derived experience fallback (only if no normalized or section-derived items)
  const nerExperience: StrictProfileOut["experience"] = (() => {
    if (normalizedExperience.length > 0 || experienceFromSections.length > 0) return [];
    const nerORG = parsedNER
      .filter((e) => e.label.toUpperCase() === "ORG")
      .sort((a, b) => a.start - b.start);

    if (nerORG.length === 0) return [];

    // Build up to 2 basic items from ORG + optional DATE pairs
    const maxItems = Math.min(2, nerORG.length);
    const items: StrictProfileOut["experience"] = [];
    const buildNerExperienceCandidate = (
      value: string | null | undefined,
      conf: number | null | undefined,
      section: string | null | undefined
    ) => applySectionBonus(makeCandidate(value, conf, "ner", section ?? "experience"), "experience");
    for (let i = 0; i < maxItems; i++) {
      const org = nerORG[i];
      const company = String(org.text).trim();
      const sdRaw = nerDateTexts[i * 2] ?? null;
      const edRaw = nerDateTexts[i * 2 + 1] ?? null;

      const sd = sdRaw ? toISOOrYear(sdRaw) : { value: null, conf: null };
      let ed = { value: null as string | null, conf: null as number | null };
      let isCurrent = false;
      if (edRaw) {
        if (/present/i.test(edRaw)) {
          isCurrent = true;
          ed = { value: null, conf: null };
        } else {
          ed = toISOOrYear(edRaw);
        }
      }

      const orgSection = getEntitySection(org) ?? "experience";
      const companyCandidate = buildNerExperienceCandidate(company, company ? nerConfBase : null, orgSection);
      const startCandidate = buildNerExperienceCandidate(sd.value, sd.value ? sd.conf : null, orgSection);
      const endCandidate = buildNerExperienceCandidate(ed.value, ed.value ? ed.conf : null, orgSection);

      items.push({
        company: companyCandidate.value ?? "",
        position: "",
        startDate: startCandidate.value ?? null,
        endDate: endCandidate.value ?? null,
        isCurrent,
        achievements: [],
        responsibilities: null,
        confidences: {
          company: companyCandidate.conf ?? null,
          position: null,
          startDate: startCandidate.conf ?? null,
          endDate: endCandidate.conf ?? null,
          isCurrent: isCurrent ? 0.7 : null,
          achievements: null,
          responsibilities: null,
        },
        provenance: {
          company: companyCandidate.conf ? buildFieldProvenance("ner", orgSection ?? "experience") : undefined,
          position: undefined,
          startDate: startCandidate.conf ? buildFieldProvenance("ner", orgSection ?? "experience") : undefined,
          endDate: endCandidate.conf ? buildFieldProvenance("ner", orgSection ?? "experience") : undefined,
          isCurrent: isCurrent ? buildFieldProvenance("ner", orgSection ?? "experience") : undefined,
          achievements: undefined,
          responsibilities: undefined,
        },
      });
    }
    return items;
  })();

  const effectiveExperience =
    normalizedExperience.length > 0
      ? normalizedExperience
      : (experienceFromSections.length > 0 ? experienceFromSections : nerExperience);

  const rawEducationMapped: RawEducationItem[] =
    mappedCv && typeof mappedCv === "object" && Array.isArray((mappedCv as any).education)
      ? ((mappedCv as any).education as RawEducationItem[])
      : [];

  const mappedEducation = rawEducationMapped
    .map((item) => {
      const textParts = [item.title, item.content].filter((x) => typeof x === "string") as string[];
      if (!textParts.length) return null;
      const text = textParts.join("\n");
      const conf = clamp01(Number((item as any)?.confidence ?? textConfBase));
      return deriveEducationFromText(text, conf, "llm", "education");
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const educationFromSections: StrictProfileOut["education"] = (() => {
    const eduSections = sections.filter((s) => String(s.fieldKey || "").toLowerCase() === "education");
    if (!eduSections.length) return [];
    const out: StrictProfileOut["education"] = [];
    for (const sec of eduSections) {
      const text = String(sec.content || "");
      if (!text.trim()) continue;
      out.push(
        deriveEducationFromText(text, clamp01(Number(sec.confidence ?? textConfBase)), "heuristic", sec.fieldKey ?? "education")
      );
    }
    return out;
  })();

  const nerEducation: StrictProfileOut["education"] = (() => {
    const degreeEntities = parsedNER.filter((e) => e.label.toUpperCase() === "DEGREE");
    if (!degreeEntities.length) return [];
    const institutionEntities = parsedNER.filter((e) => e.label.toUpperCase() === "INSTITUTION");
    const findClosestInstitution = (entity: typeof degreeEntities[number]) => {
      let closest: typeof institutionEntities[number] | null = null;
      let minDelta = Infinity;
      for (const inst of institutionEntities) {
        const delta = Math.abs((inst.start ?? 0) - (entity.start ?? 0));
        if (delta < minDelta) {
          minDelta = delta;
          closest = inst;
        }
      }
      return closest;
    };
    return degreeEntities.map((deg) => {
      const studyType = normalizeWhitespace(deg.text || "");
      const institutionEntity = findClosestInstitution(deg);
      const institution = institutionEntity ? normalizeWhitespace(institutionEntity.text || "") : "";
      const provenanceStudy = buildFieldProvenance("ner", getEntitySection(deg));
      const provenanceInstitution = institutionEntity
        ? buildFieldProvenance("ner", getEntitySection(institutionEntity))
        : buildFieldProvenance("ner", getEntitySection(deg));
      return {
        institution,
        area: "",
        studyType,
        startDate: null,
        endDate: null,
        score: "",
        location: "",
        achievements: [],
        confidences: {
          institution: institution ? nerConfBase : null,
          area: null,
          studyType: studyType ? nerConfBase : null,
          startDate: null,
          endDate: null,
          score: null,
          location: null,
          achievements: null,
        },
        provenance: {
          institution: institution ? provenanceInstitution : undefined,
          area: undefined,
          studyType: studyType ? provenanceStudy : undefined,
          startDate: undefined,
          endDate: undefined,
          score: undefined,
          location: undefined,
          achievements: undefined,
        },
      };
    });
  })();

  const education = dedupeEducation([
    ...mappedEducation,
    ...educationFromSections,
    ...nerEducation,
  ]);

  const educationTelemetrySource: TelemetrySource = mappedEducation.length > 0
    ? "llm"
    : educationFromSections.length > 0
      ? "heuristic"
      : nerEducation.length > 0
        ? "ner"
        : "unknown";

  const mappedSkillsSource: RawSkillSource | null =
    mappedCv && typeof mappedCv === "object" && (mappedCv as any).skills
      ? ((mappedCv as any).skills as RawSkillSource)
      : null;

  const skillsFromMapped = deriveSkillItems(
    mappedSkillsSource?.text as string | null | undefined,
    mappedSkillsSource?.confidence as number | null | undefined,
    "llm",
    "skills"
  );

  const skillsFromSections = sections
    .filter((s) => String(s.fieldKey || "").toLowerCase() === "skills")
    .flatMap((sec) =>
      deriveSkillItems(sec.content, clamp01(Number(sec.confidence ?? textConfBase)), "heuristic", sec.fieldKey ?? "skills")
    );

  const skillsFromNER = parsedNER
    .filter((e) => ["SKILL", "HARD_SKILL", "SOFT_SKILL"].includes(e.label.toUpperCase()))
    .map((entity) => {
      const items = deriveSkillItems(String(entity.text || ""), nerConfBase, "ner", getEntitySection(entity) ?? "skills");
      return items[0] ?? null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const skills = dedupeSkills([...skillsFromMapped, ...skillsFromSections, ...skillsFromNER]);

  const skillsTelemetrySource: TelemetrySource = skillsFromMapped.length > 0
    ? "llm"
    : skillsFromSections.length > 0
      ? "heuristic"
      : skillsFromNER.length > 0
        ? "ner"
        : "unknown";

  const mappedLanguagesSource: RawLanguageSource | null =
    mappedCv && typeof mappedCv === "object" && (mappedCv as any).languages
      ? ((mappedCv as any).languages as RawLanguageSource)
      : null;

  const languagesFromMapped = deriveLanguageItems(
    mappedLanguagesSource?.text as string | null | undefined,
    mappedLanguagesSource?.confidence as number | null | undefined,
    "llm",
    "languages"
  );

  const languagesFromSections = sections
    .filter((s) => String(s.fieldKey || "").toLowerCase() === "languages")
    .flatMap((sec) =>
      deriveLanguageItems(sec.content, clamp01(Number(sec.confidence ?? textConfBase)), "heuristic", sec.fieldKey ?? "languages")
    );

  const languagesFromNER = parsedNER
    .filter((e) => e.label.toUpperCase() === "LANGUAGE")
    .map((entity) => {
      const items = deriveLanguageItems(String(entity.text || ""), nerConfBase, "ner", getEntitySection(entity) ?? "languages");
      return items[0] ?? null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const languages = dedupeLanguages([...languagesFromMapped, ...languagesFromSections, ...languagesFromNER]);

  const languagesTelemetrySource: TelemetrySource = languagesFromMapped.length > 0
    ? "llm"
    : languagesFromSections.length > 0
      ? "heuristic"
      : languagesFromNER.length > 0
        ? "ner"
        : "unknown";

  const experienceTelemetrySource: TelemetrySource = normalizedExperience.length > 0
    ? "llm"
    : experienceFromSections.length > 0
      ? "heuristic"
      : nerExperience.length > 0
        ? "ner"
        : "unknown";

  effectiveExperience.forEach((item: StrictProfileOut["experience"][number], index: number) => {
    emitTelemetry({
      slot: "experience.company",
      source: experienceTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: experienceTelemetrySource,
        winnerConf: item?.confidences?.company ?? null,
        winnerSection: "experience",
        hasValue: Boolean(item?.company),
      },
    });

    emitTelemetry({
      slot: "experience.position",
      source: experienceTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: experienceTelemetrySource,
        winnerConf: item?.confidences?.position ?? null,
        winnerSection: "experience",
        hasValue: Boolean(item?.position),
      },
    });

    emitTelemetry({
      slot: "experience.responsibilities",
      source: experienceTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.responsibilities?.source ?? experienceTelemetrySource),
        winnerConf: item?.confidences?.responsibilities ?? null,
        winnerSection: "experience",
        hasValue: Boolean(item?.responsibilities),
      },
    });
  });

  education.forEach((item: StrictProfileOut["education"][number], index: number) => {
    emitTelemetry({
      slot: "education.institution",
      source: educationTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.institution?.source ?? educationTelemetrySource),
        winnerConf: item.confidences?.institution ?? null,
        winnerSection: "education",
        hasValue: Boolean(item.institution),
      },
    });

    emitTelemetry({
      slot: "education.studyType",
      source: educationTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.studyType?.source ?? educationTelemetrySource),
        winnerConf: item.confidences?.studyType ?? null,
        winnerSection: "education",
        hasValue: Boolean(item.studyType),
      },
    });
  });

  skills.forEach((item: StrictProfileOut["skills"][number], index: number) => {
    emitTelemetry({
      slot: "skills.name",
      source: skillsTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.name?.source ?? skillsTelemetrySource),
        winnerConf: item.confidences?.name ?? null,
        winnerSection: "skills",
        hasValue: Boolean(item.name),
      },
    });
  });

  languages.forEach((item: StrictProfileOut["languages"][number], index: number) => {
    emitTelemetry({
      slot: "languages.language",
      source: languagesTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.language?.source ?? languagesTelemetrySource),
        winnerConf: item.confidences?.language ?? null,
        winnerSection: "languages",
        hasValue: Boolean(item.language),
      },
    });

    emitTelemetry({
      slot: "languages.fluency",
      source: languagesTelemetrySource,
      reason: "final",
      extra: {
        index,
        winnerSource: asTelemetrySource(item.provenance?.fluency?.source ?? languagesTelemetrySource),
        winnerConf: item.confidences?.fluency ?? null,
        winnerSection: "languages",
        hasValue: Boolean(item.fluency),
      },
    });
  });

  // Root-level achievements: mappedCv -> parsedSections -> rawText fallback
  const rootAchievementsData = (() => {
    let source: CandidateSource = "fallback";
    let sectionLabel: string | null = "achievements";
    // 1) Prefer mappedCv.achievements.text
    const a = mappedCv && typeof mappedCv === "object" ? (mappedCv as any).achievements : null;
    const text1: string | null =
      a && typeof a === "object" && a !== null && typeof (a as any).text === "string" ? String((a as any).text) : null;
    if (text1 && text1.trim()) {
      const arr = text1
        .split(/[\r\n]+|[•\u2022]/g)
        .map((s: string) => s.replace(/^[\-\*\u2022•\s]+/, "").trim())
        .filter((s: string) => s.length > 0);
      if (arr.length > 0) {
        source = "llm";
        return { items: arr, source, section: sectionLabel };
      }
    }
    // 2) Try parsedSections Achievements content
    const achSection = sections.find(
      (s) =>
        String(s.fieldKey || "").toLowerCase() === "achievements" ||
        /achievements?/i.test(String(s.title || ""))
    );
    if (achSection && typeof achSection.content === "string" && achSection.content.trim().length > 0) {
      const arr = deriveAchievementsFromText(achSection.content);
      if (arr.length > 0) {
        source = "heuristic";
        sectionLabel = achSection.fieldKey ?? "achievements";
        return { items: arr, source, section: sectionLabel };
      }
    }
    // 3) Fallback: derive from raw text (top bullets)
    const arr = deriveAchievementsFromText(rawText);
    return { items: arr, source, section: sectionLabel };
  })();

  const rootAchievements = rootAchievementsData.items;
  const achievementsProvenance = rootAchievements.length
    ? buildFieldProvenance(rootAchievementsData.source, rootAchievementsData.section)
    : undefined;

  const draft: StrictProfileOut = {
    // Sanitize name at write-time to avoid country/location values like "United States"
    name: (() => {
      const val = fusedName.value;
      if (!val) return val;
      const nv = String(val).trim().toLowerCase();
      const lv = String(fusedLocation.value ?? "").toLowerCase();
      if ((nv.length > 0 && NAME_BLACKLIST.has(nv)) || (nv.length > 2 && lv.includes(nv))) return null;
      return val;
    })(),
    email: fusedEmail.value,
    phone: fusedPhone.value,
    location: fusedLocation.value,
    experience: effectiveExperience,
    education,
    skills,
    languages,
    achievements: rootAchievements,
    confidences: {
      name: fusedName.conf ?? null,
      email: fusedEmail.conf ?? null,
      phone: fusedPhone.conf ?? null,
      location: fusedLocation.conf ?? null,
    },
    provenance: {
      name: candidateToProvenance(fusedName),
      email: candidateToProvenance(fusedEmail),
      phone: candidateToProvenance(fusedPhone),
      location: candidateToProvenance(fusedLocation),
      achievements: achievementsProvenance,
    },
  };

  // Validate and apply defaults
  return Schema.parse(draft);
}
