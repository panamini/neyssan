import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

function isExecutable(path?: string | null): path is string {
  if (!path) {
    return false;
  }

  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findCommand(commands: string[]): string | undefined {
  for (const command of commands) {
    try {
      const resolved = execFileSync('sh', ['-lc', `command -v ${command}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (isExecutable(resolved)) {
        return resolved;
      }
    } catch {
      // Ignore missing commands and keep probing.
    }
  }

  return undefined;
}

function resolveLocalChromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_FORCE_BUNDLED_CHROMIUM === '1') {
    return undefined;
  }

  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    findCommand([
      'chromium',
      'chromium-browser',
      'google-chrome',
      'google-chrome-stable',
      'chrome',
    ]),
  ];

  return candidates.find(isExecutable);
}

const localChromiumExecutable = resolveLocalChromiumExecutable();
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:5173';
process.env.PLAYWRIGHT_APP_URL = appUrl;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: appUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  metadata: {
    chromiumExecutable: localChromiumExecutable ?? 'playwright-bundled',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(localChromiumExecutable
          ? {
              launchOptions: {
                executablePath: localChromiumExecutable,
              },
            }
          : {}),
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* The app stack is started by run.sh local-fast locally/CI. */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
