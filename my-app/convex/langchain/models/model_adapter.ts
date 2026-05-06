import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";

/**
 * Schema for model generation configuration
 */
export const ModelGenerationConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
}).partial();

/**
 * Configuration options for model generation
 */
export type ModelGenerationConfig = z.infer<typeof ModelGenerationConfigSchema>;

/**
 * Schema for model initialization configuration
 */
export const ModelInitConfigSchema = z.object({
  apiKey: z.string().min(1),
  organization: z.string().optional(),
  modelName: z.string().optional(),
}).strict();

/**
 * Configuration options for model initialization
 */
export type ModelInitConfig = z.infer<typeof ModelInitConfigSchema>;

/**
 * Metadata about the generated proposal
 */
export interface ProposalMetadata {
  tokens: number;
  completionTime: number;
  modelName: string;
}

/**
 * Schema for validating proposal drafts
 */
export const ProposalDraftSchema = z.object({
  content: z.string().min(1),
  metadata: z.object({
    tokens: z.number().positive(),
    completionTime: z.number().positive(),
    modelName: z.string().min(1),
  }),
  tags: z.array(z.string()),
});

/**
 * Generated proposal draft with metadata
 */
export type ProposalDraft = z.infer<typeof ProposalDraftSchema>;

/**
 * Interface for model adapters
 * Provides a consistent interface for different LLM implementations
 */
export interface ModelAdapter {
  /**
   * Generate text based on a prompt
   * @param prompt The input prompt or array of messages
   * @param config Optional configuration for generation
   * @returns Generated text
   */
  generate(prompt: string | BaseMessage[], config: ModelGenerationConfig): Promise<string>;

  /**
   * Human-readable model label used for logging and provenance.
   */
  getModelName?(): string;

  /**
   * Parse and validate the generated result
   * @param result Raw generated text
   * @returns Validated proposal draft
   */
  parseResult(result: string): Promise<ProposalDraft>;
}

/**
 * Error thrown when model generation fails
 */
export class ModelGenerationError extends Error {
  constructor(
    message: string,
    public readonly prompt?: string | BaseMessage[],
    public readonly config?: ModelGenerationConfig
  ) {
    super(message);
    this.name = "ModelGenerationError";
  }
}

/**
 * Error thrown when result parsing fails
 */
export class ResultParsingError extends Error {
  constructor(
    message: string,
    public readonly result?: string
  ) {
    super(message);
    this.name = "ResultParsingError";
  }
}

/**
 * Default model configuration values
 */
export const DEFAULT_MODEL_CONFIG: Required<ModelGenerationConfig> = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};
