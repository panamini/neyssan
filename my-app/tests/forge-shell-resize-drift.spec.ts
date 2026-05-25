import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const FOUNDATION_CSS = readFileSync("src/styles/foundation.css", "utf8");
const PRODUCT_CSS = readFileSync("src/styles/product.css", "utf8");

type MeasuredRect = {
  left: number;
  width: number;
};

async function mountForgeShellProbe(page: Page) {
  await page.setViewportSize({ width: 900, height: 760 });
  await page.setContent(`
    <style>
      ${FOUNDATION_CSS}
      ${PRODUCT_CSS}
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
      }
      .probe-main-surface {
        width: 100%;
        height: 100%;
        background: var(--sf2);
      }
    </style>
    <div class="app-shell" data-forge-panel-open="true" data-forge-panel-mode="overlay">
      <aside class="sb" aria-label="Sidebar">
        <nav class="sb__nav">
          <button class="sb-rail-button" type="button">
            <span class="sb-rail-button__icon">T</span>
            <span class="sb-rail-button__label">Templates</span>
          </button>
        </nav>
      </aside>
      <main class="app-main">
        <header class="app-topbar" data-testid="topbar">
          <span class="app-topbar__context">Topbar</span>
        </header>
        <section class="app-pages" data-testid="pages">
          <div class="probe-main-surface" data-testid="surface"></div>
        </section>
      </main>
      <aside class="forge-template-panel" data-mode="overlay" aria-label="Templates">
        <div class="forge-template-panel__head">
          <span class="forge-template-panel__head-title">Templates</span>
        </div>
      </aside>
    </div>
  `);
}

async function measuredRects(page: Page): Promise<Record<string, MeasuredRect>> {
  return page.evaluate(() => {
    const selectors = {
      shell: ".app-shell",
      sidebar: ".sb",
      main: ".app-main",
      topbar: "[data-testid='topbar']",
      pages: "[data-testid='pages']",
      panel: ".forge-template-panel",
      surface: "[data-testid='surface']",
    } as const;

    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return [
          name,
          {
            left: rect?.left ?? 0,
            width: rect?.width ?? 0,
          },
        ];
      }),
    ) as Record<string, MeasuredRect>;
  });
}

async function activeShellLayoutAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => {
        const target = animation.effect instanceof KeyframeEffect
          ? animation.effect.target
          : null;
        return target instanceof Element ? target.className : "";
      })
      .filter((className) =>
        /\b(sb|forge-template-panel)\b/.test(String(className)),
      ),
  );
}

test.describe("Forge shell resize stability", () => {
  test("settles shell, topbar, pages, and overlay panel immediately across compact rail breakpoint", async ({
    page,
  }) => {
    await mountForgeShellProbe(page);

    await page.setViewportSize({ width: 760, height: 760 });
    const after0 = await measuredRects(page);
    await page.waitForTimeout(50);
    const after50 = await measuredRects(page);
    const activeAnimations = await activeShellLayoutAnimations(page);

    for (const key of ["main", "topbar", "pages", "panel", "surface"] as const) {
      expect(after50[key].left).toBeCloseTo(after0[key].left, 0);
      expect(after50[key].width).toBeCloseTo(after0[key].width, 0);
    }
    expect(activeAnimations).toEqual([]);
  });
});
