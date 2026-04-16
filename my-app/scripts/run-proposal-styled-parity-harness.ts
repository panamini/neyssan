import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";

import type {
  CapturedDocumentExport,
  ProposalStyledExportClickContext,
} from "../src/lib/document-export-debug";
import type { ProposalFontDebugSnapshot } from "../src/lib/proposal-font-debug";
import { readPrimaryFontFamilyToken } from "../src/lib/resume-font-debug";

type CliArgs = {
  proposalId: string | null;
  proposalUrl: string | null;
  viewedPdfPath: string | null;
  artifactDir: string;
};

type AuditTarget =
  | {
      kind: "live-proposal";
      proposalUrl: string;
      sourceLabel: string;
      seedOutputDraft: null;
    }
  | {
      kind: "local-compose-fixture";
      proposalUrl: string;
      sourceLabel: string;
      seedOutputDraft: Record<string, unknown>;
    };

type DiffStats = {
  changedPixelCount: number;
  changedPixelRatio: number;
  meanChannelDelta: number;
  width: number;
  height: number;
  visiblyDifferent: boolean;
  diffImagePath: string;
  diffJsonPath: string;
};

type PrintWorkerBootstrap = {
  printRoutePayload: Record<string, unknown>;
  debugSnapshot: Record<string, unknown>;
};

type ProposalParitySummary = {
  appUrl: string;
  parserUrl: string;
  proposalUrl: string;
  auditTargetKind: AuditTarget["kind"];
  auditTargetSource: string;
  artifactDir: string;
  requestBodyPath: string;
  previewSnapshot: ProposalFontDebugSnapshot;
  printRouteSnapshot: ProposalFontDebugSnapshot;
  workerBootstrapPath: string;
  returnedPdfPath: string;
  returnedPdfSha256: string;
  returnedPdfBytes: number;
  pdfRasterSnapshot: {
    pageCount: number;
    width: number;
    height: number;
    label?: string;
    expectedTypography?: string;
  };
  previewComputesExpectedFonts: boolean;
  printComputesSameFontsAsPreview: boolean;
  previewVsPrintDiff: DiffStats;
  printVsRasterDiff: DiffStats;
  previewVsRasterDiff: DiffStats;
  firstDivergenceBoundary: string;
  returnedPdfDeclaredFontFamilies: string[];
  viewedPdfVerification: {
    providedPath: string;
    resolvedPath: string;
    exists: boolean;
    pathMatchesCapturedArtifact: boolean;
    sha256: string | null;
    sha256MatchesCapturedArtifact: boolean;
    error?: string;
  } | null;
};

const APP_URL = (process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:5173").replace(
  /\/+$/,
  "",
);
const PARSER_URL = (
  process.env.PROPOSAL_FONT_PARITY_PARSER_URL ??
  process.env.VITE_PARSER_URL ??
  "http://127.0.0.1:8001"
).replace(/\/+$/, "");
const VIEWPORT = { width: 1600, height: 1400 };
const DIFF_THRESHOLDS = {
  changedPixelCount: 2500,
  changedPixelRatio: 0.002,
  meanChannelDelta: 8,
};
function repoRootFromScript(): string {
  return path.resolve(import.meta.dirname, "../..");
}

function defaultArtifactDir(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(
    repoRootFromScript(),
    "tmp",
    "proposal-styled-parity",
    timestamp,
  );
}

function normalizeArtifactDirRelative(artifactDir: string): string {
  return path
    .relative(repoRootFromScript(), artifactDir)
    .split(path.sep)
    .join("/");
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let proposalId: string | null = null;
  let proposalUrl: string | null = null;
  let viewedPdfPath: string | null = null;
  let artifactDir: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case "--proposal-id":
        proposalId = next ?? null;
        index += 1;
        break;
      case "--proposal-url":
        proposalUrl = next ?? null;
        index += 1;
        break;
      case "--viewed-pdf":
        viewedPdfPath = next ?? null;
        index += 1;
        break;
      case "--artifact-dir":
        artifactDir = next ?? null;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    proposalId,
    proposalUrl,
    viewedPdfPath,
    artifactDir: artifactDir ? path.resolve(artifactDir) : defaultArtifactDir(),
  };
}

function buildFixtureOutputDraft(): Record<string, unknown> {
  return {
    proposalContent:
      "Dear Hiring Manager,\n\nI lead proposal delivery across product, legal, and operations teams, and I keep the final document coherent through review, approval, and handoff.\n\nI translate stakeholder input into concise document structure, align reviewers quickly, and preserve decision clarity without losing voice.\n\nKind regards,\nAlex Martin",
    proposalType: "cover_letter",
    proposalVoicePreset: "signature",
    proposalTemplateId: "two_column_rail",
    proposalVerbatiStyle: {
      layout: "two-column",
      typography: "mono-signal",
      palette: "graphite",
    },
    proposalStyleLinkMode: "proposal_local",
    proposalStyleChoice: "balanced",
    proposalApplicantName: "Alex Martin",
    proposalApplicantRole: "Operations Lead",
    proposalContactLine: "alex@example.com · +33 6 00 00 00 00",
    proposalLetterDate: "Paris, April 16, 2026",
    proposalRecipientDetails: "Hiring Manager\nStudio North",
    proposalHeaderShowSender: true,
    proposalHeaderShowDate: true,
    proposalHeaderShowSubject: true,
    proposalHeaderShowRecipient: true,
    proposalHeaderShowRecipientDetails: true,
    proposalDocumentTitle: "Proposal parity fixture",
    proposalDocumentMeta: "alex@example.com",
    generatedProposalId: "proposal_fixture_live",
    proposalOutputMode: "preview",
    paletteOverride: null,
    customAccentHex: null,
    templateBundleId: null,
    typographyOverride: null,
    layoutOverride: null,
    proposalDocumentTitleManual: true,
    characterLimitMode: "none",
    characterLimitValue: null,
  };
}

function resolveAuditTarget(cliArgs: CliArgs): AuditTarget {
  if (cliArgs.proposalUrl || cliArgs.proposalId) {
    return {
      kind: "live-proposal",
      proposalUrl:
        cliArgs.proposalUrl ??
        `${APP_URL}/proposal?id=${encodeURIComponent(String(cliArgs.proposalId))}`,
      sourceLabel: cliArgs.proposalUrl ?? String(cliArgs.proposalId),
      seedOutputDraft: null,
    };
  }

  return {
    kind: "local-compose-fixture",
    proposalUrl: `${APP_URL}/proposal`,
    sourceLabel: "proposal_output_draft_fixture",
    seedOutputDraft: buildFixtureOutputDraft(),
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureHarnessTargetsReachable(): Promise<void> {
  const appResponse = await fetch(`${APP_URL}/proposal`, { redirect: "manual" });
  if (!appResponse.ok && appResponse.status !== 302) {
    throw new Error(
      `App route is not reachable at ${APP_URL}/proposal (${appResponse.status}).`,
    );
  }

  const parserResponse = await fetch(`${PARSER_URL}/ready`);
  if (!parserResponse.ok) {
    throw new Error(
      `Parser ready check failed at ${PARSER_URL}/ready (${parserResponse.status}).`,
    );
  }
}

async function waitForGlobal<T>(
  page: Page,
  expression: string,
  timeoutMs = 30_000,
): Promise<T> {
  await page.waitForFunction(expression, undefined, { timeout: timeoutMs });
  return page.evaluate(expression) as Promise<T>;
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function waitForFile(filePath: string, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      await fs.access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}

function previewComputesExpectedFonts(snapshot: ProposalFontDebugSnapshot): boolean {
  return (
    readPrimaryFontFamilyToken(snapshot.titleFontFamilyComputed) ===
      readPrimaryFontFamilyToken(snapshot.expectedHeadingFontFamily) &&
    readPrimaryFontFamilyToken(snapshot.bodyFontFamilyComputed) ===
      readPrimaryFontFamilyToken(snapshot.expectedBodyFontFamily) &&
    readPrimaryFontFamilyToken(snapshot.contactFontFamilyComputed) ===
      readPrimaryFontFamilyToken(snapshot.expectedBodyFontFamily)
  );
}

function printComputesSameFontsAsPreview(
  previewSnapshot: ProposalFontDebugSnapshot,
  printSnapshot: ProposalFontDebugSnapshot,
): boolean {
  return (
    printSnapshot.templateId === previewSnapshot.templateId &&
    printSnapshot.typography === previewSnapshot.typography &&
    readPrimaryFontFamilyToken(printSnapshot.titleFontFamilyComputed) ===
      readPrimaryFontFamilyToken(previewSnapshot.titleFontFamilyComputed) &&
    readPrimaryFontFamilyToken(printSnapshot.bodyFontFamilyComputed) ===
      readPrimaryFontFamilyToken(previewSnapshot.bodyFontFamilyComputed) &&
    readPrimaryFontFamilyToken(printSnapshot.contactFontFamilyComputed) ===
      readPrimaryFontFamilyToken(previewSnapshot.contactFontFamilyComputed)
  );
}

function readPdfDeclaredFontFamilies(pdfBuffer: Buffer): string[] {
  const content = pdfBuffer.toString("latin1");
  const matches = Array.from(content.matchAll(/\/FontFamily \(([^)]+)\)/g));
  return Array.from(
    new Set(matches.map((match) => String(match[1] ?? "").trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function determineFirstDivergenceBoundary(args: {
  previewMatchesExpected: boolean;
  printMatchesPreview: boolean;
  previewVsPrintVisiblyDifferent: boolean;
  printVsRasterVisiblyDifferent: boolean;
}): string {
  if (!args.previewMatchesExpected) {
    return "preview-font-resolution";
  }

  if (!args.printMatchesPreview) {
    return "preview-to-print-font-resolution";
  }

  if (args.previewVsPrintVisiblyDifferent) {
    return "preview-to-print-surface-wrapper";
  }

  if (args.printVsRasterVisiblyDifferent) {
    return "print-to-pdf";
  }

  return "no-divergence-detected";
}

async function verifyProvidedViewedPdf(args: {
  viewedPdfPath: string | null;
  returnedPdfPath: string;
  returnedPdfSha256: string;
}) {
  if (!args.viewedPdfPath) {
    return null;
  }

  const resolvedPath = path.resolve(args.viewedPdfPath);
  const pathMatchesCapturedArtifact = resolvedPath === path.resolve(args.returnedPdfPath);

  try {
    const providedBuffer = await fs.readFile(resolvedPath);
    const providedSha256 = sha256Hex(providedBuffer);
    return {
      providedPath: args.viewedPdfPath,
      resolvedPath,
      exists: true,
      pathMatchesCapturedArtifact,
      sha256: providedSha256,
      sha256MatchesCapturedArtifact: providedSha256 === args.returnedPdfSha256,
    };
  } catch (error) {
    return {
      providedPath: args.viewedPdfPath,
      resolvedPath,
      exists: false,
      pathMatchesCapturedArtifact,
      sha256: null,
      sha256MatchesCapturedArtifact: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function captureLiveStyledProposalExport(args: {
  browser: Browser;
  proposalUrl: string;
  artifactDir: string;
  seedOutputDraft: Record<string, unknown> | null;
}): Promise<{
  exportCapture: CapturedDocumentExport;
  previewSnapshot: ProposalFontDebugSnapshot;
  previewImagePath: string;
  returnedPdfPath: string;
  returnedPdfSha256: string;
  returnedPdfBytes: number;
}> {
  const context = await args.browser.newContext({
    viewport: VIEWPORT,
    acceptDownloads: false,
  });
  const artifactDirRelative = normalizeArtifactDirRelative(args.artifactDir);
  const previewImagePath = path.join(args.artifactDir, "preview.png");
  const returnedPdfPath = path.join(args.artifactDir, "returned-export.pdf");

  try {
    await context.addInitScript(({ auditArtifactDirRelative, seedOutputDraft }) => {
      window.localStorage.removeItem("dasti:proposal-saved-fixtures:v1");
      window.sessionStorage.removeItem("dasti:proposal-output-draft:session:v1");
      if (seedOutputDraft) {
        window.localStorage.setItem(
          "dasti:proposal-output-draft:v1",
          JSON.stringify(seedOutputDraft),
        );
      } else {
        window.localStorage.removeItem("dasti:proposal-output-draft:v1");
      }
      (window as typeof window & {
        __DASTI_DOCUMENT_EXPORT_DEBUG__?: {
          enabled: boolean;
          artifactDirRelative: string;
        };
      }).__DASTI_DOCUMENT_EXPORT_DEBUG__ = {
        enabled: true,
        artifactDirRelative: auditArtifactDirRelative,
      };

      HTMLAnchorElement.prototype.click = function patchedClick() {
        // Preserve the actual fetch/export flow but skip the browser download UI.
      };
    }, {
      auditArtifactDirRelative: artifactDirRelative,
      seedOutputDraft: args.seedOutputDraft,
    });

    const page = await context.newPage();
    await page.goto(args.proposalUrl, { waitUntil: "domcontentloaded" });

    const previewCapture = await waitForGlobal<{
      snapshot: ProposalFontDebugSnapshot;
    }>(
      page,
      `(() => {
        const capture = window.__DASTI_PROPOSAL_PREVIEW_CAPTURE__;
        return capture?.snapshot ? capture : false;
      })()`,
    ).catch(async (error) => {
      const diagnostics = await page.evaluate(() => ({
        href: window.location.href,
        title: document.title,
        hasPreviewCapture: Boolean(window.__DASTI_PROPOSAL_PREVIEW_CAPTURE__),
        hasExportDebug: Boolean(window.__DASTI_DOCUMENT_EXPORT_DEBUG__),
        proposalDocumentCount: document.querySelectorAll(".dasti-proposal-document").length,
        buttons: Array.from(document.querySelectorAll("button"))
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .slice(0, 20),
        bodyText: document.body.innerText.slice(0, 2000),
      }));
      await writeJson(
        path.join(args.artifactDir, "preview-capture-timeout.json"),
        diagnostics,
      );
      throw new Error(
        `Proposal preview debug capture did not appear before timeout. diagnostics=${JSON.stringify(diagnostics)} cause=${error instanceof Error ? error.message : String(error)}`,
      );
    });

    await page
      .locator(".dasti-proposal-document")
      .first()
      .screenshot({ path: previewImagePath });

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/document-export/proposal/pdf"),
      { timeout: 120_000 },
    );

    await page.getByRole("button", { name: "Export Styled PDF" }).click();

    const exportResponse = await exportResponsePromise.catch(async (error) => {
      const exportDiagnostic = await page.evaluate(() => ({
        href: window.location.href,
        selectedProposalId: new URLSearchParams(window.location.search).get("id") ?? null,
        bodyText: document.body.innerText,
      }));
      throw new Error(
        `The Export Styled PDF click did not produce a proposal PDF network response within the timeout window. url=${exportDiagnostic.href} selectedProposalId=${exportDiagnostic.selectedProposalId ?? "none"} cause=${error instanceof Error ? error.message : String(error)}`,
      );
    });
    const requestBody = exportResponse.request().postDataJSON() as Record<
      string,
      unknown
    > | null;
    if (!requestBody) {
      throw new Error("Styled proposal export request did not include a JSON body.");
    }

    const responseHeaders = await exportResponse.allHeaders();
    const responseBody = await exportResponse.body();
    if (!exportResponse.ok()) {
      throw new Error(
        `Styled proposal export failed with status ${exportResponse.status()}: ${Buffer.from(responseBody).toString("utf8")}`,
      );
    }
    if (!String(responseHeaders["content-type"] ?? "").includes("application/pdf")) {
      throw new Error(
        `Styled proposal export response was not a PDF. content-type=${responseHeaders["content-type"] ?? "unknown"}`,
      );
    }

    const clickContext = await page.evaluate<ProposalStyledExportClickContext | null>(
      `window.__DASTI_STYLED_PROPOSAL_EXPORT_CONTEXT__ ?? null`,
    );
    const clientCapture = await waitForGlobal<CapturedDocumentExport | null>(
      page,
      `window.__DASTI_LAST_DOCUMENT_EXPORT__ ?? null`,
      15_000,
    ).catch(() => null);
    const pdfBuffer =
      responseBody.byteLength > 0
        ? Buffer.from(responseBody)
        : clientCapture?.response?.bytesBase64
          ? Buffer.from(clientCapture.response.bytesBase64, "base64")
          : Buffer.alloc(0);

    const exportCapture: CapturedDocumentExport = clientCapture ?? {
      requestBody,
      response: {
        responseStatus: exportResponse.status(),
        responseOk: exportResponse.ok(),
        contentType: responseHeaders["content-type"] ?? null,
        contentDisposition: responseHeaders["content-disposition"] ?? null,
        filename:
          responseHeaders["content-disposition"]?.match(/filename="?([^"]+)"?/i)?.[1] ??
          null,
        byteLength: pdfBuffer.byteLength,
        bytesBase64: pdfBuffer.toString("base64"),
      },
      clickContext,
      timestamp: Date.now(),
    } satisfies {
      requestBody: Record<string, unknown>;
      response: CapturedDocumentExport["response"];
      clickContext: ProposalStyledExportClickContext | null;
      timestamp: number;
    };

    if (!pdfBuffer.byteLength) {
      throw new Error("Styled proposal export response body was empty.");
    }

    await writeJson(path.join(args.artifactDir, "ui-export-request.json"), requestBody);
    await writeJson(path.join(args.artifactDir, "preview.json"), previewCapture.snapshot);
    await fs.writeFile(returnedPdfPath, pdfBuffer);

    return {
      exportCapture,
      previewSnapshot: previewCapture.snapshot,
      previewImagePath,
      returnedPdfPath,
      returnedPdfSha256: sha256Hex(Buffer.from(pdfBuffer)),
      returnedPdfBytes: pdfBuffer.byteLength,
    };
  } finally {
    await context.close();
  }
}

async function capturePdfRasterSurface(
  browser: Browser,
  pdfBuffer: Buffer,
  artifactDir: string,
) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const imagePath = path.join(artifactDir, "pdf-raster-page-1.png");
  const snapshotPath = path.join(artifactDir, "pdf-raster-page-1.json");

  try {
    await context.addInitScript((payload) => {
      (window as typeof window & {
        __DASTI_PDF_RASTER_PAYLOAD__?: unknown;
      }).__DASTI_PDF_RASTER_PAYLOAD__ = payload;
    }, {
      pdfBase64: pdfBuffer.toString("base64"),
      label: "returned-export",
    });

    const page = await context.newPage();
    await page.goto(`${APP_URL}/debug/pdf-raster`, {
      waitUntil: "domcontentloaded",
    });

    const status = await waitForGlobal<{
      status: string;
      error?: string;
      snapshot?: ProposalParitySummary["pdfRasterSnapshot"];
    }>(
      page,
      `(() => {
        const status = window.__DASTI_PDF_RASTER_STATUS__;
        return status?.status === "ready" || status?.status === "error"
          ? status
          : false;
      })()`,
    );

    if (status.status === "error" || !status.snapshot) {
      throw new Error(`PDF raster route failed: ${status.error ?? "unknown error"}`);
    }

    await page.locator('[data-pdf-raster-canvas="page-1"]').screenshot({
      path: imagePath,
    });
    await writeJson(snapshotPath, status.snapshot);

    return {
      imagePath,
      snapshotPath,
      snapshot: status.snapshot,
    };
  } finally {
    await context.close();
  }
}

async function compareImages(
  imagePathA: string,
  imagePathB: string,
  diffImagePath: string,
  diffJsonPath: string,
): Promise<DiffStats> {
  const firstMeta = await sharp(imagePathA).metadata();
  const secondMeta = await sharp(imagePathB).metadata();
  const width = Math.max(firstMeta.width ?? 0, secondMeta.width ?? 0);
  const height = Math.max(firstMeta.height ?? 0, secondMeta.height ?? 0);

  if (!width || !height) {
    throw new Error("Unable to resolve image dimensions for diff.");
  }

  const normalizedA = await sharp(imagePathA)
    .flatten({ background: "#ffffff" })
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const normalizedB = await sharp(imagePathB)
    .flatten({ background: "#ffffff" })
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const diffPixels = Buffer.alloc(width * height * 4);
  let changedPixelCount = 0;
  let totalChannelDelta = 0;

  for (let index = 0; index < normalizedA.length; index += 4) {
    const redDelta = Math.abs(normalizedA[index]! - normalizedB[index]!);
    const greenDelta = Math.abs(normalizedA[index + 1]! - normalizedB[index + 1]!);
    const blueDelta = Math.abs(normalizedA[index + 2]! - normalizedB[index + 2]!);
    const alphaDelta = Math.abs(normalizedA[index + 3]! - normalizedB[index + 3]!);
    const channelDelta = redDelta + greenDelta + blueDelta + alphaDelta;

    totalChannelDelta += channelDelta;

    if (channelDelta > 32) {
      changedPixelCount += 1;
      diffPixels[index] = 255;
      diffPixels[index + 1] = 64;
      diffPixels[index + 2] = 64;
      diffPixels[index + 3] = 255;
    } else {
      diffPixels[index] = normalizedA[index]!;
      diffPixels[index + 1] = normalizedA[index + 1]!;
      diffPixels[index + 2] = normalizedA[index + 2]!;
      diffPixels[index + 3] = 255;
    }
  }

  await sharp(diffPixels, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(diffImagePath);

  const changedPixelRatio = changedPixelCount / (width * height);
  const meanChannelDelta = totalChannelDelta / Math.max(normalizedA.length, 1);
  const stats: DiffStats = {
    changedPixelCount,
    changedPixelRatio,
    meanChannelDelta,
    width,
    height,
    visiblyDifferent:
      changedPixelCount >= DIFF_THRESHOLDS.changedPixelCount &&
      changedPixelRatio >= DIFF_THRESHOLDS.changedPixelRatio &&
      meanChannelDelta >= DIFF_THRESHOLDS.meanChannelDelta,
    diffImagePath,
    diffJsonPath,
  };
  await writeJson(diffJsonPath, stats);
  return stats;
}

function buildAuditReport(summary: ProposalParitySummary): string {
  return `# Executive summary

- Proposal URL: \`${summary.proposalUrl}\`
- Audit target: \`${summary.auditTargetKind}\` (\`${summary.auditTargetSource}\`)
- Artifact dir: \`${summary.artifactDir}\`
- Preview computes expected fonts: **${summary.previewComputesExpectedFonts ? "yes" : "no"}**
- /print/proposal computes same fonts as preview: **${summary.printComputesSameFontsAsPreview ? "yes" : "no"}**
- Preview vs pre-PDF print screenshot visibly different: **${summary.previewVsPrintDiff.visiblyDifferent ? "yes" : "no"}**
- Pre-PDF print screenshot vs rasterized PDF visibly different: **${summary.printVsRasterDiff.visiblyDifferent ? "yes" : "no"}**

# Live preview vs styled PDF audit

- Request body: \`${summary.requestBodyPath}\`
- Worker bootstrap: \`${summary.workerBootstrapPath}\`
- Returned export PDF: \`${summary.returnedPdfPath}\`
- Returned export SHA-256: \`${summary.returnedPdfSha256}\`
- Returned export declared font families: \`${summary.returnedPdfDeclaredFontFamilies.join(", ") || "none"}\`
- Preview title/body/contact computed: \`${summary.previewSnapshot.titleFontFamilyComputed}\` / \`${summary.previewSnapshot.bodyFontFamilyComputed}\` / \`${summary.previewSnapshot.contactFontFamilyComputed}\`
- Print title/body/contact computed: \`${summary.printRouteSnapshot.titleFontFamilyComputed}\` / \`${summary.printRouteSnapshot.bodyFontFamilyComputed}\` / \`${summary.printRouteSnapshot.contactFontFamilyComputed}\`

# First divergence boundary

\`${summary.firstDivergenceBoundary}\`

# Exact root cause

- Derived from the same-export artifact chain above.

# Minimal fix

- Styled proposal PDF must render through the same preview-driven print route and the same resolved template/style state used by \`ProposalDisplay\`.

# Files changed

- \`my-app/src/pages/ProposalForge.tsx\`
- \`my-app/src/components/ProposalDisplay.tsx\`
- \`my-app/src/pages/ProposalPrintPage.tsx\`
- \`my-app/src/App.tsx\`
- \`my-app/src/lib/document-export-models.ts\`
- \`my-app/src/lib/document-export-debug.ts\`
- \`my-app/src/lib/proposal-font-debug.ts\`
- \`my-app/src/lib/exportDocumentFile.ts\`
- \`my-app/scripts/document-export-worker.ts\`
- \`my-app/scripts/run-proposal-styled-parity-harness.ts\`

# Tests / verification

- preview -> export request -> worker bootstrap -> print snapshot -> raster comparison completed from live artifacts
- returned PDF sha256: \`${summary.returnedPdfSha256}\`
- preview vs print diff: changed=${summary.previewVsPrintDiff.changedPixelCount}, ratio=${summary.previewVsPrintDiff.changedPixelRatio.toFixed(6)}, mean=${summary.previewVsPrintDiff.meanChannelDelta.toFixed(3)}
- print vs raster diff: changed=${summary.printVsRasterDiff.changedPixelCount}, ratio=${summary.printVsRasterDiff.changedPixelRatio.toFixed(6)}, mean=${summary.printVsRasterDiff.meanChannelDelta.toFixed(3)}
- preview vs raster diff: changed=${summary.previewVsRasterDiff.changedPixelCount}, ratio=${summary.previewVsRasterDiff.changedPixelRatio.toFixed(6)}, mean=${summary.previewVsRasterDiff.meanChannelDelta.toFixed(3)}

# Developer debug note

- If a viewed PDF was supplied: ${summary.viewedPdfVerification ? `path match=${summary.viewedPdfVerification.pathMatchesCapturedArtifact}, sha match=${summary.viewedPdfVerification.sha256MatchesCapturedArtifact}` : "no viewed PDF supplied"}
`;
}

async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const auditTarget = resolveAuditTarget(cliArgs);
  await fs.mkdir(cliArgs.artifactDir, { recursive: true });
  await ensureHarnessTargetsReachable();

  const browser = await chromium.launch({ headless: true });

  try {
    const {
      exportCapture,
      previewSnapshot,
      previewImagePath,
      returnedPdfPath,
      returnedPdfSha256,
      returnedPdfBytes,
    } = await captureLiveStyledProposalExport({
      browser,
      proposalUrl: auditTarget.proposalUrl,
      artifactDir: cliArgs.artifactDir,
      seedOutputDraft: auditTarget.seedOutputDraft,
    });

    const workerBootstrapPath = path.join(cliArgs.artifactDir, "worker-bootstrap.json");
    const printRoutePath = path.join(cliArgs.artifactDir, "print-route.json");
    const printRouteImagePath = path.join(cliArgs.artifactDir, "print-route-pre-pdf.png");
    await waitForFile(workerBootstrapPath);
    await waitForFile(printRoutePath);
    await waitForFile(printRouteImagePath);

    const workerBootstrap = JSON.parse(
      await fs.readFile(workerBootstrapPath, "utf8"),
    ) as PrintWorkerBootstrap;
    const printRouteSnapshot = JSON.parse(
      await fs.readFile(printRoutePath, "utf8"),
    ) as ProposalFontDebugSnapshot;

    const pdfBuffer = await fs.readFile(returnedPdfPath);
    const pdfRaster = await capturePdfRasterSurface(
      browser,
      pdfBuffer,
      cliArgs.artifactDir,
    );

    const previewVsPrintDiff = await compareImages(
      previewImagePath,
      printRouteImagePath,
      path.join(cliArgs.artifactDir, "diff-preview-vs-print.png"),
      path.join(cliArgs.artifactDir, "diff-preview-vs-print.json"),
    );
    const printVsRasterDiff = await compareImages(
      printRouteImagePath,
      pdfRaster.imagePath,
      path.join(cliArgs.artifactDir, "diff-print-vs-raster.png"),
      path.join(cliArgs.artifactDir, "diff-print-vs-raster.json"),
    );
    const previewVsRasterDiff = await compareImages(
      previewImagePath,
      pdfRaster.imagePath,
      path.join(cliArgs.artifactDir, "diff-preview-vs-raster.png"),
      path.join(cliArgs.artifactDir, "diff-preview-vs-raster.json"),
    );

    const viewedPdfVerification = await verifyProvidedViewedPdf({
      viewedPdfPath: cliArgs.viewedPdfPath,
      returnedPdfPath,
      returnedPdfSha256,
    });
    const firstDivergenceBoundary = determineFirstDivergenceBoundary({
      previewMatchesExpected: previewComputesExpectedFonts(previewSnapshot),
      printMatchesPreview: printComputesSameFontsAsPreview(
        previewSnapshot,
        printRouteSnapshot,
      ),
      previewVsPrintVisiblyDifferent: previewVsPrintDiff.visiblyDifferent,
      printVsRasterVisiblyDifferent: printVsRasterDiff.visiblyDifferent,
    });

    const summary: ProposalParitySummary = {
      appUrl: APP_URL,
      parserUrl: PARSER_URL,
      proposalUrl: auditTarget.proposalUrl,
      auditTargetKind: auditTarget.kind,
      auditTargetSource: auditTarget.sourceLabel,
      artifactDir: cliArgs.artifactDir,
      requestBodyPath: path.join(cliArgs.artifactDir, "ui-export-request.json"),
      previewSnapshot,
      printRouteSnapshot,
      workerBootstrapPath,
      returnedPdfPath,
      returnedPdfSha256,
      returnedPdfBytes,
      pdfRasterSnapshot: pdfRaster.snapshot,
      previewComputesExpectedFonts: previewComputesExpectedFonts(previewSnapshot),
      printComputesSameFontsAsPreview: printComputesSameFontsAsPreview(
        previewSnapshot,
        printRouteSnapshot,
      ),
      previewVsPrintDiff,
      printVsRasterDiff,
      previewVsRasterDiff,
      firstDivergenceBoundary,
      returnedPdfDeclaredFontFamilies: readPdfDeclaredFontFamilies(pdfBuffer),
      viewedPdfVerification,
    };

    await writeJson(path.join(cliArgs.artifactDir, "summary.json"), {
      summary,
      exportCapture,
      workerBootstrap,
    });

    const auditReportPath = path.join(
      repoRootFromScript(),
      "docs",
      "audits",
      `${new Date().toISOString().slice(0, 10)}-proposal-styled-parity-audit.md`,
    );
    await fs.mkdir(path.dirname(auditReportPath), { recursive: true });
    await fs.writeFile(auditReportPath, buildAuditReport(summary), "utf8");

    console.log(
      JSON.stringify(
        {
          artifactDir: cliArgs.artifactDir,
          auditReportPath,
          firstDivergenceBoundary,
          returnedPdfSha256,
          previewComputesExpectedFonts: summary.previewComputesExpectedFonts,
          printComputesSameFontsAsPreview: summary.printComputesSameFontsAsPreview,
          previewVsPrintVisiblyDifferent: previewVsPrintDiff.visiblyDifferent,
          printVsRasterVisiblyDifferent: printVsRasterDiff.visiblyDifferent,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

void main().catch((error) => {
  console.error("[proposal-styled-parity-harness] failed", error);
  process.exit(1);
});
