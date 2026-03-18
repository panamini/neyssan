import { z } from "zod";

/**
 * Schema for job data
 */
export const JobDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  budget: z.object({
    type: z.enum(["fixed", "hourly"]),
    amount: z.number().optional(),
    range: z.object({
      min: z.number(),
      max: z.number(),
    }).optional(),
  }).optional(),
  skills: z.array(z.string()).default([]),
  category: z.string().optional(),
  postedDate: z.date().optional(),
  deadline: z.date().optional(),
  clientInfo: z.object({
    rating: z.number().min(0).max(5).optional(),
    totalSpent: z.number().optional(),
    location: z.string().optional(),
    projectCount: z.number().optional(),
  }).optional(),
});

export type JobData = z.infer<typeof JobDataSchema>;

/**
 * Base scraper interface
 */
export interface BaseScraper {
  /**
   * Extracts job data from a URL
   */
  scrapeJob(url: string): Promise<JobData>;

  /**
   * Validates if a URL is supported by this scraper
   */
  supportsUrl(url: string): boolean;

  /**
   * Gets the platform name
   */
  getPlatform(): string;
}

/**
 * Error thrown when scraping fails
 */
export class ScrapingError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly platform: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ScrapingError";
  }
}

/**
 * Abstract base class for scrapers
 */
export abstract class AbstractScraper implements BaseScraper {
  protected constructor(
    protected readonly platform: string,
    protected readonly urlPattern: RegExp
  ) {}

  abstract scrapeJob(url: string): Promise<JobData>;

  supportsUrl(url: string): boolean {
    return this.urlPattern.test(url);
  }

  getPlatform(): string {
    return this.platform;
  }

  /**
   * Validates and cleans job data
   */
  protected validateJobData(data: unknown): JobData {
    try {
      return JobDataSchema.parse(data);
    } catch (error) {
      throw new ScrapingError(
        `Invalid job data: ${error instanceof Error ? error.message : "Unknown error"}`,
        "unknown",
        this.platform,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Handles scraping errors
   */
  protected handleError(error: unknown, url: string): never {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ScrapingError(message, url, this.platform, error instanceof Error ? error : undefined);
  }
}
