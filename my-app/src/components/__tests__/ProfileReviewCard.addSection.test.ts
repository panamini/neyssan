import { describe, expect, it } from "vitest";
import { shouldUseV1TemplateForAddSection } from "../profileReviewCardAddSection";

describe("shouldUseV1TemplateForAddSection", () => {
  it("keeps core editor sections on the v1 template", () => {
    expect(shouldUseV1TemplateForAddSection("profile", false)).toBe(true);
    expect(shouldUseV1TemplateForAddSection("summary", true)).toBe(true);
    expect(shouldUseV1TemplateForAddSection("experience", true)).toBe(true);
    expect(shouldUseV1TemplateForAddSection("education", false)).toBe(true);
    expect(shouldUseV1TemplateForAddSection("skills", true)).toBe(true);
  });

  it("keeps optional sections on the modern template even when v1 mode is on", () => {
    expect(shouldUseV1TemplateForAddSection("projects", true)).toBe(false);
    expect(shouldUseV1TemplateForAddSection("languages", true)).toBe(false);
    expect(shouldUseV1TemplateForAddSection("achievements", true)).toBe(false);
    expect(shouldUseV1TemplateForAddSection("certifications", true)).toBe(false);
  });

  it("falls back to the modern template for empty or unknown section types", () => {
    expect(shouldUseV1TemplateForAddSection("", true)).toBe(false);
    expect(shouldUseV1TemplateForAddSection("custom", true)).toBe(false);
  });
});
