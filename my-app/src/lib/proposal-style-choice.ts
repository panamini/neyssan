import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  getProposalTwinTemplateId,
  resolveVerbatiStyle,
} from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";

export const PROPOSAL_STYLE_CHOICES = [
  "auto",
  "formal",
  "warm",
  "technical",
  "balanced",
] as const;

export type ProposalStyleChoice = (typeof PROPOSAL_STYLE_CHOICES)[number];
export type ResolvedProposalStyleChoice = Exclude<ProposalStyleChoice, "auto">;

type ProposalStyleDefinition = {
  label: string;
  description: string;
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
};

const PROPOSAL_STYLE_KEYWORDS: Record<ResolvedProposalStyleChoice, RegExp[]> = {
  formal: [
    /\baccount(?:ant|ing)?\b/i,
    /\baudit(?:or|ing)?\b/i,
    /\bfinance|financial|controller|bookkeeper\b/i,
    /\blegal|lawyer|attorney|paralegal|compliance|risk\b/i,
    /\bprocurement|governance|policy|tender\b/i,
    /\badministrative|administrator|executive assistant\b/i,
  ],
  warm: [
    /\bartist|illustrator|photographer|videographer|musician\b/i,
    /\bwriter|editor|copywriter|storyteller|brand\b/i,
    /\bcommunity|hospitality|teacher|educator|coach\b/i,
    /\bnurse|caregiver|therapist|wellbeing|nonprofit\b/i,
    /\bculture|social impact|customer success|people ops\b/i,
  ],
  technical: [
    /\bengineer|engineering|developer|software|frontend|backend\b/i,
    /\bdata|analytics|scientist|machine learning|ai\b/i,
    /\bdevops|cloud|infrastructure|platform|security\b/i,
    /\bqa|test automation|systems|network|it support\b/i,
    /\barchitect|research scientist|full stack\b/i,
  ],
  balanced: [
    /\bproduct|project manager|program manager|operations\b/i,
    /\bmarketing|growth|sales|account manager\b/i,
    /\bdesigner|ux|ui|service design\b/i,
    /\bconsultant|strategy|partnerships\b/i,
  ],
};

const PROPOSAL_STYLE_DEFINITIONS: Record<
  ResolvedProposalStyleChoice,
  ProposalStyleDefinition
> = {
  formal: {
    label: "Formal",
    description: "Sharper structure and a more composed executive tone.",
    stylePreset: resolveVerbatiStyle({
      layout: "quire",
      typography: "expert",
      palette: "pierre",
    }),
    templateId: getProposalTwinTemplateId({
      layout: "quire",
      typography: "expert",
      palette: "pierre",
    }),
  },
  warm: {
    label: "Warm",
    description: "Friendlier editorial pacing with softer, more human emphasis.",
    stylePreset: resolveVerbatiStyle({
      layout: "editorial",
      typography: "engaging",
      palette: "bordeaux",
    }),
    templateId: getProposalTwinTemplateId({
      layout: "editorial",
      typography: "engaging",
      palette: "bordeaux",
    }),
  },
  technical: {
    label: "Technical",
    description: "Denser signal, stronger structure, and a more precise grid.",
    stylePreset: resolveVerbatiStyle({
      layout: "modernist",
      typography: "expert",
      palette: "encre",
    }),
    templateId: getProposalTwinTemplateId({
      layout: "modernist",
      typography: "expert",
      palette: "encre",
    }),
  },
  balanced: {
    label: "Balanced",
    description: "Calm default with even hierarchy and broad readability.",
    stylePreset: resolveVerbatiStyle({
      layout: "swiss",
      typography: "signature",
      palette: "pierre",
    }),
    templateId: getProposalTwinTemplateId({
      layout: "swiss",
      typography: "signature",
      palette: "pierre",
    }),
  },
};

export function resolveProposalStyleChoice(value: unknown): ProposalStyleChoice {
  return typeof value === "string" &&
    PROPOSAL_STYLE_CHOICES.includes(value as ProposalStyleChoice)
    ? (value as ProposalStyleChoice)
    : "auto";
}

export function inferProposalStyleChoice(input: {
  jobTitle?: string | null;
  jobDescription?: string | null;
}): ResolvedProposalStyleChoice {
  const jobTitle = String(input.jobTitle ?? "").trim();
  const jobDescription = String(input.jobDescription ?? "").trim();
  const combined = `${jobTitle}\n${jobDescription}`.trim();

  if (!combined) {
    return "balanced";
  }

  const scores = Object.entries(PROPOSAL_STYLE_KEYWORDS).map(([choice, patterns]) => {
    const score = patterns.reduce((total, pattern) => {
      let next = total;
      if (pattern.test(jobDescription)) {
        next += 1;
      }
      if (pattern.test(jobTitle)) {
        next += 2;
      }
      return next;
    }, 0);

    return {
      choice: choice as ResolvedProposalStyleChoice,
      score,
    };
  });

  scores.sort((left, right) => right.score - left.score);
  const topMatch = scores[0];

  return topMatch && topMatch.score > 0 ? topMatch.choice : "balanced";
}

export function getProposalStyleDefinition(choice: ProposalStyleChoice): {
  appliedChoice: ResolvedProposalStyleChoice;
  label: string;
  description: string;
  stylePreset: VerbatiStylePreset;
  templateId: ProposalTemplateId;
} {
  const appliedChoice =
    choice === "auto"
      ? inferProposalStyleChoice({})
      : (choice as ResolvedProposalStyleChoice);
  const definition = PROPOSAL_STYLE_DEFINITIONS[appliedChoice];

  return {
    appliedChoice,
    label: definition.label,
    description: definition.description,
    stylePreset: definition.stylePreset,
    templateId: definition.templateId,
  };
}

export function resolveProposalStyleRenderState(input: {
  choice: ProposalStyleChoice;
  jobTitle?: string | null;
  jobDescription?: string | null;
}) {
  const appliedChoice =
    input.choice === "auto"
      ? inferProposalStyleChoice(input)
      : (input.choice as ResolvedProposalStyleChoice);
  const definition = PROPOSAL_STYLE_DEFINITIONS[appliedChoice];

  return {
    choice: input.choice,
    appliedChoice,
    label: input.choice === "auto" ? "Auto" : definition.label,
    description:
      input.choice === "auto"
        ? `Auto-picked ${definition.label.toLowerCase()} for this brief.`
        : definition.description,
    stylePreset: definition.stylePreset,
    templateId: definition.templateId,
  };
}

export function resolveProposalStyleChoiceFromRenderState(input: {
  stylePreset?: Partial<VerbatiStylePreset> | VerbatiStylePreset | null;
  templateId?: ProposalTemplateId | null;
}): ProposalStyleChoice | null {
  const templateId = input.templateId ?? null;
  const normalizedStyle = input.stylePreset
    ? resolveVerbatiStyle(input.stylePreset)
    : null;

  if (!normalizedStyle) {
    return null;
  }

  const match = (
    Object.entries(PROPOSAL_STYLE_DEFINITIONS) as Array<
      [ResolvedProposalStyleChoice, ProposalStyleDefinition]
    >
  ).find(([, definition]) => {
    return (
      definition.templateId === templateId &&
      definition.stylePreset.layout === normalizedStyle.layout &&
      definition.stylePreset.typography === normalizedStyle.typography &&
      definition.stylePreset.palette === normalizedStyle.palette
    );
  });

  return match?.[0] ?? null;
}
