import { describe, expect, it } from "vitest";

import {
  applyStrictContactToSections,
  buildTypedSectionsFromNormalized,
  buildTypedSectionsFromReviewerSections,
} from "../cv/mapping-utils";

describe("buildTypedSectionsFromNormalized direct section materialization", () => {
  it("materializes projects, certifications, hobbies, affiliations, and additional information from raw sections", () => {
    const sections = buildTypedSectionsFromNormalized({
      rawSections: [
        {
          label: "Projects",
          content:
            "Gitlytics | Python, Flask, React, PostgreSQL, Docker | June 2020 – Present Developed a full-stack web application using Flask serving a REST API with React as the frontend",
        },
        { label: "Certifications", content: "AWS Certified Developer\nAmazon Web Services" },
        { label: "Hobbies", content: "Chess, Hiking" },
        { label: "Affiliations", content: "Member, ACM" },
        { label: "Additional Information", content: "Available for relocation" },
      ],
    });

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "projects", title: "Projects" }),
        expect.objectContaining({ type: "certifications", title: "Certifications" }),
        expect.objectContaining({ type: "text", title: "Hobbies" }),
        expect.objectContaining({ type: "text", title: "Affiliations" }),
        expect.objectContaining({ type: "text", title: "Additional Information" }),
      ]),
    );

    const projectsSection = sections.find((section) => section.type === "projects");
    expect(projectsSection?.blocks.map((block) => block.title)).toEqual(["Gitlytics"]);
    expect(projectsSection?.structuredContent).toEqual([
      expect.objectContaining({
        title: "Gitlytics",
        meta: "Python, Flask, React, PostgreSQL, Docker | June 2020 – Present",
        description: expect.stringContaining("Developed a full-stack web application"),
      }),
    ]);
  });

  it("preserves explicit reviewer sections instead of collapsing them into experience or achievements", () => {
    const sections = buildTypedSectionsFromReviewerSections([
      { id: "1", title: "Projects", content: "Trust sprint parser improvements", fieldKey: "projects" },
      { id: "2", title: "Certifications", content: "AWS Certified Developer", fieldKey: "certifications" },
      { id: "3", title: "Hobbies", content: "Chess, Hiking", fieldKey: "hobbies" },
      { id: "4", title: "Affiliations", content: "Member, ACM", fieldKey: "affiliations" },
      { id: "5", title: "Additional Information", content: "Available for travel", fieldKey: "additional_information" },
    ]);

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "projects" }),
        expect.objectContaining({ type: "certifications" }),
        expect.objectContaining({ type: "text", title: "Hobbies" }),
        expect.objectContaining({ type: "text", title: "Affiliations" }),
        expect.objectContaining({ type: "text", title: "Additional Information" }),
      ]),
    );
  });

  it("suppresses duplicate structured project blocks when a raw projects body already contains them", () => {
    const rawProjectsBody =
      "Gillytics | Python, Flask, React, PostgreSQL, Docker June 2020 – Present - Developed a full-stack web application using with Flask serving a REST API with React as the frontend - Implemented GitHub OAuth to get data from user’s repositories - Visualized GitHub data to show collaboration - Used Celery and Redis for asynchronous tasks Simple Paintball | Spigot API, Java, Maven, TravisCI, Git May 2018 – May 2020 - Developed a Minecraft server plugin to entertain kids during free time for a previous job";

    const sections = buildTypedSectionsFromNormalized({
      rawSections: [
        { label: "Projects", content: rawProjectsBody },
        { label: "Projects", content: rawProjectsBody.replace("–", "-") },
      ],
      projects: [
        {
          title: "Gillytics | Python, Flask, React, PostgreSQL, Docker June 2020 Present",
        },
      ],
    });

    const projectsSection = sections.find((section) => section.type === "projects");
    expect(projectsSection).toBeTruthy();
    expect(projectsSection?.blocks).toHaveLength(1);
    expect(projectsSection?.blocks.map((block) => block.title)).toEqual(["Gillytics"]);
    expect(projectsSection?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Gillytics",
          meta: expect.stringContaining("Simple Paintball"),
          description: expect.stringContaining("Developed a Minecraft server plugin"),
        }),
      ]),
    );
  });

  it("returns explicit normalized.sections directly so custom text section titles survive", () => {
    const sections = buildTypedSectionsFromNormalized({
      sections: [
        {
          id: "sec-profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [{ id: "profile-1", name: "Jane Doe", email: "jane@example.com" }],
        },
        {
          id: "sec-publications",
          title: "Publications",
          type: "text",
          blocks: [
            {
              id: "block-publications",
              title: "Publications",
              type: "text",
              content: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Research Paper A" }],
                  },
                ],
              },
            },
          ],
          structuredContent: null,
        },
      ],
    } as any);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({ type: "profile", title: "Profile" });
    expect(sections[1]).toMatchObject({ type: "text", title: "Publications" });
    expect(sections[1]?.blocks?.[0]).toMatchObject({ title: "Publications", type: "text" });
  });

  it("keeps all direct normalized.sections when experience items include passthrough fields like description", () => {
    const sections = buildTypedSectionsFromNormalized({
      sections: [
        {
          id: "sec-profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [{ id: "profile-1", name: "Robert Cooper", email: "robert@example.com" }],
        },
        {
          id: "sec-experience",
          title: "Experience",
          type: "experience",
          blocks: [],
          structuredContent: [
            {
              id: "exp-1",
              company: "ADT Security",
              position: "Security Guard",
              startDate: "2021-01-01",
              description: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Maintained site security." }],
                  },
                ],
              },
            },
          ],
        },
        {
          id: "sec-skills",
          title: "Skills",
          type: "skills",
          blocks: [],
          structuredContent: [{ id: "skill-1", name: "Surveillance", level: "Advanced" }],
        },
      ],
    } as any);

    expect(sections).toHaveLength(3);
    expect(sections.map((section) => section.type)).toEqual(["profile", "experience", "skills"]);
    expect(sections.find((section) => section.type === "experience")?.structuredContent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          company: "ADT Security",
          position: "Security Guard",
          description: expect.any(Object),
        }),
      ]),
    );
  });

  it("drops profile desiredPosition when upstream metadata duplicates the name", () => {
    const sections = buildTypedSectionsFromNormalized({
      profile: {
        name: "Linda Marvel",
        desiredPosition: "Linda Marvel",
        email: "linda@example.com",
      },
    });

    const profileSection = sections.find((section) => section.type === "profile");
    const profileItem = profileSection?.structuredContent?.[0] as
      | { name?: string; desiredPosition?: string }
      | undefined;

    expect(profileItem?.name).toBe("Linda Marvel");
    expect(profileItem?.desiredPosition).toBeUndefined();
  });

  it("does not let strict desiredPosition overwrite the profile with the candidate name", () => {
    const sections = applyStrictContactToSections(
      [
        {
          id: "sec-profile",
          title: "Profile",
          type: "profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-1",
              name: "Linda Marvel",
              desiredPosition: "",
              email: "linda@example.com",
            },
          ],
          collapsed: false,
        } as any,
      ],
      {
        name: "Linda Marvel",
        desiredPosition: "Linda Marvel",
      },
    );

    const profileItem = sections[0]?.structuredContent?.[0] as
      | { name?: string; desiredPosition?: string }
      | undefined;
    expect(profileItem?.name).toBe("Linda Marvel");
    expect(profileItem?.desiredPosition).toBe("");
  });
});
