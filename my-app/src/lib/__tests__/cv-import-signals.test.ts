import { describe, expect, it } from "vitest";
import { inspectCvImportSignals } from "../cv-import-signals";
import type { CvDocument } from "../../types/cvDocument";

function buildCv(overrides?: Partial<CvDocument>): CvDocument {
  return {
    id: "cv_test",
    title: "Imported CV",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    sections: [],
    ...overrides,
  };
}

describe("inspectCvImportSignals", () => {
  it("flags suspicious name, placeholder dates, and duplicated descriptions", () => {
    const signals = inspectCvImportSignals(
      buildCv({
        sections: [
          {
            id: "profile_1",
            title: "Profile",
            type: "profile",
            blocks: [],
            structuredContent: [
              {
                name: "ROBERT COOPER SECURITY GUARD",
                desiredPosition: "Security Guard",
              },
            ],
          },
          {
            id: "summary_1",
            title: "Summary",
            type: "summary",
            blocks: [],
            structuredContent: [
              {
                summary:
                  "Talent professional specializing in investigation skills January April January April.",
              },
            ],
          },
          {
            id: "experience_1",
            title: "Experience",
            type: "experience",
            blocks: [],
            structuredContent: [
              {
                company: "ROBERT COOPER SECURITY GUARD",
                position: "Copwatch Jogbani",
                startDate: "DATES NOT SET",
                endDate: "LOCATION NOT SET",
                description:
                  "Patrolled assigned areas and reported incidents. Patrolled assigned areas and reported incidents.",
              },
            ],
          },
        ],
      }),
    );

    expect(signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "profile-name-noise",
        "experience-company-name-match",
        "experience-placeholder-dates",
        "experience-description-duplicate",
      ]),
    );
  });

  it("returns no signals for a clean imported cv", () => {
    const signals = inspectCvImportSignals(
      buildCv({
        sections: [
          {
            id: "profile_1",
            title: "Profile",
            type: "profile",
            blocks: [],
            structuredContent: [
              {
                name: "Jane Doe",
                desiredPosition: "Product Designer",
              },
            ],
          },
          {
            id: "summary_1",
            title: "Summary",
            type: "summary",
            blocks: [],
            structuredContent: [
              {
                summary:
                  "Product designer focused on systems thinking, visual craft, and shipping clear workflows.",
              },
            ],
          },
          {
            id: "experience_1",
            title: "Experience",
            type: "experience",
            blocks: [],
            structuredContent: [
              {
                company: "North Studio",
                position: "Senior Product Designer",
                startDate: "2021-01-01",
                endDate: null,
                description:
                  "Led product design across onboarding, hiring flows, and design system rollout.",
              },
            ],
          },
        ],
      }),
    );

    expect(signals).toHaveLength(0);
  });
});
