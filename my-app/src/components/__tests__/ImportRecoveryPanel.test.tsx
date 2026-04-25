import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImportRecoveryPanel } from "../ImportRecoveryPanel";
import type { ImportRecoveryItem } from "../../types/importRecovery";

const baseItem: ImportRecoveryItem = {
  blockId: "recovery-1",
  rawText: "Mixed content block",
  cleanedText: "Mixed content block",
  displayTextSource: "cleaned",
  predictedSection: "summary",
  confidenceScore: "low",
  confidenceValue: 0.4,
  issueFlags: ["weakSectionMatch"],
  reviewStatus: "pending",
  selectedSection: "summary",
  selectedSectionTitle: null,
  sourceSectionTitle: "Mixed block",
  sourceFieldKey: "summary",
  sourceLabel: null,
  sourceSpan: null,
  fragmentAssignments: [],
};

function selectSubstring(element: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let offset = 0;
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let startOffset = 0;
  let endOffset = 0;

  while (current) {
    const textLength = current.textContent?.length ?? 0;
    const nextOffset = offset + textLength;

    if (!startNode && start <= nextOffset) {
      startNode = current;
      startOffset = Math.max(0, start - offset);
    }

    if (!endNode && end <= nextOffset) {
      endNode = current;
      endOffset = Math.max(0, end - offset);
      break;
    }

    offset = nextOffset;
    current = walker.nextNode();
  }

  if (!startNode || !endNode) {
    throw new Error("Missing text node for selection");
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("ImportRecoveryPanel", () => {
  it("opens a stable in-card drawer after text selection and keeps the picker interactive", () => {
    const onAssignFragment = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={onAssignFragment}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = screen.getByText("Mixed content block");
    selectSubstring(textSurface, 0, 5);
    fireEvent.mouseUp(textSurface);

    expect(screen.getByText("Assign selected text")).toBeInTheDocument();
    expect(screen.getByText("Selection ready to assign")).toBeInTheDocument();
    expect(screen.getByText("Mixed")).toBeInTheDocument();

    const drawerSelect = screen.getByLabelText("Add selected text from uncertain section 1") as HTMLSelectElement;
    fireEvent.change(drawerSelect, {
      target: { value: "certifications" },
    });

    expect(drawerSelect.value).toBe("certifications");

    fireEvent.click(screen.getByRole("button", { name: "Add to section" }));
    expect(onAssignFragment).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Select text to assign.")).toBeInTheDocument();
    expect(
      screen.getByText("Pick whole phrases or sentences."),
    ).toBeInTheDocument();
  });

  it("replaces the active draft selection when the user reselects text", () => {
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = screen.getByText("Mixed content block");

    selectSubstring(textSurface, 0, 5);
    fireEvent.mouseUp(textSurface);
    expect(screen.getByText("Mixed")).toBeInTheDocument();

    selectSubstring(textSurface, 6, 13);
    fireEvent.mouseUp(textSurface);

    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByText(/^Mixed$/)).toBeNull();
  });

  it("resets drawer state when a new recovery cycle starts", () => {
    const { rerender } = render(
      <ImportRecoveryPanel
        recoveryCycleKey="cycle-1"
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open recovery drawer" }));
    expect(screen.getByText("Assign selected text")).toBeInTheDocument();

    rerender(
      <ImportRecoveryPanel
        recoveryCycleKey="cycle-2"
        items={[{ ...baseItem, blockId: "recovery-2", cleanedText: "Fresh cycle block" }]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    expect(screen.queryByText("Assign selected text")).toBeNull();
    expect(screen.getByRole("button", { name: "Open recovery drawer" })).toBeInTheDocument();
  });

  it("clears the browser selection on outside click without auto-committing the draft", () => {
    const onAssignFragment = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={onAssignFragment}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = screen.getByText("Mixed content block");
    selectSubstring(textSurface, 0, 5);
    fireEvent.mouseUp(textSurface);

    fireEvent.mouseDown(document.body);

    expect(onAssignFragment).not.toHaveBeenCalled();
    expect(screen.getByText("Mixed")).toBeInTheDocument();
  });

  it("keeps selection offsets aligned after earlier fragments are already assigned", () => {
    const onAssignFragment = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            rawText: "Alpha Beta Gamma",
            cleanedText: "Alpha Beta Gamma",
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 6,
                endOffset: 10,
                selectedText: "Beta",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={onAssignFragment}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = document.querySelector(".dasti-import-recovery__text") as HTMLElement;
    selectSubstring(textSurface, 11, 16);
    fireEvent.mouseUp(textSurface);
    fireEvent.click(screen.getByRole("button", { name: "Add to section" }));

    expect(onAssignFragment).toHaveBeenCalledWith(
      expect.objectContaining({
        range: { start: 11, end: 16 },
        text: "Gamma",
      }),
    );
  });

  it("captures the first letter at the start of a line and after punctuation or spaces", () => {
    const onAssignFragment = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            rawText: "Los\nHello, Los\nHello Los",
            cleanedText: "Los\nHello, Los\nHello Los",
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={onAssignFragment}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = document.querySelector(".dasti-import-recovery__text") as HTMLElement;

    selectSubstring(textSurface, 0, 3);
    fireEvent.mouseUp(textSurface);
    fireEvent.click(screen.getByRole("button", { name: "Add to section" }));

    selectSubstring(textSurface, 11, 14);
    fireEvent.mouseUp(textSurface);
    fireEvent.click(screen.getByRole("button", { name: "Add to section" }));

    selectSubstring(textSurface, 21, 24);
    fireEvent.mouseUp(textSurface);
    fireEvent.click(screen.getByRole("button", { name: "Add to section" }));

    expect(onAssignFragment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ range: { start: 0, end: 3 }, text: "Los" }),
    );
    expect(onAssignFragment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ range: { start: 11, end: 14 }, text: "Los" }),
    );
    expect(onAssignFragment).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ range: { start: 21, end: 24 }, text: "Los" }),
    );
  });

  it("lets the user keep the drawer open manually before closing it", () => {
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open recovery drawer" }));
    expect(screen.getByText("Assign selected text")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close recovery drawer for section 1" }));
    expect(screen.queryByText("Assign selected text")).toBeNull();
  });

  it("uses polished ignored wording instead of ignore done", () => {
    render(
      <ImportRecoveryPanel
        items={[{ ...baseItem, reviewStatus: "ignored" }]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Ignored" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ignore Done/i })).toBeNull();
    expect(screen.getByText("Marked as ignored")).toBeInTheDocument();
  });

  it("shows review progress, helper text, and overlap feedback for the lean MVP", () => {
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            reviewStatus: "accepted",
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    expect(screen.getByText("Reviewing 1 / 1")).toBeInTheDocument();
    expect(screen.getByText("Remaining block")).toBeInTheDocument();
    expect(screen.getByText("Applies to remaining unassigned text.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sends remaining text to Summary. Assigned fragments stay.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ignore affects unassigned text. Saved fragments stay.",
      ),
    ).toBeInTheDocument();
  });

  it("lets the user choose where remaining text will go before accepting it", () => {
    const onUpdateRemainingTarget = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onUpdateRemainingTarget={onUpdateRemainingTarget}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Choose destination for remaining text from uncertain section 1",
      }),
      { target: { value: "certifications" } },
    );

    expect(onUpdateRemainingTarget).toHaveBeenCalledWith({
      blockId: "recovery-1",
      targetSection: "certifications",
      targetSectionTitle: null,
    });
  });

  it("adds bulk guidance when uncertainty covers much of the resume", () => {
    render(
      <ImportRecoveryPanel
        items={Array.from({ length: 5 }, (_, index) => ({
          ...baseItem,
          blockId: `recovery-${index}`,
          cleanedText: `Large uncertain block ${index} `.repeat(80),
          confidenceValue: 0.08,
        }))}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    expect(
      screen.getByText(
        /Low confidence across this resume/i,
      ),
    ).toBeInTheDocument();
  });

  it("does not count fragment-only pending items as reviewed while meaningful residue remains", () => {
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            rawText: "Alpha Beta Gamma",
            cleanedText: "Alpha Beta Gamma",
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 6,
                endOffset: 10,
                selectedText: "Beta",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    expect(screen.getByText("Reviewing 0 / 1")).toBeInTheDocument();
  });

  it("shows lightweight overlap feedback when a selection collides with an existing fragment", () => {
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const textSurface = document.querySelector(".dasti-import-recovery__text") as HTMLElement;
    selectSubstring(textSurface, 0, 4);
    fireEvent.mouseUp(textSurface);

    expect(screen.getByText("Selection overlaps existing assignment.")).toBeInTheDocument();
  });

  it("removes an assigned fragment only after the explicit remove control is pressed", () => {
    const onRemoveFragment = vi.fn();
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={onRemoveFragment}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mixed" }));
    expect(onRemoveFragment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Remove fragment from Summary/i }));
    expect(onRemoveFragment).toHaveBeenCalledWith("recovery-1", "fragment-1");
  });

  it("syncs chip and highlight selection on the first click", () => {
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Added to Summary/i }));

    expect(screen.getByRole("button", { name: /Added to Summary/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Mixed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a fragment selected on repeated highlight and chip clicks", () => {
    render(
      <ImportRecoveryPanel
        items={[
          {
            ...baseItem,
            fragmentAssignments: [
              {
                fragmentId: "fragment-1",
                blockId: "recovery-1",
                startOffset: 0,
                endOffset: 5,
                selectedText: "Mixed",
                selectionSource: "cleaned",
                targetSection: "summary",
                targetSectionTitle: null,
                status: "assigned",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    const highlight = screen.getByRole("button", { name: "Mixed" });
    const chip = screen.getByRole("button", { name: /Added to Summary/i });

    fireEvent.click(highlight);
    fireEvent.click(highlight);
    expect(highlight).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Remove fragment from Summary/i })).toBeInTheDocument();

    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(highlight).toHaveAttribute("aria-pressed", "true");
  });

  it("shows shortcut help and closes it before closing the drawer on escape", () => {
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open recovery drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Show import recovery shortcuts" }));

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByText("Assign selected text")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Assign selected text")).toBeNull();
  });

  it("shows the real save summary in the footer", () => {
    render(
      <ImportRecoveryPanel
        items={[baseItem]}
        overflowCount={0}
        reviewLimit={12}
        onAccept={() => {}}
        onIgnore={() => {}}
        onAssignFragment={() => {}}
        onRemoveFragment={() => {}}
        onImportAsIs={() => {}}
        onCancel={() => {}}
        onApply={() => {}}
        outcomeSummary={{
          fragmentCount: 3,
          acceptedBlockCount: 1,
          pendingCount: 2,
        }}
      />,
    );

    expect(
      screen.getByText("Saving 3 fragments and 1 accepted block now • 2 items stay pending"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save reviewed work" })).toBeInTheDocument();
  });
});
