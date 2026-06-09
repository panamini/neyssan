import type { CareerKnowledgeRuleV1 } from "./schema";

export const CAREER_KNOWLEDGE_RULES_V1 = [
  {
    id: "ck.v1.source_truth.preserve_candidate_facts",
    category: "source_truth",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Candidate facts preserve source truth",
    description:
      "Later application work must keep candidate facts tied to source material instead of rewriting them into polished application copy.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale:
      "Source-truth facts are reviewable evidence. Polished generated text belongs in artifacts, not canonical candidate facts.",
    version: 1,
  },
  {
    id: "ck.v1.source_truth.approved_facts_only",
    category: "source_truth",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Public application artifacts require approved facts",
    description:
      "Later public resumes, CVs, cover letters, exports, sends, submissions, and tracking must use only approved candidate facts.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale:
      "Pending, rejected, or unreviewed facts are not safe enough for public application use.",
    version: 1,
  },
  {
    id: "ck.v1.source_truth.never_use_exclusion",
    category: "source_truth",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Never-use facts are ineligible",
    description:
      "Facts marked never_use must not be selected for later public artifacts, matching, exports, sends, submissions, or tracking.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale: "A user-level exclusion must override all matching and generation convenience.",
    version: 1,
  },
  {
    id: "ck.v1.source_truth.private_fact_exclusion",
    category: "source_truth",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Private facts stay out of public artifacts",
    description:
      "Facts marked private must not enter public CVs, resumes, cover letters, exports, sends, submissions, application packets, or external agent outputs.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale: "Private candidate material can help internal review but is not public application material.",
    version: 1,
  },
  {
    id: "ck.v1.source_truth.generated_text_is_artifact_only",
    category: "source_truth",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Generated polished text is artifact-only",
    description:
      "Generated resume bullets, cover-letter paragraphs, proposal copy, and final application text must be stored as artifacts, not candidate facts.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
      artifactTypes: ["cover_letter", "resume_variant", "resume_patch_plan", "export"],
    },
    rationale:
      "Candidate facts should remain source-backed evidence. Generated text is derived output that requires review.",
    version: 1,
  },
  {
    id: "ck.v1.claim_safety.no_invented_metrics",
    category: "claim_safety",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Do not invent metrics",
    description:
      "Later drafts must not add percentages, revenue, headcount, speed, scale, or impact numbers unless source facts support them.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
      candidateFactTypes: ["achievement", "experience", "project"],
    },
    rationale: "Unsupported metrics make truthful review impossible and can misrepresent the candidate.",
    version: 1,
  },
  {
    id: "ck.v1.claim_safety.no_unsupported_certifications",
    category: "claim_safety",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Do not claim unsupported certifications",
    description:
      "Certifications, licenses, degrees, and credentials must be present in approved source facts before later public use.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
      candidateFactTypes: ["certification", "education"],
    },
    rationale: "Credential claims need explicit source support and review before publication.",
    version: 1,
  },
  {
    id: "ck.v1.claim_safety.no_unsupported_language_proficiency",
    category: "claim_safety",
    documentKind: "application_packet",
    market: "global",
    severity: "warning",
    title: "Do not overstate language proficiency",
    description:
      "Language names and proficiency levels should come from approved facts; missing levels should be reviewed rather than guessed.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
      candidateFactTypes: ["language"],
    },
    rationale: "Language proficiency is easy to overstate and should stay tied to user-approved source material.",
    version: 1,
  },
  {
    id: "ck.v1.claim_safety.no_fake_personal_connection",
    category: "claim_safety",
    documentKind: "cover_letter",
    market: "global",
    severity: "blocker",
    title: "Do not invent personal connection",
    description:
      "Cover letters must not invent referrals, personal relationships, company history, prior conversations, or special enthusiasm without source support.",
    appliesTo: {
      documentKinds: ["cover_letter", "application_packet"],
      artifactTypes: ["cover_letter"],
    },
    rationale: "Relationship and motivation claims require explicit source support from the candidate or application context.",
    version: 1,
  },
  {
    id: "ck.v1.claim_safety.claims_need_source_support",
    category: "claim_safety",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Claims require source support",
    description:
      "Later public claims must map back to approved source facts or be flagged for review instead of fabricated.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale: "The proof layer exists to keep generated application material evidence-backed.",
    version: 1,
  },
  {
    id: "ck.v1.resume.canonical_cv_non_mutation",
    category: "structure",
    documentKind: "cv",
    market: "global",
    severity: "blocker",
    title: "Canonical CV must not be mutated",
    description:
      "Later tailoring work must not overwrite or mutate the canonical CV/profile while producing a role-specific resume or CV variant.",
    appliesTo: {
      documentKinds: ["resume", "cv", "application_packet"],
      artifactTypes: ["resume_variant", "resume_patch_plan"],
    },
    rationale: "The canonical candidate record is the stable source baseline; tailored outputs must remain separate artifacts.",
    version: 1,
  },
  {
    id: "ck.v1.resume.tailored_resume_separate_artifact",
    category: "structure",
    documentKind: "resume",
    market: "global",
    severity: "warning",
    title: "Tailored resume is a separate artifact",
    description:
      "A tailored resume should be represented as a derived artifact or plan rather than an in-place edit to source candidate data.",
    appliesTo: {
      documentKinds: ["resume", "application_packet"],
      artifactTypes: ["resume_variant", "resume_patch_plan"],
    },
    rationale: "Separation keeps rollback and human review straightforward.",
    version: 1,
  },
  {
    id: "ck.v1.resume.skills_evidence_backed",
    category: "claim_safety",
    documentKind: "resume",
    market: "global",
    severity: "warning",
    title: "Skills should be evidence-backed",
    description:
      "Skills highlighted in later resumes or CVs should connect to approved source facts such as experience, projects, education, or explicit skill entries.",
    appliesTo: {
      documentKinds: ["resume", "cv", "application_packet"],
      candidateFactTypes: ["skill", "experience", "project", "education"],
    },
    rationale: "Skill lists are more trustworthy when grounded in candidate evidence.",
    version: 1,
  },
  {
    id: "ck.v1.resume.ats_readability_baseline",
    category: "ats",
    documentKind: "resume",
    market: "global",
    severity: "info",
    title: "ATS readability baseline is conservative guidance",
    description:
      "Prefer clear headings, selectable text, simple section order, and conservative formatting; do not treat this as ATS certification or a guarantee.",
    appliesTo: {
      documentKinds: ["resume", "cv", "application_packet"],
    },
    rationale: "Readable structure helps review and parsing, but no static rule can certify ATS outcomes.",
    version: 1,
  },
  {
    id: "ck.v1.cover_letter.no_unsupported_enthusiasm",
    category: "tone",
    documentKind: "cover_letter",
    market: "global",
    severity: "warning",
    title: "Avoid unsupported enthusiasm",
    description:
      "Cover-letter tone can be warm, but specific passion, mission alignment, or company admiration should be grounded in supplied context.",
    appliesTo: {
      documentKinds: ["cover_letter", "application_packet"],
      artifactTypes: ["cover_letter"],
    },
    rationale: "Tone should not become fabricated motivation or personal history.",
    version: 1,
  },
  {
    id: "ck.v1.cover_letter.no_raw_source_dumping",
    category: "formatting",
    documentKind: "cover_letter",
    market: "global",
    severity: "warning",
    title: "Do not dump raw source material",
    description:
      "Later cover-letter drafting must not paste raw source documents or unfiltered candidate notes into the artifact or prompts.",
    appliesTo: {
      documentKinds: ["cover_letter", "application_packet"],
      artifactTypes: ["cover_letter"],
    },
    rationale: "Raw source material is sensitive and should be transformed only through approved, source-backed facts.",
    version: 1,
  },
  {
    id: "ck.v1.cover_letter.generated_text_artifact_not_fact",
    category: "source_truth",
    documentKind: "cover_letter",
    market: "global",
    severity: "blocker",
    title: "Cover-letter text remains an artifact",
    description:
      "Generated cover-letter paragraphs must remain artifact content and must not be promoted into candidate facts.",
    appliesTo: {
      documentKinds: ["cover_letter", "application_packet"],
      artifactTypes: ["cover_letter"],
    },
    rationale: "A cover letter is derived output, not source evidence about the candidate.",
    version: 1,
  },
  {
    id: "ck.v1.review_gate.approval_required_before_distribution",
    category: "review_gate",
    documentKind: "application_packet",
    market: "global",
    severity: "blocker",
    title: "Approval required before distribution",
    description:
      "Later export, send, submit, apply, and tracking flows require explicit approval gates before public or external use.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
      artifactTypes: ["cover_letter", "resume_variant", "export"],
    },
    rationale: "Human review is required before distribution or status changes.",
    version: 1,
  },
  {
    id: "ck.v1.review_gate.missing_evidence_warns_not_fabricates",
    category: "review_gate",
    documentKind: "application_packet",
    market: "global",
    severity: "warning",
    title: "Missing evidence creates review warnings",
    description:
      "When later steps cannot support a claim, they should create review warnings or omissions rather than fabricate evidence.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale: "A proof layer should surface gaps instead of hiding them with plausible text.",
    version: 1,
  },
  {
    id: "ck.v1.localization.global_default_no_compliance_claims",
    category: "localization",
    documentKind: "application_packet",
    market: "global",
    severity: "info",
    title: "Global defaults are not compliance advice",
    description:
      "Global rules are conservative product heuristics and must not be presented as legal, hiring, immigration, ATS, or exhaustive compliance advice.",
    appliesTo: {
      documentKinds: ["resume", "cv", "cover_letter", "application_packet"],
    },
    rationale: "Market localization can guide structure and language, but it cannot certify compliance.",
    version: 1,
  },
  {
    id: "ck.v1.localization.us.resume_label_placeholder",
    category: "localization",
    documentKind: "resume",
    market: "us",
    severity: "info",
    title: "US market placeholder prefers resume wording",
    description:
      "For US-targeted applications, later UI or planning may prefer resume terminology over CV terminology while avoiding legal or ATS guarantees.",
    appliesTo: {
      documentKinds: ["resume", "application_packet"],
    },
    rationale: "This is a narrow localization placeholder for later planning, not an exhaustive market rule.",
    version: 1,
  },
] as const satisfies readonly CareerKnowledgeRuleV1[];
