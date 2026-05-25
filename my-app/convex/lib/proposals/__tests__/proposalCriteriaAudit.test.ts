import { describe, expect, it } from "vitest";

import { buildProposalCriteriaAudit } from "../proposalCriteriaAudit";
import type { ProposalPlannerResult } from "../proposalPlanner";

const plannerResult: ProposalPlannerResult = {
  context_mode: "rich",
  domain_gap: "direct",
  credential_status: "exact_required",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [
    "Improved signup conversion by 11 percent after iterative UI experiments.",
    "Led a design system migration used across 4 product squads.",
    "React delivery for customer-facing web applications.",
    "React",
  ],
  allowed_transfer_themes: ["product-facing web applications"],
  disallowed_claims: ["unsupported Kubernetes experience"],
  identity_hard_stops: [],
  proof_strategy: "concrete_supported",
  opening_strategy: "direct_fast",
};

describe("proposal criteria audit", () => {
  it("keeps strongest candidate evidence ahead of company values", () => {
    const audit = buildProposalCriteriaAudit({
      plannerResult,
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Our values are craft, speed, and customer care. Lead React delivery for customer-facing web applications and improve experimentation workflows.",
    });

    expect(audit.companyValuesCoverage).toBe("explicit");
    expect(
      audit.strongestCandidateEvidence.some((fact) =>
        fact.includes("11 percent"),
      ),
    ).toBe(true);
    expect(audit.strongestCandidateEvidence.join(" ")).not.toContain(
      "customer care",
    );
    expect(audit.evidencePriority.slice(0, 3)).toEqual([
      "achievement",
      "responsibility",
      "workflow",
    ]);
  });

  it("summarizes keyword reuse as supported, advisory, and blocked", () => {
    const audit = buildProposalCriteriaAudit({
      plannerResult,
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React delivery, own Kubernetes reliability work, and coordinate experimentation workflows. Must have AWS certification and senior staff leadership.",
    });

    expect(audit.keywordReusePolicy.supported).toEqual(
      expect.arrayContaining(["React delivery"]),
    );
    expect(audit.keywordReusePolicy.advisory).toEqual(
      expect.arrayContaining(["experimentation workflows"]),
    );
    expect(audit.keywordReusePolicy.advisory).not.toEqual(
      expect.arrayContaining(["strong", "excellent", "dynamic"]),
    );
    expect(audit.keywordReusePolicy.blocked).toEqual(
      expect.arrayContaining([
        "Kubernetes reliability work",
        "AWS certification",
        "senior staff leadership",
      ]),
    );
    expect(audit.majorRisks).toContain("unsupported_keyword");
  });

  it("reports no-context risk without creating personal alignment", () => {
    const audit = buildProposalCriteriaAudit({
      plannerResult: {
        ...plannerResult,
        context_mode: "none",
        allowed_concrete_facts: [],
        proof_strategy: "none",
      },
      jobTitle: "Operations Associate",
      jobDescription:
        "Our mission is reliable service. Coordinate service records and maintain accurate handoffs.",
    });

    expect(audit.companyValuesCoverage).toBe("explicit");
    expect(audit.strongestCandidateEvidence).toEqual([]);
    expect(audit.majorRisks).toContain("no_context_claim");
    expect(JSON.stringify(audit).toLowerCase()).not.toContain("i share");
  });

  it("does not add company-praise risk only because mapped values exist", () => {
    const audit = buildProposalCriteriaAudit({
      plannerResult,
      jobTitle: "Frontend Engineer",
      jobDescription:
        "Our values are craft and customer care. Lead React delivery for customer-facing web applications.",
    });

    expect(audit.companyValuesCoverage).toBe("explicit");
    expect(audit.majorRisks).not.toContain("company_praise");
    expect(audit.majorRisks).not.toContain("unmapped_company_values");
  });

  it("flags unmapped values and banned praise phrases only when available", () => {
    const audit = buildProposalCriteriaAudit({
      plannerResult,
      jobTitle: "Frontend Engineer",
      jobDescription:
        "Our mission is sustainability. Lead React delivery for customer-facing web applications.",
      generatedText:
        "Your mission resonates with me, and I admire your culture.",
    });

    expect(audit.majorRisks).toContain("unmapped_company_values");
    expect(audit.majorRisks).toContain("company_praise");
  });

  it("tightens credential inflation to unsupported required credentials", () => {
    const relatedCredentialAudit = buildProposalCriteriaAudit({
      plannerResult: {
        ...plannerResult,
        credential_status: "related_not_equivalent",
        disallowed_claims: [],
      },
      jobTitle: "Frontend Engineer",
      jobDescription:
        "Lead reusable UI work and coordinate frontend delivery across product teams.",
    });
    expect(relatedCredentialAudit.majorRisks).not.toContain(
      "credential_inflation",
    );

    const missingCredentialAudit = buildProposalCriteriaAudit({
      plannerResult: {
        ...plannerResult,
        credential_status: "unsupported",
        disallowed_claims: ["unsupported PMP certification"],
      },
      jobTitle: "Project Manager",
      jobDescription:
        "Must have PMP certification and experience with regulated delivery.",
    });
    expect(missingCredentialAudit.majorRisks).toContain("credential_inflation");
  });
});
