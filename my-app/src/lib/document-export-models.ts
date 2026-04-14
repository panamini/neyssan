import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import type { CvDocument } from "../types/cvDocument";
import {
  buildAuthoritativeResumeExportModel,
  type AuthoritativeResume,
  type AuthoritativeResumeExportModel,
} from "./authoritative-resume";
import { mapCvDocumentToResumeData } from "../features/verbati/cvDocumentToResumeData";
import type { ProposalHeaderVisibility } from "./proposal-header";
import {
  buildProposalSalutation,
  readProposalSalutation,
  resolveProposalHeaderVisibility,
} from "./proposal-header";
import type { ResumeData } from "../features/verbati/resume/resume.types";

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

export type ExportDocumentSource = ResumePrintSource | ProposalPrintSource;

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
    return normalizeAuthoritativeResume(authoritativeModel);
  }

  return normalizeResumeData(mapCvDocumentToResumeData(args.currentCv));
}

function splitProposalParagraphs(content: string): string[] {
  return content
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function looksLikeClosingParagraph(paragraph: string): boolean {
  const firstLine = paragraph.split("\n")[0]?.trim().toLowerCase() ?? "";
  return /^(kind regards|best regards|regards|sincerely|thank you|many thanks|cordially)/i.test(
    firstLine,
  );
}

function extractClosingBlock(
  paragraph: string,
): ProposalPrintBlock | null {
  const lines = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0 || !looksLikeClosingParagraph(paragraph)) {
    return null;
  }

  return {
    type: "closing",
    signOff: lines[0] ?? "",
    signatureName: lines.slice(1).join(" ") || "",
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

  return {
    schemaVersion: 1,
    kind: "proposal",
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
