import type { ProposalOutputFormat, ProposalOutputLanguage } from "./proposalOutput";
import {
  resolveProposalOutputLanguage,
} from "./proposalOutput";
import {
  PROPOSAL_FORBIDDEN_BRIDGES,
  containsForbiddenProposalBridge,
  normalizeProposalConstraintText,
  type ProposalPlannerResult,
} from "./proposalPlanner";

export type ProposalVerificationIssue = {
  code:
    | "no_context_phrase"
    | "no_context_readiness"
    | "language_mismatch"
    | "credential_inflation"
    | "completed_qualification_drift"
    | "employer_synthesis"
    | "unsupported_operational_history"
    | "adjacent_readiness"
    | "distant_readiness";
  message: string;
};

export type ProposalRepairSafeRewriteMode =
  | "interest_only"
  | "downgrade_to_past_fact"
  | "remove_qualification_conclusion"
  | "remove_unsupported_impact";

export type FlaggedSentence = {
  sentenceIndex: number;
  originalSentence: string;
  issueCode: ProposalVerificationIssue["code"] | string;
  reason: string;
  safeRewriteMode: ProposalRepairSafeRewriteMode;
};

export type ProposalDraftAnalysis = {
  issues: ProposalVerificationIssue[];
  flaggedSentences: FlaggedSentence[];
};

type VerifyProposalDraftArgs = {
  content: string;
  plan: ProposalPlannerResult;
  format: ProposalOutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string | null;
  jobTitle: string;
  jobDescription: string;
};

type NormalizeProposalOutputArgs = {
  content: string;
  format: ProposalOutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string | null;
};

type ExtractFinalProposalContentArgs = {
  content: string;
  format: ProposalOutputFormat;
  outputLanguage?: ProposalOutputLanguage;
  candidateName?: string | null;
};

type BuildProposalRepairPromptArgs = {
  flaggedSentence: FlaggedSentence;
  plan: ProposalPlannerResult;
  format: ProposalOutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string | null;
  previousSentence?: string | null;
  nextSentence?: string | null;
};

type ApplyProposalSentencePatchesArgs = {
  content: string;
  format: ProposalOutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string | null;
  patches: Array<{
    sentenceIndex: number;
    originalSentence: string;
    replacementSentence: string;
  }>;
};

type RepairProposalSentenceLocallyArgs = {
  flaggedSentence: FlaggedSentence;
  plan: ProposalPlannerResult;
  outputLanguage: ProposalOutputLanguage;
};

const STRICT_INTEREST_ONLY_REPAIR_SENTENCE = {
  English:
    "The role centers on concrete day-to-day work, coordination, and operating context.",
  French:
    "Le poste repose sur un travail concret au quotidien, de la coordination et un cadre d'execution clair.",
} as const;

const STRICT_NO_CONTEXT_REPAIR_BANNED_PATTERNS: RegExp[] = [
  /\bbackground\b/i,
  /\bexperience with\b/i,
  /\bskills in\b/i,
  /\bmy background includes\b/i,
  /\bmy experience includes\b/i,
  /\b(?:rust|python)\b/i,
];

const STRICT_DISTANT_REPAIR_BANNED_PATTERNS: RegExp[] = [
  /\baligns with\b/i,
  /\bmay offer relevant perspective\b/i,
  /\beager to apply\b/i,
];

type ProposalClaimType =
  | "interest"
  | "past_fact"
  | "achievement"
  | "transferable_trait"
  | "readiness"
  | "qualification";

type ProposalClaimStrength = "low" | "medium" | "high";

const ENGLISH_SALUTATION = "Dear Hiring Manager,";
const FRENCH_SALUTATION = "Madame, Monsieur,";
const ENGLISH_CLOSING = "Sincerely,";
const FRENCH_CLOSING = "Cordialement,";

const STRONG_OPERATIONAL_VERBS = [
  "manage",
  "monitor",
  "respond",
  "conduct",
  "coordinate",
  "design",
  "plan",
  "prepare",
  "support",
  "assist",
  "handle",
  "lead",
  "oversee",
  "implement",
  "enforce",
  "maintain",
  "protect",
  "review",
  "track",
  "submit",
  "report",
  "patrol",
  "inspect",
  "audit",
  "troubleshoot",
  "analyze",
  "document",
  "administer",
  "operate",
  "configure",
  "create",
  "edit",
  "retouch",
  "composite",
  "gerer",
  "gérer",
  "surveiller",
  "repondre",
  "répondre",
  "coordonner",
  "concevoir",
  "planifier",
  "preparer",
  "préparer",
  "assister",
  "maintenir",
  "proteger",
  "protéger",
  "analyser",
  "documenter",
  "rediger",
  "rédiger",
  "retoucher",
  "monter",
  "compositing",
];

const CLAIM_INTENSIFIERS = [
  "adept at",
  "proficient in",
  "experienced in",
  "skilled in",
  "knowledge of",
  "knowledgeable in",
  "comfortable with",
  "familiar with",
  "capable of",
  "ability to",
  "prepared me to",
  "directly translates",
  "directly applicable",
  "aligns closely with",
  "confident in my ability",
  "experience with",
  "a l'aise avec",
  "à l'aise avec",
  "familier avec",
  "expérience en",
  "capacité à",
  "préparé à",
  "preparé à",
];

const CANDIDATE_HISTORY_CUES =
  /\b(?:in previous roles?|at my previous|in my previous|during my|my experience|my background|worked(?: as| at)?|working(?: as| at)?|served as|as a|as an|lors de mon expérience|dans mon rôle|mon parcours|mon expérience)\b/i;

const FORWARD_OPERATIONAL_READINESS_PATTERNS: RegExp[] = [
  /\b(?:i can|i could|i would|i will|je peux|je pourrais|je vais)\s+(?:manage|monitor|respond|conduct|coordinate|design|plan|prepare|support|assist|handle|lead|oversee|implement|enforce|maintain|protect|review|track|submit|report|patrol|inspect|audit|troubleshoot|analyze|document|administer|operate|configure|create|edit|retouch|composite|gerer|gérer|surveiller|repondre|répondre|coordonner|concevoir|planifier|preparer|préparer|assister|maintenir|proteger|protéger|analyser|documenter|rediger|rédiger|retoucher|monter)\b/i,
  /\b(?:i(?:'m| am)|i’m)\s+(?:ready|prepared)\s+to\s+(?:contribute|support|help|lead|take ownership of|own)\b/i,
  /\b(?:prepared me to|prepares me to|would allow me to|would enable me to|would position me to|directly translates? to|directly applicable to)\b/i,
  /\b(?:strengths?|skills?)\s+i(?:'d| would)\s+bring\s+to\b/i,
];

const NO_CONTEXT_READINESS_PATTERNS: RegExp[] = [
  /\b(?:i am prepared to|i am ready to|je suis prêt à|je suis pret à)\s+(?:manage|monitor|respond|conduct|coordinate|design|plan|prepare|support|assist|handle|lead|oversee|implement|enforce|maintain|protect|review|track|submit|report|patrol|inspect|audit|troubleshoot|analyze|document|administer|operate|configure)\b/i,
  /\b(?:i(?:'m| am)|i’m)\s+(?:ready|prepared)\s+to\s+(?:contribute|support|help|lead|take ownership of|own)\b/i,
  /\b(?:strengths?|skills?)\s+i(?:'d| would)\s+bring\s+to\b/i,
  /\b(?:i can|i could|je peux|je pourrais)\s+(?:manage|monitor|respond|conduct|coordinate|design|plan|prepare|support|assist|handle|lead|oversee|implement|enforce|maintain|protect|review|track|submit|report|patrol|inspect|audit|troubleshoot|analyze|document|administer|operate|configure)\b/i,
];

const CAPABILITY_ASSERTION_PATTERNS: RegExp[] = [
  /\b(?:i(?:'d| would)\s+bring|i(?:'m| am)\s+eager\s+to\s+bring)\b[^.]{0,60}\b(?:skills?|strengths?|expertise|experience|background|knowledge|aptitude|mindset|capabilit(?:y|ies)|ability|problem[-\s]?solving|technical aptitude)\b/i,
  /\b(?:contribute|support)\b[^.]{0,20}\b(?:meaningfully|effectively|directly|immediately|right away|from day one)\b/i,
  /\b(?:confident)\b[^.]{0,30}\b(?:could|can|would|adapt|handle|meet)\b/i,
  /\b(?:take ownership of|own|lead|drive)\b[^.]{0,20}\b(?:projects?|tasks?|efforts?|work)\b/i,
  /\b(?:technical aptitude|problem[-\s]?solving skills?|hands?-on experience|strong foundation|solid foundation|deep understanding|well qualified|fully qualified|qualified to|expertise in|proficiency in|familiarity with)\b/i,
  /\b(?:my|this|that)\s+(?:background|experience|degree|education|training|role)\b[^.]{0,80}\b(?:prepared|prepares|positioned|positions|enabled|enables|equipped|equips|allows?|would allow|would enable|gives?|gave)\b/i,
];

const QUALIFICATION_STRENGTHENING_PATTERNS: RegExp[] = [
  /\b(?:well\s+qualified|fully\s+qualified|highly\s+qualified|qualified\s+to|expertise\s+in|deep understanding of|proficiency in|hands?-on experience in|strong foundation in|solid foundation in)\b/i,
  /\b(?:strengthened|strengthens|deepened|built|builds)\b[^.]{0,50}\b(?:expertise|proficiency|qualification|foundation)\b/i,
];

const INTEREST_PATTERNS: RegExp[] = [
  /\b(?:i(?:'m| am)\s+interested\s+in|i(?:'m| am)\s+drawn\s+to|i(?:'d| would)\s+welcome\s+the\s+opportunity|i(?:'d| would)\s+value\s+the\s+opportunity|i(?:'m| am)\s+eager\s+to\s+learn\s+more)\b/i,
];

const TRANSFERABLE_TRAIT_PATTERNS: RegExp[] = [
  /\b(?:attention to detail|reliability|coordination|consistency|communication|adaptability|professionalism|willingness to learn|problem[-\s]?solving|technical curiosity|structured approach|follow[-\s]?through|collaboration|detail-oriented)\b/i,
];

const TARGET_TASK_BRIDGE_PATTERNS: RegExp[] = [
  /\b(?:aligns?\s+with|matches?|supports?|would support|would help|would allow|would enable|would contribute(?:\s+to)?|can support|can help|can contribute(?:\s+to)?|would bring|bring\b[^.]{0,20}\bto|fit(?:s)?\s+(?:for|with)|suited\s+(?:for|to)|strong fit)\b/i,
  /\b(?:take ownership of|own|lead|drive|deliver)\b/i,
];

const TARGET_CONTEXT_NOUN_PATTERN =
  /\b(?:projects?|tasks?|efforts?|workflows?|responsibilities|role|position|team|needs?)\b/i;

const QUALIFICATION_FIT_PATTERNS: RegExp[] = [
  /\b(?:well\s+qualified|fully\s+qualified|highly\s+qualified|qualified\s+for|qualified\s+to|strong fit|good fit|fit for|fit with|suited\s+(?:for|to))\b/i,
  /\b(?:my|this)\s+(?:background|degree|education|training)\b[^.]{0,60}\b(?:positions?|positioned|equips?|equipped|makes?|made)\b/i,
  /\b(?:positions?|positioned|equips?|equipped|makes?|made)\b[^.]{0,25}\b(?:me|my background|my degree|my education|my training)\b[^.]{0,20}\b(?:well|for|to|a strong fit|suited)\b/i,
];

const ACHIEVEMENT_IMPACT_VERB_PATTERN =
  /\b(?:improved|improving|increase(?:d|s)?|increasing|reduced|reducing|boosted|boosting|drove|driving|generated|generating|delivered|delivering|achieved|achieving|grew|grown|raised|raising)\b/i;

const ACHIEVEMENT_IMPACT_NOUN_PATTERN =
  /\b(?:efficiency|reliability|performance|productivity|output|outcomes?|results?|impact|throughput|quality|revenue|sales|profit|profits|growth|business|commercial)\b/i;

const BUSINESS_IMPACT_PATTERNS: RegExp[] = [
  /\b(?:revenue|sales|profit|profits|commercial impact|business growth|growth|margin|market share|pipeline)\b/i,
  /\b(?:business|commercial)\s+impact\b/i,
];

const PAST_FACT_PATTERNS: RegExp[] = [
  /\b(?:i worked as|i work as|i served as|i supervised|i managed|i coordinated|i developed|i validated|i designed|i tested|i hold\b|i earned\b|i completed\b|i studied\b)\b/i,
];

const NO_CONTEXT_BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/\bwhile i may not have direct experience\b/i, "Remove negative-history disclaimers in no-context mode."],
  [/\bwhile i am new to the field\b/i, "Do not claim lack of experience in no-context mode."],
  [/\balthough i lack experience\b/i, "Do not claim lack of experience in no-context mode."],
  [/\bmy ability to\b[\s\S]{0,80}\bwould allow me to\b/i, "Do not imply soft acquired practice in no-context mode."],
  [/\bi am confident in my ability to\b/i, "Do not imply demonstrated capability in no-context mode."],
  [/\bi understand the importance of\b/i, "Do not use soft readiness phrasing in no-context mode."],
  [/\bin previous roles?\b/i, "Do not describe prior roles in no-context mode."],
  [/\bmy experience includes\b/i, "Do not describe prior experience in no-context mode."],
  [/\bi have worked with\b/i, "Do not imply prior tool or system use in no-context mode."],
  [/\bi have managed\b/i, "Do not imply prior operational ownership in no-context mode."],
  [/\bbien que je n['’]aie pas d['’]expérience directe\b/i, "Remove negative-history disclaimers in no-context mode."],
  [/\bmême si je n['’]ai pas d['’]expérience\b/i, "Remove negative-history disclaimers in no-context mode."],
  [/\bje comprends l['’]importance de\b/i, "Do not use soft readiness phrasing in no-context mode."],
  [/\bma capacité à\b[\s\S]{0,80}\bme permettrait de\b/i, "Do not imply soft acquired practice in no-context mode."],
];

const EXACT_CREDENTIAL_BANNED_PATTERNS: Array<[RegExp, string]> = [
  [/\blicensed\b/i, "Do not claim the candidate is licensed unless that exact claim is source-backed."],
  [/\bmeets the requirement\b/i, "Do not claim the candidate meets the exact requirement unless explicitly supported."],
  [/\bholds the required certification\b/i, "Do not claim the candidate holds the required certification unless explicitly supported."],
  [/\bqualified under\b/i, "Do not claim the candidate is qualified under the named requirement unless explicitly supported."],
];

const COMPLETED_QUALIFICATION_PATTERNS: Array<[RegExp, string]> = [
  [/\bholds a bachelor'?s\b/i, "Do not present in-progress education as completed."],
  [/\bhas a bachelor'?s\b/i, "Do not present in-progress education as completed."],
  [/\bearned a bachelor'?s\b/i, "Do not present in-progress education as completed."],
  [/\bcompleted (?:a|the)?\s*(?:degree|bachelor'?s|master'?s)\b/i, "Do not present in-progress education as completed."],
];

const ENGLISH_GREETING_OR_CLOSING_PATTERN =
  /\bDear Hiring Manager,|\bSincerely,/i;
const FRENCH_GREETING_OR_CLOSING_PATTERN =
  /\bMadame, Monsieur,|\bCordialement,/i;
const MARKDOWN_SEPARATOR_PATTERN = /^[-*_]{3,}$/;
const MARKDOWN_CODE_FENCE_PATTERN = /^```/;
const WORD_COUNT_LINE_PATTERN = /^\(?\s*word\s+count\s*:\s*\d+\s*\)?$/i;
const LEADING_EDITORIAL_PATTERNS: RegExp[] = [
  /^(?:here(?:['’]s| is))\s+(?:a\s+)?(?:concise|brief|short)\s+(?:proposal|cover letter|application message|message)\b(?:[,:.!…-].*)?$/i,
  /^(?:here(?:['’]s| is))\s+(?:a\s+)?(?:concise|brief|short)[^.\n]*\b(?:proposal|cover letter|application message|message|freelance proposal)\b[^.\n]*[:.!…-]?$/i,
  // Recover assistant-style wrapper intros like "Here's a tailored cover letter ..."
  // so separator-delimited body paragraphs can be preserved as the real letter body.
  /^(?:here(?:['’]s| is)|below is)\s+(?:(?:a|the)\s+)?(?:tailored|custom(?:ized)?|personalized)\s+(?:employment\s+)?(?:cover letter|application message|message|proposal)\b.*$/i,
  /^(?:here(?:['’]s| is)|below is)\s+(?:the\s+)?(?:(?:corrected|revised|updated|refined|final|verified)\s*(?:and\s+)*)+(?:final\s+)?(?:proposal|cover letter|application message|freelance proposal)(?:\s+draft)?\b(?:[,:.!…-].*)?$/i,
  /^(?:(?:corrected|revised|updated|refined|final|verified)\s*(?:and\s+)*)+(?:final\s+)?(?:proposal|cover letter|application message|freelance proposal)(?:\s+draft)?\b(?:[,:.!…-].*)?$/i,
  /^(?:final\s+)?(?:proposal|cover letter|application message|freelance proposal)\b[:.!]*$/i,
  /^(?:cover letter|application message|message|proposal)(?:\s+for\b.*)?[:.!…-]*$/i,
  /^#+\s*(?:(?:corrected|revised|updated|refined|final|verified)\s*(?:and\s+)*)+(?:proposal|cover letter|application message|freelance proposal)(?:\s+draft)?\b(?:[,:.!…-].*)?$/i,
  /^\*{1,2}(?:(?:corrected|revised|updated|refined|final|verified)\s*(?:and\s+)*)+(?:proposal|cover letter|application message|freelance proposal)(?:\s+draft)?\b(?:[,:.!…-].*)?\*{1,2}$/i,
];
const TRAILING_EDITORIAL_SECTION_PATTERNS: RegExp[] = [
  /^(?:key corrections?|corrections?|notes?|editorial notes?|explanation|commentary)\b[:.!]*$/i,
  /^#+\s*(?:key corrections?|corrections?|notes?|editorial notes?|explanation|commentary)\b[:.!]*$/i,
  /^\*{1,2}(?:key corrections?|corrections?|notes?|editorial notes?|explanation|commentary)\b.*\*{1,2}$/i,
];

const COMMON_STOPWORDS = new Set([
  "about",
  "against",
  "align",
  "aligns",
  "allow",
  "allows",
  "because",
  "benefit",
  "benefits",
  "candidate",
  "company",
  "customers",
  "dependents",
  "details",
  "direct",
  "environment",
  "experience",
  "families",
  "government",
  "hiring",
  "interest",
  "position",
  "professional",
  "professionalism",
  "requirements",
  "responsibilities",
  "role",
  "security",
  "service",
  "services",
  "skills",
  "support",
  "supports",
  "supporting",
  "survivors",
  "team",
  "their",
  "these",
  "those",
  "through",
  "veterans",
  "would",
  "avec",
  "cela",
  "cette",
  "dans",
  "leurs",
  "pour",
  "poste",
  "profil",
  "role",
  "rôle",
  "securite",
  "sécurité",
  "service",
  "services",
  "travail",
]);

const PLACEHOLDER_SIGNATURE_PATTERN = /^\[\s*(?:candidate|your)\s+name\s*\]$/i;
const EDUCATION_FACT_PATTERN =
  /\b(?:degree|education|training|coursework|b\.?e\.?|bachelor|master|diploma|engineering|certification|certificate|studied|study|hold)\b/i;
const BACKGROUND_SCOPE_FACT_PATTERN =
  /\b(?:worked as|served as|experience|background|role|position|supervised|managed|coordinated|handled|monitored|supported|designed|developed|validated|tested|production|workflow)\b/i;
const MIXED_SENTENCE_UNSUPPORTED_TAIL_RULES: ReadonlyArray<{
  issueCode: "unsupported_operational_history" | "credential_inflation";
  message: string;
  pattern: RegExp;
}> = [
  {
    issueCode: "unsupported_operational_history",
    message:
      "Do not extend supported past facts into unsupported security-process familiarity, operational readiness, or task-readiness tails.",
    pattern:
      /\b(?:and\s+)?i\s+(?:am|have\s+been)\s+familiar\s+with\b/i,
  },
  {
    issueCode: "unsupported_operational_history",
    message:
      "Do not extend supported past facts into unsupported security-process familiarity, operational readiness, or task-readiness tails.",
    pattern:
      /\bi\s+understand\s+the\s+importance\s+of\b/i,
  },
  {
    issueCode: "unsupported_operational_history",
    message:
      "Do not extend supported past facts into unsupported security-process familiarity, operational readiness, or task-readiness tails.",
    pattern:
      /\b(?:and\s+)?i\s+would\s+approach\b/i,
  },
  {
    issueCode: "unsupported_operational_history",
    message:
      "Do not extend supported past facts into unsupported security-process familiarity, operational readiness, or task-readiness tails.",
    pattern:
      /\b(?:demonstrates?|reflects?|shows?|underscores?)\s+(?:a|an|the)\s+(?:focus|ability|readiness|understanding|knowledge)\b/i,
  },
  {
    issueCode: "unsupported_operational_history",
    message:
      "Do not extend supported past facts into unsupported security-process familiarity, operational readiness, or task-readiness tails.",
    pattern:
      /\bensuring\s+compliance\s+with\s+safety\s+protocols\b/i,
  },
  {
    issueCode: "credential_inflation",
    message:
      "Do not extend supported past facts into unsupported requirement-fit, credential, or certification-readiness tails.",
    pattern:
      /\b(?:and\s+)?i(?:['’]m| am)\s+prepared\s+to\s+meet\b/i,
  },
  {
    issueCode: "credential_inflation",
    message:
      "Do not extend supported past facts into unsupported requirement-fit, credential, or certification-readiness tails.",
    pattern:
      /\bmeet\s+the\s+minimum\s+requirements\b/i,
  },
  {
    issueCode: "credential_inflation",
    message:
      "Do not extend supported past facts into unsupported requirement-fit, credential, or certification-readiness tails.",
    pattern:
      /\b(?:valid\s+driver['’]s?\s+license|preferred\s+bls\s+certification|bls\s+certification)\b/i,
  },
] as const;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isMarkdownWrapperLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    MARKDOWN_SEPARATOR_PATTERN.test(trimmed) ||
    MARKDOWN_CODE_FENCE_PATTERN.test(trimmed)
  );
}

function normalizeForMatch(value: string): string {
  return compactWhitespace(value).toLowerCase();
}

function formatQuotedPhraseList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(", ");
}

function ensureTerminalSentence(value: string): string {
  const normalized = compactWhitespace(value);
  if (!normalized) return "";
  if (/[.!?]["'”’)\]]*$/u.test(normalized)) {
    return normalized;
  }
  return `${normalized}.`;
}

export function getDeterministicInterestOnlyRepairSentence(
  outputLanguage: ProposalOutputLanguage,
): string {
  return STRICT_INTEREST_ONLY_REPAIR_SENTENCE[outputLanguage];
}

function getNoContextRepairSentence(args: {
  outputLanguage: ProposalOutputLanguage;
  plan: ProposalPlannerResult;
  flaggedSentence: FlaggedSentence;
}): string {
  const normalizedSentence = normalizeProposalConstraintText(
    args.flaggedSentence.originalSentence,
  );
  const normalizedThemes = args.plan.allowed_transfer_themes.map((theme) =>
    normalizeProposalConstraintText(theme),
  );
  const roleInterestTheme = normalizedThemes.some((theme) =>
    /\b(?:interest|role|type of work|role understanding|mission|values)\b/i.test(
      theme,
    ),
  );
  const reliabilityTheme = normalizedThemes.some((theme) =>
    /\b(?:reliability|communication|curiosity|learn)\b/i.test(theme),
  );

  if (args.outputLanguage === "French") {
    if (
      roleInterestTheme ||
      /\b(?:role|poste|travail|mission|entreprise)\b/i.test(normalizedSentence)
    ) {
      return "Le travail concret et le cadre quotidien du poste sont les aspects qui retiennent d'abord mon attention.";
    }
    if (
      /\b(?:communication|fiabilite|fiabilité|apprendre|curiosite|curiosité)\b/i.test(
        normalizedSentence,
      ) ||
      args.flaggedSentence.issueCode === "no_context_readiness"
    ) {
      return "Le poste semble demander de la regularite, une communication claire et un suivi quotidien soigne.";
    }
    if (reliabilityTheme) {
      return "Le travail parait reposer sur de l'organisation, de la constance et une communication claire au quotidien.";
    }
    return STRICT_INTEREST_ONLY_REPAIR_SENTENCE.French;
  }

  if (
    roleInterestTheme ||
    /\b(?:role|position|work|mission|company)\b/i.test(normalizedSentence)
  ) {
    return "The day-to-day work itself is the part of the role that stands out to me most.";
  }
  if (
    /\b(?:communication|reliability|learn|curiosity)\b/i.test(
      normalizedSentence,
    ) || args.flaggedSentence.issueCode === "no_context_readiness"
  ) {
    return "The role appears to depend on steady follow-through, clear communication, and organized day-to-day coordination.";
  }
  if (reliabilityTheme) {
    return "The work seems to call for consistency, organization, and clear communication from day to day.";
  }
  return STRICT_INTEREST_ONLY_REPAIR_SENTENCE.English;
}

export function hasStrictNoContextRepairViolation(value: string): boolean {
  const normalized = compactWhitespace(value);
  if (!normalized) return false;
  return STRICT_NO_CONTEXT_REPAIR_BANNED_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

export function hasOverProjectiveRepairWording(value: string): boolean {
  const normalized = compactWhitespace(value);
  if (!normalized) return false;
  return STRICT_DISTANT_REPAIR_BANNED_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function isLeadingEditorialLine(line: string): boolean {
  const trimmed = compactWhitespace(line);
  return LEADING_EDITORIAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isTrailingEditorialSectionLine(line: string): boolean {
  const trimmed = compactWhitespace(line);
  if (WORD_COUNT_LINE_PATTERN.test(trimmed)) return true;
  return TRAILING_EDITORIAL_SECTION_PATTERNS.some((pattern) =>
    pattern.test(trimmed),
  );
}

function isProposalWrapperLine(line: string): boolean {
  const trimmed = compactWhitespace(line);
  return (
    WORD_COUNT_LINE_PATTERN.test(trimmed) ||
    isLeadingEditorialLine(trimmed) ||
    isTrailingEditorialSectionLine(trimmed)
  );
}

function getExpectedCoverLetterSalutation(
  outputLanguage?: ProposalOutputLanguage,
): string {
  return outputLanguage === "French" ? FRENCH_SALUTATION : ENGLISH_SALUTATION;
}

function getExpectedCoverLetterClosing(
  outputLanguage?: ProposalOutputLanguage,
): string {
  return outputLanguage === "French" ? FRENCH_CLOSING : ENGLISH_CLOSING;
}

function compactLines(lines: string[]): string[] {
  const compacted = lines.filter((line, index) => {
    if (line !== "") return true;
    return index > 0 && lines[index - 1] !== "";
  });

  while (compacted.length > 0 && compacted[0] === "") {
    compacted.shift();
  }
  while (compacted.length > 0 && compacted[compacted.length - 1] === "") {
    compacted.pop();
  }

  return compacted;
}

function findEditorialBoundaryIndex(lines: string[]): number {
  let sawContent = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "") {
      continue;
    }
    if (WORD_COUNT_LINE_PATTERN.test(line)) {
      continue;
    }
    if (!sawContent) {
      sawContent = true;
      continue;
    }
    if (
      MARKDOWN_SEPARATOR_PATTERN.test(line) ||
      MARKDOWN_CODE_FENCE_PATTERN.test(line) ||
      isTrailingEditorialSectionLine(line)
    ) {
      return index;
    }
  }
  return -1;
}

function normalizeCoverLetterBoundaryLine(line: string): string {
  let normalized = line
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  normalized = normalized.replace(/^>\s*/, "").trim();

  let changed = true;
  while (changed && normalized.length > 0) {
    const before = normalized;
    normalized = normalized
      .replace(/^(?:\*\*|__|[*_`~])\s*/, "")
      .replace(/\s*(?:\*\*|__|[*_`~])$/, "")
      .trim();
    changed = normalized !== before;
  }

  changed = true;
  while (changed && normalized.length > 0) {
    const before = normalized;
    normalized = normalized
      .replace(/^[\"'“”‘’(\[]\s*/, "")
      .replace(/\s*[\"'“”‘’)\]]$/, "")
      .trim();
    changed = normalized !== before;
  }

  return normalized.toLowerCase();
}

function normalizeCoverLetterSignatureLine(line: string): string {
  return normalizeCoverLetterBoundaryLine(line).replace(/[,:;.!?]+$/u, "").trim();
}

function isCoverLetterSalutation(line: string): boolean {
  const trimmed = normalizeCoverLetterBoundaryLine(line);
  return (
    /^dear\s+hiring\s+manager[,:;.!?]*$/i.test(trimmed) ||
    /^madame\s*,?\s*monsieur[,:;.!?]*$/i.test(trimmed)
  );
}

function isCoverLetterClosing(line: string): boolean {
  const trimmed = normalizeCoverLetterBoundaryLine(line);
  return (
    /^sincerely[,:;.!?]*$/i.test(trimmed) ||
    /^best\s+regards[,:;.!?]*$/i.test(trimmed) ||
    /^kind\s+regards[,:;.!?]*$/i.test(trimmed) ||
    /^regards[,:;.!?]*$/i.test(trimmed) ||
    /^respectfully[,:;.!?]*$/i.test(trimmed) ||
    /^yours\s+sincerely[,:;.!?]*$/i.test(trimmed) ||
    /^yours\s+faithfully[,:;.!?]*$/i.test(trimmed) ||
    /^cordialement[,:;.!?]*$/i.test(trimmed) ||
    /^bien\s+cordialement[,:;.!?]*$/i.test(trimmed) ||
    /^respectueusement[,:;.!?]*$/i.test(trimmed)
  );
}

function looksLikeSignatureName(line: string): boolean {
  const trimmed = normalizeCoverLetterSignatureLine(line);
  if (!trimmed || trimmed.length > 80) return false;
  if (/[0-9@:/\\]/.test(trimmed)) return false;
  return /^[\p{L}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}][\p{L}\p{M}'’.-]*){0,4}$/u.test(
    trimmed,
  );
}

function isSignatureLine(
  line: string,
  candidateName?: string | null,
): boolean {
  const trimmed = normalizeCoverLetterSignatureLine(line);
  if (!trimmed) return false;
  if (
    candidateName &&
    normalizeForMatch(trimmed) === normalizeForMatch(candidateName)
  ) {
    return true;
  }
  return looksLikeSignatureName(trimmed);
}

function isPlaceholderSignatureLine(line: string): boolean {
  return PLACEHOLDER_SIGNATURE_PATTERN.test(compactWhitespace(line));
}

function isMeaningfulCoverLetterBodyLine(
  line: string,
  candidateName?: string | null,
): boolean {
  const trimmed = compactWhitespace(line);
  if (!trimmed) return false;
  if (
    isCoverLetterSalutation(trimmed) ||
    isCoverLetterClosing(trimmed) ||
    isLeadingEditorialLine(trimmed) ||
    isTrailingEditorialSectionLine(trimmed) ||
    MARKDOWN_SEPARATOR_PATTERN.test(trimmed) ||
    MARKDOWN_CODE_FENCE_PATTERN.test(trimmed) ||
    isPlaceholderSignatureLine(trimmed) ||
    isSignatureLine(trimmed, candidateName)
  ) {
    return false;
  }
  return true;
}

function buildCoverLetterBodyCandidate(
  lines: string[],
  candidateName?: string | null,
): {
  bodyLines: string[];
  meaningfulCount: number;
  meaningfulSentenceCount: number;
  meaningfulChars: number;
} {
  const bodyLines = compactLines(
    lines.filter((line) => {
      if (line === "") return true;
      return isMeaningfulCoverLetterBodyLine(line, candidateName);
    }),
  );
  const meaningfulLines = bodyLines.filter((line) =>
    isMeaningfulCoverLetterBodyLine(line, candidateName),
  );

  return {
    bodyLines,
    meaningfulCount: meaningfulLines.length,
    meaningfulSentenceCount: meaningfulLines.reduce((total, line) => {
      const matches = compactWhitespace(line).match(
        /[.!?](?:["'”’)\]]*)(?=\s|$)/g,
      );
      return total + (matches?.length ?? 0);
    }, 0),
    meaningfulChars: meaningfulLines.reduce(
      (total, line) => total + compactWhitespace(line).length,
      0,
    ),
  };
}

function chooseBetterCoverLetterBodyCandidate(
  current:
    | {
        bodyLines: string[];
        meaningfulCount: number;
        meaningfulSentenceCount: number;
        meaningfulChars: number;
        rank: number;
      }
    | undefined,
  next:
    | {
        bodyLines: string[];
        meaningfulCount: number;
        meaningfulSentenceCount: number;
        meaningfulChars: number;
        rank: number;
      }
    | undefined,
): {
  bodyLines: string[];
  meaningfulCount: number;
  meaningfulSentenceCount: number;
  meaningfulChars: number;
  rank: number;
} | undefined {
  if (!next || next.meaningfulCount === 0) return current;
  if (!current) return next;
  if (next.meaningfulCount !== current.meaningfulCount) {
    return next.meaningfulCount > current.meaningfulCount ? next : current;
  }
  if (next.meaningfulSentenceCount !== current.meaningfulSentenceCount) {
    return next.meaningfulSentenceCount > current.meaningfulSentenceCount
      ? next
      : current;
  }
  if (next.meaningfulChars !== current.meaningfulChars) {
    return next.meaningfulChars > current.meaningfulChars ? next : current;
  }
  return next.rank < current.rank ? next : current;
}

export function extractFinalProposalContent(
  args: ExtractFinalProposalContentArgs,
): string {
  let lines = args.content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  while (
    lines.length > 0 &&
    (lines[0] === "" ||
      isLeadingEditorialLine(lines[0]) ||
      WORD_COUNT_LINE_PATTERN.test(lines[0]) ||
      MARKDOWN_SEPARATOR_PATTERN.test(lines[0]) ||
      MARKDOWN_CODE_FENCE_PATTERN.test(lines[0]))
  ) {
    lines.shift();
  }

  while (
    lines.length > 0 &&
    (lines[lines.length - 1] === "" ||
      isTrailingEditorialSectionLine(lines[lines.length - 1]) ||
      WORD_COUNT_LINE_PATTERN.test(lines[lines.length - 1]) ||
      MARKDOWN_SEPARATOR_PATTERN.test(lines[lines.length - 1]) ||
      MARKDOWN_CODE_FENCE_PATTERN.test(lines[lines.length - 1]))
  ) {
    lines.pop();
  }

  if (args.format === "cover_letter") {
    const expectedSalutation = getExpectedCoverLetterSalutation(
      args.outputLanguage,
    );
    const expectedClosing = getExpectedCoverLetterClosing(args.outputLanguage);
    const candidateName =
      typeof args.candidateName === "string" && args.candidateName.trim().length > 0
        ? args.candidateName.trim()
        : null;
    const editorialBoundaryIndex = findEditorialBoundaryIndex(lines);
    if (editorialBoundaryIndex >= 0) {
      lines = lines.slice(0, editorialBoundaryIndex);
    }

    let bestBodyCandidate:
      | {
          bodyLines: string[];
          meaningfulCount: number;
          meaningfulSentenceCount: number;
          meaningfulChars: number;
          rank: number;
        }
      | undefined;

    for (let salutationIndex = 0; salutationIndex < lines.length; salutationIndex += 1) {
      if (!isCoverLetterSalutation(lines[salutationIndex])) continue;

      for (let closingIndex = salutationIndex + 1; closingIndex < lines.length; closingIndex += 1) {
        if (!isCoverLetterClosing(lines[closingIndex])) continue;

        const bodyCandidate = buildCoverLetterBodyCandidate(
          lines.slice(salutationIndex + 1, closingIndex),
          candidateName,
        );
        bestBodyCandidate = chooseBetterCoverLetterBodyCandidate(
          bestBodyCandidate,
          {
            ...bodyCandidate,
            rank: salutationIndex,
          },
        );
      }
    }

    const fallbackBodyCandidate = buildCoverLetterBodyCandidate(
      lines,
      candidateName,
    );
    const chosenBodyCandidate = chooseBetterCoverLetterBodyCandidate(
      bestBodyCandidate,
      {
        ...fallbackBodyCandidate,
        rank: Number.MAX_SAFE_INTEGER,
      },
    );

    const rebuiltLines = [expectedSalutation];
    if (chosenBodyCandidate && chosenBodyCandidate.bodyLines.length > 0) {
      rebuiltLines.push("", ...chosenBodyCandidate.bodyLines);
    }
    rebuiltLines.push("", expectedClosing);
    if (candidateName) {
      rebuiltLines.push(candidateName);
    }

    return compactLines(rebuiltLines)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } else {
    const editorialBoundaryIndex = findEditorialBoundaryIndex(lines);
    if (editorialBoundaryIndex >= 0) {
      lines = lines.slice(0, editorialBoundaryIndex);
    }
  }

  const compactedLines = compactLines(lines);

  while (
    compactedLines.length > 0 &&
    isMarkdownWrapperLine(compactedLines[0])
  ) {
    compactedLines.shift();
  }
  while (
    compactedLines.length > 0 &&
    isMarkdownWrapperLine(compactedLines[compactedLines.length - 1])
  ) {
    compactedLines.pop();
  }

  return compactedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractProposalBodyForRepair(
  args: ExtractFinalProposalContentArgs,
): string {
  const extracted = extractFinalProposalContent(args);
  if (args.format !== "cover_letter") {
    const lines = extracted
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !isProposalWrapperLine(line));
    return compactLines(lines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  let lines = extracted
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  if (lines.length > 0 && isCoverLetterSalutation(lines[0])) {
    lines.shift();
  }
  while (lines.length > 0 && lines[0] === "") {
    lines.shift();
  }

  const candidateName =
    typeof args.candidateName === "string" && args.candidateName.trim().length > 0
      ? args.candidateName.trim()
      : null;

  if (candidateName && lines.length > 0 && isSignatureLine(lines[lines.length - 1], candidateName)) {
    lines.pop();
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  if (lines.length > 0 && isCoverLetterClosing(lines[lines.length - 1])) {
    lines.pop();
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return compactLines(lines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
  if (!matches) {
    return compactWhitespace(value) ? [compactWhitespace(value)] : [];
  }
  return matches
    .map((sentence) =>
      compactWhitespace(sentence.replace(/__DOT__/g, ".")),
    )
    .filter(Boolean);
}

function splitParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function joinSentences(sentences: string[]): string {
  return sentences.map((sentence) => compactWhitespace(sentence)).filter(Boolean).join(" ");
}

function sentenceContainsAllowedFact(
  sentence: string,
  allowedFacts: readonly string[],
): boolean {
  const normalizedSentence = normalizeForMatch(sentence);
  return allowedFacts.some((fact) => {
    const normalizedFact = normalizeForMatch(fact);
    return (
      normalizedFact.length > 0 &&
      (normalizedSentence.includes(normalizedFact) ||
        normalizedFact.includes(normalizedSentence))
    );
  });
}

function allowedFactsContainPattern(
  pattern: RegExp,
  allowedFacts: readonly string[],
): boolean {
  return allowedFacts.some((fact) => pattern.test(fact));
}

function extractAllowedEmployers(allowedFacts: readonly string[]): string[] {
  const employers = new Set<string>();
  for (const fact of allowedFacts) {
    const match = fact.match(/\bat\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,5})/);
    if (match?.[1]) employers.add(match[1].trim());
  }
  return Array.from(employers);
}

function extractCandidateHistoryEmployers(content: string): string[] {
  const employers = new Set<string>();
  for (const sentence of splitSentences(content)) {
    if (!CANDIDATE_HISTORY_CUES.test(sentence)) {
      continue;
    }
    const matches = sentence.matchAll(
      /\bat\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,5})/g,
    );
    for (const match of matches) {
      if (match[1]) employers.add(match[1].trim());
    }
  }
  return Array.from(employers);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}+/gu, "");
}

function extractMeaningfulTokens(value: string): string[] {
  return Array.from(
    new Set(
      stripAccents(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 4 && !COMMON_STOPWORDS.has(token),
        ),
    ),
  );
}

function buildJobKeywordSet(jobTitle: string, jobDescription: string): Set<string> {
  return new Set([
    ...extractMeaningfulTokens(jobTitle),
    ...extractMeaningfulTokens(jobDescription),
  ]);
}

function countJobKeywordOverlap(sentence: string, jobKeywords: Set<string>): number {
  const sentenceTokens = extractMeaningfulTokens(sentence);
  return sentenceTokens.filter((token) => jobKeywords.has(token)).length;
}

function sentenceLooksLikeCandidateClaim(sentence: string): boolean {
  return /\b(?:i|my|me|je|j'|j’|mon|ma|mes|moi)\b/i.test(sentence);
}

function sentenceLooksOperational(sentence: string): boolean {
  return STRONG_OPERATIONAL_VERBS.some((verb) =>
    new RegExp(`\\b${verb}\\b`, "i").test(sentence),
  );
}

function sentenceLooksLikeReadiness(sentence: string): boolean {
  return CLAIM_INTENSIFIERS.some((phrase) =>
    new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
      sentence,
    ),
  );
}

function sentenceLooksLikeForwardOperationalReadiness(sentence: string): boolean {
  return FORWARD_OPERATIONAL_READINESS_PATTERNS.some((pattern) =>
    pattern.test(sentence),
  );
}

function sentenceLooksLikeNoContextReadiness(sentence: string): boolean {
  return NO_CONTEXT_READINESS_PATTERNS.some((pattern) => pattern.test(sentence));
}

function sentenceLooksLikeCapabilityAssertion(sentence: string): boolean {
  return CAPABILITY_ASSERTION_PATTERNS.some((pattern) => pattern.test(sentence));
}

function sentenceLooksLikeQualificationStrengthening(sentence: string): boolean {
  return QUALIFICATION_STRENGTHENING_PATTERNS.some((pattern) =>
    pattern.test(sentence),
  );
}

function sentenceLooksLikePastOperationalHistory(sentence: string): boolean {
  return (
    CANDIDATE_HISTORY_CUES.test(sentence) &&
    (sentenceLooksOperational(sentence) || sentenceLooksLikeReadiness(sentence))
  );
}

function sentenceLooksLikeInterest(sentence: string): boolean {
  return INTEREST_PATTERNS.some((pattern) => pattern.test(sentence));
}

function sentenceLooksLikeTransferableTrait(sentence: string): boolean {
  return TRANSFERABLE_TRAIT_PATTERNS.some((pattern) => pattern.test(sentence));
}

function sentenceLooksLikeTargetTaskBridge(
  sentence: string,
  overlap: number,
): boolean {
  if (!sentenceLooksLikeTransferableTrait(sentence)) {
    return false;
  }
  const hasBridgeVerb = TARGET_TASK_BRIDGE_PATTERNS.some((pattern) =>
    pattern.test(sentence),
  );
  if (!hasBridgeVerb) {
    return false;
  }
  return overlap >= 1 || TARGET_CONTEXT_NOUN_PATTERN.test(sentence);
}

function sentenceLooksLikeQualification(sentence: string): boolean {
  return (
    sentenceLooksLikeQualificationStrengthening(sentence) ||
    QUALIFICATION_FIT_PATTERNS.some((pattern) => pattern.test(sentence))
  );
}

function sentenceLooksLikeAchievementImpact(sentence: string): boolean {
  return (
    BUSINESS_IMPACT_PATTERNS.some((pattern) => pattern.test(sentence)) ||
    (ACHIEVEMENT_IMPACT_VERB_PATTERN.test(sentence) &&
      ACHIEVEMENT_IMPACT_NOUN_PATTERN.test(sentence)) ||
    (ACHIEVEMENT_IMPACT_VERB_PATTERN.test(sentence) &&
      /\b\d+(?:%| percent)\b/i.test(sentence))
  );
}

function sentenceLooksLikeBusinessImpact(sentence: string): boolean {
  return BUSINESS_IMPACT_PATTERNS.some((pattern) => pattern.test(sentence));
}

function sentenceLooksLikePastFact(sentence: string): boolean {
  return (
    CANDIDATE_HISTORY_CUES.test(sentence) ||
    PAST_FACT_PATTERNS.some((pattern) => pattern.test(sentence))
  );
}

function classifyProposalClaim(
  sentence: string,
  overlap: number,
): { type: ProposalClaimType; strength: ProposalClaimStrength } | null {
  const qualification = sentenceLooksLikeQualification(sentence);
  const readiness =
    sentenceLooksLikeForwardOperationalReadiness(sentence) ||
    sentenceLooksLikeCapabilityAssertion(sentence) ||
    sentenceLooksLikeTargetTaskBridge(sentence, overlap);
  const achievement = sentenceLooksLikeAchievementImpact(sentence);
  const pastFact = sentenceLooksLikePastFact(sentence);
  const transferableTrait = sentenceLooksLikeTransferableTrait(sentence);
  const pureInterest =
    sentenceLooksLikeInterest(sentence) &&
    !qualification &&
    !readiness &&
    !achievement &&
    !pastFact;

  if (pureInterest) {
    return { type: "interest", strength: "low" };
  }
  if (qualification) {
    return { type: "qualification", strength: "high" };
  }
  if (readiness) {
    return {
      type: "readiness",
      strength:
        sentenceLooksLikeTargetTaskBridge(sentence, overlap) ||
        sentenceLooksOperational(sentence)
          ? "high"
          : "medium",
    };
  }
  if (achievement) {
    return {
      type: "achievement",
      strength: sentenceLooksLikeBusinessImpact(sentence) ? "high" : "medium",
    };
  }
  if (pastFact) {
    return { type: "past_fact", strength: overlap >= 2 ? "medium" : "low" };
  }
  if (transferableTrait) {
    return {
      type: "transferable_trait",
      strength: overlap >= 1 ? "medium" : "low",
    };
  }
  return null;
}

function appendIssue(
  issues: ProposalVerificationIssue[],
  issue: ProposalVerificationIssue,
): void {
  if (
    issues.some(
      (existing) =>
        existing.code === issue.code && existing.message === issue.message,
    )
  ) {
    return;
  }
  issues.push(issue);
}

function getSafeRewriteModeForIssue(args: {
  issueCode: ProposalVerificationIssue["code"];
  sentence: string;
  hasAllowedFact: boolean;
}): ProposalRepairSafeRewriteMode {
  switch (args.issueCode) {
    case "no_context_phrase":
    case "no_context_readiness":
      return "interest_only";
    case "credential_inflation":
    case "completed_qualification_drift":
      return "remove_qualification_conclusion";
    case "unsupported_operational_history":
      return sentenceLooksLikeAchievementImpact(args.sentence)
        ? "remove_unsupported_impact"
        : "downgrade_to_past_fact";
    case "adjacent_readiness":
    case "distant_readiness":
    case "employer_synthesis":
      return args.hasAllowedFact || sentenceLooksLikePastFact(args.sentence)
        ? "downgrade_to_past_fact"
        : "interest_only";
    case "language_mismatch":
    default:
      return "interest_only";
  }
}

function rankRepairIssueCode(
  code: ProposalVerificationIssue["code"],
): number {
  switch (code) {
    case "credential_inflation":
      return 0;
    case "unsupported_operational_history":
      return 1;
    case "adjacent_readiness":
    case "distant_readiness":
      return 2;
    case "employer_synthesis":
      return 3;
    case "no_context_readiness":
      return 4;
    case "no_context_phrase":
      return 5;
    case "completed_qualification_drift":
      return 6;
    case "language_mismatch":
    default:
      return 7;
  }
}

function pickPrimaryRepairTarget(
  candidates: Array<FlaggedSentence | null | undefined>,
): FlaggedSentence | null {
  const filtered = candidates.filter(
    (candidate): candidate is FlaggedSentence => Boolean(candidate),
  );
  if (filtered.length === 0) return null;

  return filtered.sort(
    (left, right) =>
      rankRepairIssueCode(left.issueCode as ProposalVerificationIssue["code"]) -
      rankRepairIssueCode(right.issueCode as ProposalVerificationIssue["code"]),
  )[0];
}

function buildFlaggedSentence(args: {
  sentenceIndex: number;
  sentence: string;
  issue: ProposalVerificationIssue;
  hasAllowedFact: boolean;
}): FlaggedSentence {
  return {
    sentenceIndex: args.sentenceIndex,
    originalSentence: args.sentence,
    issueCode: args.issue.code,
    reason: args.issue.message,
    safeRewriteMode: getSafeRewriteModeForIssue({
      issueCode: args.issue.code,
      sentence: args.sentence,
      hasAllowedFact: args.hasAllowedFact,
    }),
  };
}

function extractSentenceEmployers(sentence: string): string[] {
  const employers = new Set<string>();
  const matches = sentence.matchAll(
    /\bat\s+([A-Z][\w&'.-]+(?:\s+[A-Z][\w&'.-]+){0,5})/g,
  );
  for (const match of matches) {
    if (match[1]) employers.add(match[1].trim());
  }
  return Array.from(employers);
}

function scoreAllowedFactRelevance(
  sentence: string,
  fact: string,
  safeRewriteMode: ProposalRepairSafeRewriteMode,
): number {
  const normalizedSentence = normalizeForMatch(sentence);
  const normalizedFact = normalizeForMatch(fact);
  const sentenceTokens = new Set(extractMeaningfulTokens(sentence));
  const factTokens = extractMeaningfulTokens(fact);
  let score = 0;

  if (
    normalizedSentence.includes(normalizedFact) ||
    normalizedFact.includes(normalizedSentence)
  ) {
    score += 10;
  }

  score += factTokens.reduce(
    (total, token) => total + (sentenceTokens.has(token) ? 1 : 0),
    0,
  );

  if (safeRewriteMode === "remove_qualification_conclusion") {
    if (EDUCATION_FACT_PATTERN.test(fact)) score += 6;
    if (BACKGROUND_SCOPE_FACT_PATTERN.test(fact)) score += 2;
  }
  if (safeRewriteMode === "downgrade_to_past_fact") {
    if (sentenceLooksLikePastFact(fact)) score += 5;
    if (BACKGROUND_SCOPE_FACT_PATTERN.test(fact)) score += 3;
  }
  if (safeRewriteMode === "remove_unsupported_impact") {
    if (!sentenceLooksLikeAchievementImpact(fact)) score += 6;
    if (BACKGROUND_SCOPE_FACT_PATTERN.test(fact)) score += 3;
  }

  return score;
}

function selectRelevantAllowedFacts(args: {
  sentence: string;
  allowedFacts: readonly string[];
  safeRewriteMode: ProposalRepairSafeRewriteMode;
  limit?: number;
}): string[] {
  const scored = args.allowedFacts
    .map((fact) => ({
      fact,
      score: scoreAllowedFactRelevance(
        args.sentence,
        fact,
        args.safeRewriteMode,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ fact }) => fact);

  const preferred =
    args.safeRewriteMode === "remove_qualification_conclusion"
      ? args.allowedFacts.filter((fact) => EDUCATION_FACT_PATTERN.test(fact))
      : args.allowedFacts.filter((fact) => BACKGROUND_SCOPE_FACT_PATTERN.test(fact));

  const combined = Array.from(new Set([...scored, ...preferred]));
  return combined.slice(0, args.limit ?? 4);
}

function getMixedSentenceSupportedPrefixTailMatch(args: {
  sentence: string;
  allowedFacts: readonly string[];
  issueCode?:
    | "unsupported_operational_history"
    | "credential_inflation"
    | null;
}):
  | {
      issueCode: "unsupported_operational_history" | "credential_inflation";
      message: string;
      preservedSentence: string;
    }
  | null {
  const normalizedSentence = compactWhitespace(args.sentence);
  if (!normalizedSentence || args.allowedFacts.length === 0) {
    return null;
  }

  const match = MIXED_SENTENCE_UNSUPPORTED_TAIL_RULES
    .filter((rule) => !args.issueCode || rule.issueCode === args.issueCode)
    .map((rule) => {
      const patternMatch = rule.pattern.exec(normalizedSentence);
      if (!patternMatch || patternMatch.index === undefined || patternMatch.index <= 0) {
        return null;
      }
      return {
        rule,
        index: patternMatch.index,
      };
    })
    .filter(
      (
        value,
      ): value is {
        rule: (typeof MIXED_SENTENCE_UNSUPPORTED_TAIL_RULES)[number];
        index: number;
      } => Boolean(value),
    )
    .sort((left, right) => left.index - right.index)[0];

  if (!match) {
    return null;
  }

  const preservedPrefix = compactWhitespace(
    normalizedSentence
      .slice(0, match.index)
      .replace(/[,:;—–-]+\s*$/u, "")
      .replace(/\b(?:which|that|and)\s*$/i, ""),
  );

  if (
    !preservedPrefix ||
    !sentenceContainsAllowedFact(preservedPrefix, args.allowedFacts)
  ) {
    return null;
  }

  const preservedSentence = ensureTerminalSentence(preservedPrefix);
  if (!preservedSentence || containsForbiddenProposalBridge(preservedSentence)) {
    return null;
  }

  return {
    issueCode: match.rule.issueCode,
    message: match.rule.message,
    preservedSentence,
  };
}

export function analyzeProposalDraft(
  args: VerifyProposalDraftArgs,
): ProposalDraftAnalysis {
  const issues: ProposalVerificationIssue[] = [];
  const flaggedSentences: FlaggedSentence[] = [];
  const bodyContent = extractProposalBodyForRepair({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const sentences = splitSentences(bodyContent);
  const allowedFacts = args.plan.allowed_concrete_facts;
  const allowedEmployers = extractAllowedEmployers(allowedFacts);
  const jobKeywords = buildJobKeywordSet(args.jobTitle, args.jobDescription);
  const candidateNamePattern =
    args.candidateName && args.candidateName.trim().length > 0
      ? new RegExp(
          `\\b${args.candidateName
            .split(/\s+/)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+")}\\b`,
          "i",
        )
      : null;

  if (args.plan.output_language === "en") {
    if (
      FRENCH_GREETING_OR_CLOSING_PATTERN.test(args.content) ||
      resolveProposalOutputLanguage(args.content) === "French"
    ) {
      appendIssue(issues, {
        code: "language_mismatch",
        message: "Final draft must remain entirely in English.",
      });
    }
  } else if (
    ENGLISH_GREETING_OR_CLOSING_PATTERN.test(args.content) ||
    resolveProposalOutputLanguage(args.content) === "English"
  ) {
    appendIssue(issues, {
      code: "language_mismatch",
      message: "Final draft must remain entirely in French.",
    });
  }

  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const sentence = sentences[sentenceIndex];
    const overlap = countJobKeywordOverlap(sentence, jobKeywords);
    const hasAllowedFact = sentenceContainsAllowedFact(sentence, allowedFacts);
    const claim = classifyProposalClaim(sentence, overlap);
    const qualificationStrengthening =
      sentenceLooksLikeQualificationStrengthening(sentence);
    const capabilityAssertion =
      sentenceLooksLikeCapabilityAssertion(sentence) ||
      qualificationStrengthening;
    const readinessOrStrengthening =
      sentenceLooksLikeForwardOperationalReadiness(sentence) ||
      capabilityAssertion ||
      containsForbiddenProposalBridge(sentence);
    const sentenceIssues: ProposalVerificationIssue[] = [];
    const pushSentenceIssue = (issue: ProposalVerificationIssue) => {
      if (
        sentenceIssues.some(
          (existing) =>
            existing.code === issue.code && existing.message === issue.message,
        )
      ) {
        return;
      }
      sentenceIssues.push(issue);
      appendIssue(issues, issue);
    };

    const mixedSentenceTailMatch = getMixedSentenceSupportedPrefixTailMatch({
      sentence,
      allowedFacts,
      issueCode: null,
    });
    if (mixedSentenceTailMatch) {
      pushSentenceIssue({
        code: mixedSentenceTailMatch.issueCode,
        message: mixedSentenceTailMatch.message,
      });
    }

    if (args.plan.context_mode === "none") {
      for (const [pattern, message] of NO_CONTEXT_BANNED_PATTERNS) {
        if (pattern.test(sentence)) {
          pushSentenceIssue({ code: "no_context_phrase", message });
        }
      }

      if (sentenceLooksLikeCandidateClaim(sentence)) {
        if (claim?.type === "qualification") {
          pushSentenceIssue({
            code: "credential_inflation",
            message:
              "No-context mode must not imply that the candidate is qualified, equipped, or a strong fit without explicit source-backed evidence.",
          });
        }
        if (
          claim?.type === "readiness" ||
          (claim?.type === "transferable_trait" && claim.strength !== "low") ||
          sentenceLooksLikeNoContextReadiness(sentence)
        ) {
          pushSentenceIssue({
            code: "no_context_readiness",
            message:
              "No-context mode must stay forward-looking and non-claiming, without operational capability or soft readiness phrasing.",
          });
        }
      }
    }

    if (args.plan.credential_status !== "exact_required") {
      for (const [pattern, message] of EXACT_CREDENTIAL_BANNED_PATTERNS) {
        if (pattern.test(sentence) && !allowedFactsContainPattern(pattern, allowedFacts)) {
          pushSentenceIssue({ code: "credential_inflation", message });
        }
      }
    }

    if (args.plan.credential_status === "in_progress_only") {
      for (const [pattern, message] of COMPLETED_QUALIFICATION_PATTERNS) {
        if (pattern.test(sentence)) {
          pushSentenceIssue({
            code: "completed_qualification_drift",
            message,
          });
        }
      }
    }

    if (candidateNamePattern) {
      if (
        candidateNamePattern.test(sentence) &&
        /\b(?:security|guard|services?|group|company|investigations|training|solutions|agency|corp|llc|inc)\b/i.test(
          sentence,
        ) &&
        !allowedFacts.some((fact) =>
          normalizeForMatch(fact).includes(normalizeForMatch(args.candidateName ?? "")),
        )
      ) {
        pushSentenceIssue({
          code: "employer_synthesis",
          message:
            "Do not synthesize employer-style names or reuse the candidate name as an organization in the body.",
        });
      }
    }

    for (const employer of extractSentenceEmployers(sentence)) {
      if (
        CANDIDATE_HISTORY_CUES.test(sentence) &&
        !allowedEmployers.some(
          (allowedEmployer) =>
            normalizeForMatch(allowedEmployer) === normalizeForMatch(employer),
        )
      ) {
        pushSentenceIssue({
          code: "employer_synthesis",
          message:
            "Every employer or organization named as candidate history must come from allowed concrete facts.",
        });
      }
    }

    if (sentenceLooksLikeCandidateClaim(sentence)) {
      if (
        args.plan.credential_status !== "exact_required" &&
        claim?.type === "qualification" &&
        !hasAllowedFact
      ) {
        pushSentenceIssue({
          code: "credential_inflation",
          message:
            "Do not upgrade related education, adjacent background, or transferable strengths into direct expertise, qualification, or requirement fit unless that stronger claim is source-backed.",
        });
      }

      if (claim?.type === "achievement" && !hasAllowedFact) {
        pushSentenceIssue({
          code: "unsupported_operational_history",
          message: sentenceLooksLikeBusinessImpact(sentence)
            ? "Do not claim unsupported business, commercial, revenue, sales, profit, or growth impact."
            : "Do not claim unsupported achievement impact, results, or improvement unless that stronger outcome is source-backed.",
        });
      }

      if (
        args.plan.context_mode !== "none" &&
        claim?.type === "readiness" &&
        !hasAllowedFact &&
        (args.plan.domain_gap === "adjacent" || args.plan.domain_gap === "distant")
      ) {
        pushSentenceIssue({
          code: "unsupported_operational_history",
          message:
            "Do not bridge transferable traits, background, or adjacent experience into unsupported target-role tasks, projects, or operational readiness.",
        });
      }

      if (
        args.plan.domain_gap === "direct" &&
        overlap >= 2 &&
        (sentenceLooksLikePastOperationalHistory(sentence) ||
          readinessOrStrengthening) &&
        !hasAllowedFact
      ) {
        pushSentenceIssue({
          code: "unsupported_operational_history",
          message:
            "Direct-mode outputs must not sharpen nearby unsupported operational detail or import JD-adjacent task wording as proven candidate history.",
        });
      }

      if (
        args.plan.domain_gap === "adjacent" &&
        overlap >= 2 &&
        readinessOrStrengthening &&
        !hasAllowedFact
      ) {
        pushSentenceIssue({
          code: "adjacent_readiness",
          message:
            "Adjacent-domain outputs may use concrete proof only for abstract transferable themes, not direct target-role readiness.",
        });
      }

      if (
        args.plan.domain_gap === "distant" &&
        overlap >= 2 &&
        readinessOrStrengthening &&
        !hasAllowedFact
      ) {
        pushSentenceIssue({
          code: "distant_readiness",
          message:
            "Distant-domain outputs must avoid direct target-domain verbs and operational analogy unless the exact claim is source-backed.",
        });
      }
    }

    const primaryFlaggedSentence = pickPrimaryRepairTarget(
      sentenceIssues.map((issue) =>
        buildFlaggedSentence({
          sentenceIndex,
          sentence,
          issue,
          hasAllowedFact,
        }),
      ),
    );
    if (primaryFlaggedSentence) {
      flaggedSentences.push(primaryFlaggedSentence);
    }
  }

  return {
    issues,
    flaggedSentences,
  };
}

export function verifyProposalDraft(
  args: VerifyProposalDraftArgs,
): ProposalVerificationIssue[] {
  return analyzeProposalDraft(args).issues;
}

export function buildProposalRepairPrompt(
  args: BuildProposalRepairPromptArgs,
): string {
  const relevantFacts = selectRelevantAllowedFacts({
    sentence: args.flaggedSentence.originalSentence,
    allowedFacts: args.plan.allowed_concrete_facts,
    safeRewriteMode: args.flaggedSentence.safeRewriteMode,
  });

  return [
    "CRITICAL OVERRIDE — REPAIR ONLY:",
    "Rewrite EXACTLY one flagged sentence only.",
    "If and only if the flagged target is an explicitly provided minimal contiguous multi-sentence span, rewrite exactly that span and nothing else.",
    "Do not add or strengthen readiness, contribution, support, fit, value, qualification, or impact language.",
    ...(args.plan.context_mode === "none"
      ? [
          "NO-CONTEXT REPAIR HARD LOCK: do not mention candidate background, experience, skills, tools, technologies, domain familiarity, or readiness.",
          "In no-context repair, you may express only role interest, company/work interest, allowed values or mission interest, or a neutral request to discuss the role.",
          "Do not use phrases such as 'background', 'experience with', 'skills in', 'my background includes', or 'my experience includes'.",
        ]
      : []),
    ...(args.plan.context_mode === "none" || args.plan.domain_gap === "distant"
      ? [
          "For no-context or distant-role repair, do not use 'aligns with', 'may offer relevant perspective', or 'eager to apply'.",
          "For no-context or distant-role repair, do not use soft future-value bridges such as fit, support, contribution, readiness, or value framing.",
        ]
      : []),
    `Respect the shared canonical forbidden bridges list: ${formatQuotedPhraseList(PROPOSAL_FORBIDDEN_BRIDGES)}.`,
    "Return only the replacement sentence text for the flagged target.",
    "",
    args.outputLanguage === "French"
      ? "Write the replacement sentence fully in French."
      : "Write the replacement sentence fully in English.",
    "Rewrite only this sentence.",
    "Do not add any new claims.",
    "Do not strengthen the claim.",
    "Keep the rewrite as short and factual as possible.",
    "Preserve the original sentence’s role and approximate tone when possible.",
    "Do not add salutations, sign-offs, signatures, repeated candidate names, or meta text.",
    "Return plain replacement sentence text only.",
    "No quotes, no bullets, no labels, no extra line breaks, no meta-commentary.",
    "",
    `- issue_code: ${args.flaggedSentence.issueCode}`,
    `- reason: ${args.flaggedSentence.reason}`,
    `- safe_rewrite_mode: ${args.flaggedSentence.safeRewriteMode}`,
    `- context_mode: ${args.plan.context_mode}`,
    `- domain_gap: ${args.plan.domain_gap}`,
    `- credential_status: ${args.plan.credential_status}`,
    `- transfer_mode: ${args.plan.transfer_mode}`,
    ...(args.candidateName
      ? [
          `- candidate_name_reference_only: ${args.candidateName}`,
          "  Do not add a signature or repeated candidate-name line.",
        ]
      : ["- candidate_name_reference_only: unavailable"]),
    "- relevant_allowed_facts:",
    ...(relevantFacts.length > 0
      ? relevantFacts.map((fact) => `  - ${fact}`)
      : ["  - none"]),
    "- allowed_transfer_themes:",
    ...(args.plan.allowed_transfer_themes.length > 0
      ? args.plan.allowed_transfer_themes.slice(0, 4).map((theme) => `  - ${theme}`)
      : ["  - none"]),
    "- disallowed_claims:",
    ...(args.plan.disallowed_claims.length > 0
      ? args.plan.disallowed_claims.slice(0, 6).map((claim) => `  - ${claim}`)
      : ["  - none"]),
    ...(args.previousSentence
      ? [`- previous_sentence_read_only: ${args.previousSentence}`]
      : ["- previous_sentence_read_only: none"]),
    ...(args.nextSentence
      ? [`- next_sentence_read_only: ${args.nextSentence}`]
      : ["- next_sentence_read_only: none"]),
    "",
    "Flagged sentence to rewrite:",
    args.flaggedSentence.originalSentence,
  ].join("\n");
}

export function repairProposalSentenceLocally(
  args: RepairProposalSentenceLocallyArgs,
): string | null {
  const relevantFacts = selectRelevantAllowedFacts({
    sentence: args.flaggedSentence.originalSentence,
    allowedFacts: args.plan.allowed_concrete_facts,
    safeRewriteMode: args.flaggedSentence.safeRewriteMode,
  });
  const interestOnlyFallback = getDeterministicInterestOnlyRepairSentence(
    args.outputLanguage,
  );

  if (args.plan.context_mode === "none") {
    return getNoContextRepairSentence({
      outputLanguage: args.outputLanguage,
      plan: args.plan,
      flaggedSentence: args.flaggedSentence,
    });
  }

  let replacement = "";
  const preservedPrefixRepair = getMixedSentenceSupportedPrefixTailMatch({
    sentence: args.flaggedSentence.originalSentence,
    allowedFacts: args.plan.allowed_concrete_facts,
    issueCode:
      args.flaggedSentence.issueCode === "unsupported_operational_history" ||
      args.flaggedSentence.issueCode === "credential_inflation"
        ? args.flaggedSentence.issueCode
        : null,
  });
  if (preservedPrefixRepair) {
    replacement = preservedPrefixRepair.preservedSentence;
  }

  if (!replacement) {
    switch (args.flaggedSentence.safeRewriteMode) {
      case "interest_only":
        replacement = interestOnlyFallback;
        break;
      case "remove_qualification_conclusion":
        replacement =
          relevantFacts.find((fact) => EDUCATION_FACT_PATTERN.test(fact)) ??
          relevantFacts[0] ??
          "";
        break;
      case "remove_unsupported_impact":
        replacement =
          relevantFacts.find((fact) => !sentenceLooksLikeAchievementImpact(fact)) ??
          relevantFacts.find((fact) => BACKGROUND_SCOPE_FACT_PATTERN.test(fact)) ??
          "";
        break;
      case "downgrade_to_past_fact":
      default:
        replacement =
          relevantFacts.find((fact) => sentenceLooksLikePastFact(fact)) ??
          relevantFacts.find((fact) => BACKGROUND_SCOPE_FACT_PATTERN.test(fact)) ??
          relevantFacts[0] ??
          "";
        break;
    }
  }

  const normalizedReplacement = ensureTerminalSentence(replacement);
  if (!normalizedReplacement) {
    return args.flaggedSentence.safeRewriteMode === "interest_only"
      ? interestOnlyFallback
      : "";
  }

  if (containsForbiddenProposalBridge(normalizedReplacement)) {
    return args.flaggedSentence.safeRewriteMode === "interest_only"
      ? interestOnlyFallback
      : "";
  }

  if (
    (args.plan.context_mode === "none" &&
      hasStrictNoContextRepairViolation(normalizedReplacement)) ||
    ((args.plan.context_mode === "none" || args.plan.domain_gap === "distant") &&
      hasOverProjectiveRepairWording(normalizedReplacement))
  ) {
    return args.flaggedSentence.safeRewriteMode === "interest_only"
      ? interestOnlyFallback
      : "";
  }

  if (
    args.flaggedSentence.safeRewriteMode === "interest_only" &&
    (sentenceLooksLikeForwardOperationalReadiness(normalizedReplacement) ||
      sentenceLooksLikeCapabilityAssertion(normalizedReplacement) ||
      sentenceLooksLikeQualification(normalizedReplacement) ||
      sentenceLooksLikeAchievementImpact(normalizedReplacement))
  ) {
    return interestOnlyFallback;
  }

  if (
    args.flaggedSentence.safeRewriteMode === "remove_qualification_conclusion" &&
    sentenceLooksLikeQualification(normalizedReplacement) &&
    !sentenceContainsAllowedFact(normalizedReplacement, args.plan.allowed_concrete_facts)
  ) {
    return "";
  }

  if (
    args.flaggedSentence.safeRewriteMode === "remove_unsupported_impact" &&
    sentenceLooksLikeAchievementImpact(normalizedReplacement)
  ) {
    return "";
  }

  return normalizedReplacement;
}

export function applyProposalSentencePatches(
  args: ApplyProposalSentencePatchesArgs,
): string {
  const body = extractProposalBodyForRepair({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const paragraphSentences = splitParagraphs(body).map((paragraph) =>
    splitSentences(paragraph),
  );
  const sentenceLocations: Array<{
    sentence: string;
    paragraphIndex: number;
    sentenceInParagraphIndex: number;
    globalSentenceIndex: number;
  }> = [];
  paragraphSentences.forEach((sentences, paragraphIndex) => {
    sentences.forEach((sentence, sentenceInParagraphIndex) => {
      sentenceLocations.push({
        sentence,
        paragraphIndex,
        sentenceInParagraphIndex,
        globalSentenceIndex: sentenceLocations.length,
      });
    });
  });
  const usedSentenceIndexes = new Set<number>();
  const patchedSentenceIndexes = new Set<number>();

  for (const patch of [...args.patches].sort(
    (left, right) => left.sentenceIndex - right.sentenceIndex,
  )) {
    const normalizedOriginalSentence = normalizeProposalConstraintText(
      patch.originalSentence,
    );
    const directMatch = sentenceLocations[patch.sentenceIndex];
    const directIsUsable =
      directMatch &&
      !usedSentenceIndexes.has(directMatch.globalSentenceIndex) &&
      normalizeProposalConstraintText(directMatch.sentence) ===
        normalizedOriginalSentence;
    const fallbackMatch = sentenceLocations.find(
      (location) =>
        !usedSentenceIndexes.has(location.globalSentenceIndex) &&
        normalizeProposalConstraintText(location.sentence) ===
          normalizedOriginalSentence,
    );
    const targetLocation = directIsUsable ? directMatch : fallbackMatch;
    if (!targetLocation) continue;

    paragraphSentences[targetLocation.paragraphIndex][
      targetLocation.sentenceInParagraphIndex
    ] = compactWhitespace(patch.replacementSentence);
    usedSentenceIndexes.add(targetLocation.globalSentenceIndex);
    patchedSentenceIndexes.add(targetLocation.globalSentenceIndex);
  }

  const dedupedParagraphSentences = paragraphSentences.map(() => [] as string[]);
  let previousKeptSentence: string | null = null;
  let previousKeptWasPatched = false;

  for (const location of sentenceLocations) {
    const sentence = compactWhitespace(
      paragraphSentences[location.paragraphIndex][location.sentenceInParagraphIndex] ?? "",
    );
    if (!sentence) continue;

    const currentSentenceWasPatched = patchedSentenceIndexes.has(
      location.globalSentenceIndex,
    );
    const duplicatesPrevious =
      previousKeptSentence !== null && sentence === previousKeptSentence;

    if (
      duplicatesPrevious &&
      (currentSentenceWasPatched || previousKeptWasPatched)
    ) {
      continue;
    }

    dedupedParagraphSentences[location.paragraphIndex].push(sentence);
    previousKeptSentence = sentence;
    previousKeptWasPatched = currentSentenceWasPatched;
  }

  return dedupedParagraphSentences
    .map((sentences) => joinSentences(sentences))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function normalizeFinalProposalOutput(
  args: NormalizeProposalOutputArgs,
): string {
  if (args.format !== "cover_letter") {
    return args.content.trim();
  }

  const rawLines = args.content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  return compactLines(rawLines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
