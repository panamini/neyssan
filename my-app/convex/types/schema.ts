import type { Doc, Id } from "../_generated/dataModel";
import type { ProposalTemplateId } from "../lib/proposals/renderTemplates";

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
    requestedVoicePreset?:
      | "signature"
      | "expert"
      | "direct"
      | "engaging"
      | "storyteller"
      | null;
    resolvedVoicePreset?:
      | "signature"
      | "expert"
      | "direct"
      | "engaging"
      | "storyteller";
    autoToneDecisionVersion?: "v1";
    autoToneReason?: string;
    formalityLevel?: "informal" | "neutral" | "formal";
    creativity?: "low" | "medium" | "high";
    templateId?: ProposalTemplateId;
    verbatiStyle?: {
      layout: string;
      typography: string;
      palette: string;
      accentHex?: string;
    };
    styleChoice?: "auto" | "formal" | "warm" | "technical" | "balanced";
    templateBundleId?:
      | "swiss_serif"
      | "swiss_mono"
      | "magazine_editorial"
      | "magazine_serif"
      | "grid_mono"
      | "quire_mono";
    typographyOverride?: "signature" | "engaging" | "expert" | null;
    layoutOverride?: "swiss" | "editorial" | "modernist" | "quire" | null;
    applicantName?: string;
    applicantRole?: string;
    contactLine?: string;
    letterDate?: string;
    recipientDetails?: string;
    headerShowSender?: boolean;
    headerShowDate?: boolean;
    headerShowSubject?: boolean;
    headerShowRecipient?: boolean;
    headerShowRecipientDetails?: boolean;
    characterLimitMode?:
      | "none"
      | "linkedin_note_200"
      | "linkedin_inmail_2000"
      | "indeed_cover_letter_4000"
      | "upwork_proposal_advisory"
      | "custom"
      | null;
    characterLimitValue?: number | null;
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
  proposalTemplateId?: ProposalTemplateId;
  proposalStyleChoice?: "auto" | "formal" | "warm" | "technical" | "balanced";
  proposalPaletteOverride?:
    | "sauge"
    | "ocre"
    | "pierre"
    | "bordeaux"
    | "encre"
    | null;
  proposalAccentHex?: string | null;
  proposalFontPairId?: string | null;
  proposalSourceMode?: "inherit_cv" | "proposal_local";
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
