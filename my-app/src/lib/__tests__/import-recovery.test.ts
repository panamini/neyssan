import { describe, expect, it } from "vitest";

import {
  applyImportRecoveryItems,
  buildRecoveryCommitState,
  buildRecoveryTextSegments,
  formatRecoveryCommitSummary,
  formatRecoveryCommitToast,
  getRemainingRecoveryText,
  isTrivialRecoveryResidue,
} from "../import-recovery";
import {
  buildImportRecoveryPayload,
  cleanupImportRecoveryText,
} from "../../../convex/lib/parsing/importRecovery";

describe("import-recovery", () => {
  it("normalizes bullets and glyph noise", () => {
    const result = cleanupImportRecoveryText("â€¢ First item\n- Second item");

    expect(result.cleanedText).toContain("- First item");
    expect(result.cleanedText).toContain("- Second item");
    expect(result.glyphReplacements).toBeGreaterThan(0);
    expect(result.bulletRepairs).toBeGreaterThan(0);
  });

  it("flags duplicates and unknown sections as low confidence", () => {
    const payload = buildImportRecoveryPayload({
      sourceSections: [
        { label: "UNMAPPED", content: "Repeated text", confidence: 0.9 },
        { label: "UNMAPPED", content: "Repeated text", confidence: 0.9 },
      ],
      fullResult: { normalized: {} },
      context: { rawText: "", mode: "text", parserUrl: "https://example.test/parse-cv" },
    });

    expect(payload?.totalItems).toBe(2);
    expect(payload?.items[0]?.issueFlags).toEqual(
      expect.arrayContaining(["unknownSection", "duplicate"]),
    );
  });

  it("detects certifications and hobbies headings as dedicated recovery targets", () => {
    const payload = buildImportRecoveryPayload({
      sourceSections: [
        { label: "Certifications", content: "AWS Certified Developer", confidence: 0.42 },
        { label: "Hobbies", content: "Chess, Hiking", confidence: 0.41 },
      ],
      fullResult: { normalized: {} },
      context: { rawText: "", mode: "text", parserUrl: "https://example.test/parse-cv" },
    });

    expect(payload?.items[0]?.predictedSection).toBe("certifications");
    expect(payload?.items[1]?.predictedSection).toBe("hobbies");
  });

  it("applies reviewed items into sections with import recovery metadata", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-1",
        rawText: "Recovered summary text",
        cleanedText: "Recovered summary text",
        displayTextSource: "cleaned",
        predictedSection: "summary",
        selectedSection: "summary",
        confidenceScore: "low",
        confidenceValue: 0.4,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Summary",
        sourceFieldKey: "summary",
        fragmentAssignments: [],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "summary" })]),
    );
    expect(JSON.stringify(sections)).toContain("importRecovery");
  });

  it("keeps assigned fragments highlighted and only applies remaining residue", () => {
    const item = {
      blockId: "recovery-2",
      rawText: "Alpha Beta Gamma",
      cleanedText: "Alpha Beta Gamma",
      displayTextSource: "cleaned" as const,
      predictedSection: "summary" as const,
      selectedSection: "summary" as const,
      confidenceScore: "low" as const,
      confidenceValue: 0.33,
      issueFlags: ["weakSectionMatch"] as const,
      reviewStatus: "accepted" as const,
      sourceSectionTitle: "Mixed block",
      sourceFieldKey: "summary",
      fragmentAssignments: [
        {
          fragmentId: "fragment-1",
          blockId: "recovery-2",
          startOffset: 6,
          endOffset: 10,
          selectedText: "Beta",
          selectionSource: "cleaned" as const,
          targetSection: "skills" as const,
          targetSectionTitle: null,
          status: "assigned" as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const segments = buildRecoveryTextSegments("Alpha Beta Gamma", item.fragmentAssignments);
    expect(segments.filter((segment) => segment.assigned)).toHaveLength(1);
    expect(getRemainingRecoveryText(item).text).toBe("Alpha  Gamma");

    const sections = applyImportRecoveryItems([], [item]);
    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "summary" }),
        expect.objectContaining({ type: "skills" }),
      ]),
    );
  });

  it("materializes custom text-backed recovery targets as text sections", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-3",
        rawText: "Board member of local chapter",
        cleanedText: "Board member of local chapter",
        displayTextSource: "cleaned",
        predictedSection: "summary",
        selectedSection: "affiliations",
        selectedSectionTitle: null,
        confidenceScore: "low",
        confidenceValue: 0.41,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "reassigned",
        sourceSectionTitle: "Additional details",
        sourceFieldKey: "other",
        fragmentAssignments: [],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", title: "Affiliations" }),
      ]),
    );
  });

  it("preserves assigned fragments when the remaining residue is ignored", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-ignore-fragment",
        rawText: "Alpha Beta Gamma",
        cleanedText: "Alpha Beta Gamma",
        displayTextSource: "cleaned",
        predictedSection: "summary",
        selectedSection: "summary",
        confidenceScore: "low",
        confidenceValue: 0.29,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "ignored",
        sourceSectionTitle: "Mixed block",
        sourceFieldKey: "summary",
        fragmentAssignments: [
          {
            fragmentId: "fragment-1",
            blockId: "recovery-ignore-fragment",
            startOffset: 6,
            endOffset: 10,
            selectedText: "Beta",
            selectionSource: "cleaned",
            targetSection: "skills",
            targetSectionTitle: null,
            status: "assigned",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "skills", structuredContent: expect.arrayContaining([expect.objectContaining({ name: "Beta" })]) }),
      ]),
    );
    expect(sections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "summary" }),
      ]),
    );
  });

  it("materializes hobbies as structured tag items", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-hobbies",
        rawText: "Chess, Hiking",
        cleanedText: "Chess, Hiking",
        displayTextSource: "cleaned",
        predictedSection: "hobbies",
        selectedSection: "hobbies",
        confidenceScore: "low",
        confidenceValue: 0.41,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "reassigned",
        sourceSectionTitle: "Hobbies",
        sourceFieldKey: "hobbies",
        fragmentAssignments: [],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          title: "Hobbies",
          structuredContent: expect.arrayContaining([
            expect.objectContaining({ name: "Chess" }),
            expect.objectContaining({ name: "Hiking" }),
          ]),
        }),
      ]),
    );
  });

  it("materializes additional information as a visible plain text section", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-additional-information",
        rawText: "Available for travel and relocation",
        cleanedText: "Available for travel and relocation",
        displayTextSource: "cleaned",
        predictedSection: "additional_information",
        selectedSection: "additional_information",
        confidenceScore: "low",
        confidenceValue: 0.41,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Additional Information",
        sourceFieldKey: "additional_information",
        fragmentAssignments: [],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          title: "Additional Information",
          blocks: expect.any(Array),
        }),
      ]),
    );
    expect(JSON.stringify(sections)).toContain("Available for travel and relocation");
  });

  it("keeps weak experience fallback text in recovery blocks instead of stuffing the role field", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-experience-fallback",
        rawText: "Handled late-shift escalation coverage",
        cleanedText: "Handled late-shift escalation coverage",
        displayTextSource: "cleaned",
        predictedSection: "experience",
        selectedSection: "experience",
        confidenceScore: "low",
        confidenceValue: 0.29,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Experience",
        sourceFieldKey: "experience",
        fragmentAssignments: [],
      },
    ]);

    const experienceSection = sections.find(
      (section) => String(section.type) === "experience",
    );
    expect(experienceSection).toBeTruthy();
    expect((experienceSection?.structuredContent as any[])?.[0]).toEqual(
      expect.objectContaining({
        position: "",
        company: "",
        responsibilities: undefined,
      }),
    );
    expect(JSON.stringify(experienceSection?.blocks ?? [])).toContain(
      "Handled late-shift escalation coverage",
    );
  });

  it("keeps weak education fallback text in recovery blocks instead of stuffing the degree field", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-education-fallback",
        rawText: "Evening specialization in logistics systems",
        cleanedText: "Evening specialization in logistics systems",
        displayTextSource: "cleaned",
        predictedSection: "education",
        selectedSection: "education",
        confidenceScore: "low",
        confidenceValue: 0.29,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Education",
        sourceFieldKey: "education",
        fragmentAssignments: [],
      },
    ]);

    const educationSection = sections.find(
      (section) => String(section.type) === "education",
    );
    expect(educationSection).toBeTruthy();
    expect((educationSection?.structuredContent as any[])?.[0]).toEqual(
      expect.objectContaining({
        degree: "",
        description: undefined,
      }),
    );
    expect(JSON.stringify(educationSection?.blocks ?? [])).toContain(
      "Evening specialization in logistics systems",
    );
  });

  it("materializes certifications as structured certification items", () => {
    const sections = applyImportRecoveryItems([], [
      {
        blockId: "recovery-certification",
        rawText: "AWS Certified Developer\nAmazon Web Services",
        cleanedText: "AWS Certified Developer\nAmazon Web Services",
        displayTextSource: "cleaned",
        predictedSection: "certifications",
        selectedSection: "certifications",
        confidenceScore: "low",
        confidenceValue: 0.44,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "accepted",
        sourceSectionTitle: "Certifications",
        sourceFieldKey: "certifications",
        fragmentAssignments: [],
      },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "certifications",
          structuredContent: expect.arrayContaining([
            expect.objectContaining({
              certificationName: "AWS Certified Developer",
              issuingOrganization: "Amazon Web Services",
            }),
          ]),
        }),
      ]),
    );
  });

  it("uses the real commit state to summarize fragment saves and pending residue", () => {
    const { summary, pendingItems } = buildRecoveryCommitState([
      {
        blockId: "recovery-4",
        rawText: "Alpha Beta Gamma",
        cleanedText: "Alpha Beta Gamma",
        displayTextSource: "cleaned",
        predictedSection: "summary",
        selectedSection: "summary",
        confidenceScore: "low",
        confidenceValue: 0.35,
        issueFlags: ["weakSectionMatch"],
        reviewStatus: "pending",
        sourceSectionTitle: "Mixed block",
        sourceFieldKey: "summary",
        fragmentAssignments: [
          {
            fragmentId: "fragment-1",
            blockId: "recovery-4",
            startOffset: 6,
            endOffset: 10,
            selectedText: "Beta",
            selectionSource: "cleaned",
            targetSection: "skills",
            targetSectionTitle: null,
            status: "assigned",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ]);

    expect(summary).toEqual({
      fragmentCount: 1,
      acceptedBlockCount: 0,
      pendingCount: 1,
    });
    expect(pendingItems).toHaveLength(1);
    expect(formatRecoveryCommitSummary(summary)).toBe(
      "Saving 1 fragment now • 1 item stays pending",
    );
    expect(formatRecoveryCommitToast(summary)).toBe(
      "Saved 1 fragment • 1 item pending review",
    );
  });

  it("treats known heading-only residue as trivial cleanup", () => {
    expect(isTrivialRecoveryResidue("Work Experience")).toBe(true);
    expect(isTrivialRecoveryResidue("Skills:")).toBe(true);
    expect(isTrivialRecoveryResidue("Jane Doe")).toBe(false);
  });
});
