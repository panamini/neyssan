import type { Doc, Id } from "../_generated/dataModel";


// Document types
export interface MetricDoc extends Doc<"metrics"> {
  timestamp: number;
  name: string;
  value: number;
  labels: Record<string, string>;
}

export interface AlertDoc extends Doc<"alerts"> {
  name: string;
  severity: "info" | "warning" | "error";
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

export interface UserDoc extends Doc<"userProfiles"> {
  clerkId: string;
  email: string;
  name?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  preferences: {
    rateLimits?: {};
    writingStyle: string;
    tonePreference: string;
    autoSend: boolean;
  };
}

export interface SessionDoc extends Doc<"sessions"> {
  userId: string;
  activeExpires: number;
  idleExpires: number;
  createdAt: number;
  updatedAt: number;
}

export interface AuthKeyDoc extends Doc<"authKeys"> {
  userId: string;
  hashedPassword: string | null;
  createdAt: number;
  updatedAt: number;
}

// Document map
export interface Documents {
  metrics: MetricDoc;
  alerts: AlertDoc;
  userProfiles: UserDoc;
  sessions: SessionDoc;
  authKeys: AuthKeyDoc;
}

// Table names
export type TableNames = keyof Documents;
