import { describe, expect, it } from "vitest";
import { getCollapsedLine } from "@/utils/getCollapsedLine";

describe("getCollapsedLine", () => {
  it("returns cleaned summary when it is a proper sentence", () => {
    const entry = {
      summary: { text: ", Passionate engineer building resilient systems." },
    };
    expect(getCollapsedLine(entry)).toBe("Passionate engineer building resilient systems.");
  });

  it("falls back to experience line when summary is contact-like", () => {
    const entry = {
      summary: { text: "email@example.com | linkedin.com/example" },
      experience: [{ company: "Acme Corp", position: "Security Guard" }],
    };
    const line = getCollapsedLine(entry);
    expect(line).toBe("Acme Corp — Security Guard");
  });

  it("falls back to education when experience is missing", () => {
    const entry = {
      summary: { text: "linkedin.com/example" },
      education: [{ institution: "State University", degree: "BSc Computer Science" }],
    };
    expect(getCollapsedLine(entry)).toBe("State University — BSc Computer Science");
  });

  it("supports achievements provided as objects", () => {
    const entry = {
      summary: { text: "github.com/example" },
      experience: [],
      education: [],
      achievements: [{ text: "Awarded best performer" }, { text: "Maintained 99.9% uptime" }],
    };
    expect(getCollapsedLine(entry)).toBe("Awarded best performer");
  });

  it("falls back to diagnostics empty_reason when no sections available", () => {
    const entry = {
      summary: { text: "github.com/example" },
      experience: [],
      education: [],
      achievements: [],
    };
    expect(getCollapsedLine(entry, { empty_reason: "paddle_empty" })).toBe("paddle_empty");
  });
});
