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

  it("matches skeleton copy order and keeps tone/style choices local", async () => {
    const user = userEvent.setup();
    renderReplay();

    expect(
      screen.getByRole("heading", { name: "Two weeks. One offer." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "twoweeks turns your CV into tailored cover letters for jobs that actually match your profile. Let's get you set up in three minutes.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("No spinners.")).toBeInTheDocument();
    expect(screen.getByText("No fluff.")).toBeInTheDocument();
    expect(screen.getByText("Edit everything.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Bring your CV." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import a PDF, paste text, or start from scratch. We'll structure the sections automatically.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Upload PDF/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start blank/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Pick a starting style." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You can change it any time. Fonts, sizes, accent — everything is editable.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Style 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Style 2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Style 3/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Style 3/ }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Style 3/ })).toHaveAttribute(
      "data-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "How do you sound?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We'll use this as the default for new cover letters. Override per document any time.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Warm/ })).toHaveAttribute(
      "data-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /Formal/ }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Formal/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("routes CV actions and opens supported job sites/dashboard/command palette", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderReplay();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: /Upload PDF/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/cv", {
      state: { cvForgeAction: "importCv" },
    });

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(screen.getByRole("button", { name: /Start blank/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/cv", {
      state: { cvForgeAction: "createBlank" },
    });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      screen.getByRole("heading", { name: "Catch jobs as you browse." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Paste URLs")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: /Install for Chrome/ }),
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://chromewebstore.google.com/",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(
      screen.getByRole("button", { name: /Supported websites/ }),
    );
    expect(screen.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/jobs/",
    );

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "You're set." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pin the extension, capture a few jobs, and twoweeks will draft your first cover letter. ⌘K opens the command palette from anywhere.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to dashboard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard", undefined);

    onClose.mockClear();
    await user.click(screen.getByRole("button", { name: "Command palette" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
  });
});
