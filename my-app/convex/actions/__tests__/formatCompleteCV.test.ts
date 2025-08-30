import { describe, it, expect } from "vitest";
import formatCompleteCV from "../formatCompleteCV";

describe("formatCompleteCV action (fallback parser)", () => {
  it("throws on empty input", async () => {
    await expect(async () => {
      // @ts-ignore - intentionally calling with empty
      await formatCompleteCV({ rawText: "" });
    }).rejects.toThrow();
  });

  it("parses skills into structured array and comma-separated text", async () => {
    const raw = `
    Skills:
    JavaScript, TypeScript; React
    Node.js
    React
    `;
    const res = await formatCompleteCV({ rawText: raw });
    expect(res).toBeDefined();
    expect(res.status).toBe("ok");
    const out = (res as any).result;
    expect(Array.isArray(out.skills)).toBe(true);
    // deduplicated and trimmed
    expect(out.skills).toEqual(expect.arrayContaining(["JavaScript", "TypeScript", "React", "Node.js"]));
    expect(typeof out.skillsText).toBe("string");
    // Skills text must include commas and normalized tokens
    const parts = out.skillsText.split(",").map((s: string) => s.trim());
    expect(parts).toEqual(expect.arrayContaining(["JavaScript", "TypeScript", "React", "Node.js"]));
  });

  it("parses experience fallback into items", async () => {
    const raw = `
    Experience:
    Senior Engineer - Acme Inc. 2018-2020
    Lead Developer @ Beta LLC 2020-2023
    `;
    const res = await formatCompleteCV({ rawText: raw });
    expect(res.status).toBe("ok");
    const out = (res as any).result;
    expect(Array.isArray(out.experience)).toBe(true);
    expect(out.experience.length).toBeGreaterThanOrEqual(2);
    // items should contain raw lines
    expect(out.experience[0].raw).toContain("Senior Engineer");
    expect(out.experience[1].raw).toContain("Lead Developer");
  });

  it("extracts identity fields (name, email, phone, location) from top lines", async () => {
    const raw = `
    Jane Doe
    jane.doe@example.com
    +33 6 12 34 56 78
    Paris, France

    Summary:
    Experienced engineer...
    `;
    const res = await formatCompleteCV({ rawText: raw });
    expect(res.status).toBe("ok");
    const out = (res as any).result;
    expect(out.identity).toBeDefined();
    expect(out.identity.name).toBe("Jane Doe");
    expect(out.identity.email).toBe("jane.doe@example.com");
    expect(out.identity.phone).toBeDefined();
    expect(out.identity.location).toBe("Paris, France");
  });

  it("includes diagnostics.parseConfidence between 0 and 1", async () => {
    const raw = `Summary: Quick test\nSkills: JS`;
    const res = await formatCompleteCV({ rawText: raw });
    expect(res.status).toBe("ok");
    const out = (res as any).result;
    expect(out.diagnostics).toBeDefined();
    expect(typeof out.diagnostics.parseConfidence).toBe("number");
    expect(out.diagnostics.parseConfidence).toBeGreaterThanOrEqual(0);
    expect(out.diagnostics.parseConfidence).toBeLessThanOrEqual(1);
  });
});