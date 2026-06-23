/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
export * from './mcp-client';

export interface JobCaptureRequest {
    url: string;
    platform: string;
    [key: string]: any;
}

import { z } from 'zod';

export const JobCaptureRequestSchema = z.object({
    url: z.string().url(),
    platform: z.string(),
});

export interface GeneratedProposal {
    id: string;
    content: string;
    jobId: string;
    platform: string;
    createdAt: Date;
    status: string;
    metrics: {
        readability: number;
        relevance: number;
        confidence: number;
    };
}

export type Urgency = 'high' | 'medium' | 'low';

export interface ParsedJob {
    title: string;
    description: string;
    skills: string[];
    urgency: Urgency;
    postedDate: Date;
    budget?: {
        min?: number;
        max?: number;
        currency: string;
    };
    clientInfo: {
        rating?: number;
        totalSpent?: number;
        location?: string;
    };
}

export interface PlatformParser {
    parse(content: string): Promise<ParsedJob>;
}

export interface UserProfileDoc {
    clerkId: string;
    email: string;
    name?: string;
    version: number;
    createdAt: number;
    updatedAt: number;
    preferences: {
        rateLimits?: any;
        writingStyle: string;
        tonePreference: string;
        autoSend: boolean;
    };
}

export interface ToneSettings {
  type: 'formal' | 'friendly' | 'technical';
  level: 1 | 2 | 3 | 4 | 5;
  customInstructions?: string;
}

export type ToneMapType = {
  [key in ToneSettings['type']]: {
    [level in ToneSettings['level']]: string;
  };
};

export const PLATFORMS = ['upwork', 'freelancer', 'linkedin']; // Example platforms

export { PlatformParser };