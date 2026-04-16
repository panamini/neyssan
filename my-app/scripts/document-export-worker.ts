import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import type {
  ProposalPreviewPrintSource,
  ProposalTypographyAuditMetadata,
  ProposalPrintSource,
  ResumePreviewPrintSource,
  ResumePrintSource,
  ResumeTypographyAuditMetadata,
} from "../src/lib/document-export-models";
import {
  buildProposalPrintDebugSnapshot,
  buildProposalPrintRoutePayload,
  buildResumePrintDebugSnapshot,
  buildResumePrintRoutePayload,
} from "../src/lib/document-export-models";
import {
  buildResumeDocxBuffer,
  buildProposalDocxBuffer,
  renderProposalAtsExportDocument,
  renderProposalStyledExportDocument,
  renderResumeAtsExportDocument,
  renderResumeStyledExportDocument,
} from "../src/lib/export-renderers";
import type { VerbatiStylePreset } from "../src/features/verbati/types";

type WorkerPayload = {
  kind: "resume" | "proposal";
  format: "pdf" | "docx";
  mode?: "ats" | "styled";
  data:
    | ResumePrintSource
    | ResumePreviewPrintSource
    | ProposalPrintSource
    | ProposalPreviewPrintSource;
  stylePreset?: VerbatiStylePreset | null;
  metadata?: Record<string, unknown> | null;
};

type PrintRouteStatusSnapshot = {
  status: string;
  payloadReadable: boolean;
  error?: string;
  snapshot?: {
    layout?: string;
    typography?: string;
    palette?: string;
    accentHex?: string;
    rendererVariantId?: string;
    templateId?: string;
    voicePreset?: string | null;
    headingFontFamily?: string;
    bodyFontFamily?: string;
    headingFontFamilyComputed?: string;
    bodyFontFamilyComputed?: string;
    titleFontFamilyComputed?: string;
    contactFontFamilyComputed?: string;
    fontHeadingCssVar?: string;
    fontBodyCssVar?: string;
    documentFontsStatus?: string;
    headingFontCheck?: boolean | null;
    bodyFontCheck?: boolean | null;
  };
};

type ResumeTypographyAuditArtifacts = {
  artifactDir: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

function isResumeSource(
  value: WorkerPayload["data"],
): value is ResumePrintSource {
  return value.kind === "resume" && !("renderSource" in value);
}

function isResumePreviewSource(
  value: WorkerPayload["data"],
): value is ResumePreviewPrintSource {
  return value.kind === "resume" && value.renderSource === "preview";
}

function isProposalSource(
  value: WorkerPayload["data"],
): value is ProposalPrintSource {
  return value.kind === "proposal" && !("renderSource" in value);
}

function isProposalPreviewSource(
  value: WorkerPayload["data"],
): value is ProposalPreviewPrintSource {
  return value.kind === "proposal" && "renderSource" in value;
}

function readResumeTypographyAuditArtifacts(
  metadata: WorkerPayload["metadata"],
): ResumeTypographyAuditArtifacts | null {
  const audit =
    metadata?.resumeTypographyAudit ?? metadata?.proposalTypographyAudit;
  if (!audit || typeof audit !== "object") {
    return null;
  }

  const record = audit as
    | Partial<ResumeTypographyAuditMetadata>
    | Partial<ProposalTypographyAuditMetadata>;
  if (
    record.kind !== "resume_typography_audit" &&
    record.kind !== "proposal_typography_audit"
  ) {
    return null;
  }

  const artifactDirRelative = String(record.artifactDirRelative ?? "").trim();
  if (!artifactDirRelative) {
    return null;
  }

  return {
    artifactDir: path.resolve(REPO_ROOT, artifactDirRelative),
  };
}

async function writeAuditArtifact(
  auditArtifacts: ResumeTypographyAuditArtifacts | null,
  fileName: string,
  content: string | Buffer,
): Promise<void> {
  if (!auditArtifacts) {
    return;
  }

  await fs.mkdir(auditArtifacts.artifactDir, { recursive: true });
  await fs.writeFile(path.join(auditArtifacts.artifactDir, fileName), content);
}

async function renderPdfToFile(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
}

function resolveFrontendBaseUrls(): string[] {
  const candidates = [
    process.env.DOCUMENT_EXPORT_FRONTEND_URL,
    process.env.CLIENT_ORIGIN,
    process.env.VITE_FRONTEND_URL,
    "http://host.docker.internal:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ];

  const resolved: string[] = [];
  for (const candidate of candidates) {
    const trimmed = String(candidate ?? "").trim();
    if (trimmed) {
      const normalized = trimmed.replace(/\/+$/, "");
      if (!resolved.includes(normalized)) {
        resolved.push(normalized);
      }
    }
  }

  if (resolved.length === 0) {
    throw new Error("Styled resume PDF export requires a frontend app URL.");
  }

  return resolved;
}

async function renderStyledResumePdfToFile(args: {
  data: ResumePreviewPrintSource;
  outputPath: string;
  metadata?: WorkerPayload["metadata"];
}): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const auditArtifacts = readResumeTypographyAuditArtifacts(args.metadata);
    const printRoutePayload = buildResumePrintRoutePayload({
      data: args.data,
    });
    const debugSnapshot = buildResumePrintDebugSnapshot({
      stylePreset: printRoutePayload.stylePreset,
      rendererVariantId: printRoutePayload.rendererVariantId,
    });
    console.debug("[document-export-worker] styled resume print payload", debugSnapshot);
    await writeAuditArtifact(
      auditArtifacts,
      "worker-bootstrap.json",
      `${JSON.stringify(
        {
          printRoutePayload,
          debugSnapshot,
        },
        null,
        2,
      )}\n`,
    );

    await page.addInitScript((payload) => {
      (window as typeof window & {
        __DASTI_RESUME_PRINT_PAYLOAD__?: unknown;
        __DASTI_RESUME_PRINT_STATUS__?: {
          status: string;
          payloadReadable: boolean;
          timestamp: number;
        };
      }).__DASTI_RESUME_PRINT_PAYLOAD__ = payload;
      (window as typeof window & {
        __DASTI_RESUME_PRINT_STATUS__?: {
          status: string;
          payloadReadable: boolean;
          timestamp: number;
        };
      }).__DASTI_RESUME_PRINT_STATUS__ = {
        status: "booting",
        payloadReadable: Boolean(payload),
        timestamp: Date.now(),
      };
    }, printRoutePayload);

    await page.emulateMedia({
      media: "print",
    });
    const routeCandidates = resolveFrontendBaseUrls().map(
      (baseUrl) => `${baseUrl}/print/resume`,
    );
    let lastError: unknown = null;
    let navigatedUrl: string | null = null;

    for (const candidate of routeCandidates) {
      try {
        await page.goto(candidate, {
          waitUntil: "load",
          timeout: 15_000,
        });
        navigatedUrl = candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!navigatedUrl) {
      throw new Error(
        `Unable to reach styled resume print route. Tried: ${routeCandidates.join(", ")}. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }

    await page.waitForFunction(() => {
      const status = (window as typeof window & {
        __DASTI_RESUME_PRINT_STATUS__?: {
          status: string;
        };
      }).__DASTI_RESUME_PRINT_STATUS__;

      return status?.status === "ready" || status?.status === "error";
    });

    const status = await page.evaluate(() => {
      return (window as typeof window & {
        __DASTI_RESUME_PRINT_STATUS__?: PrintRouteStatusSnapshot;
      }).__DASTI_RESUME_PRINT_STATUS__ ?? null;
    });

    if (!status) {
      throw new Error("Resume print route did not expose a readiness status.");
    }

    if (status.status === "error") {
      throw new Error(
        `Resume print route failed: ${status.error ?? "unknown error"}${
          status.snapshot ? ` | snapshot=${JSON.stringify(status.snapshot)}` : ""
        }`,
      );
    }

    if (!status.snapshot) {
      throw new Error(
        "Resume print route reached ready without exposing a font debug snapshot.",
      );
    }

    if (
      status.snapshot.typography !== printRoutePayload.stylePreset.typography ||
      status.snapshot.rendererVariantId !== printRoutePayload.rendererVariantId
    ) {
      throw new Error(
        `Resume print route snapshot diverged before PDF generation: ${JSON.stringify({
          expectedTypography: printRoutePayload.stylePreset.typography,
          actualTypography: status.snapshot.typography,
          expectedRendererVariantId: printRoutePayload.rendererVariantId,
          actualRendererVariantId: status.snapshot.rendererVariantId,
        })}`,
      );
    }

    console.debug(
      "[document-export-worker] pre-pdf print snapshot",
      JSON.stringify(status.snapshot),
    );
    await writeAuditArtifact(
      auditArtifacts,
      "print-route.json",
      `${JSON.stringify(status.snapshot, null, 2)}\n`,
    );
    if (auditArtifacts) {
      await fs.mkdir(auditArtifacts.artifactDir, { recursive: true });
      const pageLocator = page.locator(
        ".dasti-resume-print-route .resume-page",
      );
      await pageLocator.scrollIntoViewIfNeeded();
      const pageBox = await pageLocator.boundingBox();
      if (!pageBox) {
        throw new Error(
          "Unable to read .resume-page bounds for the pre-pdf print screenshot.",
        );
      }

      const screenshotWidth = Math.ceil(pageBox.x + pageBox.width + 24);
      const screenshotHeight = Math.ceil(pageBox.y + pageBox.height + 24);
      const currentViewport = page.viewportSize();
      if (
        !currentViewport ||
        currentViewport.width < screenshotWidth ||
        currentViewport.height < screenshotHeight
      ) {
        await page.setViewportSize({
          width: Math.max(currentViewport?.width ?? 0, screenshotWidth),
          height: Math.max(currentViewport?.height ?? 0, screenshotHeight),
        });
        await page.waitForTimeout(50);
      }

      await page.screenshot({
        path: path.join(auditArtifacts.artifactDir, "print-route-pre-pdf.png"),
        clip: {
          x: Math.max(0, pageBox.x),
          y: Math.max(0, pageBox.y),
          width: Math.ceil(pageBox.width),
          height: Math.ceil(pageBox.height),
        },
      });
    }

    await page.pdf({
      path: args.outputPath,
      preferCSSPageSize: true,
      printBackground: true,
      scale: 1,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
}

async function renderStyledProposalPdfToFile(args: {
  data: ProposalPreviewPrintSource;
  outputPath: string;
  metadata?: WorkerPayload["metadata"];
}): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const auditArtifacts = readResumeTypographyAuditArtifacts(args.metadata);
    const printRoutePayload = buildProposalPrintRoutePayload({
      data: args.data,
    });
    const debugSnapshot = buildProposalPrintDebugSnapshot({
      stylePreset: printRoutePayload.stylePreset,
      templateId: printRoutePayload.templateId,
      voicePreset: printRoutePayload.voicePreset,
    });

    await writeAuditArtifact(
      auditArtifacts,
      "worker-bootstrap.json",
      `${JSON.stringify(
        {
          printRoutePayload,
          debugSnapshot,
        },
        null,
        2,
      )}\n`,
    );

    await page.addInitScript((payload) => {
      (window as typeof window & {
        __DASTI_PROPOSAL_PRINT_PAYLOAD__?: unknown;
        __DASTI_PROPOSAL_PRINT_STATUS__?: {
          status: string;
          payloadReadable: boolean;
          timestamp: number;
        };
      }).__DASTI_PROPOSAL_PRINT_PAYLOAD__ = payload;
      (window as typeof window & {
        __DASTI_PROPOSAL_PRINT_STATUS__?: {
          status: string;
          payloadReadable: boolean;
          timestamp: number;
        };
      }).__DASTI_PROPOSAL_PRINT_STATUS__ = {
        status: "booting",
        payloadReadable: Boolean(payload),
        timestamp: Date.now(),
      };
    }, printRoutePayload);

    await page.emulateMedia({
      media: "print",
    });

    const routeCandidates = resolveFrontendBaseUrls().map(
      (baseUrl) => `${baseUrl}/print/proposal`,
    );
    let lastError: unknown = null;
    let navigatedUrl: string | null = null;

    for (const candidate of routeCandidates) {
      try {
        await page.goto(candidate, {
          waitUntil: "load",
          timeout: 15_000,
        });
        navigatedUrl = candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!navigatedUrl) {
      throw new Error(
        `Unable to reach styled proposal print route. Tried: ${routeCandidates.join(", ")}. Last error: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    }

    await page.waitForFunction(() => {
      const status = (window as typeof window & {
        __DASTI_PROPOSAL_PRINT_STATUS__?: {
          status: string;
        };
      }).__DASTI_PROPOSAL_PRINT_STATUS__;

      return status?.status === "ready" || status?.status === "error";
    });

    const status = await page.evaluate(() => {
      return (window as typeof window & {
        __DASTI_PROPOSAL_PRINT_STATUS__?: PrintRouteStatusSnapshot;
      }).__DASTI_PROPOSAL_PRINT_STATUS__ ?? null;
    });

    if (!status) {
      throw new Error("Proposal print route did not expose a readiness status.");
    }

    if (status.status === "error") {
      throw new Error(
        `Proposal print route failed: ${status.error ?? "unknown error"}${
          status.snapshot ? ` | snapshot=${JSON.stringify(status.snapshot)}` : ""
        }`,
      );
    }

    if (!status.snapshot) {
      throw new Error(
        "Proposal print route reached ready without exposing a font debug snapshot.",
      );
    }

    if (
      status.snapshot.templateId !== printRoutePayload.templateId ||
      status.snapshot.typography !== printRoutePayload.stylePreset.typography
    ) {
      throw new Error(
        `Proposal print route snapshot diverged before PDF generation: ${JSON.stringify({
          expectedTemplateId: printRoutePayload.templateId,
          actualTemplateId: status.snapshot.templateId,
          expectedTypography: printRoutePayload.stylePreset.typography,
          actualTypography: status.snapshot.typography,
        })}`,
      );
    }

    await writeAuditArtifact(
      auditArtifacts,
      "print-route.json",
      `${JSON.stringify(status.snapshot, null, 2)}\n`,
    );

    if (auditArtifacts) {
      await fs.mkdir(auditArtifacts.artifactDir, { recursive: true });
      const documentLocator = page.locator(
        ".dasti-proposal-print-route .dasti-proposal-document",
      );
      await documentLocator.scrollIntoViewIfNeeded();
      const documentBox = await documentLocator.boundingBox();
      if (!documentBox) {
        throw new Error(
          "Unable to read .dasti-proposal-document bounds for the pre-pdf print screenshot.",
        );
      }

      const screenshotWidth = Math.ceil(documentBox.x + documentBox.width + 24);
      const screenshotHeight = Math.ceil(documentBox.y + documentBox.height + 24);
      const currentViewport = page.viewportSize();
      if (
        !currentViewport ||
        currentViewport.width < screenshotWidth ||
        currentViewport.height < screenshotHeight
      ) {
        await page.setViewportSize({
          width: Math.max(currentViewport?.width ?? 0, screenshotWidth),
          height: Math.max(currentViewport?.height ?? 0, screenshotHeight),
        });
        await page.waitForTimeout(50);
      }

      await page.screenshot({
        path: path.join(auditArtifacts.artifactDir, "print-route-pre-pdf.png"),
        clip: {
          x: Math.max(0, documentBox.x),
          y: Math.max(0, documentBox.y),
          width: Math.ceil(documentBox.width),
          height: Math.ceil(documentBox.height),
        },
      });
    }

    await page.pdf({
      path: args.outputPath,
      preferCSSPageSize: true,
      printBackground: true,
      scale: 1,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("Usage: document-export-worker <input.json> <output.file>");
  }

  const payload = JSON.parse(
    await fs.readFile(inputPath, "utf8"),
  ) as WorkerPayload;

  if (payload.format === "docx") {
    if (isResumeSource(payload.data)) {
      const buffer = await buildResumeDocxBuffer({
        data: payload.data,
        stylePreset: payload.stylePreset,
      });
      await fs.writeFile(outputPath, buffer);
      return;
    }

    if (isProposalSource(payload.data)) {
      const buffer = await buildProposalDocxBuffer({
        data: payload.data,
        stylePreset: payload.stylePreset,
      });
      await fs.writeFile(outputPath, buffer);
      return;
    }

    throw new Error("DOCX export only supports resume or proposal payloads.");
  }

  let html = "";

  if (payload.mode === "styled" && isResumePreviewSource(payload.data)) {
    await renderStyledResumePdfToFile({
      data: payload.data,
      outputPath,
      metadata: payload.metadata,
    });
    return;
  }

  if (payload.mode === "styled" && isProposalPreviewSource(payload.data)) {
    await renderStyledProposalPdfToFile({
      data: payload.data,
      outputPath,
      metadata: payload.metadata,
    });
    return;
  }

  if (isResumeSource(payload.data)) {
    html =
      payload.mode === "styled"
        ? renderResumeStyledExportDocument({
            data: payload.data,
            stylePreset: payload.stylePreset,
          })
        : renderResumeAtsExportDocument(payload.data, payload.stylePreset);
  } else if (isProposalSource(payload.data)) {
    html =
      payload.mode === "styled"
        ? renderProposalStyledExportDocument({
            data: payload.data,
            stylePreset: payload.stylePreset,
          })
        : renderProposalAtsExportDocument(payload.data, payload.stylePreset);
  } else {
    throw new Error("Unsupported export payload.");
  }

  await renderPdfToFile(html, outputPath);
}

void main().catch((error) => {
  console.error("[document-export-worker] failed", error);
  process.exit(1);
});
