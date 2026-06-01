import { type ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import type { DocumentPageSize } from "../document-page-size";
import { type CanonicalDocumentTokens } from "./documentTokens";
import {
  normalizeProposalExportTokens,
  normalizeResumeExportTokens,
} from "./documentTokenNormalizer";
import { serializeExportVars } from "./documentTokenSerializers";
import type { ResumeTemplateId } from "./resumeTemplates";

type ExportLengthVars = Record<string, string>;

export type ResumeExportShell = "onecol" | "split";
export type ProposalExportShell = "onecol" | "rail";

export type ResumeExportProfile = {
  id: "ats" | ResumeTemplateId;
  shell: ResumeExportShell;
  vars: ExportLengthVars;
  canonical: CanonicalDocumentTokens;
};

export type ProposalExportProfile = {
  id: "ats" | ProposalTemplateId;
  shell: ProposalExportShell;
  vars: ExportLengthVars;
  templateId: ProposalTemplateId | null;
  canonical: CanonicalDocumentTokens;
};

export function resolveResumeExportProfile(args: {
  mode: "ats" | "styled";
  resumeTemplateId?: ResumeTemplateId | null;
  stylePreset?: VerbatiStylePreset | null;
  pageSize?: DocumentPageSize | null;
}): ResumeExportProfile {
  const normalized = normalizeResumeExportTokens({
    mode: args.mode,
    resumeTemplateId: args.resumeTemplateId,
    stylePreset: args.stylePreset,
    pageSize: args.pageSize,
  });

  return {
    id: normalized.id,
    shell: normalized.shell,
    vars: serializeExportVars(normalized.canonical),
    canonical: normalized.canonical,
  };
}

export function resolveProposalExportProfile(args: {
  mode: "ats" | "styled";
  proposalTemplateId?: ProposalTemplateId | null;
  stylePreset?: VerbatiStylePreset | null;
  pageSize?: DocumentPageSize | null;
}): ProposalExportProfile {
  const normalized = normalizeProposalExportTokens({
    mode: args.mode,
    proposalTemplateId: args.proposalTemplateId,
    stylePreset: args.stylePreset,
    pageSize: args.pageSize,
  });

  return {
    id: normalized.id,
    shell: normalized.shell,
    vars: serializeExportVars(normalized.canonical),
    templateId: normalized.templateId,
    canonical: normalized.canonical,
  };
}
