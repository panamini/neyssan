import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const APP_URL = process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:5173";
const CLERK_AUTH_STATE_PATH = "playwright/.clerk/user.json";

function readSyntheticClerkConfig() {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL ?? "";

  if (!publishableKey.startsWith("pk_test_")) {
    throw new Error(
      "Authenticated Playwright requires a Clerk development publishable key.",
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Authenticated Playwright requires CLERK_SECRET_KEY from a development instance.",
    );
  }
  if (!emailAddress.includes("+clerk_test")) {
    throw new Error(
      "Authenticated Playwright requires a dedicated +clerk_test user email.",
    );
  }

  return { emailAddress };
}

setup.describe.configure({ mode: "serial" });

setup("configure Clerk testing", async () => {
  readSyntheticClerkConfig();
  await clerkSetup();
});

setup("authenticate the synthetic full-suite user", async ({ page }) => {
  const { emailAddress } = readSyntheticClerkConfig();

  await page.goto(`${APP_URL}/sign-in`);
  await clerk.signIn({ page, emailAddress });
  await page.goto(`${APP_URL}/cv`);
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);

  await mkdir(dirname(CLERK_AUTH_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: CLERK_AUTH_STATE_PATH });
});
