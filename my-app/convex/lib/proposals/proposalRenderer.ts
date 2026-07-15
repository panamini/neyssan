import { normalizeProposalConstraintText } from "./proposalPlanner";
import type {
  ProposalOutputFormat,
  ProposalOutputLanguage,
} from "./proposalOutput";
import { getDeterministicCopyLanguage } from "./proposalOutput";
import type { ProposalVoicePreset } from "./voicePresets";

export const ENGLISH_SALUTATION = "Dear Hiring Manager,";
export const FRENCH_SALUTATION = "Madame, Monsieur,";
export const ENGLISH_DEFAULT_SIGNOFF = "Sincerely,";
export const FRENCH_DEFAULT_SIGNOFF =
  "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.";

export const ENGLISH_SIGNOFFS: Record<ProposalVoicePreset, string> = {
  signature: ENGLISH_DEFAULT_SIGNOFF,
  expert: ENGLISH_DEFAULT_SIGNOFF,
  direct: ENGLISH_DEFAULT_SIGNOFF,
  engaging: ENGLISH_DEFAULT_SIGNOFF,
  storyteller: ENGLISH_DEFAULT_SIGNOFF,
};

export const FRENCH_SIGNOFFS: Record<ProposalVoicePreset, string> = {
  signature: FRENCH_DEFAULT_SIGNOFF,
  expert: FRENCH_DEFAULT_SIGNOFF,
  direct: FRENCH_DEFAULT_SIGNOFF,
  engaging: FRENCH_DEFAULT_SIGNOFF,
  storyteller: FRENCH_DEFAULT_SIGNOFF,
};

export const ENGLISH_SAFE_FINAL_SENTENCES = {
  standard: [
    "I would welcome the opportunity to discuss the position further.",
    "I would welcome the chance to discuss the position further.",
    "I would welcome the opportunity to speak further about the position.",
    "I would be glad to discuss the position further.",
    "I would welcome the chance to speak further about the position.",
  ],
  interestOnly: [
    "I would welcome the opportunity to discuss my interest in the role.",
    "I would welcome the chance to discuss my interest in the role.",
    "I would welcome the opportunity to speak further about the role.",
    "I would be glad to discuss my interest in the role.",
    "I would welcome the chance to speak further about the role.",
  ],
} as const;

export const FRENCH_SAFE_FINAL_SENTENCES = {
  standard: [
    "Je serais disponible pour échanger davantage au sujet du poste.",
    "Je serais disponible pour discuter davantage du poste.",
    "Je serais disponible pour poursuivre l'échange au sujet du poste.",
    "Je serais disponible pour échanger plus en détail au sujet du poste.",
    "Je serais disponible pour poursuivre la discussion au sujet du poste.",
  ],
  interestOnly: [
    "Je serais disponible pour échanger davantage au sujet de mon intérêt pour le poste.",
    "Je serais disponible pour discuter davantage de mon intérêt pour le poste.",
    "Je serais disponible pour poursuivre l'échange au sujet du rôle.",
    "Je serais disponible pour échanger plus en détail au sujet de mon intérêt pour le poste.",
    "Je serais disponible pour poursuivre la discussion au sujet de mon intérêt pour le poste.",
  ],
} as const;

export const ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE =
  "If useful, I can share a bit more detail.";
export const FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE =
  "Je peux en dire un peu plus si utile.";

export type ProposalRenderPolicy = {
  salutation?: string;
  signOff?: string;
  finalSentence?: string;
  includeCandidateNameLine: boolean;
};

export type ProposalTextSection = {
  type: "text";
  content: string;
};

export type ApplicationMessageParts = {
  opener: string;
  proofLine: string;
  followUpLine: string;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripOuterCodeFences(value: string): string {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```[a-z0-9_-]*\s*([\s\S]*?)\s*```$/i);
  return fenceMatch?.[1] ? fenceMatch[1].trim() : trimmed;
}

function ensureSentenceEnding(value: string): string {
  const compact = compactWhitespace(value);
  if (!compact) return "";
  return /[.!?…]$/u.test(compact) ? compact : `${compact}.`;
}

function compactParagraphSpacing(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitParagraphs(text: string): string[] {
  return compactParagraphSpacing(text)
    .split(/\n{2,}/)
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean);
}

function paragraphAlreadyEndsWithFinalSentence(args: {
  paragraph: string | undefined;
  normalizedFinalSentence: string;
}): boolean {
  if (!args.paragraph || !args.normalizedFinalSentence) {
    return false;
  }

  const normalizedParagraph = normalizeProposalConstraintText(args.paragraph);
  return (
    normalizedParagraph === args.normalizedFinalSentence ||
    normalizedParagraph.endsWith(` ${args.normalizedFinalSentence}`)
  );
}

const VOICE_PRESET_RENDER_ORDER: ProposalVoicePreset[] = [
  "signature",
  "expert",
  "direct",
  "engaging",
  "storyteller",
];

function selectDeterministicFinalSentenceVariant(args: {
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): string | null {
  const deterministicLanguage = getDeterministicCopyLanguage(
    args.outputLanguage,
  );
  if (!deterministicLanguage) return null;
  const pools =
    deterministicLanguage === "fr"
      ? FRENCH_SAFE_FINAL_SENTENCES
      : ENGLISH_SAFE_FINAL_SENTENCES;
  const variants = args.noContextMode ? pools.interestOnly : pools.standard;
  const presetIndex = VOICE_PRESET_RENDER_ORDER.indexOf(args.voicePreset);
  const variantIndex = presetIndex >= 0 ? presetIndex % variants.length : 0;
  return variants[variantIndex];
}

export function getDeterministicProposalRenderPolicy(args: {
  format: ProposalOutputFormat;
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): ProposalRenderPolicy {
  const deterministicLanguage = getDeterministicCopyLanguage(
    args.outputLanguage,
  );
  const finalSentence =
    args.format === "cover_letter"
      ? selectDeterministicFinalSentenceVariant({
          outputLanguage: args.outputLanguage,
          voicePreset: args.voicePreset,
          noContextMode: args.noContextMode,
        })
      : deterministicLanguage === "fr"
        ? FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE
        : deterministicLanguage === "en"
          ? ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE
          : undefined;

  if (args.format !== "cover_letter") {
    return {
      ...(finalSentence ? { finalSentence } : {}),
      includeCandidateNameLine: false,
    };
  }

  if (!deterministicLanguage) {
    return {
      ...(finalSentence ? { finalSentence } : {}),
      includeCandidateNameLine: false,
    };
  }

  return {
    salutation:
      deterministicLanguage === "fr" ? FRENCH_SALUTATION : ENGLISH_SALUTATION,
    signOff: deterministicLanguage === "fr"
      ? FRENCH_DEFAULT_SIGNOFF
      : ENGLISH_DEFAULT_SIGNOFF,
    ...(finalSentence ? { finalSentence } : {}),
    includeCandidateNameLine: true,
  };
}

export function applyDeterministicProposalBoundaries(args: {
  body: string;
  format: Extract<ProposalOutputFormat, "cover_letter" | "application_message">;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
  finalSentenceOverride?: string | null;
}): string {
  const policy = getDeterministicProposalRenderPolicy({
    format: args.format,
    outputLanguage: args.outputLanguage,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
  });
  const finalSentence =
    args.finalSentenceOverride === undefined
      ? policy.finalSentence
      : compactWhitespace(args.finalSentenceOverride ?? "") || undefined;
  const paragraphs = splitParagraphs(args.body);
  const normalizedFinalSentence = normalizeProposalConstraintText(
    finalSentence ?? "",
  );

  if (args.format === "application_message") {
    const collapsedBody = compactWhitespace(splitParagraphs(args.body).join(" "));
    return collapsedBody;
  }

  if (
    finalSentence &&
    (paragraphs.length === 0 ||
      !paragraphAlreadyEndsWithFinalSentence({
        paragraph: paragraphs[paragraphs.length - 1],
        normalizedFinalSentence,
      }))
  ) {
    paragraphs.push(finalSentence);
  }

  const lines: string[] = [];
  const bodyBlock = paragraphs.join("\n\n");
  if (policy.salutation) {
    lines.push(policy.salutation, "");
  }
  if (bodyBlock) {
    lines.push(bodyBlock);
  }
  if (policy.signOff) {
    lines.push("", policy.signOff);
  }
  if (policy.includeCandidateNameLine && args.candidateName) {
    lines.push(args.candidateName);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function parseStructuredApplicationMessageParts(
  value: string,
): ApplicationMessageParts | null {
  const lines = stripOuterCodeFences(value)
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter(Boolean);

  let opener = "";
  let proofLine = "";
  let followUpLine = "";

  for (const line of lines) {
    const match = line.match(/^(opener|proof_line|follow_up_line):\s*(.+)$/i);
    if (!match?.[1] || !match[2]) continue;
    const field = match[1].toLowerCase();
    const content = compactWhitespace(match[2].replace(/^["'`]+|["'`]+$/g, ""));
    if (!content) continue;
    if (field === "opener") opener = content;
    if (field === "proof_line") proofLine = content;
    if (field === "follow_up_line") followUpLine = content;
  }

  if (!opener || !proofLine || !followUpLine) {
    return null;
  }

  return {
    opener,
    proofLine,
    followUpLine,
  };
}

export function renderStructuredApplicationMessage(args: {
  parts: ApplicationMessageParts;
}): { content: string; sections: ProposalTextSection[] } {
  const content = [
    ensureSentenceEnding(args.parts.opener),
    ensureSentenceEnding(args.parts.proofLine),
    ensureSentenceEnding(args.parts.followUpLine),
  ]
    .map((part) => compactWhitespace(part))
    .filter(Boolean)
    .join(" ");

  return {
    content,
    sections: [{ type: "text", content }],
  };
}

export function renderStructuredCoverLetter(args: {
  bodyParagraphs: string[];
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): { content: string; sections: ProposalTextSection[] } {
  const body = args.bodyParagraphs
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean)
    .join("\n\n");
  const content = applyDeterministicProposalBoundaries({
    body,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
  });

  return {
    content,
    sections: [{ type: "text", content }],
  };
}
