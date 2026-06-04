import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const FOUNDATION_CSS = readFileSync("src/styles/foundation.css", "utf8");
const PRODUCT_PROPOSAL_CSS = readFileSync(
  "src/styles/product-proposal.css",
  "utf8",
);
const PRODUCT_CV_CSS = readFileSync("src/styles/product-cv.css", "utf8");
const RESUME_PREVIEW_CSS = readFileSync(
  "src/features/verbati/resume/resume-preview.css",
  "utf8",
);

type BandMeasurement = {
  viewport: { width: number; height: number };
  paperTop: number;
  firstContentTop: number;
  offset: number;
  shell: {
    top: number;
    background: string;
    boxShadow: string;
    paddingTop: string;
  };
  canvas: {
    top: number;
    background: string;
    boxShadow: string;
  };
  templateCanvas: {
    top: number;
    background: string;
    boxShadow: string;
  } | null;
  resumePreviewShell: {
    top: number;
    background: string;
    boxShadow: string;
    paddingTop: string;
  } | null;
};

async function mountCvPaperProbe(page: Page, width: number) {
  await page.setViewportSize({ width, height: 697 });
  await page.setContent(`
    <style>
      ${FOUNDATION_CSS}
      ${PRODUCT_PROPOSAL_CSS}
      ${PRODUCT_CV_CSS}
      ${RESUME_PREVIEW_CSS}

      html,
      body {
        margin: 0;
        width: 100%;
        min-height: 100%;
        background: var(--sf2);
      }

      .probe-toolbar {
        height: 44px;
      }

      .probe-content {
        padding: 0;
      }

      .resume-template-renderer {
        display: grid;
        gap: 20px;
        align-content: start;
        width: 860px;
        min-height: 1217px;
      }

      .resume-template-page-shell {
        width: 860px;
        min-height: 1217px;
        height: 1217px;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
      }

      .resume-template-page-canvas {
        width: 860px;
        min-height: 1217px;
        height: 1217px;
        box-sizing: border-box;
        background: var(--paper);
        box-shadow:
          0 1px 2px rgba(20, 20, 20, 0.06),
          0 18px 36px rgba(20, 20, 20, 0.08);
        position: absolute;
        inset: 0 auto auto 0;
      }

      .probe-first-content {
        margin-top: 44px;
        margin-left: 56px;
        font-size: 42px;
        line-height: 1;
      }
    </style>

    <main class="probe-content">
      <div class="dasti-cv-skeleton-forge">
        <section class="dasti-cv-skeleton-forge__stage">
          <div class="probe-toolbar" aria-label="CV toolbar"></div>
          <div class="dasti-cv-paper-stage" data-cv-workspace-mode="edit">
            <div class="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-panel">
              <div
                class="dasti-resume-mini-preview theme-resume-calm theme-resume-calm--single"
                data-live-resume-preview="true"
                data-style-layout="workshop"
                data-style-typography="editorial"
                data-renderer-variant="editorialsidebar"
              >
                <div class="dasti-document-stage-chassis">
                  <div
                    class="dasti-doc-viewport dasti-doc-viewport--resume dasti-doc-viewport--resume-panel"
                    data-stage-mode="fit"
                    data-overflow-x="false"
                    data-overflow-y="false"
                    data-document-stage="true"
                    data-scroll-mode="natural"
                    style="width: 860px; height: 1217px;"
                  >
                    <div
                      class="dasti-document-stage__canvas"
                      data-testid="cv-paper"
                      data-document-page="true"
                      data-document-page-count="1"
                      data-interactive="true"
                      style="width: 860px; height: 1217px;"
                    >
                      <div
                        class="resume-template-renderer"
                        data-testid="resume-template-renderer"
                        data-resume-template-id="editorial-sidebar"
                      >
                        <div
                          class="resume-template-page-shell"
                          data-resume-template-page-shell="true"
                          data-resume-template-page-index="1"
                        >
                          <div class="resume-template-page-canvas">
                            <h1 class="probe-first-content">JESSICA CLAIRE</h1>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  `);
}

async function mountEditorialSidebarLegacyProbe(page: Page, width: number) {
  await page.setViewportSize({ width, height: 697 });
  await page.setContent(`
    <style>
      ${FOUNDATION_CSS}
      ${PRODUCT_PROPOSAL_CSS}
      ${PRODUCT_CV_CSS}
      ${RESUME_PREVIEW_CSS}

      html,
      body {
        margin: 0;
        width: 100%;
        min-height: 100%;
        background: var(--sf2);
      }

      .probe-toolbar {
        height: 44px;
      }

      .resume-page {
        width: 100%;
        min-height: 100%;
      }

      .probe-first-content {
        margin: 0;
        padding-top: 76px;
        padding-left: 56px;
        font-size: 42px;
        line-height: 1;
      }
    </style>

    <main class="probe-content">
      <div class="dasti-cv-skeleton-forge">
        <section class="dasti-cv-skeleton-forge__stage">
          <div class="probe-toolbar" aria-label="CV toolbar"></div>
          <div class="dasti-cv-paper-stage dasti-cv-page-preview-stage" data-cv-workspace-mode="preview">
            <div class="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-panel">
              <div
                class="dasti-resume-mini-preview theme-resume-calm theme-resume-calm--single"
                data-live-resume-preview="true"
                data-renderer-variant="editorialsidebar"
              >
                <div class="dasti-document-stage-chassis">
                  <div
                    class="dasti-doc-viewport dasti-doc-viewport--resume dasti-doc-viewport--resume-panel"
                    data-stage-mode="fit"
                    data-document-stage="true"
                    data-scroll-mode="natural"
                    style="width: 860px; height: 1217px;"
                  >
                    <div
                      class="dasti-document-stage__canvas"
                      data-testid="cv-paper"
                      data-document-page="true"
                      style="width: 860px; height: 1217px;"
                    >
                      <div class="resume-preview-shell resume-preview-shell--single">
                        <div class="resume-page-frame">
                          <div class="resume-page-stage">
                            <article class="resume-page resume-page--editorialsidebar">
                              <div class="resume-inner resume-inner--editorialsidebar">
                                <h1 class="probe-first-content name name--editorialsidebar">
                                  JESSICA CLAIRE
                                </h1>
                              </div>
                            </article>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  `);
}

async function measurePaperBand(page: Page): Promise<BandMeasurement> {
  return page.evaluate(() => {
    function rect(selector: string) {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      return node.getBoundingClientRect();
    }

    function computed(selector: string) {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      return window.getComputedStyle(node);
    }
    function optionalRectAndStyle(selector: string) {
      const node = document.querySelector(selector);
      if (!node) return null;
      const elementRect = node.getBoundingClientRect();
      const elementStyle = window.getComputedStyle(node);
      return {
        top: elementRect.top,
        background: elementStyle.background,
        boxShadow: elementStyle.boxShadow,
      };
    }
    function optionalShell(selector: string) {
      const node = document.querySelector(selector);
      if (!node) return null;
      const elementRect = node.getBoundingClientRect();
      const elementStyle = window.getComputedStyle(node);
      return {
        top: elementRect.top,
        background: elementStyle.background,
        boxShadow: elementStyle.boxShadow,
        paddingTop: elementStyle.paddingTop,
      };
    }

    const paperRect = rect('[data-testid="cv-paper"]');
    const firstContentRect = rect(".probe-first-content");
    const shellStyle = computed(".dasti-doc-viewer-shell--resume-panel");
    const canvasStyle = computed(
      '.dasti-document-stage__canvas[data-document-page="true"]',
    );
    const templateCanvas = optionalRectAndStyle(".resume-template-page-canvas");

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      paperTop: paperRect.top,
      firstContentTop: firstContentRect.top,
      offset: firstContentRect.top - paperRect.top,
      shell: {
        top: rect(".dasti-doc-viewer-shell--resume-panel").top,
        background: shellStyle.background,
        boxShadow: shellStyle.boxShadow,
        paddingTop: shellStyle.paddingTop,
      },
      canvas: {
        top: paperRect.top,
        background: canvasStyle.background,
        boxShadow: canvasStyle.boxShadow,
      },
      templateCanvas,
      resumePreviewShell: optionalShell(".resume-preview-shell--single"),
    };
  });
}

test.describe("CV Forge paper top band", () => {
  test("keeps the first template renderer content offset stable across compact and expanded widths", async ({
    page,
  }) => {
    await mountCvPaperProbe(page, 904);
    const compact = await measurePaperBand(page);

    await mountCvPaperProbe(page, 1188);
    const expanded = await measurePaperBand(page);

    expect(Math.abs(compact.offset - expanded.offset)).toBeLessThanOrEqual(1);
  });
});

test.describe("CV Forge legacy Editorial Sidebar paper top band", () => {
  test("keeps the single resume shell from adding compact-only padding inside the paper", async ({
    page,
  }) => {
    await mountEditorialSidebarLegacyProbe(page, 904);
    const compact = await measurePaperBand(page);

    await mountEditorialSidebarLegacyProbe(page, 1188);
    const expanded = await measurePaperBand(page);

    expect(Math.abs(compact.offset - expanded.offset)).toBeLessThanOrEqual(1);
    expect(compact.resumePreviewShell?.paddingTop).toBe("0px");
    expect(expanded.resumePreviewShell?.paddingTop).toBe("0px");
  });
});
