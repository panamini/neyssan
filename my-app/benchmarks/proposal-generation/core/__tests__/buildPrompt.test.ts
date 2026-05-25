import { describe, expect, it } from "vitest";

import { buildBenchmarkPrompt } from "../buildPrompt";
import type { BenchmarkCase } from "../types";

const weakSeoCase: BenchmarkCase = {
  id: "freelance-weak-seo",
  label: "Weak freelance match: technical SEO overhaul",
  jobTitle: "Technical SEO Overhaul for Marketplace",
  jobDescription:
    "We need indexing, schema, crawl diagnostics, and internal linking improvements for a marketplace.",
  proposalType: "freelance_proposal",
  formalityLevel: "neutral",
  creativity: "low",
  personalizationMode: "explicit_only",
  personalizationRichness: "minimal",
  candidateContext: {
    name: "Jordan Lee",
    summary:
      "Frontend-focused freelance designer-developer focused on landing pages and conversion flows.",
    desiredPosition: "Freelance Product Designer",
    topSkills: ["Frontend", "Landing Pages", "Conversion Optimization"],
    recentExperience: [],
    standoutAchievements: [],
  },
  expectedGrounding: [
    "Should avoid pretending to be a technical SEO specialist",
  ],
  forbiddenClaims: [
    "Do not invent indexing, schema, or crawl diagnostics experience.",
  ],
};

describe("proposal benchmark prompt", () => {
  it("requires evidence-first recruiter mapping without changing length instructions", () => {
    const prompt = buildBenchmarkPrompt(weakSeoCase);

    expect(prompt).toContain(
      "For each main paragraph, use this order: job priority -> source-backed candidate fact -> why that fact matters for the role.",
    );
    expect(prompt).toContain(
      "Unsupported job keywords may be discussed only as client needs, gaps, or collaboration areas, not as candidate experience.",
    );
    expect(prompt).toContain(
      "Do not praise the company mission, culture, values, marketplace, or project as the main argument.",
    );
    expect(prompt).toContain("Keep it specific and persuasive without sounding bloated.");
    expect(prompt).not.toContain("character limit");
  });

  it("forces adjacent-only framing for unsupported technical SEO requirements", () => {
    const prompt = buildBenchmarkPrompt(weakSeoCase);

    expect(prompt).toContain(
      "For technical SEO marketplace work, if the candidate background only supports frontend, landing pages, or conversion optimization, switch to adjacent-only framing.",
    );
    expect(prompt).toContain(
      "Do not claim SEO-team work, crawlability optimization, schema placement, crawl budget, canonicalization, internal-linking patterns, technical SEO diagnosis, search visibility familiarity, or marketplace-style SEO implementation unless source-backed.",
    );
  });

  it("keeps no-context prompts motivation and work-surface only", () => {
    const prompt = buildBenchmarkPrompt({
      ...weakSeoCase,
      id: "application-no-context-support",
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
      proposalType: "application_message",
      personalizationRichness: "none",
      candidateContext: null,
      expectedGrounding: ["Should remain honest about missing evidence"],
      forbiddenClaims: [
        "Do not invent CRM expertise, quota ownership, or past sales achievements.",
      ],
    });

    expect(prompt).toContain(
      "No-context mode must be motivation and work-surface only.",
    );
    expect(prompt).toContain(
      "Do not mention my background, my experience, my professional background, in past experiences, I’ve worked, skills I’ve developed, I’ve taken initiative, I’ve always prioritized, my ability, my habit, or any implied prior work history.",
    );
  });
});
