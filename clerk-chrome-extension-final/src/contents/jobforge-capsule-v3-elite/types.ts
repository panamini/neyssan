import type { JobData } from "../_shared/job-scraper";

export type { JobData };

export type SaveVisualState = "idle" | "saving" | "saved" | "error";
export type DockStatus = "ready" | "saving" | "generating" | "generated" | "error";
export type ContextMode = "active-cv" | "raw-job";
export type ExtensionThemeMode = "light" | "dark";

export interface ProposalRoutingSummary {
  attemptedPath?: string | null;
  plannedPath?: string | null;
  executedPath?: string | null;
  fallbackReason?: string | null;
  validatorOutcome?: string | null;
  saveOutcome?: string | null;
}

export interface GeneratedProposalState {
  text: string;
  proposalId?: string;
  actualModelType?: string;
  actualModelName?: string;
  routing?: ProposalRoutingSummary;
}

export interface SavedJobState {
  jobId?: string;
  dedupeHit?: boolean;
  parseStatus: "parsing" | "parsed" | "failed";
  reviewState?: string;
  savedAt: number;
  sourceTitle?: string;
}

export interface ActiveCvSnapshot {
  title: string;
  personalizationContext: {
    name?: string;
    summary?: string;
    desiredPosition?: string;
    topSkills?: string[];
    recentExperience?: Array<{
      company?: string;
      position?: string;
      highlights?: string[];
    }>;
    standoutAchievements?: string[];
  } | null;
  updatedAt?: string;
}

export interface ActiveCvOption extends ActiveCvSnapshot {
  profileId: string;
  subtitle?: string;
}

export interface ToastState {
  message: string;
  id: number;
}
