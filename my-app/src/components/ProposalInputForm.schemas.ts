import * as z from "zod";

export const formSchema = z.object({
  jobTitle: z.string().min(2, {
    message: "Job title must be at least 2 characters.",
  }),
  jobDescription: z.string().min(10, {
    message: "Job description must be at least 10 characters.",
  }),
  proposalType: z.enum(["technical", "creative"], {
    required_error: "You must select a proposal type.",
  }),
 formalityLevel: z.enum(["informal", "formal", "neutral"], {
    required_error: "You must select a formality level.",
 }),
  creativity: z.enum(["low", "medium", "high"], {
    required_error: "You must select a creativity level.",
  }),
  modelType: z.enum(["chatgpt", "mistral-small-latest", "mistral-large-latest", "mistral-agent"], {
    required_error: "You must select a model type.",
  }).default("mistral-small-latest"), // Default to mistral-small-latest
});

export type FormValues = z.infer<typeof formSchema>;
