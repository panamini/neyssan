import { z } from "zod";
import { GPT4Adapter } from "./gpt4_adapter";
import type { ModelAdapter } from "./model_adapter"

/**
 * Schema for model configuration
 */
export const ModelConfigSchema = z.object({
  apiKey: z.string().min(1),
  organization: z.string().optional(),
}).strict();

/**
 * Configuration options for model creation
 */
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

/**
 * Create a model adapter instance
 */
export function createModelAdapter(
  type: "gpt4",
  config: ModelConfig
): ModelAdapter {
  // Validate configuration
  const validatedConfig = ModelConfigSchema.parse(config);

  // Create appropriate adapter
  switch (type) {
    case "gpt4":
      return new GPT4Adapter({
        apiKey: validatedConfig.apiKey,
        organization: validatedConfig.organization,
      });
    default:
      throw new Error(`Unsupported model type: ${type as string}`);
  }
}

// Re-export types and utilities
export * from "./model_adapter";
