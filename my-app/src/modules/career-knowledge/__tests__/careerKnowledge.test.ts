import { describe, expect, it } from "vitest";

import {
  assertUniqueCareerKnowledgeRuleIds,
  filterCareerKnowledgeRules,
  getCareerKnowledgeRuleById,
  listCareerKnowledgeRules,
  resolveCareerKnowledgeRules,
} from "../resolver";
import type { CareerKnowledgeResolveInputV1 } from "../schema";

function ruleIds(input: CareerKnowledgeResolveInputV1): readonly string[] {
  return resolveCareerKnowledgeRules(input).rules.map((rule) => rule.id);
}

describe("career-knowledge rules", () => {
  it("keeps all rule IDs unique", () => {
    expect(() => assertUniqueCareerKnowledgeRuleIds()).not.toThrow();

    const rules = listCareerKnowledgeRules();
    const ids = rules.map((rule) => rule.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each rule primary document kind in its appliesTo document kinds", () => {
    for (const rule of listCareerKnowledgeRules()) {
      expect(rule.appliesTo.documentKinds).toContain(rule.documentKind);
    }
  });

  it("resolver returns global rules for default input", () => {
    const result = resolveCareerKnowledgeRules({ documentKind: "resume" });

    expect(result.market).toBe("global");
    expect(result.version).toBe(1);
    expect(result.rules.length).toBeGreaterThan(0);
    expect(result.rules.every((rule) => rule.market === "global")).toBe(true);
    expect(ruleIds({ documentKind: "resume" })).toContain(
      "ck.v1.localization.global_default_no_compliance_claims",
    );
  });

  it("resolver filters by documentKind", () => {
    const resumeIds = ruleIds({ documentKind: "resume" });
    const coverLetterIds = ruleIds({ documentKind: "cover_letter" });

    expect(resumeIds).toContain("ck.v1.resume.canonical_cv_non_mutation");
    expect(resumeIds).not.toContain("ck.v1.cover_letter.generated_text_artifact_not_fact");
    expect(coverLetterIds).toContain("ck.v1.cover_letter.generated_text_artifact_not_fact");
    expect(coverLetterIds).not.toContain("ck.v1.resume.tailored_resume_separate_artifact");
  });

  it("resolver filters or falls back by market", () => {
    const usResult = resolveCareerKnowledgeRules({ documentKind: "resume", market: "us" });
    const defaultResult = resolveCareerKnowledgeRules({ documentKind: "resume" });

    expect(usResult.market).toBe("us");
    expect(defaultResult.market).toBe("global");
    expect(usResult.rules.map((rule) => rule.id)).toContain(
      "ck.v1.localization.us.resume_label_placeholder",
    );
    expect(defaultResult.rules.map((rule) => rule.id)).not.toContain(
      "ck.v1.localization.us.resume_label_placeholder",
    );
  });

  it("cover-letter rules include unsupported-claim blockers and warnings", () => {
    const result = resolveCareerKnowledgeRules({
      documentKind: "cover_letter",
      artifactType: "cover_letter",
    });

    expect(result.blockedRuleIds).toContain("ck.v1.claim_safety.no_fake_personal_connection");
    expect(result.blockedRuleIds).toContain("ck.v1.claim_safety.claims_need_source_support");
    expect(result.warningRuleIds).toContain("ck.v1.cover_letter.no_unsupported_enthusiasm");
  });

  it("resume and CV rules include canonical CV non-mutation guidance", () => {
    expect(ruleIds({ documentKind: "resume" })).toContain("ck.v1.resume.canonical_cv_non_mutation");
    expect(ruleIds({ documentKind: "cv" })).toContain("ck.v1.resume.canonical_cv_non_mutation");
  });

  it("source-truth rules include never_use and private fact protections", () => {
    const ids = ruleIds({ documentKind: "application_packet" });

    expect(ids).toContain("ck.v1.source_truth.never_use_exclusion");
    expect(ids).toContain("ck.v1.source_truth.private_fact_exclusion");
  });

  it("generated polished text is artifact-only", () => {
    const rule = getCareerKnowledgeRuleById("ck.v1.source_truth.generated_text_is_artifact_only");

    expect(rule?.severity).toBe("blocker");
    expect(rule?.description).toMatch(/artifacts, not candidate facts/i);
    expect(rule?.rationale).toMatch(/Generated text is derived output/i);
  });

  it("output order is deterministic", () => {
    const input = { documentKind: "application_packet", market: "us" } as const;

    expect(ruleIds(input)).toEqual(ruleIds(input));
    expect(filterCareerKnowledgeRules(input).map((rule) => rule.id)).toEqual(ruleIds(input));
  });

  it("helpers do not mutate input", () => {
    const input: CareerKnowledgeResolveInputV1 = {
      documentKind: "resume",
      market: "us",
      language: "en",
      targetRole: "product engineer",
      seniority: "senior",
      sourceTypes: ["uploaded_cv", "manual_entry"],
      candidateFactTypes: ["skill", "experience"],
      artifactType: "resume_variant",
    };
    const before = JSON.stringify(input);

    resolveCareerKnowledgeRules(input);
    filterCareerKnowledgeRules(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(input.sourceTypes).toEqual(["uploaded_cv", "manual_entry"]);
    expect(input.candidateFactTypes).toEqual(["skill", "experience"]);
  });

  it("unsupported or unknown market falls back safely to other/global behavior", () => {
    const result = resolveCareerKnowledgeRules({ documentKind: "resume", market: "brazil" });
    const ids = result.rules.map((rule) => rule.id);

    expect(result.market).toBe("other");
    expect(ids).toContain("ck.v1.localization.global_default_no_compliance_claims");
    expect(ids).not.toContain("ck.v1.localization.us.resume_label_placeholder");
  });
});
