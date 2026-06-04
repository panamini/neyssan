import { describe, expect, it } from "vitest";
import { ensureRemirrorDoc } from "../../../components/remirror-editor/utils/conversion";
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
              description:
                "Led the design vision across a portfolio of editorial products.",
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
          id: "certifications",
          title: "Certifications",
          type: "certifications",
          blocks: [],
          structuredContent: [
            {
              id: "cert-1",
              certificationName: "Service Design Masterclass",
              issuingOrganization: "Nielsen Norman Group",
              issueDate: "2022-01-01T00:00:00.000Z",
              issueDatePrecision: "year",
              credentialId: "NNG-2022",
            },
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
        {
          id: "hobbies",
          title: "Hobbies",
          type: "text",
          blocks: [],
          structuredContent: [
            { id: "hobby-1", name: "Chess" },
            { id: "hobby-2", name: "Running" },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.name).toBe("Elena Marlowe");
    expect(mapped.title).toBe("Senior Product Designer");
    expect(mapped.summary).toContain("Editorially minded product designer");
    expect(mapped.profileSectionId).toBe("profile");
    expect(mapped.summarySectionId).toBe("summary");
    expect(mapped.sectionIdsByType).toMatchObject({
      profile: ["profile"],
      summary: ["summary"],
      experience: ["experience"],
      education: ["education"],
      skills: ["skills"],
      languages: ["languages"],
      certifications: ["certifications"],
      achievements: ["achievements"],
      hobbies: ["hobbies"],
    });
    expect(mapped.metadata).toEqual([]);
    expect(mapped.contact).toEqual([
      {
        label: "Email",
        value: "elena@example.com",
        itemId: "email",
        sectionId: "profile",
        sectionType: "profile",
      },
      {
        label: "Phone",
        value: "+33 6 00 00 00 00",
        itemId: "phone",
        sectionId: "profile",
        sectionType: "profile",
      },
      {
        label: "Location",
        value: "Paris, FR",
        itemId: "location",
        sectionId: "profile",
        sectionType: "profile",
      },
      {
        label: "LinkedIn",
        value: "linkedin.com/in/elenamarlowe",
        itemId: "linkedin",
        sectionId: "profile",
        sectionType: "profile",
      },
      {
        label: "Website",
        value: "elenamarlowe.design",
        itemId: "website",
        sectionId: "profile",
        sectionType: "profile",
      },
    ]);
    expect(mapped.experience[0].period).toBe("2021 — Present");
    expect(mapped.experience[0].description).toBe(
      "Led the design vision across a portfolio of editorial products.",
    );
    expect(mapped.experience[0].bullets).toEqual([
      "Defined a reusable design system",
      "Improved implementation quality across squads",
    ]);
    expect(mapped.projects[0]).toEqual({
      id: "project-1",
      sectionId: "projects",
      sectionType: "projects",
      sectionTitle: "Projects",
      sectionOrder: 8,
      name: "Atlas Design Language",
      meta: "",
      description:
        "Created a modular design language for dense product surfaces with print-aware documentation.",
    });
    expect(mapped.education[0]).toEqual({
      id: "edu-1",
      sectionId: "education",
      sectionType: "education",
      sectionTitle: "Education",
      sectionOrder: 3,
      degree: "MA, Information Design",
      school: "University of the Arts London",
      period: "2013 — 2015",
    });
    expect(mapped.skills).toEqual(["Design systems", "Editorial UI"]);
    expect(mapped.skillItems).toEqual([
      {
        id: "skill-1",
        name: "Design systems",
        level: "Advanced",
        sectionId: "skills",
        sectionType: "skills",
        sectionTitle: "Skills",
        sectionOrder: 4,
      },
      {
        id: "skill-2",
        name: "Editorial UI",
        level: "Advanced",
        sectionId: "skills",
        sectionType: "skills",
        sectionTitle: "Skills",
        sectionOrder: 4,
      },
    ]);
    expect(mapped.languages).toEqual([
      {
        id: "lang-1",
        name: "English",
        level: "Fluent",
        sectionId: "languages",
        sectionType: "languages",
        sectionTitle: "Languages",
        sectionOrder: 5,
      },
    ]);
    expect(mapped.certifications).toEqual([
      {
        id: "cert-1",
        name: "Service Design Masterclass",
        issuer: "Nielsen Norman Group",
        meta: "2022 · Credential ID: NNG-2022",
        sectionId: "certifications",
        sectionType: "certifications",
        sectionTitle: "Certifications",
        sectionOrder: 6,
      },
    ]);
    expect(mapped.achievements).toEqual([
      "Scaled a multi-squad design language.",
    ]);
    expect(mapped.achievementItems).toEqual([
      {
        id: "ach-1",
        text: "Scaled a multi-squad design language.",
        sectionId: "achievements",
        sectionType: "achievements",
        sectionTitle: "Achievements",
        sectionOrder: 7,
      },
    ]);
    expect(mapped.hobbies).toEqual(["Chess", "Running"]);
    expect(mapped.hobbyItems).toEqual([
      {
        id: "hobby-1",
        name: "Chess",
        sectionId: "hobbies",
        sectionType: "hobbies",
        sectionTitle: "Hobbies",
        sectionOrder: 9,
      },
      {
        id: "hobby-2",
        name: "Running",
        sectionId: "hobbies",
        sectionType: "hobbies",
        sectionTitle: "Hobbies",
        sectionOrder: 9,
      },
    ]);
    expect(hasRenderableResumeData(mapped)).toBe(true);
  });

  it("does not use the document image metadata as the profile photoUrl", () => {
    const doc: CvDocument = {
      id: "cv-profile-image-metadata",
      title: "Senior Product Designer",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
        profileImage: {
          src: "data:image/png;base64,AAAA",
          size: "large",
          fit: "contain",
          fileName: "portrait.png",
        },
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
              desiredPosition: "Senior Product Designer",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.photoUrl).toBeUndefined();
    expect(mapped.photoSize).toBe("large");
    expect(mapped.photoFit).toBe("contain");
  });

  it("keeps prose-only experience entries as description without synthesizing bullets", () => {
    const doc: CvDocument = {
      id: "cv-2",
      title: "Operations Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-2",
              company: "Northline Studio",
              position: "Operations Lead",
              location: "Paris",
              description:
                "Owned the operating cadence and introduced a clearer delivery rhythm across the team.",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience).toEqual([
      {
        id: "exp-2",
        sectionId: "experience",
        sectionType: "experience",
        sectionTitle: "Experience",
        sectionOrder: 0,
        role: "Operations Lead",
        company: "Northline Studio",
        period: "",
        location: "Paris",
        description:
          "Owned the operating cadence and introduced a clearer delivery rhythm across the team.",
        bullets: [],
      },
    ]);
  });

  it("leaves the preview title empty when desired position is absent instead of falling back to the document title or name", () => {
    const doc: CvDocument = {
      id: "cv-no-desired-position",
      title: "Elena Marlowe",
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
              desiredPosition: "",
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
              summary: "Operator focused on clear systems and reliable delivery.",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.name).toBe("Elena Marlowe");
    expect(mapped.title).toBe("");
    expect(mapped.title).not.toBe(doc.title);
    expect(mapped.title).not.toBe(mapped.name);
  });

  it("maps legacy portfolio profile data into canonical Website contact without duplication", () => {
    const doc: CvDocument = {
      id: "cv-portfolio",
      title: "Portfolio alias",
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
              portfolio: "elenamarlowe.design",
            } as Record<string, unknown>,
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.contact).toEqual([
      {
        label: "Website",
        value: "elenamarlowe.design",
        itemId: "website",
        sectionId: "profile",
        sectionType: "profile",
      },
    ]);
    expect(mapped.contact.some((item) => item.label === "Portfolio")).toBe(false);
  });

  it("returns no synthetic preview summary when the summary section is absent", () => {
    const doc: CvDocument = {
      id: "cv-no-summary",
      title: "Elena Marlowe",
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
              desiredPosition: "Senior Product Designer",
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
              position: "Operations Lead",
              location: "Paris",
              responsibilities:
                "Owned the operating cadence and delivery rhythm across the team.",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.summary).toBe("");
    expect(mapped.summarySectionId).toBeUndefined();
  });

  it("maps project rich descriptions without responsibility caches or HTML", () => {
    const doc = {
      id: "cv-project-rich",
      title: "Project rich",
      metadata: {
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "projects",
          title: "Projects",
          type: "projects",
          blocks: [],
          structuredContent: [
            {
              id: "project-1",
              title: "CV Forge",
              meta: "React",
              description: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      {
                        type: "text",
                        marks: [{ type: "bold" }, { type: "underline" }],
                        text: "Rich project paragraph",
                      },
                    ],
                  },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [
                              {
                                type: "text",
                                marks: [{ type: "italic" }],
                                text: "Rich project bullet",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    } as any;

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.projects[0]).toMatchObject({
      id: "project-1",
      description: "Rich project paragraph\nRich project bullet",
      descriptionRich: {
        blocks: [
          {
            kind: "paragraph",
            runs: [
              { text: "Rich project paragraph", bold: true, underline: true },
            ],
          },
          {
            kind: "bullet_list",
            items: [
              { runs: [{ text: "Rich project bullet", italic: true }] },
            ],
          },
        ],
      },
    });
    expect(mapped.projects[0]).not.toHaveProperty("responsibilityBullets");
    expect(JSON.stringify(mapped.projects[0])).not.toMatch(/<\/?[a-z][\s\S]*>/i);
  });

  it("projects remirror responsibilities into separate prose and bullet channels", () => {
    const doc: CvDocument = {
      id: "cv-3",
      title: "Platform Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-3",
              company: "Northline",
              position: "Platform Lead",
              location: "Paris",
              startDate: "2022-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              isCurrent: true,
              responsibilities: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Directed the migration roadmap." }],
                  },
                  {
                    type: "bulletList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Reduced rollback incidents by 38%." }],
                          },
                        ],
                      },
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Defined launch checklists for every squad." }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience).toEqual([
      {
        id: "exp-3",
        sectionId: "experience",
        sectionType: "experience",
        sectionTitle: "Experience",
        sectionOrder: 0,
        role: "Platform Lead",
        company: "Northline",
        period: "2022 — Present",
        location: "Paris",
        description: "Directed the migration roadmap.",
        bullets: [
          "Reduced rollback incidents by 38%.",
          "Defined launch checklists for every squad.",
        ],
        responsibilitiesRich: {
          blocks: [
            {
              kind: "paragraph",
              runs: [{ text: "Directed the migration roadmap." }],
            },
            {
              kind: "bullet_list",
              items: [
                {
                  runs: [{ text: "Reduced rollback incidents by 38%." }],
                },
                {
                  runs: [{ text: "Defined launch checklists for every squad." }],
                },
              ],
            },
          ],
        },
      },
    ]);
  });

  it("keeps cached responsibility bullets when an empty responsibilities field is present", () => {
    const doc: CvDocument = {
      id: "cv-inline-bullets",
      title: "Platform Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-inline",
              company: "Northline",
              position: "Platform Lead",
              responsibilities: "",
              responsibilityBullets: ["Kept bullets after editing the title."],
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience[0]).toEqual(
      expect.objectContaining({
        id: "exp-inline",
        role: "Platform Lead",
        bullets: ["Kept bullets after editing the title."],
      }),
    );
  });

  it("shows empty draft bullets in edit-mode rich responsibilities without preview/export leakage", () => {
    const doc: CvDocument = {
      id: "cv-draft-bullet",
      title: "Operations Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-draft-bullet",
              company: "Northline",
              position: "Operations Lead",
              responsibilities: ensureRemirrorDoc("Led cross-functional delivery."),
              responsibilityBullets: ["__draft_empty_responsibility_bullet__"],
              __draftResponsibilityBulletCount: 1,
            } as any,
          ],
        },
      ],
    };

    const editMapped = mapCvDocumentToResumeData(doc, { includeDrafts: true });
    expect(editMapped.experience[0]?.description).toBe(
      "Led cross-functional delivery.",
    );
    expect(editMapped.experience[0]?.bullets).toEqual([""]);
    expect(editMapped.experience[0]?.responsibilitiesRich?.blocks).toEqual([
      {
        kind: "paragraph",
        runs: [{ text: "Led cross-functional delivery." }],
      },
      {
        kind: "bullet_list",
        items: [{ runs: [{ text: "" }] }],
      },
    ]);

    const previewMapped = mapCvDocumentToResumeData(doc);
    expect(previewMapped.experience[0]?.description).toBe(
      "Led cross-functional delivery.",
    );
    expect(previewMapped.experience[0]?.bullets).toEqual([]);
    expect(previewMapped.experience[0]?.responsibilitiesRich?.blocks).toEqual([
      {
        kind: "paragraph",
        runs: [{ text: "Led cross-functional delivery." }],
      },
    ]);
  });

  it("keeps paragraph-backed remirror responsibilities in the prose channel", () => {
    const doc: CvDocument = {
      id: "cv-4",
      title: "Operations Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-4",
              company: "Northline",
              position: "Operations Lead",
              startDate: "2023-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              isCurrent: true,
              responsibilities: ensureRemirrorDoc(
                "Led cross-functional delivery rituals.\nReduced export QA churn by 42%.",
              ),
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience).toEqual([
      {
        id: "exp-4",
        sectionId: "experience",
        sectionType: "experience",
        sectionTitle: "Experience",
        sectionOrder: 0,
        role: "Operations Lead",
        company: "Northline",
        period: "2023 — Present",
        location: "",
        description: "Led cross-functional delivery rituals. Reduced export QA churn by 42%.",
        bullets: [],
        responsibilitiesRich: {
          blocks: [
            {
              kind: "paragraph",
              runs: [
                {
                  text: "Led cross-functional delivery rituals. Reduced export QA churn by 42%.",
                },
              ],
            },
          ],
        },
      },
    ]);
  });

  it("normalizes JSON-stringified responsibility arrays into bullets without raw artifacts", () => {
    const doc: CvDocument = {
      id: "cv-json-responsibilities",
      title: "Operations Lead",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-json",
              company: "Northline",
              position: "Operations Lead",
              responsibilities: JSON.stringify([
                "Reduced incident volume.",
                "Standardized handoffs.",
              ]),
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience[0]).not.toHaveProperty("description");
    expect(mapped.experience[0]).toEqual(
      expect.objectContaining({
        bullets: ["Reduced incident volume.", "Standardized handoffs."],
        responsibilitiesRich: {
          blocks: [
            {
              kind: "bullet_list",
              items: [
                {
                  runs: [{ text: "Reduced incident volume." }],
                },
                {
                  runs: [{ text: "Standardized handoffs." }],
                },
              ],
            },
          ],
        },
      }),
    );
    expect(mapped.experience[0]?.description).toBeUndefined();
    expect(JSON.stringify(mapped.experience[0])).not.toContain(
      '\\"Reduced incident volume.\\"',
    );
  });

  it("falls back to block-backed certifications and affiliations when structured content is absent", () => {
    const doc: CvDocument = {
      id: "cv-fallbacks",
      title: "Fallback Resume",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "certifications",
          title: "Certifications",
          type: "certifications",
          blocks: [
            {
              id: "cert-block-1",
              title: "AWS Certified Developer",
              type: "text",
              plainText: "Amazon Web Services · 2024",
            },
          ],
          structuredContent: null,
        },
        {
          id: "affiliations",
          title: "Affiliations",
          type: "text",
          blocks: [
            {
              id: "aff-block-1",
              title: "IxDA Amsterdam",
              type: "text",
              plainText: "Member since 2022",
            },
          ],
          structuredContent: null,
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.certifications).toEqual([
      {
        id: "cert-block-1",
        name: "AWS Certified Developer",
        meta: "Amazon Web Services · 2024",
        sectionId: "certifications",
        sectionType: "certifications",
        sectionTitle: "Certifications",
        sectionOrder: 0,
      },
    ]);
    expect(mapped.affiliations).toEqual([
      {
        id: "aff-block-1",
        organizationName: "IxDA Amsterdam",
        notes: "Member since 2022",
        sectionId: "affiliations",
        sectionType: "affiliations",
        sectionTitle: "Affiliations",
        sectionOrder: 1,
      },
    ]);
  });

  it("preserves degree, field of study, grade, school, and period as distinct education fields", () => {
    const doc: CvDocument = {
      id: "cv-education-fields",
      title: "Education fields",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "education",
          title: "Education",
          type: "education",
          blocks: [],
          structuredContent: [
            {
              id: "edu-degree-only",
              institution: "Northbridge University",
              degree: "Bachelor of Science",
              startDate: "2016-01-01T00:00:00.000Z",
              endDate: "2020-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              endDatePrecision: "year",
            },
            {
              id: "edu-field-only",
              institution: "Ecole Atelier",
              fieldOfStudy: "Industrial Design",
              startDate: "2018-01-01T00:00:00.000Z",
              endDate: "2021-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              endDatePrecision: "year",
            },
            {
              id: "edu-degree-and-field",
              institution: "Sorrel Institute",
              degree: "Master of Science",
              fieldOfStudy: "Human Computer Interaction",
              startDate: "2021-01-01T00:00:00.000Z",
              endDate: "2023-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              endDatePrecision: "year",
            },
            {
              id: "edu-grade",
              institution: "Lakeside College",
              degree: "Bachelor of Arts",
              fieldOfStudy: "Visual Communication",
              grade: "First Class Honours",
              startDate: "2012-01-01T00:00:00.000Z",
              endDate: "2015-01-01T00:00:00.000Z",
              startDatePrecision: "year",
              endDatePrecision: "year",
            },
          ],
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.education).toEqual([
      {
        id: "edu-degree-only",
        sectionId: "education",
        sectionType: "education",
        sectionTitle: "Education",
        sectionOrder: 0,
        degree: "Bachelor of Science",
        school: "Northbridge University",
        period: "2016 — 2020",
      },
      {
        id: "edu-field-only",
        sectionId: "education",
        sectionType: "education",
        sectionTitle: "Education",
        sectionOrder: 0,
        degree: "",
        fieldOfStudy: "Industrial Design",
        school: "Ecole Atelier",
        period: "2018 — 2021",
      },
      {
        id: "edu-degree-and-field",
        sectionId: "education",
        sectionType: "education",
        sectionTitle: "Education",
        sectionOrder: 0,
        degree: "Master of Science",
        fieldOfStudy: "Human Computer Interaction",
        school: "Sorrel Institute",
        period: "2021 — 2023",
      },
      {
        id: "edu-grade",
        sectionId: "education",
        sectionType: "education",
        sectionTitle: "Education",
        sectionOrder: 0,
        degree: "Bachelor of Arts",
        fieldOfStudy: "Visual Communication",
        grade: "First Class Honours",
        school: "Lakeside College",
        period: "2012 — 2015",
      },
    ]);
  });

  it("falls back to block-backed experience and education when structured content is absent", () => {
    const doc: CvDocument = {
      id: "cv-block-fallbacks",
      title: "Block-backed resume",
      metadata: {
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "experience",
          title: "Experience",
          type: "experience",
          blocks: [
            {
              id: "exp-block-1",
              title: "Operations Lead",
              type: "text",
              plainText:
                "Northline Studio\nIntroduced a clearer delivery cadence across the team.",
            },
          ],
          structuredContent: null,
        },
        {
          id: "education",
          title: "Education",
          type: "education",
          blocks: [
            {
              id: "edu-block-1",
              title: "MA, Information Design",
              type: "text",
              plainText: "University of the Arts London",
            },
          ],
          structuredContent: null,
        },
      ],
    };

    const mapped = mapCvDocumentToResumeData(doc);

    expect(mapped.experience).toEqual([
      expect.objectContaining({
        id: "exp-block-1",
        role: "Operations Lead",
        company: "Northline Studio",
        period: "Dates not set",
        location: "Location not set",
        bullets: [
          "Introduced a clearer delivery cadence across the team.",
        ],
      }),
    ]);
    expect(mapped.education).toEqual([
      {
        id: "edu-block-1",
        sectionId: "education",
        sectionType: "education",
        sectionTitle: "Education",
        sectionOrder: 1,
        degree: "MA, Information Design",
        school: "University of the Arts London",
        period: "Dates not set",
      },
    ]);
  });
});
