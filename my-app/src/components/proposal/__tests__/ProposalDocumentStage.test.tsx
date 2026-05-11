import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProposalDocumentStage from "../ProposalDocumentStage";

const baseProps = {
  toneLabel: "Warm tone",
  toneValue: "warm" as const,
  mode: "preview" as const,
  exporting: false,
  hasProposalContent: true,
  onModeChange: vi.fn(),
  onCopyText: vi.fn(),
  onExportPdf: vi.fn(),
  onExportDocx: vi.fn(),
};

function renderStage(props: Partial<React.ComponentProps<typeof ProposalDocumentStage>> = {}) {
  return render(
    <ProposalDocumentStage {...baseProps} {...props}>
      <div>Paper body</div>
    </ProposalDocumentStage>,
  );
}

describe("ProposalDocumentStage proposal actions", () => {
  it("keeps the local toolbar focused on tone, mode, templates, and actions", () => {
    renderStage({
      onOpenTemplates: vi.fn(),
    });

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Proposal text")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.queryByText("Concise")).not.toBeInTheDocument();
    expect(screen.queryByText("Detailed")).not.toBeInTheDocument();
    expect(screen.queryByText("standard")).not.toBeInTheDocument();
    expect(screen.queryByText("concise")).not.toBeInTheDocument();
    expect(screen.queryByText("detailed")).not.toBeInTheDocument();
    expect(screen.getByText("Warm tone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit proposal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview proposal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Templates" })).toBeInTheDocument();
  });

  it("shows undo and redo only while editing", () => {
    const { rerender } = renderStage({ mode: "preview" });

    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redo" })).not.toBeInTheDocument();

    rerender(
      <ProposalDocumentStage {...baseProps} mode="edit">
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
  });

  it("uses shared app tooltips without native titles for stage mode and action triggers", () => {
    renderStage();

    const edit = screen.getByRole("button", { name: "Edit proposal" });
    const preview = screen.getByRole("button", { name: "Preview proposal" });
    const actions = screen.getByRole("button", { name: "Proposal actions" });

    expect(edit).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(preview).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(actions).toHaveAttribute("data-toolbar-tooltip", "Actions");
    expect(edit).not.toHaveAttribute("title");
    expect(preview).not.toHaveAttribute("title");
    expect(actions).not.toHaveAttribute("title");
    expect(actions.closest(".dasti-toolbar--surface-tooltips")).toBeTruthy();
  });

  it("exposes direct proposal actions and wires copy/download", async () => {
    const onCopyText = vi.fn();
    const onExportPdf = vi.fn();
    const onExportDocx = vi.fn();
    renderStage({ onCopyText, onExportPdf, onExportDocx });

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const menu = await screen.findByRole("menu", { name: "Proposal actions" });

    expect(within(menu).queryByText(/send/i)).not.toBeInTheDocument();
    expect(within(menu).queryByText(/safe-send/i)).not.toBeInTheDocument();
    expect(within(menu).queryByText(/export/i)).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy text" }));
    expect(onCopyText).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const secondMenu = await screen.findByRole("menu", { name: "Proposal actions" });
    fireEvent.click(within(secondMenu).getByRole("menuitem", { name: "Download PDF" }));
    expect(onExportPdf).toHaveBeenCalledWith("styled");

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const thirdMenu = await screen.findByRole("menu", { name: "Proposal actions" });
    fireEvent.click(within(thirdMenu).getByRole("menuitem", { name: "Download DOCX" }));
    expect(onExportDocx).toHaveBeenCalledTimes(1);
  });

  it("does not block copy or download because job metadata is missing", async () => {
    const onCopyText = vi.fn();
    const onExportPdf = vi.fn();
    renderStage({
      onCopyText,
      onExportPdf,
      sourceJobLinked: false,
      sourceCvSelected: false,
      proposalLinked: false,
      matchReviewAccepted: null,
      hasUnresolvedImportIssues: null,
      hasPendingAiSuggestion: null,
      unsupportedClaimState: null,
      hasPlaceholderText: true,
      recipientOrExportTargetSelected: false,
    });

    fireEvent.click(screen.getByRole("button", { name: "Proposal actions" }));
    const menu = await screen.findByRole("menu", { name: "Proposal actions" });

    expect(within(menu).getByRole("menuitem", { name: "Copy text" })).not.toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Download PDF" })).not.toBeDisabled();
    expect(screen.queryByRole("dialog", { name: /safe-send/i })).not.toBeInTheDocument();
  });
});
