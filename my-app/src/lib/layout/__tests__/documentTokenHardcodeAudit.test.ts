import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const COLOR_LITERAL_PATTERN = /#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)/g;
const FONT_LITERAL_PATTERN =
  /(["'])(Times New Roman|Helvetica Neue|Arial|Georgia|serif|sans-serif|monospace)\1/g;
const UNIT_LITERAL_PATTERN = /(["'`])[^"'`\n]*\d+(?:\.\d+)?(?:mm|pt|px)[^"'`\n]*\1/g;

type StrictAuditTarget = {
  path: string;
  allowColorMatches?: RegExp[];
  allowFontMatches?: RegExp[];
  allowUnitMatches?: RegExp[];
};

const strictTargets: StrictAuditTarget[] = [
  {
    path: "src/lib/layout/documentAppearance.ts",
  },
  {
    path: "src/lib/layout/documentTokenNormalizer.ts",
    allowUnitMatches: [/210mm/, /297mm/, /1mm/],
  },
  {
    path: "src/lib/layout/documentTokenSerializers.ts",
    allowColorMatches: [
      /rgba\(255,255,255,0\.18\)/,
      /rgba\(255,255,255,0\.04\)/,
      /rgba\(255,255,255,0\.22\)/,
      /#1a1a1a/,
    ],
    allowUnitMatches: [
      /"0\.6mm"/,
      /"0 5mm 14mm color-mix/,
      /"12mm"/,
      /"0\.46mm solid color-mix/,
      /"0\.42mm"/,
      /"0 5mm 13mm color-mix/,
      /"calc\(var\(--text-display-size\) \+ 0\.689mm\)"/,
      /"calc\(var\(--text-title-size\) \+ 2\.706mm\)"/,
      /"calc\(var\(--text-body-size\) - 0\.025mm\)"/,
      /"calc\(var\(--text-title-size\) - 0\.291mm\)"/,
      /"0\.24mm solid color-mix/,
      /"0\.5mm solid color-mix/,
      /"0 2mm 6mm color-mix/,
      /"0\.34mm solid color-mix/,
      /"0\.6mm solid color-mix/,
      /"0\.22mm solid color-mix/,
      /"0\.36mm solid color-mix/,
      /"0\.26mm solid color-mix/,
      /"0\.2mm solid var\(--resume-preview-quire-sidebar-rule-color\)"/,
    ],
  },
  {
    path: "src/lib/layout/exportProfiles.ts",
  },
  {
    path: "src/lib/export-renderers.ts",
    allowFontMatches: [/Times New Roman/, /Helvetica Neue/],
  },
  {
    path: "src/features/verbati/style.ts",
  },
  {
    path: "src/components/ProposalDisplay.tsx",
    allowUnitMatches: [/-9999px/, /clamp\(28px, 6vh, 52px\)/],
  },
  {
    path: "src/components/proposal-render/ProposalDocumentRenderer.tsx",
  },
  {
    path: "src/features/verbati/VerbatiResumePreview.tsx",
  },
];

const manualAuditTargets = [
  "src/features/verbati/resume/ResumePage.tsx",
] as const;

const ACTIVE_RESUME_PREVIEW_FUNCTIONS = [
  "ClassicResumePage",
  "QuirePage",
  "SwissMinimaPage",
  "VolkRegisterPage",
  "EditorialMagazinePage",
  "SignalGridPage",
] as const;

function readTarget(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function collectMatches(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => match[0]);
}

function filterMatches(
  matches: string[],
  allowlist: RegExp[] | undefined,
): string[] {
  return matches.filter(
    (match) => !(allowlist ?? []).some((pattern) => pattern.test(match)),
  );
}

function extractFunctionBody(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);
  if (start === -1) {
    throw new Error(`Missing function in audit target: ${functionName}`);
  }

  const nextFunction = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe("document token hardcode audit", () => {
  it("keeps raw palette literals isolated to the canonical appearance resolver", () => {
    const violations: Array<{ path: string; matches: string[] }> = [];

    strictTargets.forEach((target) => {
      const matches = filterMatches(
        collectMatches(readTarget(target.path), COLOR_LITERAL_PATTERN),
        target.allowColorMatches,
      );

      if (target.path.endsWith("documentAppearance.ts")) {
        expect(matches.length).toBeGreaterThan(0);
        return;
      }

      if (matches.length > 0) {
        violations.push({ path: target.path, matches });
      }
    });

    expect(violations).toEqual([]);
  });

  it("allows serializer fallback fonts only where they are explicitly allowlisted", () => {
    const violations: Array<{ path: string; matches: string[] }> = [];

    strictTargets.forEach((target) => {
      if (target.path.endsWith("documentAppearance.ts")) {
        return;
      }

      const matches = filterMatches(
        collectMatches(readTarget(target.path), FONT_LITERAL_PATTERN),
        target.allowFontMatches,
      );

      if (matches.length > 0) {
        violations.push({ path: target.path, matches });
      }
    });

    expect(violations).toEqual([]);
  });

  it("keeps unit literals out of strict renderer and builder layers unless allowlisted", () => {
    const violations: Array<{ path: string; matches: string[] }> = [];

    strictTargets.forEach((target) => {
      if (target.path.endsWith("documentAppearance.ts")) {
        return;
      }

      const matches = filterMatches(
        collectMatches(readTarget(target.path), UNIT_LITERAL_PATTERN),
        target.allowUnitMatches,
      );

      if (matches.length > 0) {
        violations.push({ path: target.path, matches });
      }
    });

    expect(violations).toEqual([]);
  });

  it("keeps the active resume preview branches free of raw colors and pure authored mm/pt literals", () => {
    const resumePageSource = readTarget(manualAuditTargets[0]);
    const activePreviewSource = ACTIVE_RESUME_PREVIEW_FUNCTIONS.map(
      (functionName) => extractFunctionBody(resumePageSource, functionName),
    ).join("\n");

    expect(manualAuditTargets).toEqual([
      "src/features/verbati/resume/ResumePage.tsx",
    ]);
    expect(collectMatches(activePreviewSource, COLOR_LITERAL_PATTERN)).toEqual(
      [],
    );
    expect(
      collectMatches(activePreviewSource, /["'][0-9.]+(?:mm|pt)["']/g),
    ).toEqual([]);
  });

  it("still tracks whole-file resume preview debt separately for untouched legacy comparison pages", () => {
    const resumePageSource = readTarget(manualAuditTargets[0]);

    expect(collectMatches(resumePageSource, COLOR_LITERAL_PATTERN).length).toBeGreaterThan(0);
    expect(collectMatches(resumePageSource, UNIT_LITERAL_PATTERN).length).toBeGreaterThan(0);
  });
});
