import { z } from 'zod';
import {
  JobCaptureRequest,
  JobCaptureRequestSchema,
  McpClient,
  GeneratedProposal,
} from '../types';
import type { UserProfileDoc as UserProfile } from '../../convex/types/schema'; // Import UserProfileDoc from convex/types/schema using relative path

// Validation schemas for MCP responses
const ScrapeResultSchema = z.object({
  title: z.string(),
  description: z.string(),
  budget: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string()
  }).optional(),
  requirements: z.array(z.string()),
  clientHistory: z.object({
    totalHires: z.number().optional(),
    avgRating: z.number().optional()
  }).optional()
});

const ProposalResultSchema = z.object({
  content: z.string(),
  suggestedRate: z.number().optional(),
  confidence: z.number(),
  timestamp: z.string()
});

// Error types
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SCRAPING_ERROR: 'SCRAPING_ERROR',
  GENERATION_ERROR: 'GENERATION_ERROR',
  PLATFORM_ERROR: 'PLATFORM_ERROR'
} as const;

interface ProposalError extends Error {
  type: typeof ErrorTypes[keyof typeof ErrorTypes];
  details?: unknown;
}

// Pure function to create error
function createError(
  message: string,
  type: typeof ErrorTypes[keyof typeof ErrorTypes],
  details?: unknown
): ProposalError {
  const error = new Error(message) as ProposalError;
  error.type = type;
  error.details = details;
  return error;
}

// Pure function to validate job request
function validateJobRequest(request: unknown): JobCaptureRequest {
  try {
    return JobCaptureRequestSchema.parse(request);
  } catch (error) {
    throw createError(
      'Invalid job request format',
      ErrorTypes.VALIDATION_ERROR,
      error
    );
  }
}

// Pure function to save proposal
async function saveProposal(
  proposal: GeneratedProposal,
  client: McpClient
): Promise<void> {
  try {
    await client.callTool('save_proposal', { proposal });
  } catch (error) {
    throw createError(
      'Failed to save proposal',
      ErrorTypes.PLATFORM_ERROR,
      error
    );
  }
}

// Pure function to send proposal to platform
async function sendToPlatform(
  platform: string,
  proposal: GeneratedProposal,
  client: McpClient
): Promise<void> {
  try {
    await client.callTool(`submit_to_${platform}`, { proposal });
  } catch (error) {
    throw createError(
      `Failed to submit proposal to ${platform}`,
      ErrorTypes.PLATFORM_ERROR,
      error
    );
  }
}

// Main handler function following functional programming principles
export function createProposalHandler(mcpClient: McpClient) {
  return {
    async generateAndSend(
      jobRequest: unknown,
      userProfile: UserProfile
    ): Promise<GeneratedProposal> {
      // Validate input
      const validatedRequest = validateJobRequest(jobRequest);

      try {
        // Scrape job details
        const scrapeResult = await mcpClient
          .callTool('scrape_job', validatedRequest)
          .then(result => ScrapeResultSchema.parse(result))
          .catch(error => {
            throw createError(
              'Failed to scrape job details',
              ErrorTypes.SCRAPING_ERROR,
              error
            );
          });

        // Generate proposal
        const proposalResult = await mcpClient
          .callTool('generate_proposal', {
            jobDetails: scrapeResult,
            tone: userProfile.preferences.tonePreference,
            userHistory: {
              commonPhrases: userProfile.preferences.writingStyle,
              formalityLevel: userProfile.preferences.writingStyle
            }
          })
          .then(result => ProposalResultSchema.parse(result))
          .catch(error => {
            throw createError(
              'Failed to generate proposal',
              ErrorTypes.GENERATION_ERROR,
              error
            );
          });

        // Create proposal object
        const proposal: GeneratedProposal = {
          id: crypto.randomUUID(),
          content: proposalResult.content,
          jobId: validatedRequest.url,
          platform: validatedRequest.platform,
          createdAt: new Date(),
          status: 'draft',
          metrics: {
            readability: 0, // Would be calculated in real implementation
            relevance: 0, // Would be calculated in real implementation
            confidence: proposalResult.confidence
          }
        };

        // Save proposal
        await saveProposal(proposal, mcpClient);

        // Auto-send if enabled
        if (userProfile.preferences.autoSend) {
          await sendToPlatform(
            validatedRequest.platform,
            proposal,
            mcpClient
          );
          proposal.status = 'sent';
        }

        return proposal;
      } catch (error) {
        // Rethrow ProposalErrors, wrap other errors
        if ((error as ProposalError).type) {
          throw error;
        }
        throw createError(
          'Unexpected error during proposal generation',
          ErrorTypes.GENERATION_ERROR,
          error
        );
      }
    }
  };
}
