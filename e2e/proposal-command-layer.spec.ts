import { expect, test, type Page } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:4173";
const VIEWPORT_WIDTHS = [390, 480, 768, 1024, 1280, 1440] as const;
const ZOOM_LEVELS = [0.3, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const SAFE_MARGIN = 12;
const GAP = 12;
const EDGE_ALLOWANCE = 12;
const TOLERANCE = 2;

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

async function seedProposalDraft(page: Page) {
  await page.addInitScript(() => {
    const cvDocument = {
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

    window.localStorage.clear();
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
        proposalContent:
          "Dear team,\n\nFreshly generated proposal body with enough content to render the document preview.\n\nBest,",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Operations Associate Proposal",
        proposalDocumentMeta: "Cover letter - Signature",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
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
    window.localStorage.setItem("cvDocuments", JSON.stringify([cvDocument]));
    window.localStorage.setItem(`cv:${cvDocument.id}`, JSON.stringify(cvDocument));
    window.localStorage.setItem("cvActiveId", cvDocument.id);
    window.localStorage.setItem("dasti:proposal-attached-cv-id:v1", cvDocument.id);
  });
}

async function setProposalZoom(page: Page, zoom: number) {
  const slider = page.getByRole("slider", { name: "Proposal zoom" });
  await expect(slider).toBeVisible();
  await slider.evaluate((element, nextZoom) => {
    const input = element as HTMLInputElement;
    input.value = String(nextZoom);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, zoom);
}

async function readCommandLayerGeometry(page: Page) {
  return page.evaluate(() => {
    const rectFrom = (element: Element): Rect => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };

    const get = (testId: string) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (!element) {
        throw new Error(`Missing [data-testid="${testId}"]`);
      }
      return element;
    };

    const stage = get("proposal-canvas");
    const canvas = stage.closest(".dasti-proposal-skeleton-forge") ?? stage;
    const paperHost = get("proposal-paper");
    const paper =
      paperHost.querySelector(
        ".dasti-proposal-sheet__preview-page:not(.dasti-proposal-sheet__preview-page--stacked), .dasti-proposal-document__page, .dasti-document-stage__canvas[data-document-page='true'], .dasti-proposal-sheet__preview-page",
      ) ?? paperHost;
    const toolbar = get("proposal-toolbar");
    const draft = get("proposal-draft-button");
    const ask = get("proposal-ask-handle");
    const askBox =
      ask.closest(".dasti-proposal-skeleton-stage__ask-handle-layer") ?? ask;
    const buttonRects = Array.from(
      toolbar.querySelectorAll("button, [role='button']"),
      rectFrom,
    );
    const visibleDraftLabels = Array.from(
      draft.querySelectorAll<HTMLElement>(".dasti-proposal-skeleton-stage__action-label"),
    )
      .filter((label) => {
        const style = window.getComputedStyle(label);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((label) => ({
        scrollWidth: label.scrollWidth,
        clientWidth: label.clientWidth,
      }));

    const canvasRect = rectFrom(canvas);

    return {
      canvas: {
        ...canvasRect,
        right: window.innerWidth,
        width: window.innerWidth - canvasRect.left,
      },
      paper: rectFrom(paper),
      toolbar: rectFrom(toolbar),
      draft: rectFrom(draft),
      ask: rectFrom(askBox),
      buttonRects,
      toolbarScrollWidth: (toolbar as HTMLElement).scrollWidth,
      toolbarClientWidth: (toolbar as HTMLElement).clientWidth,
      visibleDraftLabels,
    };
  });
}

function intersects(a: Rect, b: Rect) {
  return (
    a.left < b.right - TOLERANCE &&
    a.right > b.left + TOLERANCE &&
    a.top < b.bottom - TOLERANCE &&
    a.bottom > b.top + TOLERANCE
  );
}

test.describe("Proposal Forge command layer", () => {
  for (const viewportWidth of VIEWPORT_WIDTHS) {
    for (const zoom of ZOOM_LEVELS) {
      test(`keeps toolbar and Ask deterministic at ${viewportWidth}px and ${zoom} zoom`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewportWidth, height: 900 });
        await seedProposalDraft(page);
        await page.goto(`${APP_URL}/proposal`);
        await expect(page.getByTestId("proposal-paper")).toBeVisible();

        await setProposalZoom(page, zoom);
        await page.waitForTimeout(50);

        const geometry = await readCommandLayerGeometry(page);
        const { canvas, paper, toolbar, draft, ask } = geometry;
        const rightGutterFits =
          paper.right + GAP + ask.width <= canvas.right - SAFE_MARGIN + TOLERANCE;

        expect(toolbar.width).toBeGreaterThanOrEqual(300 - TOLERANCE);
        expect(geometry.toolbarScrollWidth).toBeLessThanOrEqual(
          geometry.toolbarClientWidth + TOLERANCE,
        );

        for (const buttonRect of geometry.buttonRects) {
          expect(buttonRect.left).toBeGreaterThanOrEqual(toolbar.left - TOLERANCE);
          expect(buttonRect.right).toBeLessThanOrEqual(toolbar.right + TOLERANCE);
          expect(buttonRect.top).toBeGreaterThanOrEqual(toolbar.top - TOLERANCE);
          expect(buttonRect.bottom).toBeLessThanOrEqual(toolbar.bottom + TOLERANCE);
        }

        for (const label of geometry.visibleDraftLabels) {
          expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + TOLERANCE);
        }

        expect(intersects(ask, toolbar)).toBe(false);
        expect(intersects(ask, draft)).toBe(false);

        if (rightGutterFits) {
          expect(ask.left).toBeGreaterThanOrEqual(paper.right + GAP - TOLERANCE);
        } else {
          expect(ask.right).toBeLessThanOrEqual(canvas.right - SAFE_MARGIN + TOLERANCE);
          expect(ask.left).toBeGreaterThanOrEqual(
            Math.min(paper.right - ask.width - EDGE_ALLOWANCE, canvas.left) -
              TOLERANCE,
          );
          expect(ask.top).toBeLessThanOrEqual(paper.top + 56);
        }

        const toolbarCenter = toolbar.left + toolbar.width / 2;
        const paperCenter = paper.left + paper.width / 2;
        const toolbarIsLeftClamped = toolbar.left <= canvas.left + SAFE_MARGIN + TOLERANCE;
        const toolbarIsRightClamped =
          toolbar.right >= canvas.right - SAFE_MARGIN - TOLERANCE;
        if (!toolbarIsLeftClamped && !toolbarIsRightClamped) {
          expect(Math.abs(toolbarCenter - paperCenter)).toBeLessThanOrEqual(TOLERANCE);
        }
      });
    }
  }
});
