import { describe, expect, it } from "vitest";
import type { CvDocument } from "../../../types/cvDocument";
import { mapCvDocumentToResumeData, hasRenderableResumeData } from "../cvDocumentToResumeData";

describe("mapCvDocumentToResumeData", () => {
  it("maps canonical structured CV sections into the verbati resume contract", () => {
    const doc: CvDocument = {
      id: "cv-1",
      title: "Senior Product Designer",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-1",
              name: "Elena Marlowe",
              email: "elena@example.com",
              phone: "+33 6 00 00 00 00",
              website: "elenamarlowe.design",
              linkedin: "linkedin.com/in/elenamarlowe",
              desiredPosition: "Senior Product Designer",
              location: "Paris, FR",
            },
          ],
        },
        {
          id: "summary",
          title: "Summary",
          type: "summary",
          blocks: [],
          structuredContent: [
            {
              id: "summary-1",
              summary:
                "Editorially minded product designer shaping product systems and content-rich experiences.",
            },
          ],
        },
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-1",
              company: "Northline Studio",
              position: "Lead Product Designer",
              location: "Paris",
              startDate: "2021-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              isCurrent: true,
              responsibilityBullets: [
                "Defined a reusable design system",
                "Improved implementation quality across squads",
              ],
            },
          ],
        },
        {
          id: "education",
          title: "Education",
          type: "education",
          blocks: [],
          structuredContent: [
            {
              id: "edu-1",
              institution: "University of the Arts London",
              degree: "MA, Information Design",
              startDate: "2013-01-01T00:00:00.000Z",
              endDate: "2015-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              endDatePrecision: "year",
            },
          ],
        },
        {
          id: "skills",
          title: "Skills",
          type: "skills",
          blocks: [],
          structuredContent: [
            { id: "skill-1", name: "Design systems", level: "Advanced" },
            { id: "skill-2", name: "Editorial UI", level: "Advanced" },
          ],
        },
        {
          id: "languages",
          title: "Languages",
          type: "languages",
          blocks: [],
          structuredContent: [
            { id: "lang-1", name: "English", level: "Fluent" },
          ],
        },
        {
          id: "achievements",
          title: "Achievements",
          type: "achievements",
          blocks: [],
          structuredContent: [{ id: "ach-1", text: "Scaled a multi-squad design language." }],
        },
        {
          id: "projects",
          title: "Projects",
          type: "projects",
          blocks: [
            {
              id: "project-1",
              title: "Atlas Design Language",
              type: "text",
              plainText:
                "Created a modular design language for dense product surfaces with print-aware documentation.",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.name).toBe("Elena Marlowe");
    expect(mapped.title).toBe("Senior Product Designer");
    expect(mapped.summary).toContain("Editorially minded product designer");
    expect(mapped.metadata).toEqual([
      { label: "Location", value: "Paris, FR" },
      { label: "Portfolio", value: "elenamarlowe.design" },
    ]);
    expect(mapped.contact).toEqual([
      { label: "Email", value: "elena@example.com" },
      { label: "Phone", value: "+33 6 00 00 00 00" },
      { label: "Web", value: "elenamarlowe.design" },
      { label: "LinkedIn", value: "linkedin.com/in/elenamarlowe" },
    ]);
    expect(mapped.experience[0].period).toBe("2021 — Present");
    expect(mapped.experience[0].bullets).toEqual([
      "Defined a reusable design system",
      "Improved implementation quality across squads",
    ]);
    expect(mapped.projects[0]).toEqual({
      name: "Atlas Design Language",
      meta: "",
      description:
        "Created a modular design language for dense product surfaces with print-aware documentation.",
    });
    expect(mapped.education[0]).toEqual({
      degree: "MA, Information Design",
      school: "University of the Arts London",
      period: "2013 — 2015",
    });
    expect(mapped.skills).toEqual(["Design systems", "Editorial UI"]);
    expect(mapped.languages).toEqual([{ name: "English", level: "Fluent" }]);
    expect(mapped.achievements).toEqual([
      "Scaled a multi-squad design language.",
    ]);
    expect(hasRenderableResumeData(mapped)).toBe(true);
  });
});
