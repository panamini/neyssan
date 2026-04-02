import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProposalDisplay from "../ProposalDisplay";

describe("ProposalDisplay", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  it("renders a copy button when proposal text is present", () => {
    const handleCopy = vi.fn();

    render(
      <ProposalDisplay
        proposalContent={"Hello hiring team,\n\nI would love to discuss the role."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={handleCopy}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("hides the copy button when there is no generated proposal", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  it("renders a neutral status message when generation is stopped", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        statusMessage="Generation stopped."
      />,
    );

    expect(screen.getByText("Generation stopped.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("invokes the provided copy handler", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <ProposalDisplay
        proposalContent={"Hello hiring team,\n\nI would love to discuss the role."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        onCopy={async () => {
          await navigator.clipboard.writeText(
            "Hello hiring team,\n\nI would love to discuss the role.",
          );
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "Hello hiring team,\n\nI would love to discuss the role.",
      );
    });
  });

  it("renders the selected proposal template markup for preview mode", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        templateId="quire_margin"
      />,
    );

    expect(
      document.querySelector('[data-proposal-template="quire_margin"]'),
    ).toBeTruthy();
    expect(screen.getAllByText("Alex Martin").length).toBeGreaterThan(0);
  });

  it("applies the linked verbati style theme to the proposal document without recoloring the shell", () => {
    render(
      <ProposalDisplay
        proposalContent={"Dear team,\n\nA calm editorial proposal body.\n\nSincerely,\nAlex Martin"}
        loading={false}
        error={null}
        proposalType="cover_letter"
        templateId="editorial_wide"
        stylePreset={{
          layout: "editorial",
          typography: "expert",
          palette: "encre",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");
    expect(frame).toBeTruthy();
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-heading-family"),
    ).toContain("IBM Plex Mono");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--proposal-document-paper"),
    ).not.toBe("");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("keeps the themed frame during loading state", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading
        error={null}
        stylePreset={{
          layout: "editorial",
          typography: "expert",
          palette: "encre",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");
    const sheet = document.querySelector(".dasti-proposal-sheet");

    expect(frame).toBeTruthy();
    expect(sheet).toHaveAttribute("aria-busy", "true");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-heading-family"),
    ).toContain("IBM Plex Mono");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("keeps the themed frame for the empty proposal state", () => {
    render(
      <ProposalDisplay
        proposalContent={null}
        loading={false}
        error={null}
        stylePreset={{
          layout: "quire",
          typography: "engaging",
          palette: "bordeaux",
        }}
      />,
    );

    const frame = document.querySelector(".dasti-proposal-sheet-frame");

    expect(frame).toBeTruthy();
    expect(screen.getByText("Generate a proposal to see the results here.")).toBeInTheDocument();
    expect(
      (frame as HTMLElement).style.getPropertyValue("--font-body-family"),
    ).toContain("Source Serif 4");
    expect(
      (frame as HTMLElement).style.getPropertyValue("--color-canvas"),
    ).toBe("");
  });

  it("renders document previews inside a fixed page stage when zoom controls are enabled", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        onModeChange={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".dasti-proposal-sheet__preview-stage"),
    ).toBeTruthy();
    expect(
      document.querySelector(".dasti-proposal-sheet__preview-page"),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Open zoom controls" }),
    );
    expect(screen.getByRole("button", { name: "Fit page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(
      document.querySelector(
        ".dasti-proposal-rail-cluster .dasti-doc-zoom-menu",
      ),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "100 percent zoom" }),
    ).not.toBeInTheDocument();
  });

  it("hides zoom controls while the proposal is in edit mode", () => {
    render(
      <ProposalDisplay
        proposalContent={
          "Dear Hiring Manager,\n\nI built reliable editorial tooling across product and content workflows.\n\nSincerely,\nAlex Martin"
        }
        loading={false}
        error={null}
        proposalType="cover_letter"
        showZoomControls
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Open zoom controls" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zoom out" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zoom in" }),
    ).not.toBeInTheDocument();
  });

  it("uses a single preview or edit toggle button", () => {
    const handleModeChange = vi.fn();

    render(
      <ProposalDisplay
        proposalContent={"Hello hiring team,\n\nI build calm, reliable proposal copy."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="preview"
        onModeChange={handleModeChange}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Switch to edit mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("data-toolbar-tooltip", "Switch to edit");

    fireEvent.click(toggle);

    expect(handleModeChange).toHaveBeenCalledWith("edit");
  });

  it("places the actions-only document header inside the sheet under the toolbar rail", () => {
    render(
      <ProposalDisplay
        proposalContent={"Hello hiring team,\n\nI build calm, reliable proposal copy."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        documentHeaderMode="actions-only"
        documentTitle="Generated proposal"
        documentMeta="Compose output"
        showModeToggle
        onModeChange={vi.fn()}
      />,
    );

    const rail = document.querySelector(".dasti-document-rail");
    const inlineHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--inline",
    );
    const externalHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--external",
    );

    expect(rail).toBeTruthy();
    expect(inlineHeading).toBeTruthy();
    expect(externalHeading).toBeNull();
    expect(
      (rail as HTMLElement).compareDocumentPosition(inlineHeading as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("can detach the actions-only document header above the shell for saved proposals", () => {
    render(
      <ProposalDisplay
        proposalContent={"Hello hiring team,\n\nI build calm, reliable proposal copy."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        documentHeaderMode="actions-only"
        detachedActionHeader
        documentTitle="Saved proposal"
        documentMeta="Letter · Natural"
        showModeToggle
        onModeChange={vi.fn()}
        actions={<button type="button">Refine</button>}
        railStartAddon={<button type="button">Style inspector</button>}
      />,
    );

    const detachedHeader = document.querySelector(
      ".dasti-proposal-sheet__header--detached",
    );
    const detachedLayout = document.querySelector(
      ".dasti-proposal-display__detached-layout",
    );
    const detachedRail = document.querySelector(
      ".dasti-proposal-sheet__header-rail",
    );
    const detachedAside = document.querySelector(
      ".dasti-proposal-sheet__heading--sidecar",
    );
    const inlineHeading = document.querySelector(
      ".dasti-proposal-sheet__heading--inline",
    );
    const shell = document.querySelector(".dasti-doc-viewer-shell");

    expect(detachedHeader).toBeTruthy();
    expect(detachedLayout).toBeTruthy();
    expect(detachedRail).toBeTruthy();
    expect(detachedAside).toBeTruthy();
    expect(inlineHeading).toBeNull();
    expect(screen.getByRole("button", { name: "Refine" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Style inspector" })).toBeInTheDocument();
    expect(
      (detachedHeader as HTMLElement).compareDocumentPosition(detachedRail as HTMLElement) &
        Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedLayout as HTMLElement).compareDocumentPosition(detachedAside as HTMLElement) &
        Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedLayout as HTMLElement).compareDocumentPosition(detachedHeader as HTMLElement) &
        Node.DOCUMENT_POSITION_CONTAINED_BY,
    ).toBeTruthy();
    expect(
      (detachedHeader as HTMLElement).compareDocumentPosition(shell as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the character capsule once it overlaps the editable page", async () => {
    const { container } = render(
      <ProposalDisplay
        proposalContent={"Dear Hiring Manager,\n\nA precise product proposal body."}
        loading={false}
        error={null}
        proposalType="cover_letter"
        mode="edit"
        onContentChange={vi.fn()}
      />,
    );

    const editablePage = container.querySelector(
      ".dasti-proposal-sheet__preview-page--editable",
    ) as HTMLElement | null;
    const badgeWrap = container.querySelector(
      ".dasti-proposal-character-badge-wrap",
    ) as HTMLElement | null;

    expect(editablePage).toBeTruthy();
    expect(badgeWrap).toBeTruthy();

    Object.defineProperty(editablePage as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 48,
        y: 84,
        width: 520,
        height: 700,
        top: 84,
        right: 568,
        bottom: 784,
        left: 48,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(badgeWrap as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 32,
        y: 744,
        width: 96,
        height: 32,
        top: 744,
        right: 128,
        bottom: 776,
        left: 32,
        toJSON: () => ({}),
      }),
    });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(badgeWrap).toHaveAttribute("data-overlap-hidden", "true");
    });
  });
});
