import { describe, expect, it } from "vitest";

import { analyzeCompanyValues } from "../companyValues";

describe("company values analysis", () => {
  it("extracts explicit company values only from source-backed job text", () => {
    const pack = analyzeCompanyValues(
      "Our values are safety, service, and accountability. The role coordinates incident reviews and keeps compliance records accurate.",
    );

    expect(pack.confidence).toBe("explicit");
    expect(pack.explicitValues).toEqual(
      expect.arrayContaining(["safety", "service", "accountability"]),
    );
    expect(pack.valueEvidenceSnippets[0]).toContain("Our values are");
    expect(pack.workSurfaceLinks).toEqual(
      expect.arrayContaining([
        expect.stringContaining("coordinates incident reviews"),
      ]),
    );
  });

  it("extracts implicit values from repeated concrete role language", () => {
    const pack = analyzeCompanyValues(
      "Maintain compliance logs and review safety records after each incident. Keep compliance documentation current, verify safety handoffs, and maintain reliable service records. Reliable follow-through keeps the records current across shifts.",
    );

    expect(pack.confidence).toBe("implicit");
    expect(pack.implicitValues).toEqual(
      expect.arrayContaining(["compliance", "safety", "reliability"]),
    );
    expect(pack.explicitValues).toEqual([]);
  });

  it("does not create implicit values from one generic responsibility sentence", () => {
    const pack = analyzeCompanyValues(
      "Support users on a fast-paced team and keep customer questions moving.",
    );

    expect(pack.confidence).toBe("none");
    expect(pack.implicitValues).toEqual([]);
    expect(pack.valueEvidenceSnippets).toEqual([]);
  });

  it("does not extract values from generic employer fluff", () => {
    const pack = analyzeCompanyValues(
      "We offer a dynamic, fast-paced, world-class, best-in-class, passionate, exciting, innovative, cutting-edge, high-performing, great culture with competitive benefits.",
    );

    expect(pack.confidence).toBe("none");
    expect(pack.explicitValues).toEqual([]);
    expect(pack.implicitValues).toEqual([]);
    expect(pack.valueEvidenceSnippets).toEqual([]);
  });

  it("always provides banned generic value-claim phrases", () => {
    const pack = analyzeCompanyValues(
      "Our mission is to make public services more accessible through reliable case handling.",
    );

    expect(pack.bannedValueClaims).toEqual(
      expect.arrayContaining([
        "your mission resonates with me",
        "I share your values",
        "I admire your culture",
      ]),
    );
  });

  it("does not turn company values into candidate alignment claims", () => {
    const pack = analyzeCompanyValues(
      "Our principles are trust, customer care, and accessibility. This role supports intake workflows and user documentation.",
    );

    const valuePayload = JSON.stringify({
      explicitValues: pack.explicitValues,
      implicitValues: pack.implicitValues,
      valueEvidenceSnippets: pack.valueEvidenceSnippets,
      workSurfaceLinks: pack.workSurfaceLinks,
    }).toLowerCase();
    expect(valuePayload).not.toContain("i share");
    expect(valuePayload).not.toContain("my values");
    expect(valuePayload).not.toContain("resonates with me");
  });
});
