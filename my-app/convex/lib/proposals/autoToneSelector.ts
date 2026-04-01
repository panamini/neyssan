import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  type ProposalVoicePreset,
} from "./voicePresets";

type PersonalizationContext = {
  topSkills?: string[] | null;
  recentExperience?: Array<unknown> | null;
} | null;

export function selectAutoTone(args: {
  jobTitle?: string | null;
  jobDescription?: string | null;
  personalizationContext?: PersonalizationContext;
  personalizationRichness?: string | null;
}): {
  preset: ProposalVoicePreset;
  reason: string;
} {
  const title = String(args.jobTitle ?? "").toLowerCase();
  const description = String(args.jobDescription ?? "").toLowerCase();
  const text = `${title}\n${description}`;
  const hasRichContext = Boolean(
    args.personalizationContext &&
      ((args.personalizationContext.topSkills?.length ?? 0) > 0 ||
        (args.personalizationContext.recentExperience?.length ?? 0) > 0),
  );

  if (
    /\b(engineer|developer|architect|scientist|analyst|security|platform|backend|frontend|data)\b/.test(
      text,
    )
  ) {
    return { preset: "expert", reason: "technical_role_keywords" };
  }

  if (
    /\b(marketing|sales|community|social|content|brand|customer|partnership|recruit)\b/.test(
      text,
    )
  ) {
    return { preset: "engaging", reason: "relationship_role_keywords" };
  }

  if (hasRichContext && args.personalizationRichness === "rich") {
    return { preset: "expert", reason: "rich_personalization_context" };
  }

  return { preset: DEFAULT_PROPOSAL_VOICE_PRESET, reason: "default_signature" };
}
