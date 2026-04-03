import { describe, expect, it } from "vitest";
import {
  extractExperiences,
  extractName,
  extractSummary,
} from "../browser-cv-parser";

describe("browser cv parser heuristics", () => {
  it("extracts a clean name from the header instead of the resume label", () => {
    const text = [
      "Resume",
      "Jane Doe",
      "jane@example.com",
      "Senior Product Designer",
    ].join("\n");

    expect(extractName(text, "jane@example.com")).toBe("Jane Doe");
  });

  it("prefers the dedicated summary block over later section text", () => {
    const text = [
      "JANE DOE",
      "jane@example.com",
      "",
      "Professional Summary",
      "Product designer with 8 years of experience shaping onboarding, hiring tools, and design systems for SaaS teams.",
      "",
      "Experience",
      "North Studio",
      "Senior Product Designer",
    ].join("\n");

    expect(extractSummary(text)).toBe(
      "Product designer with 8 years of experience shaping onboarding, hiring tools, and design systems for SaaS teams.",
    );
  });

  it("swaps inverted experience fields and removes duplicated description text", () => {
    const text = [
      "Acme Corp",
      "Senior Security Guard",
      "Jan 2020 - Present",
      "Patrolled assigned areas and reported incidents.",
      "Patrolled assigned areas and reported incidents.",
    ].join("\n");

    const experiences = extractExperiences(text);

    expect(experiences[0]).toMatchObject({
      company: "Acme Corp",
      title: "Senior Security Guard",
      startDate: "Jan 2020",
      endDate: "Present",
      description: "Patrolled assigned areas and reported incidents.",
    });
  });
});
