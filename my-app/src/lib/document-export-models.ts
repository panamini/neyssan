import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { resolveProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import type { CvDocument } from "../types/cvDocument";
import type { VerbatiStylePreset } from "../features/verbati/types";
import {
  buildAuthoritativeResumeExportModel,
  type AuthoritativeResume,
  type AuthoritativeResumeExportModel,
} from "./authoritative-resume";
import { mapCvDocumentToResumeData } from "../features/verbati/cvDocumentToResumeData";
import {
  buildVerbatiThemeVars,
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
import { normalizeExportLocale } from "./export-locale";
import { parseProposalClosingBlock } from "./proposal-closing";
import { getProposalDocumentTypography } from "./proposal-document-typography";
import { resolveProposalOutputLanguage } from "../../convex/lib/proposals/proposalOutput";

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
};

export type ResumePreviewPrintSource = {
  schemaVersion: 1;
  kind: "resume";
  renderSource: "preview";
  locale: string | null;
  resumeData: ResumeData;
  stylePreset: VerbatiStylePreset;
  rendererVariantId: ResumeLayoutVariantId;
};

export type ResumePrintRoutePayload = {
  schemaVersion: 1;
  kind: "resume_print_route";
  locale: string | null;
  resumeData: ResumeData;
  stylePreset: VerbatiStylePreset;
  rendererVariantId: ResumeLayoutVariantId;
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

function normalizeResumeData(data: ResumeData): ResumePrintSource {
  return {
    schemaVersion: 1,
    kind: "resume",
    locale: null,
    title: data.name || "Resume",
    exportSource: "standard",
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
      school: cleanString(item.school),
      period: cleanString(item.period),
    })),
    achievements: (data.achievements ?? []).map((item) => cleanString(item)).filter(Boolean),
    hobbies: data.hobbies.map((item) => cleanString(item)).filter(Boolean),
  };
}

function buildAuthoritativeContact(model: AuthoritativeResumeExportModel): ResumePrintItem[] {
  return [
    { label: "Email", value: cleanString(model.profile.email) },
    { label: "Phone", value: cleanString(model.profile.phone) },
    { label: "Location", value: cleanString(model.profile.location) },
    { label: "LinkedIn", value: cleanString(model.profile.linkedin) },
    { label: "Website", value: cleanString(model.profile.website) },
    { label: "GitHub", value: cleanString(model.profile.github) },
    { label: "Portfolio", value: cleanString(model.profile.portfolio) },
  ].filter((item) => item.value);
}

function normalizeAuthoritativeResume(
  model: AuthoritativeResumeExportModel,
): ResumePrintSource {
  return {
    schemaVersion: 1,
    kind: "resume",
    locale: null,
    title: cleanString(model.profile.name) || "Resume",
    exportSource: "authoritative",
    profile: {
      name: cleanString(model.profile.name) || "Candidate",
      title: cleanString(model.profile.desiredPosition),
      summary: cleanString(model.summary),
    },
    contact: buildAuthoritativeContact(model),
    metadata: [],
    skills: model.skills.map((item) => cleanString(item.name)).filter(Boolean),
    languages: model.languages
      .map((item) => ({
        name: cleanString(item.name),
        level: cleanString(item.level),
      }))
      .filter((item) => item.name),
    experience: model.experience.map((item) => ({
      role: cleanString(item.position) || "Experience",
      company: cleanString(item.company),
      period: [cleanString(item.startDate), item.isCurrent ? "Present" : cleanString(item.endDate)]
        .filter(Boolean)
        .join(" - "),
      location: cleanString(item.location),
      summary: cleanString(item.description),
      bullets: [
        ...item.responsibilityBullets.map((bullet) => cleanString(bullet)),
        ...item.achievements.map((bullet) => cleanString(bullet)),
      ].filter(Boolean),
    })),
    projects: model.projects.map((item) => ({
      name: cleanString(item.title) || "Project",
      meta: cleanString(item.meta),
      description: cleanString(item.summary),
    })),
    education: model.education.map((item) => ({
      degree:
        cleanString(item.degree) ||
        cleanString(item.fieldOfStudy) ||
        "Education",
      school: cleanString(item.institution),
      period: [cleanString(item.startDate), item.isCurrent ? "Present" : cleanString(item.endDate)]
        .filter(Boolean)
        .join(" - "),
    })),
    achievements: model.achievements.map((item) => cleanString(item)).filter(Boolean),
    hobbies: model.hobbies.map((item) => cleanString(item)).filter(Boolean),
  };
}

export function buildResumeExportSource(args: {
  currentCv: CvDocument | null | undefined;
  authoritativeResume?: AuthoritativeResume | unknown;
}): ResumePrintSource | null {
  if (!args.currentCv) {
    return null;
  }

  const authoritativeModel = buildAuthoritativeResumeExportModel(
    args.authoritativeResume,
  );
  if (authoritativeModel) {
    return {
      ...normalizeAuthoritativeResume(authoritativeModel),
      locale: normalizeExportLocale(args.currentCv.metadata.locale),
    };
  }

  return {
    ...normalizeResumeData(mapCvDocumentToResumeData(args.currentCv)),
    locale: normalizeExportLocale(args.currentCv.metadata.locale),
  };
}

export function buildStyledResumePrintSource(args: {
  currentCv: CvDocument | null | undefined;
  stylePreset?: VerbatiStylePreset | null;
}): ResumePreviewPrintSource | null {
  if (!args.currentCv) {
    return null;
  }

  const stylePreset = resolveVerbatiStyle(args.stylePreset);

  return {
    schemaVersion: 1,
    kind: "resume",
    renderSource: "preview",
    locale: normalizeExportLocale(args.currentCv.metadata.locale),
    resumeData: mapCvDocumentToResumeData(args.currentCv),
    stylePreset,
    rendererVariantId: VERBATI_LAYOUT_TO_RENDERER[stylePreset.layout],
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
    rendererVariantId: args.data.rendererVariantId,
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
  applicantHeader: Partial<ProposalPrintApplicantHeader> | null | undefined;
  headerVisibility?: Partial<ProposalHeaderVisibility> | null;
  templateId?: ProposalTemplateId | null;
  stylePreset?: VerbatiStylePreset | null;
}): ProposalPreviewPrintSource {
  const documentTitle = cleanString(args.documentTitle) || "Proposal";
  const normalizedContent = cleanString(args.content);
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const inferredLocale =
    resolveProposalOutputLanguage(normalizedContent || documentTitle) === "French"
      ? "fr"
      : "en";

  return {
    schemaVersion: 1,
    kind: "proposal",
    renderSource: "preview",
    locale: inferredLocale,
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
  };
}

export function buildProposalPrintDebugSnapshot(args: {
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
  voicePreset: string | null | undefined;
}): ProposalPrintDebugSnapshot {
  const stylePreset = resolveVerbatiStyle(args.stylePreset);
  const documentTypography = getProposalDocumentTypography(
    args.voicePreset ?? null,
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

function extractClosingBlock(
  paragraph: string,
): ProposalPrintBlock | null {
  const closingBlock = parseProposalClosingBlock(paragraph);
  if (!closingBlock) {
    return null;
  }

  return {
    type: "closing",
    signOff: closingBlock.signOff ?? "",
    signatureName: closingBlock.signatureName ?? "",
  };
}

export function buildProposalBodyBlocks(
  content: string | null | undefined,
  recipientDetails?: string | null,
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

  const tailParagraph = paragraphs.at(-1);
  const closingBlock =
    tailParagraph && startIndex < paragraphs.length
      ? extractClosingBlock(tailParagraph)
      : null;
  const endIndex = closingBlock ? paragraphs.length - 1 : paragraphs.length;

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

export function buildProposalExportSource(args: {
  content: string | null | undefined;
  proposalType: string | null | undefined;
  documentTitle: string | null | undefined;
  documentMeta: string | null | undefined;
  contactLine: string | null | undefined;
  letterDate: string | null | undefined;
  recipientDetails: string | null | undefined;
  applicantHeader: Partial<ProposalPrintApplicantHeader> | null | undefined;
  headerVisibility?: Partial<ProposalHeaderVisibility> | null;
  templateId?: ProposalTemplateId | null;
}): ProposalPrintSource {
  const documentTitle = cleanString(args.documentTitle) || "Proposal";
  const inferredLocale =
    resolveProposalOutputLanguage(
      cleanString(args.content) || documentTitle,
    ) === "French"
      ? "fr"
      : "en";

  return {
    schemaVersion: 1,
    kind: "proposal",
    locale: inferredLocale,
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
    body: buildProposalBodyBlocks(args.content, args.recipientDetails),
  };
}
