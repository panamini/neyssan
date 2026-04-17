import { expect, test } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:4173";

type LayoutSeed = {
  label: string;
  layout: "swiss" | "two-column";
  rendererVariant: "swissminima" | "robial";
};

const layoutSeeds: LayoutSeed[] = [
  {
    label: "swissminima",
    layout: "swiss",
    rendererVariant: "swissminima",
  },
  {
    label: "robial",
    layout: "two-column",
    rendererVariant: "robial",
  },
];

function buildSeedCv(layout: LayoutSeed["layout"]) {
  return {
    id: `cv-preview-linking-${layout}`,
    title: "Alex Martin Resume",
    metadata: {
      createdAt: "2026-04-17T08:00:00.000Z",
      updatedAt: "2026-04-17T08:00:00.000Z",
      version: 1,
      verbatiStyle: {
        layout,
        typography: "quiet-editorial",
        palette: "sauge",
      },
    },
    sections: [
      {
        id: "profile-1",
        type: "profile",
        title: "Profile",
        blocks: [],
        structuredContent: [
          {
            id: "profile-item-1",
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
            email: "alex@example.com",
            phone: "+33 6 00 00 00 00",
            website: "alexmartin.dev",
            location: "Paris, FR",
          },
        ],
      },
      {
        id: "summary-1",
        type: "summary",
        title: "Summary",
        blocks: [],
        structuredContent: [
          {
            id: "summary-item-1",
            summary:
              "Operations-focused profile with strong coordination and delivery habits.",
          },
        ],
      },
      {
        id: "experience-1",
        type: "experience",
        title: "Experience",
        blocks: [],
        structuredContent: [
          {
            id: "exp-1",
            company: "Northline Studio",
            position: "Operations Coordinator",
            location: "Paris",
            startDate: "2022-01-01T00:00:00.000Z",
            isCurrent: true,
            description: "Owned weekly operations reviews.",
            responsibilityBullets: ["Introduced a cleaner delivery cadence."],
          },
          {
            id: "exp-2",
            company: "River Lane",
            position: "Program Assistant",
            location: "Lyon",
            startDate: "2020-01-01T00:00:00.000Z",
            endDate: "2021-01-01T00:00:00.000Z",
            description: "Supported reporting and delivery logistics.",
            responsibilityBullets: ["Tracked project timelines and follow-ups."],
          },
        ],
      },
      {
        id: "education-1",
        type: "education",
        title: "Education",
        blocks: [],
        structuredContent: [
          {
            id: "edu-1",
            institution: "Sorbonne",
            degree: "BA, Management",
            startDate: "2017-01-01T00:00:00.000Z",
            endDate: "2020-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "skills-1",
        type: "skills",
        title: "Skills",
        blocks: [],
        structuredContent: [
          { id: "skill-1", name: "Operations planning", level: "Advanced" },
          { id: "skill-2", name: "Stakeholder coordination", level: "Advanced" },
        ],
      },
      {
        id: "languages-1",
        type: "languages",
        title: "Languages",
        blocks: [],
        structuredContent: [
          { id: "lang-1", name: "English", level: "Fluent" },
          { id: "lang-2", name: "French", level: "Native" },
        ],
      },
      {
        id: "projects-1",
        type: "projects",
        title: "Projects",
        blocks: [],
        structuredContent: [
          {
            id: "project-1",
            title: "Coordination Toolkit",
            meta: "Internal program system",
            description: "Built a simple operating toolkit for recurring status reviews.",
          },
        ],
      },
      {
        id: "achievements-1",
        type: "achievements",
        title: "Achievements",
        blocks: [],
        structuredContent: [
          {
            id: "ach-1",
            text: "Reduced reporting turnaround from three days to one.",
          },
        ],
      },
      {
        id: "certifications-1",
        type: "certifications",
        title: "Certifications",
        blocks: [],
        structuredContent: [
          {
            id: "cert-1",
            certificationName: "AWS Certified Developer",
            issuingOrganization: "Amazon Web Services",
            credentialId: "AWS-123",
          },
        ],
      },
      {
        id: "affiliations-1",
        type: "text",
        title: "Affiliations",
        blocks: [],
        structuredContent: [
          {
            id: "aff-1",
            organizationName: "IEEE",
            roleOrMembershipType: "Member",
            notes: "Professional chapter member",
          },
        ],
      },
      {
        id: "hobbies-1",
        type: "text",
        title: "Hobbies",
        blocks: [],
        structuredContent: [
          { id: "hobby-1", name: "Chess" },
        ],
      },
      {
        id: "additional-information-1",
        type: "text",
        title: "Additional Information",
        blocks: [
          {
            id: "additional-information-block-1",
            title: "Additional Information",
            type: "text",
            plainText: "Available for travel and relocation.",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Available for travel and relocation." },
                  ],
                },
              ],
            },
          },
        ],
        structuredContent: null,
      },
      {
        id: "custom-text-1",
        type: "text",
        title: "Community",
        blocks: [
          {
            id: "custom-text-block-1",
            title: "Community",
            type: "text",
            plainText: "Volunteer mentor for early-career operators.",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Volunteer mentor for early-career operators.",
                    },
                  ],
                },
              ],
            },
          },
        ],
        structuredContent: null,
      },
    ],
  };
}

test.describe("CVForge preview linking", () => {
  test.describe.configure({ mode: "serial" });

  for (const layoutSeed of layoutSeeds) {
    test(`${layoutSeed.label} keeps modal targets in preview mode and routes aliases correctly`, async ({
      page,
    }) => {
      const document = buildSeedCv(layoutSeed.layout);

      await page.addInitScript((seedDocument) => {
        window.localStorage.clear();
        window.localStorage.setItem("cvDocuments", JSON.stringify([seedDocument]));
        window.localStorage.setItem(
          `cv:${seedDocument.id}`,
          JSON.stringify(seedDocument),
        );
        window.localStorage.setItem("cvActiveId", seedDocument.id);
      }, document);

      await page.goto(`${APP_URL}/cv?id=${document.id}`);

      await expect(
        page.locator(
          `[data-renderer-variant="${layoutSeed.rendererVariant}"]`,
        ).first(),
      ).toBeVisible();

      await page.locator('[data-preview-section="contact"]').first().click();
      await expect(
        page.getByRole("dialog", { name: "Edit profile" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page.locator('[data-preview-section="notes"]').first().click();
      await expect(
        page.getByRole("dialog", { name: "Edit profile" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page
        .locator(
          '[data-preview-section="selected_projects"][data-preview-item-id="project-1"]',
        )
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "Edit projects" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page.locator('[data-preview-section="certifications"]').first().click();
      await expect(
        page.getByRole("dialog", { name: "Edit certifications" }),
      ).toBeVisible();
      await expect(
        page.locator('[data-preview-section="certifications"][data-preview-active="true"]').first(),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page.getByRole("button", { name: "Open resume preview" }).click();
      await expect(
        page.getByRole("button", { name: "Back to resume editing" }),
      ).toBeVisible();

      await page
        .locator(
          '[data-preview-section="experience"][data-preview-item-id="exp-2"]',
        )
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "Edit experience" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Back to resume editing" }),
      ).toBeVisible();
      await expect(
        page.locator('[data-entry-id="exp-2"] input').first(),
      ).toBeFocused();
      await page.getByRole("button", { name: "Close" }).click();

      await page
        .locator('[data-preview-section="additional_information"]')
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "Edit Additional Information" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Back to resume editing" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page.locator('[data-preview-section="custom"]').first().click();
      await expect(
        page.getByRole("button", { name: "Open resume preview" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Back to resume editing" }),
      ).toHaveCount(0);

      await page.locator('[data-preview-section="affiliations"]').first().click();
      await expect(
        page.getByRole("dialog", { name: "Edit affiliations" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();

      await page.locator('[data-preview-section="achievements"]').first().click();
      await expect(
        page.getByRole("dialog", { name: "Edit achievements" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
    });
  }
});
