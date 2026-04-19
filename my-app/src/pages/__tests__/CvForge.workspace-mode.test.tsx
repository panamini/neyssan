import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CvForge } from "../CvForge";

vi.mock("../../components/ProfileReviewCard", () => ({
  ProfileReviewCard: ({
    cvId,
    toolbarLeadControl,
    toolbarPrimaryControl,
  }: {
    cvId?: string;
    toolbarLeadControl?: React.ReactNode;
    toolbarPrimaryControl?: React.ReactNode;
  }) => (
    <div>
      <div className="dasti-workbench-top-left-slot--cv">
        <div className="dasti-cv-workbench-toggle">{toolbarLeadControl}</div>
      </div>
      <div>Mock profile editor {cvId ?? "none"}</div>
      {toolbarPrimaryControl}
    </div>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({
    preset1: {
      verbatiStyle: {
        familyId: "editorial",
        layout: "editorial",
        typography: "quiet-editorial",
        palette: "pierre",
      },
      voicePreset: null,
      name: "Stone Editorial",
    },
    preset2: null,
    preset3: null,
    activeSlot: 1,
  })),
  useAction: vi.fn(() => undefined),
}));

vi.mock("../../features/verbati/VerbatiCvPreviewPanel", () => ({
  VerbatiCvPreviewPanel: ({
    hostMode,
    layoutMode,
    railLeadControl,
    stylePreset,
  }: {
    hostMode?: "panel" | "workspace";
    layoutMode?: "rail" | "stacked";
    railLeadControl?: React.ReactNode;
    stylePreset?: { layout?: string | null };
  }) => (
    <div>
      Preview host: {hostMode ?? "panel"} / layout: {layoutMode ?? "stacked"}
      <div>Preview style: {stylePreset?.layout ?? "none"}</div>
      {railLeadControl}
    </div>
  ),
}));

describe("CvForge workspace mode", () => {
  beforeEach(() => {
    window.localStorage.removeItem("dasti:cv-forge-workspace-mode:v1");
    window.localStorage.setItem("twoweeks:quick-start-completed", "1");
  });

  it("switches between edit and preview workbench modes and persists the choice", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1200,
      writable: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mock profile editor cv_123")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open saved resume styles" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Preview host: panel \/ layout:/),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv"),
    ).toBeTruthy();
    expect(container.querySelector(".dasti-cv-workbench-toggle")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open resume preview" }),
    ).toHaveAttribute("data-toolbar-tooltip", "Switch to preview");

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    expect(
      screen.queryByText("Mock profile editor cv_123"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Preview host: workspace / layout: stacked"),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-cv-preview-workbench"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-workbench-top-left-slot--cv-preview"),
    ).toBeFalsy();
    expect(
      screen.getByRole("button", { name: "Back to resume editing" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to resume editing" }),
    ).toHaveAttribute("data-toolbar-tooltip", "Back to edit");
    const pageShell = container.querySelector(
      ".dasti-page-shell--cv-forge",
    ) as HTMLElement | null;
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-top-mobile")).toBe(
      "var(--space-2)",
    );
    expect(pageShell?.style.getPropertyValue("--cv-preview-toolbar-inset")).toBe(
      "0px",
    );
    const previewWorkbench = container.querySelector(
      ".dasti-cv-preview-workbench",
    ) as HTMLElement | null;
    expect(
      previewWorkbench?.style.getPropertyValue("--cv-preview-shell-block-size"),
    ).toContain("100dvh");
    expect(
      previewWorkbench?.style.getPropertyValue(
        "--document-viewer-shell-inline-size",
      ),
    ).toBe("100%");
    expect(previewWorkbench?.style.marginInline).toBe("0");
    expect(pageShell?.style.getPropertyValue("--page-shell-pad-inline")).toBe(
      "var(--space-4)",
    );
    expect(
      pageShell?.style.getPropertyValue("--page-shell-pad-inline-mobile"),
    ).toBe("var(--space-4)");
    expect(
      window.localStorage.getItem("dasti:cv-forge-workspace-mode:v1"),
    ).toBe("preview");
  });

  it("keeps the workspace preview on the same canvas path on narrow viewports", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 700,
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open resume preview" }),
    );

    expect(
      screen.getByText("Preview host: workspace / layout: stacked"),
    ).toBeInTheDocument();
  });

  it("applies canonical saved settings styles from the selected preset slot", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/cv?id=cv_123"]}>
        <CvForge />
      </MemoryRouter>,
    );

    expect(screen.getByText("Preview style: swiss")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Open saved resume styles" }),
    );

    await user.click(screen.getByRole("menuitemradio", { name: /Stone Editorial/i }));

    expect(screen.getByText("Preview style: editorial")).toBeInTheDocument();
  });
});
