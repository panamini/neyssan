/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { resolveProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { resolveProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import { getVerbatiTypographyFamilies, resolveVerbatiStyle } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { getProposalDocumentTypography } from "./proposal-document-typography";

export type ProposalFontDebugSnapshot = {
  layout: VerbatiStylePreset["layout"];
  typography: VerbatiStylePreset["typography"];
  palette: VerbatiStylePreset["palette"];
  accentHex?: string;
  templateId: ProposalTemplateId;
  voicePreset: string | null;
  expectedHeadingFontFamily: string;
  expectedBodyFontFamily: string;
  titleFontFamilyComputed: string;
  bodyFontFamilyComputed: string;
  contactFontFamilyComputed: string;
  documentFontsStatus: string;
  loadedFontFamilies: string[];
  localFontFaceStylePresent: boolean;
  localFontFaceCssLength: number;
};

type CollectProposalFontDebugSnapshotArgs = {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
  voicePreset?: string | null;
  root?: ParentNode | null;
};

function readLoadedFontFamilies(): string[] {
  if (typeof document === "undefined" || !document.fonts) {
    return [];
  }

  try {
    const families = Array.from(document.fonts, (face) =>
      String(face.family ?? "").replace(/^['"]|['"]$/g, "").trim(),
    ).filter(Boolean);

    return Array.from(new Set(families)).sort((left, right) =>
      left.localeCompare(right),
    );
  } catch {
    return [];
  }
}

function readComputedFontFamily(
  root: ParentNode,
  selectors: string[],
): string {
  for (const selector of selectors) {
    const element = root.querySelector?.(selector) as HTMLElement | null;
    if (element) {
      return getComputedStyle(element).fontFamily;
    }
  }

  return "";
}

export function buildProposalFontDebugSnapshot(args: {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
  voicePreset?: string | null;
}): ProposalFontDebugSnapshot {
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const typographyFamilies = getVerbatiTypographyFamilies(stylePreset);
  const voicePreset = resolveProposalVoicePreset(args.voicePreset);
  const documentTypography = getProposalDocumentTypography(
    voicePreset ?? null,
    stylePreset,
  );

  return {
    layout: stylePreset.layout,
    typography: stylePreset.typography,
    palette: stylePreset.palette,
    accentHex: stylePreset.accentHex,
    templateId: resolveProposalTemplateId(args.templateId),
    voicePreset: args.voicePreset?.trim() || null,
    expectedHeadingFontFamily: typographyFamilies.headingFamily,
    expectedBodyFontFamily: documentTypography.fontFamily,
    titleFontFamilyComputed: "",
    bodyFontFamilyComputed: "",
    contactFontFamilyComputed: "",
    documentFontsStatus:
      typeof document === "undefined" ? "unknown" : document.fonts?.status ?? "unavailable",
    loadedFontFamilies: readLoadedFontFamilies(),
    localFontFaceStylePresent: false,
    localFontFaceCssLength: 0,
  };
}

export function collectProposalFontDebugSnapshot(
  args: CollectProposalFontDebugSnapshotArgs,
): ProposalFontDebugSnapshot {
  const snapshot = buildProposalFontDebugSnapshot(args);
  const root = args.root ?? document;
  const styleTag =
    typeof document === "undefined"
      ? null
      : document.getElementById("dasti-local-font-faces");

  snapshot.titleFontFamilyComputed = readComputedFontFamily(root, [
    ".dasti-proposal-document__volk-title",
    ".dasti-proposal-document__sender-label",
    ".dasti-proposal-document__structured-header-value",
  ]);
  snapshot.bodyFontFamilyComputed = readComputedFontFamily(root, [
    ".dasti-proposal-document__paragraph",
    ".dasti-proposal-document__raw-body",
    ".dasti-proposal-document__signoff",
  ]);
  snapshot.contactFontFamilyComputed = readComputedFontFamily(root, [
    ".dasti-proposal-document__sender-contact",
    ".dasti-proposal-document__sender-role",
    ".dasti-proposal-document__structured-header-value",
  ]);
  snapshot.documentFontsStatus =
    typeof document === "undefined" ? "unknown" : document.fonts?.status ?? "unavailable";
  snapshot.loadedFontFamilies = readLoadedFontFamilies();
  snapshot.localFontFaceStylePresent = Boolean(styleTag);
  snapshot.localFontFaceCssLength = String(styleTag?.textContent ?? "").length;

  return snapshot;
}
