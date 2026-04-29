import { expect, test, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const skeletonUrl = pathToFileURL(
  resolve(process.cwd(), "docs/UI/SKELETON.html"),
).href;

const sections = [
  "buttons",
  "inputs",
  "cards",
  "ai-card",
  "floating-toolbar",
] as const;

async function openSkeleton(page: Page, theme: "light" | "dark") {
  await page.goto(skeletonUrl);
  await page.setViewportSize({ width: 1440, height: 2200 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    }
  });

  if (theme === "dark") {
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } else {
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  }
}

test.describe("ds-v2 visual baselines", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`matches the skeleton primitives in ${theme} mode`, async ({
      browserName,
      page,
    }) => {
      test.skip(browserName !== "chromium", "Chromium baseline only.");

      await openSkeleton(page, theme);

      for (const sectionId of sections) {
        const section = page.locator(`#${sectionId}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveScreenshot(`${sectionId}-${theme}.png`, {
          animations: "disabled",
        });
      }
    });
  }
});
