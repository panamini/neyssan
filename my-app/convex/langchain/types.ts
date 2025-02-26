import { z } from 'zod';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';

// Core schema definitions with strict validation
export const ProposalSectionSchema = z.object({
  title: z.string().min(1, "Section title cannot be empty"),
  content: z.string().min(10, "Section content must be at least 10 characters")
}).strict();

export const ProposalMetricsSchema = z.object({
  duration: z.number().positive("Duration must be a positive number"),
  success: z.boolean()
}).strict();

export const ProposalMetadataSchema = z.object({
  modelName: z.string().min(1, "Model name cannot be empty"),
  tokens: z.number().nonnegative("Token count must be non-negative"),
  completionTime: z.number().positive("Completion time must be positive"),
  fromCache: z.boolean().optional()
}).strict();

export const ProposalSchema = z.object({
  title: z.string().min(3, "Proposal title must be at least 3 characters"),
  content: z.string().min(50, "Proposal content must be at least 50 characters"),
  sections: z.array(ProposalSectionSchema).min(1, "At least one section is required"),
  metrics: ProposalMetricsSchema,
  metadata: ProposalMetadataSchema,
  tags: z.array(z.string().min(2, "Tags must be at least 2 characters")).optional()
}).strict();

// Type inference
export type ProposalSection = z.infer<typeof ProposalSectionSchema>;
export type ProposalMetrics = z.infer<typeof ProposalMetricsSchema>;
export type ProposalMetadata = z.infer<typeof ProposalMetadataSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposalResult = Proposal;

// Parameter types for different proposal types
export interface BaseProposalParams {
  jobDescription: string;
  requirements?: string[];
  budget?: number;
  deadline?: Date;
  scope?: string;
}

export interface TechnicalProposalParams extends BaseProposalParams {
  jobTitle: string;
  requirements: string[];
  preferredTechnologies?: string[];
  expertise?: string[];
  tone: string;
  formalityLevel: string; // Add formalityLevel
  creativity: string;   // Add creativity
}

export interface CreativeProposalParams extends BaseProposalParams {
  creativeDirection: string;
  brandGuidelines?: string;
  targetAudience?: string[];
  contentType?: string;
  brandVoice?: string;
}

// Parser instance with error handling
export const proposalParser = StructuredOutputParser.fromZodSchema(ProposalSchema);

// Type guard for runtime validation
export function isProposalResult(data: unknown): data is ProposalResult {
  return ProposalSchema.safeParse(data).success;
}

// Helper for normalizing content from different message types
export function normalizeMessageContent(message: BaseMessage): string {
  if (message instanceof AIMessage) {
    return typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);
  }
  throw new Error(`Unsupported message type: ${message._getType()}`);
}

// Parse proposal content with error handling
export async function parseProposalContent(content: string | Record<string, any>): Promise<ProposalResult> {
  if (typeof content === 'string') {
    // Attempt to parse as plain text
    try {
      const titleMatch = content.match(/Title: (.*)/);
      const title = titleMatch ? titleMatch[1].trim() : 'No Title Found';
      const sections: ProposalSection[] = [];
      const sectionRegex = /Section \d+:\s*(.*?)\n([\s\S]*?)(?=Section \d+:|Z)/g;
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(content)) !== null) {
        sections.push({
          title: sectionMatch[1].trim(),
          content: sectionMatch[2].trim()
        });
      }

      const plainTextResult: Proposal = {
        title: title,
        content: content, // Use the whole content as proposal content for now
        sections: sections.length > 0 ? sections : [{ title: 'No Sections Found', content: 'No sections were parsed from the plain text response.' }],
        metrics: { duration: 1, success: true }, // Dummy metrics, using positive value
        metadata: { modelName: 'gpt-4-text', tokens: 0, completionTime: 1, fromCache: false }, // Dummy metadata, using positive value
        tags: [], // Dummy tags
      };
      
      // Validate against schema
      ProposalSchema.parse(plainTextResult);
      return plainTextResult;

    } catch (plainTextError) {
      // If plain text parsing fails, try JSON parsing as fallback
      try {
        const contentStr = content; // Use content directly as string
        const result = await proposalParser.parse(contentStr);

        // Additional runtime validation
        if (!isProposalResult(result)) {
          throw new Error('Invalid proposal structure after JSON parsing');
        }
        return result;
      } catch (jsonError) {
        console.error("PlainText Parsing Error:", plainTextError);
        console.error("JSON Parsing Error:", jsonError);
        throw new ProposalParsingError(
          "Failed to parse proposal content as plain text or JSON",
          content,
          jsonError instanceof z.ZodError ? jsonError : undefined // Pass ZodError if available
        );
      }
    }
  } else {
    // Existing JSON parsing logic for Record<string, any> input
    try {
      const contentStr = JSON.stringify(content);
      const result = await proposalParser.parse(contentStr);
      
      // Additional runtime validation
      if (!isProposalResult(result)) {
        throw new Error('Invalid proposal structure after JSON parsing');
      }
      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ProposalParsingError(
          "Failed to parse proposal content as JSON",
          JSON.stringify(content),
          error
        );
      }
      throw error;
    }
  }
}

// Error types for better error handling
export class ProposalParsingError extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
    public readonly zodError?: z.ZodError
  ) {
    super(message);
    this.name = 'ProposalParsingError';
  }
}

export class InvalidMessageTypeError extends Error {
  constructor(actualType: string) {
    super(`Expected AIMessage but got ${actualType}`);
    this.name = 'InvalidMessageTypeError';
  }
}

// Schema namespace for easy access to all schemas
export const Schemas = {
  section: ProposalSectionSchema,
  metrics: ProposalMetricsSchema,
  metadata: ProposalMetadataSchema,
  proposal: ProposalSchema,
} as const;
