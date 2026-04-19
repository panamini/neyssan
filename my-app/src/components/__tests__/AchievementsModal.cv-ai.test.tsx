import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AchievementsModal from "../structured-blocks/AchievementsModal";

const {
  mockRunCvSectionAiAction,
  mockConvexQuery,
  mockGeneratedApiModule,
} = vi.hoisted(() => ({
  mockRunCvSectionAiAction: vi.fn(),
  mockConvexQuery: vi.fn().mockResolvedValue({
    version: "test",
    supportedActions: ["improve_achievement_line"],
  }),
  mockGeneratedApiModule: {
    api: {
      functions: {
        runCvSectionAiAction: "runCvSectionAiAction",
        getCvAiCapabilities: "getCvAiCapabilities",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (target: unknown) => {
    if (target === mockGeneratedApiModule.api.functions.runCvSectionAiAction) {
      return mockRunCvSectionAiAction;
    }

    return vi.fn();
  },
  useConvex: () => ({
    query: mockConvexQuery,
  }),
}));

vi.mock("../../../convex/_generated/api", () => mockGeneratedApiModule);
vi.mock("../../../convex/_generated/api.js", () => mockGeneratedApiModule);
vi.mock("../../hooks/use-cv-ai-capabilities", () => ({
  useCvAiCapabilities: () => ({
    status: "ready",
    version: "test",
    supportedActions: ["improve_achievement_line"],
    isSupported: (actionId: string) => actionId === "improve_achievement_line",
    staleMessage: "stale",
  }),
}));

describe("AchievementsModal CV AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies an accepted AI achievement rewrite before save", async () => {
    mockRunCvSectionAiAction.mockResolvedValue({
      kind: "text",
      text: "Reduced onboarding time by coordinating a cleaner handoff process.",
    });

    const onSave = vi.fn();

    render(
      <AchievementsModal
        open
        items={[
          {
            id: "ach-1",
            text: "Helped with onboarding improvements",
          },
        ]}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Improve achievement with AI/i }),
    );

    await screen.findByText(
      "Reduced onboarding time by coordinating a cleaner handoff process.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Save achievements" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(onSave).toHaveBeenCalledWith([
      {
        id: "ach-1",
        text: "Reduced onboarding time by coordinating a cleaner handoff process.",
      },
    ]);
  });

  it("renders compact inline achievement rows without section titles or helper copy", () => {
    render(
      <AchievementsModal
        open
        items={[
          { id: "ach-1", text: "Reduced theft by 28%." },
          { id: "ach-2", text: "" },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const fields = screen.getAllByRole("textbox");
    const entries = document.querySelectorAll(".dasti-achievements-modal__entry");

    expect(entries).toHaveLength(2);
    expect(fields[0].className).toContain("dasti-field");
    expect(fields[0].className).toContain("dasti-achievements-modal__textarea");
    expect(
      screen.queryByRole("heading", { name: "Achievement 1" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Impact line")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Keep it specific, outcome-led, and easy to scan."),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Improve achievement with AI/i }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Add achievement" }),
    ).toBeInTheDocument();
  });

  it("keeps the user on the field they switched to after targeted preview focus", async () => {
    vi.useFakeTimers();

    await act(async () => {
      render(
        <AchievementsModal
          open
          initialItemId="ach-1"
          items={[
            { id: "ach-1", text: "Reduced theft by 28%." },
            { id: "ach-2", text: "Improved onboarding" },
          ]}
          onClose={vi.fn()}
          onSave={vi.fn()}
        />,
      );
      await vi.advanceTimersByTimeAsync(60);
    });

    const secondField = document.getElementById(
      "achievement-text-1",
    ) as HTMLTextAreaElement | null;
    const firstField = document.getElementById(
      "achievement-text-0",
    ) as HTMLTextAreaElement | null;

    expect(secondField).not.toBeNull();
    fireEvent.focus(secondField!);
    await act(async () => {
      fireEvent.change(secondField!, {
        target: { value: "Improved onboarding across 3 product lines" },
      });
      await vi.advanceTimersByTimeAsync(60);
    });

    expect(secondField).toHaveValue("Improved onboarding across 3 product lines");
    expect(firstField).toHaveValue("Reduced theft by 28%.");
    vi.useRealTimers();
  });

  it("retargets focus when preview selects another achievement while the modal stays open", async () => {
    vi.useFakeTimers();

    const view = render(
      <AchievementsModal
        open
        initialItemId="ach-1"
        items={[
          { id: "ach-1", text: "Reduced theft by 28%." },
          { id: "ach-2", text: "Improved onboarding" },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const firstField = document.getElementById(
      "achievement-text-0",
    ) as HTMLTextAreaElement | null;
    const secondField = document.getElementById(
      "achievement-text-1",
    ) as HTMLTextAreaElement | null;

    expect(document.activeElement).toBe(firstField);

    view.rerender(
      <AchievementsModal
        open
        initialItemId="ach-2"
        items={[
          { id: "ach-1", text: "Reduced theft by 28%." },
          { id: "ach-2", text: "Improved onboarding" },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(document.activeElement).toBe(secondField);

    fireEvent.change(secondField!, {
      target: { value: "Improved onboarding across 3 product lines" },
    });
    expect(secondField).toHaveValue("Improved onboarding across 3 product lines");
    vi.useRealTimers();
  });

  it("lets the user click into a different row after typing in the current one", async () => {
    const user = userEvent.setup();

    render(
      <AchievementsModal
        open
        items={[
          { id: "ach-1", text: "Reduced theft by 28%." },
          { id: "ach-2", text: "Improved onboarding" },
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const firstField = document.getElementById(
      "achievement-text-0",
    ) as HTMLTextAreaElement | null;
    const secondField = document.getElementById(
      "achievement-text-1",
    ) as HTMLTextAreaElement | null;

    expect(firstField).not.toBeNull();
    expect(secondField).not.toBeNull();

    await user.click(firstField!);
    await user.type(firstField!, "x");
    await user.click(secondField!);

    expect(document.activeElement).toBe(secondField);
  });
});
