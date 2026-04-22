import { describe, expect, it } from "vitest";

import {
  buildCanonicalProfileSeed,
  deriveCanonicalProfileKeywords,
  resolveCanonicalProfileKeywordsForWrite,
} from "../userProfiles";

describe("userProfiles canonicalization", () => {
  it("derives deterministic keywords in documented source order", () => {
    const inputs = {
      summary:
        "Operations coordination for Airtable migrations and reporting.",
      skills: ["Vendor Management", "Project Planning"],
      experience: [
        {
          company: "Acme",
          title: "Logistics Lead",
          description: "Handled escalation triage and weekly forecasting.",
        },
      ],
      rawText: "Fallback raw text mentions planning, reporting, and onboarding.",
    };

    expect(deriveCanonicalProfileKeywords(inputs)).toEqual([
      "operations",
      "coordination",
      "airtable",
      "migrations",
      "reporting",
      "vendor management",
      "project planning",
      "logistics",
      "lead",
      "handled",
      "escalation",
      "triage",
      "weekly",
      "forecasting",
      "fallback",
      "raw",
      "text",
      "mentions",
      "planning",
      "onboarding",
    ]);
    expect(deriveCanonicalProfileKeywords(inputs)).toEqual(
      deriveCanonicalProfileKeywords(inputs),
    );
  });

  it("caps derived keywords at a fixed deterministic length", () => {
    const summary = Array.from({ length: 40 }, (_, index) => `token${index + 1}`).join(" ");

    const keywords = deriveCanonicalProfileKeywords({ summary });

    expect(keywords).toHaveLength(32);
    expect(keywords[0]).toBe("token1");
    expect(keywords[31]).toBe("token32");
  });

  it("respects explicit keyword writes, including clearing the field", () => {
    expect(
      resolveCanonicalProfileKeywordsForWrite({
        nextKeywords: ["  Project Management  ", "SQL", "sql"],
        summary: "Ignored for explicit writes",
      }),
    ).toEqual(["project management", "sql"]);

    expect(
      resolveCanonicalProfileKeywordsForWrite({
        nextKeywords: [],
        summary: "Should not regenerate after an explicit clear",
      }),
    ).toEqual([]);
  });

  it("builds a fill-only canonical seed from the active CV snapshot", () => {
    const seed = buildCanonicalProfileSeed({
      existingProfile: {
        email: "ada@example.com",
        name: "Ada",
        skills: ["SQL"],
        keywords: ["manual-priority"],
      },
      activeCvSnapshot: {
        title: "Resume",
        personalizationContext: {
          name: "Override Me",
          summary: "Operations leader for global programs",
          topSkills: ["Airtable", "Notion"],
          recentExperience: [
            {
              company: "Orbit",
              position: "Program Manager",
              highlights: ["Ran launches", "Managed escalations"],
            },
          ],
        },
      },
      fallbackEmail: "fallback@example.com",
      fallbackName: "Fallback",
    });

    expect(seed.email).toBe("ada@example.com");
    expect(seed.name).toBe("Ada");
    expect(seed.summary).toBe("Operations leader for global programs");
    expect(seed.skills).toEqual(["SQL"]);
    expect(seed.keywords).toEqual(["manual-priority"]);
    expect(seed.experience).toEqual([
      {
        company: "Orbit",
        title: "Program Manager",
        description: "Ran launches • Managed escalations",
      },
    ]);
  });

  it("derives canonical keywords from the snapshot when the profile has none", () => {
    const seed = buildCanonicalProfileSeed({
      existingProfile: {
        email: "sam@example.com",
      },
      activeCvSnapshot: {
        title: "Resume",
        personalizationContext: {
          summary: "Customer support operations across escalations",
          topSkills: ["Zendesk", "QA"],
        },
      },
    });

    expect(seed.skills).toEqual(["Zendesk", "QA"]);
    expect(seed.keywords).toEqual([
      "customer",
      "operations",
      "escalations",
      "zendesk",
      "qa",
    ]);
  });
});
