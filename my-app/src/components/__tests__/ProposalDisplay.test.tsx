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
    expect(screen.getByText("Alex Martin")).toBeInTheDocument();
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
      />,
    );

    expect(
      document.querySelector(".dasti-proposal-sheet__preview-stage"),
    ).toBeTruthy();
    expect(
      document.querySelector(".dasti-proposal-sheet__preview-page"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  });
});
