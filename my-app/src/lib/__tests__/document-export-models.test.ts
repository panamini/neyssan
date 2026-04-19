import { describe, expect, it } from "vitest";

import { resumeMock } from "../../features/verbati/resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { generateCvTemplate } from "../cv-template";
import {
  buildResumeExportSource,
  buildProposalPreviewPrintSource,
  buildProposalPrintDebugSnapshot,
  buildProposalPrintRoutePayload,
  buildResumePrintDebugSnapshot,
  buildResumePrintRoutePayload,
  buildStyledResumePrintSource,
  type ProposalPreviewPrintSource,
  type ResumePreviewPrintSource,
} from "../document-export-models";

describe("document-export-models", () => {
  it("captures the live style preset in the styled resume print source", () => {
    const source = buildStyledResumePrintSource({
      currentCv: generateCvTemplate("Styled CV"),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "swiss",
        typography: "mono-signal",
      },
    });

    expect(source).toEqual(
      expect.objectContaining({
        renderSource: "preview",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "mono-signal",
        }),
        rendererVariantId: "swissminima",
        resumeTemplateId: "swiss_resume_legacy",
      }),
    );
  });

  it("resolves the exact workshop resume template id for preview and export sources", () => {
    const currentCv = generateCvTemplate("Workshop CV");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    };

    const previewSource = buildStyledResumePrintSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const exportSource = buildResumeExportSource({ currentCv });

    expect(previewSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");
    expect(previewSource?.rendererVariantId).toBe("swissminima");
    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");
  });

  it("builds a preview-aligned print route payload for styled resume PDF", () => {
    const previewSource: ResumePreviewPrintSource = {
      schemaVersion: 1,
      kind: "resume",
      renderSource: "preview",
      locale: "en",
      resumeData: resumeMock,
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
      },
      resumeTemplateId: "two_column_resume_legacy",
      rendererVariantId: "robial",
    };

    const payload = buildResumePrintRoutePayload({ data: previewSource });

    expect(payload.kind).toBe("resume_print_route");
    expect(payload.resumeData).toEqual(resumeMock);
    expect(payload.stylePreset.layout).toBe("two-column");
    expect(payload.resumeTemplateId).toBe("two_column_resume_legacy");
    expect(payload.rendererVariantId).toBe("robial");
  });

  it("derives a stable debug snapshot from the active print style inputs", () => {
    const snapshot = buildResumePrintDebugSnapshot({
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "swiss",
        typography: "mono-signal",
      },
      rendererVariantId: "swissminima",
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        layout: "swiss",
        typography: "mono-signal",
        rendererVariantId: "swissminima",
        headingFontFamily: expect.stringContaining("Archivo"),
        bodyFontFamily: expect.stringContaining("Archivo"),
      }),
    );
  });

  it("builds a preview-aligned print source for styled proposal PDF", () => {
    const source = buildProposalPreviewPrintSource({
      content:
        "Dear Hiring Manager,\n\nI bring proposal operations and delivery leadership across legal and product teams.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      voicePreset: "signature",
      railTitle: "Alex Martin",
      railMeta: "Operations Lead",
      contactLine: "alex@example.com · +33 6 00 00 00 00",
      letterDate: "Paris, April 16, 2026",
      recipientDetails: "Hiring Manager\nStudio North",
      documentTitle: "Proposal",
      documentMeta: "alex@example.com",
      applicantHeader: {
        name: "Alex Martin",
        role: "Operations Lead",
        email: "alex@example.com",
      },
      templateId: "two_column_rail",
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
        typography: "mono-signal",
      },
    });

    expect(source).toEqual(
      expect.objectContaining({
        renderSource: "preview",
        templateId: "two_column_rail",
        stylePreset: expect.objectContaining({
          layout: "swiss",
          typography: "mono-signal",
        }),
      }),
    );
  });

  it("builds a proposal print route payload that preserves preview state", () => {
    const previewSource: ProposalPreviewPrintSource = {
      schemaVersion: 1,
      kind: "proposal",
      renderSource: "preview",
      locale: "en",
      content: "Dear team,\n\nProposal body.\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      voicePreset: "signature",
      railTitle: "Alex Martin",
      railMeta: "Operations Lead",
      contactLine: "alex@example.com",
      letterDate: "Paris, April 16, 2026",
      recipientDetails: "Hiring Manager",
      documentTitle: "Proposal",
      documentMeta: "alex@example.com",
      applicantHeader: {
        name: "Alex Martin",
        role: "Operations Lead",
        email: "alex@example.com",
        phone: "",
        linkedin: "",
        website: "",
        location: "",
        tag: "",
      },
      headerVisibility: {
        showSender: true,
        showDate: true,
        showRecipient: true,
        showRecipientDetails: true,
        showSubject: true,
      },
      templateId: "two_column_rail",
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
        typography: "quiet-editorial",
      },
    };

    const payload = buildProposalPrintRoutePayload({ data: previewSource });

    expect(payload.kind).toBe("proposal_print_route");
    expect(payload.templateId).toBe("two_column_rail");
    expect(payload.stylePreset.typography).toBe("quiet-editorial");
    expect(payload.content).toContain("Proposal body.");
  });

  it("derives a stable proposal debug snapshot from the active print style inputs", () => {
    const snapshot = buildProposalPrintDebugSnapshot({
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "two-column",
        typography: "mono-signal",
      },
      templateId: "two_column_rail",
      voicePreset: "signature",
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        layout: "swiss",
        typography: "mono-signal",
        templateId: "two_column_rail",
        bodyFontFamily: expect.stringContaining("Archivo"),
      }),
    );
  });
});
