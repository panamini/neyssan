import { describe, expect, it } from "vitest";

import type { RunManifest } from "../../../benchmarks/proposal-generation/core/exporters";
import {
  benchmarkCaseToQualityFixture,
  buildBlindRevealMap,
  scoreBenchmarkManifest,
} from "../proposal-quality-adapter";

const benchmarkCase = {
  id: "employment-strong-frontend",
  label: "Strong frontend match",
  jobTitle: "Senior Frontend Engineer",
  jobDescription:
    "Lead React and TypeScript development, improve performance, and mentor junior engineers.",
  proposalType: "cover_letter",
  formalityLevel: "neutral",
  creativity: "medium",
  personalizationMode: "default",
  personalizationRichness: "rich",
  candidateContext: {
    name: "Alex Martin",
    summary: "Frontend engineer focused on React and TypeScript.",
    desiredPosition: "Senior Frontend Engineer",
    topSkills: ["React", "TypeScript"],
    recentExperience: [
      {
        company: "BrightLayer",
        position: "Frontend Engineer",
        highlights: [
          "Led a design system migration used across 4 product squads.",
          "Reduced page load time by 28 percent through bundle and rendering optimizations.",
        ],
      },
    ],
    standoutAchievements: [
      "Improved signup conversion by 11 percent after iterative UI experiments.",
    ],
  },
  expectedGrounding: [
    "Design system migration leadership",
    "React and TypeScript experience",
    "Performance optimization with a 28 percent improvement",
  ],
  forbiddenClaims: ["Do not invent backend ownership or mobile development."],
} as const;

function makeManifest(): RunManifest {
  return {
    runId: "test-run",
    createdAt: "2026-05-25T00:00:00.000Z",
    datasetPath: "benchmarks/proposal-generation/dataset/proposal-benchmark.dataset.json",
    models: ["mistral-small-latest", "gpt-4o-mini"],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500,
    },
    notes: [],
    records: [
      {
        benchmarkCase,
        prompt: "prompt",
        results: {
          "mistral-small-latest": {
            status: "ok",
            model: "mistral-small-latest",
            provider: "mistral",
            outputText:
              "Dear Hiring Manager,\n\nLed a design system migration used across 4 product squads.\n\nReduced page load time by 28 percent through bundle and rendering optimizations.\n\nBest regards,\nAlex Martin",
            latencyMs: 1200,
            usage: {
              inputTokens: 100,
              outputTokens: 100,
              totalTokens: 200,
            },
            cost: {
              inputCostUsd: 0.1,
              outputCostUsd: 0.2,
              totalCostUsd: 0.3,
            },
            rawResponsePath: "/tmp/raw.json",
          },
          "gpt-4o-mini": {
            status: "ok",
            model: "gpt-4o-mini",
            provider: "openai",
            outputText:
              "Dear Hiring Manager,\n\nI own backend architecture and mobile development, and I share your values.\n\nSincerely,\nAlex Martin",
            latencyMs: 2000,
            usage: {
              inputTokens: 100,
              outputTokens: 100,
              totalTokens: 200,
            },
            cost: {
              inputCostUsd: 0.1,
              outputCostUsd: 0.2,
              totalCostUsd: 0.3,
            },
            rawResponsePath: "/tmp/raw-openai.json",
          },
        },
      },
    ],
  };
}

describe("proposal quality benchmark adapter", () => {
  it("converts old benchmark cases to selector-ready quality fixtures", () => {
    const fixture = benchmarkCaseToQualityFixture({
      benchmarkCase,
      outputText: "Dear Hiring Manager,\n\nLed a design system migration used across 4 product squads.\n\nSincerely,\nAlex Martin",
    });

    expect(fixture.id).toBe("employment-strong-frontend");
    expect(fixture.contextMode).toBe("rich");
    expect(fixture.candidateFacts.map((fact) => fact.text)).toEqual(
      expect.arrayContaining([
        "Led a design system migration used across 4 product squads.",
        "Reduced page load time by 28 percent through bundle and rendering optimizations.",
        "React",
      ]),
    );
    expect(fixture.expectedBlockedKeywords).toEqual(
      expect.arrayContaining(["backend ownership", "mobile development"]),
    );
    expect(fixture.letters.baseline).not.toContain("Dear Hiring Manager");
    expect(fixture.letters.baseline).not.toContain("Alex Martin");
  });

  it("builds a separate blind reveal map from model metadata", () => {
    const revealMap = buildBlindRevealMap(makeManifest() as any);

    expect(Object.keys(revealMap)).toHaveLength(2);
    expect(Object.values(revealMap)).toEqual(
      expect.arrayContaining([
        { model: "mistral-small-latest", provider: "mistral" },
        { model: "gpt-4o-mini", provider: "openai" },
      ]),
    );
  });

  it("scores saved benchmark outputs with harness-compatible metrics", () => {
    const { report, revealMap } = scoreBenchmarkManifest({
      manifest: makeManifest() as any,
      sourceResultsPath: "/tmp/results.json",
    });

    expect(report.scores).toHaveLength(2);
    expect(Object.keys(revealMap)).toHaveLength(2);
    expect(report.averagesByBlindLabel).toHaveLength(2);
    expect(report.manualReviewShortlist.length).toBeGreaterThan(0);
    expect(
      report.staticHarnessNegativeControlSummary.every((row) => row.passed),
    ).toBe(true);

    const badScore = report.scores.find(
      (score) => score.status === "ok" && score.bannedCompanyPraise > 0,
    );
    expect(badScore).toEqual(
      expect.objectContaining({
        status: "ok",
        inventedClaimFree: false,
      }),
    );
    expect(report.manualReviewShortlist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fixtureId: "employment-strong-frontend",
          reasons: expect.arrayContaining(["unsupported claims detected"]),
        }),
      ]),
    );
  });

  it("detects visible strong frontend facts as satisfying critical requirements", () => {
    const { report } = scoreBenchmarkManifest({
      manifest: {
        ...makeManifest(),
        records: [
          {
            benchmarkCase,
            prompt: "prompt",
            results: {
              "mistral-small-latest": {
                status: "ok",
                model: "mistral-small-latest",
                provider: "mistral",
                outputText:
                  "Dear Hiring Manager,\n\nAt BrightLayer, I led a design system migration used across 4 product squads. My React and TypeScript work is relevant to reusable UI systems.\n\nI reduced page load time by 28 percent through bundle and rendering optimizations, which matters for customer-facing performance.\n\nI also partnered directly with design and product on customer-facing workflow improvements.\n\nBest regards,\nAlex Martin",
                latencyMs: 1200,
                usage: {
                  inputTokens: 100,
                  outputTokens: 100,
                  totalTokens: 200,
                },
                cost: {
                  inputCostUsd: 0.1,
                  outputCostUsd: 0.2,
                  totalCostUsd: 0.3,
                },
                rawResponsePath: "/tmp/raw.json",
              },
            },
          },
        ],
        models: ["mistral-small-latest"],
      } as any,
      sourceResultsPath: "/tmp/results.json",
      blind: false,
    });

    const score = report.scores.find(
      (entry) => entry.status === "ok" && entry.fixtureId === "employment-strong-frontend",
    );
    expect(score).toEqual(
      expect.objectContaining({
        missingCriticalRequirements: [],
        supportedKeywordCoverage: 1,
      }),
    );
  });

  it("flags no-context generic invented experience even without old exact phrases", () => {
    const noContextCase = {
      ...benchmarkCase,
      id: "application-no-context-support",
      label: "No context application",
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
      proposalType: "application_message",
      personalizationMode: "explicit_only",
      personalizationRichness: "none",
      candidateContext: null,
      expectedGrounding: ["Should remain honest about missing evidence"],
      forbiddenClaims: [
        "Do not invent CRM expertise, quota ownership, or past sales achievements.",
      ],
    } as const;

    const { report } = scoreBenchmarkManifest({
      manifest: {
        ...makeManifest(),
        models: ["mistral-small-latest"],
        records: [
          {
            benchmarkCase: noContextCase,
            prompt: "prompt",
            results: {
              "mistral-small-latest": {
                status: "ok",
                model: "mistral-small-latest",
                provider: "mistral",
                outputText:
                  "I’m interested in the Sales Assistant role. These are skills I’ve developed through administrative and customer-facing tasks, and I’ve worked in roles where tracking details was key.",
                latencyMs: 1200,
                usage: {
                  inputTokens: 100,
                  outputTokens: 100,
                  totalTokens: 200,
                },
                cost: {
                  inputCostUsd: 0.1,
                  outputCostUsd: 0.2,
                  totalCostUsd: 0.3,
                },
                rawResponsePath: "/tmp/raw.json",
              },
            },
          },
        ],
      } as any,
      sourceResultsPath: "/tmp/results.json",
      blind: false,
    });

    const score = report.scores.find(
      (entry) => entry.status === "ok" && entry.fixtureId === "application-no-context-support",
    );
    expect(score).toEqual(
      expect.objectContaining({
        noContextViolation: true,
        inventedClaimFree: false,
      }),
    );
  });
});
