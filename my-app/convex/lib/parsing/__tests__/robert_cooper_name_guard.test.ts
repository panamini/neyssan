import { describe, expect, it } from "vitest";
import { canonicalizeParserResult } from "../canonicalize";
import robertCooperFixture from "./fixtures/robert_cooper.json";

describe("canonicalizeParserResult name guard", () => {
  it("does not promote a skill token into the candidate name", () => {
    const rawText = robertCooperFixture.normalized.rawText;
    const result = canonicalizeParserResult(robertCooperFixture as any, {
      rawText,
      mode: "text",
      parserUrl: "test://parser",
    });

    expect(result.normalized?.desiredPosition).toBe("Security Guard");
    expect(result.normalized?.name).toBeUndefined();
    expect(result.normalized?.contact?.name).toBeUndefined();
    expect(result.normalized?.experience?.[0]).toMatchObject({
      company: "SecureIt Ltd",
      position: "Security Guard",
    });
  });
});
