import { BaseScraper, JobData, ScrapingError } from "./base-scraper";
import { UpworkScraper } from "./upwork-scraper";

/**
 * Configuration for the scraping service
 */
export interface ScrapingServiceConfig {
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  userAgent?: string;
}

/**
 * Service for managing job data scraping across different platforms
 */
export class ScrapingService {
  private scrapers: BaseScraper[];
  private readonly config: Required<ScrapingServiceConfig>;

  constructor(config: ScrapingServiceConfig = {}) {
    // Initialize with default configuration
    this.config = {
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 30000,
      userAgent: config.userAgent ?? "Mozilla/5.0 (compatible; JobProposalBot/1.0)",
    };

    // Initialize scrapers
    this.scrapers = [
      new UpworkScraper(),
      // Add more scrapers here as they're implemented
    ];
  }

  /**
   * Scrapes job data from a URL
   */
  async scrapeJob(url: string): Promise<JobData> {
    // Find appropriate scraper
    const scraper = this.findScraper(url);
    if (!scraper) {
      throw new ScrapingError(
        "No scraper available for this URL",
        url,
        "unknown"
      );
    }

    // Attempt scraping with retries
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.attemptScrape(scraper, url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Log retry attempt
        console.warn(
          `Scraping attempt ${attempt} failed for ${url}: ${lastError.message}`
        );

        // If this wasn't the last attempt, wait before retrying
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    // If we get here, all attempts failed
    throw new ScrapingError(
      `Failed to scrape job after ${this.config.retryAttempts} attempts`,
      url,
      scraper.getPlatform(),
      lastError
    );
  }

  /**
   * Finds a scraper that can handle the given URL
   */
  private findScraper(url: string): BaseScraper | undefined {
    return this.scrapers.find(scraper => scraper.supportsUrl(url));
  }

  /**
   * Attempts to scrape with timeout
   */
  private async attemptScrape(
    scraper: BaseScraper,
    url: string
  ): Promise<JobData> {
    return Promise.race([
      scraper.scrapeJob(url),
      this.timeout(this.config.timeout),
    ]);
  }

  /**
   * Creates a timeout promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    );
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets supported platforms
   */
  getSupportedPlatforms(): string[] {
    return this.scrapers.map(scraper => scraper.getPlatform());
  }

  /**
   * Checks if a URL is supported
   */
  isUrlSupported(url: string): boolean {
    return this.scrapers.some(scraper => scraper.supportsUrl(url));
  }
}

/**
 * Creates a scraping service with the given configuration
 */
export function createScrapingService(
  config?: ScrapingServiceConfig
): ScrapingService {
  return new ScrapingService(config);
}
