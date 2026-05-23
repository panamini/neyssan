import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CvAiReviewOverlay from "../cv/CvAiReviewOverlay";

const target = {
  sectionId: "summary-1",
  sectionType: "summary",
  sectionLabel: "Summary",
  selectedText: "Old summary",
};

describe("CvAiReviewOverlay", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    document.body.removeAttribute("data-theme");
  });

  it("renders as an anchored popover on desktop", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
      writable: true,
    });

    render(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        anchor={{
          left: 300,
          top: 180,
          bottom: 220,
          leftEdge: 250,
          rightEdge: 350,
          containerLeft: 120,
          containerRight: 980,
          containerTop: 100,
          containerBottom: 800,
        }}
        onAccept={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(
      await screen.findByRole("dialog", { name: "AI review for Summary" }),
    ).toBeInTheDocument();
    const layer = document.querySelector("[data-cv-ai-review-mode='popover']");
    const surface = document.querySelector(
      "[data-cv-ai-review-surface='true']",
    );
    expect(layer).toBeTruthy();
    expect(layer).toHaveAttribute("data-cv-ai-review-placement", "below");
    expect(layer).toHaveAttribute(
      "data-cv-ai-review-target-section-id",
      "summary-1",
    );
    expect(layer).toHaveAttribute("data-cv-ai-review-tokenized", "true");
    expect(surface).toBeTruthy();
    expect(
      Number((surface as HTMLElement).style.left.replace("px", "")),
    ).toBeGreaterThanOrEqual(120);
    expect(
      document.querySelector("[data-cv-ai-review-toolbar='true']"),
    ).toBeTruthy();
    expect(
      document.querySelector("[data-cv-ai-review-body='true']"),
    ).toBeTruthy();
    expect(screen.getByTitle("Wording · Summary")).toBeInTheDocument();
    expect(
      document.querySelector("[data-cv-ai-review-visible-target='true']"),
    ).toHaveTextContent("Summary");
    expect(screen.queryByText("AI review")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Review before applying."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("New summary")).toBeInTheDocument();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "See changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back from AI review" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".dasti-cv-ai-review__badge")).toBeNull();
    const body = document.querySelector("[data-cv-ai-review-body='true']");
    const actions = document.querySelector(".dasti-cv-ai-review__actions");
    expect(actions).toBeTruthy();
    expect(body?.contains(actions)).toBe(false);
  });

  it("renders as a bottom sheet on narrow screens and dismisses with Escape", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
      writable: true,
    });

    render(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        onAccept={() => {}}
        onDiscard={onDiscard}
      />,
    );

    const layer = document.querySelector("[data-cv-ai-review-mode='sheet']");
    expect(layer).toBeTruthy();
    expect(layer).toHaveAttribute("data-cv-ai-review-placement", "sheet");
    await user.keyboard("{Escape}");
    expect(onDiscard).toHaveBeenCalled();
  });

  it("uses a right-side popover when vertical room is tight and horizontal room is available", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 640,
      writable: true,
    });

    render(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        anchor={{
          left: 360,
          top: 300,
          bottom: 330,
          leftEdge: 260,
          rightEdge: 460,
          focusRight: 460,
          containerLeft: 120,
          containerRight: 1120,
          containerTop: 220,
          containerBottom: 520,
        }}
        onAccept={() => {}}
        onDiscard={() => {}}
      />,
    );

    const layer = await screen.findByRole("dialog", {
      name: "AI review for Summary",
    });
    expect(layer.parentElement).toHaveAttribute(
      "data-cv-ai-review-placement",
      "right",
    );
  });

  it("labels the header with the compact action and target on one line", async () => {
    render(
      <CvAiReviewOverlay
        open
        target={{
          sectionId: "exp-1",
          sectionType: "experience",
          sectionLabel: "Experience",
          itemId: "exp-item-1",
          itemLabel: "Senior Data Scientist",
          fieldPath: "structuredContent.item:exp-item-1.responsibilities",
        }}
        state="ready"
        beforeText="Old responsibilities"
        afterText="New responsibilities"
        actionId="improve_experience_responsibilities"
        primaryActionLabel="Replace responsibilities"
        onAccept={() => {}}
        onDiscard={() => {}}
      />,
    );

    const title = await screen.findByTitle(
      "Responsibilities · Experience · Senior Data Scientist",
    );
    expect(title).toHaveClass("dasti-cv-ai-review__title");
    expect(title).toHaveTextContent("Responsibilities");
    expect(title).toHaveTextContent("Experience · Senior Data Scientist");
  });

  it("keeps the toolbar and review body grouped in one tokenized surface across theme changes", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    document.body.setAttribute("data-theme", "dark");
    const { rerender } = render(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        onAccept={() => {}}
        onDiscard={() => {}}
      />,
    );

    const surface = await screen.findByRole("dialog", {
      name: "AI review for Summary",
    });
    expect(surface).toHaveAttribute("data-cv-ai-review-surface", "true");
    expect(
      surface.querySelector("[data-cv-ai-review-toolbar='true']"),
    ).toBeTruthy();
    expect(
      surface.querySelector("[data-cv-ai-review-body='true']"),
    ).toBeTruthy();
    expect(
      document.querySelector("[data-cv-ai-review-tokenized='true']"),
    ).toBeTruthy();

    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
    document.body.setAttribute("data-theme", "light");
    rerender(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        onAccept={() => {}}
        onDiscard={() => {}}
      />,
    );

    expect(
      await screen.findByRole("dialog", { name: "AI review for Summary" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-cv-ai-review-tokenized='true']"),
    ).toBeTruthy();
  });

  it("exposes review-first accept, back, and undo controls", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(
      <CvAiReviewOverlay
        open
        target={target}
        state="ready"
        beforeText="Old summary"
        afterText="New summary"
        onAccept={onAccept}
        onDiscard={onDiscard}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Replace in Summary" }),
    );
    expect(onAccept).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Replace in Summary" }),
    ).toHaveClass("dasti-cv-ai-review__action--primary");
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Back from AI review" }),
    );
    expect(onDiscard).toHaveBeenCalled();

    const onUndo = vi.fn();
    rerender(
      <CvAiReviewOverlay
        open
        target={target}
        state="accepted"
        beforeText="Old summary"
        afterText="New summary"
        onAccept={onAccept}
        onDiscard={onDiscard}
        onUndo={onUndo}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText("Current text")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested text")).not.toBeInTheDocument();
  });
});
