/* eslint-disable no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { z } from "zod";

import {
  PROPOSAL_PLANNER_OPENING_STRATEGIES,
  buildProposalEvidenceSummary,
  type ProposalPlannerResult,
} from "./proposalPlanner";
import {
  formatCompanyValuesPromptBlock,
  type CompanyValuesPack,
} from "./companyValues";
import { PROPOSAL_VOICE_PRESET_IDS, type ProposalVoicePreset } from "./voicePresets";

export const STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA_VERSION = 1 as const;
export const STRUCTURED_COVER_LETTER_PLAN_LANGUAGES = ["en", "fr"] as const;
export const STRUCTURED_COVER_LETTER_PARAGRAPH_ROLES = [
  "opening",
  "evidence",
  "motivation",
] as const;

export type StructuredCoverLetterPlanLanguage =
  (typeof STRUCTURED_COVER_LETTER_PLAN_LANGUAGES)[number];
export type StructuredCoverLetterParagraphRole =
  (typeof STRUCTURED_COVER_LETTER_PARAGRAPH_ROLES)[number];

export const STRUCTURED_COVER_LETTER_PARAGRAPH_SCHEMA = z
  .object({
    role: z.enum(STRUCTURED_COVER_LETTER_PARAGRAPH_ROLES),
    fact_ids: z.array(z.number().int().nonnegative()).max(3),
    theme_ids: z.array(z.number().int().nonnegative()).max(3),
    intent_label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA = z
  .object({
    schema_version: z.literal(STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA_VERSION),
    format: z.literal("cover_letter"),
    language: z.enum(STRUCTURED_COVER_LETTER_PLAN_LANGUAGES),
    voice_preset: z.enum(PROPOSAL_VOICE_PRESET_IDS),
    opening_strategy: z.enum(PROPOSAL_PLANNER_OPENING_STRATEGIES),
    no_context_mode: z.boolean(),
    body_paragraphs: z
      .array(STRUCTURED_COVER_LETTER_PARAGRAPH_SCHEMA)
      .min(2)
      .max(3),
  })
  .strict();

export type StructuredCoverLetterContentPlan = z.infer<
  typeof STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA
>;
export type StructuredCoverLetterParagraphPlan =
  StructuredCoverLetterContentPlan["body_paragraphs"][number];

type StyleAnchorPack = {
  tone: string;
  positive: string[];
  negative: string[];
};

type BodyExamplePack = {
  acceptable: string[];
  unacceptable: string[];
};

const STRUCTURED_BODY_STYLE_ANCHORS: Record<
  ProposalVoicePreset,
  StyleAnchorPack
> = {
  signature: {
    tone: "Balanced, natural, credible, and grounded.",
    positive: [
      "I built...",
      "My work involved...",
      "In a recent project...",
      "What interests me about this role is...",
    ],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  expert: {
    tone: "Precise, structured, and evidence-led.",
    positive: [
      "I led...",
      "My experience includes...",
      "One example of my work involved...",
      "This role stands out to me because...",
    ],
    negative: [
      "aligns with",
      "deep passion for",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  direct: {
    tone: "Tight, clear, and concise without losing useful detail.",
    positive: [
      "I built...",
      "I improved...",
      "My work included...",
      "What interests me about this role is...",
    ],
    negative: [
      "aligns with",
      "resonates with",
      "I am writing to express my interest",
      "excited about the opportunity",
    ],
  },
  engaging: {
    tone: "Warm, human, and professional without HR cliches.",
    positive: [
      "One aspect of my work involved...",
      "I enjoyed...",
      "My work involved...",
      "What interests me about this role is...",
    ],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  storyteller: {
    tone: "Smooth, coherent, and grounded in a clear through-line.",
    positive: [
      "A recent part of my work involved...",
      "That experience led me to...",
      "My work included...",
      "What interests me about this role is...",
    ],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
};

const STRUCTURED_BODY_EXAMPLES: Record<
  StructuredCoverLetterPlanLanguage,
  BodyExamplePack
> = {
  en: {
    acceptable: [
      "I led a design system migration across four product squads, which helped standardize UI work and speed up iteration.",
      "What interests me about this role is the combination of reusable UI systems, performance work, and close collaboration with product and design.",
    ],
    unacceptable: [
      "My background aligns with your needs and makes me particularly compelling for this opportunity.",
      "I am excited about the opportunity and eager to contribute my passion to your team.",
    ],
  },
  fr: {
    acceptable: [
      "J'ai mené une migration de design system utilisée par quatre squads produit, ce qui a permis de rendre le travail UI plus cohérent.",
      "Ce poste m'intéresse pour son mélange de systèmes UI réutilisables, de performance et de collaboration avec le produit et le design.",
    ],
    unacceptable: [
      "Mon parcours correspond particulièrement bien à vos besoins et rend cette opportunité très convaincante.",
      "Je suis très enthousiaste à l'idée de rejoindre votre équipe et d'y apporter ma passion.",
    ],
  },
};

const ENGLISH_BODY_META_PATTERNS = [
  /\bhere(?:'s| is)\b/i,
  /\bbelow is\b/i,
  /\bcover letter\b[:\s]/i,
  /\bapplication\b[:\s]/i,
] as const;

const FRENCH_BODY_META_PATTERNS = [
  /\bvoici\b/i,
  /\bci-dessous\b/i,
  /\blettre de motivation\b[:\s]/i,
  /\bcandidature\b[:\s]/i,
] as const;

const FORBIDDEN_BODY_PATTERNS = [
  /^\s*dear hiring manager,?\s*$/i,
  /^\s*madame,?\s+monsieur,?\s*$/i,
  /^\s*(?:sincerely|kind regards|best regards|warm regards),?\s*$/i,
  /^\s*(?:cordialement|bien cordialement|avec mes salutations),?\s*$/i,
  /^\s*(?:i would welcome the opportunity to discuss|je serais disponible pour échanger)\b/i,
  /^\s*[-*]\s+/m,
  /^\s*\d+\.\s+/m,
  /^\s*#+\s+/m,
  /^\s*```/m,
];

const FORBIDDEN_BODY_INLINE_PATTERNS = [
  /\bdear hiring manager\b/i,
  /\bmadame,\s+monsieur\b/i,
  /\b(?:sincerely|kind regards|best regards|warm regards)\b/i,
  /\b(?:cordialement|bien cordialement|avec mes salutations)\b/i,
  /\b(?:i would welcome the opportunity to discuss|i['’]d welcome the opportunity to discuss)\b/i,
  /\bje serais disponible pour échanger\b/i,
  /\bthank you for considering my application\b/i,
  /\bthank you for your time and consideration\b/i,
  /\bmerci de l['’]attention portée à ma candidature\b/i,
  /\bmerci pour votre temps et votre considération\b/i,
] as const;

const FORBIDDEN_BODY_CLICHE_PATTERNS = [
  /\baligns?(?:\s+well)?\s+with\b/i,
  /\bresonates with\b/i,
  /\bparticularly compelling\b/i,
  /\bexcited about the opportunity\b/i,
  /\bi am writing to express(?: my)? interest\b/i,
  /\bi['’]m excited to apply\b/i,
  /\bi am excited to apply\b/i,
  /\bmy background aligns with\b/i,
  /\bprepared to adapt quickly\b/i,
  /\beager to contribute\b/i,
  /\bshare(?:s)? (?:the )?company(?:'s)? values\b/i,
  /\bcontribute to (?:these|your) efforts\b/i,
  /\badd value\b/i,
] as const;

const REPEATED_RHETORICAL_STEM_PATTERNS: ReadonlyArray<{
  id: string;
  pattern: RegExp;
}> = [
  {
    id: "interest_opening",
    pattern:
      /^(?:what interests me(?: about this role)?|what draws me(?: to this role)?|i(?:'m| am) interested in|i(?:'m| am) drawn to|ce qui m['’]?interesse|ce qui m['’]?attire|ce poste m['’]?interesse|je suis interesse(?:e)? par)\b/i,
  },
  {
    id: "role_stands_out",
    pattern:
      /^(?:this role stands out|the role stands out|the position stands out|this work stands out|what stands out to me(?: about (?:this role|the work))?|ce poste se distingue|ce qui ressort pour moi)\b/i,
  },
] as const;

const WEAK_TRANSFER_CLICHE_PATTERNS = [
  /\b(?:translate|translates|translated|translating)\s+(?:directly|well)?\s+to\b/i,
  /\b(?:provides?|provided)\s+(?:a|the)?\s*(?:strong|solid)\s+foundation\s+for\b/i,
  /\b(?:positions?|positioned)\s+me\s+to\b/i,
  /\b(?:prepared|prepares?)\s+me\s+for\b/i,
  /\b(?:transfer(?:s|able)?|transferring)\s+(?:directly|well)?\s+(?:to|into)\b/i,
  /\b(?:bridge|bridges|bridging)\s+(?:naturally|directly)?\s+(?:to|into)\b/i,
  /\b(?:se transpose|se traduit|me prepare)\s+(?:directement|bien)?\s+(?:a|au|vers)\b/i,
] as const;

const WORK_LEVEL_MOTIVATION_PATTERNS = [
  /\b(?:day[- ]to[- ]day|working on|building|supporting|maintaining|improving|partnering|collaborating|shipping|operating|workflow|workflows|process|processes|records|systems|product|design|customer|users?|team|teams)\b/i,
  /\b(?:quotidien|travailler sur|construire|maintenir|ameliorer|collaborer|coordination|processus|operations?|systemes?|produit|design|client|equipe|equipes)\b/i,
] as const;

const ENGLISH_BODY_LANGUAGE_MARKERS = [
  "role",
  "position",
  "team",
  "experience",
  "work",
  "product",
  "design",
  "engineer",
  "support",
];

const FRENCH_BODY_LANGUAGE_MARKERS = [
  "poste",
  "équipe",
  "expérience",
  "travail",
  "produit",
  "conception",
  "ingénieur",
  "candidature",
];

const FRENCH_DIACRITICS_GLOBAL_PATTERN = /[éèêëàâäôöûüçœæÿ]/gi;
const BODY_LOW_SUBSTANCE_STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "again",
  "also",
  "and",
  "avec",
  "been",
  "being",
  "between",
  "ce",
  "ces",
  "cette",
  "dans",
  "des",
  "for",
  "from",
  "have",
  "into",
  "more",
  "pour",
  "that",
  "the",
  "their",
  "this",
  "through",
  "using",
  "with",
  "your",
]);
const MIN_WORDS_BY_ROLE: Record<StructuredCoverLetterParagraphRole, number> = {
  opening: 8,
  evidence: 10,
  motivation: 8,
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactParagraphSpacing(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitParagraphs(text: string): string[] {
  return compactParagraphSpacing(text)
    .split(/\n{2,}/)
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean);
}

function splitSentences(value: string): string[] {
  const protectedValue = value
    .replace(/\bPvt\.(?=\s|$)/g, "Pvt__DOT__")
    .replace(/\bLtd\.(?=\s|$)/g, "Ltd__DOT__")
    .replace(/\bSt\.(?=\s|$)/g, "St__DOT__")
    .replace(/\bInc\.(?=\s|$)/g, "Inc__DOT__")
    .replace(/\bCo\.(?=\s|$)/g, "Co__DOT__")
    .replace(/\bCorp\.(?=\s|$)/g, "Corp__DOT__");
  const matches = protectedValue.match(/[^.!?\n]+(?:[.!?]+|$)/g);
  if (!matches) return compactWhitespace(value) ? [compactWhitespace(value)] : [];
  return matches
    .map((sentence) =>
      compactWhitespace(sentence.replace(/__DOT__/g, ".")),
    )
    .filter(Boolean);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}+/gu, "");
}

function normalizeForMatch(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  const normalized = stripAccents(text).toLowerCase();
  return markers.reduce((count, marker) => {
    const escaped = stripAccents(marker).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
    return count + (pattern.test(normalized) ? 1 : 0);
  }, 0);
}

function extractMeaningfulTokens(value: string): string[] {
  return Array.from(
    new Set(
      normalizeForMatch(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) => token.length >= 4 && !BODY_LOW_SUBSTANCE_STOPWORDS.has(token),
        ),
    ),
  );
}

function countTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(extractMeaningfulTokens(left));
  if (leftTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of extractMeaningfulTokens(right)) {
    if (leftTokens.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}

function countWords(value: string): number {
  return compactWhitespace(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function firstWord(value: string): string | null {
  const match = compactWhitespace(value).match(/^[("'“”\[]?([\p{L}][\p{L}'’.-]*)/u);
  return match?.[1] ?? null;
}

function sentenceHasMalformedLowercaseStart(sentence: string): boolean {
  const first = firstWord(sentence);
  if (!first || first.length < 4) return false;
  const firstChar = first[0];
  if (!firstChar) return false;
  return /^\p{Ll}$/u.test(firstChar);
}

function sentenceLooksMalformedFragment(sentence: string): boolean {
  const compact = compactWhitespace(sentence);
  if (!compact) return true;
  if (/[,:;]$/.test(compact)) return true;
  if (
    /\b(?:which|that|who|because|although|though|while|when|where|if|and|but|or)\s*[.!?]$/i.test(
      compact,
    )
  ) {
    return true;
  }
  if (
    /^(?:which|that|who|because|although|though|while|when|where|if|and|but|or)\b/i.test(
      compact,
    ) &&
    countWords(compact) <= 8
  ) {
    return true;
  }
  return false;
}

function paragraphContainsBoundaryLeak(args: {
  paragraph: string;
  candidateName?: string;
}): boolean {
  const normalizedParagraph = compactWhitespace(args.paragraph);
  const compactNoWhitespace = normalizeForMatch(args.paragraph).replace(/\s+/g, "");
  const candidateNoWhitespace = normalizeForMatch(args.candidateName ?? "").replace(
    /\s+/g,
    "",
  );

  if (
    candidateNoWhitespace.length > 0 &&
    compactNoWhitespace.includes(candidateNoWhitespace)
  ) {
    return true;
  }

  return (
    FORBIDDEN_BODY_PATTERNS.some((pattern) => pattern.test(normalizedParagraph)) ||
    FORBIDDEN_BODY_INLINE_PATTERNS.some((pattern) => pattern.test(normalizedParagraph))
  );
}

function paragraphMentionsReferencedFact(paragraph: string, fact: string): boolean {
  const normalizedParagraph = normalizeForMatch(paragraph);
  const normalizedFact = normalizeForMatch(fact);
  if (!normalizedFact || !normalizedParagraph) return false;
  return (
    normalizedParagraph.includes(normalizedFact) ||
    countTokenOverlap(paragraph, fact) >= 2
  );
}

function paragraphMentionsReferencedTheme(paragraph: string, theme: string): boolean {
  return countTokenOverlap(paragraph, theme) >= 2;
}

function paragraphMentionsDisallowedClaim(paragraph: string, claim: string): boolean {
  const normalizedParagraph = normalizeForMatch(paragraph);
  const normalizedClaim = normalizeForMatch(claim);
  if (!normalizedParagraph || !normalizedClaim) return false;
  const claimTokens = extractMeaningfulTokens(claim);
  if (claimTokens.length > 4) {
    return normalizedParagraph.includes(normalizedClaim);
  }
  return (
    normalizedParagraph.includes(normalizedClaim) ||
    countTokenOverlap(paragraph, claim) >=
      (claimTokens.length <= 3 ? 2 : Math.min(3, Math.max(2, claimTokens.length)))
  );
}

function buildJobKeywordSet(jobTitle: string, jobDescription: string): Set<string> {
  return new Set([
    ...extractMeaningfulTokens(jobTitle),
    ...extractMeaningfulTokens(jobDescription),
  ]);
}

function countJobKeywordOverlap(paragraph: string, jobKeywords: Set<string>): number {
  return extractMeaningfulTokens(paragraph).filter((token) => jobKeywords.has(token))
    .length;
}

function paragraphLooksLikeInterestOnly(paragraph: string): boolean {
  const hasInterestStem = detectRhetoricalStemClass(splitSentences(paragraph)[0] ?? null);
  return (
    !!hasInterestStem &&
    !/\b(?:led|built|improved|reduced|designed|managed|mentored|optimized|migration|dashboard|conversion|performance|mene|construit|ameliore|reduit|concu|gere|optimise|projet|tableau de bord|conversion)\b/i.test(
      paragraph,
    )
  );
}

function paragraphLooksLikeInventedNoContextEvidence(paragraph: string): boolean {
  return (
    /\b(?:led|built|managed|launched|shipped|improved|reduced|increased|designed|developed|mentored|optimized)\b/i.test(
      paragraph,
    ) ||
    /\b\d+(?:[.,]\d+)?\s*(?:%|percent|points?|x)\b/i.test(paragraph) ||
    /\bat\s+[A-Z][\w&'.-]+/u.test(paragraph)
  );
}

function detectRhetoricalStemClass(sentence: string | null): string | null {
  if (!sentence) return null;
  const compactedSentence = compactWhitespace(sentence);
  if (!compactedSentence) return null;
  const normalizedSentence = normalizeForMatch(compactedSentence);

  if (
    normalizedSentence.startsWith("ce qui m interesse") ||
    normalizedSentence.startsWith("ce qui m attire") ||
    normalizedSentence.startsWith("ce poste m interesse") ||
    normalizedSentence.startsWith("je suis interesse par") ||
    normalizedSentence.startsWith("je suis interessee par")
  ) {
    return "interest_opening";
  }
  if (
    normalizedSentence.startsWith("ce poste se distingue") ||
    normalizedSentence.startsWith("ce qui ressort pour moi")
  ) {
    return "role_stands_out";
  }

  for (const { id, pattern } of REPEATED_RHETORICAL_STEM_PATTERNS) {
    if (pattern.test(compactedSentence)) {
      return id;
    }
  }

  return null;
}

function buildSentenceStemPrefix(sentence: string | null, tokenCount = 6): string {
  if (!sentence) return "";
  return normalizeForMatch(sentence).split(/\s+/).slice(0, tokenCount).join(" ");
}

function paragraphUsesWeakTransferCliche(paragraph: string): boolean {
  const normalizedParagraph = normalizeForMatch(paragraph);
  return WEAK_TRANSFER_CLICHE_PATTERNS.some(
    (pattern) => pattern.test(paragraph) || pattern.test(normalizedParagraph),
  );
}

function paragraphShowsWorkLevelMotivation(args: {
  paragraph: string;
  themeMentioned: boolean;
  jobOverlap: number;
}): boolean {
  if (args.themeMentioned || args.jobOverlap >= 2) {
    return true;
  }
  const normalizedParagraph = normalizeForMatch(args.paragraph);
  return WORK_LEVEL_MOTIVATION_PATTERNS.some(
    (pattern) => pattern.test(args.paragraph) || pattern.test(normalizedParagraph),
  );
}

function countUniqueTokenDelta(source: string, comparison: string): number {
  const sourceTokens = new Set(extractMeaningfulTokens(source));
  return extractMeaningfulTokens(comparison).filter((token) => !sourceTokens.has(token))
    .length;
}

function renderIndexedList(values: readonly string[]): string[] {
  return values.length > 0
    ? values.map((value, index) => `- [${index}] ${value}`)
    : ["- none"];
}

function buildStructuredPresetContractLines(args: {
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): string[] {
  if (args.noContextMode) {
    return [];
  }

  switch (args.voicePreset) {
    case "direct":
      return [
        "- preset_contract_direct: use exactly 2 body paragraphs.",
        "- preset_contract_direct: paragraph 1 opens with the strongest supported fact.",
        "- preset_contract_direct: paragraph 2 carries the second strongest supported fact or the clearest second proof point. Do not add a motivation paragraph unless the factual plan is too thin to stand on two proof paragraphs.",
      ];
    case "expert":
      return [
        "- preset_contract_expert: paragraph 1 opens with the strongest supported fact.",
        "- preset_contract_expert: paragraph 2 adds process, analysis, or communication framing that is still grounded in supported facts or themes.",
        "- preset_contract_expert: if a third paragraph is used, keep motivation minimal and work-level.",
      ];
    case "signature":
      return [
        "- preset_contract_signature: paragraph 1 opens with the strongest supported proof.",
        "- preset_contract_signature: paragraph 2 adds one second grounded proof point if it adds real substance.",
        "- preset_contract_signature: keep motivation minimal. Do not spend a full paragraph on generic interest when two grounded proof points already exist.",
      ];
    case "engaging":
      return [
        "- preset_contract_engaging: paragraph 1 opens with supported proof, not employer admiration.",
        "- preset_contract_engaging: paragraph 2 may be more human-facing or workflow-facing, but it must stay grounded in the work rather than praise the employer or the setting.",
      ];
    case "storyteller":
      return [
        "- preset_contract_storyteller: paragraph 1 opens from one concrete supported thread.",
        "- preset_contract_storyteller: paragraph 2 must continue that same thread with another grounded detail or consequence.",
        "- preset_contract_storyteller: do not use scenic filler, atmosphere admiration, or abstract setup paragraphs.",
      ];
  }
}

function openingAndEvidenceReuseSameFacts(
  plan: StructuredCoverLetterContentPlan,
): boolean {
  const openingFactIds = plan.body_paragraphs[0]?.fact_ids ?? [];
  const evidenceFactIds = plan.body_paragraphs[1]?.fact_ids ?? [];
  if (openingFactIds.length === 0 || evidenceFactIds.length === 0) {
    return false;
  }

  const evidenceSet = new Set(evidenceFactIds);
  return openingFactIds.every((factId) => evidenceSet.has(factId));
}

function isUnsupportedTechnicalSeoMove(args: {
  plannerResult: ProposalPlannerResult;
  jobTitle: string;
  jobDescription: string;
}): boolean {
  const jobText = `${args.jobTitle} ${args.jobDescription}`;
  const sourceText = [
    ...args.plannerResult.allowed_concrete_facts,
    ...args.plannerResult.allowed_transfer_themes,
  ].join(" ");
  return (
    /\b(?:technical\s+seo|indexing|schema|crawl|internal[-\s]linking)\b/i.test(
      jobText,
    ) &&
    /\b(?:front[-\s]?end|landing pages?|conversion(?: optimization)?)\b/i.test(
      sourceText,
    ) &&
    !/\b(?:technical\s+seo|seo specialist|crawl diagnostics?|schema strategy|canonicalization|crawl budget)\b/i.test(
      sourceText,
    )
  );
}

function buildAdjacentOnlySeoPlanLines(): string[] {
  return [
    "- adjacent_only_seo_rule: plan this as frontend/conversion support only, not technical SEO evidence.",
    "- adjacent_only_seo_rule: plan a clear gap sentence that says indexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.",
    "- adjacent_only_seo_rule: allowed support is landing-page structure, frontend implementation, and conversion-aware page improvements after a specialist defines the audit.",
    "- adjacent_only_seo_rule: do not plan implementation of schema markup, schema changes, internal-linking adjustments, canonical tags, indexing fixes, crawlability fixes, or crawlable markup unless source-backed.",
    "- adjacent_only_seo_rule: do not plan claims about SEO-team work, crawlability optimization, schema placement, crawl budget, canonicalization, internal-linking patterns, technical SEO diagnosis, search visibility familiarity, or marketplace-style SEO implementation.",
  ];
}

export function validateStructuredCoverLetterContentPlan(args: {
  plan: StructuredCoverLetterContentPlan;
  plannerResult: ProposalPlannerResult;
  voicePreset: ProposalVoicePreset;
}): StructuredCoverLetterContentPlan {
  const plan = STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA.parse(args.plan);

  if (plan.language !== args.plannerResult.output_language) {
    throw new Error("Structured content plan language does not match planner output language.");
  }

  if (plan.voice_preset !== args.voicePreset) {
    throw new Error("Structured content plan voice preset does not match the selected voice preset.");
  }

  if (plan.opening_strategy !== args.plannerResult.opening_strategy) {
    throw new Error("Structured content plan opening strategy does not match the planner result.");
  }

  if (plan.no_context_mode !== (args.plannerResult.context_mode === "none")) {
    throw new Error("Structured content plan no-context mode does not match the planner result.");
  }

  if (plan.body_paragraphs[0]?.role !== "opening") {
    throw new Error("Structured cover letter plans must start with an opening paragraph.");
  }

  if (plan.body_paragraphs[1]?.role !== "evidence") {
    throw new Error("Structured cover letter plans must use an evidence paragraph second.");
  }

  if (
    plan.body_paragraphs.length === 3 &&
    plan.body_paragraphs[2]?.role !== "motivation"
  ) {
    throw new Error("Three-paragraph structured cover letters must end with a motivation paragraph.");
  }

  if (
    !plan.no_context_mode &&
    args.voicePreset === "direct" &&
    plan.body_paragraphs.length !== 2
  ) {
    throw new Error("Direct structured cover letters must use exactly two body paragraphs.");
  }

  const evidenceParagraphs = plan.body_paragraphs.filter(
    (paragraph) => paragraph.role === "evidence",
  );
  if (evidenceParagraphs.length === 0) {
    throw new Error("Structured cover letter plans must include an evidence paragraph.");
  }

  for (const paragraph of plan.body_paragraphs) {
    if (paragraph.fact_ids.length + paragraph.theme_ids.length === 0) {
      throw new Error("Each structured paragraph must reference at least one fact or theme.");
    }
    for (const factId of paragraph.fact_ids) {
      if (!args.plannerResult.allowed_concrete_facts[factId]) {
        throw new Error(`Structured paragraph fact id ${factId} is out of range.`);
      }
    }
    for (const themeId of paragraph.theme_ids) {
      if (!args.plannerResult.allowed_transfer_themes[themeId]) {
        throw new Error(`Structured paragraph theme id ${themeId} is out of range.`);
      }
    }
  }

  const evidenceSummary = buildProposalEvidenceSummary(args.plannerResult);
  if (
    args.plannerResult.proof_strategy === "concrete_supported" &&
    evidenceSummary.topAchievements.length > 0
  ) {
    const achievementFactIndexes = new Set<number>();
    args.plannerResult.allowed_concrete_facts.forEach((fact, index) => {
      if (evidenceSummary.topAchievements.includes(fact)) {
        achievementFactIndexes.add(index);
      }
    });
    const achievementLinked = evidenceParagraphs.some((paragraph) => {
      const achievementIds = paragraph.fact_ids.filter((factId) =>
        achievementFactIndexes.has(factId),
      );
      return achievementIds.length >= 1 && achievementIds.length <= 2;
    });
    if (!achievementLinked) {
      throw new Error(
        "Structured evidence paragraphs must reference one or two achievement facts when concrete supported achievements exist.",
      );
    }
  }

  if (
    !plan.no_context_mode &&
    args.plannerResult.allowed_concrete_facts.length >= 2 &&
    openingAndEvidenceReuseSameFacts(plan)
  ) {
    throw new Error(
      "Structured opening and evidence paragraphs must not rely on the same fact set when multiple supported facts exist.",
    );
  }

  return plan;
}

export function buildStructuredCoverLetterContentPlanPrompt(args: {
  plannerResult: ProposalPlannerResult;
  voicePreset: ProposalVoicePreset;
  jobTitle: string;
  jobDescription: string;
  generationControlsBlock?: string;
  companyValuesPack?: CompanyValuesPack;
}): string {
  const evidenceSummary = buildProposalEvidenceSummary(args.plannerResult);
  return [
    "Build a light JSON content plan for a cover letter.",
    "Return JSON only and match the schema exactly.",
    "The plan must describe paragraph intent only, not prose sentences.",
    "Do not include a greeting, closing, sign-off, signature, or final CTA in the plan.",
    "",
    `- schema_version: ${STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA_VERSION}`,
    "- format: cover_letter",
    `- language: ${args.plannerResult.output_language}`,
    `- voice_preset: ${args.voicePreset}`,
    `- opening_strategy: ${args.plannerResult.opening_strategy}`,
    `- no_context_mode: ${args.plannerResult.context_mode === "none" ? "true" : "false"}`,
    `- proof_strategy: ${args.plannerResult.proof_strategy}`,
    args.generationControlsBlock,
    args.companyValuesPack
      ? formatCompanyValuesPromptBlock(args.companyValuesPack)
      : undefined,
    "",
    "Paragraph contract:",
    "- Exactly 2 or 3 body paragraphs.",
    "- Paragraph 1 role must be opening.",
    "- Paragraph 2 role must be evidence.",
    "- Paragraph 3 role may be motivation.",
    ...buildStructuredPresetContractLines({
      voicePreset: args.voicePreset,
      noContextMode: args.plannerResult.context_mode === "none",
    }),
    "- Each paragraph must include fact_ids and/or theme_ids that support that paragraph.",
    "- fact_ids must reference only the indexed allowed_concrete_facts list below.",
    "- theme_ids must reference only the indexed allowed_transfer_themes list below.",
    "- Do not use ids that are not present in the indexed lists below.",
    "- Plan each paragraph around job priority -> source-backed candidate fact or allowed theme -> recruiter reason for why that evidence matters.",
    "- Unsupported or missing requirements should be planned as gaps, omissions, or cautious non-claims, never as candidate proof.",
    "- Company mission, culture, values, market, or project praise must not be the main paragraph intent.",
    ...(isUnsupportedTechnicalSeoMove(args) ? buildAdjacentOnlySeoPlanLines() : []),
    ...(args.plannerResult.allowed_concrete_facts.length >= 2 &&
    args.plannerResult.context_mode !== "none"
      ? [
          "- When multiple supported facts exist, choose the opening fact that best fits this preset's paragraph job. Do not default every preset to the same lead fact and same rhetorical job.",
        ]
      : []),
    ...(args.plannerResult.proof_strategy === "concrete_supported" &&
    evidenceSummary.topAchievements.length > 0
      ? [
          "- Because concrete supported achievement facts exist, the evidence paragraph must reference one or two of those achievement fact ids.",
        ]
      : [
          "- If no explicit achievement fact is available, the evidence paragraph may rely on supported scope or background facts instead.",
        ]),
    "",
    "Read-only role context:",
    `- job_title: ${args.jobTitle}`,
    `- job_description: ${args.jobDescription}`,
    "",
    "Indexed allowed_concrete_facts:",
    ...renderIndexedList(args.plannerResult.allowed_concrete_facts),
    "",
    "Indexed allowed_transfer_themes:",
    ...renderIndexedList(args.plannerResult.allowed_transfer_themes),
    "",
    "Top achievement facts to prefer when present:",
    ...renderIndexedList(evidenceSummary.topAchievements),
  ].filter((line): line is string => typeof line === "string").join("\n");
}

export function buildStructuredCoverLetterBodyPrompt(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  jobTitle: string;
  jobDescription: string;
}): string {
  const styleAnchors = STRUCTURED_BODY_STYLE_ANCHORS[args.contentPlan.voice_preset];
  const bodyExamples = STRUCTURED_BODY_EXAMPLES[args.contentPlan.language];
  const evidenceSummary = buildProposalEvidenceSummary(args.plannerResult);
  const supportedRoleTokens = new Set(
    extractMeaningfulTokens(
      [
        ...args.plannerResult.allowed_concrete_facts,
        ...args.plannerResult.allowed_transfer_themes,
      ].join(" "),
    ),
  );
  const unsupportedJobKeywords =
    !args.contentPlan.no_context_mode &&
    (args.plannerResult.domain_gap !== "direct" ||
      args.plannerResult.credential_status !== "exact_required")
      ? Array.from(buildJobKeywordSet(args.jobTitle, args.jobDescription))
          .filter((token) => !supportedRoleTokens.has(token))
          .slice(0, 12)
      : [];
  return [
    "Write the body paragraphs only for a cover letter.",
    args.contentPlan.language === "fr"
      ? "Write the body paragraphs fully in French."
      : "Write the body paragraphs fully in English.",
    "Return plain text only.",
    `Return exactly ${args.contentPlan.body_paragraphs.length} paragraphs separated by a single blank line.`,
    "Do not include a greeting, closing, sign-off, signature, candidate name line, or final CTA sentence.",
    "Do not include labels, bullets, numbering, markdown, code fences, or meta commentary.",
    "Preserve concrete source-backed detail when fact ids are provided.",
    "Use only the listed facts and themes for each paragraph. Do not invent unsupported experience, achievements, tools, employers, credentials, or readiness.",
    "Write natural, concrete, professionally grounded prose.",
    "Prefer factual sentences and simple transitions over polished marketing language.",
    "Avoid slogan-like filler, symmetrical HR phrasing, and recruiter-pleasing polish.",
    "Keep the rhythm natural. The content plan and style anchors are guidance, not rigid templates.",
    "Let the paragraphs read like one coherent cover-letter body with a real opening, a grounded evidence paragraph, and a distinct motivation close when requested.",
    "Use light cross-paragraph progression where it helps the flow, but do not rely on unsupported claims, invented facts, or hidden transitions.",
    "Do not restate the same setup, motivation line, or achievement phrasing across multiple paragraphs.",
    "Give each paragraph a distinct job while keeping the full body natural when read in sequence.",
    "Keep each paragraph compact at 1 to 3 sentences.",
    "",
    `Tone direction: ${styleAnchors.tone}`,
    `Positive anchor examples: ${styleAnchors.positive.join(" | ")}`,
    `Avoid cliche bridge language such as: ${styleAnchors.negative.join(" | ")}`,
    "Acceptable phrasing examples:",
    ...bodyExamples.acceptable.map((example) => `- ${example}`),
    "Unacceptable phrasing examples:",
    ...bodyExamples.unacceptable.map((example) => `- ${example}`),
    "",
    `- context_mode: ${args.plannerResult.context_mode}`,
    `- domain_gap: ${args.plannerResult.domain_gap}`,
    `- proof_strategy: ${args.plannerResult.proof_strategy}`,
    `- opening_strategy: ${args.contentPlan.opening_strategy}`,
    ...(args.contentPlan.no_context_mode
      ? [
          "- no_context_rule: you do not have supported candidate evidence. Use only grounded motivation, role understanding, reliability, communication, willingness to learn, and job-relevance content that is supported by the job context. Do not invent prior roles, employers, projects, metrics, or achievements.",
          "- no_context_rule: do not say you share the company's values, are eager to contribute, could support the team, or would bring your strengths to the role.",
        ]
      : []),
    ...(args.plannerResult.domain_gap !== "direct"
      ? [
          "- gap_rule: if the supported background is adjacent or distant, describe the overlap plainly in past tense. Do not bridge into unsupported target-role claims.",
        ]
      : []),
    ...(unsupportedJobKeywords.length > 0
      ? [
          `- unsupported_job_keywords: ${unsupportedJobKeywords.join(" | ")}`,
          "- unsupported_job_keywords_rule: do not introduce these job-specific keywords unless they already appear in the allowed facts or allowed themes for the paragraph that uses them.",
        ]
      : []),
    ...(args.plannerResult.disallowed_claims.length > 0
      ? [
          `- forbidden_claims: ${args.plannerResult.disallowed_claims.join(" | ")}`,
          "- forbidden_claims_rule: every forbidden claim is a hard rejection. Do not use any of them literally or by close paraphrase.",
        ]
      : []),
    ...(args.plannerResult.identity_hard_stops.length > 0
      ? [
          `- identity_hard_stops: ${args.plannerResult.identity_hard_stops.join(" | ")}`,
          "- identity_hard_stops_rule: never state or imply any of these unsupported identities or credentials.",
        ]
      : []),
    ...(args.plannerResult.proof_strategy === "concrete_supported" &&
    evidenceSummary.topAchievements.length > 0
      ? [
          "- evidence_requirement: foreground one or two recruiter-relevant achievements in the evidence paragraph when those achievement fact ids are referenced.",
        ]
      : []),
    "",
    "Read-only job context:",
    `- job_title: ${args.jobTitle}`,
    `- job_description: ${args.jobDescription}`,
    "",
    "Indexed allowed_concrete_facts:",
    ...renderIndexedList(args.plannerResult.allowed_concrete_facts),
    "",
    "Indexed allowed_transfer_themes:",
    ...renderIndexedList(args.plannerResult.allowed_transfer_themes),
    "",
    "Paragraph blueprint:",
    ...args.contentPlan.body_paragraphs.flatMap((paragraph, index) => {
      const facts =
        paragraph.fact_ids.length > 0
          ? paragraph.fact_ids.map((factId) => `[${factId}]`).join(", ")
          : "none";
      const themes =
        paragraph.theme_ids.length > 0
          ? paragraph.theme_ids.map((themeId) => `[${themeId}]`).join(", ")
          : "none";
      const paragraphFacts =
        paragraph.fact_ids.length > 0
          ? paragraph.fact_ids.map(
              (factId) =>
                `[${factId}] ${args.plannerResult.allowed_concrete_facts[factId]}`,
            )
          : ["none"];
      const paragraphThemes =
        paragraph.theme_ids.length > 0
          ? paragraph.theme_ids.map(
              (themeId) =>
                `[${themeId}] ${args.plannerResult.allowed_transfer_themes[themeId]}`,
            )
          : ["none"];
      const roleGuidance =
        paragraph.role === "opening"
          ? args.contentPlan.no_context_mode
            ? "Lead with grounded interest in the role and accurate understanding of the work."
            : "Open directly with grounded fit and supported scope, not a generic application formula."
          : paragraph.role === "evidence"
            ? args.contentPlan.no_context_mode
            ? "Use supported role-relevance and work-style substance only. Do not invent candidate evidence."
              : "Foreground concrete proof and recruiter-relevant achievements when supported."
            : "Close on specific motivation for the work itself without turning into a CTA.";
      return [
        `- paragraph_${index + 1}: role=${paragraph.role}; fact_ids=${facts}; theme_ids=${themes}${paragraph.intent_label ? `; intent=${paragraph.intent_label}` : ""}; guidance=${roleGuidance}`,
        `  allowed_facts: ${paragraphFacts.join(" | ")}`,
        `  allowed_themes: ${paragraphThemes.join(" | ")}`,
      ];
    }),
  ].join("\n");
}

export function buildStructuredCoverLetterBodyRetryPrompt(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  jobTitle: string;
  jobDescription: string;
  failureReason: string;
}): string {
  return [
    buildStructuredCoverLetterBodyPrompt({
      plannerResult: args.plannerResult,
      contentPlan: args.contentPlan,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
    }),
    "",
    "Revision required:",
    `- The previous draft failed validation for this reason: ${compactWhitespace(args.failureReason)}`,
    "- Rewrite all body paragraphs from scratch.",
    "- Remove any cliche bridge language, polished marketing tone, broken fragments, or malformed sentence starts.",
    "- Keep the same paragraph count and the same paragraph order from the validated content plan.",
    "- Make the opening, evidence, and motivation paragraphs flow naturally without repeating the same setup or generic interest sentence.",
    "- Keep the prose concrete, simple, and natural.",
    "- Return body paragraphs only.",
  ].join("\n");
}

function buildParagraphScopedContentPlan(args: {
  contentPlan: StructuredCoverLetterContentPlan;
  paragraphIndex: number;
}): StructuredCoverLetterContentPlan {
  const paragraphPlan = args.contentPlan.body_paragraphs[args.paragraphIndex];
  if (!paragraphPlan) {
    throw new Error(
      `Structured paragraph index ${args.paragraphIndex} is out of range for the content plan.`,
    );
  }

  return {
    ...args.contentPlan,
    body_paragraphs: [paragraphPlan],
  };
}

function buildStructuredParagraphRoleGuidance(args: {
  paragraphPlan: StructuredCoverLetterParagraphPlan;
  noContextMode: boolean;
}): string {
  if (args.paragraphPlan.role === "opening") {
    return args.noContextMode
      ? "Lead with grounded interest in the work and accurate understanding of the role."
      : "Open directly with supported fit or scope, not a generic application formula.";
  }

  if (args.paragraphPlan.role === "evidence") {
    return args.noContextMode
      ? "Keep the paragraph grounded in role understanding, reliability, communication, or willingness to learn. Do not invent candidate evidence."
      : "Foreground concrete proof and recruiter-relevant achievements when supported.";
  }

  return "Close on specific motivation for the work itself without turning into a CTA.";
}

export function buildStructuredCoverLetterParagraphPrompt(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  paragraphIndex: number;
  jobTitle: string;
  jobDescription: string;
  failureReason?: string;
}): string {
  const paragraphPlan = args.contentPlan.body_paragraphs[args.paragraphIndex];
  if (!paragraphPlan) {
    throw new Error(
      `Structured paragraph index ${args.paragraphIndex} is out of range for the content plan.`,
    );
  }

  const styleAnchors = STRUCTURED_BODY_STYLE_ANCHORS[args.contentPlan.voice_preset];
  const bodyExamples = STRUCTURED_BODY_EXAMPLES[args.contentPlan.language];
  const evidenceSummary = buildProposalEvidenceSummary(args.plannerResult);
  const facts =
    paragraphPlan.fact_ids.length > 0
      ? paragraphPlan.fact_ids.map((factId) => `[${factId}]`).join(", ")
      : "none";
  const themes =
    paragraphPlan.theme_ids.length > 0
      ? paragraphPlan.theme_ids.map((themeId) => `[${themeId}]`).join(", ")
      : "none";
  const paragraphFactTexts = paragraphPlan.fact_ids.map(
    (factId) => args.plannerResult.allowed_concrete_facts[factId],
  );
  const paragraphThemeTexts = paragraphPlan.theme_ids.map(
    (themeId) => args.plannerResult.allowed_transfer_themes[themeId],
  );
  const supportedRoleTokens = new Set(
    extractMeaningfulTokens(
      [
        ...args.plannerResult.allowed_concrete_facts,
        ...args.plannerResult.allowed_transfer_themes,
      ].join(" "),
    ),
  );
  const unsupportedJobKeywords =
    !args.contentPlan.no_context_mode &&
    (args.plannerResult.domain_gap !== "direct" ||
      args.plannerResult.credential_status !== "exact_required")
      ? Array.from(buildJobKeywordSet(args.jobTitle, args.jobDescription))
          .filter((token) => !supportedRoleTokens.has(token))
          .slice(0, 12)
      : [];

  return [
    "Write one body paragraph only for a cover letter.",
    args.contentPlan.language === "fr"
      ? "Write the paragraph fully in French."
      : "Write the paragraph fully in English.",
    `This is paragraph ${args.paragraphIndex + 1} of ${args.contentPlan.body_paragraphs.length}.`,
    `Role: ${paragraphPlan.role}.`,
    "Return exactly one paragraph of plain text.",
    "Do not include blank lines before or after the paragraph.",
    "Write exactly 1 or 2 sentences.",
    "Keep the paragraph compact and under roughly 65 words when possible.",
    "Do not include a greeting, closing, sign-off, signature, candidate name line, or final CTA sentence.",
    "Do not include labels, bullets, numbering, markdown, code fences, or meta commentary.",
    "Write natural, concrete, professionally grounded prose.",
    "Prefer factual sentences and simple transitions over polished marketing language.",
    "Avoid slogan-like filler, symmetrical HR phrasing, and recruiter-pleasing polish.",
    "Do not stack multiple mini-sentences or use semicolon-heavy chains to compress ideas.",
    "This paragraph must stand on its own when assembled. A light local transition in the first clause is acceptable, but do not rely on previous or following paragraphs.",
    "Do not repeat stock application openers or generic summary closers.",
    "Use only the listed facts and themes for this paragraph. Do not invent unsupported experience, achievements, tools, employers, credentials, or readiness.",
    "Treat the paragraph-local facts and themes below as the primary source material for this paragraph.",
    "",
    `Tone direction: ${styleAnchors.tone}`,
    `Positive anchor examples: ${styleAnchors.positive.join(" | ")}`,
    `Avoid cliche bridge language such as: ${styleAnchors.negative.join(" | ")}`,
    "Acceptable phrasing examples:",
    ...bodyExamples.acceptable.map((example) => `- ${example}`),
    "Unacceptable phrasing examples:",
    ...bodyExamples.unacceptable.map((example) => `- ${example}`),
    "",
    `- context_mode: ${args.plannerResult.context_mode}`,
    `- domain_gap: ${args.plannerResult.domain_gap}`,
    `- proof_strategy: ${args.plannerResult.proof_strategy}`,
    `- opening_strategy: ${args.contentPlan.opening_strategy}`,
    `- paragraph_role: ${paragraphPlan.role}`,
    `- paragraph_fact_ids: ${facts}`,
    `- paragraph_theme_ids: ${themes}`,
    `- paragraph_guidance: ${buildStructuredParagraphRoleGuidance({
      paragraphPlan,
      noContextMode: args.contentPlan.no_context_mode,
    })}`,
    ...(paragraphPlan.intent_label
      ? [`- paragraph_intent: ${paragraphPlan.intent_label}`]
      : []),
    ...(args.contentPlan.no_context_mode
      ? [
          "- no_context_rule: you do not have supported candidate evidence. Use only grounded motivation, job understanding, role relevance, reliability, communication, willingness to learn, and supported work-style substance from the job context.",
          "- no_context_rule: avoid repeating generic lines such as 'I’m interested in learning more about the role.'",
        ]
      : []),
    ...(args.plannerResult.domain_gap !== "direct"
      ? [
          "- gap_rule: if the supported background is adjacent or distant, describe the overlap plainly in past tense. Do not use contrastive bridge formulas such as 'while my background is in X ... aligns with Y'.",
        ]
      : []),
    ...(unsupportedJobKeywords.length > 0
      ? [
          `- unsupported_job_keywords: ${unsupportedJobKeywords.join(" | ")}`,
          "- unsupported_job_keywords_rule: do not introduce these job-specific keywords unless they already appear in the paragraph-local facts or themes.",
        ]
      : []),
    ...(args.plannerResult.disallowed_claims.length > 0
      ? [
          `- forbidden_claims: ${args.plannerResult.disallowed_claims.join(" | ")}`,
        ]
      : []),
    ...(args.plannerResult.identity_hard_stops.length > 0
      ? [
          `- identity_hard_stops: ${args.plannerResult.identity_hard_stops.join(" | ")}`,
        ]
      : []),
    ...(paragraphPlan.role === "evidence" &&
    args.plannerResult.proof_strategy === "concrete_supported" &&
    evidenceSummary.topAchievements.length > 0
      ? [
          "- evidence_requirement: if achievement fact ids are listed for this paragraph, foreground one or two recruiter-relevant achievements from those fact ids.",
        ]
      : []),
    "",
    "Read-only job context:",
    `- job_title: ${args.jobTitle}`,
    `- job_description: ${args.jobDescription}`,
    "",
    "Paragraph-local allowed facts:",
    ...renderIndexedList(paragraphFactTexts),
    "",
    "Paragraph-local allowed themes:",
    ...renderIndexedList(paragraphThemeTexts),
    "",
    "Indexed allowed_concrete_facts:",
    ...renderIndexedList(args.plannerResult.allowed_concrete_facts),
    "",
    "Indexed allowed_transfer_themes:",
    ...renderIndexedList(args.plannerResult.allowed_transfer_themes),
    ...(args.failureReason
      ? [
          "",
          "Revision required:",
          `- The previous draft failed validation for this reason: ${compactWhitespace(args.failureReason)}`,
          "- Rewrite this paragraph from scratch.",
          "- Remove any cliche bridge language, broken fragments, malformed sentence starts, unsupported role claims, or generic filler.",
          "- Keep the rewrite to 1 or 2 sentences only.",
          "- Keep the paragraph concrete, simple, and natural.",
        ]
      : []),
  ].join("\n");
}

export function validateStructuredCoverLetterParagraph(args: {
  content: string;
  paragraphIndex: number;
  candidateName?: string;
  contentPlan: StructuredCoverLetterContentPlan;
  plannerResult: ProposalPlannerResult;
  jobTitle: string;
  jobDescription: string;
  stage?: "generation" | "repair";
}): string {
  const paragraphs = parseStructuredCoverLetterBody({
    content: args.content,
    expectedParagraphCount: 1,
    candidateName: args.candidateName,
    contentPlan: buildParagraphScopedContentPlan({
      contentPlan: args.contentPlan,
      paragraphIndex: args.paragraphIndex,
    }),
    plannerResult: args.plannerResult,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    stage: args.stage,
  });

  const paragraph = paragraphs[0];
  if (!paragraph) {
    throw new Error("Structured paragraph validation returned empty content.");
  }
  return paragraph;
}

export function parseStructuredCoverLetterBody(args: {
  content: string;
  expectedParagraphCount: number;
  candidateName?: string;
  contentPlan?: StructuredCoverLetterContentPlan;
  plannerResult?: ProposalPlannerResult;
  jobTitle?: string;
  jobDescription?: string;
  stage?: "generation" | "repair";
}): string[] {
  const compactedContent = compactParagraphSpacing(args.content);
  if (!compactedContent) {
    throw new Error("Structured body generation returned empty content.");
  }

  if (
    ENGLISH_BODY_META_PATTERNS.some((pattern) => pattern.test(compactedContent)) ||
    FRENCH_BODY_META_PATTERNS.some((pattern) => pattern.test(compactedContent))
  ) {
    throw new Error("Structured body generation returned meta commentary.");
  }

  const paragraphs = splitParagraphs(args.content);
  if (paragraphs.length !== args.expectedParagraphCount) {
    throw new Error(
      `Structured body generation returned ${paragraphs.length} paragraphs; expected ${args.expectedParagraphCount}.`,
    );
  }

  const candidateName = compactWhitespace(args.candidateName ?? "");
  const contentPlan = args.contentPlan;
  const plannerResult = args.plannerResult;
  const evidenceSummary =
    plannerResult && contentPlan
      ? buildProposalEvidenceSummary(plannerResult)
      : null;
  const jobKeywords =
    contentPlan && typeof args.jobTitle === "string" && typeof args.jobDescription === "string"
      ? buildJobKeywordSet(args.jobTitle, args.jobDescription)
      : null;
  const supportedRoleTokens =
    plannerResult
      ? new Set(
          extractMeaningfulTokens(
            [
              ...plannerResult.allowed_concrete_facts,
              ...plannerResult.allowed_transfer_themes,
            ].join(" "),
          ),
        )
      : null;
  const unsupportedNonDirectRoleKeywords =
    plannerResult &&
    !contentPlan?.no_context_mode &&
    (plannerResult.domain_gap !== "direct" ||
      plannerResult.credential_status !== "exact_required" ||
      plannerResult.transfer_mode !== "literal" ||
      plannerResult.proof_strategy !== "concrete_supported" ||
      plannerResult.disallowed_claims.length > 0 ||
      plannerResult.identity_hard_stops.length > 0) &&
    jobKeywords
      ? new Set(
          Array.from(jobKeywords).filter(
            (token) => !supportedRoleTokens?.has(token),
          ),
        )
      : null;
  const seenSentenceKeys = new Set<string>();
  const paragraphDiagnostics: Array<{
    role: StructuredCoverLetterParagraphRole;
    paragraph: string;
    firstSentence: string | null;
    stemClass: string | null;
    stemPrefix: string;
    jobOverlap: number;
    themeMentioned: boolean;
    interestOnly: boolean;
  }> = [];

  if (contentPlan && plannerResult) {
    const englishHits = countMarkerHits(
      compactedContent,
      ENGLISH_BODY_LANGUAGE_MARKERS,
    );
    const frenchHits = countMarkerHits(compactedContent, FRENCH_BODY_LANGUAGE_MARKERS);
    const frenchDiacriticCount =
      compactedContent.match(FRENCH_DIACRITICS_GLOBAL_PATTERN)?.length ?? 0;
    if (
      contentPlan.language === "en" &&
      frenchHits >= 2 &&
      frenchHits > englishHits &&
      frenchDiacriticCount >= 1
    ) {
      throw new Error("Structured body generation returned a French body for an English plan.");
    }
    if (
      contentPlan.language === "fr" &&
      englishHits >= 2 &&
      englishHits > frenchHits
    ) {
      throw new Error("Structured body generation returned an English body for a French plan.");
    }
  }

  for (const [index, paragraph] of paragraphs.entries()) {
    if (!paragraph) {
      throw new Error("Structured body generation returned an empty paragraph.");
    }
    if (
      FORBIDDEN_BODY_PATTERNS.some((pattern) => pattern.test(paragraph)) ||
      paragraphContainsBoundaryLeak({ paragraph, candidateName })
    ) {
      throw new Error("Structured body generation returned forbidden boundary or wrapper text.");
    }
    if (candidateName && compactWhitespace(paragraph) === candidateName) {
      throw new Error("Structured body generation returned a candidate name line.");
    }
    const sentences = splitSentences(paragraph);
    if (sentences.length === 0) {
      throw new Error("Structured body generation returned an empty paragraph.");
    }
    if (sentences.length > 3) {
      throw new Error("Structured body paragraphs must stay compact.");
    }
    const firstSentence = sentences[0] ?? null;
    const stemClass = detectRhetoricalStemClass(firstSentence);
    const stemPrefix = buildSentenceStemPrefix(firstSentence);
    for (const sentence of sentences) {
      const sentenceKey = normalizeForMatch(sentence);
      if (sentenceKey.length >= 24 && seenSentenceKeys.has(sentenceKey)) {
        throw new Error(
          `Structured body repeats the same sentence across paragraphs: ${sentence}`,
        );
      }
      if (sentenceLooksMalformedFragment(sentence)) {
        throw new Error(`Structured body contains a malformed sentence fragment: ${sentence}`);
      }
      if (sentenceHasMalformedLowercaseStart(sentence)) {
        throw new Error(
          `Structured body contains a malformed lowercase sentence start: ${sentence}`,
        );
      }
      if (
        FORBIDDEN_BODY_CLICHE_PATTERNS.some((pattern) => pattern.test(sentence))
      ) {
        throw new Error(
          `Structured body contains forbidden cliche phrasing: ${sentence}`,
        );
      }
      if (sentenceKey.length >= 24) {
        seenSentenceKeys.add(sentenceKey);
      }
    }

    if (contentPlan && plannerResult) {
      const paragraphPlan = contentPlan.body_paragraphs[index];
      if (!paragraphPlan) {
        throw new Error("Structured body paragraph count does not match the validated content plan.");
      }
      if (countWords(paragraph) < MIN_WORDS_BY_ROLE[paragraphPlan.role]) {
        throw new Error(
          `Structured ${paragraphPlan.role} paragraph is materially insufficient.`,
        );
      }

      const referencedFacts = paragraphPlan.fact_ids.map(
        (factId) => plannerResult.allowed_concrete_facts[factId],
      );
      const referencedThemes = paragraphPlan.theme_ids.map(
        (themeId) => plannerResult.allowed_transfer_themes[themeId],
      );
      const factMentioned = referencedFacts.some(
        (fact) => !!fact && paragraphMentionsReferencedFact(paragraph, fact),
      );
      const themeMentioned = referencedThemes.some((theme) =>
        paragraphMentionsReferencedTheme(paragraph, theme),
      );
      const jobOverlap = jobKeywords ? countJobKeywordOverlap(paragraph, jobKeywords) : 0;
      const disallowedClaim = [
        ...plannerResult.disallowed_claims,
        ...plannerResult.identity_hard_stops,
      ].find((claim) => paragraphMentionsDisallowedClaim(paragraph, claim));
      const interestOnly = paragraphLooksLikeInterestOnly(paragraph);

      if (disallowedClaim) {
        throw new Error(
          `Structured body used a disallowed claim or hard stop: ${disallowedClaim}`,
        );
      }

      if (unsupportedNonDirectRoleKeywords) {
        const unsupportedKeywordOverlap = extractMeaningfulTokens(paragraph).filter(
          (token) => unsupportedNonDirectRoleKeywords.has(token),
        ).length;
        if (unsupportedKeywordOverlap >= 2) {
          throw new Error(
            "Structured body used unsupported role keywords that are not grounded in the allowed facts or themes.",
          );
        }
      }

      if (
        plannerResult.domain_gap !== "direct" &&
        paragraphUsesWeakTransferCliche(paragraph)
      ) {
        throw new Error(
          "Structured body used weak abstract transfer framing instead of grounded relevance.",
        );
      }

      if (paragraphPlan.role === "opening") {
        if (
          contentPlan.no_context_mode
            ? jobOverlap < 2 && !themeMentioned
            : !factMentioned && !themeMentioned && jobOverlap < 1
        ) {
          throw new Error("Structured body opening paragraph does not match the validated plan role.");
        }
      }

      if (paragraphPlan.role === "evidence") {
        if (contentPlan.no_context_mode) {
          if (paragraphLooksLikeInventedNoContextEvidence(paragraph)) {
            throw new Error("Structured no-context body invented unsupported candidate evidence.");
          }
          if (jobOverlap < 2 && !themeMentioned) {
            throw new Error(
              "Structured no-context evidence paragraph is too empty or role-mismatched.",
            );
          }
        } else {
          if (!factMentioned && !themeMentioned) {
            throw new Error("Structured body evidence paragraph does not match the validated plan role.");
          }
          if (
            evidenceSummary &&
            plannerResult.proof_strategy === "concrete_supported" &&
            evidenceSummary.topAchievements.length > 0
          ) {
            const referencedAchievementFacts = referencedFacts.filter((fact) =>
              evidenceSummary.topAchievements.includes(fact),
            );
            if (
              referencedAchievementFacts.length > 0 &&
              !referencedAchievementFacts.some((fact) =>
                paragraphMentionsReferencedFact(paragraph, fact),
              )
            ) {
              throw new Error(
                "Structured body evidence paragraph omitted the required achievement substance.",
              );
            }
          }
          if (interestOnly && !factMentioned) {
            throw new Error(
              "Structured body evidence paragraph is too generic for the supported evidence available.",
            );
          }
        }
      }

      if (paragraphPlan.role === "motivation") {
        if (jobOverlap < 1 && !themeMentioned) {
          throw new Error(
            "Structured body motivation paragraph does not match the validated plan role.",
          );
        }
        if (!paragraphShowsWorkLevelMotivation({ paragraph, themeMentioned, jobOverlap })) {
          throw new Error(
            "Structured body motivation paragraph does not close on specific work-level motivation or grounded fit.",
          );
        }
        if (interestOnly && (!themeMentioned || jobOverlap < 2)) {
          throw new Error(
            "Structured body motivation paragraph restates generic interest instead of grounding the close in the work.",
          );
        }
      }

      paragraphDiagnostics.push({
        role: paragraphPlan.role,
        paragraph,
        firstSentence,
        stemClass,
        stemPrefix,
        jobOverlap,
        themeMentioned,
        interestOnly,
      });
    }
  }

  if (contentPlan && plannerResult && paragraphDiagnostics.length > 1) {
    const openingDiagnostic = paragraphDiagnostics.find(
      (diagnostic) => diagnostic.role === "opening",
    );
    const evidenceDiagnostic = paragraphDiagnostics.find(
      (diagnostic) => diagnostic.role === "evidence",
    );
    const motivationDiagnostic = paragraphDiagnostics.find(
      (diagnostic) => diagnostic.role === "motivation",
    );

    if (contentPlan.no_context_mode) {
      const interestOnlyCount = paragraphDiagnostics.filter(
        (diagnostic) => diagnostic.interestOnly,
      ).length;
      if (interestOnlyCount > 1) {
        throw new Error(
          "Structured no-context body collapses into repeated interest-only paragraphs.",
        );
      }
    }

    if (openingDiagnostic && motivationDiagnostic) {
      const repeatedOpeningMove =
        !!openingDiagnostic.stemClass &&
        openingDiagnostic.stemClass === motivationDiagnostic.stemClass;
      const repeatedStemPrefix =
        openingDiagnostic.stemPrefix.length >= 16 &&
        openingDiagnostic.stemPrefix === motivationDiagnostic.stemPrefix;
      const openingMotivationOverlap = countTokenOverlap(
        openingDiagnostic.paragraph,
        motivationDiagnostic.paragraph,
      );
      const motivationUniqueDelta = countUniqueTokenDelta(
        openingDiagnostic.paragraph,
        motivationDiagnostic.paragraph,
      );

      if (
        repeatedOpeningMove ||
        repeatedStemPrefix ||
        (openingMotivationOverlap >= 5 && motivationUniqueDelta < 3)
      ) {
        throw new Error(
          "Structured body motivation paragraph repeats the opening instead of providing a distinct close.",
        );
      }
    }

    if (evidenceDiagnostic && motivationDiagnostic) {
      const evidenceMotivationOverlap = countTokenOverlap(
        evidenceDiagnostic.paragraph,
        motivationDiagnostic.paragraph,
      );
      const motivationUniqueDelta = countUniqueTokenDelta(
        evidenceDiagnostic.paragraph,
        motivationDiagnostic.paragraph,
      );
      if (
        evidenceMotivationOverlap >= 6 &&
        motivationUniqueDelta < 3 &&
        (motivationDiagnostic.interestOnly || motivationDiagnostic.jobOverlap < 3)
      ) {
        throw new Error(
          "Structured body motivation paragraph repeats the evidence paragraph instead of closing on grounded fit.",
        );
      }
    }

    const repeatedStemClasses = new Set<string>();
    for (const diagnostic of paragraphDiagnostics) {
      if (!diagnostic.stemClass) continue;
      if (repeatedStemClasses.has(diagnostic.stemClass)) {
        throw new Error(
          "Structured body repeats the same rhetorical opening across paragraphs.",
        );
      }
      repeatedStemClasses.add(diagnostic.stemClass);
    }
  }

  return paragraphs;
}
