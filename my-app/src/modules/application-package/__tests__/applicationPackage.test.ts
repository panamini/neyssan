import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import type { CoverLetterArtifactV1 } from "../../cover-letter-artifact/schema";
import type { ResumeVariantArtifactV1 } from "../../resume-variant-artifact/schema";
import {
  assertApplicationPackageDoesNotContainGeneratedText,
  buildApplicationPackage,
  buildApplicationPackageContent,
  buildApplicationPackageContentHash,
  buildApplicationPackageHash,
  collectApplicationPackageAllowedClaimIds,
  collectApplicationPackageDemandIds,
  collectApplicationPackageEvidenceMatchIds,
  collectApplicationPackageReviewItemIds,
  collectApplicationPackageRiskFlagIds,
  collectApplicationPackageSourceFactIds,
} from "../buildApplicationPackage";
import type { ApplicationPackageV1, BuildApplicationPackageInputV1 } from "../schema";

const T = Date.UTC(2026, 5, 10);

function resumeVariantArtifact(overrides: Partial<ResumeVariantArtifactV1> = {}): ResumeVariantArtifactV1 {
  return {
    id: "resume-variant-artifact:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    targetDocumentKind: "resume",
    language: "en",
    market: "global",
    status: "ready_for_generation",
    sections: [
      {
        id: "resume-variant-artifact-section:skills",
        kind: "skills",
        title: "Skills",
        sourceFactIds: ["candidate-fact:a"],
        allowedClaimIds: ["allowed-claim:a"],
        evidenceMatchIds: ["evidence-match:a"],
        demandIds: ["demand:a"],
        riskFlagIds: [],
        reviewItemIds: ["review:a"],
        items: [
          {
            id: "resume-variant-artifact-item:skills:a",
            kind: "source_backed_claim",
            section: "skills",
            allowedClaimId: "allowed-claim:a",
            candidateFactId: "candidate-fact:a",
            evidenceMatchId: "evidence-match:a",
            demandId: "demand:a",
            sourceFactIds: ["candidate-fact:a"],
            allowedClaimIds: ["allowed-claim:a"],
            evidenceMatchIds: ["evidence-match:a"],
            demandIds: ["demand:a"],
            riskFlagIds: [],
            reviewItemIds: ["review:a"],
            label: "Source-backed claim",
            note: "Source-backed resume metadata.",
            version: 1,
          },
        ],
        version: 1,
      },
    ],
    warnings: [],
    provenance: {
      applicationContextId: "application-context:abc",
      evidenceGraphId: "evidence-graph:hash-a",
      evidenceGraphHash: "hash-a",
      resumeVariantPlanId: "resume-variant-plan:hash-a",
      resumeVariantPlanHash: "hash-a",
      reviewCockpitId: "review-cockpit:hash-a",
      sourceFactIds: ["candidate-fact:b", "candidate-fact:a", "candidate-fact:a"],
      allowedClaimIds: ["allowed-claim:b", "allowed-claim:a", "allowed-claim:a"],
      evidenceMatchIds: ["evidence-match:b", "evidence-match:a", "evidence-match:a"],
      demandIds: ["demand:b", "demand:a", "demand:a"],
      riskFlagIds: ["risk:b", "risk:a", "risk:a"],
      reviewItemIds: ["review:b", "review:a", "review:a"],
      version: 1,
    },
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function coverLetterArtifact(overrides: Partial<CoverLetterArtifactV1> = {}): CoverLetterArtifactV1 {
  const resumeArtifactId = "resume-variant-artifact:hash-a";
  return {
    id: "cover-letter-artifact:hash-a",
    userId: "user_123",
    applicationContextId: "application-context:abc",
    language: "en",
    market: "global",
    status: "ready_for_review",
    text: {
      value: "Dear Hiring Manager,\n\nI am excited to apply.",
      format: "plain_text",
      sourceKind: "manual_text",
      textHash: "cover-letter-text-hash-a",
      paragraphCount: 2,
      characterCount: "Dear Hiring Manager,\n\nI am excited to apply.".length,
      version: 1,
    },
    sourceMetadata: {
      sourceId: "source:manual-a",
      proposalId: "proposal:a",
      generatorInputHash: "generator-input-hash-a",
      sourceLabel: "Manual source A",
      version: 1,
    },
    warnings: [],
    provenance: {
      applicationContextId: "application-context:abc",
      resumeVariantArtifactId: resumeArtifactId,
      resumeVariantArtifactContentHash: "resume-content-hash-a",
      evidenceGraphId: "evidence-graph:hash-a",
      evidenceGraphHash: "hash-a",
      resumeVariantPlanId: "resume-variant-plan:hash-a",
      resumeVariantPlanHash: "hash-a",
      reviewCockpitId: "review-cockpit:hash-a",
      sourceFactIds: ["candidate-fact:c", "candidate-fact:a", "candidate-fact:c"],
      allowedClaimIds: ["allowed-claim:c", "allowed-claim:a", "allowed-claim:c"],
      evidenceMatchIds: ["evidence-match:c", "evidence-match:a", "evidence-match:c"],
      demandIds: ["demand:c", "demand:a", "demand:c"],
      riskFlagIds: ["risk:c", "risk:a", "risk:c"],
      reviewItemIds: ["review:c", "review:a", "review:c"],
      version: 1,
    },
    createdAt: T,
    updatedAt: T,
    version: 1,
    ...overrides,
  };
}

function input(overrides: Partial<BuildApplicationPackageInputV1> = {}): BuildApplicationPackageInputV1 {
  const resumeArtifact = overrides.resumeVariantArtifact ?? resumeVariantArtifact();
  const coverArtifact = overrides.coverLetterArtifact ?? coverLetterArtifact({
    userId: resumeArtifact.userId,
    applicationContextId: resumeArtifact.applicationContextId,
    provenance: {
      ...coverLetterArtifact().provenance,
      applicationContextId: resumeArtifact.applicationContextId,
      resumeVariantArtifactId: resumeArtifact.id,
    },
  });
  return {
    userId: resumeArtifact.userId,
    applicationContextId: resumeArtifact.applicationContextId,
    resumeVariantArtifact: resumeArtifact,
    coverLetterArtifact: coverArtifact,
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

function withPackageWarning(applicationPackage: ApplicationPackageV1, warning: string): ApplicationPackageV1 {
  return { ...applicationPackage, warnings: [...applicationPackage.warnings, warning] };
}

describe("application package", () => {
  it("builds deterministic package with stable ID prefix and artifact references", async () => {
    const source = input();
    const first = await buildApplicationPackage(source);
    const second = await buildApplicationPackage(source);
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(`application-package:${await buildApplicationPackageHash(source)}`);
    expect(first.status).toBe("ready_for_review");
    expect(first.artifacts.map((artifact) => artifact.kind)).toEqual([
      "resume_variant_artifact",
      "cover_letter_artifact",
    ]);
    expect(first.artifacts.map((artifact) => artifact.id)).toEqual([
      source.resumeVariantArtifact.id,
      source.coverLetterArtifact.id,
    ]);
  });

  it("keeps identity hash and package ID stable when only timestamps change", async () => {
    const source = input();
    const later = input({ createdAt: T + 10_000, updatedAt: T + 20_000 });
    const hash = await buildApplicationPackageHash(source);
    await expect(buildApplicationPackageHash(later)).resolves.toBe(hash);
    await expect(buildApplicationPackage(later)).resolves.toMatchObject({
      id: `application-package:${hash}`,
      createdAt: T + 10_000,
      updatedAt: T + 20_000,
    });
  });

  it("changes identity hash when resume or cover-letter artifact IDs change", async () => {
    const hash = await buildApplicationPackageHash(input());
    await expect(buildApplicationPackageHash(input({
      resumeVariantArtifact: resumeVariantArtifact({ id: "resume-variant-artifact:changed" }),
    }))).resolves.not.toBe(hash);
    await expect(buildApplicationPackageHash(input({
      coverLetterArtifact: coverLetterArtifact({ id: "cover-letter-artifact:changed" }),
    }))).resolves.not.toBe(hash);
  });

  it("changes identity hash when resume or cover-letter artifact statuses change", async () => {
    const hash = await buildApplicationPackageHash(input());
    await expect(buildApplicationPackageHash(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "needs_review" }),
    }))).resolves.not.toBe(hash);
    await expect(buildApplicationPackageHash(input({
      coverLetterArtifact: coverLetterArtifact({ status: "needs_review" }),
    }))).resolves.not.toBe(hash);
  });

  it("builds deterministic content hash that ignores id and timestamps", async () => {
    const applicationPackage = await buildApplicationPackage(input());
    const hash = await buildApplicationPackageContentHash(applicationPackage);
    await expect(buildApplicationPackageContentHash(applicationPackage)).resolves.toBe(hash);
    await expect(buildApplicationPackageContentHash({
      ...applicationPackage,
      id: "application-package:changed",
      createdAt: T + 10_000,
      updatedAt: T + 20_000,
    })).resolves.toBe(hash);
  });

  it("changes content hash when meaningful package content changes", async () => {
    const applicationPackage = await buildApplicationPackage(input());
    const hash = await buildApplicationPackageContentHash(applicationPackage);
    await expect(buildApplicationPackageContentHash(withPackageWarning(applicationPackage, "content_changed"))).resolves.not.toBe(hash);
    await expect(buildApplicationPackageContentHash({ ...applicationPackage, status: "needs_review" })).resolves.not.toBe(hash);
  });

  it("rejects mismatched user IDs, application context IDs, and invalid timestamps", async () => {
    await expect(buildApplicationPackage(input({ userId: "other" }))).rejects.toThrow(TypeError);
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({ userId: "other" }),
    }))).rejects.toThrow(TypeError);
    await expect(buildApplicationPackage(input({ applicationContextId: "other" }))).rejects.toThrow(TypeError);
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({ applicationContextId: "other" }),
    }))).rejects.toThrow(TypeError);
    await expect(buildApplicationPackage(input({ createdAt: Number.NaN }))).rejects.toThrow(TypeError);
    await expect(buildApplicationPackage(input({ updatedAt: Number.POSITIVE_INFINITY }))).rejects.toThrow(TypeError);
  });

  it("derives blocked, needs_review, draft-compatible, and ready_for_review statuses", async () => {
    await expect(buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "blocked" }),
    }))).resolves.toMatchObject({ status: "blocked", blockedReason: "resume_variant_artifact_blocked" });
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({ status: "blocked" }),
    }))).resolves.toMatchObject({ status: "blocked", blockedReason: "cover_letter_artifact_blocked" });
    await expect(buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "needs_review" }),
    }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "draft" }),
    }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({ status: "needs_review" }),
    }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({ status: "draft" }),
    }))).resolves.toMatchObject({ status: "needs_review" });
    await expect(buildApplicationPackage(input())).resolves.toMatchObject({ status: "ready_for_review" });
  });

  it("includes all relevant warnings and deterministic blocked reason order", async () => {
    const bothBlocked = await buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "blocked" }),
      coverLetterArtifact: coverLetterArtifact({ status: "blocked" }),
    }));
    expect(bothBlocked.blockedReason).toBe("resume_variant_artifact_blocked");
    expect(bothBlocked.warnings).toEqual([
      "resume_variant_artifact_blocked",
      "cover_letter_artifact_blocked",
    ]);

    const bothDraft = await buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "draft" }),
      coverLetterArtifact: coverLetterArtifact({ status: "draft" }),
    }));
    expect(bothDraft.warnings).toEqual([
      "resume_variant_artifact_draft",
      "cover_letter_artifact_draft",
    ]);
  });

  it("includes resume, cover-letter, provenance, warning, and blocker items", async () => {
    const applicationPackage = await buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({ status: "blocked" }),
    }));
    expect(applicationPackage.items.some((item) => item.kind === "resume_variant")).toBe(true);
    expect(applicationPackage.items.some((item) => item.kind === "cover_letter")).toBe(true);
    expect(applicationPackage.items.some((item) => item.kind === "supporting_provenance")).toBe(true);
    expect(applicationPackage.items.some((item) => item.kind === "warning")).toBe(true);
    expect(applicationPackage.items.some((item) => item.kind === "blocker")).toBe(true);
    expect(applicationPackage.items[0]?.artifactId).toBe(applicationPackage.artifacts[0]?.id);
    expect(applicationPackage.items[1]?.artifactId).toBe(applicationPackage.artifacts[1]?.id);
  });

  it("unions provenance from both artifacts and exposes sorted unique collectors", async () => {
    const applicationPackage = await buildApplicationPackage(input());
    expect(applicationPackage.provenance.resumeVariantArtifactId).toBe("resume-variant-artifact:hash-a");
    expect(applicationPackage.provenance.coverLetterArtifactId).toBe("cover-letter-artifact:hash-a");
    expect(collectApplicationPackageSourceFactIds(applicationPackage)).toEqual([
      "candidate-fact:a",
      "candidate-fact:b",
      "candidate-fact:c",
    ]);
    expect(collectApplicationPackageAllowedClaimIds(applicationPackage)).toEqual([
      "allowed-claim:a",
      "allowed-claim:b",
      "allowed-claim:c",
    ]);
    expect(collectApplicationPackageEvidenceMatchIds(applicationPackage)).toEqual([
      "evidence-match:a",
      "evidence-match:b",
      "evidence-match:c",
    ]);
    expect(collectApplicationPackageDemandIds(applicationPackage)).toEqual(["demand:a", "demand:b", "demand:c"]);
    expect(collectApplicationPackageRiskFlagIds(applicationPackage)).toEqual(["risk:a", "risk:b", "risk:c"]);
    expect(collectApplicationPackageReviewItemIds(applicationPackage)).toEqual(["review:a", "review:b", "review:c"]);
  });

  it("builds ApplicationPackageContentV1", async () => {
    const applicationPackage = await buildApplicationPackage(input());
    expect(buildApplicationPackageContent(applicationPackage)).toEqual({
      kind: "application_package",
      package: applicationPackage,
      version: 1,
    });
  });

  it("does not mutate resume or cover-letter artifact inputs", async () => {
    const source = input();
    const resumeBefore = stableSerialize(source.resumeVariantArtifact);
    const coverBefore = stableSerialize(source.coverLetterArtifact);
    await buildApplicationPackage(source);
    expect(stableSerialize(source.resumeVariantArtifact)).toBe(resumeBefore);
    expect(stableSerialize(source.coverLetterArtifact)).toBe(coverBefore);
  });

  it("generated-text guard rejects package metadata but does not traverse cover-letter artifact text", async () => {
    const applicationPackage = await buildApplicationPackage(input());
    expect(() => assertApplicationPackageDoesNotContainGeneratedText(applicationPackage)).not.toThrow();
    expect(() => assertApplicationPackageDoesNotContainGeneratedText({
      ...applicationPackage,
      items: [{ ...applicationPackage.items[0]!, note: "Dear Hiring Manager" }, ...applicationPackage.items.slice(1)],
    })).toThrow(/ApplicationPackage contains generated/u);
    await expect(buildApplicationPackage(input({
      coverLetterArtifact: coverLetterArtifact({
        text: { ...coverLetterArtifact().text, value: "Dear Hiring Manager,\n\nI am excited to apply." },
      }),
    }))).resolves.toMatchObject({ status: "ready_for_review" });
  });

  it("does not contain raw cover-letter or resume text directly", async () => {
    const applicationPackage = await buildApplicationPackage(input({
      resumeVariantArtifact: resumeVariantArtifact({
        sections: [{ ...resumeVariantArtifact().sections[0]!, title: "RAW RESUME SENTINEL" }],
      }),
      coverLetterArtifact: coverLetterArtifact({
        text: { ...coverLetterArtifact().text, value: "RAW COVER LETTER SENTINEL" },
      }),
    }));
    const serialized = stableSerialize(applicationPackage);
    expect(serialized).not.toContain("RAW RESUME SENTINEL");
    expect(serialized).not.toContain("RAW COVER LETTER SENTINEL");
    expect(serialized).not.toContain("Dear Hiring Manager");
    expect(serialized).not.toContain("I am excited to apply");
  });

  it("preserves deterministic output order", async () => {
    const first = await buildApplicationPackage(input());
    const second = await buildApplicationPackage(input());
    expect(stableSerialize(first.artifacts)).toBe(stableSerialize(second.artifacts));
    expect(stableSerialize(first.items)).toBe(stableSerialize(second.items));
    expect(stableSerialize(first.warnings)).toBe(stableSerialize(second.warnings));
    expect(stableSerialize(first.provenance)).toBe(stableSerialize(second.provenance));
  });

  it("does not import generation, persistence, PDF/DOCX, LLM, or proposal code", () => {
    const moduleText = ["../buildApplicationPackage.ts", "../packageRules.ts", "../schema.ts"]
      .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
      .join("\n");
    expect(moduleText).not.toMatch(/premiumCoverLetter|ProposalForge|generatePremiumCoverLetter|Mistral|OpenAI|langchain|convex|jsPDF|jspdf|docx|fetch\(|axios/u);
  });
});
