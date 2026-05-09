import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("uses setup step order and keeps style/tone selections through the CV step", async () => {
    const user = userEvent.setup();
    renderReplay();

    expect(
      Array.from(document.querySelectorAll(".onb-replay__segment")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["Intro", "Style", "Tone", "CV", "Jobs", "Done"]);
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
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getAllByText("French")).toHaveLength(2);
    expect(screen.queryByText(/layout/i)).toBeNull();
    expect(screen.getByText("Fraunces × Syne")).toBeInTheDocument();
    expect(screen.getByText("Geist × Baskervville")).toBeInTheDocument();
    expect(
      screen.getByText("Special Elite × Courier"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Courier Prime/)).toBeNull();
    expect(screen.getAllByText("Protection Guard")).toHaveLength(3);
    expect(screen.getAllByText("Robert Cooper")).toHaveLength(3);
    expect(
      document.querySelectorAll(
        ".onb-replay__choice--style.dasti-settings-hero-preview",
      ),
    ).toHaveLength(3);
    expect(
      document.querySelectorAll(
        ".onb-replay__choice--style .dasti-settings-hero-preview",
      ),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll(".onb-replay__style-preview"),
    ).toHaveLength(0);
    expect(
      Array.from(
        document.querySelectorAll(
          ".onb-replay__settings-preview .dasti-settings-hero-preview__title",
        ),
      ).map((node) => node.textContent),
    ).toEqual(["Protection Guard", "Protection Guard", "Protection Guard"]);
    expect(screen.queryByText(/Ink accent/)).toBeNull();
    expect(screen.queryByText(/Auto signature/)).toBeNull();
    expect(screen.queryByText("Warm editorial. Ink accent.")).toBeNull();
    expect(screen.queryByText("Modern classic. Ink accent.")).toBeNull();
    expect(screen.queryByText("Typed letter. Ink accent.")).toBeNull();

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
      screen.getByText("Your default voice. Change it per letter."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Human\. Direct\./)).toHaveTextContent(
      "Human. Direct. Still professional.",
    );
    expect(screen.getByText(/Plain prose\./)).toHaveTextContent(
      "Plain prose. Clear. Done.",
    );
    expect(screen.getByText(/Structured\. Senior\./)).toHaveTextContent(
      "Structured. Senior. No theater.",
    );
    const warmTone = screen.getByRole("button", { name: /Warm/ });
    const naturalTone = screen.getByRole("button", { name: /Natural/ });
    const formalTone = screen.getByRole("button", { name: /Formal/ });
    expect(
      warmTone.compareDocumentPosition(naturalTone) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      naturalTone.compareDocumentPosition(formalTone) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Bring your CV." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import a PDF, paste text, or start from scratch. We'll keep your style and tone choices in place.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Upload PDF/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start blank/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Formal/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Style 3/ })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("keeps CV actions inside onboarding and renders readiness-aware final CTAs", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderReplay();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Bring your CV." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Upload PDF/ }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "PDF import is selected. Choose a file now or continue and import it from the final step.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "Catch jobs as you browse." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Install the twoweeks extension. Capture roles from supported job sites.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Paste URLs")).toBeNull();
    expect(screen.queryByText("Job boards")).toBeNull();

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
    expect(screen.getByRole("link", { name: "Indeed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upwork" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ZipRecruiter" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "HelloWork" })).toBeInTheDocument();

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "You're set." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Start with the next document step that matters most."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("⌘K opens the command palette from anywhere."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Match a job" })).toHaveAttribute(
      "data-primary",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Match a job" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/jobs", undefined);

    cleanup();
    onClose.mockClear();
    onNavigate.mockClear();
    renderReplay();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Import CV" })).toHaveAttribute(
      "data-primary",
      "true",
    );
  });

  it("marks blank CV locally without navigating before onboarding completion", async () => {
    const user = userEvent.setup();
    renderReplay();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: /Start blank/ }));
    expect(onClose).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Catch jobs as you browse." }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Match a job" })).toHaveAttribute(
      "data-primary",
      "true",
    );

    onClose.mockClear();
    onNavigate.mockClear();
    await user.click(
      screen.getByRole("button", { name: "Write first proposal" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/proposal", undefined);
    expect(onOpenCommandPalette).not.toHaveBeenCalled();
  });
});
