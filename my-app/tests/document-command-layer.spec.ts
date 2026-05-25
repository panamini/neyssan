import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  computeDocumentCommandLayerLayout,
  getCommandLayerLabelDensity,
  getCommandLayerToolbarDensity,
  type CommandLayerRect,
} from "../src/lib/document-command-layer-layout";

const VIEWPORT_WIDTHS = [390, 480, 768, 1024, 1280] as const;
const ZOOM_LEVELS = [0.3, 0.5, 0.75, 1, 1.5, 2] as const;
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const PRODUCT_PROPOSAL_CSS = readFileSync(
  "src/styles/product-proposal.css",
  "utf8",
);
const PRODUCT_CV_CSS = readFileSync("src/styles/product-cv.css", "utf8");

type Surface = "cv" | "proposal";

function naturalWidthFor(surface: Surface) {
  return surface === "proposal" ? 680 : 520;
}

async function mountProbe(page: Page, viewportWidth: number, zoom: number) {
  await page.setViewportSize({ width: viewportWidth, height: 760 });
  const paperWidth = A4_WIDTH * zoom;
  const paperHeight = A4_HEIGHT * zoom;
  const paperLeft = Math.max(16, (viewportWidth - paperWidth) / 2);
  await page.setContent(`
    <style>
      :root {
        --header-height: 54px;
        --space-1: 4px;
        --space-2: 12px;
        --space-3: 16px;
        --space-4: 24px;
        --control-sm: 32px;
        --document-viewer-toolbar-block-size: 44px;
        --radius-card: 8px;
        --radius-control: 6px;
        --radius-toolbar-control: 6px;
        --radius-toolbar-shell: 8px;
        --radius-pill: 999px;
        --tx: 12px;
        --tm2: #565656;
        --ti: #171717;
        --sf1: #ffffff;
        --color-text: #171717;
        --color-text-muted: #666666;
        --color-border: #d7d7d7;
        --color-border-contrast: #343434;
        --color-border-selected: #246bfe;
        --color-accent: #246bfe;
        --color-accent-hover: #1f56c9;
        --color-surface: #ffffff;
        --color-surface-2: #f5f5f5;
        --color-surface-raised: #ffffff;
        --proposal-chrome-toolbar-gap: 8px;
        --proposal-chrome-tight-gap: 4px;
        --proposal-chrome-shell-padding: 6px;
        --proposal-chrome-toolbar-border: #d7d7d7;
        --proposal-chrome-toolbar-bg: #ffffff;
        --proposal-chrome-control-hover-bg: #f5f5f5;
        --proposal-chrome-control-active-bg: #ececec;
        --proposal-chrome-control-active-border: #d7d7d7;
        --shadow-sm: none;
        --shadow-frost: none;
        --frost-saturate: 1;
        --frost-blur: 0px;
      }
      ${PRODUCT_PROPOSAL_CSS}
      ${PRODUCT_CV_CSS}
      body { margin: 0; }
      .dark { color-scheme: dark; }
      .canvas { position: relative; width: ${viewportWidth}px; height: 760px; overflow: visible; }
      .paper { position: absolute; left: ${paperLeft}px; top: 112px; width: ${paperWidth}px; height: ${paperHeight}px; background: white; }
    </style>
    <main class="canvas" data-testid="canvas">
      <section class="dasti-cv-skeleton-forge__stage dasti-proposal-skeleton-stage" data-testid="cv-stage">
        <div class="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips" data-testid="cv-toolbar">
          <div class="dasti-cv-stage-bar dasti-proposal-skeleton-stage__toolbar-main" role="group" aria-label="CV toolbar">
            <div class="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document dasti-cv-stage-bar__actions">
              <button class="dasti-icon-button dasti-proposal-mode-toggle dasti-cv-mode-toggle--single" aria-label="Switch view">E</button>
              <button class="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action" aria-label="Sections"><span aria-hidden="true">S</span><span class="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">Sections</span></button>
              <button class="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action" aria-label="Design"><span aria-hidden="true">D</span><span class="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">Design</span></button>
              <button class="dasti-proposal-skeleton-stage__primary-action dasti-cv-stage-bar__primary-action" aria-label="Templates"><span aria-hidden="true">T</span><span class="dasti-proposal-skeleton-stage__action-label dasti-cv-stage-bar__action-label">Templates</span></button>
            </div>
          </div>
        </div>
        <div class="dasti-proposal-skeleton-stage__ask-handle-layer"><button class="dasti-icon-button dasti-proposal-skeleton-stage__ask-handle" data-testid="cv-ask-handle" aria-label="Ask">?</button></div>
      </section>
      <section class="dasti-proposal-skeleton-stage" data-testid="proposal-stage">
        <div class="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips" data-testid="proposal-toolbar">
          <div class="dasti-proposal-skeleton-stage__toolbar-main" role="group" aria-label="Proposal toolbar">
            <div class="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document">
              <button class="dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--single" aria-label="Switch view">E</button>
              <button class="dasti-proposal-skeleton-stage__primary-action" aria-label="Heading"><span aria-hidden="true">H</span><span class="dasti-proposal-skeleton-stage__action-label">Heading</span></button>
              <button class="dasti-proposal-skeleton-stage__primary-action" aria-label="Design"><span aria-hidden="true">D</span><span class="dasti-proposal-skeleton-stage__action-label">Design</span></button>
              <button class="dasti-proposal-skeleton-stage__primary-action" aria-label="Templates"><span aria-hidden="true">T</span><span class="dasti-proposal-skeleton-stage__action-label">Templates</span></button>
            </div>
            <div class="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--writing">
              <button class="dasti-proposal-skeleton-stage__primary-action dasti-proposal-skeleton-stage__primary-action--draft" data-testid="proposal-draft" aria-label="Draft proposal"><span aria-hidden="true">P</span><span class="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--full">Draft proposal</span><span class="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--short">Draft</span></button>
            </div>
          </div>
        </div>
        <div class="dasti-proposal-skeleton-stage__ask-handle-layer"><button class="dasti-icon-button dasti-proposal-skeleton-stage__ask-handle" data-testid="proposal-ask-handle" aria-label="Ask">?</button></div>
      </section>
      <article class="paper" data-testid="paper"></article>
    </main>
  `);
}

async function rectFor(page: Page, testId: string): Promise<CommandLayerRect> {
  return page.getByTestId(testId).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function applyLayout(page: Page, surface: Surface, zoom: number) {
  const canvasRect = await rectFor(page, "canvas");
  const paperRect = await rectFor(page, "paper");
  const layout = computeDocumentCommandLayerLayout({
    canvasRect,
    paperRect,
    zoom,
    toolbarNaturalWidth: naturalWidthFor(surface),
    toolbarMinWidth: 300,
    toolbarHeight: 44,
    stickyTop: 66,
    askHandle: {
      iconWidth: 32,
      height: 32,
    },
    safeMargin: 12,
    gap: 12,
    askOffsetFromPaperTop: 16,
    viewportWidth: canvasRect.width,
  });

  const density = getCommandLayerToolbarDensity(layout.toolbarMode);
  const draftDensity = getCommandLayerLabelDensity(layout.draftLabelMode);
  await page.getByTestId(`${surface}-stage`).evaluate(
    (stage, data) => {
      if (data.density) {
        stage.setAttribute("data-toolbar-density", data.density);
      } else {
        stage.removeAttribute("data-toolbar-density");
      }
      stage.setAttribute("data-toolbar-mode", data.toolbarMode);
      stage.setAttribute("data-mode-control-mode", data.modeControlMode);
      stage.setAttribute("data-ask-mode", data.askMode);
      stage.setAttribute("data-ask-placement", data.askMode === "edgeTab" ? "edge-tab" : "outside");
      stage.setAttribute("data-ask-density", "icon");
      if (data.draftDensity) stage.setAttribute("data-draft-density", data.draftDensity);
      stage.setAttribute("data-draft-label-mode", data.draftLabelMode);
    },
    {
      density,
      draftDensity,
      toolbarMode: layout.toolbarMode,
      modeControlMode: layout.modeControlMode,
      askMode: layout.askMode,
      draftLabelMode: layout.draftLabelMode,
    },
  );
  await page.getByTestId(`${surface}-toolbar`).evaluate((toolbar, rect) => {
    Object.assign((toolbar as HTMLElement).style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }, layout.toolbarRect);
  await page.getByTestId(`${surface}-ask-handle`).evaluate((ask, rect) => {
    Object.assign((ask as HTMLElement).style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }, layout.askRect);

  return {
    layout,
    toolbarRect: await rectFor(page, `${surface}-toolbar`),
    askRect: await rectFor(page, `${surface}-ask-handle`),
    secondaryLabelsVisible: await page
      .getByTestId(`${surface}-toolbar`)
      .locator(
        ".dasti-proposal-skeleton-stage__actions--document .dasti-proposal-skeleton-stage__action-label",
      )
      .evaluateAll((labels) =>
        labels.map((label) => getComputedStyle(label).display !== "none"),
      ),
    buttonRects: await page
      .getByTestId(`${surface}-toolbar`)
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          };
        }),
      ),
  };
}

function rectsOverlap(
  a: {
    left: number;
    top: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
  },
  b: {
    left: number;
    top: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
  },
) {
  const aRight = a.right ?? a.left + (a.width ?? 0);
  const aBottom = a.bottom ?? a.top + (a.height ?? 0);
  const bRight = b.right ?? b.left + (b.width ?? 0);
  const bBottom = b.bottom ?? b.top + (b.height ?? 0);
  return (
    a.left < bRight && aRight > b.left && a.top < bBottom && aBottom > b.top
  );
}

test.describe("document command layer DOM probes", () => {
  for (const viewportWidth of VIEWPORT_WIDTHS) {
    for (const zoom of ZOOM_LEVELS) {
      test(`keeps CV and Proposal Ask visible and command-layer aligned at ${viewportWidth}px ${zoom}x`, async ({
        page,
      }) => {
        await mountProbe(page, viewportWidth, zoom);
        const cv = await applyLayout(page, "cv", zoom);
        const proposal = await applyLayout(page, "proposal", zoom);

        expect(cv.askRect.top).toBeCloseTo(cv.layout.commandLayerY, 1);
        expect(proposal.askRect.top).toBeCloseTo(
          proposal.layout.commandLayerY,
          1,
        );
        expect(cv.askRect.top).toBeCloseTo(proposal.askRect.top, 1);
        expect(cv.askRect.left).toBeGreaterThanOrEqual(0);
        expect(proposal.askRect.left).toBeGreaterThanOrEqual(0);
        expect(cv.askRect.left).toBeLessThanOrEqual(viewportWidth);
        expect(proposal.askRect.left).toBeLessThanOrEqual(viewportWidth);
        expect(cv.toolbarRect.top).toBeCloseTo(proposal.toolbarRect.top, 1);
        expect(rectsOverlap(cv.askRect, cv.toolbarRect)).toBe(false);
        expect(rectsOverlap(proposal.askRect, proposal.toolbarRect)).toBe(
          false,
        );
        for (const result of [cv, proposal]) {
          for (const button of result.buttonRects) {
            expect(button.left).toBeGreaterThanOrEqual(
              result.toolbarRect.left - 0.5,
            );
            expect(button.right).toBeLessThanOrEqual(
              result.toolbarRect.left + result.toolbarRect.width + 0.5,
            );
          }
          for (let index = 1; index < result.buttonRects.length; index += 1) {
            expect(
              rectsOverlap(result.buttonRects[index - 1], result.buttonRects[index]),
            ).toBe(false);
          }
        }
      });
    }
  }

  test("hides CV secondary labels when Proposal density hides equivalent labels", async ({
    page,
  }) => {
    await mountProbe(page, 390, 0.3);
    const cv = await applyLayout(page, "cv", 0.3);
    const proposal = await applyLayout(page, "proposal", 0.3);

    expect(cv.layout.toolbarMode).toBe("ultraCompact");
    expect(proposal.layout.toolbarMode).toBe("ultraCompact");
    expect(cv.secondaryLabelsVisible).toEqual([false, false, false]);
    expect(proposal.secondaryLabelsVisible).toEqual([false, false, false]);
    await expect(page.getByTestId("proposal-draft")).toBeVisible();
    await expect(page.getByTestId("cv-toolbar")).not.toContainText("Draft");
  });

  for (const zoom of [0.3, 0.67, 0.87, 1.12]) {
    test(`keeps dark collapsed command layer stable at ${zoom}x`, async ({
      page,
    }) => {
      await mountProbe(page, 480, zoom);
      await page.locator("html").evaluate((html) => html.classList.add("dark"));
      const cv = await applyLayout(page, "cv", zoom);
      const proposal = await applyLayout(page, "proposal", zoom);

      expect(rectsOverlap(cv.askRect, cv.toolbarRect)).toBe(false);
      expect(rectsOverlap(proposal.askRect, proposal.toolbarRect)).toBe(false);
      expect(cv.askRect.top).toBeCloseTo(proposal.askRect.top, 1);
      expect(page.getByTestId("proposal-draft")).toBeVisible();
      await expect(page.getByTestId("cv-toolbar")).not.toContainText("Draft");
      if (
        cv.layout.toolbarMode === "compact" ||
        cv.layout.toolbarMode === "ultraCompact"
      ) {
        expect(cv.secondaryLabelsVisible).toEqual([false, false, false]);
      }
    });
  }

  test("does not jump Ask down across adjacent constrained widths", async ({
    page,
  }) => {
    const tops: number[] = [];
    for (const viewportWidth of [520, 540, 560]) {
      await mountProbe(page, viewportWidth, 0.3);
      const cv = await applyLayout(page, "cv", 0.3);
      tops.push(cv.askRect.top);
    }

    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  });
});
