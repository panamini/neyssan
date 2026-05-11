import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CvAtsAuditPanel from "../CvAtsAuditPanel";
import type { AtsAuditResult } from "../../../lib/ats-audit/types";

const unresolvedImportIssue = {
  id: "unresolved-import-review",
  category: "parsing" as const,
  severity: "critical" as const,
  title: "Unresolved import review",
  detail: "Review uncertain imported fragments before export.",
  priority: "high" as const,
};

const missingSkillsIssue = {
  id: "missing-skills",
  category: "content" as const,
  severity: "warning" as const,
  title: "Missing skills",
  detail: "Add a structured skills section.",
  priority: "medium" as const,
};

const audit: AtsAuditResult = {
  score: 72,
  verdict: "blocked",
  blockers: [unresolvedImportIssue],
  categoryScores: {
    parsing: 40,
    layout: 100,
    typography: 100,
    sections: 90,
    keywords: 100,
    content: 70,
  },
  issues: {
    parsing: [unresolvedImportIssue],
    layout: [],
    typography: [],
    sections: [],
    keywords: [],
    content: [missingSkillsIssue],
  },
  priorityFixes: [unresolvedImportIssue, missingSkillsIssue],
};

describe("CvAtsAuditPanel", () => {
  it("renders score, blockers, priority fixes, and grouped issues", () => {
    render(
      <CvAtsAuditPanel
        open
        audit={audit}
        onOpenChange={vi.fn()}
        onOpenImportReview={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "ATS audit" })).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getAllByText("Unresolved import review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing skills").length).toBeGreaterThan(0);
    expect(screen.getByText("Parsing")).toBeInTheDocument();
    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
    expect(screen.getByText("Sections")).toBeInTheDocument();
    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("opens import review from unresolved import blocker actions", async () => {
    const user = userEvent.setup();
    const onOpenImportReview = vi.fn();

    render(
      <CvAtsAuditPanel
        open
        audit={audit}
        onOpenChange={vi.fn()}
        onOpenImportReview={onOpenImportReview}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Open import review" })[0]);
    expect(onOpenImportReview).toHaveBeenCalledTimes(1);
  });
});
