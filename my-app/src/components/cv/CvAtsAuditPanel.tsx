import React from "react";
import { CaretRight } from "@/lib/icons";
import { Button, Pill, Sheet } from "../ui";
import type {
  AtsAuditCategory,
  AtsAuditIssue,
  AtsAuditResult,
} from "../../lib/ats-audit/types";

const ATS_AUDIT_CATEGORIES: AtsAuditCategory[] = [
  "parsing",
  "layout",
  "typography",
  "sections",
  "keywords",
  "content",
];

const CATEGORY_LABELS: Record<AtsAuditCategory, string> = {
  parsing: "Parsing",
  layout: "Layout",
  typography: "Typography",
  sections: "Sections",
  keywords: "Keywords",
  content: "Content",
};

function getVerdictTone(verdict: AtsAuditResult["verdict"]) {
  if (verdict === "blocked") return "danger";
  if (verdict === "needs_review") return "warning";
  if (verdict === "excellent") return "success";
  return "neutral";
}

function getIssueTone(issue: AtsAuditIssue) {
  if (issue.severity === "critical") return "danger";
  if (issue.severity === "warning") return "warning";
  return "neutral";
}

function IssueList({
  issues,
  emptyLabel,
  onOpenImportReview,
}: {
  issues: AtsAuditIssue[];
  emptyLabel: string;
  onOpenImportReview: () => void;
}): JSX.Element {
  if (issues.length === 0) {
    return <p className="dasti-cv-ats-panel__empty">{emptyLabel}</p>;
  }

  return (
    <ul className="dasti-cv-ats-panel__issues">
      {issues.map((issue) => (
        <li key={issue.id} className="dasti-cv-ats-panel__issue">
          <div className="dasti-cv-ats-panel__issue-copy">
            <strong>{issue.title}</strong>
            <small>{issue.detail}</small>
          </div>
          <div className="dasti-cv-ats-panel__issue-actions">
            <Pill tone={getIssueTone(issue)}>{issue.priority}</Pill>
            {issue.id === "unresolved-import-review" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onOpenImportReview}
              >
                Open import review
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CvAtsAuditPanel({
  open,
  audit,
  onOpenChange,
  onOpenImportReview,
}: {
  open: boolean;
  audit: AtsAuditResult | null;
  onOpenChange: (open: boolean) => void;
  onOpenImportReview: () => void;
}): JSX.Element {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="ATS audit"
      description="Heuristic checks from the editable CV and export model. This does not guarantee parser compatibility."
      className="dasti-cv-ats-sheet"
      footer={
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      }
    >
      <button
        type="button"
        className="dasti-cv-ats-sheet__collapse"
        aria-label="Close ATS audit"
        onClick={() => onOpenChange(false)}
      >
        <CaretRight size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {audit ? (
        <div className="dasti-cv-ats-panel">
          <div className="dasti-cv-ats-panel__summary">
            <div>
              <span className="dasti-cv-ats-panel__eyebrow">
                ATS audit score
              </span>
              <strong>{audit.score}</strong>
            </div>
            <Pill tone={getVerdictTone(audit.verdict)}>
              {audit.verdict.replace("_", " ")}
            </Pill>
          </div>

          <section className="dasti-cv-ats-panel__section">
            <h4>Blockers</h4>
            <IssueList
              issues={audit.blockers}
              emptyLabel="No blockers."
              onOpenImportReview={onOpenImportReview}
            />
          </section>

          <section className="dasti-cv-ats-panel__section">
            <h4>Priority fixes</h4>
            <IssueList
              issues={audit.priorityFixes}
              emptyLabel="No priority fixes."
              onOpenImportReview={onOpenImportReview}
            />
          </section>

          <section className="dasti-cv-ats-panel__section">
            <h4>Grouped issues</h4>
            <div className="dasti-cv-ats-panel__groups">
              {ATS_AUDIT_CATEGORIES.map((category) => (
                <details
                  key={category}
                  className="dasti-cv-ats-panel__group"
                  open={audit.issues[category].length > 0}
                >
                  <summary>
                    <span>{CATEGORY_LABELS[category]}</span>
                    <Pill tone="neutral">
                      {audit.categoryScores[category]}
                    </Pill>
                  </summary>
                  <IssueList
                    issues={audit.issues[category]}
                    emptyLabel={`No ${CATEGORY_LABELS[
                      category
                    ].toLowerCase()} issues.`}
                    onOpenImportReview={onOpenImportReview}
                  />
                </details>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="dasti-cv-ats-panel__empty">
          Open a CV to run the ATS audit heuristic.
        </p>
      )}
    </Sheet>
  );
}

export default CvAtsAuditPanel;
