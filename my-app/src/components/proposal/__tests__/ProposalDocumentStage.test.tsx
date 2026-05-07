import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProposalDocumentStage from "../ProposalDocumentStage";

const baseProps = {
  statusLabel: "Draft",
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

describe("ProposalDocumentStage share and safe-send controls", () => {
  it("renders length term in the top status pill and keeps character count in the tooltip", () => {
    renderStage({
      statusMeta: "Standard",
      statusTitle: "Draft length: 742 chars",
    });

    const status = screen.getByText("Draft").closest(".ds-status");
    expect(status).toHaveTextContent("Standard");
    expect(status).not.toHaveAttribute("title");
    expect(status).toHaveAttribute(
      "data-toolbar-tooltip",
      "Draft length: 742 chars",
    );
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

  it("uses shared app tooltips without native titles for stage mode and share triggers", () => {
    renderStage();

    const edit = screen.getByRole("button", { name: "Edit proposal" });
    const preview = screen.getByRole("button", { name: "Preview proposal" });
    const share = screen.getByRole("button", { name: "Share proposal" });

    expect(edit).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(preview).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(share).toHaveAttribute("data-toolbar-tooltip", "Share");
    expect(edit).not.toHaveAttribute("title");
    expect(preview).not.toHaveAttribute("title");
    expect(share).not.toHaveAttribute("title");
    expect(share.closest(".dasti-toolbar--surface-tooltips")).toBeTruthy();
  });

  it("marks unavailable share actions explicitly and wires copy text", async () => {
    const onCopyText = vi.fn();
    renderStage({ onCopyText });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    const menu = await screen.findByRole("menu", { name: "Share proposal" });

    expect(within(menu).getByRole("menuitem", { name: "Send by email" })).toBeDisabled();
    expect(within(menu).getAllByText("Unavailable in this checkpoint")).toHaveLength(3);
    expect(within(menu).getByRole("menuitem", { name: "Copy link" })).toBeDisabled();
    expect(
      within(menu).getByRole("menuitem", { name: "Public preview link" }),
    ).toBeDisabled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Copy as text" }));
    expect(onCopyText).toHaveBeenCalledTimes(1);
  });

  it("enables Continue only when every concrete safe-send row is clear", async () => {
    renderStage({
      sourceJobLinked: true,
      sourceCvSelected: true,
      proposalLinked: true,
      matchReviewAccepted: true,
      hasUnresolvedImportIssues: false,
      hasPendingAiSuggestion: false,
      unsupportedClaimState: "clear",
      hasPlaceholderText: false,
      recipientOrExportTargetSelected: true,
      finalExportReviewed: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    const menu = await screen.findByRole("menu", { name: "Share proposal" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Safe-send checklist…" }));

    const dialog = await screen.findByRole("dialog", { name: "Safe-send checklist" });
    expect(within(dialog).getByText("Package is ready to continue.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue to send" })).not.toBeDisabled();
    expect(dialog.querySelectorAll('[data-state="clear"]')).toHaveLength(10);
  });
});
