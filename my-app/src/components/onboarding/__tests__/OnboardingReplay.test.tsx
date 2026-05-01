import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingReplay } from "../OnboardingReplay";

const onClose = vi.fn();
const onNavigate = vi.fn();
const onOpenCommandPalette = vi.fn();

function renderReplay() {
  render(
    <OnboardingReplay
      open
      onClose={onClose}
      onNavigate={onNavigate}
      onOpenCommandPalette={onOpenCommandPalette}
    />,
  );
}

describe("OnboardingReplay", () => {
  beforeEach(() => {
    onClose.mockClear();
    onNavigate.mockClear();
    onOpenCommandPalette.mockClear();
    vi.restoreAllMocks();
  });

  it("starts with tone, then style, then resume upload/new actions", async () => {
    const user = userEvent.setup();
    renderReplay();

    expect(screen.getByRole("heading", { name: "Choose your tone." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open tone settings" })).toBeInTheDocument();
    expect(screen.queryByText("Paste text")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Pick your style." })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Bring your resume." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New resume" })).toBeInTheDocument();
    expect(screen.queryByText("Paste text")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Upload resume" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/cv", {
      state: { cvForgeAction: "importCv" },
    });

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(screen.getByRole("button", { name: "New resume" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/cv", {
      state: { cvForgeAction: "createBlank" },
    });
  });

  it("opens supported job sites and links dashboard or command palette actions", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderReplay();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: "Capture jobs." })).toBeInTheDocument();
    expect(screen.queryByText("Paste URLs")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Install for Chrome" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://chromewebstore.google.com/",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: "Supported websites" }));
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/jobs/",
    );

    await user.click(screen.getByRole("button", { name: "Pick existing job" }));
    expect(onNavigate).toHaveBeenCalledWith("/jobs", undefined);

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Open the dashboard." })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard", undefined);

    onClose.mockClear();
    await user.click(screen.getByRole("button", { name: "Command palette" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });
});
