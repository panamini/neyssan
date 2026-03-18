import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Sentry Configuration
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),

  // Monitoring Thresholds
  MONITORING_QUERY_LATENCY_THRESHOLD: z.string().optional(),
  MONITORING_MEMORY_THRESHOLD: z.string().optional(),
  MONITORING_ALERT_RETENTION_DAYS: z.string().optional(),

  // Convex
  CONVEX_DEPLOYMENT: z.string().default('dev:dynamic-raccoon-81'),
  CONVEX_URL: z.string().optional(),

  // Authentication
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // API Keys and External Services
  OPENAI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_AGENT_ID: z.string().optional(), // Add Mistral Agent ID

  // Testing
  TEST_DATABASE_URL: z.string().optional(),
});

// Environment type
export type EnvConfig = z.infer<typeof envSchema>;

// Validate environment variables
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const { fieldErrors } = error.flatten();
      const errorMessages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(', ')}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

// Get validated environment variables
export function getEnvConfig(): EnvConfig {
  return validateEnv(process.env);
}

// Export environment variables
export const env = getEnvConfig();
