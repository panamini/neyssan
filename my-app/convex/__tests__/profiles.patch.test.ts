import { describe, expect, it } from "vitest";

import { resolvePatchProfileRow } from "../profiles";

describe("resolvePatchProfileRow", () => {
  it("prefers the caller-owned row when multiple rows share a profileId", () => {
    const owned = { clerkId: "clerk_123", marker: "owned" };
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(
      resolvePatchProfileRow([foreign, owned], "clerk_123"),
    ).toEqual(owned);
  });

  it("falls back to an unclaimed row when no owned row exists", () => {
    const unclaimed = { clerkId: undefined, marker: "unclaimed" };
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(
      resolvePatchProfileRow([foreign, unclaimed], "clerk_123"),
    ).toEqual(unclaimed);
  });

  it("returns null when only foreign-owned rows exist", () => {
    const foreign = { clerkId: "clerk_foreign", marker: "foreign" };

    expect(resolvePatchProfileRow([foreign], "clerk_123")).toBeNull();
  });

  it("returns null for an empty candidate set", () => {
    expect(resolvePatchProfileRow([], "clerk_123")).toBeNull();
  });
});
