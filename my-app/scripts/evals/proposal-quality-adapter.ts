import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as path from "node:path";

import type {
  BenchmarkCase,
  BenchmarkCaseResult,
  BenchmarkModel,
} from "../../benchmarks/proposal-generation/core/types";
import type { RunManifest } from "../../benchmarks/proposal-generation/core/exporters";
import {
  PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES,
  PROPOSAL_QUALITY_FIXTURES,
  assertProposalQualityHardGates,
  runProposalQualityHarness,
  type ProposalEvalResult,
  type ProposalFactSource,
  type ProposalQualityCandidateFact,
  type ProposalQualityFixture,
} from "../../convex/lib/proposals/proposalQualityHarness";

const DEFAULT_RESULTS_PATH =
  "benchmarks/proposal-generation/results/2026-03-12T15-24-05-237Z/results.json";
const DEFAULT_OUTPUT_ROOT = "/private/tmp/neyssan-proposal-quality-benchmark";

type BenchmarkManifestResult = RunManifest & {
  records: Array<{
    benchmarkCase: BenchmarkCase;
    prompt: string;
    results: Record<string, BenchmarkCaseResult>;
  }>;
};

export type ProposalBenchmarkQualityScore = Omit<
  ProposalEvalResult,
  "variant" | "fixtureId"
> & {
  fixtureId: string;
  variant: string;
  blindLabel: string;
  generatedLetter: string;
  outputTextForScoring: string;
  status: "ok";
  latencyMs: number | null;
  totalCostUsd: number | null;
};

export type ProposalBenchmarkSkippedScore = {
  fixtureId: string;
  variant: string;
  blindLabel: string;
  status: "error" | "skipped";
  error: string;
  latencyMs: number | null;
  totalCostUsd: number | null;
};

export type ProposalBenchmarkQualityReport = {
  runId: string;
  createdAt: string;
  sourceResultsPath: string;
  blind: boolean;
  scores: Array<ProposalBenchmarkQualityScore | ProposalBenchmarkSkippedScore>;
  averagesByBlindLabel: Array<{
    blindLabel: string;
    fixtureCount: number;
    averageRecruiterCaseScore: number;
    unsupportedClaims: number;
    bannedCompanyPraise: number;
    credentialInflationCount: number;
    noContextViolationCount: number;
    averageSupportedKeywordCoverage: number;
    selectorReadiness: Record<ProposalEvalResult["selectorReadiness"], number>;
    averageLatencyMs: number | null;
    totalCostUsd: number | null;
  }>;
  staticHarnessPositiveSummary: Array<{
    fixtureId: string;
    baselineReadiness: ProposalEvalResult["selectorReadiness"];
    baselineRecruiterCaseScore: ProposalEvalResult["recruiterCaseScore"];
    criteriaShadowReadiness: ProposalEvalResult["selectorReadiness"];
    criteriaShadowRecruiterCaseScore: ProposalEvalResult["recruiterCaseScore"];
    worseThanBaseline: boolean;
  }>;
  staticHarnessNegativeControlSummary: Array<{
    fixtureId: string;
    expectedFailureCodes: string[];
    observedFailureCodes: string[];
    passed: boolean;
  }>;
  manualReviewShortlist: Array<{
    fixtureId: string;
    blindLabel: string;
    reasons: string[];
    recruiterCaseScore: ProposalEvalResult["recruiterCaseScore"];
    selectorReadiness: ProposalEvalResult["selectorReadiness"];
    unsupportedClaims: number;
    missingCriticalRequirements: string[];
  }>;
};

export type ProposalBenchmarkRevealMap = Record<
  string,
  {
    model: string;
    provider: string;
  }
>;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhrase(value: string): string {
  return compactWhitespace(
    value
      .replace(/\b(?:do not|claim|invent|beyond|with|experience|leadership)\b/gi, " ")
      .replace(/[^a-z0-9+#.%\s-]/gi, " "),
  );
}

function includesPhrase(haystack: string, phrase: string): boolean {
  return (
    compactWhitespace(haystack).toLowerCase().includes(
      compactWhitespace(phrase).toLowerCase(),
    )
  );
}

function priorityForFact(value: string): ProposalQualityCandidateFact["priority"] {
  if (/\b(?:improved|increased|reduced|cut|grew|lift|percent|%)\b/i.test(value)) {
    return "achievement";
  }
  if (/\b(?:dashboard|workflow|handoff|process|reporting|documentation|coordination)\b/i.test(value)) {
    return "workflow";
  }
  if (/\b(?:react|typescript|salesforce|webflow|sql|python|node\.?js|excel|crm)\b/i.test(value)) {
    return "tool";
  }
  return "responsibility";
}

function factSourceForCase(benchmarkCase: BenchmarkCase): ProposalFactSource {
  if (benchmarkCase.candidateContext?.recentExperience?.length) return "resume";
  if (benchmarkCase.candidateContext) return "profile";
  return "source_backed_candidate_data";
}

function normalizedGroundingPhrases(benchmarkCase: BenchmarkCase): string[] {
  return benchmarkCase.expectedGrounding
    .map(normalizePhrase)
    .flatMap((value) => {
      const phrases = [value];
      const percent = value.match(/\b\d+\s*percent\b/i)?.[0];
      if (percent) phrases.push(percent);
      const beforeWith = value.split(/\bwith\b/i)[0]?.trim();
      if (beforeWith && beforeWith.length >= 4) phrases.push(beforeWith);
      return phrases;
    })
    .filter((value, index, values) => value.length >= 3 && values.indexOf(value) === index);
}

function buildCandidateFacts(
  benchmarkCase: BenchmarkCase,
): ProposalQualityCandidateFact[] {
  const source = factSourceForCase(benchmarkCase);
  const facts: ProposalQualityCandidateFact[] = [];
  const addFact = (text: string, mapsTo: string[]) => {
    const cleaned = compactWhitespace(text);
    if (!cleaned || facts.some((fact) => fact.text === cleaned)) return;
    facts.push({
      id: `f${facts.length + 1}`,
      text: cleaned,
      source,
      mapsTo,
      priority: priorityForFact(cleaned),
    });
  };

  for (const achievement of benchmarkCase.candidateContext?.standoutAchievements ?? []) {
    addFact(achievement, benchmarkCase.expectedGrounding);
  }
  for (const experience of benchmarkCase.candidateContext?.recentExperience ?? []) {
    for (const highlight of experience.highlights ?? []) {
      addFact(highlight, benchmarkCase.expectedGrounding);
    }
  }
  for (const skill of benchmarkCase.candidateContext?.topSkills ?? []) {
    addFact(skill, benchmarkCase.expectedGrounding);
  }
  for (const phrase of normalizedGroundingPhrases(benchmarkCase)) {
    addFact(phrase, benchmarkCase.expectedGrounding);
  }

  return facts;
}

function extractForbiddenClaimPhrases(benchmarkCase: BenchmarkCase): string[] {
  return benchmarkCase.forbiddenClaims
    .flatMap((claim) =>
      claim
        .replace(/^do not\s+/i, "")
        .replace(/\.$/, "")
        .split(/\bor\b|,|;/i)
        .map(normalizePhrase),
    )
    .filter((phrase) => phrase.length >= 4)
    .filter((phrase, index, values) => values.indexOf(phrase) === index);
}

function stripLetterBoundaries(letter: string, candidateName?: string): string {
  const candidateNamePattern = candidateName
    ? new RegExp(`^${candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
    : null;
  return letter
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^dear\b/i.test(line))
    .filter((line) => !/^(best regards|regards|sincerely|kind regards|thank you),?$/i.test(line))
    .filter((line) => !(candidateNamePattern?.test(line) ?? false))
    .join("\n\n");
}

export function benchmarkCaseToQualityFixture(args: {
  benchmarkCase: BenchmarkCase;
  outputText: string;
}): ProposalQualityFixture {
  const benchmarkCase = args.benchmarkCase;
  const bodyText = stripLetterBoundaries(
    args.outputText,
    benchmarkCase.candidateContext?.name,
  );
  const blockedClaims = extractForbiddenClaimPhrases(benchmarkCase);
  const candidateFacts = buildCandidateFacts(benchmarkCase);
  const expectedSupportedKeywords = [
    ...normalizedGroundingPhrases(benchmarkCase),
    ...(benchmarkCase.candidateContext?.topSkills ?? []),
  ].filter((value, index, values) => value.length >= 3 && values.indexOf(value) === index);

  return {
    id: benchmarkCase.id,
    label: benchmarkCase.label,
    jobTitle: benchmarkCase.jobTitle,
    jobDescription: benchmarkCase.jobDescription,
    contextMode: benchmarkCase.candidateContext
      ? benchmarkCase.personalizationRichness === "minimal"
        ? "minimal"
        : benchmarkCase.personalizationRichness === "sparse"
          ? "sparse"
          : "rich"
      : "none",
    candidateFacts,
    expectedCriticalRequirements:
      benchmarkCase.expectedGrounding.length > 0
        ? benchmarkCase.expectedGrounding
        : [benchmarkCase.jobTitle],
    expectedSupportedKeywords,
    expectedBlockedKeywords: blockedClaims,
    expectedForbiddenPhrases: [
      "I am passionate about your mission",
      "My skills make me a perfect fit",
      "I share your values",
      "your mission resonates with me",
      "I admire your culture",
      ...blockedClaims,
    ],
    topJobPriorities:
      benchmarkCase.expectedGrounding.length > 0
        ? benchmarkCase.expectedGrounding
        : [benchmarkCase.jobTitle],
    sourceBackedCandidateFacts: candidateFacts.map((fact) => fact.text),
    allowedTransferableEvidence: candidateFacts
      .filter((fact) => fact.priority === "workflow" || fact.priority === "domain")
      .map((fact) => fact.text),
    blockedClaims,
    expectedGaps: blockedClaims,
    expectedCompanyValuesBehavior: "none",
    safeRoleTransitions: [
      benchmarkCase.jobTitle,
      ...benchmarkCase.expectedGrounding,
      ...expectedSupportedKeywords,
    ],
    letters: {
      baseline: bodyText,
      criteria_audit_shadow: bodyText,
    },
  };
}

function blindLabelForIndex(index: number): string {
  return `Candidate ${String.fromCharCode(65 + index)}`;
}

export function buildBlindRevealMap(
  manifest: BenchmarkManifestResult,
): ProposalBenchmarkRevealMap {
  return manifest.models
    .map((model) => ({
      model,
      sortKey: createHash("sha256")
        .update(`${manifest.runId}:${model}`)
        .digest("hex"),
    }))
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .reduce<ProposalBenchmarkRevealMap>((map, item, index) => {
      const provider = manifest.records
        .map((record) => record.results[item.model]?.provider)
        .find(Boolean);
      map[blindLabelForIndex(index)] = {
        model: item.model,
        provider: provider ?? "unknown",
      };
      return map;
    }, {});
}

function modelToBlindLabel(
  revealMap: ProposalBenchmarkRevealMap,
  model: string,
): string {
  return (
    Object.entries(revealMap).find(([, value]) => value.model === model)?.[0] ??
    model
  );
}

function scoreSuccessResult(args: {
  benchmarkCase: BenchmarkCase;
  model: string;
  blindLabel: string;
  result: Extract<BenchmarkCaseResult, { status: "ok" }>;
}): ProposalBenchmarkQualityScore {
  const fixture = benchmarkCaseToQualityFixture({
    benchmarkCase: args.benchmarkCase,
    outputText: args.result.outputText,
  });
  const [score] = runProposalQualityHarness({
    fixtures: [fixture],
    variants: ["semantic_planner_shadow"],
    hardness: "hard",
  });

  return {
    ...score,
    fixtureId: args.benchmarkCase.id,
    variant: args.blindLabel,
    blindLabel: args.blindLabel,
    generatedLetter: args.result.outputText,
    outputTextForScoring: fixture.letters.baseline,
    status: "ok",
    latencyMs: args.result.latencyMs,
    totalCostUsd: args.result.cost.totalCostUsd,
  };
}

function buildAverages(
  scores: Array<ProposalBenchmarkQualityScore | ProposalBenchmarkSkippedScore>,
): ProposalBenchmarkQualityReport["averagesByBlindLabel"] {
  const labels = [...new Set(scores.map((score) => score.blindLabel))];
  return labels.map((blindLabel) => {
    const okScores = scores.filter(
      (score): score is ProposalBenchmarkQualityScore =>
        score.blindLabel === blindLabel && score.status === "ok",
    );
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    const latencyValues = okScores
      .map((score) => score.latencyMs)
      .filter((value): value is number => value != null);
    const costValues = okScores
      .map((score) => score.totalCostUsd)
      .filter((value): value is number => value != null);

    return {
      blindLabel,
      fixtureCount: okScores.length,
      averageRecruiterCaseScore:
        okScores.length === 0
          ? 0
          : Number(
              (sum(okScores.map((score) => score.recruiterCaseScore)) / okScores.length).toFixed(2),
            ),
      unsupportedClaims: sum(okScores.map((score) => score.unsupportedClaims)),
      bannedCompanyPraise: sum(okScores.map((score) => score.bannedCompanyPraise)),
      credentialInflationCount: okScores.filter((score) => score.credentialInflation).length,
      noContextViolationCount: okScores.filter((score) => score.noContextViolation).length,
      averageSupportedKeywordCoverage:
        okScores.length === 0
          ? 0
          : Number(
              (sum(okScores.map((score) => score.supportedKeywordCoverage)) / okScores.length).toFixed(2),
            ),
      selectorReadiness: {
        fail: okScores.filter((score) => score.selectorReadiness === "fail").length,
        weak: okScores.filter((score) => score.selectorReadiness === "weak").length,
        pass: okScores.filter((score) => score.selectorReadiness === "pass").length,
        strong: okScores.filter((score) => score.selectorReadiness === "strong").length,
      },
      averageLatencyMs:
        latencyValues.length === 0
          ? null
          : Math.round(sum(latencyValues) / latencyValues.length),
      totalCostUsd:
        costValues.length === 0
          ? null
          : Number(sum(costValues).toFixed(6)),
    };
  });
}

function scoreSortValue(score: ProposalBenchmarkQualityScore): number {
  const readinessRank: Record<ProposalEvalResult["selectorReadiness"], number> = {
    fail: 0,
    weak: 1,
    pass: 2,
    strong: 3,
  };
  return (
    score.recruiterCaseScore * 100 +
    readinessRank[score.selectorReadiness] * 10 +
    score.supportedKeywordCoverage -
    score.unsupportedClaims * 20 -
    score.bannedCompanyPraise * 20 -
    (score.credentialInflation ? 20 : 0) -
    (score.noContextViolation ? 20 : 0)
  );
}

function addShortlistEntry(
  entries: ProposalBenchmarkQualityReport["manualReviewShortlist"],
  score: ProposalBenchmarkQualityScore,
  reason: string,
): void {
  const existing = entries.find(
    (entry) =>
      entry.fixtureId === score.fixtureId && entry.blindLabel === score.blindLabel,
  );
  if (existing) {
    if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    return;
  }
  entries.push({
    fixtureId: score.fixtureId,
    blindLabel: score.blindLabel,
    reasons: [reason],
    recruiterCaseScore: score.recruiterCaseScore,
    selectorReadiness: score.selectorReadiness,
    unsupportedClaims: score.unsupportedClaims,
    missingCriticalRequirements: score.missingCriticalRequirements,
  });
}

function buildManualReviewShortlist(
  scores: Array<ProposalBenchmarkQualityScore | ProposalBenchmarkSkippedScore>,
): ProposalBenchmarkQualityReport["manualReviewShortlist"] {
  const okScores = scores.filter(
    (score): score is ProposalBenchmarkQualityScore => score.status === "ok",
  );
  const entries: ProposalBenchmarkQualityReport["manualReviewShortlist"] = [];

  for (const blindLabel of [...new Set(okScores.map((score) => score.blindLabel))]) {
    const labelScores = okScores
      .filter((score) => score.blindLabel === blindLabel)
      .sort((left, right) => scoreSortValue(right) - scoreSortValue(left));
    const best = labelScores[0];
    const worst = labelScores[labelScores.length - 1];
    if (best) addShortlistEntry(entries, best, "best output for blind label");
    if (worst) addShortlistEntry(entries, worst, "worst output for blind label");
  }

  for (const score of okScores) {
    if (score.selectorReadiness === "weak" || score.selectorReadiness === "fail") {
      addShortlistEntry(entries, score, `selector readiness ${score.selectorReadiness}`);
    }
    if (score.recruiterCaseScore <= 3) {
      addShortlistEntry(entries, score, "recruiter score <= 3");
    }
    if (score.unsupportedClaims > 0) {
      addShortlistEntry(entries, score, "unsupported claims detected");
    }
    if (score.missingCriticalRequirements.length > 0) {
      addShortlistEntry(entries, score, "missing critical requirements");
    }
  }

  return entries;
}

function staticPositiveSummary(): ProposalBenchmarkQualityReport["staticHarnessPositiveSummary"] {
  const results = runProposalQualityHarness({
    fixtures: PROPOSAL_QUALITY_FIXTURES,
    variants: ["baseline", "criteria_audit_shadow"],
  });
  return PROPOSAL_QUALITY_FIXTURES.map((fixture) => {
    const baseline = results.find(
      (result) => result.fixtureId === fixture.id && result.variant === "baseline",
    );
    const shadow = results.find(
      (result) =>
        result.fixtureId === fixture.id && result.variant === "criteria_audit_shadow",
    );
    if (!baseline || !shadow) {
      throw new Error(`Missing static harness result for ${fixture.id}`);
    }
    return {
      fixtureId: fixture.id,
      baselineReadiness: baseline.selectorReadiness,
      baselineRecruiterCaseScore: baseline.recruiterCaseScore,
      criteriaShadowReadiness: shadow.selectorReadiness,
      criteriaShadowRecruiterCaseScore: shadow.recruiterCaseScore,
      worseThanBaseline: shadow.worseThanBaseline,
    };
  });
}

function staticNegativeSummary(): ProposalBenchmarkQualityReport["staticHarnessNegativeControlSummary"] {
  const results = runProposalQualityHarness({
    fixtures: PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES,
    variants: ["baseline"],
    hardness: "adversarial",
  });
  const failures = assertProposalQualityHardGates(results);
  return PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES.map((fixture) => {
    const observedFailureCodes = failures.filter((failure) =>
      failure.startsWith(`${fixture.id}:`),
    );
    const expectedFailureCodes = fixture.expectedFailureCodes ?? [];
    return {
      fixtureId: fixture.id,
      expectedFailureCodes,
      observedFailureCodes,
      passed: expectedFailureCodes.every((failure) =>
        observedFailureCodes.includes(failure),
      ),
    };
  });
}

export function scoreBenchmarkManifest(args: {
  manifest: BenchmarkManifestResult;
  sourceResultsPath: string;
  blind?: boolean;
}): {
  report: ProposalBenchmarkQualityReport;
  revealMap: ProposalBenchmarkRevealMap;
} {
  const revealMap = buildBlindRevealMap(args.manifest);
  const scores: ProposalBenchmarkQualityReport["scores"] = [];

  for (const record of args.manifest.records) {
    for (const [model, result] of Object.entries(record.results)) {
      const blindLabel = args.blind === false ? model : modelToBlindLabel(revealMap, model);
      if (result.status === "ok") {
        scores.push(
          scoreSuccessResult({
            benchmarkCase: record.benchmarkCase,
            model,
            blindLabel,
            result,
          }),
        );
      } else {
        scores.push({
          fixtureId: record.benchmarkCase.id,
          variant: blindLabel,
          blindLabel,
          status: result.status,
          error: result.error,
          latencyMs: result.latencyMs,
          totalCostUsd: result.cost.totalCostUsd,
        });
      }
    }
  }

  const report: ProposalBenchmarkQualityReport = {
    runId: args.manifest.runId,
    createdAt: new Date().toISOString(),
    sourceResultsPath: args.sourceResultsPath,
    blind: args.blind !== false,
    scores,
    averagesByBlindLabel: buildAverages(scores),
    staticHarnessPositiveSummary: staticPositiveSummary(),
    staticHarnessNegativeControlSummary: staticNegativeSummary(),
    manualReviewShortlist: buildManualReviewShortlist(scores),
  };

  return { report, revealMap };
}

export async function loadSavedBenchmarkManifest(args?: {
  resultsPath?: string;
  workdir?: string;
}): Promise<BenchmarkManifestResult> {
  const workdir = args?.workdir ?? process.cwd();
  const resolvedPath = path.resolve(workdir, args?.resultsPath ?? DEFAULT_RESULTS_PATH);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw) as BenchmarkManifestResult;
}

function renderMarkdownReport(report: ProposalBenchmarkQualityReport): string {
  const lines: string[] = [];
  lines.push("# Proposal Quality Harness Benchmark Report");
  lines.push("");
  lines.push(`- Run ID: \`${report.runId}\``);
  lines.push(`- Source results: \`${report.sourceResultsPath}\``);
  lines.push(`- Blind scoring: \`${report.blind ? "yes" : "no"}\``);
  lines.push("");
  lines.push("## Per-Model Averages");
  lines.push("");
  lines.push("| Blind label | Fixtures | Avg recruiter | Unsupported claims | Praise | Credential inflation | No-context violations | Avg keyword coverage | Readiness | Avg latency | Total cost |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |");
  for (const row of report.averagesByBlindLabel) {
    lines.push(
      [
        row.blindLabel,
        row.fixtureCount,
        row.averageRecruiterCaseScore,
        row.unsupportedClaims,
        row.bannedCompanyPraise,
        row.credentialInflationCount,
        row.noContextViolationCount,
        row.averageSupportedKeywordCoverage,
        `fail=${row.selectorReadiness.fail}, weak=${row.selectorReadiness.weak}, pass=${row.selectorReadiness.pass}, strong=${row.selectorReadiness.strong}`,
        row.averageLatencyMs ?? "n/a",
        row.totalCostUsd ?? "n/a",
      ].join(" | "),
    );
  }
  lines.push("");
  lines.push("## Manual Review Shortlist");
  lines.push("");
  lines.push("| Fixture | Blind label | Reasons | Readiness | Recruiter | Unsupported claims | Missing critical requirements |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | --- |");
  for (const row of report.manualReviewShortlist) {
    lines.push(
      [
        row.fixtureId,
        row.blindLabel,
        row.reasons.join("<br>"),
        row.selectorReadiness,
        row.recruiterCaseScore,
        row.unsupportedClaims,
        row.missingCriticalRequirements.join("<br>") || "none",
      ].join(" | "),
    );
  }
  lines.push("");
  lines.push("## Negative Controls");
  lines.push("");
  lines.push("| Fixture | Expected failures observed | Result |");
  lines.push("| --- | --- | --- |");
  for (const row of report.staticHarnessNegativeControlSummary) {
    lines.push(
      `| ${row.fixtureId} | ${row.observedFailureCodes.join("<br>")} | ${row.passed ? "pass" : "fail"} |`,
    );
  }
  lines.push("");
  lines.push("## Fixture Scores");
  lines.push("");
  lines.push("| Fixture | Blind label | Readiness | Recruiter | Unsupported claims | Praise | Credential inflation | No-context violation | Keyword coverage | Planned mode | Planned blocked | Planned missing | Plan warnings |");
  lines.push("| --- | --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- | ---: | ---: | ---: |");
  for (const score of report.scores) {
    if (score.status !== "ok") continue;
    lines.push(
      [
        score.fixtureId,
        score.blindLabel,
        score.selectorReadiness,
        score.recruiterCaseScore,
        score.unsupportedClaims,
        score.bannedCompanyPraise,
        score.credentialInflation ? "yes" : "no",
        score.noContextViolation ? "yes" : "no",
        score.supportedKeywordCoverage,
        score.plannedWritingMode ?? "none",
        score.plannedBlockedClaimsCount ?? 0,
        score.plannedMissingCriticalRequirementsCount ?? 0,
        score.truthPlanValidationWarnings.length,
      ].join(" | "),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function writeProposalQualityBenchmarkArtifacts(args: {
  report: ProposalBenchmarkQualityReport;
  revealMap: ProposalBenchmarkRevealMap;
  outputDir?: string;
}): Promise<{
  reportJsonPath: string;
  revealMapPath: string;
  markdownPath: string;
}> {
  const outputDir =
    args.outputDir ?? path.join(DEFAULT_OUTPUT_ROOT, args.report.runId);
  await mkdir(outputDir, { recursive: true });
  const reportJsonPath = path.join(outputDir, "quality-harness-report.json");
  const revealMapPath = path.join(outputDir, "quality-harness-reveal-map.json");
  const markdownPath = path.join(outputDir, "quality-harness-review.md");

  await writeFile(reportJsonPath, `${JSON.stringify(args.report, null, 2)}\n`, "utf8");
  await writeFile(revealMapPath, `${JSON.stringify(args.revealMap, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdownReport(args.report), "utf8");

  return { reportJsonPath, revealMapPath, markdownPath };
}

function parseCliArgs(argv: string[]): {
  resultsPath?: string;
  outputDir?: string;
  blind: boolean;
} {
  const options = { blind: true } as {
    resultsPath?: string;
    outputDir?: string;
    blind: boolean;
  };
  for (const arg of argv) {
    if (arg.startsWith("--results=")) {
      options.resultsPath = arg.slice("--results=".length);
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length);
    } else if (arg === "--no-blind") {
      options.blind = false;
    }
  }
  return options;
}

export async function runProposalQualityAdapterCli(argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  const sourceResultsPath = path.resolve(
    process.cwd(),
    options.resultsPath ?? DEFAULT_RESULTS_PATH,
  );
  if (!existsSync(sourceResultsPath)) {
    throw new Error(`Saved benchmark results not found: ${sourceResultsPath}`);
  }
  const manifest = await loadSavedBenchmarkManifest({
    resultsPath: sourceResultsPath,
    workdir: process.cwd(),
  });
  const { report, revealMap } = scoreBenchmarkManifest({
    manifest,
    sourceResultsPath,
    blind: options.blind,
  });
  const artifacts = await writeProposalQualityBenchmarkArtifacts({
    report,
    revealMap,
    outputDir: options.outputDir,
  });

  console.log(`Proposal quality benchmark dry score completed: ${report.runId}`);
  console.log(`Report: ${artifacts.reportJsonPath}`);
  console.log(`Review: ${artifacts.markdownPath}`);
  console.log(`Reveal map: ${artifacts.revealMapPath}`);
  console.log("Average recruiter scores:");
  for (const average of report.averagesByBlindLabel) {
    console.log(
      `- ${average.blindLabel}: ${average.averageRecruiterCaseScore} (${average.fixtureCount} fixtures)`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runProposalQualityAdapterCli().catch((error) => {
    console.error(
      "[proposal-quality-adapter] failed",
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    process.exit(1);
  });
}
