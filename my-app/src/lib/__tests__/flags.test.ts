import { afterEach, describe, expect, it, vi } from "vitest";

import { isCvEditorDebugUiEnabled } from "../flags";

describe("isCvEditorDebugUiEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is enabled by default in development", () => {
    vi.stubEnv("DEV", "true");
    vi.stubEnv("NODE_ENV", "development");

    expect(isCvEditorDebugUiEnabled()).toBe(true);
  });

  it("is hidden in production by default", () => {
    vi.stubEnv("DEV", "false");
    vi.stubEnv("NODE_ENV", "production");

    expect(isCvEditorDebugUiEnabled()).toBe(false);
  });

  it("can be explicitly enabled outside development", () => {
    vi.stubEnv("DEV", "false");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITE_ENABLE_CV_DEBUG_UI", "true");

    expect(isCvEditorDebugUiEnabled()).toBe(true);
  });
});
