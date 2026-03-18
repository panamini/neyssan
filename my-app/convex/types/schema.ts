import type { Doc, Id } from "../_generated/dataModel";

export interface UserDoc extends Doc<"users"> {
  clerkId: string;
  email: string;
  name?: string;
}

export interface ProposalDoc extends Doc<"proposals"> {
  userId: Id<"userProfiles">;
  title: string;
  content: string;
  status: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  sections: Array<{
    type: "text" | "code" | "image";
    content: string;
  }>;
  metrics: {
    score?: number;
    confidence?: number;
  };
  metadata: {
    platform?: string;
    jobId?: string;
    tags?: string[];
    sourceJobDescription?: string;
    planned_path?: string;
    executed_path?: string;
    fallback_reason?: string;
    validator_outcome?: string;
    save_outcome?: string;
    voicePreset?:
      | "signature"
      | "expert"
      | "direct"
      | "engaging"
      | "storyteller";
    formalityLevel?: "informal" | "neutral" | "formal";
    creativity?: "low" | "medium" | "high";
    proposalType?:
      | "cover_letter"
      | "application_message"
      | "freelance_proposal";
  };
}

export interface UserProfileDoc extends Doc<"userProfiles"> {
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
  proposalVoicePreset?:
    | "signature"
    | "expert"
    | "direct"
    | "engaging"
    | "storyteller";
}

export interface RateLimitDoc extends Doc<"rateLimits"> {
  userId: Id<"users">;
  platform: string;
  currentCount: number;
  previousCount: number;
  windowStart: number;
  createdAt: number;
  updatedAt: number;
}

export interface AnalyticDoc extends Doc<"analytics"> {
  metric: string;
  value: number;
  tags: string[];
  timestamp: number;
}

export interface SyncStatusDoc extends Doc<"syncStatus"> {
  lastSyncId: string;
  lastSyncTime: number;
  status: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MetricDoc extends Doc<"metrics"> {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, any>;
  metadata?: {
    operation?: string;
    status?: string;
    error?: string;
    type?: string;
    table?: string;
    heapTotal?: number;
    rss?: number;
    functionType?: string;
  };
}

export interface AlertDoc extends Doc<"alerts"> {
  type: string;
  severity: string;
  message: string;
  metadata: Record<string, any>;
  resolved: boolean;
  acknowledged: boolean;
  timestamp: number;
  resolvedAt?: number;
}

export interface SessionDoc extends Doc<"sessions"> {
  userId: Id<"users">;
  activeExpires: number;
  idleExpires: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthKeyDoc extends Doc<"authKeys"> {
  userId: Id<"users">;
  hashedPassword: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Documents {
  users: UserDoc;
  proposals: ProposalDoc;
  userProfiles: UserProfileDoc;
  rateLimits: RateLimitDoc;
  analytics: AnalyticDoc;
  syncStatus: SyncStatusDoc;
  metrics: MetricDoc;
  alerts: AlertDoc;
  sessions: SessionDoc;
  authKeys: AuthKeyDoc;
}

export type TableNames = keyof Documents;
