import {
  buildProposalEvidenceSummary,
  type ProposalPlannerResult,
} from "./proposalPlanner";
import {
  formatCompanyValuesPromptBlock,
  type CompanyValuesPack,
} from "./companyValues";
import type { StructuredCoverLetterContentPlan } from "./proposalContentPlan";

type ComposerStylePack = {
  tone: string;
  guidance: string[];
  negative: string[];
};

type ComposerExamplePack = {
  acceptable: string[];
  unacceptable: string[];
};

const COMPOSER_STYLE_PACKS: Record<
  StructuredCoverLetterContentPlan["voice_preset"],
  ComposerStylePack
> = {
  signature: {
    tone: "Balanced, credible, and polished without flourish.",
    guidance: ["plainspoken", "steady", "specific when evidence is available"],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  expert: {
    tone: "Precise, evidence-led, and calm.",
    guidance: ["measured", "concrete", "technical without jargon padding"],
    negative: [
      "aligns with",
      "deep passion for",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  direct: {
    tone: "Clear, concise, and plainspoken without sounding clipped.",
    guidance: ["matter-of-fact", "compact", "specific"],
    negative: [
      "aligns with",
      "resonates with",
      "I am writing to express my interest",
      "excited about the opportunity",
    ],
  },
  engaging: {
    tone: "Warm, natural, and professional without HR filler.",
    guidance: ["human", "unsentimental", "easy to read"],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
  storyteller: {
    tone: "Smooth, coherent, and grounded in a single through-line.",
    guidance: ["connected", "lightly transitional", "not padded"],
    negative: [
      "aligns with",
      "resonates with",
      "particularly compelling",
      "excited about the opportunity",
    ],
  },
};

const COMPOSER_EXAMPLES: Record<
  StructuredCoverLetterContentPlan["language"],
  ComposerExamplePack
> = {
  en: {
    acceptable: [
      "Reusable UI work and close product-design collaboration have been at the center of my recent frontend work.",
      "In one signup flow redesign, iterative UI changes lifted conversion by 11 percent, and the supporting dashboards made those results easier for product teams to follow.",
      "That mix of interface quality, performance attention, and day-to-day product collaboration is the part of the work I want to keep doing.",
    ],
    unacceptable: [
      "What interests me about this role is the opportunity to contribute.",
      "My background aligns perfectly with your needs.",
    ],
  },
  fr: {
    acceptable: [
      "Le travail sur des interfaces réutilisables et la collaboration quotidienne avec le produit et le design ont été au centre de mes expériences récentes en frontend.",
      "Sur une refonte de parcours d'inscription, des ajustements UI itératifs ont contribué à améliorer la conversion de 11 pour cent, et les tableaux de bord associés ont permis aux équipes produit de suivre ces effets plus clairement.",
      "C'est ce mélange de qualité d'interface, d'attention à la performance et de collaboration produit au quotidien que je souhaite continuer à retrouver dans mon travail.",
    ],
    unacceptable: [
      "Ce qui m'intéresse dans ce poste, c'est l'opportunité de contribuer.",
      "Mon parcours correspond parfaitement à vos besoins.",
    ],
  },
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForPromptTokens(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPromptTokens(value: string): string[] {
  return Array.from(
    new Set(
      normalizeForPromptTokens(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  );
}

function renderIndexedList(values: readonly string[]): string[] {
  return values.length > 0
    ? values.map((value, index) => `- [${index}] ${value}`)
    : ["- none"];
}

function buildUnsupportedJobKeywords(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  jobTitle: string;
  jobDescription: string;
}): string[] {
  if (
    args.contentPlan.no_context_mode ||
    (args.plannerResult.domain_gap === "direct" &&
      args.plannerResult.credential_status === "exact_required")
  ) {
    return [];
  }

  const supportedTokens = new Set(
    extractPromptTokens(
      [
        ...args.plannerResult.allowed_concrete_facts,
        ...args.plannerResult.allowed_transfer_themes,
      ].join(" "),
    ),
  );
  const jobTokens = extractPromptTokens(`${args.jobTitle} ${args.jobDescription}`);
  return jobTokens.filter((token) => !supportedTokens.has(token)).slice(0, 12);
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

function buildAdjacentOnlySeoComposerLines(): string[] {
  return [
    "- adjacent_only_seo_rule: the supported candidate evidence is frontend/conversion only, not technical SEO.",
    "- adjacent_only_seo_rule: say plainly that the candidate background is frontend and conversion-focused, not technical SEO.",
    "- adjacent_only_seo_rule: Indexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.",
    "- adjacent_only_seo_rule: offer only landing-page structure, frontend implementation, and conversion-aware page improvements once a specialist defines the audit and recommendations.",
    "- adjacent_only_seo_rule: do not offer to implement schema markup, schema changes, internal-linking adjustments, canonical tags, indexing fixes, crawlability fixes, or crawlable markup unless source-backed.",
    "- adjacent_only_seo_rule: Do not claim SEO-team work, crawlability optimization, schema placement, crawl budget, canonicalization, internal-linking patterns, technical SEO diagnosis, search visibility familiarity, or marketplace-style SEO implementation.",
  ];
}

function buildRoleGuidance(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  paragraphIndex: number;
}): string {
  const paragraph = args.contentPlan.body_paragraphs[args.paragraphIndex];
  if (!paragraph) {
    return "Keep this paragraph grounded in the validated plan.";
  }

  const voicePreset = args.contentPlan.voice_preset;

  if (paragraph.role === "opening") {
    if (!args.contentPlan.no_context_mode) {
      switch (voicePreset) {
        case "direct":
          return "Lead immediately with the strongest supported fact. Do not spend the opening on motivation or scene-setting.";
        case "expert":
          return "Lead with the strongest supported fact and make the recruiter-relevant scope clear without extra framing.";
        case "signature":
          return "Lead with the strongest supported proof in a concise, balanced way.";
        case "engaging":
          return "Lead with supported proof first. Keep the opening human and readable without turning it into employer admiration.";
        case "storyteller":
          return "Open from one concrete supported thread that can continue naturally into the next paragraph.";
      }
    }
    return args.contentPlan.no_context_mode
      ? "Use the work itself, the operating context, or supported role context from the job description as the entry point."
      : "Use supported scope, role context, or concrete work context as the entry point.";
  }

  if (paragraph.role === "evidence") {
    if (!args.contentPlan.no_context_mode) {
      switch (voicePreset) {
        case "direct":
          return "Use the second paragraph for the second strongest fact or clearest second proof point. Keep it compact and factual.";
        case "expert":
          return "Use the second paragraph to add process, analysis, or communication framing that is still anchored in supported proof.";
        case "signature":
          return "Use the second paragraph only for a second grounded proof point that adds real substance.";
        case "engaging":
          return "Use the second paragraph for a grounded workflow-facing or collaboration-facing detail, not employer praise.";
        case "storyteller":
          return "Continue the same concrete thread from the opening with another supported detail or consequence. Do not reset with a new abstract setup.";
      }
    }
    return args.contentPlan.no_context_mode
      ? "Use concrete work surfaces from the job description such as recurring tasks, workflow, coordination, communication, records, or reliability."
      : "Carry the strongest recruiter-relevant proof here.";
  }

  if (!args.contentPlan.no_context_mode) {
    switch (voicePreset) {
      case "direct":
        return "Use a motivation paragraph only when the factual plan genuinely needs it. Keep it minimal and work-level.";
      case "expert":
        return "Keep the motivation close brief and work-level, with no generic enthusiasm.";
      case "signature":
        return "Keep the motivation close minimal and only if it adds something beyond the proof already given.";
      case "engaging":
        return "Keep the close grounded in day-to-day work or collaboration. Do not turn it into employer admiration.";
      case "storyteller":
        return "Use the closing only to land the same concrete thread cleanly. Do not switch to scenic filler or a new abstract theme.";
    }
  }

  return args.contentPlan.no_context_mode
    ? "Close on the day-to-day work, coordination model, or operating context."
    : "Close on specific work-level motivation or grounded fit for the day-to-day work.";
}

function buildGlobalProgressionBrief(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
}): string[] {
  const presetSpecificLines =
    args.contentPlan.no_context_mode
      ? []
      : (() => {
          switch (args.contentPlan.voice_preset) {
            case "direct":
              return [
                "- Direct preset contract: keep exactly two body paragraphs and move from strongest fact to second fact without a separate motivation paragraph unless the factual plan truly needs one.",
              ];
            case "expert":
              return [
                "- Expert preset contract: move from strongest proof to grounded process, analysis, or communication framing.",
              ];
            case "signature":
              return [
                "- Signature preset contract: move from strongest proof to one second grounded proof point when it adds substance, with minimal motivation.",
              ];
            case "engaging":
              return [
                "- Engaging preset contract: move from proof to grounded human or workflow-facing detail, not employer admiration.",
              ];
            case "storyteller":
              return [
                "- Storyteller preset contract: keep one concrete supported thread across paragraphs rather than resetting into scenic filler.",
              ];
          }
        })();
  return [
    "- Write one coherent body with distinct opening, evidence, and motivation jobs in order.",
    ...presetSpecificLines,
    "- Let the opening begin from supported scope, role context, or concrete work context rather than default personal-interest framing.",
    "- Let the evidence paragraph carry the proof and add new substance.",
    ...(args.contentPlan.no_context_mode ||
    args.plannerResult.allowed_concrete_facts.length < 2
      ? []
      : [
          "- When multiple supported facts exist, do not default every preset to the same lead fact and the same rhetorical opening job. Choose the lead fact that best matches this preset's progression.",
        ]),
    ...(args.contentPlan.body_paragraphs.some(
      (paragraph) => paragraph.role === "motivation",
    )
      ? [
          "- Let the motivation paragraph close on the work itself, the operating context, or grounded fit for the day-to-day work.",
        ]
      : []),
    "- Use shared discourse context for coherence, but keep every claim grounded in the validated plan.",
    ...(args.contentPlan.no_context_mode
      ? [
          "- In no-context mode, after any opening, ground later paragraphs in concrete work surfaces from the job description such as recurring work, workflow, coordination, communication, records, or operating context.",
        ]
      : []),
    ...(args.plannerResult.domain_gap !== "direct"
      ? [
          "- For adjacent or distant-role cases, state only factual overlap supported by the plan. If relevance is limited, keep it limited.",
          "- Do not imply target-role readiness or use abstract transfer rhetoric when the plan does not support it.",
          "- Evidence chain for each paragraph: name the job priority, use only the paragraph's source-backed candidate fact or allowed theme, then state why that evidence matters for the role.",
        ]
      : []),
  ];
}

function buildParagraphBlueprint(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
}): string[] {
  return args.contentPlan.body_paragraphs.flatMap((paragraph, index) => {
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
    return [
      `- paragraph_${index + 1}: role=${paragraph.role}; fact_ids=${facts}; theme_ids=${themes}${paragraph.intent_label ? `; intent=${paragraph.intent_label}` : ""}`,
      `  role_guidance: ${buildRoleGuidance({
        plannerResult: args.plannerResult,
        contentPlan: args.contentPlan,
        paragraphIndex: index,
      })}`,
      `  allowed_facts: ${paragraphFacts.join(" | ")}`,
      `  allowed_themes: ${paragraphThemes.join(" | ")}`,
    ];
  });
}

export function buildStructuredCoverLetterComposerPrompt(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  jobTitle: string;
  jobDescription: string;
  generationControlsBlock?: string;
  companyValuesPack?: CompanyValuesPack;
}): string {
  const stylePack = COMPOSER_STYLE_PACKS[args.contentPlan.voice_preset];
  const examples = COMPOSER_EXAMPLES[args.contentPlan.language];
  const evidenceSummary = buildProposalEvidenceSummary(args.plannerResult);
  const unsupportedJobKeywords = buildUnsupportedJobKeywords(args);

  return [
    "Compose the body paragraphs only for a cover letter.",
    args.contentPlan.language === "fr"
      ? "Write the full body in French."
      : "Write the full body in English.",
    "Return plain text only.",
    `Return exactly ${args.contentPlan.body_paragraphs.length} paragraphs separated by a single blank line.`,
    "Do not include a greeting, closing, sign-off, signature, candidate name line, or final CTA sentence.",
    "Do not include labels, bullets, numbering, markdown, code fences, or meta commentary.",
    "This must be one coherent body with ordered paragraph roles from the validated content plan.",
    "Keep opening, evidence, and motivation progression clear, but let the sentence shapes vary naturally.",
    "Do not reuse the same rhetorical stem or setup sentence across paragraphs.",
    "Do not bias paragraph openings toward resume-style action verbs such as 'I built,' 'I improved,' or 'I led' unless that structure is naturally warranted by the paragraph's content.",
    "The opening may begin from role context, supported scope, or concrete work context. It should not default to personal-interest framing such as 'I am interested' or 'What interests me' unless the available material clearly warrants it.",
    "The motivation close must stay concrete and work-level. It should not read like HR filler, polished enthusiasm, or generic employer praise.",
    "Use only the listed facts and themes for each paragraph. Do not invent unsupported experience, achievements, tools, employers, credentials, or target-role readiness.",
    "Use shared discourse context for coherence while keeping every claim grounded in the validated plan.",
    "Keep the body natural, concrete, and recruiter-credible.",
    "Prefer simple transitions and grounded detail over stock application formulas or slogan-like filler.",
    "Keep paragraphs compact at 1 to 3 sentences each.",
    "Use the paragraph evidence chain internally for safety, but do not expose it as a visible checklist or repeated job-priority -> candidate-fact -> why-it-matters formula.",
    "If a required job keyword is not supported by the allowed facts or themes, frame it as a gap, omission, client need, or collaboration boundary; never claim it as candidate experience.",
    "Do not praise the company mission, culture, values, market, or project as the main argument.",
    "",
    `Tone direction: ${stylePack.tone}`,
    `Style traits: ${stylePack.guidance.join(" | ")}`,
    `Avoid cliche bridge language such as: ${stylePack.negative.join(" | ")}`,
    args.generationControlsBlock,
    args.companyValuesPack
      ? formatCompanyValuesPromptBlock(args.companyValuesPack)
      : undefined,
    "Acceptable phrasing examples:",
    ...examples.acceptable.map((example) => `- ${example}`),
    "Unacceptable phrasing examples:",
    ...examples.unacceptable.map((example) => `- ${example}`),
    "",
    `- context_mode: ${args.plannerResult.context_mode}`,
    `- domain_gap: ${args.plannerResult.domain_gap}`,
    `- proof_strategy: ${args.plannerResult.proof_strategy}`,
    `- opening_strategy: ${args.contentPlan.opening_strategy}`,
    ...buildGlobalProgressionBrief(args),
    ...(args.contentPlan.no_context_mode
      ? [
          "- no_context_rule: No-context mode must be motivation and work-surface only. Do not claim traits, habits, abilities, skills, background, experience, past work, group-project history, customer-facing history, or personal work habits.",
          "- no_context_rule: do not mention my background, my experience, my professional background, in past experiences, I’ve worked, skills I’ve developed, I’ve taken initiative, I’ve always prioritized, my ability, my habit, or any implied prior work history.",
          "- no_context_rule: do not claim traits, habits, work style, strengths, or abilities such as my attention to detail, my methodical approach, how I approach work, how I approach new responsibilities, my approach, my work style, my strengths, what I value, what I prioritize, comfort with procedures, or confidence in adapting.",
          "- no_context_rule: do not say I do not have direct experience; simply avoid experience claims.",
          "- no_context_rule: you do not have supported candidate evidence. Use only grounded role understanding and concrete work surfaces from the job description such as recurring work, workflow, operating context, coordination, communication, or accuracy where the role calls for it.",
          "- no_context_rule: do not invent prior roles, projects, metrics, achievements, or employer history.",
        ]
      : []),
    ...(isUnsupportedTechnicalSeoMove(args)
      ? buildAdjacentOnlySeoComposerLines()
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
          "- evidence_requirement: when achievement fact ids are provided for the evidence paragraph, foreground one or two recruiter-relevant achievements from those fact ids.",
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
    ...buildParagraphBlueprint(args),
  ].filter((line): line is string => typeof line === "string").join("\n");
}

export function buildStructuredCoverLetterComposerRetryPrompt(args: {
  plannerResult: ProposalPlannerResult;
  contentPlan: StructuredCoverLetterContentPlan;
  jobTitle: string;
  jobDescription: string;
  failureReason: string;
  generationControlsBlock?: string;
  companyValuesPack?: CompanyValuesPack;
}): string {
  return [
    buildStructuredCoverLetterComposerPrompt({
      plannerResult: args.plannerResult,
      contentPlan: args.contentPlan,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
      generationControlsBlock: args.generationControlsBlock,
      companyValuesPack: args.companyValuesPack,
    }),
    "",
    "Revision required:",
    `- The previous body failed validation for this reason: ${compactWhitespace(args.failureReason)}`,
    "- Rewrite the full body from scratch.",
    "- Keep the same paragraph count and paragraph order from the validated content plan.",
    "- Fix the validation failure without falling back to generic interest phrasing or recycling the same setup across paragraphs.",
    "- Keep the progression clear: opening -> evidence -> motivation.",
    "- Keep the prose natural, concrete, and grounded. Do not turn it into a fixed formula.",
    "- Return body paragraphs only.",
  ].join("\n");
}
