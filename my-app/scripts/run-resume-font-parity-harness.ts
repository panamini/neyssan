import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";

import { canonicalizeParserResult } from "../convex/lib/parsing/canonicalize";
import {
  DEFAULT_VERBATI_STYLE,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
} from "../src/features/verbati/style";
import type {
  CapturedDocumentExport,
  ResumeStyledExportClickContext,
} from "../src/lib/document-export-debug";
import { LOCAL_CV_LIBRARY_STORAGE_KEY, getLocalCvDocumentStorageKey } from "../src/lib/cv-local-storage";
import { normalizeAndValidateCvDocument } from "../src/lib/normalize-cv";
import {
  readPrimaryFontFamilyToken,
  type ResumeFontDebugSnapshot,
} from "../src/lib/resume-font-debug";
import type { CvDocument, CvSection } from "../src/types/cvDocument";
import { buildTypedSectionsFromNormalized } from "../src/utils/cv/mapping-utils";

type CliArgs = {
  cvId: string | null;
  cvUrl: string | null;
  fixtureName: string | null;
  viewedPdfPath: string | null;
  artifactDir: string;
};

type AuditTarget =
  | {
      kind: "live-cv";
      cvUrl: string;
      sourceLabel: string;
      seedDocument: null;
      fixturePath: null;
    }
  | {
      kind: "repo-fixture";
      cvUrl: string;
      sourceLabel: string;
      seedDocument: CvDocument;
      fixturePath: string;
    };

type PrintWorkerBootstrap = {
  printRoutePayload: Record<string, unknown>;
  debugSnapshot: Record<string, unknown>;
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

type ProvidedPdfVerification = {
  providedPath: string;
  resolvedPath: string;
  exists: boolean;
  pathMatchesCapturedArtifact: boolean;
  sha256: string | null;
  sha256MatchesCapturedArtifact: boolean;
  error?: string;
};

type AuditSummary = {
  appUrl: string;
  parserUrl: string;
  cvUrl: string;
  auditTargetKind: AuditTarget["kind"];
  auditTargetSource: string;
  auditFixturePath: string | null;
  artifactDir: string;
  requestBodyPath: string;
  previewSnapshot: ResumeFontDebugSnapshot;
  printRouteSnapshot: ResumeFontDebugSnapshot;
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
  previewLikelyUsesPrimaryFonts: boolean;
  printLikelyUsesSamePrimaryFontsAsPreview: boolean;
  previewVsPrintDiff: DiffStats;
  printVsRasterDiff: DiffStats;
  previewVsRasterDiff: DiffStats;
  firstDivergenceBoundary: string;
  returnedPdfDeclaredFontFamilies: string[];
  viewedPdfVerification: ProvidedPdfVerification | null;
};

const APP_URL = (process.env.PLAYWRIGHT_APP_URL ?? "http://127.0.0.1:5173").replace(
  /\/+$/,
  "",
);
const PARSER_URL = (
  process.env.RESUME_FONT_PARITY_PARSER_URL ??
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
    "resume-font-parity",
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
  let cvId: string | null = null;
  let cvUrl: string | null = null;
  let fixtureName: string | null = null;
  let viewedPdfPath: string | null = null;
  let artifactDir: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case "--cv-id":
        cvId = next ?? null;
        index += 1;
        break;
      case "--cv-url":
        cvUrl = next ?? null;
        index += 1;
        break;
      case "--fixture-name":
        fixtureName = next ?? null;
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
    cvId,
    cvUrl,
    fixtureName,
    viewedPdfPath,
    artifactDir: artifactDir
      ? path.resolve(artifactDir)
      : defaultArtifactDir(),
  };
}

function resolveCvUrl(cliArgs: Pick<CliArgs, "cvId" | "cvUrl">): string {
  if (cliArgs.cvUrl) {
    return cliArgs.cvUrl;
  }

  return `${APP_URL}/cv?id=${encodeURIComponent(String(cliArgs.cvId))}`;
}

function humanizeFixtureName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function looksLikeInvalidFixtureName(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) {
    return true;
  }

  return /^(profile|employment history|experience|education|skills|languages|achievements)$/i.test(
    text,
  );
}

function buildPreferredFixtureCandidates(
  requestedFixtureName: string | null,
): string[] {
  const requested = requestedFixtureName?.trim();
  return [
    requested ? `${requested}.json` : null,
    requested,
    "robert_cooper.json",
    "anne.json",
    "jessica.json",
  ].filter((value): value is string => Boolean(value));
}

function ensureFixtureProfileIdentity(
  sections: CvSection[],
  fallbackName: string,
): CvSection[] {
  const profileSection = sections.find((section) => section.type === "profile");
  const firstExperience = sections
    .find((section) => section.type === "experience")
    ?.structuredContent?.[0] as
    | { position?: string; location?: string }
    | undefined;

  if (profileSection && Array.isArray(profileSection.structuredContent)) {
    const profileItem = (profileSection.structuredContent[0] ??
      {}) as Record<string, unknown>;
    profileSection.structuredContent = [
      {
        ...profileItem,
        id:
          typeof profileItem.id === "string"
            ? profileItem.id
            : `profile-item-${fallbackName.toLowerCase().replace(/\s+/g, "-")}`,
        name: looksLikeInvalidFixtureName(profileItem.name)
          ? fallbackName
          : profileItem.name,
        desiredPosition:
          typeof profileItem.desiredPosition === "string" &&
          profileItem.desiredPosition.trim()
            ? profileItem.desiredPosition
            : firstExperience?.position ?? "",
        location:
          typeof profileItem.location === "string" &&
          !/safety conscious|attentive/i.test(profileItem.location)
            ? profileItem.location
            : firstExperience?.location ?? "",
      },
    ];
    return sections;
  }

  return [
    {
      id: `profile-${fallbackName.toLowerCase().replace(/\s+/g, "-")}`,
      title: "Profile",
      type: "profile",
      blocks: [],
      structuredContent: [
        {
          id: `profile-item-${fallbackName.toLowerCase().replace(/\s+/g, "-")}`,
          name: fallbackName,
          desiredPosition: firstExperience?.position ?? "",
          location: firstExperience?.location ?? "",
        },
      ],
    },
    ...sections,
  ];
}

async function buildRepoFixtureAuditTarget(
  requestedFixtureName: string | null,
): Promise<AuditTarget> {
  const fixturesDir = path.join(
    repoRootFromScript(),
    "my-app",
    "convex",
    "lib",
    "parsing",
    "__tests__",
    "fixtures",
  );
  const availableFixtures = (await fs.readdir(fixturesDir))
    .filter((entry) => entry.endsWith(".json"))
    .sort();
  const preferredFixture = buildPreferredFixtureCandidates(requestedFixtureName).find(
    (candidate) => availableFixtures.includes(candidate),
  );
  const selectedFixture = preferredFixture ?? availableFixtures[0];

  if (!selectedFixture) {
    throw new Error(
      `No repo fixture CV was found under ${fixturesDir}. Pass --cv-id <id> or --cv-url <url>.`,
    );
  }

  const fixturePath = path.join(fixturesDir, selectedFixture);
  const rawFixture = JSON.parse(
    await fs.readFile(fixturePath, "utf8"),
  ) as Record<string, unknown>;
  const canonical = canonicalizeParserResult(rawFixture, {
    rawText: String((rawFixture.normalized as Record<string, unknown> | undefined)?.rawText ?? ""),
    mode: "text",
    parserUrl: "",
  } as never);
  const fallbackName = humanizeFixtureName(selectedFixture);
  const typedSections = ensureFixtureProfileIdentity(
    buildTypedSectionsFromNormalized((canonical.normalized ?? {}) as Record<string, unknown>),
    fallbackName,
  );
  const normalizedResult = normalizeAndValidateCvDocument(
    {
      id: `fixture-${selectedFixture.replace(/\.[^.]+$/, "")}`,
      title: fallbackName,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        locale: "en",
        verbatiStyle: serializeVerbatiStyle(
          resolveVerbatiStyle(DEFAULT_VERBATI_STYLE),
        ),
      },
      sections: typedSections,
    },
    fallbackName,
  );

  if (!normalizedResult.success) {
    throw new Error(
      `Unable to normalize fixture ${selectedFixture}: ${normalizedResult.errors.join("; ")}`,
    );
  }

  return {
    kind: "repo-fixture",
    cvUrl: `${APP_URL}/cv?id=${encodeURIComponent(normalizedResult.document.id)}`,
    sourceLabel: fallbackName,
    seedDocument: normalizedResult.document,
    fixturePath,
  };
}

async function resolveAuditTarget(cliArgs: CliArgs): Promise<AuditTarget> {
  if (cliArgs.cvId || cliArgs.cvUrl) {
    return {
      kind: "live-cv",
      cvUrl: resolveCvUrl(cliArgs),
      sourceLabel: cliArgs.cvUrl ?? String(cliArgs.cvId),
      seedDocument: null,
      fixturePath: null,
    };
  }

  return buildRepoFixtureAuditTarget(cliArgs.fixtureName);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureHarnessTargetsReachable(): Promise<void> {
  const appResponse = await fetch(`${APP_URL}/cv`, { redirect: "manual" });
  if (!appResponse.ok && appResponse.status !== 302) {
    throw new Error(`App route is not reachable at ${APP_URL}/cv (${appResponse.status}).`);
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

async function captureLiveStyledResumeExport(args: {
  browser: Browser;
  cvUrl: string;
  artifactDir: string;
  seedDocument: CvDocument | null;
}): Promise<{
  exportCapture: CapturedDocumentExport;
  previewSnapshot: ResumeFontDebugSnapshot;
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
  const seededDocumentStorage = args.seedDocument
    ? {
        libraryKey: LOCAL_CV_LIBRARY_STORAGE_KEY,
        documentKey: getLocalCvDocumentStorageKey(args.seedDocument.id),
        activeCvKey: "cvActiveId",
        document: args.seedDocument,
      }
    : null;

  try {
    await context.addInitScript(({ auditArtifactDirRelative, seededDocumentStorage }) => {
      window.localStorage.setItem("dasti:cv-forge-workspace-mode:v1", "preview");
      if (seededDocumentStorage) {
        window.localStorage.setItem(
          seededDocumentStorage.libraryKey,
          JSON.stringify([seededDocumentStorage.document]),
        );
        window.localStorage.setItem(
          seededDocumentStorage.documentKey,
          JSON.stringify(seededDocumentStorage.document),
        );
        window.localStorage.setItem(
          seededDocumentStorage.activeCvKey,
          String(seededDocumentStorage.document.id),
        );
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
      seededDocumentStorage,
    });

    const page = await context.newPage();
    await page.goto(args.cvUrl, { waitUntil: "domcontentloaded" });

    const previewCapture = await waitForGlobal<{
      snapshot: ResumeFontDebugSnapshot;
    }>(
      page,
      `(() => {
        const capture = window.__DASTI_RESUME_PREVIEW_CAPTURE__;
        return capture?.snapshot ? capture : false;
      })()`,
    );

    await page
      .locator('[data-live-resume-preview="true"] .resume-page')
      .screenshot({ path: previewImagePath });

    const exportResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/v1/document-export/resume/pdf"),
      { timeout: 120_000 },
    );

    await page.getByRole("button", { name: "Export Styled PDF" }).click();

    const exportResponse = await exportResponsePromise.catch(async (error) => {
      const exportDiagnostic = await page.evaluate(() => ({
        href: window.location.href,
        activeCvId:
          window.localStorage.getItem("cvActiveId") ??
          window.localStorage.getItem("proposalAttachedCvId"),
        bodyText: document.body.innerText,
      }));
      const missingLiveDocument =
        !exportDiagnostic.activeCvId && !/[?&]id=/.test(exportDiagnostic.href);
      const diagnosticMessage = missingLiveDocument
        ? "No active CV was loaded in the fresh harness context; the page rendered a preview surface but the real styled export request never fired. Pass --cv-id <id>, a full /cv?id=... URL, or let the harness switch to a repo fixture CV."
        : "The Export Styled PDF click did not produce a resume PDF network response within the timeout window.";
      throw new Error(
        `${diagnosticMessage} url=${exportDiagnostic.href} activeCvId=${exportDiagnostic.activeCvId ?? "none"} cause=${error instanceof Error ? error.message : String(error)}`,
      );
    });
    const requestBody = exportResponse.request().postDataJSON() as Record<
      string,
      unknown
    > | null;
    if (!requestBody) {
      throw new Error("Styled export request did not include a JSON body.");
    }
    const responseHeaders = await exportResponse.allHeaders();
    const responseBody = await exportResponse.body();
    if (!exportResponse.ok()) {
      throw new Error(
        `Styled export request failed with status ${exportResponse.status()}: ${Buffer.from(responseBody).toString("utf8")}`,
      );
    }
    if (!String(responseHeaders["content-type"] ?? "").includes("application/pdf")) {
      throw new Error(
        `Styled export response was not a PDF. content-type=${responseHeaders["content-type"] ?? "unknown"}`,
      );
    }
    const clickContext = await page.evaluate<ResumeStyledExportClickContext | null>(
      `window.__DASTI_STYLED_RESUME_EXPORT_CONTEXT__ ?? null`,
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
    };

    if (!pdfBuffer.byteLength) {
      throw new Error("Styled export response body was empty.");
    }

    await writeJson(
      path.join(args.artifactDir, "ui-export-request.json"),
      requestBody,
    );
    await writeJson(
      path.join(args.artifactDir, "preview.json"),
      previewCapture.snapshot,
    );

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
): Promise<{
  imagePath: string;
  snapshotPath: string;
  snapshot: AuditSummary["pdfRasterSnapshot"];
}> {
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
      snapshot?: AuditSummary["pdfRasterSnapshot"];
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
      throw new Error(
        `PDF raster route failed: ${status.error ?? "unknown error"}`,
      );
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
    .resize(width, height, {
      fit: "contain",
      background: "#ffffff",
    })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const normalizedB = await sharp(imagePathB)
    .flatten({ background: "#ffffff" })
    .resize(width, height, {
      fit: "contain",
      background: "#ffffff",
    })
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
    raw: {
      width,
      height,
      channels: 4,
    },
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

function previewComputesExpectedFonts(snapshot: ResumeFontDebugSnapshot): boolean {
  return (
    readPrimaryFontFamilyToken(
      snapshot.headingFontFamilyComputed || snapshot.fontHeadingCssVar,
    ) === readPrimaryFontFamilyToken(snapshot.fontHeadingCssVar) &&
    readPrimaryFontFamilyToken(
      snapshot.bodyFontFamilyComputed || snapshot.fontBodyCssVar,
    ) === readPrimaryFontFamilyToken(snapshot.fontBodyCssVar) &&
    readPrimaryFontFamilyToken(
      snapshot.inheritedBodyFontFamilyComputed ||
        snapshot.surfaceFontFamilyComputed ||
        snapshot.fontBodyCssVar,
    ) === readPrimaryFontFamilyToken(snapshot.fontBodyCssVar)
  );
}

function snapshotMaterializesPrimaryFamily(
  snapshot: ResumeFontDebugSnapshot,
  kind: "heading" | "body",
): boolean {
  const primaryFamily = readPrimaryFontFamilyToken(
    kind === "heading" ? snapshot.fontHeadingCssVar : snapshot.fontBodyCssVar,
  );
  if (!primaryFamily) {
    return true;
  }

  const loadedFamilySet = new Set(snapshot.loadedFontFamilies);
  const styleTagIncludesPrimaryFamily =
    kind === "heading"
      ? snapshot.localFontFaceCssIncludesHeadingPrimaryFamily
      : snapshot.localFontFaceCssIncludesBodyPrimaryFamily;
  const likelyUsesPrimaryFamily =
    kind === "heading"
      ? snapshot.headingPrimaryFamilyLikely
      : snapshot.bodyPrimaryFamilyLikely;

  return (
    loadedFamilySet.has(primaryFamily) ||
    (snapshot.localFontFaceStylePresent && styleTagIncludesPrimaryFamily) ||
    likelyUsesPrimaryFamily === true
  );
}

function previewLikelyUsesPrimaryFonts(
  snapshot: ResumeFontDebugSnapshot,
): boolean {
  return (
    snapshotMaterializesPrimaryFamily(snapshot, "heading") &&
    snapshotMaterializesPrimaryFamily(snapshot, "body")
  );
}

function printComputesSameFontsAsPreview(
  previewSnapshot: ResumeFontDebugSnapshot,
  printSnapshot: ResumeFontDebugSnapshot,
): boolean {
  return (
    printSnapshot.typography === previewSnapshot.typography &&
    printSnapshot.rendererVariantId === previewSnapshot.rendererVariantId &&
    readPrimaryFontFamilyToken(
      printSnapshot.headingFontFamilyComputed || printSnapshot.fontHeadingCssVar,
    ) ===
      readPrimaryFontFamilyToken(
        previewSnapshot.headingFontFamilyComputed ||
          previewSnapshot.fontHeadingCssVar,
      ) &&
    readPrimaryFontFamilyToken(
      printSnapshot.bodyFontFamilyComputed || printSnapshot.fontBodyCssVar,
    ) ===
      readPrimaryFontFamilyToken(
        previewSnapshot.bodyFontFamilyComputed || previewSnapshot.fontBodyCssVar,
      ) &&
    readPrimaryFontFamilyToken(
      printSnapshot.inheritedBodyFontFamilyComputed ||
        printSnapshot.surfaceFontFamilyComputed ||
        printSnapshot.fontBodyCssVar,
    ) ===
      readPrimaryFontFamilyToken(
        previewSnapshot.inheritedBodyFontFamilyComputed ||
          previewSnapshot.surfaceFontFamilyComputed ||
          previewSnapshot.fontBodyCssVar,
      )
  );
}

function printLikelyUsesSamePrimaryFontsAsPreview(
  previewSnapshot: ResumeFontDebugSnapshot,
  printSnapshot: ResumeFontDebugSnapshot,
): boolean {
  return (
    previewLikelyUsesPrimaryFonts(previewSnapshot) &&
    snapshotMaterializesPrimaryFamily(printSnapshot, "heading") &&
    snapshotMaterializesPrimaryFamily(printSnapshot, "body") &&
    readPrimaryFontFamilyToken(printSnapshot.fontHeadingCssVar) ===
      readPrimaryFontFamilyToken(previewSnapshot.fontHeadingCssVar) &&
    readPrimaryFontFamilyToken(printSnapshot.fontBodyCssVar) ===
      readPrimaryFontFamilyToken(previewSnapshot.fontBodyCssVar)
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
  previewUsesPrimaryFonts: boolean;
  printUsesSamePrimaryFonts: boolean;
  previewVsPrintVisiblyDifferent: boolean;
  printVsRasterVisiblyDifferent: boolean;
}): string {
  if (!args.previewMatchesExpected) {
    return "preview-font-resolution";
  }

  if (!args.previewUsesPrimaryFonts) {
    return "preview-font-materialization";
  }

  if (!args.printMatchesPreview) {
    return "preview-to-print-font-resolution";
  }

  if (!args.printUsesSamePrimaryFonts) {
    return "preview-to-print-font-materialization";
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
}): Promise<ProvidedPdfVerification | null> {
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

function buildAuditReport(summary: AuditSummary): string {
  return `# Executive summary

- CV URL: \`${summary.cvUrl}\`
- Audit target: \`${summary.auditTargetKind}\` (\`${summary.auditTargetSource}\`)
- Artifact dir: \`${summary.artifactDir}\`
- Preview computes expected fonts: **${summary.previewComputesExpectedFonts ? "yes" : "no"}**
- /print/resume computes same fonts as preview: **${summary.printComputesSameFontsAsPreview ? "yes" : "no"}**
- Preview likely materializes the selected primary faces: **${summary.previewLikelyUsesPrimaryFonts ? "yes" : "no"}**
- /print/resume likely materializes the same primary faces: **${summary.printLikelyUsesSamePrimaryFontsAsPreview ? "yes" : "no"}**
- Preview vs pre-PDF print screenshot visibly different: **${summary.previewVsPrintDiff.visiblyDifferent ? "yes" : "no"}**
- Pre-PDF print screenshot vs rasterized PDF visibly different: **${summary.printVsRasterDiff.visiblyDifferent ? "yes" : "no"}**
- Preview vs rasterized PDF visibly different: **${summary.previewVsRasterDiff.visiblyDifferent ? "yes" : "no"}**

# Live preview vs PDF audit

- Request body: \`${summary.requestBodyPath}\`
- Worker bootstrap: \`${summary.workerBootstrapPath}\`
- Returned export PDF: \`${summary.returnedPdfPath}\`
- Returned export SHA-256: \`${summary.returnedPdfSha256}\`
- Returned export declared font families: \`${summary.returnedPdfDeclaredFontFamilies.join(", ") || "none"}\`
- Fixture path: \`${summary.auditFixturePath ?? "n/a"}\`
- Preview heading/body computed: \`${summary.previewSnapshot.headingFontFamilyComputed}\` / \`${summary.previewSnapshot.bodyFontFamilyComputed}\`
- Print heading/body computed: \`${summary.printRouteSnapshot.headingFontFamilyComputed}\` / \`${summary.printRouteSnapshot.bodyFontFamilyComputed}\`
- Preview heading/body primary-face likely: \`${String(summary.previewSnapshot.headingPrimaryFamilyLikely)}\` / \`${String(summary.previewSnapshot.bodyPrimaryFamilyLikely)}\`
- Print heading/body primary-face likely: \`${String(summary.printRouteSnapshot.headingPrimaryFamilyLikely)}\` / \`${String(summary.printRouteSnapshot.bodyPrimaryFamilyLikely)}\`

# First divergence boundary

\`${summary.firstDivergenceBoundary}\`

# Exact root cause

- Derived from the live audit chain above. This report records the first boundary where parity stops being true for the same export run.

# Minimal fix

- Resume surface body inheritance was normalized in active preview code, and the audit harness now captures the exact returned PDF bytes plus the worker's mandatory pre-\`page.pdf()\` screenshot.

# Files changed

- Runtime artifacts are under \`${summary.artifactDir}\`.

# Tests / verification

- Preview vs print diff JSON: \`${summary.previewVsPrintDiff.diffJsonPath}\`
- Print vs raster diff JSON: \`${summary.printVsRasterDiff.diffJsonPath}\`
- Preview vs raster diff JSON: \`${summary.previewVsRasterDiff.diffJsonPath}\`
- Provided viewed PDF verification: ${
    summary.viewedPdfVerification
      ? `path match=${summary.viewedPdfVerification.pathMatchesCapturedArtifact}, sha match=${summary.viewedPdfVerification.sha256MatchesCapturedArtifact}`
      : "not provided"
  }

# Developer debug note

- The audit saves the exact PDF bytes returned by the real click, not a replay response.
- The pre-\`page.pdf()\` screenshot is emitted by the worker itself on every audit run.
`;
}

async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const auditTarget = await resolveAuditTarget(cliArgs);
  const cvUrl = auditTarget.cvUrl;
  await ensureHarnessTargetsReachable();

  await fs.mkdir(cliArgs.artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const liveExport = await captureLiveStyledResumeExport({
      browser,
      cvUrl,
      artifactDir: cliArgs.artifactDir,
      seedDocument: auditTarget.seedDocument,
    });

    const workerBootstrapPath = path.join(cliArgs.artifactDir, "worker-bootstrap.json");
    const printRouteSnapshotPath = path.join(cliArgs.artifactDir, "print-route.json");
    const printRouteImagePath = path.join(
      cliArgs.artifactDir,
      "print-route-pre-pdf.png",
    );

    await waitForFile(workerBootstrapPath);
    await waitForFile(printRouteSnapshotPath);
    await waitForFile(printRouteImagePath);

    const workerBootstrap = JSON.parse(
      await fs.readFile(workerBootstrapPath, "utf8"),
    ) as PrintWorkerBootstrap;
    const printRouteSnapshot = JSON.parse(
      await fs.readFile(printRouteSnapshotPath, "utf8"),
    ) as ResumeFontDebugSnapshot;
    const returnedPdfBuffer = await fs.readFile(liveExport.returnedPdfPath);
    const pdfRaster = await capturePdfRasterSurface(
      browser,
      returnedPdfBuffer,
      cliArgs.artifactDir,
    );
    const previewVsPrintDiff = await compareImages(
      liveExport.previewImagePath,
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
      liveExport.previewImagePath,
      pdfRaster.imagePath,
      path.join(cliArgs.artifactDir, "diff-preview-vs-raster.png"),
      path.join(cliArgs.artifactDir, "diff-preview-vs-raster.json"),
    );
    const viewedPdfVerification = await verifyProvidedViewedPdf({
      viewedPdfPath: cliArgs.viewedPdfPath,
      returnedPdfPath: liveExport.returnedPdfPath,
      returnedPdfSha256: liveExport.returnedPdfSha256,
    });

    const previewMatchesExpected = previewComputesExpectedFonts(
      liveExport.previewSnapshot,
    );
    const previewUsesPrimaryFonts = previewLikelyUsesPrimaryFonts(
      liveExport.previewSnapshot,
    );
    const printMatchesPreview = printComputesSameFontsAsPreview(
      liveExport.previewSnapshot,
      printRouteSnapshot,
    );
    const printUsesSamePrimaryFonts = printLikelyUsesSamePrimaryFontsAsPreview(
      liveExport.previewSnapshot,
      printRouteSnapshot,
    );
    const firstDivergenceBoundary = determineFirstDivergenceBoundary({
      previewMatchesExpected,
      printMatchesPreview,
      previewUsesPrimaryFonts,
      printUsesSamePrimaryFonts,
      previewVsPrintVisiblyDifferent: previewVsPrintDiff.visiblyDifferent,
      printVsRasterVisiblyDifferent: printVsRasterDiff.visiblyDifferent,
    });
    const returnedPdfDeclaredFontFamilies = readPdfDeclaredFontFamilies(
      returnedPdfBuffer,
    );

    const summary: AuditSummary = {
      appUrl: APP_URL,
      parserUrl: PARSER_URL,
      cvUrl,
      auditTargetKind: auditTarget.kind,
      auditTargetSource: auditTarget.sourceLabel,
      auditFixturePath: auditTarget.fixturePath,
      artifactDir: cliArgs.artifactDir,
      requestBodyPath: path.join(cliArgs.artifactDir, "ui-export-request.json"),
      previewSnapshot: liveExport.previewSnapshot,
      printRouteSnapshot,
      workerBootstrapPath,
      returnedPdfPath: liveExport.returnedPdfPath,
      returnedPdfSha256: liveExport.returnedPdfSha256,
      returnedPdfBytes: liveExport.returnedPdfBytes,
      pdfRasterSnapshot: pdfRaster.snapshot,
      previewComputesExpectedFonts: previewMatchesExpected,
      printComputesSameFontsAsPreview: printMatchesPreview,
      previewLikelyUsesPrimaryFonts: previewUsesPrimaryFonts,
      printLikelyUsesSamePrimaryFontsAsPreview: printUsesSamePrimaryFonts,
      previewVsPrintDiff,
      printVsRasterDiff,
      previewVsRasterDiff,
      firstDivergenceBoundary,
      returnedPdfDeclaredFontFamilies,
      viewedPdfVerification,
    };

    await writeJson(path.join(cliArgs.artifactDir, "summary.json"), {
      ...summary,
      workerBootstrap,
      exportCapture: liveExport.exportCapture,
    });

    const auditReportPath = path.join(
      repoRootFromScript(),
      "docs",
      "audits",
      `${new Date().toISOString().slice(0, 10)}-live-styled-resume-typography-audit.md`,
    );
    await fs.mkdir(path.dirname(auditReportPath), { recursive: true });
    await fs.writeFile(auditReportPath, buildAuditReport(summary), "utf8");

    console.log(
      JSON.stringify(
        {
          artifactDir: cliArgs.artifactDir,
          auditReport: auditReportPath,
          auditTarget: {
            kind: auditTarget.kind,
            sourceLabel: auditTarget.sourceLabel,
            fixturePath: auditTarget.fixturePath,
            cvUrl: auditTarget.cvUrl,
          },
          firstDivergenceBoundary,
          returnedPdfSha256: liveExport.returnedPdfSha256,
          viewedPdfVerification,
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
  console.error("[resume-font-parity-harness] failed", error);
  process.exit(1);
});
