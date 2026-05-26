import { describe, expect, it } from "vitest";

import {
  MISTRAL_PREMIUM_COVER_LETTER_ADAPTER,
  PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
  QWEN_PREMIUM_COVER_LETTER_ADAPTER,
  attemptPremiumCoverLetterGeneration,
  buildAllowedFactsPack,
  buildJobOfferPriorityPack,
  buildPremiumCoverLetterOpenAIRequest,
  buildPremiumCoverLetterBrief,
  buildPremiumCoverLetterPrompt,
  evaluatePremiumCoverLetterEligibility,
  extractOpenAIJsonPayload,
  inferPremiumCoverLetterContextClass,
  isCoverLetterPremiumPathV1Enabled,
  rankAllowedFacts,
  resolvePremiumCoverLetterWriterModel,
  validatePremiumCoverLetterBodyParts,
} from "../premiumCoverLetter";

const directContext = {
  name: "Alex Martin",
  summary:
    "Frontend engineer building customer-facing web applications and reusable UI systems.",
  topSkills: ["React", "TypeScript", "Excel"],
  recentExperience: [
    {
      company: "Orbit",
      position: "Senior Frontend Engineer",
      highlights: [
        "Improved signup conversion by 11% after iterative UI experiments.",
        "Led a design system migration used across 4 product squads.",
      ],
    },
  ],
  standoutAchievements: [
    "Built experimentation dashboards used by product and growth teams.",
  ],
};

const directJob = {
  jobTitle: "Senior Frontend Engineer",
  jobDescription:
    "Lead React and TypeScript delivery for customer-facing web applications, design systems, and experimentation workflows. Outstanding benefits and a mission-led culture are part of the package.",
};

const adjacentContext = {
  name: "Maya Chen",
  summary:
    "Operations specialist working across reporting, handoffs, and process documentation.",
  topSkills: ["Zendesk", "Excel", "Process documentation"],
  recentExperience: [
    {
      company: "Northline",
      position: "Customer Operations Coordinator",
      highlights: [
        "Owned ticket triage, handoffs, and SLA reporting across support and product teams.",
        "Built weekly dashboards to track backlog, response times, and process bottlenecks.",
      ],
    },
  ],
  standoutAchievements: [
    "Reduced backlog response times by 18% through queue and handoff changes.",
  ],
};

const adjacentJob = {
  jobTitle: "Implementation Analyst",
  jobDescription:
    "Coordinate implementation workflows, track deliverables, manage cross-functional handoffs, and maintain reporting across teams.",
};

const weakChecklistContext = {
  name: "Samir Patel",
  summary:
    "Facilities support coordinator handling maintenance intake, scheduling, and service record follow-through.",
  topSkills: ["Excel", "Word", "Windows", "Scheduling"],
  recentExperience: [
    {
      company: "Metro Facilities",
      position: "Facilities Coordinator",
      highlights: [
        "Handled maintenance intake, scheduling, and vendor follow-up for office sites.",
        "Improved work-order turnaround by 9% after reorganizing request routing and follow-up.",
      ],
    },
  ],
  standoutAchievements: [
    "Built a simple tracker that reduced missed vendor callbacks during weekly scheduling reviews.",
  ],
};

const weakChecklistJob = {
  jobTitle: "Facilities Support Coordinator",
  jobDescription:
    "Coordinate maintenance requests, schedule vendors, update service records, manage Excel trackers, answer emails, support Word documentation, stay flexible, and be ready to help across office operations. Candidates should be organized, reliable, adaptable, willing to learn, and comfortable with Windows, Microsoft Word, Microsoft Excel, and general administrative support.",
};

const noCvJob = {
  jobTitle: "Operations Coordinator",
  jobDescription:
    "Coordinate service requests, track follow-up, keep records current, and communicate clearly with internal teams and vendors. The role depends on careful scheduling, accurate documentation, and steady day-to-day coordination. Excel is helpful and strong communication is required.",
};

const backendAdjacentContext = {
  name: "Alex Martin",
  summary:
    "Frontend engineer with some API integration exposure and strong product collaboration.",
  topSkills: ["React", "TypeScript", "Frontend Architecture"],
  recentExperience: [
    {
      company: "BrightLayer",
      position: "Frontend Engineer",
      highlights: [
        "Partnered with backend engineers on API contracts and data-heavy UI features.",
      ],
    },
  ],
};

const backendAdjacentJob = {
  jobTitle: "Full Stack Engineer",
  jobDescription:
    "Looking for a Full Stack Engineer with strong Node.js backend skills, API design, database work, and enough React experience to contribute to the frontend. Experience designing scalable services is required.",
};

const adminMorphologyDriftContext = {
  name: "Nora Silva",
  summary:
    "Customer support coordinator handling escalations, documentation, and handoffs.",
  topSkills: ["Escalation management", "Documentation", "Status reporting"],
  recentExperience: [
    {
      company: "BrightDesk",
      position: "Customer Support Coordinator",
      highlights: [
        "Managed escalations, documented account updates, and coordinated handoffs across support and product teams.",
        "Prepared weekly status summaries and maintained issue trackers for service follow-through.",
      ],
    },
  ],
  standoutAchievements: [
    "Reduced repeat follow-up by standardizing escalation notes.",
  ],
};

const adminMorphologyDriftJob = {
  jobTitle: "Office Administrator",
  jobDescription:
    "Manage calendars, records, documentation, and administrative follow-through across a busy team.",
};

describe("premium cover letter evidence ranking", () => {
  it("prioritizes quantified achievements over secondary qualifications", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(rankedEvidencePack.strongestEvidence[0]?.text).toContain("11%");
    expect(
      rankedEvidencePack.secondaryQualifications.some((fact) =>
        fact.text.includes("Excel"),
      ),
    ).toBe(true);
  });

  it("demotes secondary qualifications when stronger evidence exists", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(
      rankedEvidencePack.strongestEvidence.every(
        (fact) => !fact.text.includes("Excel"),
      ),
    ).toBe(true);
    expect(
      rankedEvidencePack.weakOrDoNotLeadWith.some((fact) =>
        fact.text.includes("Excel"),
      ),
    ).toBe(true);
  });

  it("excludes benefits and company-admiration content from top evidence", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(
      rankedEvidencePack.strongestEvidence.every(
        (fact) => !/benefits|mission-led culture/i.test(fact.text),
      ),
    ).toBe(true);
    expect(
      rankedEvidencePack.weakOrDoNotLeadWith.some((fact) =>
        /benefits/i.test(fact.text),
      ),
    ).toBe(false);
  });

  it("builds transferCore for adjacent cases from actual CV evidence", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
    });
    expect(contextClass).toBe("cv_adjacent");

    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack,
    });

    expect(brief.transferCore).toBeDefined();
    expect(brief.transferCore?.length).toBeGreaterThan(0);
    expect(brief.transferCore?.join(" ")).toMatch(/handoffs|reporting|workflow/i);
  });

  it("keeps system_inference effectively non-substantive in v1", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      systemInferenceHints: [
        "Managed enterprise payroll for 300 employees.",
        "Adjacent workflow overlap through reporting and handoffs.",
      ],
    });

    const inferenceFacts = allowedFactsPack.facts.filter(
      (fact) => fact.source === "system_inference",
    );
    expect(inferenceFacts).toEqual([
      expect.objectContaining({
        category: "transfer_signal",
        confidence: "medium",
      }),
    ]);
    expect(
      inferenceFacts.some((fact) => /payroll|300 employees/i.test(fact.text)),
    ).toBe(false);
  });

  it("treats backend-heavy must-haves as the primary overlap signal for context class", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: backendAdjacentContext,
      jobTitle: backendAdjacentJob.jobTitle,
      jobDescription: backendAdjacentJob.jobDescription,
    });

    expect(contextClass).toBe("cv_adjacent");
  });

  it("keeps realistic CV-backed admin workflow matches premium-eligible despite morphology drift", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: adminMorphologyDriftContext,
      jobTitle: adminMorphologyDriftJob.jobTitle,
      jobDescription: adminMorphologyDriftJob.jobDescription,
    });

    expect(contextClass).toBe("cv_adjacent");

    const eligibility = evaluatePremiumCoverLetterEligibility({
      personalizationContext: adminMorphologyDriftContext,
      voicePreset: "signature",
      jobTitle: adminMorphologyDriftJob.jobTitle,
      jobDescription: adminMorphologyDriftJob.jobDescription,
    });

    expect(eligibility).toEqual({
      eligible: true,
      contextClass: "cv_adjacent",
    });
  });

  it("classifies structured no-CV job offers as no_cv and ranks employer priorities instead of checklist noise", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    expect(contextClass).toBe("no_cv");

    const eligibility = evaluatePremiumCoverLetterEligibility({
      personalizationContext: null,
      voicePreset: "signature",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    expect(eligibility).toEqual({
      eligible: true,
      contextClass: "no_cv",
    });

    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
    });

    const strongestEvidenceText = rankedEvidencePack.strongestEvidence
      .map((fact) => fact.text)
      .join(" ");

    expect(rankedEvidencePack.strongestEvidence.length).toBeGreaterThan(0);
    expect(strongestEvidenceText).not.toMatch(/Excel/i);
    expect(strongestEvidenceText).toMatch(
      /service requests|follow-up|records current|scheduling|coordination/i,
    );
  });
});

describe("premium cover letter prompt contract", () => {
  const buildDirectBrief = () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });
  };

  const buildAdjacentAdminBrief = () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: {
        name: "Camille Bernard",
        summary:
          "Operations lead experienced in coordination, process documentation, and cross-team communication.",
        desiredPosition: "Operations Coordinator",
        topSkills: [
          "Coordination",
          "Documentation",
          "Stakeholder Communication",
        ],
        recentExperience: [
          {
            company: "Nexa Services",
            position: "Operations Coordinator",
            highlights: [
              "Coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
            ],
          },
        ],
      },
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: "Administrative Coordinator",
        jobDescription:
          "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
        contextClass: "cv_adjacent",
      }),
    });
  };

  it("scopes premium provider adapters to Mistral and Qwen without changing GPT/default prompts", () => {
    const brief = buildDirectBrief();
    const defaultPrompt = buildPremiumCoverLetterPrompt({ brief });
    const gptPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "openai",
      writerModel: "gpt-5.5",
    });
    const unknownPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "unknown",
    });
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
    });
    const qwenPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
    });

    expect(MISTRAL_PREMIUM_COVER_LETTER_ADAPTER).toContain(
      "Provider adapter: Mistral",
    );
    expect(QWEN_PREMIUM_COVER_LETTER_ADAPTER).toContain(
      "Provider adapter: Qwen",
    );
    expect(gptPrompt).toBe(defaultPrompt);
    expect(unknownPrompt).toBe(defaultPrompt);
    for (const prompt of [defaultPrompt, gptPrompt, unknownPrompt]) {
      expect(prompt).not.toContain("Provider adapter: Mistral");
      expect(prompt).not.toContain("Provider adapter: Qwen");
      expect(prompt).not.toContain("Truth outranks fluency");
      expect(prompt).not.toContain("monitored ≠ managed");
      expect(prompt).not.toContain("MISTRAL ADJACENT-FIT ADDENDUM");
      expect(prompt).not.toContain("MISTRAL ADJACENT-FIT STRICT ADDENDUM");
      expect(prompt).not.toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
      expect(prompt).not.toContain("Mistral cv_direct contract");
      expect(prompt).not.toContain("normal premium cover letter");
      expect(prompt).not.toContain("source-backed cover-letter contract");
      expect(prompt).not.toContain("strict evidence-only adjacent letter");
      expect(prompt).not.toContain("Mistral cv_adjacent body-part contract");
      expect(prompt).not.toContain("Let the reader infer relevance");
      expect(prompt).not.toContain("Do not write a transfer argument");
      expect(prompt).not.toContain(
        "In adjacent cases, never convert proximity into role fit, role alignment, future contribution, or promised impact",
      );
    }

    expect(mistralPrompt).toContain("Provider adapter: Mistral");
    expect(mistralPrompt).toContain("Mistral cv_direct contract");
    expect(mistralPrompt).toContain("normal premium cover letter");
    expect(mistralPrompt).toContain("source-backed cover-letter contract");
    expect(mistralPrompt).toContain("Do not invent impact");
    expect(mistralPrompt).toContain("Avoid generic fit language");
    expect(mistralPrompt).toContain("Truth outranks fluency");
    expect(mistralPrompt).toContain(
      "CV evidence outranks job-description keywords",
    );
    expect(mistralPrompt).toContain("monitored ≠ managed");
    expect(mistralPrompt).toContain("documented ≠ managed");
    expect(mistralPrompt).toContain("valid driver's license");
    expect(mistralPrompt).toContain("high school diploma");
    expect(mistralPrompt).toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
    expect(mistralPrompt).toContain("Role reference rule:");
    expect(mistralPrompt).toContain(
        "In adjacent cases, never convert proximity into role fit, role alignment, future contribution, or promised impact",
    );
    expect(mistralPrompt).toContain("for an Administrative Coordinator");
    expect(mistralPrompt).toContain(
      "Do not write \"For a [JD role], these skills...\"",
    );
    expect(mistralPrompt).toContain("Adjacent-safe writing rule:");
    expect(mistralPrompt).toContain(
      "Do not explain why a skill is relevant. State the evidence directly",
    );
    expect(mistralPrompt).toContain(
      "Every body paragraph should include at least one concrete CV-derived anchor when available",
    );
    expect(mistralPrompt).toContain(
      "I bring the same discipline around records, deadlines, and communication",
    );
    expect(mistralPrompt).toContain(
      "Return only the required JSON body parts",
    );
    expect(mistralPrompt).not.toContain("Provider adapter: Qwen");

    expect(qwenPrompt).toContain("Provider adapter: Qwen");
    expect(qwenPrompt).toContain("separated evidence zones");
    expect(qwenPrompt).toContain(
      "Never transfer a requirement from job facts into candidate experience",
    );
    expect(qwenPrompt).toContain(
      "Use ATS terms only when attached to a CV-backed action",
    );
    expect(qwenPrompt).toContain("Return only the required JSON body parts");
    expect(qwenPrompt).not.toContain("Provider adapter: Mistral");
    expect(qwenPrompt).not.toContain("Mistral cv_direct contract");
    expect(qwenPrompt).not.toContain("normal premium cover letter");
    expect(qwenPrompt).not.toContain("source-backed cover-letter contract");
    expect(qwenPrompt).not.toContain("strict evidence-only adjacent letter");
    expect(qwenPrompt).not.toContain("Mistral cv_adjacent body-part contract");
    expect(qwenPrompt).not.toContain("Let the reader infer relevance");
    expect(qwenPrompt).not.toContain("Do not write a transfer argument");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT-FIT ADDENDUM");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT-FIT STRICT ADDENDUM");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
  });

  it("keeps the shared cv_adjacent prompt guidance unchanged for GPT/default and narrows Mistral to evidence-only wording", () => {
    const brief = buildAdjacentAdminBrief();
    const defaultPrompt = buildPremiumCoverLetterPrompt({ brief });
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
    });
    const qwenPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
    });

    expect(defaultPrompt).toContain(
      "phrase the link as what this background helps with in the role's actual work",
    );
    expect(defaultPrompt).toContain(
      "translate adjacent workflow evidence into role value",
    );
    expect(defaultPrompt).toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(defaultPrompt).toContain(
      "CloseLine: one short role-specific sentence",
    );

    expect(mistralPrompt).toContain(
      "strict evidence-only adjacent letter",
    );
    expect(mistralPrompt).toContain("Do not write a transfer argument");
    expect(mistralPrompt).toContain("Let the reader infer relevance");
    expect(mistralPrompt).toContain(
      "employerValueBlock: second factual evidence paragraph",
    );
    expect(mistralPrompt).toContain(
      "Do not include greeting, signoff, or candidate name",
    );
    expect(mistralPrompt).toContain(
      "Every body part should include at least one concrete CV-backed anchor",
    );
    expect(mistralPrompt).toContain(
      "If evidence is limited, return shorter body parts",
    );
    expect(mistralPrompt).not.toContain(
      "phrase the link as what this background helps with in the role's actual work",
    );
    expect(mistralPrompt).not.toContain(
      "translate adjacent workflow evidence into role value",
    );
    expect(mistralPrompt).not.toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(mistralPrompt).not.toContain(
      "CloseLine: one short role-specific sentence",
    );
    expect(qwenPrompt).toContain(
      "phrase the link as what this background helps with in the role's actual work",
    );
    expect(qwenPrompt).toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(qwenPrompt).not.toContain(
      "strict evidence-only adjacent letter",
    );
    expect(qwenPrompt).not.toContain(
      "Mistral cv_adjacent body-part contract",
    );
    expect(qwenPrompt).not.toContain("Let the reader infer relevance");
    expect(qwenPrompt).not.toContain("Do not write a transfer argument");
  });

  it("keeps provider adapter order between the shared premium prompt and structured brief", () => {
    const prompt = buildPremiumCoverLetterPrompt({
      brief: buildDirectBrief(),
      writerModel: "mistral-medium-latest",
    });
    const sharedPromptIndex = prompt.indexOf(
      "Write premium cover-letter body parts.",
    );
    const adapterIndex = prompt.indexOf("Provider adapter: Mistral");
    const structuredBriefIndex = prompt.indexOf("Structured brief:");

    expect(sharedPromptIndex).toBeGreaterThanOrEqual(0);
    expect(adapterIndex).toBeGreaterThan(sharedPromptIndex);
    expect(structuredBriefIndex).toBeGreaterThan(adapterIndex);
  });

  it("keeps strongest evidence priority, demotes secondary qualifications, includes forbidden moves, and stays compact", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(prompt).toContain("Prioritize strongest evidence first.");
    expect(prompt).toContain(
      "Do not lead with secondary qualifications or spend body space on admiration",
    );
    expect(prompt).toContain(
      "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority.",
    );
    expect(prompt).toContain("Preset contract for signature:");
    expect(prompt).toContain(
      "Do not lead with secondary qualifications or spend body space on admiration",
    );
    expect(prompt).toContain(
      "If evidence is modest, let the best available concrete proof carry the case.",
    );
    expect(prompt).toContain(
      "Opening: position through the strongest relevant evidence",
    );
    expect(prompt).toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(prompt).toContain('"opening":"string"');
    expect(prompt).toContain('"employerValueBlock":"string"');
    expect(prompt).toContain("topResponsibilities");
    expect(prompt).toContain("keyRequirements");
    expect(
      PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA.required,
    ).toStrictEqual([
      "opening",
      "proofBlock",
      "employerValueBlock",
      "closeLine",
    ]);
    expect(prompt.length).toBeLessThan(4200);
    expect(prompt.split("\n").length).toBeLessThan(28);
  });

  it("adds distinct preset guidance for signature, expert, and engaging", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    const signaturePrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });
    const expertPrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "expert",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });
    const engagingPrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "engaging",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });

    expect(signaturePrompt).toContain(
      "Preset contract for signature: professional, warm, personal, concise, and stable;",
    );
    expect(signaturePrompt).toContain(
      "do not let it read like colder expert analysis or a minimal shell.",
    );
    expect(expertPrompt).toContain(
      "Preset contract for expert: compact, professional, and controlled;",
    );
    expect(expertPrompt).toContain(
      "make one precise employer-facing observation about what controlled execution produces for this specific role",
    );
    expect(engagingPrompt).toContain(
      "Preset contract for engaging: warmer but restrained;",
    );
    expect(engagingPrompt).toContain(
      "let one grounded sentence show who benefits when coordination, reporting, service, or follow-through are done well",
    );
    expect(engagingPrompt).toContain(
      "avoid neutral template lead-ins such as a flat relevance summary",
    );
  });

  it("builds a hierarchical offer brief instead of flattening checklist-heavy job text", () => {
    const offerPriorityPack = buildJobOfferPriorityPack(
      weakChecklistJob.jobDescription,
    );
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: weakChecklistContext,
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
      contextClass: "cv_direct",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });

    expect(offerPriorityPack.coreResponsibilities.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
    expect(offerPriorityPack.coreResponsibilities.join(" ")).toContain(
      "schedule vendors.",
    );
    expect(offerPriorityPack.lowValueChecklist.join(" ")).toMatch(
      /organized|reliable|adaptable|willing to learn|Windows|Microsoft Word|Microsoft Excel/i,
    );
    expect(brief.topResponsibilities).toBeDefined();
    expect(brief.lowValueChecklist).toBeDefined();
    expect(brief.workContext).toBeDefined();
    expect(brief.topResponsibilities?.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
    expect(brief.topResponsibilities?.join(" ")).not.toMatch(
      /Windows|Word|Excel|flexible|willing to learn/i,
    );
    expect(brief.lowValueChecklist?.join(" ")).toMatch(
      /organized|reliable|adaptable|willing to learn|Windows|Word|Excel/i,
    );
    expect(brief.workContext?.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
  });

  it("builds a no-CV premium brief that stays employer-side and prompt-guided", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
      allowedFactsPack,
      rankedEvidencePack,
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(brief.candidateEvidenceAvailable).toBe(false);
    expect(brief.transferCore).toBeUndefined();
    expect(brief.topEvidence.join(" ")).toMatch(
      /service requests|follow-up|records current|scheduling|coordination/i,
    );
    expect(brief.topEvidence.join(" ")).not.toMatch(/Excel/i);
    expect(prompt).toContain(
      "For no_cv, there is no supported candidate history.",
    );
    expect(prompt).toContain(
      "Use job-offer work surfaces not prior history.",
    );
    expect(prompt).toContain(
      "stay in first person and sound like a candidate, not a role summary or memo",
    );
    expect(prompt).toContain(
      "vary the opening and avoid repeated stems like 'I am drawn to work...', 'I am applying... with a clear focus on...', 'This role centers on...', or 'The highest-value work...'",
    );
    expect(prompt).toContain(
      "do not claim prior roles, achievements, credentials, tool usage, readiness, or impact",
    );
    expect(prompt).toContain(
      "keep employerValueBlock on operational consequence and closeLine on modest first-person ownership",
    );
    expect(prompt.length).toBeLessThan(4200);
    expect(prompt.split("\n").length).toBeLessThan(28);
  });

  it("requests strict JSON-schema body parts from OpenAI for premium generation", () => {
    const request = buildPremiumCoverLetterOpenAIRequest({
      prompt: "Structured brief: {}",
      writerModel: "gpt-5.4",
    });

    expect(request).toEqual({
      model: "gpt-5.4",
      input: "Structured brief: {}",
      reasoning: {
        effort: "low",
      },
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "cover_letter_body_parts",
          schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
          strict: true,
          json_schema: {
            name: "cover_letter_body_parts",
            schema: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
            strict: true,
          },
        },
      },
    });
  });

  it("prefers parsed structured payloads from the Responses API envelope", () => {
    const payload = extractOpenAIJsonPayload({
      output_parsed: {
        opening: "Opening sentence.",
        proofBlock: "Proof sentence.",
        employerValueBlock: "Employer value sentence.",
        closeLine: "Close sentence.",
      },
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Dear Hiring Manager,\n\nFallback text that should not win.",
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      opening: "Opening sentence.",
      proofBlock: "Proof sentence.",
      employerValueBlock: "Employer value sentence.",
      closeLine: "Close sentence.",
    });
  });

  it("keeps scanning when an earlier text field is plain prose and a later item contains parseable JSON", () => {
    const payload = extractOpenAIJsonPayload({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Dear Hiring Manager,\n\nThis is plain prose, not JSON.",
            },
            {
              type: "output_text",
              text: JSON.stringify({
                opening: "Opening sentence.",
                proofBlock: "Proof sentence.",
                employerValueBlock: "Employer value sentence.",
                closeLine: "Close sentence.",
              }),
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      opening: "Opening sentence.",
      proofBlock: "Proof sentence.",
      employerValueBlock: "Employer value sentence.",
      closeLine: "Close sentence.",
    });
  });
});

describe("premium cover letter generation and rendering", () => {
  const buildAdjacentAdminBrief = () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: {
        name: "Camille Bernard",
        summary:
          "Operations lead experienced in coordination, process documentation, and cross-team communication.",
        desiredPosition: "Operations Coordinator",
        topSkills: [
          "Coordination",
          "Documentation",
          "Stakeholder Communication",
        ],
        recentExperience: [
          {
            company: "Nexa Services",
            position: "Operations Coordinator",
            highlights: [
              "Coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
            ],
          },
        ],
      },
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: "Administrative Coordinator",
        jobDescription:
          "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
        contextClass: "cv_adjacent",
      }),
    });
  };

  const baseAdjacentAdminBodyParts = {
    opening:
      "I coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
    proofBlock:
      "I maintained clear records, scheduling follow-through, and cross-team updates.",
    employerValueBlock:
      "I documented process notes, tracked open items, and maintained vendor correspondence records.",
    closeLine:
      "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
  };

  const adjacentAdminIssueCodesFor = (value: string) =>
    validatePremiumCoverLetterBodyParts({
      brief: buildAdjacentAdminBrief(),
      bodyParts: {
        ...baseAdjacentAdminBodyParts,
        employerValueBlock: value,
      },
    }).map((issue) => issue.code);

  it("fails cv_adjacent output when experience translates into role support", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when skills are mapped to an Administrative Coordinator role", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when strong-foundation commentary maps to role responsibilities", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when background can help ensure efficient office operations", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "My background in coordination and documentation can help ensure that office operations run efficiently.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when operating strengths support smooth office operations", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("allows neutral cv_adjacent evidence-only wording", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "I coordinated workflows, documented processes, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
      ),
    ).not.toContain("adjacent_direct_fit");
  });

  it("retries Mistral once on adjacent_direct_fit and accepts repaired cv_adjacent output", async () => {
    const calls: string[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async ({ prompt }) => {
        calls.push(prompt);
        if (calls.length === 1) {
          return {
            opening:
              "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
            proofBlock:
              "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
            employerValueBlock:
              "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
            closeLine:
              "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
          };
        }
        return {
          opening:
            "I coordinated workflows, documented procedures, tracked deadlines, and handled vendor correspondence.",
          proofBlock:
            "I maintained clear records and scheduling follow-through for cross-functional projects.",
          employerValueBlock:
            "I documented process notes, tracked open items, and maintained vendor correspondence records.",
          closeLine:
            "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
        };
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain(
      "Rewrite the cover-letter body parts to satisfy validation.",
    );
    expect(calls[1]).toContain(
      "adjacent role-mapping, future-impact language, meta-commentary, or unsupported outcome claims",
    );
    expect(result).not.toBeNull();
    expect(result?.content).toContain(
      "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    );
  });

  it("does not retry repair for GPT/default or Qwen", async () => {
    const unsafeBodyParts = {
      opening:
        "I coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
      proofBlock:
        "I maintained clear records and scheduling follow-through for cross-functional projects.",
      employerValueBlock:
        "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
      closeLine:
        "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    };

    const baseArgs = {
      personalizationContext: adjacentContext,
      voicePreset: "signature" as const,
      outputLanguage: "English" as const,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writer: async () => unsafeBodyParts,
    };

    const gptCalls: string[] = [];
    const gptResult = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writerProvider: "openai",
      writerModel: "gpt-5.5",
      writer: async ({ prompt }) => {
        gptCalls.push(prompt);
        return unsafeBodyParts;
      },
    });
    const qwenCalls: string[] = [];
    const qwenResult = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      writer: async ({ prompt }) => {
        qwenCalls.push(prompt);
        return unsafeBodyParts;
      },
    });

    expect(gptCalls).toHaveLength(1);
    expect(qwenCalls).toHaveLength(1);
    expect(gptResult).toBeNull();
    expect(qwenResult).toBeNull();
  });

  it("does not accept a Mistral adjacent repair unless second validation passes", async () => {
    const calls: string[] = [];
    let failure: any = null;
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async ({ prompt }) => {
        calls.push(prompt);
        return {
          opening:
            "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
          proofBlock:
            "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
          employerValueBlock:
            "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
          closeLine:
            "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
        };
      },
    });

    expect(calls).toHaveLength(2);
    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "repair_failed_validation",
      issues: expect.arrayContaining(["adjacent_direct_fit"]),
    });
  });

  it("runs a mocked employment-strong-frontend premium smoke without fixture-opening reuse", async () => {
    let capturedPrompt = "";
    let capturedSchema: Record<string, unknown> | null = null;
    const bodyParts = {
      opening:
        "At BrightLayer, I led a design-system migration used across four product squads and reduced page-load time by 28 percent through bundle and rendering improvements.",
      proofBlock:
        "At Northline Labs, I built experimentation dashboards for product and growth teams and partnered directly with design on customer-facing workflow improvements; targeted UI experiments improved signup conversion by 11 percent.",
      employerValueBlock:
        "That experience maps cleanly to frontend work where reusable systems, performance, and product iteration matter together, with React and TypeScript as the base.",
      closeLine:
        "I would bring that same discipline to shipped interface work, reliable performance, and clean partnership with product and design.",
    };

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: [
          "React",
          "TypeScript",
          "Design Systems",
          "Performance Optimization",
          "A/B Testing",
        ],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
          {
            company: "Northline Labs",
            position: "Product Engineer",
            highlights: [
              "Built experimentation dashboards used by product and growth teams.",
              "Partnered directly with design on customer-facing workflow improvements.",
            ],
          },
        ],
        standoutAchievements: [
          "Improved signup conversion by 11 percent after iterative UI experiments.",
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, collaborate with product and design, and use experimentation carefully.",
      candidateName: "Alex Martin",
      writer: async ({ prompt, schema }) => {
        capturedPrompt = prompt;
        capturedSchema = schema;
        return bodyParts;
      },
    });

    expect(result).not.toBeNull();
    expect(capturedSchema).toEqual(PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA);
    expect(capturedPrompt).toContain("Planner priority order:");
    expect(capturedPrompt).toContain("Structured brief:");
    expect(capturedPrompt).toContain(
      "A JD keyword, tool, certification, compliance framework, domain, or responsibility may appear as candidate experience only when the CV supports that exact capability",
    );
    expect(capturedPrompt).toContain(
      "Bind ATS terms to a concrete action or result; never list them",
    );
    expect(capturedPrompt).toContain(
      "Bind ATS and JD terms to a concrete CV-backed action, artifact, responsibility, or result",
    );
    expect(capturedPrompt).toContain("clipped fragments like 'St.'");
    expect(capturedPrompt).toContain(
      "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'",
    );
    expect(capturedPrompt).toContain(
      "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'",
    );
    expect(result?.bodyParts).toEqual(bodyParts);
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("design-system migration used across four product squads");
    expect(result?.content).toContain("page-load time by 28 percent");
    expect(result?.content).toContain("React and TypeScript");
    expect(result?.content).toContain("partnered directly with design");
    expect(result?.content).toContain("experimentation dashboards");
    expect(result?.content).toContain("targeted UI experiments improved signup conversion by 11 percent");
    expect(result?.content).toContain(
      "That experience maps cleanly to frontend work where reusable systems, performance, and product iteration matter together",
    );
    expect(result?.content).toContain("signup conversion by 11 percent");
    expect(result?.content).not.toContain("Your frontend role sits where");
    expect(result?.content).not.toMatch(
      /helped targeted UI experiments improve|evidence I would bring/i,
    );
    expect(result?.content).not.toMatch(/mentoring|people management|backend|mobile/i);
    expect(result?.content).not.toMatch(
      /I am excited to apply|I am writing to express my interest|My background aligns/i,
    );
  });

  it("rejects clipped source fragments and allows source-safe team fallbacks", async () => {
    const baseArgs = {
      personalizationContext: {
        name: "Test Candidate",
        summary:
          "Safety-conscious Security Guard with eight years of experience protecting VIP individuals.",
        desiredPosition: "Security Guard",
        topSkills: ["Safety compliance", "Investigation skills"],
        recentExperience: [
          {
            company: "Sentinel Services",
            position: "Security Guard",
            highlights: [
              "Maintained environments by monitoring grounds and equipment controls.",
              "Logged into security headquarters on a set schedule to report all-in-order statuses.",
            ],
          },
        ],
      },
      voicePreset: "signature" as const,
      outputLanguage: "English" as const,
      jobTitle: "Security Officer",
      jobDescription:
        "Location: St. Support visitors and staff, patrol campus grounds, and document safety incidents.",
      candidateName: "Test Candidate",
    };

    const unsafe = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writer: async () => ({
        opening:
          "I bring security experience monitoring grounds and equipment controls.",
        proofBlock:
          "At Sentinel Services, I logged all-in-order statuses on a set schedule.",
        employerValueBlock:
          "That experience fits campus security work that depends on steady monitoring.",
        closeLine:
          "I would welcome the opportunity to contribute to your St. campus team.",
      }),
    });
    const safe = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writer: async () => ({
        opening:
          "I bring security experience monitoring grounds and equipment controls.",
        proofBlock:
          "At Sentinel Services, I logged all-in-order statuses on a set schedule.",
        employerValueBlock:
          "That experience fits campus security work that depends on steady monitoring.",
        closeLine:
          "I would welcome the opportunity to contribute to the campus security team.",
      }),
    });

    expect(unsafe).toBeNull();
    expect(safe?.content).toContain("the campus security team");
    expect(safe?.content).not.toContain("your St. campus team");
  });

  it("fails ATS keyword lists and compliance-framework hallucinations but allows source-backed action phrases", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support access control, document incidents, and maintain routine safety coverage.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with access control monitoring and incident documentation experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support access control, document incidents, and maintain routine safety coverage.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with access control monitoring and incident documentation experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support access control, document incidents, and maintain routine safety coverage.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support access control, document incidents, and maintain routine safety coverage.",
        contextClass: "cv_direct",
      }),
    });

    const keywordListIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "Skills: access control monitoring, incident documentation, HIPAA, and OSHA.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const complianceIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I bring HIPAA compliance and JCAHO standards to security work.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const safeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I supported access control monitoring and incident documentation across shifts.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    expect(keywordListIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ats_keyword_list",
          repairable: false,
        }),
      ]),
    );
    expect(complianceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_compliance_framework",
          repairable: false,
        }),
      ]),
    );
    expect(safeIssues).toEqual([]);
  });

  it("fails closed on unsupported security ownership and fabricated mission claims", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Maintained environments by monitoring grounds and equipment controls.",
                "Completed reports by recording observations and occurrences.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Maintained environments by monitoring grounds and equipment controls.",
                  "Completed reports by recording observations and occurrences.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
        contextClass: "cv_direct",
      }),
    });

    const issues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "My monitoring and reporting experience fits security work on a healthcare campus.",
        proofBlock:
          "I am adept at leading emergency preparedness drills and my experience includes managing and documenting safety incidents.",
        employerValueBlock:
          "That work supports Northstar Care's mission of safeguarding patients and staff.",
        closeLine:
          "I am ready to contribute to reimagining healthcare security.",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
        expect.objectContaining({
          code: "fabricated_mission_claim",
          repairable: false,
        }),
      ]),
    );
  });

  it("fails unsupported emergency ownership but allows supported emergency readiness phrasing", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, document incidents, and maintain emergency readiness.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, and maintain emergency readiness.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, and maintain emergency readiness.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, and maintain emergency readiness.",
        contextClass: "cv_direct",
      }),
    });

    const unsafeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I monitored access points and documented safety incidents across shifts.",
        proofBlock:
          "I managed safety incidents and led emergency drills as part of my work.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const safeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I monitored access points and documented safety incidents across shifts.",
        proofBlock:
          "I supported emergency readiness by documenting incidents and monitoring access points.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    expect(unsafeIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
      ]),
    );
    expect(safeIssues).toEqual([]);
  });

  it("fails provider-inflated incident, license, and education claims without CV support", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
        contextClass: "cv_direct",
      }),
    });

    const issues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "My background in monitoring grounds and managing safety incidents aligns directly with this role.",
        proofBlock:
          "I documented safety incidents to identify and resolve hazards before they escalated.",
        employerValueBlock:
          "A valid driver's license and high school diploma further meet your core requirements without delay.",
        closeLine:
          "I look forward to discussing how my active driver's license can contribute to daily campus safety.",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
        expect.objectContaining({
          code: "unsupported_license_claim",
          repairable: false,
        }),
        expect.objectContaining({
          code: "unsupported_education_credential",
          repairable: false,
        }),
      ]),
    );
  });

  it("keeps premium safety validation gates fail-closed", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Ascension needs a Security Officer to support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented visitor logs.",
                "Reported all-clear status during routine patrols.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented visitor logs.",
                  "Reported all-clear status during routine patrols.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
        contextClass: "cv_direct",
      }),
    });

    const issueCodes = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "A valid driver's license and high school diploma further meet your core requirements without delay.",
        proofBlock:
          "Skills: access control, emergency response, HIPAA, and OSHA.",
        employerValueBlock:
          "I am drawn to Ascension's mission of safeguarding patients, staff, and facilities.",
        closeLine:
          "I managed safety incidents, led emergency preparedness drills, and would contribute to your St. team.",
      },
    }).map((issue) => issue.code);

    expect(issueCodes).toEqual(
      expect.arrayContaining([
        "unsupported_security_ownership",
        "unsupported_license_claim",
        "unsupported_education_credential",
        "unsupported_compliance_framework",
        "fabricated_mission_claim",
        "clipped_source_fragment",
        "ats_keyword_list",
      ]),
    );
  });

  it("generates a direct signature cover letter with strongest evidence in context and no weak-qualification dominance", async () => {
    let capturedPrompt = "";

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async ({ prompt, schema }) => {
        capturedPrompt = prompt;
        expect(schema).toEqual(PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA);
        return {
          opening:
            "I am applying for the Senior Frontend Engineer role with a background in customer-facing web applications and reusable UI systems.",
          proofBlock:
            "I improved signup conversion by 11% after iterative UI experiments and led a design system migration used across 4 product squads.",
          employerValueBlock:
            "That mix of experimentation and system-level UI work is directly relevant to a role centered on design systems and customer-facing web applications.",
          closeLine:
            "I would welcome the opportunity to discuss the role further.",
        };
      },
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("direct");
    expect(result?.brief.topEvidence[0]).toContain("11%");
    expect(capturedPrompt).toContain(result?.brief.topEvidence[0] ?? "");
    expect(capturedPrompt).not.toContain("Excel");
    expect(result?.bodyParts.opening).not.toContain("Dear Hiring Manager");
    expect(result?.bodyParts.closeLine).not.toContain("Sincerely");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).toContain("Alex Martin");
  });

  it("generates a direct expert cover letter with a substantive employerValueBlock", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async () => ({
        opening:
          "The Senior Frontend Engineer role is a strong match for work I have done in customer-facing product environments.",
        proofBlock:
          "I improved signup conversion by 11% after iterative UI experiments, led a design system migration used across 4 product squads, and built experimentation dashboards used by product and growth teams.",
        employerValueBlock:
          "That combination is relevant to a role that depends on design-system discipline, experimentation workflows, and clear delivery across product teams.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("direct");
    expect(
      `${result?.brief.topEvidence.join(" ")} ${result?.brief.supportEvidence.join(" ")}`,
    ).toContain("design system");
    expect(result?.bodyParts.employerValueBlock.split(/\s+/).length).toBeGreaterThan(
      10,
    );
    expect(result?.content.match(/I would welcome the opportunity to discuss the role further\./g))
      .toHaveLength(1);
  });

  it("repairs a recoverable adjacent engaging cover letter without greeting or signoff leakage in body parts", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Maya Chen",
      writer: async () => ({
        opening:
          "Dear Hiring Manager,\nI am interested in the Implementation Analyst role because my background stays close to reporting and cross-functional handoffs",
        proofBlock:
          "I reduced backlog response times by 18% through queue and handoff changes, and I built weekly dashboards to track bottlenecks and response times.",
        employerValueBlock: "",
        closeLine:
          "Sincerely,\nI would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("transfer");
    expect(result?.brief.transferCore?.length).toBeGreaterThan(0);
    expect(result?.bodyParts.opening).not.toContain("Dear Hiring Manager");
    expect(result?.bodyParts.closeLine).not.toContain("Sincerely");
    expect(result?.bodyParts.employerValueBlock.split(/\s+/).length).toBeGreaterThan(
      8,
    );
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).toContain("Maya Chen");
  });

  it("surfaces a validation failure trace when adjacent output claims direct target-role experience", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Maya Chen",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "I am applying for the Implementation Analyst role with experience as an Implementation Analyst in cross-functional delivery environments.",
        proofBlock:
          "I reduced backlog response times by 18% through queue and handoff changes.",
        employerValueBlock:
          "That background would help keep reporting and handoffs aligned across teams.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toEqual({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "cv_adjacent",
      issues: ["adjacent_direct_fit"],
    });
  });

  it("generates a no-CV premium cover letter without inventing candidate history", async () => {
    let capturedPrompt = "";

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      writer: async ({ prompt, schema }) => {
        capturedPrompt = prompt;
        expect(schema).toEqual(PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA);
        return {
          opening:
            "I am applying for the Operations Coordinator role because the work is centered on service requests, follow-through, and accurate day-to-day coordination.",
          proofBlock:
            "What stands out most is the need to track follow-up, keep records current, and keep scheduling and communication aligned across vendors and internal teams.",
          employerValueBlock:
            "That mix of documentation, communication, and steady coordination is clearly where the role creates value from day to day.",
          closeLine:
            "I would welcome the opportunity to discuss the role further.",
        };
      },
    });

    expect(result).not.toBeNull();
    expect(result?.contextClass).toBe("no_cv");
    expect(result?.mode).toBe("no_cv");
    expect(result?.brief.candidateEvidenceAvailable).toBe(false);
    expect(result?.brief.topEvidence.join(" ")).not.toMatch(/Excel/i);
    expect(capturedPrompt).toContain("For no_cv, there is no supported candidate history.");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).not.toMatch(/my experience|in previous roles|I have worked with/i);
  });

  it("fails closed when a no-CV premium draft invents prior experience", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "I am applying for the Operations Coordinator role with experience coordinating service requests in previous roles.",
        proofBlock:
          "I managed vendor follow-up and kept records current across multiple teams.",
        employerValueBlock:
          "That experience would help me step into the role immediately.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toEqual({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "no_cv",
      issues: ["no_cv_history_claim"],
    });
  });

  it("reads the premium feature flag conservatively", () => {
    expect(isCoverLetterPremiumPathV1Enabled("1")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("true")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("on")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("off")).toBe(false);
    expect(isCoverLetterPremiumPathV1Enabled("")).toBe(false);
  });

  it("accepts the ENABLE_* env convention for the premium flag", () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    try {
      expect(isCoverLetterPremiumPathV1Enabled()).toBe(true);
    } finally {
      delete process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1;
    }
  });

  it("defaults the premium writer model to gpt-5.5 and safely accepts smaller fallbacks", () => {
    delete process.env.COVER_LETTER_PREMIUM_WRITER_MODEL;
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5.4";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.4");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5-mini");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "unsupported-model";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    delete process.env.COVER_LETTER_PREMIUM_WRITER_MODEL;
  });
});
