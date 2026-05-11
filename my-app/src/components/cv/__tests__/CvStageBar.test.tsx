import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CvStageBar from "../CvStageBar";

const baseProps = {
  mode: "edit" as const,
  exporting: false,
  tone: "natural" as const,
  onModeChange: vi.fn(),
  onPickResume: vi.fn(),
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

    const pickResumeTrigger = screen.getByRole("button", {
      name: /Pick resume/i,
    });
    expect(pickResumeTrigger).toBeInTheDocument();
    expect(pickResumeTrigger).toHaveClass("dasti-cv-stage-bar__plain-action");
    expect(pickResumeTrigger).not.toHaveAttribute("title");
    expect(pickResumeTrigger).toHaveAttribute(
      "data-toolbar-tooltip",
      "Pick resume",
    );
    expect(screen.queryByText("Pick resume")).not.toBeInTheDocument();
    expect(
      pickResumeTrigger.closest(".dasti-toolbar--surface-tooltips"),
    ).toBeTruthy();
    const editTrigger = screen.getByRole("button", { name: "Edit" });
    const previewTrigger = screen.getByRole("button", {
      name: "Page preview",
    });
    expect(editTrigger).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(previewTrigger).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(editTrigger).not.toHaveAttribute("title");
    expect(previewTrigger).not.toHaveAttribute("title");
    expect(screen.getByText("Natural")).toBeInTheDocument();
    expect(screen.queryByText("Natural tone")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByText("ATS-ready")).not.toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Import CV/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /New CV/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pick resume/i }));
    expect(pickResumeTrigger).toHaveAttribute("aria-expanded", "true");
    await user.click(
      await screen.findByRole("menuitemradio", { name: /Design resume/i }),
    );

    expect(onPickResume).toHaveBeenCalledWith("resume_beta");
  });
});
