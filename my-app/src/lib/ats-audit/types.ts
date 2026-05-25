import type { CvDocument } from "../../types/cvDocument";

export type AtsAuditCategory =
  | "parsing"
  | "layout"
  | "typography"
  | "sections"
  | "keywords"
  | "content";

export type AtsAuditVerdict =
  | "excellent"
  | "good"
  | "needs_review"
  | "blocked";

export type AtsAuditSeverity = "info" | "warning" | "critical";

export type AtsAuditIssue = {
  id: string;
  category: AtsAuditCategory;
  severity: AtsAuditSeverity;
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
};

export type AtsAuditCategoryScores = Record<AtsAuditCategory, number>;

export type AtsAuditIssuesByCategory = Record<
  AtsAuditCategory,
  AtsAuditIssue[]
>;

export type AtsAuditResult = {
  score: number;
  verdict: AtsAuditVerdict;
  blockers: AtsAuditIssue[];
  categoryScores: AtsAuditCategoryScores;
  issues: AtsAuditIssuesByCategory;
  priorityFixes: AtsAuditIssue[];
};

export type EvaluateCvAtsAuditInput = {
  cv: CvDocument | null | undefined;
  pageCount?: number | null;
  importIssueCount?: number | null;
};
