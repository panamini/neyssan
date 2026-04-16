import { type ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type {
  VerbatiLayoutPreset,
  VerbatiStylePreset,
} from "../../features/verbati/types";
import { type CanonicalDocumentTokens } from "./documentTokens";
import {
  normalizeProposalExportTokens,
  normalizeResumeExportTokens,
} from "./documentTokenNormalizer";
import { serializeExportVars } from "./documentTokenSerializers";

type ExportLengthVars = Record<string, string>;

export type ResumeExportShell = "onecol" | "split";
export type ProposalExportShell = "onecol" | "rail";

export type ResumeExportProfile = {
  id: "ats" | VerbatiLayoutPreset;
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
  layout?: VerbatiLayoutPreset | null;
  stylePreset?: VerbatiStylePreset | null;
}): ResumeExportProfile {
  const normalized = normalizeResumeExportTokens({
    mode: args.mode,
    layout: args.layout,
    stylePreset: args.stylePreset,
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
}): ProposalExportProfile {
  const normalized = normalizeProposalExportTokens({
    mode: args.mode,
    proposalTemplateId: args.proposalTemplateId,
    stylePreset: args.stylePreset,
  });

  return {
    id: normalized.id,
    shell: normalized.shell,
    vars: serializeExportVars(normalized.canonical),
    templateId: normalized.templateId,
    canonical: normalized.canonical,
  };
}
