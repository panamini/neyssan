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
    expect(resolveTargetEmployerAuthorities(["Fast Company"])).toMatchObject({
      status: "RESOLVED",
      displayName: "Fast Company",
      aliases: ["fast company"],
    });
    expect(
      resolveTargetEmployerAuthorities(["The Honest Company"]),
    ).toMatchObject({
      status: "RESOLVED",
      displayName: "The Honest Company",
    });
    expect(resolveTargetEmployerAuthorities(["SAS"])).toMatchObject({
      status: "RESOLVED",
      canonicalName: "SAS",
      displayName: "SAS",
      aliases: ["sas"],
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
    expect(
      targetEmployerOwnsOccurrence({
        value: "I managed 99 enterprise accounts.",
        occurrenceIndex: 10,
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
    expect(
      targetEmployerOwnsOccurrence({
        value: "I am applying to 7-Eleven.",
        occurrenceIndex: 17,
        targetEmployer: sevenEleven,
      }),
    ).toBe(true);

    const writtenNumberBrand = resolveTargetEmployerAuthorities(["One Inc."]);
    expect(
      targetEmployerOwnsOccurrence({
        value: "I supported one million users.",
        occurrenceIndex: 12,
        targetEmployer: writtenNumberBrand,
      }),
    ).toBe(false);

    for (const [value, expected] of [
      ["I am applying to 99.", true],
      ["I increased throughput to 99.", false],
      ["I would support 99 as it grows.", true],
      ["I supported 99 users.", false],
      ["I supported 99 accounts.", false],
    ] as const) {
      expect(
        targetEmployerOwnsOccurrence({
          value,
          occurrenceIndex: value.indexOf("99"),
          targetEmployer: numeric,
        }),
      ).toBe(expected);
    }
  });

  it("preserves branded terminal punctuation with and without legal suffixes", () => {
    for (const [authority, displayName] of [
      ["Yahoo!", "Yahoo!"],
      ["Which?", "Which?"],
      ["C++", "C++"],
      ["Yahoo! Inc.", "Yahoo!"],
      ["Which?, Ltd.", "Which?"],
      ["C++ LLC", "C++"],
    ] as const) {
      expect(resolveTargetEmployerAuthorities([authority])).toMatchObject({
        status: "RESOLVED",
        canonicalName: authority,
        displayName,
      });
    }
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
      "Structured target employer: use only the targetEmployer.displayName value from the structured brief",
    );
    expect(prompt).not.toContain(
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
    expect(prompt).toContain(
      "No structured target employer is resolved: do not infer, name, or personalize an employer from the title or description.",
    );
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

  it("persists targetEmployerName and reuses it for saved-proposal regeneration", () => {
    const mutationSource = readFileSync(
      "convex/generateProposalMutation.ts",
      "utf8",
    );
    expect(mutationSource).toMatch(
      /proposalMetadataBase\s*=\s*\{[\s\S]*targetEmployerName:\s*normalizedTargetEmployerName/,
    );

    const regenerateSource = readFileSync(
      "src/components/ProposalsList.tsx",
      "utf8",
    );
    expect(regenerateSource).toMatch(
      /targetEmployerName:\s*resolvedRegenerateTargetEmployerName/,
    );
    expect(regenerateSource).toMatch(/api\.jobsPublic\.getById/);

    const forgeSource = readFileSync("src/pages/ProposalForge.tsx", "utf8");
    expect(forgeSource).toMatch(
      /const preservedTargetEmployerName = resolvedTargetEmployerName/,
    );
    expect(forgeSource).toMatch(
      /targetEmployerName:\s*canPreserveSourceIdentity\s*\?\s*preservedTargetEmployerName\s*:\s*null/,
    );

    for (const path of [
      "convex/schema.ts",
      "convex/proposals.ts",
      "convex/proposalsPublic.ts",
      "convex/createProposalPublic.ts",
      "convex/updateProposalPublic.ts",
    ]) {
      expect(readFileSync(path, "utf8")).toMatch(
        /targetEmployerName:\s*v\.optional\(v\.string\(\)\)/,
      );
    }
  });

  it("forwards the structured employer from the active extension caller", () => {
    const extensionSource = readFileSync(
      "../clerk-chrome-extension-final/src/background/index.ts",
      "utf8",
    );
    expect(extensionSource).toMatch(
      /targetEmployerName:\s*message\.jobData\?\.company\?\.trim\(\)\s*\|\|\s*null/,
    );
    expect(extensionSource).toMatch(
      /saveProposalHandler[\s\S]*jobData:\s*\{[\s\S]*\.\.\.message\.jobData![\s\S]*company:\s*message\.jobData\?\.company\?\.trim\(\)\s*\|\|\s*undefined/,
    );

    const saveSource = readFileSync("convex/saveJobAndProposal.ts", "utf8");
    expect(saveSource.match(/company:\s*v\.optional\(v\.string\(\)\)/g)).toHaveLength(
      2,
    );
    expect(saveSource).toMatch(
      /const targetEmployerName\s*=\s*args\.company\?\.trim\(\)/,
    );
    expect(saveSource).toMatch(
      /targetEmployerName\s*\?\s*\{\s*targetEmployerName\s*\}\s*:\s*\{\}/,
    );
  });

  it("projects the persisted employer through proposalsPublic", () => {
    const source = readFileSync("convex/proposalsPublic.ts", "utf8");
    expect(source).toMatch(
      /targetEmployerName:\s*proposal\.metadata\.targetEmployerName\s*\?\?\s*undefined/,
    );
  });
});
