import { describe, expect, it, vi } from "vitest";

import taxonomy from "../../taxonomy/skills.json";
import {
  canonicalSkills,
  skillAliases,
  skillsTaxonomyVersion,
  skillStoplist,
} from "../skillsCanonical";

describe("skills taxonomy integrity", () => {
  it("exposes canonical skills and alias mappings from JSON", () => {
    expect(skillsTaxonomyVersion).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(canonicalSkills.has("machine learning")).toBe(true);
    expect(canonicalSkills.has("javascript")).toBe(true);
    expect(skillAliases.js).toBe("javascript");
    expect(skillStoplist.has("resume")).toBe(true);
    expect(skillStoplist.has("project management")).toBe(false);
    const escoAlias = Object.keys(taxonomy.aliases).find((alias) =>
      alias.includes("manage staff of music")
    );
    expect(escoAlias).toBeDefined();
    if (escoAlias) {
      expect(skillAliases[escoAlias]).toBe("manage musical staff");
    }
  });
});

describe("skillUtils integration with taxonomy", () => {
  it("normalizes aliases and keeps canonical skills", async () => {
    const embedModule = await import("../../embeddings/embedClient");
    vi.spyOn(embedModule, "embedText").mockImplementation(async (texts: string[]) => {
      return texts.map(() => Array(4).fill(1));
    });
    vi.spyOn(embedModule, "cosineSimilarity").mockImplementation(() => 1);

    const { injectSkillEntities } = await import("../skillUtils");
    const sections = [
      {
        title: "Skills",
        fieldKey: "skills",
        content: "Hard Skills: python",
        confidence: 0.1,
      },
    ];
    const entities = [
      { text: "JS", label: "SKILL", start: 0, end: 2 },
      { text: "manage staff of music", label: "SKILL", start: 10, end: 34 },
      { text: "Project Management", label: "SKILL", start: 40, end: 58 },
    ];

    const updated = await injectSkillEntities(sections, entities as any);
    expect(updated).toHaveLength(1);
    const content = updated[0]?.content ?? "";
    expect(content.toLowerCase()).toContain("javascript");
    expect(content.toLowerCase()).toContain("manage musical staff");
    expect(content.toLowerCase()).toMatch(/project (management|commissioning)/);
  });
});
