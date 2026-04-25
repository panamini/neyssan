import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, expect, test } from "vitest";

import {
  buildStructuredMatchIdentity,
  isLikelyJwt,
  loadEnvFiles,
} from "../liveMatchReviewEnv";

const envKeys = ["FOO", "BAR", "SHARED"] as const;
const originalEnv = new Map<string, string | undefined>();

afterEach(() => {
  for (const key of envKeys) {
    const previous = originalEnv.get(key);
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
  originalEnv.clear();
});

test("loadEnvFiles keeps shell env above .env and .env.local", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "match-review-env-"));
  try {
    writeFileSync(path.join(tempDir, ".env"), "FOO=from-env\nSHARED=from-env\n");
    writeFileSync(
      path.join(tempDir, ".env.local"),
      "BAR=from-local\nSHARED=from-local\n",
    );

    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
    }

    process.env.FOO = "from-shell";
    delete process.env.BAR;
    delete process.env.SHARED;

    loadEnvFiles(tempDir);

    expect(process.env.FOO).toBe("from-shell");
    expect(process.env.BAR).toBe("from-local");
    expect(process.env.SHARED).toBe("from-local");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("structured match review identity stays on the allowlisted reviewer subject", () => {
  const identity = buildStructuredMatchIdentity();

  expect(identity).toEqual({
    email: "internal@example.com",
    subject: "user_31W4qTfkBAzLnf5LDarxyf4ARDh",
    tokenIdentifier: "user_31W4qTfkBAzLnf5LDarxyf4ARDh",
  });
});

test("isLikelyJwt only accepts three-part tokens", () => {
  expect(isLikelyJwt("a.b.c")).toBe(true);
  expect(isLikelyJwt("abc")).toBe(false);
  expect(isLikelyJwt("a.b")).toBe(false);
});
