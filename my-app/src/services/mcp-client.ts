/* eslint-disable @typescript-eslint/require-await -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { McpClient } from '../types/mcp-client';
import { z } from 'zod';

// Error types
const ClientErrorTypes = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;

interface McpError extends Error {
  type: typeof ClientErrorTypes[keyof typeof ClientErrorTypes];
  details?: unknown;
}

// Tool response validation schemas
const ToolResponseSchemas = {
  fetch_html: z.object({
    html: z.string(),
    url: z.string().url(),
    timestamp: z.string().datetime()
  }),
  check_url_support: z.boolean(),
  detect_platform: z.enum(['upwork', 'linkedin', 'fiverr'] as const),
  save_proposal: z.object({
    success: z.boolean(),
    id: z.string()
  }),
  scrape_job: z.object({
    content: z.string(),
    metadata: z.record(z.string(), z.unknown())
  })
} as const;

// Pure function to create MCP error
function createMcpError(
  message: string,
  type: typeof ClientErrorTypes[keyof typeof ClientErrorTypes],
  details?: unknown
): McpError {
  const error = new Error(message) as McpError;
  error.type = type;
  error.details = details;
  return error;
}

// Pure function to validate tool parameters
function validateToolParams(params: Record<string, unknown>): boolean {
  return Object.values(params).every(value => value !== undefined && value !== null);
}

// Pure function to validate tool response
async function validateToolResponse<T>(
  toolName: string,
  response: unknown
): Promise<T> {
  const schema = ToolResponseSchemas[toolName as keyof typeof ToolResponseSchemas];
  
  if (!schema) {
    return response as T; // No validation schema defined for this tool
  }

  try {
    return schema.parse(response) as T;
  } catch (error) {
    throw createMcpError(
      `Invalid response from tool ${toolName}`,
      ClientErrorTypes.VALIDATION_ERROR,
      error
    );
  }
}

// MCP client implementation following functional programming principles
export function createMcpClient(/* serverUrl: string, apiKey: string */): McpClient {
  // Private state for connection management
  let isConnected = false;
  let connectionPromise: Promise<void> | null = null;

  // Pure function to ensure connection
  async function ensureConnection(): Promise<void> {
    if (isConnected) return;

    if (!connectionPromise) {
      connectionPromise = (async () => {
        try {
          // In real implementation, establish connection to MCP server
          isConnected = true;
        } catch (error) {
          throw createMcpError(
            'Failed to connect to MCP server',
            ClientErrorTypes.CONNECTION_ERROR,
            error
          );
        } finally {
          connectionPromise = null;
        }
      })();
    }

    await connectionPromise;
  }

  // Main client interface
  return {
    async callTool<T>(name: string, params: Record<string, unknown>): Promise<T> {
      try {
        await ensureConnection();

        // Validate parameters
        if (!validateToolParams(params)) {
          throw createMcpError(
            `Invalid parameters for tool ${name}`,
            ClientErrorTypes.INVALID_PARAMS,
            params
          );
        }

        // In real implementation, make actual call to MCP server
        const response = await mockToolCall(name, params);
        
        // Validate response
        return await validateToolResponse<T>(name, response);
      } catch (error) {
        if ((error as McpError).type) {
          throw error;
        }
        throw createMcpError(
          `Failed to execute tool ${name}`,
          ClientErrorTypes.EXECUTION_ERROR,
          error
        );
      }
    }
  };
}

// Temporary mock implementation for development
async function mockToolCall(
  _name: string,
  _params: Record<string, unknown>
): Promise<unknown> {
  // In real implementation, this would make actual calls to the MCP server
  return {
    success: true,
    data: {}
  };
}

// Helper function to create a retry wrapper for tool calls
export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): () => Promise<T> {
  return async () => {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if ((error as McpError).type === ClientErrorTypes.CONNECTION_ERROR) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  };
}
