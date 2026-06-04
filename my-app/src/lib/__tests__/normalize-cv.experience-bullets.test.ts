import { describe, expect, it } from "vitest";

import { normalizeAndValidateCvDocument } from "../normalize-cv";
import { buildTypedSectionsFromNormalized } from "../../utils/cv/mapping-utils";

describe("experience responsibility bullet preservation", () => {
  it("keeps explicit responsibility bullets through typed section mapping and document normalization", () => {
    const normalized = {
      experience: [
        {
          id: "exp-adt",
          company: "ADT Security",
          position: "Security Guard",
          location: "Port Washington",
          startDate: "2021-01-01",
          endDate: "2022-04-01",
          responsibilities:
            "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures Maintaining environments by monitoring the grounds and equipment controls Logging into security headquarters on the hour during the day and every 2 hours with the night shift, notifying control of all in order statuses",
          responsibilityBullets: [
            "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures",
            "Maintaining environments by monitoring the grounds and equipment controls",
            "Logging into security headquarters on the hour during the day and every 2 hours with the night shift, notifying control of all in order statuses",
          ],
        },
      ],
    };

    const sections = buildTypedSectionsFromNormalized(normalized as any);
    const mappedExperience = sections.find((section) => section.type === "experience");
    expect(mappedExperience).toBeTruthy();
    expect(Array.isArray(mappedExperience?.structuredContent)).toBe(true);
    expect((mappedExperience?.structuredContent as any[])?.[0]?.responsibilityBullets).toEqual([
      "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures",
      "Maintaining environments by monitoring the grounds and equipment controls",
      "Logging into security headquarters on the hour during the day and every 2 hours with the night shift, notifying control of all in order statuses",
    ]);

    const result = normalizeAndValidateCvDocument({
      id: "cv_test",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find((section) => section.type === "experience");
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];
    expect(normalizedItem?.responsibilityBullets).toEqual([
      "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures",
      "Maintaining environments by monitoring the grounds and equipment controls",
      "Logging into security headquarters on the hour during the day and every 2 hours with the night shift, notifying control of all in order statuses",
    ]);
  });

  it("uses responsibilities arrays as a fail-closed bullet fallback when explicit bullets are absent", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv_test_array",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-experience-1",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-support",
              company: "Southwestern University",
              position: "Information Technology Support Specialist",
              startDate: "2018-09-01",
              endDate: null,
              isCurrent: true,
              responsibilities: [
                "Communicate with managers to set up campus computers used on campus",
                "Assess and troubleshoot computer problems brought by students, faculty and staff",
                "Maintain upkeep of computers, classroom equipment, and 200 printers across campus",
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find((section) => section.type === "experience");
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];
    expect(normalizedItem?.responsibilityBullets).toEqual([
      "Communicate with managers to set up campus computers used on campus",
      "Assess and troubleshoot computer problems brought by students, faculty and staff",
      "Maintain upkeep of computers, classroom equipment, and 200 printers across campus",
    ]);
    expect(normalizedItem?.responsibilities?.content?.[0]?.type).toBe("bulletList");
  });

  it("converts AI-style bullet glyph responsibility text into durable Remirror list structure", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv_test_ai_bullet_text",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-experience-ai",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-ai-rewrite",
              company: "Northline",
              position: "Operations Lead",
              startDate: "2024-01-01",
              endDate: null,
              isCurrent: true,
              responsibilities:
                "• Coordinated shift handoffs across three teams\n• Reduced reporting delays with a shared incident log",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find((section) => section.type === "experience");
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];
    expect(normalizedItem?.responsibilityBullets).toEqual([
      "Coordinated shift handoffs across three teams",
      "Reduced reporting delays with a shared incident log",
    ]);
    expect(normalizedItem?.responsibilities?.content?.[0]?.type).toBe("bulletList");
  });

  it("preserves manually authored Remirror bulletList responsibilities through document normalization", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv_test_manual_bullet_doc",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-experience-manual",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-manual-list",
              company: "Northline",
              position: "Operations Lead",
              startDate: "2024-01-01",
              endDate: null,
              isCurrent: true,
              responsibilities: {
                type: "doc",
                content: [
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Coordinated shift handoffs." }],
                          },
                        ],
                      },
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Reduced reporting delays." }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              responsibilityBullets: ["STALE cached bullet"],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find((section) => section.type === "experience");
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];
    expect(normalizedItem?.responsibilities?.content?.[0]?.type).toBe("bulletList");
    expect(normalizedItem?.responsibilityBullets).toEqual([
      "Coordinated shift handoffs.",
      "Reduced reporting delays.",
    ]);
  });

  it("does not invent responsibility bullets from a single collapsed string at normalization time", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv_test_string_only",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "sec-experience-2",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-research",
              company: "Southwestern University",
              position: "Artificial Intelligence Research Assistant",
              startDate: "2019-05-01",
              endDate: null,
              isCurrent: true,
              responsibilities:
                "Explored methods to generate video game dungeons based off of The Legend of Zelda Developed a game in Java to test the generated dungeons Contributed 50K+ lines of code to an established codebase via Git Conducted a human subject study to determine which video game dungeon generation technique is enjoyable",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const normalizedExperienceSection = result.document.sections.find((section) => section.type === "experience");
    const normalizedItem = (normalizedExperienceSection?.structuredContent as any[])?.[0];
    expect(normalizedItem?.responsibilityBullets).toBeUndefined();
  });

  it("preserves authoritative resume metadata passthrough during normalization", () => {
    const result = normalizeAndValidateCvDocument({
      id: "cv_authoritative_meta",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        authoritativeResume: {
          source: "mistral_v3",
          trusted: true,
          fallbackToLegacy: false,
          normalized: {
            profile: { name: "Jane Doe" },
          },
        },
      },
      sections: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.document.metadata.authoritativeResume).toEqual({
      source: "mistral_v3",
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: { name: "Jane Doe" },
      },
    });
  });
});
