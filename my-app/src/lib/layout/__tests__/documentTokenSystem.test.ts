import { describe, expect, it } from "vitest";

import {
  buildVerbatiProposalDocumentVars,
  buildVerbatiThemeVars,
  getResumeTemplateId,
} from "../../../features/verbati/style";
import { resolveVerbatiStyle } from "../../../features/verbati/style";
import { getProposalDocumentTypography } from "../../proposal-document-typography";
import { DOCUMENT_PAGE_SIZES } from "../../document-page-size";
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
  it("keeps canonical cover-letter preview type within the readable Workshop range", () => {
    const documentTypography = {
      fontFamily: "Syne, sans-serif",
      fontSize: "10.74pt",
      lineHeight: 1.65,
      fontWeight: 400,
      letterSpacing: "0em",
    };

    const minimal = normalizeProposalPreviewTokens({
      templateId: "workshop_proposal_margin",
      documentTypography,
    });
    const french = normalizeProposalPreviewTokens({
      templateId: "modernist_signal",
      documentTypography,
    });
    const editorial = normalizeProposalPreviewTokens({
      templateId: "editorial_wide",
      documentTypography,
    });

    expect(minimal.flow.type.body.lineHeight).toBe(1.46);
    expect(french.flow.type.body.lineHeight).toBe(1.46);
    expect(minimal.flow.type.body.sizePt).toBe(11);
    expect(french.flow.type.body.sizePt).toBe(11);
    expect(editorial.flow.type.body.sizePt).toBe(10.74);
    expect(editorial.flow.type.body.lineHeight).toBe(1.65);
  });

  it.each(["workshop_proposal_margin", "modernist_signal"] as const)(
    "keeps %s export and DOCX body type at the canonical 11pt floor",
    (proposalTemplateId) => {
      const exportTokens = normalizeProposalExportTokens({
        mode: "styled",
        proposalTemplateId,
      }).canonical;
      const docxTokens = resolveProposalDocxSurfaceTokens(exportTokens);

      expect(exportTokens.flow.type.body.sizePt).toBe(11);
      expect(docxTokens.bodySizeHalfPt).toBe(22);
    },
  );

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
        "--body-font",
        "--font-body-family",
        "--font-heading-family",
        "--heading-font",
        "--proposal-block-mm",
        "--proposal-document-font-family",
        "--proposal-document-font-size",
        "--proposal-document-font-weight",
        "--proposal-document-letter-spacing",
        "--proposal-document-line-height",
        "--proposal-document-page-gap",
        "--proposal-document-reading-measure-max",
        "--proposal-document-title-scale",
        "--proposal-grid-half-step-block",
        "--proposal-grid-half-step-inline",
        "--proposal-grid-step-a-block",
        "--proposal-grid-step-a-inline",
        "--proposal-grid-step-b-block",
        "--proposal-grid-step-b-inline",
        "--proposal-inline-mm",
        "--proposal-page-height-mm",
        "--proposal-page-width-mm",
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
    expect(exportDescriptorNames).toContain("--proposal-document-accent-ink");
    expect(exportDescriptorNames).toContain("--proposal-joella-mark-color");
    expect(exportDescriptorNames).toContain(
      "--proposal-joella-structure-color",
    );

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

  it("emits curated Joella color pairs from the resolved proposal palette", () => {
    const namedJoellaPairs = [
      {
        palette: "cobalt",
        mark: "#DA291C",
        structure: "#74a0c5",
      },
      {
        palette: "terre",
        mark: "#a84e2e",
        structure: "#878f8d",
      },
      {
        palette: "sauge",
        mark: "#3b6e4e",
        structure: "#b06835",
      },
      {
        palette: "plum",
        mark: "#0f0c08",
        structure: "#6d3f78",
      },
      {
        palette: "ochre",
        mark: "#b8843a",
        structure: "#3b6e4e",
      },
    ] as const;

    for (const { palette, mark, structure } of namedJoellaPairs) {
      const style = resolveVerbatiStyle({
        layout: "workshop",
        typography: "expert",
        palette,
      });
      const previewVars = buildVerbatiProposalDocumentVars(style);
      const exportVars = serializeExportVars(
        normalizeProposalExportTokens({
          mode: "styled",
          proposalTemplateId: "joella-frame-letterhead",
          stylePreset: style,
        }).canonical,
      );

      expect(previewVars["--proposal-joella-mark-color"]).toBe(mark);
      expect(previewVars["--proposal-joella-structure-color"]).toBe(structure);
      expect(exportVars["--proposal-joella-mark-color"]).toBe(mark);
      expect(exportVars["--proposal-joella-structure-color"]).toBe(structure);
    }

    const customStyle = resolveVerbatiStyle({
      layout: "workshop",
      typography: "expert",
      palette: "custom",
      accentHex: "#aa7733",
    });
    const customVars = buildVerbatiProposalDocumentVars(customStyle);
    const customExportVars = serializeExportVars(
      normalizeProposalExportTokens({
        mode: "styled",
        proposalTemplateId: "joella-frame-letterhead",
        stylePreset: customStyle,
      }).canonical,
    );

    expect(customVars["--proposal-joella-mark-color"]).toBe(
      "color-mix(in srgb, var(--proposal-document-accent-ink) 82%, var(--proposal-document-ink) 18%)",
    );
    expect(customVars["--proposal-joella-structure-color"]).toBe(
      "color-mix(in srgb, var(--proposal-document-accent-ink) 62%, var(--proposal-document-paper) 38%)",
    );
    expect(customExportVars["--proposal-joella-mark-color"]).toBe(
      customVars["--proposal-joella-mark-color"],
    );
    expect(customExportVars["--proposal-joella-structure-color"]).toBe(
      customVars["--proposal-joella-structure-color"],
    );
  });

  it("serializes Letter geometry through resume and proposal token vars", () => {
    const resumeTokens = normalizeResumePreviewTokens({
      resumeTemplateId: "workshop_resume_onecol_ats",
      pageSize: DOCUMENT_PAGE_SIZES.letter,
    });
    const proposalTokens = normalizeProposalPreviewTokens({
      templateId: "two_column_rail",
      documentTypography: getProposalDocumentTypography("signature", null),
      pageSize: DOCUMENT_PAGE_SIZES.letter,
    });

    expect(serializeResumePreviewVars(resumeTokens)).toEqual(
      expect.objectContaining({
        "--page-width": "215.9mm",
        "--page-height": "279.4mm",
      }),
    );
    expect(serializeProposalPreviewVars(proposalTokens)).toEqual(
      expect.objectContaining({
        "--proposal-page-width-mm": "215.9",
        "--proposal-page-height-mm": "279.4",
      }),
    );
    expect(serializeExportVars(proposalTokens)).toEqual(
      expect.objectContaining({
        "--page-width": "215.9mm",
        "--page-height": "279.4mm",
      }),
    );
  });

  it("keeps the workshop proposal layout canonical across preview and export tokens", () => {
    const stylePreset = resolveVerbatiStyle({
      familyId: "workshop",
      layout: "workshop",
      typography: "expert",
      palette: "cobalt",
    });
    const documentTypography = getProposalDocumentTypography(
      "expert",
      stylePreset,
    );
    const previewTokens = normalizeProposalPreviewTokens({
      templateId: "workshop_proposal_margin",
      documentTypography,
      stylePreset,
    });
    const previewVars = serializeProposalPreviewVars(previewTokens);
    const exportProfile = normalizeProposalExportTokens({
      mode: "styled",
      proposalTemplateId: "workshop_proposal_margin",
      stylePreset,
    });
    const exportTokens = exportProfile.canonical;
    const exportVars = serializeExportVars(exportTokens);

    expect(previewTokens.geometry.template).toMatchObject({
      leftZoneMm: 17,
      topOffsetMm: 35,
      bodyStartMm: 86,
      rightMarginMm: 25.4,
      bottomMarginMm: 25.4,
    });
    expect(previewTokens.geometry.columns).toMatchObject({
      sidebarMm: 17,
      gutterMm: 18,
    });
    expect(previewTokens.geometry.primitives?.robialStep).toEqual({
      stepAMm: 17,
      stepBMm: 18,
      halfStepMm: 8.5,
    });
    expect(previewVars["--proposal-grid-step-a-inline"]).toBe(
      "calc(var(--proposal-inline-mm) * 17)",
    );
    expect(previewVars["--proposal-template-left-zone-mm"]).toBe("17");
    expect(previewVars["--font-heading-family"]).toBe(
      exportVars["--heading-font"],
    );
    expect(previewVars["--font-body-family"]).toBe(exportVars["--body-font"]);
    expect(previewVars["--heading-font"]).toBe(exportVars["--heading-font"]);
    expect(previewVars["--body-font"]).toBe(exportVars["--body-font"]);

    const mixedFontStylePreset = resolveVerbatiStyle({
      familyId: "workshop",
      layout: "workshop",
      typography: "ledger-sans",
      palette: "terre",
    });
    const mixedPreviewVars = serializeProposalPreviewVars(
      normalizeProposalPreviewTokens({
        templateId: "workshop_proposal_margin",
        documentTypography: getProposalDocumentTypography(
          "ledger-sans",
          mixedFontStylePreset,
        ),
        stylePreset: mixedFontStylePreset,
      }),
    );
    expect(mixedPreviewVars["--heading-font"]).not.toBe(
      mixedPreviewVars["--body-font"],
    );

    expect(exportProfile.shell).toBe("onecol");
    expect(exportTokens.geometry.page.margin.leftMm).toBe(25.4);
    expect(exportTokens.geometry.page.margin.rightMm).toBe(25.4);
    expect(exportTokens.geometry.template).toEqual(
      previewTokens.geometry.template,
    );
    expect(exportTokens.geometry.primitives?.robialStep).toEqual(
      previewTokens.geometry.primitives?.robialStep,
    );
    expect(exportVars["--page-margin-left"]).toBe("25.4mm");
    expect(exportVars["--robial-step-a"]).toBe("17mm");
    expect(exportVars["--robial-step-b"]).toBe("18mm");
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
    expect(previewVars["--display-size-adjust"]).toBe("0mm");
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
    const resumePreviewTokens = normalizeResumePreviewTokens({
      resumeTemplateId: "two_column_resume_legacy",
      stylePreset,
    });
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
    expect(docxTokens.pageSizeTwip).toEqual({
      width: mmToTwip(exportTokens.geometry.page.widthMm),
      height: mmToTwip(exportTokens.geometry.page.heightMm),
    });
    expect(docxTokens.compactGapTwip).toBe(
      mmToTwip(exportTokens.flow.rhythm.listGapMm ?? 1.3),
    );
    expect(docxTokens.subjectSizeHalfPt).toBeGreaterThan(
      docxTokens.bodySizeHalfPt,
    );
  });

  it.each([
    {
      templateId: "director-letterhead" as const,
      leftMm: 25,
      rightMm: 25,
      bodyStartMm: 118,
    },
    {
      templateId: "volk-letterhead" as const,
      leftMm: 24,
      rightMm: 26,
      bodyStartMm: 122,
    },
    {
      templateId: "film-foto-letterhead" as const,
      leftMm: 20,
      rightMm: 22,
      bodyStartMm: 120,
    },
  ])(
    "derives $templateId preview, export, and DOCX geometry from proposal tokens",
    ({ templateId, leftMm, rightMm, bodyStartMm }) => {
      const stylePreset = resolveVerbatiStyle({
        familyId: "workshop",
        layout: "workshop",
        typography: "expert",
        palette: "terre",
      });
      const previewTokens = normalizeProposalPreviewTokens({
        templateId,
        documentTypography: getProposalDocumentTypography(
          "expert",
          stylePreset,
        ),
        stylePreset,
      });
      const exportProfile = normalizeProposalExportTokens({
        mode: "styled",
        proposalTemplateId: templateId,
        stylePreset,
      });
      const exportVars = serializeExportVars(exportProfile.canonical);
      const docxTokens = resolveProposalDocxSurfaceTokens(
        exportProfile.canonical,
      );

      expect(previewTokens.geometry.page.widthMm).toBe(210);
      expect(previewTokens.geometry.page.heightMm).toBe(297);
      expect(previewTokens.geometry.page.margin.leftMm).toBe(leftMm);
      expect(previewTokens.geometry.page.margin.rightMm).toBe(rightMm);
      expect(previewTokens.geometry.template?.bodyStartMm).toBe(bodyStartMm);
      expect(exportProfile.shell).toBe("onecol");
      expect(exportProfile.canonical.geometry.template).toEqual(
        previewTokens.geometry.template,
      );
      expect(exportVars["--page-width"]).toBe("210mm");
      expect(exportVars["--page-height"]).toBe("297mm");
      expect(docxTokens.pageMarginsTwip.left).toBe(
        mmToTwip(exportProfile.canonical.geometry.page.margin.leftMm),
      );
      expect(docxTokens.pageMarginsTwip.right).toBe(
        mmToTwip(exportProfile.canonical.geometry.page.margin.rightMm),
      );
    },
  );
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
  expect(previewTokens.flow.component.experience?.headingSizeAdjustMm).toBe(
    0.2,
  );
  expect(previewTokens.flow.component.experience?.headingLineHeight).toBe(1.25);
  expect(previewTokens.flow.pagination.bottomFitSafetyMm).toBe(0.5);
  expect(previewVars["--sidebar-width"]).toBe("0mm");
  expect(previewVars["--margin-left"]).toBe("18mm");
  expect(previewVars["--header-summary-width"]).toBe("120mm");
  expect(previewVars["--workshop-section-title-reduction"]).toBe("0.95mm");
  expect(previewVars["--workshop-experience-heading-size-adjust"]).toBe(
    "0.2mm",
  );
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
