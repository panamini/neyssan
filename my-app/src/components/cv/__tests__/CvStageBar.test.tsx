import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CvStageBar from "../CvStageBar";

const baseProps = {
  mode: "edit" as const,
  hasCurrentCv: true,
  hasTrustedExport: true,
  importIssueCount: 0,
  exporting: false,
  tone: "natural" as const,
  onModeChange: vi.fn(),
  onOpenImportReview: vi.fn(),
  onPickResume: vi.fn(),
  onExportPdf: vi.fn(),
  onExportDocx: vi.fn(),
};

describe("CvStageBar", () => {
  it("shows a compact pick resume menu and selects saved resumes", async () => {
    const user = userEvent.setup();
    const onPickResume = vi.fn();

    render(
      <CvStageBar
        {...baseProps}
        onPickResume={onPickResume}
        resumeOptions={[
          {
            id: "resume_alpha",
            title: "Product resume",
            description: "6 sections",
            selected: true,
          },
          {
            id: "resume_beta",
            title: "Design resume",
            description: "5 sections",
            selected: false,
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /Pick resume/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import CV/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New CV/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pick resume/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: /Design resume/i }));

    expect(onPickResume).toHaveBeenCalledWith("resume_beta");
  });
});
