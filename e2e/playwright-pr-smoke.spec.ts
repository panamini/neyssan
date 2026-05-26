import { expect, test } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:5173";

const smokeCv = {
  id: "playwright_smoke_cv",
  title: "Smoke Candidate Resume",
  metadata: {
    createdAt: "2026-05-27T00:00:00.000Z",
    updatedAt: "2026-05-27T00:00:00.000Z",
    version: 1,
    verbatiStyle: {
      layout: "swiss",
      typography: "quiet-editorial",
      palette: "sauge",
    },
  },
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile-item",
          name: "Smoke Candidate",
          desiredPosition: "Operations Associate",
          email: "smoke@example.com",
        },
      ],
    },
    {
      id: "summary",
      type: "summary",
      title: "Summary",
      blocks: [],
      structuredContent: [
        {
          id: "summary-item",
          summary: "Seeded smoke profile used by the PR Playwright check.",
        },
      ],
    },
  ],
};

async function seedSmokeWorkspace(page: import("@playwright/test").Page) {
  await page.addInitScript((cvDocument) => {
    window.localStorage.clear();
    window.localStorage.setItem("dasti:cv-forge-workspace-mode:v1", "preview");
    window.localStorage.setItem("cvDocuments", JSON.stringify([cvDocument]));
    window.localStorage.setItem(`cv:${cvDocument.id}`, JSON.stringify(cvDocument));
    window.localStorage.setItem("cvActiveId", cvDocument.id);
    window.localStorage.setItem("dasti:proposal-attached-cv-id:v1", cvDocument.id);
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription: "Support recurring processes and coordinate communication.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    window.localStorage.setItem(
      "dasti:proposal-output-draft:v1",
      JSON.stringify({
        proposalContent: "Dear team,\n\nSmoke proposal body.\n\nBest,",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalApplicantName: "Smoke Candidate",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Smoke Proposal",
        proposalDocumentMeta: "Cover letter - Smoke",
        generatedProposalId: "playwright_smoke_proposal",
        proposalOutputMode: "preview",
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
      }),
    );
  }, smokeCv);
}

test.describe("PR Playwright smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedSmokeWorkspace(page);
  });

  function proposalStage(page: import("@playwright/test").Page) {
    return page.getByRole("region", { name: "Proposal document stage" });
  }

  test("loads the seeded CV preview and opens the profile editor panel", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/cv?id=${smokeCv.id}`);

    await expect(page.getByText("Smoke Candidate").first()).toBeVisible();
    await expect(
      page.locator('[data-renderer-variant="swissminima"]').first(),
    ).toBeVisible();

    await page.locator('[data-preview-section="contact"]').first().click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Profile" }),
    ).toBeVisible();
  });

  test("loads the seeded proposal workspace and toggles edit/preview mode", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/proposal`);

    await expect(proposalStage(page)).toBeVisible();
    await expect(proposalStage(page)).toContainText("Smoke proposal body.");
    await expect(
      page.getByRole("button", { name: "Edit Proposal title" }),
    ).toBeVisible();

    const toolbar = page.getByTestId("proposal-toolbar");
    await toolbar.getByRole("button", { name: "Edit proposal" }).click();
    await expect(page.locator(".dasti-proposal-editor-page")).toBeVisible();

    await toolbar.getByRole("button", { name: "Preview proposal" }).click();
    await expect(proposalStage(page)).toContainText("Smoke proposal body.");
  });
});
