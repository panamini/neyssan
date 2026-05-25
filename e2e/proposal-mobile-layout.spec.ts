import { expect, test } from "@playwright/test";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:4173";

const previewLayoutSelectors = [
  ".dasti-proposal-skeleton-stage__bar",
  ".dasti-proposal-skeleton-forge__stage",
  ".dasti-proposal-skeleton-stage__paper",
  ".dasti-proposal-output-shell--workspace",
  ".dasti-doc-viewer-shell__surface",
  ".dasti-proposal-sheet-frame",
  ".dasti-proposal-sheet__body--document-viewer",
  ".dasti-document-stage-chassis",
  ".dasti-proposal-sheet__preview-stage",
  ".dasti-proposal-sheet__preview-scale-shell",
  ".dasti-proposal-document__page",
  ".dasti-proposal-sheet__preview-page",
] as const;

const editLayoutSelectors = [
  ".dasti-proposal-skeleton-forge",
  ".dasti-proposal-skeleton-stage__bar",
  ".dasti-proposal-skeleton-forge__stage",
  ".dasti-proposal-skeleton-stage__paper",
  ".dasti-proposal-output-shell--workspace",
  ".dasti-doc-viewer-shell__surface",
  ".dasti-proposal-sheet-frame",
  ".dasti-proposal-sheet__body--document-viewer",
  ".dasti-document-stage-chassis",
  ".dasti-proposal-sheet__preview-stage",
  ".dasti-proposal-sheet__preview-page",
] as const;

type ProposalOutputMode = "edit" | "preview";
type LayoutSelector =
  | (typeof previewLayoutSelectors)[number]
  | (typeof editLayoutSelectors)[number];

test.describe("Proposal Forge mobile document geometry", () => {
  async function seedProposalDraft(
    page: import("@playwright/test").Page,
    outputMode: ProposalOutputMode = "preview",
    proposalContent =
      "Dear team,\n\nFreshly generated proposal body with enough content to render the document preview.\n\nBest,",
  ) {
    await page.addInitScript(({ mode, content }) => {
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
          jobDescription:
            "Support recurring processes and coordinate communication.",
          proposalType: "cover_letter",
          voicePreset: "signature",
        }),
      );
      window.localStorage.setItem(
        "dasti:proposal-output-draft:v1",
        JSON.stringify({
          proposalContent: content,
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
          proposalOutputMode: mode,
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
      window.localStorage.setItem(
        `cv:${cvDocument.id}`,
        JSON.stringify(cvDocument),
      );
      window.localStorage.setItem("cvActiveId", cvDocument.id);
      window.localStorage.setItem(
        "dasti:proposal-attached-cv-id:v1",
        cvDocument.id,
      );
    }, { mode: outputMode, content: proposalContent });
  }

  async function readGeometry(
    page: import("@playwright/test").Page,
    selectors: readonly LayoutSelector[] = previewLayoutSelectors,
  ) {
    return page.evaluate((selectors) => {
      const viewportWidth = document.documentElement.clientWidth;
      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        rects: selectors.map((selector) => {
          const element = document.querySelector(selector);
          if (!element) {
            return { selector, missing: true };
          }
          const rect = element.getBoundingClientRect();
          return {
            selector,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            display: window.getComputedStyle(element).display,
            gridTemplateColumns:
              window.getComputedStyle(element).gridTemplateColumns,
            justifyContent: window.getComputedStyle(element).justifyContent,
            proposalPaperVisualInlineSize: window
              .getComputedStyle(element)
              .getPropertyValue("--proposal-paper-visual-inline-size"),
            proposalWorkspaceStageInlineSize: window
              .getComputedStyle(element)
              .getPropertyValue("--proposal-workspace-stage-inline-size"),
            transitionDuration:
              window.getComputedStyle(element).transitionDuration,
            animationName: window.getComputedStyle(element).animationName,
            transform: window.getComputedStyle(element).transform,
            missing: false,
          };
        }),
      };
    }, selectors);
  }

  async function readWorkspacePageFit(page: import("@playwright/test").Page) {
    return page.evaluate(() => {
      const toolbar = document.querySelector(
        ".dasti-proposal-skeleton-stage__bar",
      );
      const workspace = document.querySelector(
        ".dasti-proposal-output-shell--workspace",
      );
      if (!toolbar || !workspace) {
        return { missing: true };
      }
      const toolbarRect = toolbar.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();
      const visiblePages = Array.from(
        workspace.querySelectorAll<HTMLElement>(
          ".dasti-proposal-document__page",
        ),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            styles.display !== "none" &&
            styles.visibility !== "hidden" &&
            !element.closest(
              '[hidden], [aria-hidden="true"], .dasti-proposal-document__measurement',
            )
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            text: element.textContent?.replace(/\s+/g, " ").slice(0, 80) ?? "",
          };
        });

      return {
        missing: false,
        viewportWidth: document.documentElement.clientWidth,
        toolbar: {
          left: toolbarRect.left,
          right: toolbarRect.right,
          width: toolbarRect.width,
        },
        workspace: {
          left: workspaceRect.left,
          right: workspaceRect.right,
          width: workspaceRect.width,
        },
        visiblePages,
      };
    });
  }

  function getViolations(
    geometry: Awaited<ReturnType<typeof readGeometry>>,
    requiredVisibleSelectors: ReadonlySet<string>,
  ) {
    const tolerance = 1;
    return geometry.rects.filter(
      (rect) =>
        rect.missing ||
        (requiredVisibleSelectors.has(rect.selector) && rect.width < 1) ||
        rect.left < -tolerance ||
        rect.right > geometry.viewportWidth + tolerance,
    );
  }

  test("keeps the collapsed toolbar, shell, and rendered page inside one centered column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page);

    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();
    await expect(
      page.locator(".dasti-proposal-document__page").first(),
    ).toBeAttached();

    const geometry = await readGeometry(page);
    const violations = getViolations(
      geometry,
      new Set([
        ".dasti-proposal-sheet__preview-stage",
        ".dasti-proposal-sheet__preview-scale-shell",
        ".dasti-proposal-document__page",
        ".dasti-proposal-sheet__preview-page",
      ]),
    );

    expect({
      viewportWidth: geometry.viewportWidth,
      scrollWidth: geometry.scrollWidth,
      violations,
      rects: geometry.rects,
    }).toEqual({
      viewportWidth: 491,
      scrollWidth: 491,
      violations: [],
      rects: expect.any(Array),
    });
    const documentLayout = await page
      .locator(".dasti-proposal-document__page")
      .first()
      .evaluate((element) => ({
        boundingWidth: element.getBoundingClientRect().width,
        layoutWidth: (element as HTMLElement).offsetWidth,
      }));
    expect(documentLayout).toEqual({
      boundingWidth: expect.any(Number),
      layoutWidth: 794,
    });
    expect(documentLayout.boundingWidth).toBeLessThanOrEqual(491);
    expect(
      geometry.rects.find(
        (rect) =>
          rect.selector === ".dasti-proposal-sheet__preview-scale-shell",
      )?.transform,
    ).not.toBe("none");

    const documentInset = await page
      .locator(".dasti-proposal-document__page")
      .first()
      .evaluate((pageElement) => {
        const bodyElement = pageElement.querySelector(
          ".dasti-proposal-document__body",
        );
        if (!bodyElement) {
          return { missing: true };
        }
        const pageRect = pageElement.getBoundingClientRect();
        const bodyRect = bodyElement.getBoundingClientRect();
        return {
          missing: false,
          visualInset: bodyRect.left - pageRect.left,
          layoutInset:
            (bodyElement as HTMLElement).offsetLeft -
            (pageElement as HTMLElement).offsetLeft,
        };
      });
    expect(documentInset).toEqual({
      missing: false,
      visualInset: expect.any(Number),
      layoutInset: expect.any(Number),
    });
    expect(documentInset.visualInset).toBeGreaterThan(40);
    expect(documentInset.layoutInset).toBeGreaterThan(100);
  });

  test("does not keep the old page width for a frame after the viewport collapses", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 700, height: 928 });
    await seedProposalDraft(page);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-document__page").first(),
    ).toBeAttached();
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 491, height: 928 });
    const geometry = await readGeometry(page);

    expect({
      viewportWidth: geometry.viewportWidth,
      violations: getViolations(
        geometry,
        new Set([
          ".dasti-proposal-sheet__preview-stage",
          ".dasti-proposal-sheet__preview-scale-shell",
          ".dasti-proposal-document__page",
          ".dasti-proposal-sheet__preview-page",
        ]),
      ),
      rects: geometry.rects,
    }).toEqual({
      viewportWidth: 491,
      violations: [],
      rects: expect.any(Array),
    });
  });

  test("does not keep the old tiny page scale for a frame after the viewport expands", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-document__page").first(),
    ).toBeAttached();
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 1280, height: 720 });
    const liveScale = await page.evaluate(() => {
      const toolbar = document.querySelector(
        ".dasti-proposal-skeleton-stage__bar",
      );
      const stage = document.querySelector(
        ".dasti-proposal-sheet__preview-stage",
      );
      const frame = document.querySelector(".dasti-proposal-sheet-frame");
      const page = document.querySelector(".dasti-proposal-document__page");
      const shell = document.querySelector(
        ".dasti-proposal-sheet__preview-scale-shell",
      );
      if (!toolbar || !stage || !frame || !page || !shell) {
        return { missing: true };
      }
      const toolbarRect = toolbar.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      return {
        missing: false,
        toolbarLeft: toolbarRect.left,
        toolbarWidth: toolbarRect.width,
        frameLeft: frameRect.left,
        frameWidth: frameRect.width,
        pageWidth: pageRect.width,
        pageLeft: pageRect.left,
        stageWidth: stageRect.width,
        transform: window.getComputedStyle(shell).transform,
      };
    });

    expect(liveScale).toEqual({
      missing: false,
      toolbarLeft: expect.any(Number),
      toolbarWidth: expect.any(Number),
      frameLeft: expect.any(Number),
      frameWidth: expect.any(Number),
      pageWidth: expect.any(Number),
      pageLeft: expect.any(Number),
      stageWidth: expect.any(Number),
      transform: expect.stringMatching(/^matrix\(/),
    });
    expect(liveScale.toolbarWidth).toBeGreaterThan(780);
    expect(liveScale.pageWidth).toBeGreaterThan(780);
    expect(Math.abs(liveScale.pageLeft - liveScale.toolbarLeft)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(liveScale.pageWidth - liveScale.toolbarWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(liveScale.frameLeft - liveScale.toolbarLeft)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(liveScale.frameWidth - liveScale.toolbarWidth)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(liveScale.pageWidth - liveScale.stageWidth)).toBeLessThanOrEqual(
      1,
    );
  });

  test("uses the full desktop page width after expanding in edit mode and switching to preview", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page, "edit");
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-sheet__preview-page--editable"),
    ).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("button", { name: "Preview proposal" }).click();
    await expect(
      page.locator(
        ".dasti-proposal-output-shell--workspace .dasti-proposal-sheet__preview-scale-shell",
      ),
    ).toBeVisible();

    const previewFit = await readWorkspacePageFit(page);
    expect(previewFit).toEqual({
      missing: false,
      viewportWidth: 1280,
      toolbar: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      workspace: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      visiblePages: expect.any(Array),
    });
    expect(previewFit.toolbar.width).toBeGreaterThan(780);
    expect(previewFit.visiblePages).toHaveLength(1);
    expect(previewFit.visiblePages[0]?.width).toBeGreaterThan(780);
    expect(
      Math.abs((previewFit.visiblePages[0]?.left ?? 0) - previewFit.toolbar.left),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        (previewFit.visiblePages[0]?.width ?? 0) - previewFit.toolbar.width,
      ),
    ).toBeLessThanOrEqual(1);
  });

  test("keeps collapsed Proposal undo and redo controls inside the toolbar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page, "edit");

    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-skeleton-stage__bar"),
    ).toBeVisible();

    const toolbarFit = await page.evaluate(() => {
      const toolbar = document.querySelector(
        ".dasti-proposal-skeleton-stage__bar",
      );
      const tone = document.querySelector(
        ".dasti-proposal-skeleton-stage__bar > .ds-tone",
      );
      const rightActions = document.querySelector(
        ".dasti-proposal-skeleton-stage__right-actions",
      );
      const undoButton = document.querySelector(
        '.dasti-proposal-skeleton-stage__right-actions [aria-label="Undo"]',
      );
      const redoButton = document.querySelector(
        '.dasti-proposal-skeleton-stage__right-actions [aria-label="Redo"]',
      );
      if (!toolbar || !tone || !rightActions || !undoButton || !redoButton) {
        return { missing: true };
      }
      const toolbarRect = toolbar.getBoundingClientRect();
      const toneRect = tone.getBoundingClientRect();
      const rightActionsRect = rightActions.getBoundingClientRect();
      const undoRect = undoButton.getBoundingClientRect();
      const redoRect = redoButton.getBoundingClientRect();
      const rightActionsStyles = rightActions
        ? window.getComputedStyle(rightActions)
        : null;
      const toneStyles = window.getComputedStyle(tone);
      return {
        missing: false,
        toolbarWidth: toolbarRect.width,
        toneWidth: toneRect.width,
        toolbarRight: toolbarRect.right,
        toneRight: toneRect.right,
        toolbarLeft: toolbarRect.left,
        toneLeft: toneRect.left,
        rightActionsDisplay: rightActionsStyles?.display ?? null,
        rightActionsRight: rightActionsRect.right,
        undoRight: undoRect.right,
        redoRight: redoRect.right,
        toneDisplay: toneStyles.display,
      };
    });

    expect(toolbarFit).toEqual({
      missing: false,
      toolbarWidth: expect.any(Number),
      toneWidth: expect.any(Number),
      toolbarRight: expect.any(Number),
      toneRight: expect.any(Number),
      toolbarLeft: expect.any(Number),
      toneLeft: expect.any(Number),
      rightActionsDisplay: "flex",
      rightActionsRight: expect.any(Number),
      undoRight: expect.any(Number),
      redoRight: expect.any(Number),
      toneDisplay: "none",
    });
    expect(toolbarFit.toolbarWidth).toBeGreaterThan(320);
    expect(toolbarFit.rightActionsRight).toBeLessThanOrEqual(
      toolbarFit.toolbarRight + 1,
    );
    expect(toolbarFit.undoRight).toBeLessThanOrEqual(toolbarFit.toolbarRight + 1);
    expect(toolbarFit.redoRight).toBeLessThanOrEqual(toolbarFit.toolbarRight + 1);
  });

  test("does not keep the old editable page width for a frame after the viewport collapses", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 700, height: 928 });
    await seedProposalDraft(page, "edit");
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-sheet__preview-page").first(),
    ).toBeVisible();
    await page.waitForTimeout(250);

    await page.setViewportSize({ width: 491, height: 928 });
    const geometry = await readGeometry(page, editLayoutSelectors);

    expect({
      viewportWidth: geometry.viewportWidth,
      violations: getViolations(
        geometry,
        new Set([
          ".dasti-proposal-sheet__preview-stage",
          ".dasti-proposal-sheet__preview-page",
        ]),
      ),
      rects: geometry.rects,
    }).toEqual({
      viewportWidth: 491,
      violations: [],
      rects: expect.any(Array),
    });
  });

  test("keeps the workspace page stable when switching between CV and Proposal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();

    await page.locator('a[href="/cv"]').click();
    await expect(
      page.locator(".dasti-cv-skeleton-forge__stage"),
    ).toBeVisible();
    await page.locator('a[href="/proposal"]').click();
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();

    const frameSamples = await page.evaluate(async () => {
      const read = () => {
        const toolbar = document.querySelector(
          ".dasti-proposal-skeleton-stage__bar",
        );
        const workspace = document.querySelector(
          ".dasti-proposal-output-shell--workspace",
        );
        if (!toolbar || !workspace) {
          return { missing: true };
        }
        const toolbarRect = toolbar.getBoundingClientRect();
        const pages = Array.from(
          workspace.querySelectorAll<HTMLElement>(
            ".dasti-proposal-document__page",
          ),
        )
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              styles.display !== "none" &&
              styles.visibility !== "hidden" &&
              !element.closest(
                '[hidden], [aria-hidden="true"], .dasti-proposal-document__measurement',
              )
            );
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
            };
          });
        return {
          missing: false,
          toolbarLeft: toolbarRect.left,
          toolbarRight: toolbarRect.right,
          toolbarWidth: toolbarRect.width,
          pages,
        };
      };

      const samples: ReturnType<typeof read>[] = [];
      for (let index = 0; index < 12; index += 1) {
        samples.push(read());
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
      }
      return samples;
    });

    for (const sample of frameSamples) {
      expect(sample).toEqual({
        missing: false,
        toolbarLeft: expect.any(Number),
        toolbarRight: expect.any(Number),
        toolbarWidth: expect.any(Number),
        pages: expect.any(Array),
      });
      expect(sample.pages.length).toBeGreaterThan(0);
      for (const pageRect of sample.pages) {
        expect(Math.abs(pageRect.left - sample.toolbarLeft)).toBeLessThanOrEqual(
          1,
        );
        expect(Math.abs(pageRect.width - sample.toolbarWidth)).toBeLessThanOrEqual(
          1,
        );
        expect(pageRect.right).toBeLessThanOrEqual(sample.toolbarRight + 1);
      }
    }

    const finalFit = await readWorkspacePageFit(page);
    expect(finalFit).toEqual({
      missing: false,
      viewportWidth: 491,
      toolbar: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      workspace: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      visiblePages: expect.any(Array),
    });
    expect(finalFit.visiblePages).toHaveLength(1);
    expect(finalFit.visiblePages[0]?.width).toBeGreaterThan(320);
    expect(finalFit.visiblePages[0]?.right).toBeLessThanOrEqual(491);
  });

  test("switches Proposal preview and edit modes without animating the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit proposal" }).click();
    await expect(page.locator(".dasti-proposal-editor-page")).toBeVisible();

    const editFrame = await page.evaluate(() => {
      const editorPage = document.querySelector(".dasti-proposal-editor-page");
      const editablePage = document.querySelector(
        ".dasti-proposal-sheet__preview-page--editable",
      );
      const editorStyles = editorPage
        ? window.getComputedStyle(editorPage)
        : null;
      const pageStyles = editablePage
        ? window.getComputedStyle(editablePage)
        : null;
      const rect = editablePage?.getBoundingClientRect();
      return {
        missing: !editorPage || !editablePage || !rect,
        editorAnimationName: editorStyles?.animationName ?? null,
        editorAnimationDuration: editorStyles?.animationDuration ?? null,
        pageAnimationName: pageStyles?.animationName ?? null,
        pageWidth: rect?.width ?? 0,
        pageRight: rect?.right ?? 0,
      };
    });

    expect(editFrame).toEqual({
      missing: false,
      editorAnimationName: "none",
      editorAnimationDuration: "0s",
      pageAnimationName: "none",
      pageWidth: expect.any(Number),
      pageRight: expect.any(Number),
    });
    expect(editFrame.pageWidth).toBeLessThanOrEqual(322);
    expect(editFrame.pageRight).toBeLessThanOrEqual(491);

    await page.getByRole("button", { name: "Preview proposal" }).click();
    await expect(
      page.locator(
        ".dasti-proposal-output-shell--workspace .dasti-proposal-sheet__preview-scale-shell",
      ),
    ).toBeVisible();
    const previewFrame = await readWorkspacePageFit(page);
    expect(previewFrame).toEqual({
      missing: false,
      viewportWidth: 491,
      toolbar: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      workspace: {
        left: expect.any(Number),
        right: expect.any(Number),
        width: expect.any(Number),
      },
      visiblePages: expect.any(Array),
    });
    expect(previewFrame.visiblePages[0]?.right).toBeLessThanOrEqual(491);
  });

  test("keeps the collapsed CV page stable when leaving Proposal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();

    await page.locator('a[href="/cv"]').click();
    const frameSamples = await page.evaluate(async () => {
      const read = () => {
        const cvStage = document.querySelector(
          ".dasti-cv-skeleton-forge__stage",
        );
        const cvPage = document.querySelector(
          '.dasti-document-stage__canvas[data-document-page="true"]',
        );
        if (!cvStage || !cvPage) {
          return { missing: true };
        }
        const stageRect = cvStage.getBoundingClientRect();
        const pageRect = cvPage.getBoundingClientRect();
        const pageStyles = window.getComputedStyle(cvPage);
        return {
          missing: false,
          stageLeft: stageRect.left,
          stageWidth: stageRect.width,
          pageLeft: pageRect.left,
          pageWidth: pageRect.width,
          pageRight: pageRect.right,
          pageAnimationName: pageStyles.animationName,
          pageTransform: pageStyles.transform,
        };
      };

      const samples: ReturnType<typeof read>[] = [];
      for (let index = 0; index < 12; index += 1) {
        samples.push(read());
        await new Promise<void>((resolve) =>
          window.requestAnimationFrame(() => resolve()),
        );
      }
      return samples;
    });

    for (const sample of frameSamples) {
      expect(sample).toEqual({
        missing: false,
        stageLeft: expect.any(Number),
        stageWidth: expect.any(Number),
        pageLeft: expect.any(Number),
        pageWidth: expect.any(Number),
        pageRight: expect.any(Number),
        pageAnimationName: "none",
        pageTransform: "none",
      });
      expect(sample.stageWidth).toBeLessThanOrEqual(322);
      expect(sample.pageWidth).toBeLessThanOrEqual(322);
      expect(sample.pageRight).toBeLessThanOrEqual(491);
    }
  });

  test("stacks the collapsed Proposal rail below the full readonly preview", async ({
    page,
  }) => {
    const longProposalContent = [
      "Dear Hiring Manager,",
      "",
      "Monitoring building security systems-CCTV feeds, electronic door locks, and lighting controls-is a recurring responsibility that shapes the daily workflow. Each shift involves verifying that cameras and locks are operational, adjusting lighting to maintain visibility without waste, and documenting any irregularities for follow-up. The role also depends on clear communication with visitors, staff, and emergency contacts, whether signing individuals in and out, escorting them through the premises, or reporting maintenance issues that could compromise safety.",
      "",
      "The work extends beyond the front desk, requiring regular patrols of multiple floors and outdoor areas to check for unauthorized access, equipment failures, or environmental hazards like leaks during storms. These rounds ensure that security measures remain effective and that any disruptions are addressed promptly, maintaining continuity for county operations.",
      "",
      "I would welcome the opportunity to discuss my interest in the role.",
    ].join("\n");

    await page.setViewportSize({ width: 491, height: 928 });
    await seedProposalDraft(page, "preview", longProposalContent);
    await page.goto(`${APP_URL}/proposal`);
    await expect(
      page.locator(".dasti-proposal-output-shell--workspace"),
    ).toBeVisible();
    await expect(page.locator(".dasti-proposal-skeleton-rail")).toBeVisible();

    const stackedLayout = await page.evaluate(() => {
      const rail = document.querySelector(".dasti-proposal-skeleton-rail");
      const previewStage = document.querySelector(
        ".dasti-proposal-sheet__preview-stage",
      );
      const previewPage = document.querySelector(
        ".dasti-proposal-sheet__preview-page",
      );
      const outputShell = document.querySelector(
        ".dasti-proposal-output-shell--workspace",
      );
      const viewerShell = document.querySelector(".dasti-doc-viewer-shell");
      const viewerSurface = document.querySelector(
        '.dasti-doc-viewer-shell__surface[data-preview-zoom-footer="true"]',
      );
      const forge = document.querySelector(".dasti-proposal-skeleton-forge");
      if (
        !rail ||
        !previewStage ||
        !previewPage ||
        !outputShell ||
        !viewerShell ||
        !viewerSurface ||
        !forge
      ) {
        return { missing: true };
      }
      const toRect = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          position: styles.position,
          overflow: styles.overflow,
        };
      };
      return {
        missing: false,
        forgeRowGap: Number.parseFloat(window.getComputedStyle(forge).rowGap),
        rail: toRect(rail),
        previewStage: toRect(previewStage),
        previewPage: toRect(previewPage),
        outputShell: toRect(outputShell),
        viewerShell: toRect(viewerShell),
        viewerSurface: toRect(viewerSurface),
      };
    });

    expect(stackedLayout).toEqual({
      missing: false,
      forgeRowGap: expect.any(Number),
      rail: expect.any(Object),
      previewStage: expect.any(Object),
      previewPage: expect.any(Object),
      outputShell: expect.any(Object),
      viewerShell: expect.any(Object),
      viewerSurface: expect.any(Object),
    });
    expect(stackedLayout.viewerShell.height).toBeGreaterThanOrEqual(
      stackedLayout.previewStage.height - 1,
    );
    expect(stackedLayout.outputShell.height).toBeGreaterThanOrEqual(
      stackedLayout.previewStage.height - 1,
    );
    expect(stackedLayout.rail.top).toBeGreaterThanOrEqual(
      stackedLayout.previewStage.bottom + stackedLayout.forgeRowGap - 1,
    );
    expect(stackedLayout.rail.top).toBeGreaterThanOrEqual(
      stackedLayout.previewPage.bottom + stackedLayout.forgeRowGap - 1,
    );
    expect(stackedLayout.forgeRowGap).toBeGreaterThan(8);
  });
});
