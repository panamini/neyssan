import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { resolveProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { resolveProposalVoicePreset } from "../../convex/lib/proposals/voicePresets";
import type { CvDocument } from "../types/cvDocument";
import type { VerbatiStylePreset } from "../features/verbati/types";
import {
  buildAuthoritativeResumeExportModel,
  type AuthoritativeResume,
} from "./authoritative-resume";
import {
  buildVerbatiThemeVars,
  getResumeTemplateId,
  getVerbatiStyleFromCv,
  getVerbatiTypographyFamilies,
  resolveVerbatiStyle,
  VERBATI_LAYOUT_TO_RENDERER,
} from "../features/verbati/style";
import type { ProposalHeaderVisibility } from "./proposal-header";
import {
  buildProposalSalutation,
  readProposalSalutation,
  resolveProposalHeaderVisibility,
} from "./proposal-header";
import type {
  ResumeData,
  ResumeLayoutVariantId,
} from "../features/verbati/resume/resume.types";
import { normalizeExportDocumentLanguage } from "./export-locale";
import {
  extractProposalClosingBlockFromParagraphs,
  sanitizeProposalClosingRef,
  type ProposalClosingRef,
} from "./proposal-closing";
import { getProposalDocumentTypography } from "./proposal-document-typography";
import { resolveProposalOutputLanguage } from "../../convex/lib/proposals/proposalOutput";
import {
  buildCanonicalResumeRenderModelFromAuthoritative,
  buildCanonicalResumeRenderModelFromCv,
} from "./buildCanonicalResumeRenderModel";
import {
  getResumeTemplateDefinition,
  isWorkshopResumeTemplateId,
  type ResumeTemplateId,
} from "./layout/resumeTemplates";
import {
  planWorkshopResumePages,
  type WorkshopResumeCommittedPage,
} from "./resume/resumePagination";
import {
  sanitizeProposalSignatureSettings,
  type ProposalSignatureSettings,
} from "./proposal-signature-settings";

export type ExportDocumentKind = "resume" | "proposal";
export type ExportDocumentFormat = "pdf" | "docx";
export type ExportDocumentPdfMode = "ats" | "styled";

export type ResumePrintItem = {
  label: string;
  value: string;
};

export type ResumePrintExperienceItem = {
  role: string;
  company: string;
  period: string;
  location: string;
  summary: string;
  bullets: string[];
};

export type ResumePrintEducationItem = {
  degree: string;
  fieldOfStudy?: string;
  grade?: string;
  school: string;
  period: string;
};

export type ResumePrintProjectItem = {
  name: string;
  meta: string;
  description: string;
};

export type ResumePrintSource = {
  schemaVersion: 1;
  kind: "resume";
  locale: string | null;
  title: string;
  exportSource: "authoritative" | "standard";
  profile: {
    name: string;
    title: string;
    summary: string;
  };
  contact: ResumePrintItem[];
  metadata: ResumePrintItem[];
  skills: string[];
  languages: Array<{
    name: string;
    level: string;
  }>;
  experience: ResumePrintExperienceItem[];
  projects: ResumePrintProjectItem[];
  education: ResumePrintEducationItem[];
  achievements: string[];
  hobbies: string[];
  certifications?: ResumePrintItem[];
  affiliations?: ResumePrintItem[];
  additionalInformation?: string[];
  resumeTemplateId: ResumeTemplateId;
  committedPages?: WorkshopResumeCommittedPage[];
};

export type ResumePreviewPrintSource = {
  schemaVersion: 1;
  kind: "resume";
  renderSource: "preview";
  locale: string | null;
  resumeData: ResumeData;
  stylePreset: VerbatiStylePreset;
  resumeTemplateId: ResumeTemplateId;
  rendererVariantId: ResumeLayoutVariantId;
  committedPages?: WorkshopResumeCommittedPage[];
};

export type ResumePrintRoutePayload = {
  schemaVersion: 1;
  kind: "resume_print_route";
  locale: string | null;
  resumeData: ResumeData;
  stylePreset: VerbatiStylePreset;
  resumeTemplateId: ResumeTemplateId;
  rendererVariantId: ResumeLayoutVariantId;
  committedPages?: WorkshopResumeCommittedPage[];
};

export type ResumePrintDebugSnapshot = {
  layout: VerbatiStylePreset["layout"];
  typography: VerbatiStylePreset["typography"];
  palette: VerbatiStylePreset["palette"];
  accentHex?: string;
  rendererVariantId: ResumeLayoutVariantId;
  headingFontFamily: string;
  bodyFontFamily: string;
};

export type ResumeTypographyAuditMetadata = {
  kind: "resume_typography_audit";
  artifactDirRelative: string | null;
  capturePrePdfScreenshot: boolean;
  cvId?: string | null;
  cvUrl?: string | null;
};

export type ProposalTypographyAuditMetadata = {
  kind: "proposal_typography_audit";
  artifactDirRelative: string | null;
  capturePrePdfScreenshot: boolean;
  proposalId?: string | null;
  proposalUrl?: string | null;
};

export type ProposalPrintBlock =
  | {
      type: "salutation" | "paragraph";
      text: string;
    }
  | {
      type: "closing";
      signOff: string;
      signatureName: string;
      handwrittenSignatureEnabled?: boolean;
    };

export type ProposalPrintApplicantHeader = {
  name: string;
  role: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  location: string;
  tag: string;
};

type ProposalPrintApplicantHeaderInput = Partial<{
  [Key in keyof ProposalPrintApplicantHeader]: string | null | undefined;
}>;

export type ProposalPrintSource = {
  schemaVersion: 1;
  kind: "proposal";
  locale: string | null;
  title: string;
  proposalType: string | null;
  documentTitle: string;
  documentMeta: string;
  contactLine: string;
  letterDate: string;
  recipientDetails: string;
  applicantHeader: ProposalPrintApplicantHeader;
  headerVisibility: ProposalHeaderVisibility;
  templateId: ProposalTemplateId | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  body: ProposalPrintBlock[];
};

export type ProposalPreviewPrintSource = {
  schemaVersion: 1;
  kind: "proposal";
  renderSource: "preview";
  locale: string | null;
  content: string;
  proposalType: string | null;
  voicePreset: string | null;
  railTitle: string | null;
  railMeta: string | null;
  contactLine: string;
  letterDate: string;
  recipientDetails: string;
  documentTitle: string;
  documentMeta: string;
  applicantHeader: ProposalPrintApplicantHeader;
  headerVisibility: ProposalHeaderVisibility;
  templateId: ProposalTemplateId;
  stylePreset: VerbatiStylePreset;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
};

export type ProposalPrintRoutePayload = {
  schemaVersion: 1;
  kind: "proposal_print_route";
  locale: string | null;
  content: string;
  proposalType: string | null;
  voicePreset: string | null;
  railTitle: string | null;
  railMeta: string | null;
  contactLine: string;
  letterDate: string;
  recipientDetails: string;
  documentTitle: string;
  documentMeta: string;
  applicantHeader: ProposalPrintApplicantHeader;
  headerVisibility: ProposalHeaderVisibility;
  templateId: ProposalTemplateId;
  stylePreset: VerbatiStylePreset;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
};

export type ProposalPrintDebugSnapshot = {
  layout: VerbatiStylePreset["layout"];
  typography: VerbatiStylePreset["typography"];
  palette: VerbatiStylePreset["palette"];
  accentHex?: string;
  templateId: ProposalTemplateId;
  voicePreset: string | null;
  bodyFontFamily: string;
};

export type ExportDocumentSource =
  | ResumePrintSource
  | ResumePreviewPrintSource
  | ProposalPrintSource
  | ProposalPreviewPrintSource;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResumeItems(items: ResumeData["metadata"]): ResumePrintItem[] {
  return items
    .map((item) => ({
      label: cleanString(item.label),
      value: cleanString(item.value),
    }))
    .filter((item) => item.label && item.value);
}

function normalizeResumeData(
  data: ResumeData,
  resumeTemplateId: ResumeTemplateId,
  exportSource: ResumePrintSource["exportSource"] = "standard",
  committedPages?: WorkshopResumeCommittedPage[],
): ResumePrintSource {
  return {
    schemaVersion: 1,
    kind: "resume",
    locale: null,
    title: data.name || "Resume",
    exportSource,
    profile: {
      name: cleanString(data.name) || "Candidate",
      title: cleanString(data.title),
      summary: cleanString(data.summary),
    },
    contact: normalizeResumeItems(data.contact),
    metadata: normalizeResumeItems(data.metadata),
    skills: data.skills.map((item) => cleanString(item)).filter(Boolean),
    languages: data.languages
      .map((item) => ({
        name: cleanString(item.name),
        level: cleanString(item.level),
      }))
      .filter((item) => item.name),
    experience: data.experience.map((item) => ({
      role: cleanString(item.role) || "Experience",
      company: cleanString(item.company),
      period: cleanString(item.period),
      location: cleanString(item.location),
      summary: cleanString(item.description),
      bullets: item.bullets.map((bullet) => cleanString(bullet)).filter(Boolean),
    })),
    projects: data.projects.map((item) => ({
      name: cleanString(item.name) || "Project",
      meta: cleanString(item.meta),
      description: cleanString(item.description),
    })),
    education: data.education.map((item) => ({
      degree: cleanString(item.degree) || "Education",
      ...(cleanString(item.fieldOfStudy)
        ? { fieldOfStudy: cleanString(item.fieldOfStudy) }
        : {}),
      ...(cleanString(item.grade) ? { grade: cleanString(item.grade) } : {}),
      school: cleanString(item.school),
      period: cleanString(item.period),
    })),
    achievements: (data.achievements ?? []).map((item) => cleanString(item)).filter(Boolean),
    hobbies: data.hobbies.map((item) => cleanString(item)).filter(Boolean),
    certifications: data.certifications.map((item) => ({
      label: cleanString(item.name),
      value: [cleanString(item.issuer), cleanString(item.meta)]
        .filter(Boolean)
        .join(" · "),
    })).filter((item) => item.label || item.value),
    affiliations: data.affiliations.map((item) => ({
      label: cleanString(item.organizationName),
      value: [
        cleanString(item.roleOrMembershipType),
        cleanString(item.dateRange),
        cleanString(item.notes),
      ]
        .filter(Boolean)
        .join(" · "),
    })).filter((item) => item.label || item.value),
    additionalInformation: data.textSections
      .map((item) => [cleanString(item.sectionTitle), cleanString(item.text)].filter(Boolean).join(" — "))
      .filter(Boolean),
    resumeTemplateId,
    committedPages,
  };
}

function buildCommittedWorkshopPages(args: {
  data: ResumeData;
  resumeTemplateId: ResumeTemplateId;
  stylePreset?: VerbatiStylePreset | null;
}): WorkshopResumeCommittedPage[] | undefined {
  if (!isWorkshopResumeTemplateId(args.resumeTemplateId)) {
    return undefined;
  }

  return planWorkshopResumePages({
    data: args.data,
    template: getResumeTemplateDefinition(args.resumeTemplateId),
    stylePreset: args.stylePreset,
  }).committedPages;
}

export function buildResumeExportSource(args: {
  currentCv: CvDocument | null | undefined;
  authoritativeResume?: AuthoritativeResume | unknown;
  stylePreset?: VerbatiStylePreset | null;
}): ResumePrintSource | null {
  if (!args.currentCv) {
    return null;
  }

  const stylePreset = resolveVerbatiStyle(
    args.stylePreset ?? getVerbatiStyleFromCv(args.currentCv),
  );
  const resumeTemplateId = getResumeTemplateId(stylePreset);
  const authoritativeModel = buildAuthoritativeResumeExportModel(
    args.authoritativeResume,
  );
  if (authoritativeModel) {
    const canonicalData =
      buildCanonicalResumeRenderModelFromAuthoritative(authoritativeModel);
    return {
      ...normalizeResumeData(
        canonicalData,
        resumeTemplateId,
        "authoritative",
        buildCommittedWorkshopPages({
          data: canonicalData,
          resumeTemplateId,
          stylePreset,
        }),
      ),
      locale: normalizeExportDocumentLanguage(args.currentCv.metadata.locale),
    };
  }

  const canonicalData = buildCanonicalResumeRenderModelFromCv(args.currentCv);
  return {
    ...normalizeResumeData(
      canonicalData,
      resumeTemplateId,
      "standard",
      buildCommittedWorkshopPages({
        data: canonicalData,
        resumeTemplateId,
        stylePreset,
      }),
    ),
    locale: normalizeExportDocumentLanguage(args.currentCv.metadata.locale),
  };
}

export function buildStyledResumePrintSource(args: {
  currentCv: CvDocument | null | undefined;
  stylePreset?: VerbatiStylePreset | null;
}): ResumePreviewPrintSource | null {
  if (!args.currentCv) {
    return null;
  }

  const stylePreset = resolveVerbatiStyle(
    args.stylePreset ?? getVerbatiStyleFromCv(args.currentCv),
  );
  const resumeData = buildCanonicalResumeRenderModelFromCv(args.currentCv);
  const resumeTemplateId = getResumeTemplateId(stylePreset);

  return {
    schemaVersion: 1,
    kind: "resume",
    renderSource: "preview",
    locale: normalizeExportDocumentLanguage(args.currentCv.metadata.locale),
    resumeData,
    stylePreset,
    resumeTemplateId,
    rendererVariantId: VERBATI_LAYOUT_TO_RENDERER[stylePreset.layout],
    committedPages: buildCommittedWorkshopPages({
      data: resumeData,
      resumeTemplateId,
      stylePreset,
    }),
  };
}

export function buildResumePrintRoutePayload(args: {
  data: ResumePreviewPrintSource;
}): ResumePrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "resume_print_route",
    locale: args.data.locale,
    resumeData: args.data.resumeData,
    stylePreset: args.data.stylePreset,
    resumeTemplateId: args.data.resumeTemplateId,
    rendererVariantId: args.data.rendererVariantId,
    committedPages: args.data.committedPages,
  };
}

export function buildResumePrintDebugSnapshot(args: {
  stylePreset: VerbatiStylePreset;
  rendererVariantId: ResumeLayoutVariantId;
}): ResumePrintDebugSnapshot {
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const themeVars = buildVerbatiThemeVars(stylePreset) as Record<
    string,
    string | undefined
  >;

  return {
    layout: stylePreset.layout,
    typography: stylePreset.typography,
    palette: stylePreset.palette,
    accentHex: stylePreset.accentHex,
    rendererVariantId: args.rendererVariantId,
    headingFontFamily: String(themeVars["--font-heading-family"] ?? "").trim(),
    bodyFontFamily: String(themeVars["--font-body-family"] ?? "").trim(),
  };
}

export function buildProposalPreviewPrintSource(args: {
  content: string | null | undefined;
  proposalType: string | null | undefined;
  voicePreset: string | null | undefined;
  railTitle: string | null | undefined;
  railMeta: string | null | undefined;
  contactLine: string | null | undefined;
  letterDate: string | null | undefined;
  recipientDetails: string | null | undefined;
  documentTitle: string | null | undefined;
  documentMeta: string | null | undefined;
  applicantHeader: ProposalPrintApplicantHeaderInput | null | undefined;
  headerVisibility?: Partial<ProposalHeaderVisibility> | null;
  templateId?: ProposalTemplateId | null;
  stylePreset?: VerbatiStylePreset | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  locale?: string | null;
}): ProposalPreviewPrintSource {
  const documentTitle = cleanString(args.documentTitle) || "Proposal";
  const normalizedContent = cleanString(args.content);
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const locale = resolveProposalExportLocale({
    explicitLocale: args.locale,
    content: normalizedContent,
    documentTitle,
  });

  return {
    schemaVersion: 1,
    kind: "proposal",
    renderSource: "preview",
    locale,
    content: normalizedContent,
    proposalType: cleanString(args.proposalType) || null,
    voicePreset: cleanString(args.voicePreset) || null,
    railTitle: cleanString(args.railTitle) || null,
    railMeta: cleanString(args.railMeta) || null,
    contactLine: cleanString(args.contactLine),
    letterDate: cleanString(args.letterDate),
    recipientDetails: cleanString(args.recipientDetails),
    documentTitle,
    documentMeta: cleanString(args.documentMeta),
    applicantHeader: {
      name: cleanString(args.applicantHeader?.name),
      role: cleanString(args.applicantHeader?.role),
      email: cleanString(args.applicantHeader?.email),
      phone: cleanString(args.applicantHeader?.phone),
      linkedin: cleanString(args.applicantHeader?.linkedin),
      website: cleanString(args.applicantHeader?.website),
      location: cleanString(args.applicantHeader?.location),
      tag: cleanString(args.applicantHeader?.tag),
    },
    headerVisibility: resolveProposalHeaderVisibility(args.headerVisibility),
    templateId: resolveProposalTemplateId(args.templateId),
    stylePreset,
    signatureSettings: sanitizeProposalSignatureSettings(
      args.signatureSettings,
    ),
    closing: sanitizeProposalClosingRef(args.closing),
  };
}

export function buildProposalPrintRoutePayload(args: {
  data: ProposalPreviewPrintSource;
}): ProposalPrintRoutePayload {
  return {
    schemaVersion: 1,
    kind: "proposal_print_route",
    locale: args.data.locale,
    content: args.data.content,
    proposalType: args.data.proposalType,
    voicePreset: args.data.voicePreset,
    railTitle: args.data.railTitle,
    railMeta: args.data.railMeta,
    contactLine: args.data.contactLine,
    letterDate: args.data.letterDate,
    recipientDetails: args.data.recipientDetails,
    documentTitle: args.data.documentTitle,
    documentMeta: args.data.documentMeta,
    applicantHeader: args.data.applicantHeader,
    headerVisibility: args.data.headerVisibility,
    templateId: args.data.templateId,
    stylePreset: args.data.stylePreset,
    signatureSettings: sanitizeProposalSignatureSettings(
      args.data.signatureSettings,
    ),
    closing: sanitizeProposalClosingRef(args.data.closing),
  };
}

export function buildProposalPrintDebugSnapshot(args: {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
  voicePreset: string | null | undefined;
}): ProposalPrintDebugSnapshot {
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const voicePreset = resolveProposalVoicePreset(args.voicePreset);
  const documentTypography = getProposalDocumentTypography(
    voicePreset ?? null,
    stylePreset,
  );
  const typographyFamilies = getVerbatiTypographyFamilies(stylePreset);

  return {
    layout: stylePreset.layout,
    typography: stylePreset.typography,
    palette: stylePreset.palette,
    accentHex: stylePreset.accentHex,
    templateId: resolveProposalTemplateId(args.templateId),
    voicePreset: cleanString(args.voicePreset) || null,
    bodyFontFamily: documentTypography.fontFamily || typographyFamilies.bodyFamily,
  };
}

function splitProposalParagraphs(content: string): string[] {
  return content
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function buildProposalBodyBlocks(
  content: string | null | undefined,
  recipientDetails?: string | null,
  closing?: ProposalClosingRef | null,
): ProposalPrintBlock[] {
  const normalizedContent = cleanString(content);
  if (!normalizedContent) {
    return [];
  }

  const paragraphs = splitProposalParagraphs(normalizedContent);
  if (paragraphs.length === 0) {
    return [];
  }

  const salutation = readProposalSalutation(normalizedContent) ||
    buildProposalSalutation(recipientDetails);
  const blocks: ProposalPrintBlock[] = [];
  let startIndex = 0;

  if (salutation && cleanString(paragraphs[0]) === cleanString(salutation)) {
    blocks.push({ type: "salutation", text: salutation });
    startIndex = 1;
  }

  const structuredClosing = closing
    ? sanitizeProposalClosingRef(closing)
    : null;
  const extractedClosingBlock =
    startIndex < paragraphs.length
      ? extractProposalClosingBlockFromParagraphs(paragraphs)
      : null;
  const structuredClosingBlock: ProposalPrintBlock | null = structuredClosing &&
    (structuredClosing.signOff ||
      (structuredClosing.enabled && structuredClosing.signatureName))
    ? {
        type: "closing",
        signOff: structuredClosing.signOff,
        signatureName: structuredClosing.enabled
          ? structuredClosing.signatureName
          : "",
        ...(structuredClosing.enabled &&
        structuredClosing.handwrittenSignatureEnabled
          ? { handwrittenSignatureEnabled: true }
          : null),
      }
    : null;
  const closingBlock: ProposalPrintBlock | null = structuredClosing
    ? structuredClosingBlock
    : extractedClosingBlock
      ? {
          type: "closing",
          signOff: extractedClosingBlock.block.signOff ?? "",
          signatureName: extractedClosingBlock.block.signatureName ?? "",
        }
      : null;
  const endIndex = extractedClosingBlock
    ? extractedClosingBlock.startIndex
    : paragraphs.length;

  for (let index = startIndex; index < endIndex; index += 1) {
    blocks.push({
      type: "paragraph",
      text: paragraphs[index],
    });
  }

  if (closingBlock) {
    blocks.push(closingBlock);
  }

  return blocks;
}

function resolveProposalExportLocale(args: {
  explicitLocale?: string | null;
  content: string | null | undefined;
  documentTitle: string | null | undefined;
}): string {
  return (
    normalizeExportDocumentLanguage(args.explicitLocale) ??
    (resolveProposalOutputLanguage(
      cleanString(args.content) || cleanString(args.documentTitle),
    ) === "French"
      ? "fr"
      : "en")
  );
}

export function buildProposalExportSource(args: {
  content: string | null | undefined;
  proposalType: string | null | undefined;
  documentTitle: string | null | undefined;
  documentMeta: string | null | undefined;
  contactLine: string | null | undefined;
  letterDate: string | null | undefined;
  recipientDetails: string | null | undefined;
  applicantHeader: ProposalPrintApplicantHeaderInput | null | undefined;
  headerVisibility?: Partial<ProposalHeaderVisibility> | null;
  templateId?: ProposalTemplateId | null;
  signatureSettings?: ProposalSignatureSettings | null;
  closing?: ProposalClosingRef | null;
  locale?: string | null;
}): ProposalPrintSource {
  const documentTitle = cleanString(args.documentTitle) || "Proposal";
  const locale = resolveProposalExportLocale({
    explicitLocale: args.locale,
    content: args.content,
    documentTitle,
  });

  return {
    schemaVersion: 1,
    kind: "proposal",
    locale,
    title: documentTitle,
    proposalType: cleanString(args.proposalType) || null,
    documentTitle,
    documentMeta: cleanString(args.documentMeta),
    contactLine: cleanString(args.contactLine),
    letterDate: cleanString(args.letterDate),
    recipientDetails: cleanString(args.recipientDetails),
    applicantHeader: {
      name: cleanString(args.applicantHeader?.name),
      role: cleanString(args.applicantHeader?.role),
      email: cleanString(args.applicantHeader?.email),
      phone: cleanString(args.applicantHeader?.phone),
      linkedin: cleanString(args.applicantHeader?.linkedin),
      website: cleanString(args.applicantHeader?.website),
      location: cleanString(args.applicantHeader?.location),
      tag: cleanString(args.applicantHeader?.tag),
    },
    headerVisibility: resolveProposalHeaderVisibility(args.headerVisibility),
    templateId: args.templateId ?? null,
    signatureSettings: sanitizeProposalSignatureSettings(
      args.signatureSettings,
    ),
    closing: sanitizeProposalClosingRef(args.closing),
    body: buildProposalBodyBlocks(
      args.content,
      args.recipientDetails,
      sanitizeProposalClosingRef(args.closing),
    ),
  };
}
