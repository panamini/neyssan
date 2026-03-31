import { expect, test } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:4173";

const resumeAlpha = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "sec_profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_1",
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
        },
      ],
    },
  ],
};

const resumeBeta = {
  id: "cv_beta",
  title: "Blake Stone Resume",
  metadata: {
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "sec_profile_beta",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_beta_1",
          name: "Blake Stone",
          desiredPosition: "Program Manager",
        },
      ],
    },
  ],
};

test.describe("Proposal workspace roundtrip", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seed) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "dasti:proposal-compose-draft:v1",
        JSON.stringify({
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes and coordinate communication.",
          proposalType: "cover_letter",
          voicePreset: "signature",
        }),
      );
      window.localStorage.setItem(
        "dasti:proposal-output-draft:v1",
        JSON.stringify({
          proposalContent: "Freshly generated proposal body.",
          proposalType: "cover_letter",
          proposalVoicePreset: "signature",
          proposalTemplateId: null,
          proposalVerbatiStyle: null,
          proposalStyleLinkMode: "inherit_cv",
          proposalStyleChoice: "auto",
          proposalApplicantName: "Alex Martin",
          proposalApplicantRole: "Operations Associate",
          proposalDocumentTitle: "Operations Associate Proposal",
          proposalDocumentMeta: "Cover letter · Signature",
          generatedProposalId: "proposal_live",
          proposalOutputMode: "edit",
          paletteOverride: null,
          customAccentHex: null,
          templateBundleId: null,
          typographyOverride: null,
          layoutOverride: null,
          proposalDocumentTitleManual: false,
          characterLimitMode: null,
          characterLimitValue: null,
        }),
      );
      window.localStorage.setItem("cvDocuments", JSON.stringify(seed.documents));
      for (const document of seed.documents) {
        window.localStorage.setItem(`cv:${document.id}`, JSON.stringify(document));
      }
      window.localStorage.setItem(
        "dasti:proposal-attached-cv-id:v1",
        seed.proposalAttachedCvId,
      );
      window.localStorage.setItem("cvActiveId", seed.activeCvId);
    }, {
      documents: [resumeAlpha, resumeBeta],
      proposalAttachedCvId: resumeAlpha.id,
      activeCvId: resumeAlpha.id,
    });
  });

  test("keeps proposal and resume workspace state through a resume detour", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/proposal`);

    await expect(
      page.getByRole("link", {
        name: /Operations Associate Proposal/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Operations Associate — Alex Martin/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Freshly generated proposal body.").first()).toBeVisible();

    await page
      .getByRole("link", {
        name: /Operations Associate — Alex Martin/i,
      })
      .click();
    await expect(page).toHaveURL(/\/cv/);

    await expect(
      page.getByRole("link", {
        name: /Operations Associate Proposal/i,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", {
        name: /Operations Associate Proposal/i,
      })
      .click();
    await expect(page).toHaveURL(/\/proposal(?:\?.*)?$/);
    await expect(page.getByText("Freshly generated proposal body.").first()).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Operations Associate — Alex Martin/i,
      }),
    ).toBeVisible();

    const restoredState = await page.evaluate(() => ({
      compose: JSON.parse(
        window.localStorage.getItem("dasti:proposal-compose-draft:v1") ?? "{}",
      ),
      output: JSON.parse(
        window.localStorage.getItem("dasti:proposal-output-draft:v1") ?? "{}",
      ),
      activeCvId: window.localStorage.getItem("cvActiveId"),
    }));

    expect(restoredState.compose.jobTitle).toBe("Operations Associate");
    expect(restoredState.compose.jobDescription).toBe(
      "Support recurring processes and coordinate communication.",
    );
    expect(restoredState.output.proposalContent).toBe(
      "Freshly generated proposal body.",
    );
    expect(restoredState.activeCvId).toBe("cv_alpha");
  });

  test("keeps the proposal-attached CV when resume activates a different document", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/proposal`);

    await expect(
      page.getByRole("link", {
        name: /Operations Associate — Alex Martin/i,
      }),
    ).toBeVisible();

    await page.goto(`${APP_URL}/cv?id=cv_beta`);
    await expect(page).toHaveURL(/\/cv\?id=cv_beta$/);
    await page.waitForFunction(
      () => window.localStorage.getItem("cvActiveId") === "cv_beta",
    );

    await page
      .getByRole("link", {
        name: /Operations Associate Proposal/i,
      })
      .click();

    await expect(page).toHaveURL(/\/proposal(?:\?.*)?$/);
    await expect(page.getByText("Freshly generated proposal body.").first()).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: /Operations Associate — Alex Martin/i,
      }),
    ).toBeVisible();

    const restoredState = await page.evaluate(() => ({
      proposalAttachedCvId: window.localStorage.getItem(
        "dasti:proposal-attached-cv-id:v1",
      ),
      activeCvId: window.localStorage.getItem("cvActiveId"),
    }));

    expect(restoredState).toEqual({
      proposalAttachedCvId: "cv_alpha",
      activeCvId: "cv_beta",
    });
  });

  test("keeps proposal input and output after opening the selected resume in Resume and returning", async ({
    page,
  }) => {
    await page.goto(`${APP_URL}/proposal`);

    await page.getByRole("button", { name: "Choose resume" }).click();
    await page
      .getByRole("button", {
        name: /Operations Associate — Alex Martin.*Draft resume/i,
      })
      .click();
    await page.getByRole("button", { name: "Edit" }).click();

    await expect(page).toHaveURL(/\/cv\?id=cv_alpha$/);
    await expect(
      page.getByRole("link", {
        name: /Operations Associate Proposal/i,
      }),
    ).toBeVisible();

    await page
      .getByRole("link", {
        name: /Operations Associate Proposal/i,
      })
      .click();

    await expect(page).toHaveURL(/\/proposal(?:\?.*)?$/);
    await expect(page.getByText("Freshly generated proposal body.").first()).toBeVisible();
    await expect(page.locator("#jobTitle")).toHaveValue("Operations Associate");
    await expect(page.locator("#jobDescription")).toHaveValue(
      "Support recurring processes and coordinate communication.",
    );
  });
});
