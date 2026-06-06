import { describe, expect, it } from "vitest";

import { resumeMock } from "../../features/verbati/resume/resume.mock";
import { DEFAULT_VERBATI_STYLE } from "../../features/verbati/style";
import { buildCanonicalResumeRenderModelFromCv } from "../buildCanonicalResumeRenderModel";
import { generateCvTemplate } from "../cv-template";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { planWorkshopResumePages } from "../resume/resumePagination";
import {
  buildProposalExportSource,
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
  it("defaults active resume and proposal export sources to A4 page geometry", () => {
    const currentCv = generateCvTemplate("Default A4 CV");
    const resumeSource = buildStyledResumePrintSource({ currentCv });
    const proposalSource = buildProposalPreviewPrintSource({
      content: "Dear team,\n\nProposal body.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      railTitle: "Alex Martin",
      railMeta: "Operations Lead",
      contactLine: "alex@example.com",
      letterDate: "Paris, April 16, 2026",
      recipientDetails: "Hiring Manager",
      documentTitle: "Proposal",
      documentMeta: "alex@example.com",
      applicantHeader: null,
    });

    expect(resumeSource?.pageSize).toEqual(
      expect.objectContaining({
        id: "a4",
        widthMm: 210,
        heightMm: 297,
      }),
    );
    expect(proposalSource.pageSize).toEqual(
      expect.objectContaining({
        id: "a4",
        widthMm: 210,
        heightMm: 297,
      }),
    );
  });

  it("carries explicit Letter page geometry through preview print payloads", () => {
    const currentCv = generateCvTemplate("Letter CV");
    const resumeSource = buildStyledResumePrintSource({
      currentCv,
      pageSizePreference: "letter",
    });
    if (!resumeSource) {
      throw new Error("Expected resume preview source.");
    }

    const resumePayload = buildResumePrintRoutePayload({ data: resumeSource });
    const proposalSource = buildProposalPreviewPrintSource({
      content: "Dear team,\n\nProposal body.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      railTitle: "Alex Martin",
      railMeta: "Operations Lead",
      contactLine: "alex@example.com",
      letterDate: "Paris, April 16, 2026",
      recipientDetails: "Hiring Manager",
      documentTitle: "Proposal",
      documentMeta: "alex@example.com",
      applicantHeader: null,
      pageSizePreference: "letter",
    });
    const proposalPayload = buildProposalPrintRoutePayload({
      data: proposalSource,
    });

    expect(resumeSource.pageSize).toEqual(
      expect.objectContaining({
        id: "letter",
        widthMm: 215.9,
        heightMm: 279.4,
      }),
    );
    expect(resumePayload.pageSize).toEqual(resumeSource.pageSize);
    expect(proposalSource.pageSize).toEqual(
      expect.objectContaining({
        id: "letter",
        widthMm: 215.9,
        heightMm: 279.4,
      }),
    );
    expect(proposalPayload.pageSize).toEqual(proposalSource.pageSize);
  });

  it("preserves supported document locales on resume export sources and falls back for unsupported locales", () => {
    const supportedLocales = ["en", "fr", "ar", "ru", "ga"] as const;

    for (const locale of supportedLocales) {
      const currentCv = generateCvTemplate(`${locale} CV`);
      currentCv.metadata.locale = locale;

      expect(
        buildStyledResumePrintSource({ currentCv })?.locale,
      ).toBe(locale);
      expect(buildResumeExportSource({ currentCv })?.locale).toBe(locale);
    }

    const unsupportedCv = generateCvTemplate("Unsupported locale CV");
    unsupportedCv.metadata.locale = "zz";

    expect(
      buildStyledResumePrintSource({ currentCv: unsupportedCv })?.locale,
    ).toBeNull();
    expect(buildResumeExportSource({ currentCv: unsupportedCv })?.locale).toBeNull();
  });

  it("captures the live style preset in the styled resume print source", () => {
    const source = buildStyledResumePrintSource({
      currentCv: generateCvTemplate("Styled CV"),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        typography: "mono-signal",
      },
    });

    expect(source).toEqual(
      expect.objectContaining({
        renderSource: "preview",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "mono-signal",
        }),
        rendererVariantId: "swissminima",
        resumeTemplateId: "workshop_resume_onecol_ats",
      }),
    );
  });

  it("preserves the editorial sidebar template id in styled resume print sources", () => {
    const source = buildStyledResumePrintSource({
      currentCv: generateCvTemplate("Editorial sidebar CV"),
      stylePreset: {
        ...DEFAULT_VERBATI_STYLE,
        layout: "workshop",
        familyId: "workshop",
        typography: "quiet-editorial",
        resumeTemplateId: "editorial-sidebar",
      },
    });

    expect(source).toEqual(
      expect.objectContaining({
        stylePreset: expect.objectContaining({
          resumeTemplateId: "editorial-sidebar",
        }),
        rendererVariantId: "editorialsidebar",
        resumeTemplateId: "editorial-sidebar",
      }),
    );
  });

  it("carries resume document icon settings through styled print payloads", () => {
    const currentCv = generateCvTemplate("Icon CV");
    currentCv.metadata.documentIcons = {
      defaultListMarkerKey: "dot",
      sectionHeadingIconMode: "auto",
      sectionIconMap: {},
      color: "muted",
      sizePt: 10,
    };

    const source = buildStyledResumePrintSource({ currentCv });
    if (!source) {
      throw new Error("Expected styled resume print source.");
    }

    const payload = buildResumePrintRoutePayload({ data: source });

    expect(source.documentIconSettings).toEqual(
      expect.objectContaining({
        sectionHeadingIconMode: "auto",
        color: "muted",
        sizePt: 10,
      }),
    );
    expect(payload.documentIconSettings).toEqual(source.documentIconSettings);
  });

  it("recovers styled resume print sources from slot-only CV metadata", () => {
    const currentCv = generateCvTemplate("Slot-only styled CV");
    currentCv.metadata.verbatiStyle = undefined;
    currentCv.metadata.verbatiStyleSlotId = 2;
    currentCv.metadata.verbatiStyleSlotSource = "factory";
    currentCv.metadata.documentStyleVersion = 1;

    const previewSource = buildStyledResumePrintSource({ currentCv });
    const exportSource = buildResumeExportSource({ currentCv });

    expect(previewSource).toEqual(
      expect.objectContaining({
        renderSource: "preview",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "ink",
        }),
        resumeTemplateId: "workshop_resume_twocol_ats",
      }),
    );
    expect(exportSource).toEqual(
      expect.objectContaining({
        resumeTemplateId: "workshop_resume_twocol_ats",
        committedPages: expect.any(Array),
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

  it("preserves explicit two-column workshop template id and committed pages", () => {
    const currentCv = generateCvTemplate("Workshop two-column CV");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
      resumeTemplateId: "workshop_resume_twocol_ats",
    };

    const previewSource = buildStyledResumePrintSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const exportSource = buildResumeExportSource({ currentCv });

    expect(previewSource?.resumeTemplateId).toBe("workshop_resume_twocol_ats");
    expect(previewSource?.committedPages).toEqual(expect.any(Array));
    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_twocol_ats");
    expect(exportSource?.committedPages).toEqual(expect.any(Array));
    expect(exportSource).toEqual(
      expect.objectContaining({
        certifications: expect.any(Array),
        affiliations: expect.any(Array),
        additionalInformation: expect.any(Array),
      }),
    );
  });

  it("defaults Maggie Letter styled resume print and export sources to Letter with committed pages", () => {
    const currentCv = generateCvTemplate("Maggie Letter CV");
    currentCv.metadata.verbatiStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "ledger-sans",
      palette: "sauge",
      resumeTemplateId: "maggie_letter_resume",
    };

    const previewSource = buildStyledResumePrintSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });

    expect(previewSource).toEqual(
      expect.objectContaining({
        resumeTemplateId: "maggie_letter_resume",
        committedPages: expect.any(Array),
        pageSize: expect.objectContaining({ id: "letter" }),
      }),
    );
    expect(exportSource).toEqual(
      expect.objectContaining({
        resumeTemplateId: "maggie_letter_resume",
        committedPages: expect.any(Array),
        pageSize: expect.objectContaining({ id: "letter" }),
      }),
    );
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
        typography: "mono-signal",
      },
      rendererVariantId: "swissminima",
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        layout: "workshop",
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
        typography: "mono-signal",
      },
    });

    expect(source).toEqual(
      expect.objectContaining({
        renderSource: "preview",
        templateId: "two_column_rail",
        stylePreset: expect.objectContaining({
          layout: "workshop",
          typography: "mono-signal",
        }),
      }),
    );
  });

  it("preserves explicit proposal export locales before falling back to content inference", () => {
    const englishContent =
      "Dear Hiring Manager,\n\nI bring proposal operations and delivery leadership.\n\nKind regards,\nAlex Martin";
    const frenchContent =
      "Bonjour,\n\nJe construis des systèmes éditoriaux fiables.\n\nCordialement,\nAlex Martin";

    expect(
      buildProposalPreviewPrintSource({
        content: englishContent,
        proposalType: "cover_letter",
        voicePreset: "signature",
        railTitle: "Alex Martin",
        railMeta: "Operations Lead",
        contactLine: "alex@example.com",
        letterDate: "Paris, April 16, 2026",
        recipientDetails: "Hiring Manager",
        documentTitle: "Proposal",
        documentMeta: "alex@example.com",
        applicantHeader: null,
        locale: "ar",
      }).locale,
    ).toBe("ar");

    expect(
      buildProposalExportSource({
        content: englishContent,
        proposalType: "cover_letter",
        documentTitle: "Proposal",
        documentMeta: "alex@example.com",
        contactLine: "alex@example.com",
        letterDate: "Paris, April 16, 2026",
        recipientDetails: "Hiring Manager",
        applicantHeader: null,
        locale: "ru",
      }).locale,
    ).toBe("ru");

    expect(
      buildProposalExportSource({
        content: englishContent,
        proposalType: "cover_letter",
        documentTitle: "Proposal",
        documentMeta: "",
        contactLine: "",
        letterDate: "",
        recipientDetails: "",
        applicantHeader: null,
        locale: "ga",
      }).locale,
    ).toBe("ga");

    expect(
      buildProposalPreviewPrintSource({
        content: frenchContent,
        proposalType: "cover_letter",
        voicePreset: "signature",
        railTitle: "Alex Martin",
        railMeta: "Operations Lead",
        contactLine: "alex@example.com",
        letterDate: "Paris, April 16, 2026",
        recipientDetails: "Hiring Manager",
        documentTitle: "Proposal",
        documentMeta: "alex@example.com",
        applicantHeader: null,
        locale: "zz",
      }).locale,
    ).toBe("fr");

    expect(
      buildProposalExportSource({
        content: frenchContent,
        proposalType: "cover_letter",
        documentTitle: "Proposition",
        documentMeta: "",
        contactLine: "",
        letterDate: "",
        recipientDetails: "",
        applicantHeader: null,
      }).locale,
    ).toBe("fr");
  });

  it("parses proposal bullet-like lines into export list blocks", () => {
    const source = buildProposalExportSource({
      content:
        "Dear Hiring Team,\n\n- Audit the current flow\n- Ship inline SVG markers\n\nKind regards,\nAlex Martin",
      proposalType: "cover_letter",
      documentTitle: "Proposal",
      documentMeta: "",
      contactLine: "",
      letterDate: "",
      recipientDetails: "Hiring Team",
      applicantHeader: null,
      documentIconSettings: {
        defaultListMarkerKey: "asterisk-simple",
        sectionHeadingIconMode: "none",
        sectionIconMap: {},
        color: "accent",
        sizePt: 12,
      },
    });

    expect(source.documentIconSettings?.defaultListMarkerKey).toBe(
      "asterisk-simple",
    );
    expect(source.body).toEqual([
      { type: "salutation", text: "Dear Hiring Team," },
      {
        type: "list",
        marker: { type: "dash" },
        items: [
          { text: "Audit the current flow", marker: { type: "dash" } },
          { text: "Ship inline SVG markers", marker: { type: "dash" } },
        ],
      },
      {
        type: "closing",
        signOff: "Kind regards,",
        signatureName: "Alex Martin",
      },
    ]);
  });

  it("preserves structured proposal list item icons in export blocks", () => {
    const source = buildProposalExportSource({
      content: "Dear Hiring Team,\n\n- First item\n- Second item",
      proposalDocument: {
        schemaVersion: 1,
        kind: "letter",
        source: "structured",
        blocks: [
          {
            id: "list",
            type: "list",
            marker: { type: "dash" },
            items: [
              {
                id: "item-1",
                text: "First item",
                iconKey: "star",
                marker: { type: "dash" },
              },
              {
                id: "item-2",
                text: "Second item",
                marker: { type: "dash" },
              },
            ],
          },
        ],
      },
      proposalType: "cover_letter",
      documentTitle: "Proposal",
      documentMeta: "",
      contactLine: "",
      letterDate: "",
      recipientDetails: "",
      applicantHeader: null,
    });

    expect(source.body).toEqual([
      {
        type: "list",
        marker: { type: "dash" },
        items: [
          {
            text: "First item",
            iconKey: "star",
            marker: { type: "dash" },
          },
          { text: "Second item", marker: { type: "dash" } },
        ],
      },
    ]);
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
        typography: "mono-signal",
      },
      templateId: "two_column_rail",
      voicePreset: "signature",
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        layout: "workshop",
        typography: "mono-signal",
        templateId: "two_column_rail",
        bodyFontFamily: expect.stringContaining("Archivo"),
      }),
    );
  });
});
