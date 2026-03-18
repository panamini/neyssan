import * as z from "zod";
import {
  PROPOSAL_CREATIVITY_LEVELS,
  PROPOSAL_FORMALITY_LEVELS,
  PROPOSAL_VOICE_PRESET_IDS,
} from "../../convex/lib/proposals/voicePresets";

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
  voicePreset: z.enum(PROPOSAL_VOICE_PRESET_IDS, {
    required_error: "You must select a voice preset.",
  }),
  formalityLevel: z.enum(PROPOSAL_FORMALITY_LEVELS, {
    required_error: "You must select a formality level.",
  }),
  creativity: z.enum(PROPOSAL_CREATIVITY_LEVELS, {
    required_error: "You must select a creativity level.",
  }),
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
