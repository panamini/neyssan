import type { CvDocument } from "../types/cvDocument";
import type { StoredProposalOutputDraft } from "./proposal-output-draft";
import type { StoredProposalComposeDraft } from "./proposal-workspace-state";

export type LibraryItemType = "job" | "cv" | "proposal";
export type WorkItemPrimaryAction = "open" | "continue" | "copy" | "add_job";

export type WorkTarget =
  | { kind: "route"; to: string }
  | { kind: "none"; reason: string };

export type LibraryItem = {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle?: string;
  content?: string;
  previewLines?: string[];
  cvDocument?: CvDocument;
  updatedAt: number;
  routeTarget: WorkTarget;
  jobId?: string | null;
  jobTitle?: string | null;
  linkedCvId?: string | null;
  linkedCvTitle?: string | null;
  source: "convex" | "local" | "cv-library" | "job";
};

export type WorkActionItem = {
  id: string;
  type: LibraryItemType;
  title: string;
  subtitle: string;
  primaryAction: WorkItemPrimaryAction;
  updatedAt: number;
  target: WorkTarget;
};

export type WorkLibraryModel = {
  items: LibraryItem[];
  recentItems: LibraryItem[];
  continueItems: WorkActionItem[];
  contextItems: WorkActionItem[];
  allItems: LibraryItem[];
};

export type LibraryProposalRecord = {
  _id?: unknown;
  id?: unknown;
  _creationTime?: number;
  title?: string | null;
  content?: string | null;
  status?: string | null;
  updatedAt?: number | null;
  createdAt?: number | null;
  sections?: Array<{
    type?: string | null;
    content?: string | null;
  }> | null;
  metadata?: {
    jobId?: string | null;
    sourceJobTitle?: string | null;
    sourceJobDescription?: string | null;
    sourceCompany?: string | null;
    company?: string | null;
    sourceCvId?: string | null;
  } | null;
};

export type BuildWorkLibraryInput = {
  proposals?: LibraryProposalRecord[] | null;
  cvs?: CvDocument[] | null;
  currentCvId?: string | null;
  outputDraft?: StoredProposalOutputDraft | null;
  composeDraft?: StoredProposalComposeDraft | null;
  localOutputDraft?: StoredProposalOutputDraft | null;
  localComposeDraft?: StoredProposalComposeDraft | null;
  now?: number;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeMultilineText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeText(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function snippet(value: unknown, fallback: string): string {
  return normalizeText(value).slice(0, 180) || fallback;
}

function routeTarget(to: string): WorkTarget {
  return { kind: "route", to };
}

function proposalId(proposal: LibraryProposalRecord): string {
  return String(proposal._id ?? proposal.id ?? "");
}

function proposalStatus(proposal: LibraryProposalRecord): string {
  return normalizeText(proposal.status).toLowerCase();
}

function proposalTime(proposal: LibraryProposalRecord): number {
  return Number(
    proposal.updatedAt ?? proposal.createdAt ?? proposal._creationTime ?? 0,
  );
}

function cvTime(cv: CvDocument): number {
  const raw = cv.metadata?.updatedAt ?? cv.metadata?.createdAt;
  if (typeof raw !== "string") return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function proposalSectionText(proposal: LibraryProposalRecord): string {
  return (proposal.sections ?? [])
    .map((section) =>
      section?.type === "text" ? normalizeMultilineText(section.content) : "",
    )
    .filter(Boolean)
    .join("\n\n");
}

function collectText(value: unknown, output: string[] = []): string[] {
  if (typeof value === "string") {
    const text = normalizeText(value);
    if (text) output.push(text);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return output;
  }

  const record = value as Record<string, unknown>;
  [
    "name",
    "title",
    "position",
    "company",
    "degree",
    "fieldOfStudy",
    "institution",
    "summary",
    "description",
    "plainText",
    "text",
    "certificationName",
  ].forEach((key) => collectText(record[key], output));
  collectText(record.responsibilityBullets, output);
  collectText(record.achievements, output);
  collectText(record.content, output);
  return output;
}

function cvPreviewLines(cv: CvDocument): string[] {
  const lines = [
    normalizeText(cv.summary),
    ...(cv.sections ?? []).flatMap((section) => [
      normalizeText(section.title),
      ...collectText(section.structuredContent),
      ...collectText(section.blocks),
    ]),
  ]
    .filter(Boolean)
    .filter((line, index, array) => array.indexOf(line) === index)
    .slice(0, 10);

  return lines.length > 0 ? lines : ["CV profile"];
}

function proposalPreviewLines(content: string, fallback: string): string[] {
  return (content || fallback)
    .split(/\n+|(?<=\.)\s+/)
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 10);
}

function proposalTitle(proposal: LibraryProposalRecord): string {
  return normalizeText(proposal.title) || "Untitled proposal";
}

function proposalTarget(id: string, status: string): WorkTarget {
  if (!id) return routeTarget("/proposal");
  if (status === "draft") {
    return routeTarget(`/proposal?draftId=${encodeURIComponent(id)}`);
  }
  return routeTarget(`/proposal?view=saved&id=${encodeURIComponent(id)}`);
}

function hasProposalRecord(proposal: LibraryProposalRecord): boolean {
  return Boolean(proposalId(proposal));
}

function hasProposalText(proposal: LibraryProposalRecord): boolean {
  return Boolean(
    normalizeText(proposal.title) ||
      normalizeText(proposal.content) ||
      proposalSectionText(proposal),
  );
}

function isProposalLike(proposal: LibraryProposalRecord): boolean {
  const status = proposalStatus(proposal);
  return (
    hasProposalRecord(proposal) ||
    hasProposalText(proposal) ||
    status === "draft" ||
    status === "saved"
  );
}

function cvTitleById(cvs: CvDocument[]): Map<string, string> {
  return new Map(
    cvs.map((cv) => [
      String(cv.id),
      normalizeText(cv.title) || "Untitled CV",
    ]),
  );
}

function makeProposalItem(
  proposal: LibraryProposalRecord,
  linkedCvTitles: Map<string, string>,
): LibraryItem | null {
  if (!isProposalLike(proposal)) return null;
  const id = proposalId(proposal);
  if (!id) return null;
  const status = proposalStatus(proposal);
  const metadata = proposal.metadata ?? {};
  const linkedCvId = normalizeText(metadata.sourceCvId) || null;
  const proposalContent =
    normalizeMultilineText(proposal.content) || proposalSectionText(proposal);
  const body = snippet(proposalContent || metadata.sourceJobDescription, "Proposal text.");

  return {
    id: `proposal:${id}`,
    type: "proposal",
    title: proposalTitle(proposal),
    subtitle: body,
    content: proposalContent || undefined,
    previewLines: proposalPreviewLines(proposalContent, body),
    updatedAt: proposalTime(proposal),
    routeTarget: proposalTarget(id, status),
    jobId: normalizeText(metadata.jobId) || null,
    jobTitle: normalizeText(metadata.sourceJobTitle) || null,
    linkedCvId,
    linkedCvTitle: linkedCvId ? linkedCvTitles.get(linkedCvId) ?? null : null,
    source: "convex",
  };
}

function makeCvItem(cv: CvDocument): LibraryItem {
  const id = String(cv.id);
  return {
    id: `cv:${id}`,
    type: "cv",
    title: normalizeText(cv.title) || "Untitled CV",
    subtitle: "CV profile.",
    previewLines: cvPreviewLines(cv),
    cvDocument: cv,
    updatedAt: cvTime(cv),
    routeTarget: routeTarget(`/cv?id=${encodeURIComponent(id)}`),
    source: "cv-library",
  };
}

function makeLocalProposalItem(
  outputDraft: StoredProposalOutputDraft | null | undefined,
  now: number,
): LibraryItem | null {
  const preservedProposalContent = normalizeMultilineText(outputDraft?.proposalContent);
  if (!preservedProposalContent) return null;
  const sourceDraft = outputDraft?.sourceComposeDraft ?? null;
  return {
    id: "proposal:local",
    type: "proposal",
    title:
      normalizeText(outputDraft?.proposalDocumentTitle) ||
      normalizeText(sourceDraft?.jobTitle) ||
      "Local proposal",
    subtitle: snippet(preservedProposalContent, "Proposal text."),
    content: preservedProposalContent,
    previewLines: proposalPreviewLines(preservedProposalContent, "Proposal text."),
    updatedAt: now,
    routeTarget: routeTarget("/proposal"),
    jobTitle: normalizeText(sourceDraft?.jobTitle) || null,
    linkedCvId: null,
    linkedCvTitle: null,
    source: "local",
  };
}

function buildContinueItems(items: LibraryItem[]): WorkActionItem[] {
  return items
    .filter((item) => item.type === "proposal" || item.type === "cv")
    .slice(0, 4)
    .map((item) => ({
      id: `continue:${item.id}`,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle ?? (item.type === "cv" ? "CV profile." : "Proposal text."),
      primaryAction: item.type === "proposal" ? "continue" : "open",
      updatedAt: item.updatedAt,
      target: item.routeTarget,
    }));
}

function buildContextItems(items: LibraryItem[]): WorkActionItem[] {
  return items
    .filter((item) => item.type === "proposal" && !item.jobId && !item.jobTitle)
    .slice(0, 6)
    .map((item) => ({
      id: `context:${item.id}`,
      type: "proposal",
      title: item.title,
      subtitle: "No job linked.",
      primaryAction: "continue",
      updatedAt: item.updatedAt,
      target: item.routeTarget,
    }));
}

export function buildWorkLibraryModel(
  input: BuildWorkLibraryInput,
): WorkLibraryModel {
  const now = input.now ?? Date.now();
  const outputDraft = input.outputDraft ?? input.localOutputDraft ?? null;
  const linkedCvTitles = cvTitleById(input.cvs ?? []);

  const proposalItems = [
    makeLocalProposalItem(outputDraft, now),
    ...(input.proposals ?? []).map((proposal) =>
      makeProposalItem(proposal, linkedCvTitles),
    ),
  ].filter((item): item is LibraryItem => Boolean(item));
  const cvItems = (input.cvs ?? []).map(makeCvItem);
  const items = [...proposalItems, ...cvItems].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );

  return {
    items,
    recentItems: items.slice(0, 8),
    continueItems: buildContinueItems(items),
    contextItems: buildContextItems(items),
    allItems: items,
  };
}
