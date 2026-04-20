import { describe, expect, it } from "vitest";

import { resumeMock } from "../../features/verbati/resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import { generateCvTemplate } from "../cv-template";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { planWorkshopResumePages } from "../resume/resumePagination";
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
    expect(previewSource?.committedPages).toEqual(expect.any(Array));
    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");
  });

  it("serializes committed workshop planner pages into the export source", () => {
    const currentCv = generateCvTemplate("Workshop export parity");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    };
    const experienceSection = currentCv.sections.find(
      (section) => section.type === "experience",
    );
    if (experienceSection?.structuredContent && Array.isArray(experienceSection.structuredContent)) {
      experienceSection.structuredContent = Array.from({ length: 6 }, (_, index) => ({
        ...(experienceSection.structuredContent[0] ?? {
          id: `exp-${index + 1}`,
          company: "",
          position: "",
          startDate: "2024-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          achievements: [],
        }),
        id: `exp-${index + 1}`,
        company: `Northline ${index + 1}`,
        position: `Operations Lead ${index + 1}`,
        startDate: "2024-01-01T00:00:00.000Z",
        isCurrent: false,
        currentlyWorking: false,
        responsibilities: `Committed responsibility ${index + 1}\nCommitted follow-up ${index + 1}`,
        achievements: [],
      }));
    }

    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const canonical = buildCanonicalResumeRenderModelFromCv(currentCv);
    const directPlan = planWorkshopResumePages({
      data: canonical,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
    });

    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");
    expect(exportSource?.committedPages).toHaveLength(directPlan.pageCount);
    expect(exportSource?.committedPages[0]?.fragments[0]).toEqual(
      expect.objectContaining({
        kind: "profile",
        sectionType: "profile",
      }),
    );
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
    expect(payload.committedPages).toBeUndefined();
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
