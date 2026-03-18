// Export base types and interfaces
export {
  type JobData,
  type BaseScraper,
  JobDataSchema,
  ScrapingError,
} from "./base-scraper";

// Export platform-specific scrapers
export { UpworkScraper } from "./upwork-scraper";

// Import and re-export service types and functions
import {
  ScrapingService,
  createScrapingService,
  type ScrapingServiceConfig,
} from "./scraping-service";

export {
  ScrapingService,
  createScrapingService,
  type ScrapingServiceConfig,
};

// Utility function to create a configured scraping service
export function createDefaultScrapingService(): ScrapingService {
  return createScrapingService({
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    userAgent: "Mozilla/5.0 (compatible; JobProposalBot/1.0)",
  });
}

// Export platform constants
export const SUPPORTED_PLATFORMS = ["upwork"] as const;
export type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number];

// Utility function to validate platform
export function isSupportedPlatform(platform: string): platform is SupportedPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform);
}
