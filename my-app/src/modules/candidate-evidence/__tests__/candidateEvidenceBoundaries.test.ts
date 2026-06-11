import { describe, expect, it } from "vitest";
import { buildCandidateFactHash } from "../fingerprints";
import {
  assertFactUsesSourceMaterial,
  normalizeSourcePath,
  validateSourcePath,
} from "../sourcePaths";

const BASE_FACT_HASH_INPUT = {
  userId: "user_123",
  sourceDocumentId: "candidate-source-document:source_hash_a",
  sourcePath: "document.skills[1].name",
  sourceQuote: "TypeScript",
  factType: "skill" as const,
  value: { name: "TypeScript" },
  normalizedText: "TypeScript",
} as const;

describe("candidate-evidence source truth boundaries", () => {
  it("normalizes bracket whitespace before fact hashing", async () => {
    const normalizedSourcePath = normalizeSourcePath(" document.skills[ 01 ].name ");

    expect(normalizedSourcePath).toBe("document.skills[1].name");
    await expect(
      buildCandidateFactHash({
        ...BASE_FACT_HASH_INPUT,
        sourcePath: " document.skills[ 01 ].name ",
      }),
    ).resolves.toBe(await buildCandidateFactHash(BASE_FACT_HASH_INPUT));
  });

  it("rejects nested generated artifact-like fact values", () => {
    expect(() =>
      assertFactUsesSourceMaterial({
        sourcePath: "document.experience[0].responsibilityBullets[0]",
        value: {
          source: {
            generatedText: "World-class TypeScript expert who transforms businesses.",
          },
        },
      }),
    ).toThrow(/generated artifact field/);

    expect(() =>
      assertFactUsesSourceMaterial({
        sourcePath: "document.projects[0].summary",
        value: {
          source: [
            {
              marketingCopy: "Results-driven builder with a proven track record.",
            },
          ],
        },
      }),
    ).toThrow(/generated artifact field/);
  });

  it("rejects sparse array fact values during hashing", async () => {
    const sparseValue: unknown[] = [];
    sparseValue[1] = "TypeScript";

    await expect(
      buildCandidateFactHash({
        ...BASE_FACT_HASH_INPUT,
        sourcePath: "document.skills",
        value: sparseValue,
      }),
    ).rejects.toThrow(/sparse arrays/);
  });

  it("keeps generated application artifacts out of valid source paths", () => {
    expect(validateSourcePath("document.skills[0].name")).toBe(true);
    expect(validateSourcePath("manual.portfolio[0].summary")).toBe(true);
    expect(validateSourcePath("application.artifacts[0].content")).toBe(false);
    expect(validateSourcePath("document.generatedArtifact.body")).toBe(false);
    expect(validateSourcePath("document.marketingCopy.summary")).toBe(false);
  });
});
