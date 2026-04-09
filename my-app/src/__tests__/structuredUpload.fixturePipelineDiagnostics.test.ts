// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalizeParserResult } from "../../convex/lib/parsing/canonicalize";
import { buildImportRecoveryPayload } from "../../convex/lib/parsing/importRecovery";

type DiagnosticPage = {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
};

type ActiveHelperFixture = {
  fixture: string;
  fixturePath: string;
  pageCount: number;
  extraction: {
    servicePages: DiagnosticPage[];
    informativePages: DiagnosticPage[];
    analysisRawText: string;
    serviceJoinedText: string;
    informativeJoinedText: string;
    activeHeadingCandidates: Array<{
      line: string;
      collapsed: string;
      activeHeading: string | null;
      informativeHeading: string | null;
    }>;
    flatteningSignals: {
      analysisUsesSingleString: boolean;
      analysisMatchesServiceJoined: boolean;
      servicePageCount: number;
      analysisPageCount: number;
    };
  };
  sectionCandidates: {
    activeExtractSectionsKeys: string[];
    activeExtractSections: Array<{ key: string; count: number; previews: string[] }>;
    informativeParseSections: Array<{ key: string; count: number; previews: string[] }>;
    informativeRawSections: Array<{ label: string; preview: string }>;
  };
  canonical: {
    rawSections: Array<{ label: string; content: string }>;
    normalized: Record<string, unknown>;
    diagnostics: Record<string, unknown>;
  };
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../..");
const pythonCommand = process.env.PYTHON ?? "python3";
const activeHelperPath = path.join(repoRoot, "cv_parser/tests/plain_pdf_pipeline_diagnostic_helper.py");

const FIXTURE_PATHS = [
  path.join(repoRoot, "cv_parser/tests/fixtures/sample_07.pdf"),
  path.join(repoRoot, "cv_parser/tests/fixtures/sample_12.pdf"),
  path.join(repoRoot, "cv_parser/tests/fixtures/golden/cv_517.pdf"),
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function collapseSpacedLetters(line: string): string {
  const normalized = normalizeWhitespace(line);
  if (/^(?:[A-Za-z]\s+){3,}[A-Za-z](?:\s+[A-Za-z]{2,})*$/.test(normalized)) {
    return normalized.replace(/\s+/g, "");
  }
  return normalized;
}

function normalizeForComparison(value: string): string {
  return value
    .split("\n")
    .map((line) => collapseSpacedLetters(line))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function collectVisibleHeadingLines(pages: DiagnosticPage[]): string[] {
  const out = new Set<string>();
  for (const page of pages) {
    for (const rawLine of page.text.split(/\n+/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const normalized = collapseSpacedLetters(line);
      const letters = normalized.replace(/[^A-Za-z]/g, "");
      const words = normalized.split(/\s+/).filter(Boolean);
      const isAllCapsLike = letters.length >= 4 && letters === letters.toUpperCase();
      const isTitleLike =
        words.length > 0 &&
        words.length <= 6 &&
        words.every((word) => /^[A-Z][A-Za-z&'./-]*:?$/.test(word) || /^[A-Z]{2,}$/.test(word));
      if (isAllCapsLike || isTitleLike) {
        out.add(normalized);
      }
    }
  }
  return Array.from(out);
}

function countIssueFlags(items: Array<{ issueFlags?: string[] }>): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const flag of item.issueFlags ?? []) {
      acc[flag] = (acc[flag] ?? 0) + 1;
    }
    return acc;
  }, {});
}

function pickRecoverySourceSections(...candidates: unknown[]): unknown[] {
  let best: unknown[] = [];
  let bestScore = -1;

  const scoreCandidate = (candidate: unknown[]): number =>
    candidate.reduce<number>((sum, entry) => {
      if (!entry || typeof entry !== "object") return sum;
      const record = entry as Record<string, unknown>;
      return (
        sum +
        (typeof record.fieldKey === "string" ? 4 : 0) +
        (typeof record.confidence === "number" ? 4 : 0) +
        (typeof record.title === "string" ? 2 : 0) +
        (typeof record.label === "string" ? 2 : 0) +
        (typeof record.content === "string" || typeof record.text === "string" ? 1 : 0)
      );
    }, 0);

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate) || candidate.length === 0) return;
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function runActiveDiagnostic(fixtures: string[]): ActiveHelperFixture[] {
  const stdout = execFileSync(pythonCommand, [activeHelperPath, ...fixtures], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return JSON.parse(stdout) as ActiveHelperFixture[];
}

function buildFixtureReport(fixture: ActiveHelperFixture) {
  const serviceResult = {
    normalized: fixture.canonical.normalized,
    rawSections: fixture.canonical.rawSections,
    diagnostics: fixture.canonical.diagnostics,
  };

  const appCanonical = canonicalizeParserResult(serviceResult, {
    rawText: fixture.extraction.analysisRawText,
    mode: "text",
    parserUrl: "diagnostic://plain-pdf",
  });

  const recoverySourceSections = pickRecoverySourceSections(
    serviceResult.rawSections,
    serviceResult.normalized?.rawSections,
    (appCanonical as any)?.rawSections,
    (appCanonical as any)?.normalized?.rawSections,
  );

  const recovery = buildImportRecoveryPayload({
    sourceSections: recoverySourceSections,
    fullResult: appCanonical as Record<string, any>,
    context: {
      rawText:
        typeof (appCanonical as any)?.normalized?.rawText === "string"
          ? (appCanonical as any).normalized.rawText
          : fixture.extraction.analysisRawText,
      mode: "text",
      parserUrl: "diagnostic://plain-pdf",
    },
  });

  const visibleHeadings = fixture.extraction.activeHeadingCandidates.map((candidate) => candidate.collapsed);
  const activeSectionKeys = fixture.sectionCandidates.activeExtractSectionsKeys;
  const informativeSectionCounts = Object.fromEntries(
    fixture.sectionCandidates.informativeParseSections.map((entry) => [entry.key, entry.count]),
  );
  const activeRawSectionLabels = fixture.canonical.rawSections.map((section) => section.label);
  const appNormalized = (appCanonical?.normalized ?? {}) as Record<string, any>;
  const recoveryItems = recovery?.items ?? [];

  const diagnosisBoundary = (() => {
    if (fixture.fixture === "cv_517.pdf") return "raw extraction and heading collapse";
    if (fixture.fixture === "sample_12.pdf") return "page flattening and heading collapse before recovery";
    return "heading collapse before recovery";
  })();

  return {
    fixture: fixture.fixture,
    pageCount: fixture.pageCount,
    extraction: {
      flatteningSignals: fixture.extraction.flatteningSignals,
      visibleHeadings: visibleHeadings.slice(0, 12),
      serviceVisibleHeadingLines: collectVisibleHeadingLines(fixture.extraction.servicePages).slice(0, 20),
      spacedHeadingLikeLines: fixture.extraction.informativePages
        .flatMap((page) => page.text.split(/\n+/))
        .map((line) => line.trim())
        .filter((line) => /(?:[A-Za-z]\s+){3,}[A-Za-z]/.test(line))
        .slice(0, 10),
      servicePageHeadingPreviews: fixture.extraction.servicePages.map((page) => ({
        pageNumber: page.pageNumber,
        headingPreview: page.text
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 8),
      })),
    },
    sectionCandidates: {
      activeExtractSectionsKeys: activeSectionKeys,
      activeExtractSectionCounts: Object.fromEntries(
        fixture.sectionCandidates.activeExtractSections.map((entry) => [entry.key, entry.count]),
      ),
      informativeParseSectionCounts: informativeSectionCounts,
      informativeRawSectionLabels: fixture.sectionCandidates.informativeRawSections.map((entry) => entry.label),
    },
    canonical: {
      serviceRawSectionLabels: activeRawSectionLabels,
      appRawSectionLabels: ((appCanonical as any)?.normalized?.rawSections ?? []).map((section: any) => section.label),
      sectionPresence: {
        summary: Boolean(appNormalized.summary?.text),
        experience: Array.isArray(appNormalized.experience) && appNormalized.experience.length > 0,
        education: Array.isArray(appNormalized.education) && appNormalized.education.length > 0,
        skills: Boolean(appNormalized.skills),
        languages: Boolean(appNormalized.languages),
      },
      summaryPreview: String(appNormalized.summary?.text ?? "").slice(0, 160),
    },
    recovery: {
      sourceSectionCount: recoverySourceSections.length,
      sourceLabels: (recoverySourceSections as Array<Record<string, unknown>>).map((section) => String(section.label ?? section.title ?? "")).filter(Boolean),
      itemCount: recoveryItems.length,
      unknownSectionCount: recoveryItems.filter((item) => item.issueFlags.includes("unknownSection")).length,
      largeBlobFlags: recoveryItems.map((item) => item.cleanedText.length >= 500),
      recoveryIssueCounts: countIssueFlags(recoveryItems),
      itemSummaries: recoveryItems.map((item) => ({
        predictedSection: item.predictedSection,
        confidenceScore: item.confidenceScore,
        issueFlags: item.issueFlags,
        sourceLabel: item.sourceLabel,
        preview: item.cleanedText.slice(0, 120),
      })),
      diagnostics: recovery?.diagnostics
        ? {
            ...recovery.diagnostics,
            processingTimeMs: ">=0",
          }
        : null,
    },
    diagnosis: {
      primaryBoundary: diagnosisBoundary,
      headingsVisibleAfterNormalization: visibleHeadings.some((heading) =>
        normalizeForComparison(fixture.extraction.analysisRawText).includes(heading),
      ),
      headingsPreservedIntoSections: activeSectionKeys.length > 0,
    },
  };
}

describe("structuredUpload plain-PDF fixture pipeline diagnostics", () => {
  it("shows where structure is lost between active text-PDF extraction, sectioning, canonicalization, and recovery", () => {
    FIXTURE_PATHS.forEach((fixturePath) => expect(existsSync(fixturePath)).toBe(true));
    expect(existsSync(activeHelperPath)).toBe(true);

    const diagnostics = runActiveDiagnostic(FIXTURE_PATHS);
    const reports = diagnostics.map(buildFixtureReport);

    const sample07 = reports.find((report) => report.fixture === "sample_07.pdf");
    const sample12 = reports.find((report) => report.fixture === "sample_12.pdf");
    const cv517 = reports.find((report) => report.fixture === "cv_517.pdf");

    expect(sample07).toBeTruthy();
    expect(sample12).toBeTruthy();
    expect(cv517).toBeTruthy();

    for (const report of reports) {
      expect(report.pageCount).toBeGreaterThan(0);
      expect(report.extraction.flatteningSignals.analysisUsesSingleString).toBe(true);
      expect(report.extraction.flatteningSignals.analysisPageCount).toBe(report.pageCount);
      expect(normalizeWhitespace(diagnostics.find((entry) => entry.fixture === report.fixture)?.extraction.analysisRawText ?? "")).not.toBe("");
    }

    expect(sample07?.extraction.serviceVisibleHeadingLines).toEqual(
      expect.arrayContaining(["PROFESSIONAL PROFILE:", "PERSONAL EXPERIENCE:", "LANGUAGES"]),
    );
    expect(sample07?.sectionCandidates.activeExtractSectionsKeys).toContain("BODY");
    expect(sample07?.sectionCandidates.activeExtractSectionsKeys).toEqual(
      expect.arrayContaining(["PROFILE", "EXPERIENCE", "EDUCATION", "LANGUAGES"]),
    );
    expect(sample07?.canonical.serviceRawSectionLabels).toEqual(
      expect.arrayContaining(["PROFILE", "EXPERIENCE", "EDUCATION", "LANGUAGES"]),
    );
    expect(sample07?.recovery.diagnostics?.largeRecoveryBlobCount).toBe(0);

    expect(sample12?.extraction.flatteningSignals.analysisPageCount).toBeGreaterThan(1);
    expect(sample12?.extraction.serviceVisibleHeadingLines).toEqual(
      expect.arrayContaining(["PERSONAL DOSSIER", "ACADEMIC CREDENTIALS", "PROFESSIONAL SKILLS", "EXPERIENCE"]),
    );
    expect(sample12?.sectionCandidates.activeExtractSectionsKeys).toContain("EDUCATION");
    expect(sample12?.sectionCandidates.activeExtractSectionsKeys).toContain("SKILLS");
    expect(sample12?.sectionCandidates.activeExtractSectionsKeys).toContain("ADDITIONAL INFORMATION");
    expect(sample12?.canonical.serviceRawSectionLabels).toContain("EDUCATION");
    expect(sample12?.canonical.serviceRawSectionLabels).toContain("SKILLS");
    expect(sample12?.canonical.serviceRawSectionLabels).toContain("ADDITIONAL INFORMATION");
    expect(sample12?.recovery.itemCount).toBe(1);
    expect(sample12?.sectionCandidates.informativeRawSectionLabels.filter((label) => label === "SKILLS").length).toBeGreaterThan(5);
    expect(sample12?.recovery.unknownSectionCount).toBe(1);
    expect(sample12?.recovery.diagnostics?.largeRecoveryBlobCount).toBe(0);

    expect(cv517?.extraction.spacedHeadingLikeLines.length).toBeGreaterThan(0);
    expect(cv517?.sectionCandidates.activeExtractSectionsKeys).toContain("BODY");
    expect(cv517?.sectionCandidates.informativeParseSectionCounts.experience).toBe(0);

    expect(reports).toMatchInlineSnapshot(`
      [
        {
          "canonical": {
            "appRawSectionLabels": [
              "BODY",
              "PROFILE",
              "EXPERIENCE",
              "EDUCATION",
              "LANGUAGES",
            ],
            "sectionPresence": {
              "education": true,
              "experience": true,
              "languages": true,
              "skills": true,
              "summary": true,
            },
            "serviceRawSectionLabels": [
              "BODY",
              "PROFILE",
              "EXPERIENCE",
              "EDUCATION",
              "LANGUAGES",
            ],
            "summaryPreview": "To Work in an environment which offers a good opportunity to share my knowledge and skills with other and participant my self and work towards for a compete sat",
          },
          "diagnosis": {
            "headingsPreservedIntoSections": true,
            "headingsVisibleAfterNormalization": true,
            "primaryBoundary": "heading collapse before recovery",
          },
          "extraction": {
            "flatteningSignals": {
              "analysisMatchesServiceJoined": true,
              "analysisPageCount": 1,
              "analysisUsesSingleString": true,
              "servicePageCount": 1,
            },
            "servicePageHeadingPreviews": [
              {
                "headingPreview": [
                  "CURRICULUM VITAE",
                  "MOHAMMAD JAMSHED",
                  "ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH",
                  "WEST DELHI - 110086",
                  "MOBILE : +91 8802876921(AIRTEL)",
                  ":+917992204995 (JIO)",
                  "Email : mohdjamshed.786jems@gmail.com",
                  "POST APPLIED FOR: STORE KEEPER",
                ],
                "pageNumber": 1,
              },
            ],
            "serviceVisibleHeadingLines": [
              "CURRICULUM VITAE",
              "MOHAMMAD JAMSHED",
              "ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH",
              "WEST DELHI - 110086",
              "MOBILE : +91 8802876921(AIRTEL)",
              "POST APPLIED FOR: STORE KEEPER",
              "PROFESSIONAL PROFILE:",
              "PERSONAL EXPERIENCE:",
              "PERSONAL BACKGROUND:",
              "EDUCATION BACKGROUND:",
              "LANGUAGES",
              "DECLARATION",
              "MOHAMMED JAMSHED",
            ],
            "spacedHeadingLikeLines": [],
            "visibleHeadings": [
              "PROFESSIONAL PROFILE:",
              "PERSONAL EXPERIENCE:",
              "EDUCATION BACKGROUND:",
              "LANGUAGES",
            ],
          },
          "fixture": "sample_07.pdf",
          "pageCount": 1,
          "recovery": {
            "diagnostics": {
              "countsByConfidenceBand": {
                "low": 1,
                "medium": 4,
              },
              "countsByIssueFlag": {
                "unknownSection": 1,
              },
              "countsByPredictedSection": {
                "custom": 1,
                "education": 1,
                "experience": 1,
                "languages": 1,
                "profile": 1,
              },
              "directImportItemCount": 4,
              "largeRecoveryBlobCount": 0,
              "processingTimeMs": ">=0",
              "recoveryItemCount": 1,
              "sourceSectionCount": 5,
              "splitAttempts": 2,
              "splitFragmentCount": 0,
              "suppressedTinyFragments": 2,
              "unknownResidualCount": 1,
            },
            "itemCount": 1,
            "itemSummaries": [
              {
                "confidenceScore": "low",
                "issueFlags": [
                  "unknownSection",
                ],
                "predictedSection": "custom",
                "preview": "CURRICULUM VITAE
      MOHAMMAD JAMSHED
      ADDR.- B-441,INDER ENCLAVE PHASE-1,KIRARI SULEMAN NAGAR, NORTH
      WEST DELHI - 110086
      MOB",
                "sourceLabel": "BODY",
              },
            ],
            "largeBlobFlags": [
              false,
            ],
            "recoveryIssueCounts": {
              "unknownSection": 1,
            },
            "sourceLabels": [
              "BODY",
              "PROFILE",
              "EXPERIENCE",
              "EDUCATION",
              "LANGUAGES",
            ],
            "sourceSectionCount": 5,
            "unknownSectionCount": 1,
          },
          "sectionCandidates": {
            "activeExtractSectionCounts": {
              "BODY": 1,
              "EDUCATION": 1,
              "EXPERIENCE": 1,
              "LANGUAGES": 1,
              "PROFILE": 1,
            },
            "activeExtractSectionsKeys": [
              "BODY",
              "PROFILE",
              "EXPERIENCE",
              "EDUCATION",
              "LANGUAGES",
            ],
            "informativeParseSectionCounts": {
              "achievements": 0,
              "education": 1,
              "experience": 1,
              "languages": 1,
              "skills": 0,
            },
            "informativeRawSectionLabels": [
              "EXPERIENCE",
              "EDUCATION",
              "LANGUAGES",
              "LANGUAGES",
              "LANGUAGES",
              "LANGUAGES",
              "LANGUAGES",
              "LANGUAGES",
              "LANGUAGES",
            ],
          },
        },
        {
          "canonical": {
            "appRawSectionLabels": [
              "BODY",
              "ADDITIONAL INFORMATION",
              "EDUCATION",
              "SKILLS",
              "EXPERIENCE",
            ],
            "sectionPresence": {
              "education": true,
              "experience": true,
              "languages": true,
              "skills": true,
              "summary": true,
            },
            "serviceRawSectionLabels": [
              "BODY",
              "ADDITIONAL INFORMATION",
              "EDUCATION",
              "SKILLS",
              "EXPERIENCE",
            ],
            "summaryPreview": "Worked at Shriram Transport Finance Company.",
          },
          "diagnosis": {
            "headingsPreservedIntoSections": true,
            "headingsVisibleAfterNormalization": true,
            "primaryBoundary": "page flattening and heading collapse before recovery",
          },
          "extraction": {
            "flatteningSignals": {
              "analysisMatchesServiceJoined": false,
              "analysisPageCount": 3,
              "analysisUsesSingleString": true,
              "servicePageCount": 3,
            },
            "servicePageHeadingPreviews": [
              {
                "headingPreview": [
                  "ARUN KUMAR U.C.",
                  "Mob:+91 9745004628 Email: arunkumar.uc@stfc.in",
                  "PERSONAL DOSSIER",
                  "Address : UPPUKARANCHALLA",
                  "VILAYODI POST",
                  "PALAKKAD",
                  "PIN-678103",
                  "Date of Birth : 25/02/1983",
                ],
                "pageNumber": 1,
              },
              {
                "headingPreview": [
                  "PROFESSIONAL SKILLS",
                  "Good communication, interpersonal and problem solving skills",
                  "",
                  "Good writing and presentation Skills",
                  "",
                  "Work effectively both as a team member and independently",
                  "",
                  "Accomplish projects with little supervision",
                ],
                "pageNumber": 2,
              },
              {
                "headingPreview": [
                  "Date: 3.06.2017 Arun Kumar UC",
                ],
                "pageNumber": 3,
              },
            ],
            "serviceVisibleHeadingLines": [
              "ARUN KUMAR U.C.",
              "PERSONAL DOSSIER",
              "VILAYODI POST",
              "PALAKKAD",
              "ACADEMIC CREDENTIALS",
              "Year",
              "Sl. College/",
              "Course University/ Board Of",
              "No Institution",
              "Passing",
              "Victoria",
              "History University",
              "Palakkad",
              "Higher Secondary",
              "School",
              "IT FORTE",
              "M.S Office",
              "PROFESSIONAL SKILLS",
              "EXPERIENCE",
              "REFERENCES",
            ],
            "spacedHeadingLikeLines": [
              "D a t e : 3 . 0 6 . 2 0 1 7 A r u n K u m a r U C",
            ],
            "visibleHeadings": [
              "PERSONAL DOSSIER",
              "ACADEMIC CREDENTIALS",
              "PROFESSIONAL SKILLS",
              "EXPERIENCE",
            ],
          },
          "fixture": "sample_12.pdf",
          "pageCount": 3,
          "recovery": {
            "diagnostics": {
              "countsByConfidenceBand": {
                "low": 1,
                "medium": 4,
              },
              "countsByIssueFlag": {
                "unknownSection": 1,
              },
              "countsByPredictedSection": {
                "additional_information": 1,
                "custom": 1,
                "education": 1,
                "experience": 1,
                "skills": 1,
              },
              "directImportItemCount": 4,
              "largeRecoveryBlobCount": 0,
              "processingTimeMs": ">=0",
              "recoveryItemCount": 1,
              "sourceSectionCount": 5,
              "splitAttempts": 3,
              "splitFragmentCount": 0,
              "suppressedTinyFragments": 2,
              "unknownResidualCount": 1,
            },
            "itemCount": 1,
            "itemSummaries": [
              {
                "confidenceScore": "low",
                "issueFlags": [
                  "unknownSection",
                ],
                "predictedSection": "custom",
                "preview": "ARUN KUMAR U.C.
      Mob:+91 9745004628 Email: arunkumar.uc@stfc.in",
                "sourceLabel": "BODY",
              },
            ],
            "largeBlobFlags": [
              false,
            ],
            "recoveryIssueCounts": {
              "unknownSection": 1,
            },
            "sourceLabels": [
              "BODY",
              "ADDITIONAL INFORMATION",
              "EDUCATION",
              "SKILLS",
              "EXPERIENCE",
            ],
            "sourceSectionCount": 5,
            "unknownSectionCount": 1,
          },
          "sectionCandidates": {
            "activeExtractSectionCounts": {
              "ADDITIONAL INFORMATION": 1,
              "BODY": 1,
              "EDUCATION": 1,
              "EXPERIENCE": 1,
              "SKILLS": 1,
            },
            "activeExtractSectionsKeys": [
              "BODY",
              "ADDITIONAL INFORMATION",
              "EDUCATION",
              "SKILLS",
              "EXPERIENCE",
            ],
            "informativeParseSectionCounts": {
              "achievements": 0,
              "education": 0,
              "experience": 2,
              "languages": 0,
              "skills": 1,
            },
            "informativeRawSectionLabels": [
              "EXPERIENCE",
              "EXPERIENCE",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
              "SKILLS",
            ],
          },
        },
        {
          "canonical": {
            "appRawSectionLabels": [
              "BODY",
              "SUMMARY",
              "SUMMARY",
              "EXPERIENCE",
              "SKILLS",
              "DETAILS",
            ],
            "sectionPresence": {
              "education": true,
              "experience": true,
              "languages": true,
              "skills": true,
              "summary": true,
            },
            "serviceRawSectionLabels": [
              "BODY",
              "SUMMARY",
              "SUMMARY",
              "EXPERIENCE",
              "SKILLS",
              "DETAILS",
            ],
            "summaryPreview": "Seeking a position as Project Engineer with a reputed organization where I can contribute and utilize my knowledge & skills for mutual growth.",
          },
          "diagnosis": {
            "headingsPreservedIntoSections": true,
            "headingsVisibleAfterNormalization": true,
            "primaryBoundary": "raw extraction and heading collapse",
          },
          "extraction": {
            "flatteningSignals": {
              "analysisMatchesServiceJoined": false,
              "analysisPageCount": 4,
              "analysisUsesSingleString": true,
              "servicePageCount": 4,
            },
            "servicePageHeadingPreviews": [
              {
                "headingPreview": [
                  "Arockia",
                  "Juslin Deepan",
                  "Dubai, UAE",
                  "Mobile: 971558058375",
                  "Email: deepaneee2010@gmail.com",
                  "OBJECTIVE",
                  "Seeking a position as Project Engineer with a reputed organization where I can contribute and",
                  "utilize my knowledge & skills for mutual growth.",
                ],
                "pageNumber": 1,
              },
              {
                "headingPreview": [
                  "10 Storied x 2 commercial tower CBRE, Chennai, India",
                  "Current Position: Project engineer- Electrical",
                  "Employer : Premier composite technology (DIP-2, Dubai)",
                  "Tenure : February-2015 to still working",
                  "Responsibilities:",
                  " Monitor compliance to applicable codes, practices, QA/QC policies,",
                  "performance standards and specifications.",
                  " Interact daily with the clients to interpret their needs and requirements and",
                ],
                "pageNumber": 2,
              },
              {
                "headingPreview": [
                  " Able to demonstrate skills and knowledge in installation and servicing MEP assets and",
                  "mechanical equipment.",
                  " Interpreting HVAC, Electrical, Plumbing, Mechanical, BMS and Electronics system, and",
                  "replacing faulty operational and safety control systems and spare parts.",
                  " Planning to Troubleshoot day today building operations, engineering and systems and",
                  "equipment maintenance, total MEP operation.",
                  " Verify the load schedule and alter that as per the (Future load) requirements, following",
                  "DEWA codes and regulation for the new installation on the existing system.",
                ],
                "pageNumber": 3,
              },
              {
                "headingPreview": [
                  " Submitting monthly/ weekly/ daily preventive and reactive maintenance report",
                  " RO plant monitoring and maintenance",
                  "Position held : Site Engineer",
                  "Employer : Power tech Pvt ltd, India",
                  "Tenure : September 2010– August 2011",
                  "Responsibilities:",
                  " Analyse the architecture design drawing and planning the installation",
                  " Studying the DWG and explaining the co-workers for the erection of the panels",
                ],
                "pageNumber": 4,
              },
            ],
            "serviceVisibleHeadingLines": [
              "Arockia",
              "Juslin Deepan",
              "OBJECTIVE",
              "PROFESSIONAL SUMMARY",
              "PROFESSIONAL EXPERIENCE",
              "Project Handled",
              "PV PROJECTS",
              "CONSTRUCTION",
              "FACILITY AND MAINTENANCE",
              "Responsibilities:",
              "ACADEMIC QUALIFICATION",
              "TECHNICAL SKILLS",
              "Technical Proficiency",
              "Personal Details",
            ],
            "spacedHeadingLikeLines": [
              "A r o c k i a",
              "J u s l i n D e e p a n",
              "D u b a i , U A E",
              "M o b i l e : 9 7 1 5 5 8 0 5 8 3 7 5",
              "E m a i l : d e e p a n e e e 2 0 1 0 @ g m a i l . c o m",
              "O B J E C T I V E",
              "S e e k i n g a p o s i t i o n a s P r o j e c t E n g i n e e r w i t h a r e p u t e d o r g a n i z a t i o n w h e r e I c a n c o n t r i b u t e a n d",
              "u t i l i z e m y k n o w l e d g e & s k i l l s f o r m u t u a l g r o w t h .",
              "P R O F E S S I O N A L S U M M A R Y",
              "o 7 + y e a r s o f e x p e r i e n c e a s E l e c t r i c a l E n g i n e e r i n U A E & I n d i a .",
            ],
            "visibleHeadings": [
              "OBJECTIVE",
              "PROFESSIONAL SUMMARY",
              "PROFESSIONAL EXPERIENCE",
              "PV PROJECTS",
              "TECHNICAL SKILLS",
              "Personal Details",
            ],
          },
          "fixture": "cv_517.pdf",
          "pageCount": 4,
          "recovery": {
            "diagnostics": {
              "countsByConfidenceBand": {
                "low": 1,
                "medium": 5,
              },
              "countsByIssueFlag": {
                "ambiguousStructure": 1,
                "unknownSection": 1,
              },
              "countsByPredictedSection": {
                "custom": 1,
                "experience": 1,
                "profile": 1,
                "skills": 1,
                "summary": 2,
              },
              "directImportItemCount": 5,
              "largeRecoveryBlobCount": 0,
              "processingTimeMs": ">=0",
              "recoveryItemCount": 1,
              "sourceSectionCount": 6,
              "splitAttempts": 1,
              "splitFragmentCount": 0,
              "suppressedTinyFragments": 1,
              "unknownResidualCount": 1,
            },
            "itemCount": 1,
            "itemSummaries": [
              {
                "confidenceScore": "low",
                "issueFlags": [
                  "unknownSection",
                ],
                "predictedSection": "custom",
                "preview": "Arockia
      Juslin Deepan
      Dubai, UAE
      Mobile: 971558058375
      Email: deepaneee2010@gmail.com",
                "sourceLabel": "BODY",
              },
            ],
            "largeBlobFlags": [
              false,
            ],
            "recoveryIssueCounts": {
              "unknownSection": 1,
            },
            "sourceLabels": [
              "BODY",
              "SUMMARY",
              "SUMMARY",
              "EXPERIENCE",
              "SKILLS",
              "DETAILS",
            ],
            "sourceSectionCount": 6,
            "unknownSectionCount": 1,
          },
          "sectionCandidates": {
            "activeExtractSectionCounts": {
              "BODY": 1,
              "DETAILS": 1,
              "EXPERIENCE": 1,
              "SKILLS": 1,
              "SUMMARY": 2,
            },
            "activeExtractSectionsKeys": [
              "BODY",
              "SUMMARY",
              "EXPERIENCE",
              "SKILLS",
              "DETAILS",
            ],
            "informativeParseSectionCounts": {
              "achievements": 0,
              "education": 0,
              "experience": 0,
              "languages": 0,
              "skills": 0,
            },
            "informativeRawSectionLabels": [],
          },
        },
      ]
    `);
  });
});
