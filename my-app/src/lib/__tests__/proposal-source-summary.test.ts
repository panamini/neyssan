import { describe, expect, it } from "vitest";

import { buildProposalSourceSummary } from "../proposal-source-summary";

describe("buildProposalSourceSummary", () => {
  it("extracts a structured summary from raw proposal source text", () => {
    const summary = buildProposalSourceSummary({
      jobTitle: "Operations Associate",
      jobDescription:
        "Join Northstar Health in Paris, France to coordinate stakeholder communication, keep recurring requests on track, and maintain precise documentation across fast-paced operations. You will partner with cross-functional teams, own scheduling follow-through, and support process quality.",
      voicePreset: "signature",
    });

    expect(summary.role).toBe("Operations Associate");
    expect(summary.company).toBe("Northstar Health");
    expect(summary.location).toBe("Paris, France");
    expect(summary.city).toBe("Paris");
    expect(summary.responsibilities.length).toBeGreaterThan(0);
    expect(summary.keywords.some((keyword) => /coord|communic|quality/i.test(keyword))).toBe(true);
    expect(summary.toneCues).toContain("Natural");
  });

  it("extracts explicit employer contact metadata without replacing the raw brief", () => {
    const summary = buildProposalSourceSummary({
      jobTitle: "Executive Assistant",
      jobDescription: `
        Company: Johnson & Johnson
        City: Paris
        Address: 7 Rue de la Paix, Paris
        Contact email: hiring@jnj.com
        Phone: +33 1 44 55 66 77

        Support procurement operations, coordinate vendor follow-through, and keep executive communications on track.
      `,
      voicePreset: "expert",
    });

    expect(summary.company).toBe("Johnson & Johnson");
    expect(summary.city).toBe("Paris");
    expect(summary.address).toBe("7 Rue de la Paix, Paris");
    expect(summary.email).toBe("hiring@jnj.com");
    expect(summary.phone).toBe("+33 1 44 55 66 77");
  });

  it("does not misclassify body prose as a location", () => {
    const summary = buildProposalSourceSummary({
      jobTitle: "Operations Associate",
      jobDescription:
        "Our strength in healthcare innovation empowers us to build a world where complex diseases are prevented, treated, and cured. You will support recurring processes and coordinate communication across stakeholders.",
      voicePreset: "signature",
    });

    expect(summary.location).toBeNull();
  });

  it("does not infer phone numbers from arbitrary numeric body content", () => {
    const summary = buildProposalSourceSummary({
      jobTitle: "Operations Associate",
      jobDescription:
        "This role supports 12 regional teams across 3 markets and coordinates 2026 launch planning with 450 partner requests.",
      voicePreset: "signature",
    });

    expect(summary.phone).toBeNull();
  });

  it("filters noisy title and prompt words out of keywords", () => {
    const summary = buildProposalSourceSummary({
      jobTitle: "Video Content Creator / Instagram",
      jobDescription:
        "Job description: H15DEN is dedicated to helping independent food and drink establishments gain visibility and thrive. This role focuses on campaign planning, editing, community storytelling, and short-form production for local audiences.",
      voicePreset: "signature",
    });

    expect(summary.keywords).not.toContain("The");
    expect(summary.keywords).not.toContain("For");
    expect(summary.keywords).not.toContain("Description");
  });
});
