import type { ResumeLayoutVariantId } from "../features/verbati/resume/resume.types";
import type { VerbatiStylePreset } from "../features/verbati/types";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import type {
  ProposalTypographyAuditMetadata,
  ResumeTypographyAuditMetadata,
} from "./document-export-models";
import type { ResumeFontDebugSnapshot } from "./resume-font-debug";
import type { ProposalFontDebugSnapshot } from "./proposal-font-debug";

export type ResumePreviewDebugCapture = {
  source: "live-preview";
  rendererVariantId: ResumeLayoutVariantId;
  stylePreset: VerbatiStylePreset;
  serializedThemeVars: Record<string, string>;
  snapshot: ResumeFontDebugSnapshot;
  timestamp: number;
};

export type ResumeStyledExportClickContext = {
  cvId: string | null;
  cvUrl: string | null;
  rendererVariantId: ResumeLayoutVariantId;
  stylePreset: VerbatiStylePreset;
  previewCapture: ResumePreviewDebugCapture | null;
  timestamp: number;
};

export type ProposalPreviewDebugCapture = {
  source: "live-preview";
  templateId: ProposalTemplateId;
  stylePreset: VerbatiStylePreset;
  serializedThemeVars: Record<string, string>;
  snapshot: ProposalFontDebugSnapshot;
  timestamp: number;
};

export type ProposalStyledExportClickContext = {
  proposalId: string | null;
  proposalUrl: string | null;
  templateId: ProposalTemplateId;
  stylePreset: VerbatiStylePreset;
  previewCapture: ProposalPreviewDebugCapture | null;
  timestamp: number;
};

export type CapturedDocumentExportResponse = {
  responseStatus: number;
  responseOk: boolean;
  contentType: string | null;
  contentDisposition: string | null;
  filename: string | null;
  byteLength: number;
  bytesBase64: string | null;
};

export type CapturedDocumentExport = {
  requestBody: Record<string, unknown>;
  response: CapturedDocumentExportResponse;
  clickContext:
    | ResumeStyledExportClickContext
    | ProposalStyledExportClickContext
    | null;
  timestamp: number;
};

export type DocumentExportDebugConfig = {
  enabled: boolean;
  artifactDirRelative?: string | null;
};

declare global {
  interface Window {
    __DASTI_DOCUMENT_EXPORT_DEBUG__?: DocumentExportDebugConfig;
    __DASTI_RESUME_PREVIEW_CAPTURE__?: ResumePreviewDebugCapture;
    __DASTI_STYLED_RESUME_EXPORT_CONTEXT__?: ResumeStyledExportClickContext;
    __DASTI_PROPOSAL_PREVIEW_CAPTURE__?: ProposalPreviewDebugCapture;
    __DASTI_STYLED_PROPOSAL_EXPORT_CONTEXT__?: ProposalStyledExportClickContext;
    __DASTI_LAST_DOCUMENT_EXPORT__?: CapturedDocumentExport;
  }
}

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined";
}

export function readDocumentExportDebugConfig(): DocumentExportDebugConfig | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  const config = window.__DASTI_DOCUMENT_EXPORT_DEBUG__;
  return config?.enabled ? config : null;
}

export function buildResumeTypographyAuditMetadata(
  context: ResumeStyledExportClickContext | null,
): ResumeTypographyAuditMetadata | null {
  const config = readDocumentExportDebugConfig();
  if (!config) {
    return null;
  }

  return {
    kind: "resume_typography_audit",
    artifactDirRelative: config.artifactDirRelative ?? null,
    capturePrePdfScreenshot: true,
    cvId: context?.cvId ?? null,
    cvUrl: context?.cvUrl ?? null,
  };
}

export function setResumePreviewDebugCapture(
  capture: ResumePreviewDebugCapture,
): void {
  if (!readDocumentExportDebugConfig()) {
    return;
  }

  window.__DASTI_RESUME_PREVIEW_CAPTURE__ = capture;
}

export function readResumePreviewDebugCapture(): ResumePreviewDebugCapture | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  return window.__DASTI_RESUME_PREVIEW_CAPTURE__ ?? null;
}

export function buildProposalTypographyAuditMetadata(
  context: ProposalStyledExportClickContext | null,
): ProposalTypographyAuditMetadata | null {
  const config = readDocumentExportDebugConfig();
  if (!config) {
    return null;
  }

  return {
    kind: "proposal_typography_audit",
    artifactDirRelative: config.artifactDirRelative ?? null,
    capturePrePdfScreenshot: true,
    proposalId: context?.proposalId ?? null,
    proposalUrl: context?.proposalUrl ?? null,
  };
}

export function setProposalPreviewDebugCapture(
  capture: ProposalPreviewDebugCapture,
): void {
  if (!readDocumentExportDebugConfig()) {
    return;
  }

  window.__DASTI_PROPOSAL_PREVIEW_CAPTURE__ = capture;
}

export function readProposalPreviewDebugCapture(): ProposalPreviewDebugCapture | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  return window.__DASTI_PROPOSAL_PREVIEW_CAPTURE__ ?? null;
}

export function setStyledResumeExportContext(
  context: ResumeStyledExportClickContext,
): void {
  if (!readDocumentExportDebugConfig()) {
    return;
  }

  window.__DASTI_STYLED_RESUME_EXPORT_CONTEXT__ = context;
}

export function readStyledResumeExportContext(): ResumeStyledExportClickContext | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  return window.__DASTI_STYLED_RESUME_EXPORT_CONTEXT__ ?? null;
}

export function setStyledProposalExportContext(
  context: ProposalStyledExportClickContext,
): void {
  if (!readDocumentExportDebugConfig()) {
    return;
  }

  window.__DASTI_STYLED_PROPOSAL_EXPORT_CONTEXT__ = context;
}

export function readStyledProposalExportContext(): ProposalStyledExportClickContext | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  return window.__DASTI_STYLED_PROPOSAL_EXPORT_CONTEXT__ ?? null;
}

export function setLastCapturedDocumentExport(
  capture: CapturedDocumentExport,
): void {
  if (!readDocumentExportDebugConfig()) {
    return;
  }

  window.__DASTI_LAST_DOCUMENT_EXPORT__ = capture;
}

export function encodeArrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
