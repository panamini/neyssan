import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { generateCvTemplate } from "../cv-template";
import type {
  ProposalPrintSource,
  ResumePrintSource,
} from "../document-export-models";
import { buildResumeExportSource } from "../document-export-models";
import {
  buildProposalDocxBuffer,
  buildResumeDocxBuffer,
  renderProposalAtsExportDocument,
  renderProposalStyledExportDocument,
  renderResumeAtsExportDocument,
  renderResumeStyledExportDocument,
} from "../export-renderers";
import { planWorkshopResumePages } from "../resume/resumePagination";
import { getResumeTemplateDefinition } from "../layout/resumeTemplates";
import { resumeMock } from "../../features/verbati/resume/resume.mock";

function parseExportHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function makeDenseTokenBlock(token: string, usefulLines: number) {
  return token.repeat(usefulLines * 70);
}

function getDataBlockOrder(document: Document): string[] {
  return Array.from(document.querySelectorAll("[data-block]"))
    .map((node) => node.getAttribute("data-block"))
    .filter((value): value is string => Boolean(value));
}

function getInlineStyles(document: Document): string {
  return document.querySelector("style")?.textContent ?? "";
}

const resumeFixture: ResumePrintSource = {
  schemaVersion: 1,
  kind: "resume",
  locale: "en",
  title: "Alex Mercer Resume",
  exportSource: "standard",
  profile: {
    name: "Alexandria Mercer-Delacroix",
    title: "Senior Product Design Systems and Content Operations Lead",
    summary:
      "Builds resilient document systems, export flows, and design language across product, content, and operations teams.",
  },
  contact: [
    { label: "Email", value: "alexandria.mercer.delacroix@example.com" },
    {
      label: "Website",
      value: "https://portfolio.example.com/alexandria-mercer-delacroix",
    },
  ],
  metadata: [{ label: "Location", value: "Paris, France" }],
  skills: [
    "Design systems governance",
    "Structured export quality",
    "Editorial workflow operations",
  ],
  languages: [{ name: "French", level: "Native" }],
  experience: [
    {
      role: "Lead Design Systems and Documentation Operations Partner",
      company: "North Atlantic Product Infrastructure Studio",
      period: "2021 - Present",
      location: "Paris / Remote",
      summary:
        "Owns export quality, shared tokens, and release documentation across multiple client-facing systems.",
      bullets: [
        "Built shared tokens for document rendering, structured export, and ATS-safe output.",
        "Reduced document QA churn by formalizing print-specific hierarchy and spacing rules.",
      ],
    },
  ],
  projects: [
    {
      name: "Cross-language export typography",
      meta: "2025",
      description:
        "Defined locale-safe punctuation and formatting rules for French and English exports.",
    },
  ],
  education: [
    {
      degree: "Master of Information Design",
      school: "École Supérieure des Arts Visuels",
      period: "2017 - 2019",
    },
  ],
  achievements: [
    "Created a shared export contract used across ATS and styled outputs.",
  ],
  hobbies: ["Book design", "Editorial systems"],
};

const proposalFixture: ProposalPrintSource = {
  schemaVersion: 1,
  kind: "proposal",
  locale: "fr",
  title: "Candidature",
  proposalType: "cover_letter",
  documentTitle: 'Candidature "Produit" 1.5 mm',
  documentMeta: "Paris : interface ; systèmes !",
  contactLine: "alex@example.com : +33 6 00 00 00 00",
  letterDate: "15 avril 2026 !",
  recipientDetails: 'Studio Nord : Paris\n"Équipe produit"',
  applicantHeader: {
    name: "Alex Mercer",
    role: "Designer de systèmes",
    email: "alex@example.com",
    phone: "+33 6 00 00 00 00",
    linkedin: "",
    website: "portfolio.example.com",
    location: "Paris",
    tag: "",
  },
  headerVisibility: {
    showSender: true,
    showDate: true,
    showRecipient: true,
    showRecipientDetails: true,
    showSubject: true,
  },
  templateId: "swiss_margin",
  body: [
    {
      type: "salutation",
      text: "Bonjour !",
    },
    {
      type: "paragraph",
      text: 'Je construis des systèmes "éditoriaux" robustes pour des exports fiables.',
    },
    {
      type: "closing",
      signOff: "Cordialement !",
      signatureName: "Alex Mercer",
    },
  ],
};

describe("export-renderers", () => {
  it("renders ATS as the protected one-column baseline and styled resume export as the Robial split baseline", () => {
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(resumeFixture, {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      }),
    );
    const swissStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );
    const normalizedStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "editorial",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );

    const atsCss = getInlineStyles(atsDocument);
    const swissCss = getInlineStyles(swissStyledDocument);
    const normalizedStyledCss = getInlineStyles(normalizedStyledDocument);

    expect(atsDocument.body.className).toContain("resume-shell--onecol");
    expect(atsDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(atsDocument.querySelector(".export-header")).toBeTruthy();
    expect(atsCss).toContain("--heading-font: Fraunces");
    expect(atsCss).toContain("--body-font: Syne");
    expect(atsCss).toContain("--flow-reading-measure: 112mm;");
    expect(atsCss).not.toContain("body.resume-export.resume--styled .robial-sidebar");

    expect(swissStyledDocument.body.className).toContain("resume-layout--swiss");
    expect(swissStyledDocument.body.className).toContain("resume-shell--split");
    expect(swissStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(swissCss).toContain("--page-sidebar: 35mm;");
    expect(swissCss).toContain("--page-gutter: 18mm;");

    expect(normalizedStyledDocument.body.className).toContain(
      "resume-layout--editorial",
    );
    expect(normalizedStyledDocument.body.className).toContain(
      "resume-shell--split",
    );
    expect(normalizedStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(normalizedStyledDocument.querySelector(".resume-main-stack")).toBeTruthy();
    expect(
      normalizedStyledDocument.querySelector(".resume-styled-page"),
    ).toBeNull();
    expect(normalizedStyledCss).toContain("--flow-reading-measure: 105mm;");
    expect(normalizedStyledCss).toContain("--page-sidebar: 35mm;");
    expect(normalizedStyledCss).toContain("--page-gutter: 18mm;");
  });

  it("normalizes deferred styled layouts onto the protected Robial split export baseline", () => {
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(resumeFixture, {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      }),
    );
    const modernistStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "modernist",
          typography: "quiet-editorial",
          palette: "encre",
        },
      }),
    );
    const quireStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "quire",
          typography: "quiet-editorial",
          palette: "ocre",
        },
      }),
    );
    const editorialStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "editorial",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );
    const swissStyledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: resumeFixture,
        stylePreset: {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "pierre",
        },
      }),
    );

    expect(atsDocument.body.className).toContain("resume-shell--onecol");
    expect(atsDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(atsDocument.querySelector(".export-header")).toBeTruthy();

    expect(modernistStyledDocument.body.className).toContain("resume-shell--split");
    expect(modernistStyledDocument.body.className).toContain("resume-layout--modernist");
    expect(modernistStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(modernistStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(
      modernistStyledDocument.querySelector(".section--projects .entry--project"),
    ).toBeTruthy();

    expect(quireStyledDocument.body.className).toContain("resume-shell--split");
    expect(quireStyledDocument.body.className).toContain("resume-layout--quire");
    expect(quireStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(quireStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(quireStyledDocument.querySelector(".resume-main-stack")).toBeTruthy();

    expect(editorialStyledDocument.body.className).toContain("resume-shell--split");
    expect(editorialStyledDocument.body.className).toContain("resume-layout--editorial");
    expect(editorialStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(editorialStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();

    expect(swissStyledDocument.body.className).toContain("resume-shell--split");
    expect(swissStyledDocument.querySelector(".resume-styled-page")).toBeNull();
    expect(swissStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
  });

  it("renders proposal ATS as a one-column export and styled templates as Robial-safe structural variants", () => {
    const atsDocument = parseExportHtml(
      renderProposalAtsExportDocument(proposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );
    const railStyledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "two_column_rail",
        },
        stylePreset: {
          layout: "two-column",
          typography: "ledger-sans",
          palette: "encre",
        },
      }),
    );
    const quireStyledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: {
          ...proposalFixture,
          templateId: "quire_margin",
        },
        stylePreset: {
          layout: "quire",
          typography: "quiet-editorial",
          palette: "ocre",
        },
      }),
    );

    const atsCss = getInlineStyles(atsDocument);
    const railCss = getInlineStyles(railStyledDocument);
    const quireCss = getInlineStyles(quireStyledDocument);

    expect(atsDocument.documentElement.lang).toBe("fr");
    expect(atsDocument.body.className).toContain("proposal-shell--onecol");
    expect(atsDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(atsCss).toContain("--heading-font: Fraunces");
    expect(atsCss).toContain("--body-font: Syne");
    expect(atsDocument.body.innerHTML).toContain("«&nbsp;Produit&nbsp;»");
    expect(atsDocument.body.innerHTML).toContain("1,5&nbsp;mm");
    expect(
      atsDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("Alex Mercer");

    expect(railStyledDocument.body.className).toContain(
      "proposal-template--two-column-rail",
    );
    expect(railStyledDocument.body.className).toContain("proposal-shell--rail");
    expect(railStyledDocument.querySelector(".robial-sidebar")).toBeTruthy();
    expect(railCss).toContain('--heading-font: "Special Elite"');
    expect(railCss).toContain('--body-font: "Courier Prime"');
    expect(railCss).toContain("--decor-subject-shadow:");

    expect(quireStyledDocument.body.className).toContain(
      "proposal-template--quire-margin",
    );
    expect(quireStyledDocument.body.className).toContain(
      "proposal-shell--onecol",
    );
    expect(quireStyledDocument.querySelector(".robial-sidebar")).toBeNull();
    expect(quireCss).toContain("--flow-reading-measure:");
    expect(quireCss).toContain(
      ".proposal-signature {\n      margin-top: var(--flow-closing-name-gap);\n      font-weight: var(--decor-signature-font-weight, 700);\n      text-transform: var(--decor-signature-text-transform, none);\n      font-variant-caps: var(--decor-signature-font-variant-caps, normal);\n      letter-spacing: var(--decor-signature-letter-spacing, normal);",
    );
    expect(quireCss).toContain("--decor-proposal-title-font-style: italic;");
    expect(quireCss).toContain("--decor-proposal-title-letter-spacing: -0.015em;");
    expect(quireCss).toContain("--decor-signature-font-variant-caps: normal;");
  });

  it("keeps ATS and styled proposal closing blocks structurally aligned and casing-safe", () => {
    const atsDocument = parseExportHtml(
      renderProposalAtsExportDocument(proposalFixture, {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      }),
    );
    const styledDocument = parseExportHtml(
      renderProposalStyledExportDocument({
        data: proposalFixture,
        stylePreset: {
          layout: "modernist",
          typography: "quiet-editorial",
          palette: "encre",
        },
      }),
    );

    expect(getDataBlockOrder(styledDocument)).toEqual(getDataBlockOrder(atsDocument));
    expect(
      atsDocument.querySelector('[data-block="closing"] .proposal-signoff')
        ?.textContent,
    ).toBe("Cordialement !");
    expect(
      styledDocument.querySelector('[data-block="closing"] .proposal-signature')
        ?.textContent,
    ).toBe("Alex Mercer");
    expect(getInlineStyles(styledDocument)).toContain(
      "--decor-signature-color: var(--ink);",
    );
  });

  it("builds resume and proposal DOCX exports as editable one-column documents with selected fonts", async () => {
    const resumeBuffer = await buildResumeDocxBuffer({
      data: resumeFixture,
      stylePreset: {
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      },
    });
    const proposalBuffer = await buildProposalDocxBuffer({
      data: proposalFixture,
      stylePreset: {
        layout: "swiss",
        typography: "quiet-editorial",
        palette: "sauge",
      },
    });

    const resumeArchive = await JSZip.loadAsync(resumeBuffer);
    const proposalArchive = await JSZip.loadAsync(proposalBuffer);
    const resumeDocumentXml =
      (await resumeArchive.file("word/document.xml")?.async("string")) ?? "";
    const resumeStylesXml =
      (await resumeArchive.file("word/styles.xml")?.async("string")) ?? "";
    const proposalDocumentXml =
      (await proposalArchive.file("word/document.xml")?.async("string")) ?? "";
    const proposalStylesXml =
      (await proposalArchive.file("word/styles.xml")?.async("string")) ?? "";

    expect(resumeDocumentXml).toContain("Alexandria Mercer-Delacroix");
    expect(resumeDocumentXml).toContain("Senior Product Design Systems and Content Operations Lead");
    expect(resumeDocumentXml).not.toContain("w:cols");
    expect(resumeDocumentXml).toContain("Fraunces");
    expect(resumeStylesXml).toContain("Syne");

    expect(proposalDocumentXml).toContain("Objet");
    expect(proposalDocumentXml).toContain("Bonjour");
    expect(proposalDocumentXml).toContain("Cordialement");
    expect(proposalDocumentXml).toContain("Alex Mercer");
    expect(proposalDocumentXml).not.toContain("ALEX MERCER");
    expect(proposalDocumentXml).not.toContain("w:cols");
    expect(proposalDocumentXml).toContain("Fraunces");
    expect(proposalStylesXml).toContain("Syne");
  });

  it("preserves supported Styled typography presets and structural hooks across long-content fixtures", () => {
    const baselineResumeOrder = getDataBlockOrder(
      parseExportHtml(
        renderResumeAtsExportDocument(resumeFixture, {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
      ),
    );
    const baselineProposalOrder = getDataBlockOrder(
      parseExportHtml(
        renderProposalAtsExportDocument(proposalFixture, {
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        }),
      ),
    );
    const typographyCases = [
      {
        typography: "quiet-editorial" as const,
        headingFont: "Fraunces",
        bodyFont: "Syne",
      },
      {
        typography: "civic-correspondence" as const,
        headingFont: "Thestral Neue",
        bodyFont: "BioRhyme",
      },
      {
        typography: "ledger-sans" as const,
        headingFont: "Special Elite",
        bodyFont: "Courier Prime",
      },
    ];
    const longProposalFixture: ProposalPrintSource = {
      ...proposalFixture,
      templateId: "modernist_signal",
      documentTitle:
        "Candidature Senior Product Design Systems and Content Operations Lead",
      documentMeta:
        "Paris : coordination documentaire ; export long-format ; robustesse machine",
      contactLine:
        "alexandria.mercer.delacroix@example.com : +33 6 00 00 00 00 : portfolio.example.com/alexandria",
      recipientDetails:
        "Studio Nord Product Infrastructure and Editorial Systems Group : Paris\nEquipe produit et operations documentaires",
      body: [
        proposalFixture.body[0],
        {
          type: "paragraph",
          text:
            "Je structure des exports longs, des hierarchies documentaires et des parcours de lecture qui restent stables meme sous forte densite de contenu et sous plusieurs presets typographiques.",
        },
        proposalFixture.body[2],
      ],
    };

    typographyCases.forEach((preset) => {
      const styledResumeDocument = parseExportHtml(
        renderResumeStyledExportDocument({
          data: resumeFixture,
          stylePreset: {
            layout: "two-column",
            typography: preset.typography,
            palette: "pierre",
          },
        }),
      );
      const styledProposalDocument = parseExportHtml(
        renderProposalStyledExportDocument({
          data: longProposalFixture,
          stylePreset: {
            layout: "modernist",
            typography: preset.typography,
            palette: "encre",
          },
        }),
      );
      const resumeCss = getInlineStyles(styledResumeDocument);
      const proposalCss = getInlineStyles(styledProposalDocument);

      expect(getDataBlockOrder(styledResumeDocument).slice().sort()).toEqual(
        baselineResumeOrder.slice().sort(),
      );
      expect(getDataBlockOrder(styledProposalDocument)).toEqual(
        baselineProposalOrder,
      );
      expect(styledResumeDocument.body.className).toContain("resume-shell--split");
      expect(styledProposalDocument.body.className).toContain(
        "proposal-shell--rail",
      );
      expect(resumeCss).toContain(preset.headingFont);
      expect(resumeCss).toContain(preset.bodyFont);
      expect(proposalCss).toContain(preset.headingFont);
      expect(proposalCss).toContain(preset.bodyFont);
      expect(
        styledProposalDocument.querySelector('[data-block="closing"] .proposal-signature')
          ?.textContent,
      ).toBe("Alex Mercer");
      expect(resumeCss).toContain("fit-content(var(--flow-entry-meta-width))");
      expect(proposalCss).toContain(
        "fit-content(var(--flow-proposal-meta-width))",
      );
    });
  });

  it("renders workshop exports from committed planner pages without fresh repagination", () => {
    const currentCv = generateCvTemplate("Workshop export");
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
      experienceSection.structuredContent = Array.from({ length: 7 }, (_, index) => ({
        ...(experienceSection.structuredContent[0] ?? {
          id: `exp-${index + 1}`,
          company: "",
          position: "",
          startDate: "2023-01-01T00:00:00.000Z",
          isCurrent: false,
          currentlyWorking: false,
          achievements: [],
        }),
        id: `exp-${index + 1}`,
        company: `Workshop Company ${index + 1}`,
        position: `Workshop Lead ${index + 1}`,
        startDate: "2023-01-01T00:00:00.000Z",
        isCurrent: false,
        currentlyWorking: false,
        responsibilities: Array.from({ length: 5 }, (__, bulletIndex) =>
          `Workshop export responsibility ${index + 1}.${bulletIndex + 1} with enough copy to create multiple committed pages.`,
        ).join("\n"),
        achievements: [],
      }));
    }

    const exportSource = buildResumeExportSource({
      currentCv,
      stylePreset: currentCv.metadata.verbatiStyle,
    });
    expect(exportSource?.resumeTemplateId).toBe("workshop_resume_onecol_ats");

    const styledDocument = parseExportHtml(
      renderResumeStyledExportDocument({
        data: exportSource!,
        stylePreset: currentCv.metadata.verbatiStyle,
      }),
    );
    const styledCss = getInlineStyles(styledDocument);
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(
        exportSource!,
        currentCv.metadata.verbatiStyle,
      ),
    );
    const atsCss = getInlineStyles(atsDocument);
    const workshopTemplate = getResumeTemplateDefinition("workshop_resume_onecol_ats");
    const expectedEntryMetaWidthMm =
      workshopTemplate.export.mainMm - workshopTemplate.export.readingWidthMm;

    expect(styledDocument.body.className).toContain("resume-layout--workshop");
    expect(styledDocument.querySelectorAll(".export-page")).toHaveLength(
      exportSource?.committedPages?.length ?? 0,
    );
    expect(atsDocument.querySelectorAll(".export-page")).toHaveLength(
      exportSource?.committedPages?.length ?? 0,
    );
    expect(
      styledDocument.querySelector(
        '[data-resume-template="workshop_resume_onecol_ats"]',
      ),
    ).toBeTruthy();
    expect(styledCss).toContain(
      `--flow-entry-meta-width: ${expectedEntryMetaWidthMm}mm;`,
    );
    expect(atsCss).toContain(
      `--flow-entry-meta-width: ${expectedEntryMetaWidthMm}mm;`,
    );
    expect(styledCss).toContain(".entry-headline {");
    expect(styledCss).toContain(".entry-continuation {");
    expect(atsCss).toContain(".entry-headline {");
    expect(atsCss).toContain(".entry-continuation {");
    expect(styledDocument.querySelector(".entry-headline")).toBeTruthy();
    expect(atsDocument.querySelector(".entry-headline")).toBeTruthy();
    expect(styledDocument.querySelector(".workshop-export-header")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__identity")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__contact")).toBeNull();
    expect(styledDocument.querySelector(".workshop-export-header__metadata")).toBeNull();
    expect(styledDocument.querySelector(".resume-styled-page--workshop")).toBeNull();
  });

  it("renders the dense first workshop experience entry intact in export output when the committed planner no longer splits it", () => {
    const workshopStyle = {
      familyId: "workshop",
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "sauge",
    } as const;
    const plannerData = {
      ...resumeMock,
      metadata: resumeMock.metadata.slice(0, 1),
      contact: resumeMock.contact.slice(0, 2),
      skillItems: [],
      languages: [],
      education: [],
      achievements: [],
      achievementItems: [],
      certifications: [],
      affiliations: [],
      hobbyItems: [],
      hobbies: [],
      projects: [],
      textSections: [],
      summary: Array.from({ length: 30 }, (_, index) => `summary-${index + 1}`).join(" "),
      experience: [
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-1",
          role: "1",
          description: makeDenseTokenBlock("1", 40),
          bullets: [],
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-2",
          role: "2",
          description: makeDenseTokenBlock("2", 8),
          bullets: [],
        },
        {
          ...resumeMock.experience[0]!,
          id: "exp-dense-3",
          role: "3",
          description: makeDenseTokenBlock("3", 8),
          bullets: [],
        },
      ],
    };
    const planner = planWorkshopResumePages({
      data: plannerData,
      template: getResumeTemplateDefinition("workshop_resume_onecol_ats"),
      stylePreset: workshopStyle,
    });
    const exportSource: ResumePrintSource = {
      ...resumeFixture,
      title: plannerData.name,
      profile: {
        name: plannerData.name,
        title: plannerData.title,
        summary: plannerData.summary,
      },
      contact: plannerData.contact.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      metadata: plannerData.metadata.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      skills: [],
      languages: [],
      experience: [],
      projects: [],
      education: [],
      achievements: [],
      hobbies: [],
      resumeTemplateId: "workshop_resume_onecol_ats",
      committedPages: planner.committedPages,
    };
    const atsDocument = parseExportHtml(
      renderResumeAtsExportDocument(
        exportSource!,
        workshopStyle,
      ),
    );

    expect(
      exportSource?.committedPages
        ?.flatMap((page) => page.fragments)
        .filter((fragment) => fragment.kind === "experience")
        .flatMap((fragment) => fragment.items)
        .filter((item) => item.id === "exp-dense-1").length,
    ).toBe(1);
    expect(
      atsDocument.querySelectorAll('[data-export-item-id="exp-dense-1"]').length,
    ).toBe(1);
    expect(
      atsDocument.querySelector('[data-export-item-id="exp-dense-1"] .entry-continuation'),
    ).toBeNull();
    expect(
      atsDocument.querySelector('[data-export-item-id="exp-dense-1"] .entry-title')?.textContent,
    ).toBe("1");
    expect(
      atsDocument.querySelectorAll('[data-export-item-id="exp-dense-2"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(atsDocument.body.textContent).toContain("2");
  });

  it("fails closed when workshop export pages are missing", () => {
    expect(() =>
      renderResumeStyledExportDocument({
        data: {
          ...resumeFixture,
          resumeTemplateId: "workshop_resume_onecol_ats",
        },
        stylePreset: {
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          familyId: "workshop",
        },
      }),
    ).toThrow(/committed workshop export pages/i);
  });

});
