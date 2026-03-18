import { z } from 'zod';
import { McpClient, JobCaptureRequest, ParsedJob } from '../types';
import { createUpworkParser } from './platforms/upwork';

// Validation schema for HTML content
const HtmlContentSchema = z.object({
  html: z.string(),
  url: z.string().url(),
  timestamp: z.string().datetime()
});

// Error handling types
const ScrapingErrorTypes = {
  FETCH_ERROR: 'FETCH_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM'
} as const;

interface ScrapingError extends Error {
  type: typeof ScrapingErrorTypes[keyof typeof ScrapingErrorTypes];
  details?: unknown;
}

// Pure function to create scraping error
function createScrapingError(
  message: string,
  type: typeof ScrapingErrorTypes[keyof typeof ScrapingErrorTypes],
  details?: unknown
): ScrapingError {
  const error = new Error(message) as ScrapingError;
  error.type = type;
  error.details = details;
  return error;
}

// Pure function to validate HTML content
function validateHtmlContent(content: unknown) {
  try {
    return HtmlContentSchema.parse(content);
  } catch (error) {
    throw createScrapingError(
      'Invalid HTML content format',
      ScrapingErrorTypes.VALIDATION_ERROR,
      error
    );
  }
}

// Pure function to get platform-specific parser
function getParser(platform: string) {
  switch (platform) {
    case 'upwork':
      return createUpworkParser();
    // TODO: Implement other platform parsers
    // case 'linkedin':
    // case 'fiverr':
    default:
      throw createScrapingError(
        `Unsupported platform: ${platform}`,
        ScrapingErrorTypes.UNSUPPORTED_PLATFORM
      );
  }
}

// Main scraping service following functional programming principles
export function createScrapingService(mcpClient: McpClient) {
  return {
    async scrapeJob(request: JobCaptureRequest): Promise<ParsedJob> {
      try {
        // Fetch HTML content using MCP client
        const rawContent = await mcpClient
          .callTool('fetch_html', {
            url: request.url,
            userToken: request.userToken
          })
          .catch(error => {
            throw createScrapingError(
              'Failed to fetch job page',
              ScrapingErrorTypes.FETCH_ERROR,
              error
            );
          });

        // Validate HTML content
        const validatedContent = validateHtmlContent(rawContent);

        // Get appropriate parser for platform
        const parser = getParser(request.platform);

        // Parse job details
        const parsedJob = await parser.parse(validatedContent.html).catch((error: any) => {
          throw createScrapingError(
            'Failed to parse job details',
            ScrapingErrorTypes.PARSE_ERROR,
            error
          );
        });

        return parsedJob;
      } catch (error) {
        // Rethrow ScrapingErrors, wrap other errors
        if ((error as ScrapingError).type) {
          throw error;
        }
        throw createScrapingError(
          'Unexpected error during job scraping',
          ScrapingErrorTypes.PARSE_ERROR,
          error
        );
      }
    },

    // Utility method to check if a URL is supported
    async isUrlSupported(url: string): Promise<boolean> {
      try {
        const response = await mcpClient.callTool('check_url_support', { url });
        return z.boolean().parse(response);
      } catch {
        return false;
      }
    },

    // Method to extract platform from URL
    async detectPlatform(url: string): Promise<string | null> {
      try {
        const response = await mcpClient.callTool('detect_platform', { url });
        const platform = z.enum(['upwork', 'linkedin', 'fiverr'] as const).safeParse(response);
        return platform.success ? platform.data : null;
      } catch {
        return null;
      }
    }
  };
}

