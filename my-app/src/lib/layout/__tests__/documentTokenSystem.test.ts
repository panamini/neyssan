import { describe, expect, it } from "vitest";

import {
  buildVerbatiProposalDocumentVars,
  buildVerbatiThemeVars,
  getResumeTemplateId,
} from "../../../features/verbati/style";
import { resolveVerbatiStyle } from "../../../features/verbati/style";
import { getProposalDocumentTypography } from "../../proposal-document-typography";
import { resolvePreviewCanonicalAppearance } from "../documentAppearance";
import {
  normalizeProposalExportTokens,
  normalizeProposalPreviewTokens,
  normalizeResumeExportTokens,
  normalizeResumePreviewTokens,
} from "../documentTokenNormalizer";
import {
  BASE_PROPOSAL_TITLE_SCALE_MM,
  mmToTwip,
  stripRuntimeTokens,
} from "../documentTokens";
import {
  EXPORT_VAR_DESCRIPTORS,
  PROPOSAL_PREVIEW_VAR_DESCRIPTORS,
  PROPOSAL_RUNTIME_VAR_DESCRIPTORS,
  RESUME_PREVIEW_VAR_DESCRIPTORS,
  resolveProposalDocxSurfaceTokens,
  serializeExportVars,
  serializeProposalPreviewVars,
  serializeProposalRuntimeVars,
  serializeResumePreviewVars,
} from "../documentTokenSerializers";

function descriptorNames(values: Array<{ name: string }>) {
  return values.map((value) => value.name).sort();
}

describe("document token system", () => {
  it("covers the active preview and export vars with canonical mappings", () => {
    expect(descriptorNames(RESUME_PREVIEW_VAR_DESCRIPTORS)).toEqual(
      [
        "--body-row-gap",
        "--text-body-line",
        "--text-body-size",
        "--text-body-sm-line",
        "--text-body-sm-size",
        "--text-caption-line",
        "--text-caption-size",
        "--text-display-line",
        "--text-display-size",
        "--text-meta-line",
        "--text-meta-size",
        "--text-title-line",
        "--text-title-size",
        "--body-size-adjust",
        "--body-sm-size-adjust",
        "--bullet-gap-adjust",
        "--education-gap",
        "--display-size-adjust",
        "--experience-bullets-gap",
        "--experience-bullets-padding",
        "--flow-list-indent",
        "--workshop-experience-heading-line-height",
        "--workshop-experience-heading-size-adjust",
        "--experience-column-gap",
        "--experience-date-column",
        "--experience-item-gap",
        "--experience-org-margin",
        "--gutter-width",
        "--header-bottom-padding",
        "--header-row-gap",
        "--header-summary-width",
        "--header-title-margin-top",
        "--heading-margin-adjust",
        "--main-heading-gap",
        "--main-heading-margin",
        "--main-left-padding",
        "--main-section-gap",
        "--main-width",
        "--margin-bottom",
        "--margin-left",
        "--margin-right",
        "--margin-top",
        "--page-height",
        "--page-radius",
        "--page-width",
        "--project-gap",
        "--project-gap-adjust",
        "--project-padding",
        "--project-padding-adjust",
        "--section-gap-adjust",
        "--sidebar-content-gap",
        "--sidebar-right-padding",
        "--sidebar-section-gap",
        "--sidebar-title-margin",
        "--sidebar-title-padding",
        "--sidebar-width",
        "--skill-gap",
        "--skill-gap",
        "--skill-pad-block",
        "--skill-pad-inline",
        "--skill-padding-block",
        "--skill-padding-inline",
        "--workshop-section-title-reduction",
        "--title-size-adjust",
        "--volk-grid-body-top",
        "--volk-grid-body-width",
        "--volk-grid-bottom-margin",
        "--volk-grid-dot-left",
        "--volk-grid-dot-top",
        "--volk-grid-header-width",
        "--volk-grid-left",
        "--volk-grid-meta-left-0",
        "--volk-grid-meta-left-1",
        "--volk-grid-meta-left-2",
        "--volk-grid-meta-left-3",
        "--volk-grid-meta-top",
        "--volk-grid-sender-top",
        "--volk-grid-subject-top",
        "--volk-grid-subject-value-left",
        "--volk-grid-subject-value-top",
        "--volk-grid-subtitle-top",
        "--volk-grid-title-top",
      ].sort(),
    );

    expect(
      descriptorNames([
        ...PROPOSAL_PREVIEW_VAR_DESCRIPTORS,
        ...PROPOSAL_RUNTIME_VAR_DESCRIPTORS,
      ]),
    ).toEqual(
      [
        "--proposal-block-mm",
        "--proposal-document-font-family",
        "--proposal-document-font-size",
        "--proposal-document-font-weight",
        "--proposal-document-letter-spacing",
        "--proposal-document-line-height",
        "--proposal-document-page-gap",
        "--proposal-document-reading-measure-max",
        "--proposal-document-title-scale",
        "--proposal-inline-mm",
        "--proposal-template-body-start-mm",
        "--proposal-template-bottom-margin-mm",
        "--proposal-template-left-zone-mm",
        "--proposal-template-right-margin-mm",
        "--proposal-template-top-offset-mm",
        "--volk-grid-body-top",
        "--volk-grid-body-width",
        "--volk-grid-dot-left",
        "--volk-grid-dot-top",
        "--volk-grid-header-width",
        "--volk-grid-left",
        "--volk-grid-meta-top",
        "--volk-grid-sender-top",
        "--volk-grid-subject-top",
        "--volk-grid-subject-value-left",
        "--volk-grid-subject-value-top",
        "--volk-grid-subtitle-top",
        "--volk-grid-title-top",
      ].sort(),
    );

    const exportDescriptorNames = descriptorNames(EXPORT_VAR_DESCRIPTORS);
    expect(exportDescriptorNames).toContain("--flow-summary-size");
    expect(exportDescriptorNames).toContain("--flow-summary-line");
    expect(exportDescriptorNames).toContain("--robial-step-a");
    expect(exportDescriptorNames).toContain("--robial-step-b");
    expect(exportDescriptorNames).toContain("--proposal-title-size");

    const summarySizeDescriptor = EXPORT_VAR_DESCRIPTORS.find(
      (descriptor) => descriptor.name === "--flow-summary-size",
    );
    const summaryLineDescriptor = EXPORT_VAR_DESCRIPTORS.find(
      (descriptor) => descriptor.name === "--flow-summary-line",
    );
    expect(summarySizeDescriptor?.fieldPath).toBe("flow.type.summary.sizePt");
    expect(summaryLineDescriptor?.fieldPath).toBe(
      "flow.type.summary.lineHeight",
    );
  });

  it("serializes resume preview vars from one canonical object", () => {
    const tokens = normalizeResumePreviewTokens({
      resumeTemplateId: "two_column_resume_legacy",
    });
    const previewVars = serializeResumePreviewVars(tokens);

    expect(tokens.geometry.page.liveArea).toEqual({
      widthMm: 157,
      heightMm: 218,
    });
    expect(previewVars["--margin-top"]).toBe("26mm");
    expect(previewVars["--header-bottom-padding"]).toBe("5mm");
    expect(previewVars["--text-display-size"]).toBeDefined();
    expect(previewVars["--text-body-size"]).toBeDefined();
    expect(previewVars["--text-caption-size"]).toBeDefined();
    expect(previewVars["--display-size-adjust"]).toBe("-0.15mm");
  });

  it("serializes canonical volk grid primitives for the active volk preview", () => {
    const stylePreset = resolveVerbatiStyle({
      familyId: "volk-register",
      layout: "volk-register",
      typography: "quiet-editorial",
      palette: "sauge",
    });
    const tokens = normalizeResumePreviewTokens({
      resumeTemplateId: getResumeTemplateId(stylePreset),
      stylePreset,
    });
    const previewVars = serializeResumePreviewVars(tokens);

    expect(previewVars["--volk-grid-left"]).toBeDefined();
    expect(previewVars["--volk-grid-header-width"]).toBeDefined();
    expect(previewVars["--volk-grid-body-width"]).toBeDefined();
    expect(previewVars["--volk-grid-meta-left-0"]).toBeDefined();
  });

  it("changes only flow when proposal voice overlay changes", () => {
    const stylePreset = resolveVerbatiStyle({
      layout: "swiss",
      typography: "quiet-editorial",
      palette: "pierre",
    });
    const signatureTokens = normalizeProposalPreviewTokens({
      templateId: "swiss_margin",
      documentTypography: getProposalDocumentTypography(
        "signature",
        stylePreset,
      ),
    });
    const expertTokens = normalizeProposalPreviewTokens({
      templateId: "swiss_margin",
      documentTypography: getProposalDocumentTypography("expert", stylePreset),
    });

    expect(signatureTokens.geometry).toEqual(expertTokens.geometry);
    expect(signatureTokens.appearance.font.body.family).toBe(
      expertTokens.appearance.font.body.family,
    );
    expect(signatureTokens.flow.type.body.sizePt).not.toBe(
      expertTokens.flow.type.body.sizePt,
    );
    expect(signatureTokens.flow.type.body.lineHeight).not.toBe(
      expertTokens.flow.type.body.lineHeight,
    );
  });

  it("routes preview appearance vars through one canonical appearance source", () => {
    const stylePreset = resolveVerbatiStyle({
      layout: "swiss",
      typography: "quiet-editorial",
      palette: "bordeaux",
    });
    const appearance = resolvePreviewCanonicalAppearance(stylePreset);
    const themeVars = buildVerbatiThemeVars(stylePreset);
    const proposalVars = buildVerbatiProposalDocumentVars(stylePreset);
    const resumePreviewTokens = normalizeResumePreviewTokens(
      {
        resumeTemplateId: "two_column_resume_legacy",
        stylePreset,
      },
    );
    const proposalPreviewTokens = normalizeProposalPreviewTokens({
      templateId: "swiss_margin",
      documentTypography: getProposalDocumentTypography(
        "signature",
        stylePreset,
      ),
      stylePreset,
    });

    expect(themeVars["--color-accent"]).toBe(appearance.theme.accent);
    expect(themeVars["--proposal-document-ink"]).toBe(
      appearance.theme.proposalDocumentInk,
    );
    expect(proposalVars["--proposal-document-accent-ink"]).toBe(
      appearance.theme.proposalDocumentAccentInk,
    );
    expect(resumePreviewTokens.appearance.theme.accent).toBe(
      appearance.theme.accent,
    );
    expect(proposalPreviewTokens.appearance.theme.proposalDocumentInk).toBe(
      appearance.theme.proposalDocumentInk,
    );
  });

  it("resolves proposal title size and preview title scale from the same multiplier", () => {
    const stylePreset = resolveVerbatiStyle({
      layout: "editorial",
      typography: "quiet-editorial",
      palette: "ocre",
    });
    const exportTokens = normalizeProposalExportTokens({
      mode: "styled",
      proposalTemplateId: "editorial_wide",
      stylePreset,
    }).canonical;
    const exportVars = serializeExportVars(exportTokens);
    const previewTokens = normalizeProposalPreviewTokens({
      templateId: "editorial_wide",
      documentTypography: getProposalDocumentTypography(
        "signature",
        stylePreset,
      ),
    });
    const previewVars = serializeProposalPreviewVars(previewTokens);

    const multiplier = exportTokens.flow.template.titleScaleMultiplier ?? 1;
    const baseTitleSizePt = exportTokens.flow.type.title.sizePt ?? 0;
    const resolvedExportTitlePt = Number.parseFloat(
      exportVars["--proposal-title-size"].replace("pt", ""),
    );
    const resolvedPreviewScaleMm = Number.parseFloat(
      previewVars["--proposal-document-title-scale"],
    );

    expect(resolvedExportTitlePt).toBeCloseTo(baseTitleSizePt * multiplier, 2);
    expect(resolvedPreviewScaleMm).toBeCloseTo(
      BASE_PROPOSAL_TITLE_SCALE_MM * multiplier,
      3,
    );
    expect(exportVars["--flow-reading-measure"]).toBe("64ch");
  });

  it("keeps runtime vars out of canonical snapshots and export serialization", () => {
    const stylePreset = resolveVerbatiStyle({
      layout: "modernist",
      typography: "quiet-editorial",
      palette: "encre",
    });
    const previewTokens = normalizeProposalPreviewTokens({
      templateId: "modernist_signal",
      documentTypography: getProposalDocumentTypography("direct", stylePreset),
      pageGapPx: 24,
    });
    const runtimeVars = serializeProposalRuntimeVars(previewTokens);
    const exportTokens = normalizeProposalExportTokens({
      mode: "styled",
      proposalTemplateId: "modernist_signal",
      stylePreset,
    }).canonical;
    const exportVars = serializeExportVars(exportTokens);

    expect(runtimeVars["--proposal-document-page-gap"]).toBe("24px");
    expect(exportVars["--proposal-document-page-gap"]).toBeUndefined();
    expect(JSON.stringify(stripRuntimeTokens(previewTokens))).not.toContain(
      "proposalDocumentPageGapPx",
    );
  });

  it("derives DOCX proposal margins and subject sizing from canonical tokens", () => {
    const stylePreset = resolveVerbatiStyle({
      layout: "quire",
      typography: "quiet-editorial",
      palette: "ocre",
    });
    const exportTokens = normalizeProposalExportTokens({
      mode: "styled",
      proposalTemplateId: "quire_margin",
      stylePreset,
    }).canonical;
    const docxTokens = resolveProposalDocxSurfaceTokens(exportTokens);

    expect(docxTokens.pageMarginsTwip.top).toBe(
      mmToTwip(exportTokens.geometry.page.margin.topMm),
    );
    expect(docxTokens.pageMarginsTwip.left).toBe(
      mmToTwip(exportTokens.geometry.page.margin.leftMm),
    );
    expect(docxTokens.subjectSizeHalfPt).toBeGreaterThan(
      docxTokens.bodySizeHalfPt,
    );
  });
});
  it("resolves workshop preview and export resume tokens from the exact template id", () => {
    const stylePreset = resolveVerbatiStyle({
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    });
    const resumeTemplateId = getResumeTemplateId(stylePreset);
    const previewTokens = normalizeResumePreviewTokens({
      resumeTemplateId,
      stylePreset,
    });
    const previewVars = serializeResumePreviewVars(previewTokens);
    const exportTokens = normalizeResumeExportTokens({
      mode: "styled",
      resumeTemplateId,
      stylePreset,
    });

    expect(resumeTemplateId).toBe("workshop_resume_onecol_ats");
    expect(previewTokens.geometry.columns.sidebarMm).toBe(0);
    expect(previewTokens.flow.measure.summaryWidthMm).toBe(120);
    expect(previewTokens.flow.component.main?.sectionTitleReductionMm).toBe(0.95);
    expect(previewTokens.flow.component.experience?.headingSizeAdjustMm).toBe(0.2);
    expect(previewTokens.flow.component.experience?.headingLineHeight).toBe(1.25);
    expect(previewTokens.flow.pagination.bottomFitSafetyMm).toBe(0.5);
    expect(previewVars["--sidebar-width"]).toBe("0mm");
    expect(previewVars["--margin-left"]).toBe("18mm");
    expect(previewVars["--header-summary-width"]).toBe("120mm");
    expect(previewVars["--workshop-section-title-reduction"]).toBe("0.95mm");
    expect(previewVars["--workshop-experience-heading-size-adjust"]).toBe("0.2mm");
    expect(previewVars["--workshop-experience-heading-line-height"]).toBe("1.25");
    expect(previewVars["--flow-list-indent"]).toBe(
      previewVars["--experience-bullets-padding"],
    );
    expect(exportTokens.id).toBe("workshop_resume_onecol_ats");
    expect(exportTokens.shell).toBe("onecol");
    expect(exportTokens.canonical.geometry.columns.sidebarMm).toBe(0);
    expect(exportTokens.canonical.flow.measure.resumeReadingWidthMm).toBe(120);
    expect(
      serializeExportVars(exportTokens.canonical)["--flow-list-indent"],
    ).toBe(
      serializeExportVars(exportTokens.canonical)["--experience-bullets-padding"],
    );
  });
