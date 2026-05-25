import { expect, test, type Page } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:4173";

const cvDocument = {
  id: "topbar_geometry_cv",
  title: "Jessica Claire",
  metadata: {
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z",
    version: 1,
    verbatiStyle: {
      layout: "two-column",
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
          name: "Jessica Claire",
          desiredPosition: "Target title",
        },
      ],
    },
  ],
};

async function seedForgeDocuments(page: Page) {
  await page.addInitScript(({ cvDocument }) => {
    window.localStorage.clear();
    window.localStorage.setItem("cvDocuments", JSON.stringify([cvDocument]));
    window.localStorage.setItem(`cv:${cvDocument.id}`, JSON.stringify(cvDocument));
    window.localStorage.setItem("cvActiveId", cvDocument.id);
    window.localStorage.setItem(
      "dasti:proposal-attached-cv-id:v1",
      cvDocument.id,
    );
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Building Security Guard",
        jobDescription: "County buildings and grounds",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    window.localStorage.setItem(
      "dasti:proposal-output-draft:v1",
      JSON.stringify({
        proposalContent: "Dear Hiring Manager,\n\nBody.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalDocumentTitle: "Application for the role",
        generatedProposalId: "proposal_topbar",
        proposalOutputMode: "preview",
      }),
    );
  }, { cvDocument });
}

async function readTopbarGeometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        left: box.left,
        right: box.right,
        width: box.width,
        display: style.display,
        opacity: style.opacity,
      };
    };

    const topbar = rect(".app-topbar");
    const account = rect(".app-topbar__account-button");

    return {
      viewportWidth: document.documentElement.clientWidth,
      topbar,
      identity: rect(".app-topbar__doc-identity"),
      title: rect(".app-topbar__doc-title"),
      newButton: rect(".app-topbar__doc-action--new"),
      account,
      accountRightGap:
        account === null ? null : document.documentElement.clientWidth - account.right,
    };
  });
}

test.describe("global topbar document geometry", () => {
  test("keeps CV and Proposal document actions on the same tokenized column", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1180, height: 720 },
      { width: 491, height: 928 },
    ]) {
      await page.setViewportSize(viewport);

      await seedForgeDocuments(page);
      await page.goto(`${APP_URL}/cv`);
      await expect(page.locator(".app-topbar__doc-action--new")).toBeVisible();
      const cv = await readTopbarGeometry(page);

      await seedForgeDocuments(page);
      await page.goto(`${APP_URL}/proposal`);
      await expect(page.locator(".app-topbar__doc-action--new")).toBeVisible();
      const proposal = await readTopbarGeometry(page);

      expect(cv.newButton?.left, `CV new left at ${viewport.width}`).toBeCloseTo(
        proposal.newButton?.left ?? 0,
        0,
      );
      expect(
        cv.accountRightGap,
        `CV account right gap at ${viewport.width}`,
      ).toBeLessThanOrEqual(16);
      expect(
        proposal.accountRightGap,
        `Proposal account right gap at ${viewport.width}`,
      ).toBeLessThanOrEqual(16);
    }
  });

  test("opens the full title editor from the collapsed icon-only identity", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedForgeDocuments(page);
    await page.goto(`${APP_URL}/proposal`);

    const collapsedTitle = page.locator(".app-topbar__doc-title");
    await expect(collapsedTitle).toHaveCSS("opacity", "0");

    await page.getByRole("button", { name: "Edit Proposal title" }).click({
      force: true,
    });

    const titleInput = page.getByRole("textbox", { name: "Proposal title" });
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("Application for the role");

    const editorWidth = await page
      .locator(".app-topbar__doc-title.document-title-editor--editing")
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(editorWidth).toBeGreaterThan(300);
  });
});
