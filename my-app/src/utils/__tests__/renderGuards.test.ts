import { describe, expect, it } from "vitest";
import { isExperienceRenderable, isEducationRenderable } from "../cv/renderGuards";

describe("renderGuards", () => {
  describe("isExperienceRenderable", () => {
    it("returns true when company is present", () => {
      expect(isExperienceRenderable({ company: "Acme" })).toBe(true);
    });

    it("returns true when responsibilities array exists", () => {
      expect(
        isExperienceRenderable({ responsibilityBullets: ["Handled escalations"] })
      ).toBe(true);
    });

    it("returns false when no renderable fields are provided", () => {
      expect(isExperienceRenderable({ company: "", position: "", responsibilityBullets: [] })).toBe(false);
    });
  });

  describe("isEducationRenderable", () => {
    it("returns true when degree information exists", () => {
      expect(isEducationRenderable({ degree: "BSc" })).toBe(true);
    });

    it("returns true when description is a rich-text object", () => {
      expect(isEducationRenderable({ description: { type: "doc", content: [] } })).toBe(true);
    });

    it("returns false when no meaningful fields exist", () => {
      expect(isEducationRenderable({ degree: "", description: "" })).toBe(false);
    });
  });
});
