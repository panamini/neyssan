import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildAllowedFactsPack,
  buildPremiumCoverLetterBrief,
  buildPremiumCoverLetterPrompt,
  rankAllowedFacts,
} from "../premiumCoverLetter";
import {
  resolveTargetEmployerAuthorities,
  targetEmployerAliasSpans,
  targetEmployerOwnsOccurrence,
} from "../premiumCoverLetterTargetEmployer";

function buildNoCvBrief(args: {
  targetEmployerName: string | null;
  jobTitle: string;
  jobDescription: string;
}) {
  const targetEmployer = resolveTargetEmployerAuthorities([
    args.targetEmployerName,
  ]);
  const allowedFactsPack = buildAllowedFactsPack({
    personalizationContext: null,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });
  const rankedEvidencePack = rankAllowedFacts({
    allowedFactsPack,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass: "no_cv",
  });
  const brief = buildPremiumCoverLetterBrief({
    preset: "signature",
    outputLanguage: "English",
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    contextClass: "no_cv",
    allowedFactsPack,
    rankedEvidencePack,
    targetEmployer,
  });
  return { targetEmployer, brief };
}

describe("Target Employer Module", () => {
  it("makes MISSING, INVALID, AMBIGUOUS, and RESOLVED semantics explicit", () => {
    expect(resolveTargetEmployerAuthorities([null, undefined])).toEqual({
      status: "MISSING",
    });
    expect(resolveTargetEmployerAuthorities([" ... "])).toEqual({
      status: "INVALID",
      suppliedAuthorities: ["..."],
    });
    expect(resolveTargetEmployerAuthorities(["Acme", "Northwind"])).toEqual({
      status: "AMBIGUOUS",
      canonicalNames: ["Acme", "Northwind"],
    });
    expect(resolveTargetEmployerAuthorities(["Acme Corp."])).toEqual({
      status: "RESOLVED",
      canonicalName: "Acme Corp.",
      displayName: "Acme",
      normalizedName: "acme corp",
      aliases: ["acme corp", "acme"],
      numericName: false,
    });
  });

  it("treats terminal legal suffixes as deterministic aliases", () => {
    expect(
      resolveTargetEmployerAuthorities(["7-Eleven, Inc."]),
    ).toMatchObject({
      status: "RESOLVED",
      displayName: "7-Eleven",
      aliases: ["7 eleven inc", "7 eleven"],
      numericName: false,
    });
    expect(
      resolveTargetEmployerAuthorities(["Acme S.A.R.L.", "ACME SARL"]),
    ).toMatchObject({
      status: "RESOLVED",
      displayName: "Acme",
    });
  });

  it("supports numeric names and matches aliases only on full normalized token boundaries", () => {
    const numeric = resolveTargetEmployerAuthorities(["99"]);
    expect(numeric).toMatchObject({
      status: "RESOLVED",
      displayName: "99",
      aliases: ["99"],
      numericName: true,
    });
    expect(
      targetEmployerOwnsOccurrence({
        value: "At 99, reporting supports delivery.",
        occurrenceIndex: 3,
        targetEmployer: numeric,
      }),
    ).toBe(true);
    expect(
      targetEmployerOwnsOccurrence({
        value: "At 199, reporting supports delivery.",
        occurrenceIndex: 3,
        targetEmployer: numeric,
      }),
    ).toBe(false);

    const sevenEleven = resolveTargetEmployerAuthorities(["7-Eleven Inc."]);
    expect(
      targetEmployerAliasSpans({
        value: "At 7-ELEVEN, reporting supports delivery.",
        targetEmployer: sevenEleven,
      }),
    ).toEqual([{ start: 3, end: 11, alias: "7 eleven" }]);
    expect(
      targetEmployerAliasSpans({
        value: "At 17-Eleven, reporting supports delivery.",
        targetEmployer: sevenEleven,
      }),
    ).toEqual([]);
  });

  it("keeps one resolved result in the brief and prompt despite conflicting diagnostics", () => {
    const { targetEmployer, brief } = buildNoCvBrief({
      targetEmployerName: "Acme Corp.",
      jobTitle: "Software Engineer — Level 3 at Northwind",
      jobDescription:
        "Join Our Engineering Team. Work at Northwind on reliable delivery.",
    });
    expect(brief.targetEmployer).toBe(targetEmployer);
    expect(brief.targetEmployer).toMatchObject({
      status: "RESOLVED",
      canonicalName: "Acme Corp.",
      displayName: "Acme",
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });
    expect(prompt).toContain(
      '"targetEmployer":{"status":"RESOLVED","canonicalName":"Acme Corp.","displayName":"Acme"',
    );
    expect(prompt).toContain(
      'Structured target employer: use displayName "Acme"',
    );
  });

  it("keeps MISSING explicit and forbids company inference from diagnostics", () => {
    const { targetEmployer, brief } = buildNoCvBrief({
      targetEmployerName: null,
      jobTitle: "Software Engineer at Northwind",
      jobDescription: "Join Northwind and build reliable services.",
    });
    expect(brief.targetEmployer).toBe(targetEmployer);
    expect(brief.targetEmployer).toEqual({ status: "MISSING" });
    const prompt = buildPremiumCoverLetterPrompt({ brief });
    expect(prompt).not.toContain('"targetEmployer"');
    expect(prompt).not.toContain('"employerName"');
    expect(prompt).not.toContain("Structured target employer:");
  });

  it("threads targetEmployerName through all three active premium attempts", () => {
    const source = readFileSync("convex/generateProposalMutation.ts", "utf8");
    const starts = Array.from(
      source.matchAll(/await attemptPremiumCoverLetterGeneration\(\{/g),
      (match) => match.index,
    );
    expect(starts).toHaveLength(3);
    for (const [index, start] of starts.entries()) {
      const end = starts[index + 1] ?? source.length;
      expect(source.slice(start, end)).toMatch(
        /targetEmployerName:\s*args\.targetEmployerName/,
      );
    }
  });
});
