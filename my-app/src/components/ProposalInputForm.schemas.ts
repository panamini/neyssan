import * as z from "zod";
import {
  PROPOSAL_CREATIVITY_LEVELS,
  PROPOSAL_FORMALITY_LEVELS,
  PROPOSAL_VOICE_PRESET_IDS,
} from "../../convex/lib/proposals/voicePresets";

const PROPOSAL_TONE_TUNING_VALUES = [
  "more_human",
  "more_direct",
  "more_structured",
  "more_confident",
] as const;

const PROPOSAL_CHARACTER_LIMIT_MODE_VALUES = [
  "none",
  "linkedin_note_200",
  "linkedin_inmail_2000",
  "indeed_cover_letter_4000",
  "upwork_proposal_advisory",
  "custom",
] as const;

export const formSchema = z.object({
  jobTitle: z.string().min(2, {
    message: "Job title must be at least 2 characters.",
  }),
  jobDescription: z.string().min(10, {
    message: "Job description must be at least 10 characters.",
  }),
  proposalType: z.enum(
    ["cover_letter", "application_message", "freelance_proposal"],
    {
      required_error: "You must select a proposal type.",
    },
  ),
  voicePreset: z.enum(PROPOSAL_VOICE_PRESET_IDS).optional(),
  formalityLevel: z.enum(PROPOSAL_FORMALITY_LEVELS).optional(),
  creativity: z.enum(PROPOSAL_CREATIVITY_LEVELS).optional(),
  toneTuning: z.enum(PROPOSAL_TONE_TUNING_VALUES).nullable().optional(),
  characterLimitMode: z
    .enum(PROPOSAL_CHARACTER_LIMIT_MODE_VALUES)
    .nullable()
    .optional()
    .default("none"),
  characterLimitValue: z.number().nullable().optional().default(1500),
  modelType: z
    .enum(
      [
        "chatgpt",
        "mistral-small-latest",
        "mistral-large-latest",
        "mistral-agent",
      ],
      {
        required_error: "You must select a model type.",
      },
    )
    .default("chatgpt"),
});

export type FormValues = z.infer<typeof formSchema>;
