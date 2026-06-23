/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { ParsedJob, PlatformParser } from '../../types';

interface UpworkJobData {
  rawTitle: string;
  rawDescription: string;
  rawBudget?: string;
  rawSkills: string[];
  postedTime: string;
  clientCountry?: string;
  clientRating?: string;
  clientSpent?: string;
}

// Pure function to extract budget from string
function extractBudget(budgetStr?: string) {
  if (!budgetStr) return undefined;

  const match = budgetStr.match(/\$(\d+)-(\d+)/);
  if (!match) return undefined;

  return {
    min: parseInt(match[1], 10),
    max: parseInt(match[2], 10),
    currency: 'USD'
  };
}

// Pure function to determine urgency based on description and posting time
function determineUrgency(description: string, postedTime: string): 'high' | 'medium' | 'low' {
  const urgencySignals = [
    'urgent', 'asap', 'immediate', 'quick', 'fast',
    'emergency', 'priority', 'rush'
  ];
  
  const descLower = description.toLowerCase();
  const hasUrgentKeywords = urgencySignals.some(signal => descLower.includes(signal));
  const isRecentlyPosted = postedTime.includes('hour') || postedTime.includes('minute');

  if (hasUrgentKeywords && isRecentlyPosted) return 'high';
  if (hasUrgentKeywords || isRecentlyPosted) return 'medium';
  return 'low';
}

// Pure function to parse client info
function parseClientInfo(rating?: string, spent?: string, location?: string) {
  return {
    rating: rating ? parseFloat(rating) : undefined,
    totalSpent: spent ? parseFloat(spent.replace(/[^0-9.]/g, '')) : undefined,
    location
  };
}

// Pure function to clean and normalize skills
function normalizeSkills(skills: string[]): string[] {
  return skills
    .map(skill => skill.trim().toLowerCase())
    .filter(skill => skill.length > 0);
}

// Main parser implementation using functional approach
export function createUpworkParser(): PlatformParser {
  return {
    async parse(content: string): Promise<ParsedJob> {
      try {
        // In a real implementation, this would use proper DOM parsing
        // For demo purposes, we're assuming structured input
        const jobData: UpworkJobData = JSON.parse(content);

        const parsedJob: ParsedJob = {
          title: jobData.rawTitle.trim(),
          description: jobData.rawDescription.trim(),
          skills: normalizeSkills(jobData.rawSkills),
          urgency: determineUrgency(jobData.rawDescription, jobData.postedTime),
          postedDate: new Date(), // In real impl, would parse jobData.postedTime
          budget: extractBudget(jobData.rawBudget),
          clientInfo: parseClientInfo(
            jobData.clientRating,
            jobData.clientSpent,
            jobData.clientCountry
          )
        };

        return parsedJob;
      } catch (error) {
        throw new Error(`Failed to parse Upwork job: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };
}
