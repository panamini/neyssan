import fs from "node:fs/promises";

import { chromium } from "playwright";

import type {
  ProposalPrintSource,
  ResumePrintSource,
} from "../src/lib/document-export-models";
import {
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
  data: ResumePrintSource | ProposalPrintSource;
  stylePreset?: VerbatiStylePreset | null;
};

function isResumeSource(
  value: WorkerPayload["data"],
): value is ResumePrintSource {
  return value.kind === "resume";
}

function isProposalSource(
  value: WorkerPayload["data"],
): value is ProposalPrintSource {
  return value.kind === "proposal";
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

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("Usage: document-export-worker <input.json> <output.file>");
  }

  const payload = JSON.parse(
    await fs.readFile(inputPath, "utf8"),
  ) as WorkerPayload;

  if (payload.format === "docx") {
    if (!isProposalSource(payload.data)) {
      throw new Error("DOCX export only supports proposal payloads.");
    }

    const buffer = await buildProposalDocxBuffer({
      data: payload.data,
      stylePreset: payload.stylePreset,
    });
    await fs.writeFile(outputPath, buffer);
    return;
  }

  let html = "";

  if (isResumeSource(payload.data)) {
    html =
      payload.mode === "styled"
        ? renderResumeStyledExportDocument({
            data: payload.data,
            stylePreset: payload.stylePreset,
          })
        : renderResumeAtsExportDocument(payload.data);
  } else if (isProposalSource(payload.data)) {
    html =
      payload.mode === "styled"
        ? renderProposalStyledExportDocument({
            data: payload.data,
            stylePreset: payload.stylePreset,
          })
        : renderProposalAtsExportDocument(payload.data);
  } else {
    throw new Error("Unsupported export payload.");
  }

  await renderPdfToFile(html, outputPath);
}

void main().catch((error) => {
  console.error("[document-export-worker] failed", error);
  process.exit(1);
});
