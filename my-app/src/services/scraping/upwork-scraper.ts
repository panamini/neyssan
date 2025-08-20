import axios from "axios";
import { JSDOM } from "jsdom";
import { AbstractScraper, JobData } from "./base-scraper";

/**
 * Scraper for Upwork job listings
 */
export class UpworkScraper extends AbstractScraper {
  constructor() {
    super(
      "upwork",
      /^https?:\/\/(?:www\.)?upwork\.com\/(?:jobs|projects)\/[^/]+(?:\/|$)/
    );
  }

  /**
   * Scrapes job data from an Upwork URL
   */
  async scrapeJob(url: string): Promise<JobData> {
    try {
      // Validate URL
      if (!this.supportsUrl(url)) {
        throw new Error(`Invalid Upwork URL: ${url}`);
      }

      // Fetch page content
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobProposalBot/1.0)",
        },
      });

      // Parse HTML
      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      // Extract job data
      const jobData = {
        title: this.extractTitle(document),
        description: this.extractDescription(document),
        budget: this.extractBudget(document),
        skills: this.extractSkills(document),
        category: this.extractCategory(document),
        postedDate: this.extractPostedDate(document),
        clientInfo: this.extractClientInfo(document),
      };

      // Validate and return
      return this.validateJobData(jobData);
    } catch (error) {
      return this.handleError(error, url);
    }
  }

  /**
   * Extracts the job title
   */
  private extractTitle(document: Document): string {
    const titleElement = document.querySelector("h1");
    if (!titleElement?.textContent) {
      throw new Error("Could not find job title");
    }
    return titleElement.textContent.trim();
  }

  /**
   * Extracts the job description
   */
  private extractDescription(document: Document): string {
    const descElement = document.querySelector(".job-description");
    if (!descElement?.textContent) {
      throw new Error("Could not find job description");
    }
    return descElement.textContent.trim();
  }

  /**
   * Extracts the budget information
   */
  private extractBudget(document: Document): JobData["budget"] {
    const budgetElement = document.querySelector(".budget");
    if (!budgetElement?.textContent) return undefined;

    const text = budgetElement.textContent.toLowerCase();
    
    // Check if hourly
    if (text.includes("hourly")) {
      const range = this.extractBudgetRange(text);
      return range ? {
        type: "hourly",
        range,
      } : {
        type: "hourly",
      };
    }

    // Check if fixed
    const amount = this.extractBudgetAmount(text);
    return amount ? {
      type: "fixed",
      amount,
    } : {
      type: "fixed",
    };
  }

  /**
   * Extracts budget range from text
   */
  private extractBudgetRange(text: string): { min: number; max: number } | undefined {
    const match = text.match(/\$(\d+(?:\.\d{2})?)\s*-\s*\$(\d+(?:\.\d{2})?)/);
    if (!match) return undefined;

    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    return { min, max };
  }

  /**
   * Extracts budget amount from text
   */
  private extractBudgetAmount(text: string): number | undefined {
    const match = text.match(/\$(\d+(?:\.\d{2})?)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Extracts required skills
   */
  private extractSkills(document: Document): string[] {
    const skillElements = document.querySelectorAll(".skill-tag");
    return Array.from(skillElements).map(el => el.textContent?.trim() || "")
      .filter(skill => skill.length > 0);
  }

  /**
   * Extracts job category
   */
  private extractCategory(document: Document): string | undefined {
    const categoryElement = document.querySelector(".category");
    return categoryElement?.textContent?.trim();
  }

  /**
   * Extracts posting date
   */
  private extractPostedDate(document: Document): Date | undefined {
    const dateElement = document.querySelector(".posted-date");
    if (!dateElement?.textContent) return undefined;

    const timestamp = dateElement.getAttribute("data-timestamp");
    if (timestamp) {
      return new Date(parseInt(timestamp, 10));
    }

    // Fallback to text parsing
    const text = dateElement.textContent.trim().toLowerCase();
    if (text.includes("just now")) {
      return new Date();
    }

    // Handle relative dates
    const timeMatch = text.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/);
    if (timeMatch) {
      const [, amount, unit] = timeMatch;
      const date = new Date();
      switch (unit) {
        case "minute":
          date.setMinutes(date.getMinutes() - parseInt(amount, 10));
          break;
        case "hour":
          date.setHours(date.getHours() - parseInt(amount, 10));
          break;
        case "day":
          date.setDate(date.getDate() - parseInt(amount, 10));
          break;
        case "week":
          date.setDate(date.getDate() - (parseInt(amount, 10) * 7));
          break;
        case "month":
          date.setMonth(date.getMonth() - parseInt(amount, 10));
          break;
      }
      return date;
    }

    return undefined;
  }

  /**
   * Extracts client information
   */
  private extractClientInfo(document: Document): JobData["clientInfo"] {
    const clientSection = document.querySelector(".client-info");
    if (!clientSection) return undefined;

    const rating = this.extractRating(clientSection);
    const totalSpent = this.extractTotalSpent(clientSection);
    const location = this.extractLocation(clientSection);
    const projectCount = this.extractProjectCount(clientSection);

    return {
      rating,
      totalSpent,
      location,
      projectCount,
    };
  }

  /**
   * Extracts client rating
   */
  private extractRating(element: Element): number | undefined {
    const ratingElement = element.querySelector(".rating");
    const text = ratingElement?.textContent;
    if (!text) return undefined;

    const match = text.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Extracts total amount spent by client
   */
  private extractTotalSpent(element: Element): number | undefined {
    const spentElement = element.querySelector(".total-spent");
    const text = spentElement?.textContent;
    if (!text) return undefined;

    const match = text.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    return match ? parseFloat(match[1].replace(/,/g, "")) : undefined;
  }

  /**
   * Extracts client location
   */
  private extractLocation(element: Element): string | undefined {
    const locationElement = element.querySelector(".location");
    return locationElement?.textContent?.trim();
  }

  /**
   * Extracts number of projects posted by client
   */
  private extractProjectCount(element: Element): number | undefined {
    const projectElement = element.querySelector(".project-count");
    const text = projectElement?.textContent;
    if (!text) return undefined;

    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }
}
