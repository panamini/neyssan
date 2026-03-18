import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";
import { buildTypedSectionsFromNormalized } from "../../../../src/utils/cv/mapping-utils";

describe("canonicalizeParserResult", () => {
  const context = {
    rawText: "Sample resume text",
    mode: "text",
    parserUrl: "https://example.test/parse-cv",
  };

  it("synthesizes canonical arrays from raw sections when normalized data is absent", () => {
    const parserResult = {
      diagnostics: { fallback_used: true },
      raw_sections: [
        { label: "EXPERIENCE", content: "Foo Corp — Software Engineer" },
        { label: "EDUCATION", content: "Bar University — BSc Computer Science" },
        { label: "SKILLS", content: "Python, Typescript" },
        { label: "LANGUAGES", content: "English; French" },
        { label: "ACHIEVEMENTS", content: "Employee of the Month" },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized ?? {};

    expect(Array.isArray(normalized.experience)).toBe(true);
    expect(normalized.experience.length).toBeGreaterThan(0);
    expect(normalized.experience[0]?.company).toContain("Foo Corp");

    expect(Array.isArray(normalized.education)).toBe(true);
    expect(normalized.education.length).toBeGreaterThan(0);
    expect(normalized.education[0]?.institution).toContain("Bar University");

    expect(Array.isArray(normalized.skills)).toBe(true);
    expect(normalized.skills.map((item: any) => item?.name)).toContain("Python");

    expect(Array.isArray(normalized.languages)).toBe(true);
    expect(normalized.languages.map((item: any) => item?.name)).toContain("English");

    expect(Array.isArray(normalized.achievements)).toBe(true);
    expect(normalized.achievements[0]?.text).toContain("Employee of the Month");

    expect(Array.isArray(normalized.rawSections)).toBe(true);
    expect(normalized.rawSections.length).toBeGreaterThan(0);
  });

  it("preserves existing normalized arrays and metadata", () => {
    const parserResult = {
      diagnostics: { fallback_used: false },
      normalized: {
        experience: [{ id: "exp-1", company: "ACME", position: "Manager" }],
        education: [{ id: "edu-1", institution: "Example College", degree: "MBA" }],
        skills: [{ id: "skill-1", name: "Leadership" }],
        languages: [{ id: "lang-1", name: "English", level: "Native" }],
        achievements: [{ id: "ach-1", text: "Closed $1M deal" }],
        rawSections: [{ label: "EXPERIENCE", content: "ACME" }],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized ?? {};

    expect(normalized.experience).toHaveLength(1);
    expect(normalized.experience[0]?.company).toBe("ACME");

    expect(normalized.education).toHaveLength(1);
    expect(normalized.education[0]?.degree).toBe("MBA");

    expect(normalized.skills).toHaveLength(1);
    expect(normalized.skills[0]?.name).toBe("Leadership");

    expect(normalized.languages).toHaveLength(1);
    expect(normalized.languages[0]?.name).toBe("English");

    expect(normalized.achievements).toHaveLength(1);
    expect(normalized.achievements[0]?.text).toBe("Closed $1M deal");
  });

  it("splits raw experience sections into discrete entries", () => {
    const parserResult = {
      raw_sections: [
        {
          label: "EXPERIENCE",
          content: "Engineer Jan 2020 – Apr 2021\nACME Corp, Seattle, WA\n- Automated deployments\nScaled tooling",
        },
        {
          label: "EXPERIENCE",
          content: "Analyst May 2021 – Present\nExample Inc, New York, NY\n- Led reporting modernization",
        },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const experience = canonical.normalized?.experience ?? [];
    expect(experience.length).toBe(2);
    expect((experience[0]?.achievements || []).join(" ")).toContain("Automated deployments");
    expect(experience[1]?.isCurrent).toBe(true);
    expect(canonical.diagnostics?.experience_fallback_count).toBe(2);
  });

  it("normalizes skills text and deduplicates case-insensitively", () => {
    const parserResult = {
      normalized: {
        skills: { text: "C, C++, Go, go, R, JavaScript" },
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const skills = canonical.normalized?.skills ?? [];
    const names = skills.map((item: any) => item.name);
    expect(names).toContain("R");
    expect(names).toContain("JavaScript");
    expect(names.filter((name: string) => name.toLowerCase() === "go").length).toBe(1);
  });

  it("strips proficiency annotations from skills and languages", () => {
    const parserResult = {
      normalized: {
        skills: [
          { name: "Python (Advanced)" },
          { name: "Project Management - Expert" },
          { name: "Data Analysis" },
        ],
        languages: [
          { name: "French (C1)" },
          { name: "Spanish - Intermediate" },
        ],
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const skillNames = (canonical.normalized?.skills ?? []).map((item: any) => item.name);
    expect(skillNames).toContain("Python");
    expect(skillNames).toContain("Project Management");
    expect(skillNames).not.toContain(expect.stringMatching(/Advanced|Expert/i));

    const languages = canonical.normalized?.languages ?? [];
    const languageNames = languages.map((item: any) => item.name);
    expect(languageNames).toEqual(expect.arrayContaining(["French", "Spanish"]));
    expect(languages.find((entry: any) => entry.name === "French")?.level).toBeDefined();
    expect(languages.find((entry: any) => entry.name === "Spanish")?.level).toMatch(/Intermediate/i);
  });

  it("extracts responsibility bullets from experience summaries", () => {
    const parserResult = {
      normalized: {
        experience: [
          {
            id: "exp-1",
            company: "Example Corp",
            position: "Engineer",
            responsibilities: "• Built API integrations\n• Coordinated release train",
          },
        ],
      },
    };
    const canonical = canonicalizeParserResult(parserResult, context);
    const entry = canonical.normalized?.experience?.[0];
    expect(entry).toBeTruthy();
    expect(Array.isArray(entry?.responsibilityBullets)).toBe(true);
    expect(entry?.responsibilityBullets).toEqual([
      "Built API integrations",
      "Coordinated release train",
    ]);
    expect(typeof entry?.responsibilities).toBe("string");
    expect(String(entry?.responsibilities)).toContain("Built API integrations");
  });

  it("preserves fuller profile text in summary and keeps first sentence as fallback metadata", () => {
    const parserResult = {
      raw_sections: [
        {
          label: "PROFILE",
          content:
            "Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets. Sharp observation skills and constant awareness of immediate surroundings. Completing a bachelor's in criminal justice and qualified as a CPO (Certified Protection Officer).",
        },
      ],
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Sharp observation skills and constant awareness of immediate surroundings.");
    expect(normalized.summary?.text).toContain("qualified as a CPO");
    expect(normalized.summaryFirstSentence).toBe(
      "Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets.",
    );

    const sections = buildTypedSectionsFromNormalized(normalized);
    const summarySection = sections.find((section) => section.type === "summary");
    const summaryDoc = (summarySection?.structuredContent?.[0] as any)?.summary;
    const summaryText = summaryDoc?.content?.[0]?.content?.map((node: any) => node?.text ?? "").join("");

    expect(summaryText).toContain("Sharp observation skills and constant awareness of immediate surroundings.");
    expect(summaryText).toContain("qualified as a CPO");
  });

  it("promotes fuller raw summary when normalized summary is only the first sentence", () => {
    const parserResult = {
      normalized: {
        summary: {
          text: "Safety conscious attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
          confidence: 0.5,
        },
        summaryFirstSentence:
          "Safety conscious attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
        rawText:
          "PROFILE\nSafety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors. Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature. Presently finishing a bachelor’s in criminal justice and qualified as a CPO (Certified Protection Guard).",
        rawSections: [
          {
            label: "SUMMARY",
            content:
              "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors. Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature. Presently finishing a bachelor’s in criminal justice and qualified as a CPO (Certified Protection Guard).",
          },
        ],
      },
    };

    const canonical = canonicalizeParserResult(parserResult, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature.");
    expect(normalized.summary?.text).toContain("qualified as a CPO");
    expect(normalized.summaryFirstSentence).toBe(
      "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors.",
    );

    const sections = buildTypedSectionsFromNormalized(normalized);
    const summarySection = sections.find((section) => section.type === "summary");
    const summaryDoc = (summarySection?.structuredContent?.[0] as any)?.summary;
    const summaryText = summaryDoc?.content?.[0]?.content?.map((node: any) => node?.text ?? "").join("");

    expect(summaryText).toContain("Proficient at observing surroundings and immediate settings for possible threats of nonhuman and human nature.");
    expect(summaryText).toContain("qualified as a CPO");
  });

  it("canonically maps Robert Cooper fixture", () => {
    const fixturePath = path.join(__dirname, "fixtures", "robert_cooper.json");
    const fixtureRaw = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
    const canonical = canonicalizeParserResult(fixtureRaw, context);
    const normalized = canonical.normalized as any;

    expect(normalized.summary?.text).toContain("Safety conscious, attentive Security Guard");
    expect(normalized.summary?.text).not.toMatch(/Place of birth/i);
    expect(normalized.summaryFirstSentence).toBe("Safety conscious, attentive Security Guard with 5+ years protecting high-profile assets.");
    expect(normalized.contact?.locationBirth).toBe("London, United Kingdom");

    const experience = Array.isArray(normalized.experience) ? normalized.experience : [];
    expect(experience.length).toBeGreaterThanOrEqual(2);
    expect(experience[0]?.company).toBe("SecureIt Ltd");
    expect(experience[0]?.startDate).toBe("2021-01-01");
    expect(experience[0]?.endDate).toBe("2022-04-01");
    expect(experience[1]?.company).toContain("RetailCo");

    const education = Array.isArray(normalized.education) ? normalized.education : [];
    expect(education.length).toBeGreaterThanOrEqual(2);
    const educationText = education.map((e: any) => `${e.degree} ${e.institution}`).join(" ");
    expect(educationText).not.toMatch(/English|Spanish|Italian/i);

    const languages = Array.isArray(normalized.languages) ? normalized.languages : [];
    const languageNames = languages.map((entry: any) => entry.name.toLowerCase());
    expect(languageNames).toEqual(expect.arrayContaining(["english", "spanish", "italian"]));

    const skills = Array.isArray(normalized.skills) ? normalized.skills : [];
    expect(skills.map((s: any) => s.name)).toEqual(expect.arrayContaining(["Investigation skills"]));

    const achievements = Array.isArray(normalized.achievements) ? normalized.achievements : [];
    expect(achievements.length).toBe(1);
  });
});
