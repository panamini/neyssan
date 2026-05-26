import { describe, expect, it } from "vitest";

import { analyzeBenchmarkOutputQuality } from "../outputQualityGates";
import type { BenchmarkCase } from "../types";

const frontendCase: BenchmarkCase = {
  id: "employment-strong-frontend",
  label: "Strong employment match: senior frontend engineer",
  jobTitle: "Senior Frontend Engineer",
  jobDescription:
    "We are hiring a Senior Frontend Engineer to lead React and TypeScript development for a customer-facing SaaS platform. The role includes building reusable UI systems, improving performance, collaborating with product and design, and mentoring junior engineers. Experience with analytics instrumentation and experimentation is a plus.",
  proposalType: "cover_letter",
  formalityLevel: "neutral",
  creativity: "medium",
  personalizationMode: "default",
  personalizationRichness: "rich",
  candidateContext: {
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
  expectedGrounding: [
    "Design system migration leadership",
    "React and TypeScript experience",
    "Performance optimization with a 28 percent improvement",
    "Cross-functional work with design and product",
  ],
  forbiddenClaims: [
    "Do not claim staff-level leadership or people management beyond mentoring.",
    "Do not invent backend ownership or mobile development.",
  ],
  notes: "Should feel confident and concrete without overstating scope.",
};

describe("benchmark output quality gates", () => {
  it("allows source-backed numeric claims from the benchmark facts", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "At BrightLayer, I led a design system migration used across 4 product squads and reduced page load time by 28%. I also delivered an 11-procentowy improvement in signup conversion.",
      expectedLanguage: "English",
    });

    expect(failures).toEqual([]);
  });

  it("flags source-backed metrics attributed to the wrong company", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "At BrightLayer, I improved signup conversion by 11 percent through iterative UI experiments.",
      expectedLanguage: "English",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "metric_company_attribution_mismatch",
          evidence: "11 percent at BrightLayer",
        }),
      ]),
    );
  });

  it("flags unsupported numeric drift in multilingual output", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "В BrightLayer я возглавлял миграцию дизайн-системы, что позволило сократить время на разработку новых фич на 30%.",
      expectedLanguage: "Russian",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_numeric_claim",
          evidence: "30 percent",
        }),
      ]),
    );
  });

  it("flags unsupported word-duration drift in localized output", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "Przez ostatnie trzy lata specjalizowalem sie w budowaniu skalowalnych interfejsow w React i TypeScript.",
      expectedLanguage: "Polish",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_duration_claim",
          evidence: "3 duration",
        }),
      ]),
    );
  });

  it("flags unsupported vague duration drift in localized output", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "Als Senior Frontend Engineer habe ich in den letzten Jahren Design-Systeme fuer produktnahe Teams aufgebaut. أعمل منذ سنوات على تطوير واجهات المستخدم باستخدام React وTypeScript.",
      expectedLanguage: "Arabic",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_duration_claim",
          evidence: "vague duration",
        }),
      ]),
    );
  });

  it("flags deterministic English fallback copy in non-English output", () => {
    const failures = analyzeBenchmarkOutputQuality({
      benchmarkCase: frontendCase,
      outputText:
        "Madame, Monsieur,\n\nMon experience correspond au poste.\n\nSincerely,\nAlex Martin",
      expectedLanguage: "French",
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "english_fallback_leak",
          evidence: "Sincerely",
        }),
      ]),
    );
  });
});
