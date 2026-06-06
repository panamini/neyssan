import { describe, expect, it } from "vitest";

import {
  buildAppUrl,
  resolveAppBaseUrl,
  resolveSyncHost,
} from "../../../../clerk-chrome-extension-final/src/lib/app-base-url";
import { hasSaveableJobData } from "../../../../clerk-chrome-extension-final/src/contents/_shared/job-scraper";

describe("chrome extension app routing", () => {
  it("falls back to the local app when the configured app URL is an extension URL", () => {
    expect(resolveAppBaseUrl("chrome-extension://invalid/")).toBe(
      "http://localhost:5173",
    );
    expect(buildAppUrl("/proposal", "chrome-extension://invalid/")).toBe(
      "http://localhost:5173/proposal",
    );
  });

  it("falls back to the local sync host for extension protocol sync origins", () => {
    expect(resolveSyncHost("chrome-extension://invalid/")).toBe(
      "http://localhost",
    );
  });
});

describe("chrome extension job saveability", () => {
  it("rejects placeholder briefs before save, open, or generation", () => {
    expect(
      hasSaveableJobData({
        platform: "linkedin",
        title: "TEST 1",
        description: "TEST 1",
      }),
    ).toBe(false);
  });

  it("accepts useful no-CV job descriptions", () => {
    expect(
      hasSaveableJobData({
        platform: "linkedin",
        title: "Operations Coordinator",
        description: [
          "Coordinate daily service requests, update work orders, and keep customers informed about schedule changes.",
          "Partner with field teams to confirm appointment details, document follow-up, and keep recurring service operations moving.",
        ].join("\n"),
      }),
    ).toBe(true);
  });
});
