import React from "react";

import { Check, Question, X } from "@/lib/icons";

import {
  buildRecoveryTextSegments,
  formatRecoveryCommitSummary,
  getRecoveryDisplayText,
  getRecoverySectionDisplayLabel,
  hasOverlappingRecoveryFragment,
  IMPORT_RECOVERY_SECTION_OPTIONS,
  isRecoveryItemResolved,
  normalizeRecoverySectionTarget,
  trimRecoverySelection,
  type RecoveryCommitSummary,
} from "../lib/import-recovery";
import type {
  ImportRecoveryItem,
  ImportRecoverySectionType,
  ImportRecoverySelectionSource,
  ImportRecoverySpan,
} from "../types/importRecovery";

interface ImportRecoveryPanelProps {
  recoveryCycleKey?: string;
  items: ImportRecoveryItem[];
  overflowCount: number;
  reviewLimit: number;
  onAccept: (blockId: string) => void;
  onIgnore: (blockId: string) => void;
  onUpdateRemainingTarget?: (payload: {
    blockId: string;
    targetSection: ImportRecoverySectionType;
    targetSectionTitle?: string | null;
  }) => void;
  onAssignFragment: (payload: {
    blockId: string;
    range: ImportRecoverySpan;
    text: string;
    selectionSource: ImportRecoverySelectionSource;
    targetSection: ImportRecoverySectionType;
    targetSectionTitle?: string | null;
  }) => void;
  onRemoveFragment: (blockId: string, fragmentId: string) => void;
  onImportAsIs: () => void;
  onCancel: () => void;
  onDiscardRecovery?: () => void;
  onApply: () => void;
  outcomeSummary: RecoveryCommitSummary | null;
}

type PendingSelection = {
  blockId: string;
  range: ImportRecoverySpan;
  text: string;
  selectionSource: ImportRecoverySelectionSource;
  targetSection: ImportRecoverySectionType;
  targetSectionTitle: string;
};

function formatIssueFlag(flag: string): string {
  switch (flag) {
    case "glyphIssue":
      return "unusual characters";
    case "bulletIssue":
      return "bullet cleanup";
    case "duplicate":
      return "duplicate text";
    case "unknownSection":
      return "unknown section";
    case "weakSectionMatch":
      return "weak section match";
    case "ambiguousStructure":
      return "ambiguous structure";
    default:
      return flag;
  }
}

function formatReviewState(item: ImportRecoveryItem): string {
  if (item.reviewStatus === "ignored") return "Marked as ignored";
  if (item.reviewStatus === "reassigned") {
    return `Remaining text routed to ${getRecoverySectionDisplayLabel(
      item.selectedSection ?? item.predictedSection,
      item.selectedSectionTitle,
    )}`;
  }
  if (item.reviewStatus === "accepted") {
    return `Remaining text accepted into ${getRecoverySectionDisplayLabel(
      item.selectedSection ?? item.predictedSection,
      item.selectedSectionTitle,
    )}`;
  }
  if (
    normalizeRecoverySectionTarget(item.selectedSection ?? item.predictedSection) !==
      normalizeRecoverySectionTarget(item.predictedSection) ||
    String(item.selectedSectionTitle ?? "").trim().length > 0
  ) {
    return `Ready to accept into ${getRecoverySectionDisplayLabel(
      item.selectedSection ?? item.predictedSection,
      item.selectedSectionTitle,
    )}`;
  }
  return `Suggested: ${getRecoverySectionDisplayLabel(item.predictedSection)}`;
}

function getActionState(item: ImportRecoveryItem): "accepted" | "ignored" | "pending" {
  if (item.reviewStatus === "ignored") return "ignored";
  if (item.reviewStatus === "accepted" || item.reviewStatus === "reassigned") {
    return "accepted";
  }
  return "pending";
}

function isDecorativeRecoveryNode(node: Node | null): boolean {
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node?.parentElement ?? null;
  return Boolean(element?.closest("[data-recovery-decorative='true']"));
}

function getRecoveryFragmentTextLength(fragment: DocumentFragment): number {
  fragment
    .querySelectorAll("[data-recovery-decorative='true']")
    .forEach((element) => element.remove());
  return fragment.textContent?.length ?? 0;
}

function getRecoveryBoundaryOffset(
  root: HTMLElement,
  container: Node,
  offset: number,
): number | null {
  if (isDecorativeRecoveryNode(container)) {
    return null;
  }

  try {
    const boundaryRange = root.ownerDocument.createRange();
    boundaryRange.selectNodeContents(root);
    boundaryRange.setEnd(container, offset);
    return getRecoveryFragmentTextLength(boundaryRange.cloneContents());
  } catch {
    return null;
  }
}

function reconcileRangeToSelectionText(
  text: string,
  offsets: ImportRecoverySpan,
  selectedText: string,
): ImportRecoverySpan {
  if (!selectedText) {
    return offsets;
  }

  if (text.slice(offsets.start, offsets.end) === selectedText) {
    return offsets;
  }

  const searchStart = Math.max(0, offsets.start - 2);
  const searchEnd = Math.min(text.length, offsets.end + 2);
  const correctedStart = text.slice(searchStart, searchEnd).indexOf(selectedText);
  if (correctedStart === -1) {
    return offsets;
  }

  return {
    start: searchStart + correctedStart,
    end: searchStart + correctedStart + selectedText.length,
  };
}

function getRangeOffsets(root: HTMLElement, range: Range): ImportRecoverySpan | null {
  const commonNode = range.commonAncestorContainer;
  const commonElement =
    commonNode.nodeType === Node.ELEMENT_NODE
      ? (commonNode as HTMLElement)
      : commonNode.parentElement;
  if (commonElement && !root.contains(commonElement)) {
    return null;
  }

  const start = getRecoveryBoundaryOffset(
    root,
    range.startContainer,
    range.startOffset,
  );
  const end = getRecoveryBoundaryOffset(root, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  if (end <= start) return null;
  return { start, end };
}

function formatOutcomeSummary(summary: RecoveryCommitSummary | null): string | null {
  if (!summary) return null;
  return formatRecoveryCommitSummary(summary);
}

function getAcceptDecisionHelp(item: ImportRecoveryItem): string {
  const targetLabel = getRecoverySectionDisplayLabel(
    item.selectedSection ?? item.predictedSection,
    item.selectedSectionTitle,
  );
  const hasFragments = item.fragmentAssignments.some(
    (fragment) => fragment.status === "assigned",
  );

  if (hasFragments) {
    return `Sends remaining text to ${targetLabel}. Assigned fragments stay.`;
  }

  return `Sends this block to ${targetLabel}. Ignore skips it.`;
}

export function ImportRecoveryPanel({
  recoveryCycleKey = "default",
  items,
  overflowCount,
  reviewLimit,
  onAccept,
  onIgnore,
  onUpdateRemainingTarget = () => {},
  onAssignFragment,
  onRemoveFragment,
  onImportAsIs,
  onCancel,
  onDiscardRecovery = () => {},
  onApply,
  outcomeSummary,
}: ImportRecoveryPanelProps) {
  const visibleItems = items.slice(0, reviewLimit);
  const blockRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const fragmentHighlightRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const fragmentChipRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const selectionRetryTimeoutRef = React.useRef<number | null>(null);
  const [drawerSelection, setDrawerSelection] = React.useState<PendingSelection | null>(null);
  const [openDrawerBlockId, setOpenDrawerBlockId] = React.useState<string | null>(null);
  const [selectedFragmentId, setSelectedFragmentId] = React.useState<string | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);
  const [lastSelectedDestinations, setLastSelectedDestinations] = React.useState<
    Record<string, { targetSection: ImportRecoverySectionType; targetSectionTitle: string }>
  >({});
  const [selectionFeedback, setSelectionFeedback] = React.useState<{
    blockId: string;
    message: string;
  } | null>(null);

  const resolvedCount = React.useMemo(
    () => items.filter((item) => isRecoveryItemResolved(item)).length,
    [items],
  );
  const uncertaintySummary = React.useMemo(() => {
    const totalChars = items.reduce(
      (sum, item) => sum + getRecoveryDisplayText(item).trim().length,
      0,
    );
    const avgConfidence =
      items.length > 0
        ? items.reduce((sum, item) => sum + Number(item.confidenceValue ?? 0), 0) /
          items.length
        : 0;

    return {
      totalChars,
      avgConfidence,
      isBroad:
        items.length >= 5 ||
        totalChars >= 2400 ||
        (items.length >= 3 && avgConfidence <= 0.2),
    };
  }, [items]);

  React.useEffect(() => {
    if (!uncertaintySummary.isBroad) return;
    try {
      console.info("[importRecovery] broad_uncertainty", {
        itemCount: items.length,
        totalChars: uncertaintySummary.totalChars,
        avgConfidence: uncertaintySummary.avgConfidence,
      });
    } catch {
      /* noop */
    }
  }, [items.length, uncertaintySummary]);

  React.useEffect(() => {
    setDrawerSelection(null);
    setOpenDrawerBlockId(null);
    setSelectedFragmentId(null);
    setShowShortcutHelp(false);
    setLastSelectedDestinations({});
    setSelectionFeedback(null);
    if (selectionRetryTimeoutRef.current !== null) {
      window.clearTimeout(selectionRetryTimeoutRef.current);
      selectionRetryTimeoutRef.current = null;
    }
  }, [recoveryCycleKey]);

  const commitSelection = React.useCallback(() => {
    if (!drawerSelection) return;
    const needsCustomTitle = drawerSelection.targetSection === "custom";
    const trimmedSelection = trimRecoverySelection({
      text: drawerSelection.text,
      range: drawerSelection.range,
    });
    if (!trimmedSelection) return;
    if (needsCustomTitle && drawerSelection.targetSectionTitle.trim().length === 0) return;

    onAssignFragment({
      blockId: drawerSelection.blockId,
      range: trimmedSelection.range,
      text: trimmedSelection.text,
      selectionSource: drawerSelection.selectionSource,
      targetSection: drawerSelection.targetSection,
      targetSectionTitle:
        drawerSelection.targetSection === "custom"
          ? drawerSelection.targetSectionTitle.trim()
          : null,
    });
    setLastSelectedDestinations((current) => ({
      ...current,
      [drawerSelection.blockId]: {
        targetSection: drawerSelection.targetSection,
        targetSectionTitle:
          drawerSelection.targetSection === "custom"
            ? drawerSelection.targetSectionTitle.trim()
            : "",
      },
    }));
    window.getSelection()?.removeAllRanges();
    setSelectionFeedback((current) =>
      current?.blockId === drawerSelection.blockId ? null : current,
    );
    setDrawerSelection((current) =>
      current
        ? {
            ...current,
            text: "",
            range: { start: 0, end: 0 },
          }
        : current,
    );
  }, [drawerSelection, onAssignFragment]);

  React.useEffect(() => {
    return () => {
      if (selectionRetryTimeoutRef.current !== null) {
        window.clearTimeout(selectionRetryTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!selectionFeedback) return undefined;
    const timeoutId = window.setTimeout(() => {
      setSelectionFeedback((current) =>
        current?.blockId === selectionFeedback.blockId ? null : current,
      );
    }, 2200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectionFeedback]);

  React.useEffect(() => {
    if (!selectedFragmentId) return;

    const hasSelectedFragment = items.some((item) =>
      item.fragmentAssignments.some(
        (fragment) =>
          fragment.status === "assigned" && fragment.fragmentId === selectedFragmentId,
      ),
    );

    if (!hasSelectedFragment) {
      setSelectedFragmentId(null);
    }
  }, [items, selectedFragmentId]);

  React.useEffect(() => {
    if (!selectedFragmentId) return;

    if (
      typeof fragmentChipRefs.current[selectedFragmentId]?.scrollIntoView === "function"
    ) {
      fragmentChipRefs.current[selectedFragmentId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    if (
      typeof fragmentHighlightRefs.current[selectedFragmentId]?.scrollIntoView === "function"
    ) {
      fragmentHighlightRefs.current[selectedFragmentId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [selectedFragmentId]);

  React.useEffect(() => {
    if (!openDrawerBlockId) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() ?? "";
      const isInputControl =
        tagName === "textarea" ||
        tagName === "button" ||
        tagName === "input" ||
        tagName === "select";
      const isEditable = Boolean(target?.isContentEditable);

      if (event.key === "Escape") {
        event.preventDefault();
        if (showShortcutHelp) {
          setShowShortcutHelp(false);
          return;
        }
        setOpenDrawerBlockId(null);
        setDrawerSelection((current) =>
          current?.blockId === openDrawerBlockId ? null : current,
        );
        setSelectedFragmentId(null);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        const activeItem = items.find((item) => item.blockId === openDrawerBlockId) ?? null;
        const activeRemainingSection =
          activeItem?.selectedSection ?? activeItem?.predictedSection ?? null;
        const activeRemainingTitle = activeItem?.selectedSectionTitle ?? "";
        const canAcceptRemaining =
          activeRemainingSection !== "custom" || activeRemainingTitle.trim().length > 0;
        if (!canAcceptRemaining) {
          return;
        }
        event.preventDefault();
        onAccept(openDrawerBlockId);
        return;
      }

      if (
        event.key === "Enter" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isInputControl &&
        !isEditable
      ) {
        const activeSelection =
          drawerSelection?.blockId === openDrawerBlockId ? drawerSelection : null;
        const canAssign = Boolean(
          activeSelection?.text.trim() &&
            (activeSelection.targetSection !== "custom" ||
              activeSelection.targetSectionTitle.trim().length > 0),
        );
        if (canAssign) {
          event.preventDefault();
          commitSelection();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [commitSelection, drawerSelection, items, onAccept, openDrawerBlockId, showShortcutHelp]);

  React.useEffect(() => {
    if (!openDrawerBlockId) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const activeBlock = blockRefs.current[openDrawerBlockId];
      if (!target || activeBlock?.contains(target)) {
        return;
      }

      window.getSelection()?.removeAllRanges();
      setShowShortcutHelp(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [openDrawerBlockId]);

  const readSelectionForBlock = React.useCallback((item: ImportRecoveryItem, allowRetry = true) => {
    const root = blockRefs.current[item.blockId];
    if (!root || typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (allowRetry) {
        if (selectionRetryTimeoutRef.current !== null) {
          window.clearTimeout(selectionRetryTimeoutRef.current);
        }
        selectionRetryTimeoutRef.current = window.setTimeout(() => {
          selectionRetryTimeoutRef.current = null;
          readSelectionForBlock(item, false);
        }, 0);
      }
      return;
    }
    const range = selection.getRangeAt(0);
    const rawOffsets = getRangeOffsets(root, range);
    if (!rawOffsets) {
      if (allowRetry) {
        if (selectionRetryTimeoutRef.current !== null) {
          window.clearTimeout(selectionRetryTimeoutRef.current);
        }
        selectionRetryTimeoutRef.current = window.setTimeout(() => {
          selectionRetryTimeoutRef.current = null;
          readSelectionForBlock(item, false);
        }, 0);
      }
      return;
    }
    const text = getRecoveryDisplayText(item);
    const browserSelectedText = range.toString();
    const offsets = reconcileRangeToSelectionText(text, rawOffsets, browserSelectedText);
    const rawSelectedText = text.slice(offsets.start, offsets.end);
    if (
      typeof window !== "undefined" &&
      (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__ === true &&
      rawSelectedText !== browserSelectedText
    ) {
      try {
        console.debug("[ImportRecoveryPanel] selection text mismatch", {
          blockId: item.blockId,
          rawOffsets,
          offsets,
          browserSelectedText,
          rawSelectedText,
        });
      } catch {
        /* noop */
      }
    }
    const trimmedSelection = trimRecoverySelection({ text: rawSelectedText, range: offsets });
    if (!trimmedSelection) {
      if (allowRetry) {
        if (selectionRetryTimeoutRef.current !== null) {
          window.clearTimeout(selectionRetryTimeoutRef.current);
        }
        selectionRetryTimeoutRef.current = window.setTimeout(() => {
          selectionRetryTimeoutRef.current = null;
          readSelectionForBlock(item, false);
        }, 0);
      }
      return;
    }

    if (
      typeof window !== "undefined" &&
      (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__ === true
    ) {
      try {
        console.debug("[ImportRecoveryPanel] selection captured", {
          blockId: item.blockId,
          range: trimmedSelection.range,
          text: trimmedSelection.text,
          targetSection:
            lastSelectedDestinations[item.blockId]?.targetSection ?? item.predictedSection,
        });
      } catch {
        /* noop */
      }
    }

    if (hasOverlappingRecoveryFragment(item.fragmentAssignments, trimmedSelection.range)) {
      setOpenDrawerBlockId(item.blockId);
      setSelectionFeedback({
        blockId: item.blockId,
        message: "Selection overlaps existing assignment.",
      });
      return;
    }

    setSelectionFeedback(null);
    setOpenDrawerBlockId(item.blockId);
    setShowShortcutHelp(false);
    setDrawerSelection({
      blockId: item.blockId,
      range: trimmedSelection.range,
      text: trimmedSelection.text,
      selectionSource: item.displayTextSource,
      targetSection:
        lastSelectedDestinations[item.blockId]?.targetSection ?? item.predictedSection,
      targetSectionTitle: lastSelectedDestinations[item.blockId]?.targetSectionTitle ?? "",
    });
    setSelectedFragmentId(null);
  }, [lastSelectedDestinations]);

  const outcomeSummaryText = formatOutcomeSummary(outcomeSummary);

  return (
    <section aria-label="Import recovery review" className="dasti-import-recovery">
      <div className="dasti-import-recovery__header">
        <div className="dasti-import-recovery__header-copy">
          <div className="dasti-inline-review__eyebrow">Import recovery</div>
          <div className="dasti-import-recovery__title">
            Resume imported. Review {items.length} uncertain
            {items.length === 1 ? " section" : " sections"}.
          </div>
          <div className="dasti-import-recovery__progress">
            Reviewing {resolvedCount} / {items.length}
          </div>
          <p className="dasti-import-recovery__summary">
            Select what to recover. Assigned text stays highlighted.
          </p>
          {overflowCount > 0 ? (
            <p className="dasti-import-recovery__summary">
              Showing first {reviewLimit}. Other {overflowCount} keep the suggested
              section.
            </p>
          ) : null}
          {uncertaintySummary.isBroad ? (
            <p className="dasti-import-recovery__summary">
              Low confidence across this resume. Recover key sections, or pick
              'Import as-is'.
            </p>
          ) : null}
        </div>
        <div className="dasti-inline-review__status" data-review-state="required">
          Review required
        </div>
      </div>

      <div role="list" className="dasti-import-recovery__list">
        {visibleItems.map((item, index) => {
          const actionState = getActionState(item);
          const displayText = getRecoveryDisplayText(item);
          const segments = buildRecoveryTextSegments(displayText, item.fragmentAssignments);
          const isDrawerOpen = openDrawerBlockId === item.blockId;
          const currentDrawerSelection =
            isDrawerOpen && drawerSelection?.blockId === item.blockId
              ? drawerSelection
              : null;
          const remainingTargetSection =
            item.selectedSection ?? item.predictedSection;
          const remainingTargetTitle = item.selectedSectionTitle ?? "";
          const canAcceptRemaining =
            remainingTargetSection !== "custom" || remainingTargetTitle.trim().length > 0;
          const drawerSection = currentDrawerSelection?.targetSection ?? item.predictedSection;
          const drawerTitle = currentDrawerSelection?.targetSectionTitle ?? "";
          const drawerHasSelection = Boolean(currentDrawerSelection?.text.trim());
          const activeFragmentAssignments = item.fragmentAssignments.filter(
            (fragment) => fragment.status === "assigned",
          );
          const shortcutTooltipId = `import-recovery-shortcuts-${item.blockId}`;

          return (
            <article key={item.blockId} role="listitem" className="dasti-import-recovery__item">
              <div className="dasti-import-recovery__item-header">
                <div>
                  <div className="dasti-inline-review__title">Uncertain section {index + 1}</div>
                  <div className="dasti-import-recovery__state-copy">
                    {formatReviewState(item)}
                  </div>
                </div>
                <div className="dasti-import-recovery__confidence">
                  Confidence {item.confidenceValue?.toFixed(2) ?? "0.65"}
                </div>
              </div>

              <div className="dasti-import-recovery__meta">
                <div>
                  Source: {item.sourceSectionTitle?.trim() || item.sourceLabel || "Imported text"}
                </div>
                {item.issueFlags.length > 0 ? (
                  <div>Issues: {item.issueFlags.map(formatIssueFlag).join(", ")}</div>
                ) : null}
              </div>

              {isDrawerOpen ? (
                <section
                  className="dasti-import-recovery__drawer"
                  aria-label={`Recovery drawer for section ${index + 1}`}
                >
                  <div className="dasti-import-recovery__drawer-header">
                    <div>
                      <div className="dasti-import-recovery__drawer-title">
                        Assign selected text
                      </div>
                      <div className="dasti-import-recovery__drawer-status">
                        {selectionFeedback?.blockId === item.blockId
                          ? selectionFeedback.message
                          : drawerHasSelection
                            ? "Selection ready to assign"
                            : "Select text to assign."}
                      </div>
                    </div>
                    <div className="dasti-import-recovery__drawer-actions">
                      <button
                        type="button"
                        className="dasti-import-recovery__drawer-help"
                        aria-label="Show import recovery shortcuts"
                        aria-expanded={showShortcutHelp}
                        aria-controls={showShortcutHelp ? shortcutTooltipId : undefined}
                        onClick={() => setShowShortcutHelp((current) => !current)}
                      >
                        <Question size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                      {showShortcutHelp ? (
                        <div
                          id={shortcutTooltipId}
                          className="dasti-import-recovery__drawer-shortcuts"
                          role="tooltip"
                        >
                          <strong>Shortcuts</strong>
                          <span>Enter &mdash; Add selected text</span>
                          <span>Esc &mdash; Close drawer</span>
                          <span>Cmd/Ctrl + Enter &mdash; Accept remaining block</span>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="dasti-import-recovery__drawer-close"
                        aria-label={`Close recovery drawer for section ${index + 1}`}
                      onClick={() => {
                        setOpenDrawerBlockId(null);
                        setShowShortcutHelp(false);
                        setSelectedFragmentId(null);
                        setSelectionFeedback((current) =>
                          current?.blockId === item.blockId ? null : current,
                        );
                        if (drawerSelection?.blockId === item.blockId) {
                          setDrawerSelection(null);
                        }
                      }}
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                    </div>
                  </div>
                  <div
                    className="dasti-import-recovery__drawer-preview"
                    data-has-selection={drawerHasSelection ? "true" : "false"}
                  >
                    {drawerHasSelection
                      ? currentDrawerSelection?.text
                      : "Highlight part of the text below."}
                  </div>
                  <div className="dasti-import-recovery__drawer-tip">
                    Pick whole phrases or sentences.
                  </div>
                  <div className="dasti-import-recovery__drawer-controls">
                    <select
                      className="dasti-select dasti-select--sm"
                      aria-label={`Add selected text from uncertain section ${index + 1}`}
                      value={drawerSection}
                      onChange={(event) => {
                        const nextSection = event.currentTarget.value as ImportRecoverySectionType;
                        setDrawerSelection((current) =>
                            current && current.blockId === item.blockId
                              ? {
                                  ...current,
                                  targetSection: nextSection,
                                  targetSectionTitle:
                                    nextSection === "custom" ? current.targetSectionTitle : "",
                                }
                              : current,
                        );
                        setLastSelectedDestinations((current) => ({
                          ...current,
                          [item.blockId]: {
                            targetSection: nextSection,
                            targetSectionTitle:
                              nextSection === "custom"
                                ? current[item.blockId]?.targetSectionTitle ?? ""
                                : "",
                          },
                        }));
                      }}
                    >
                      {IMPORT_RECOVERY_SECTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="dasti-button dasti-button--primary dasti-button--pill dasti-button--sm"
                      disabled={
                        !drawerHasSelection ||
                        (drawerSection === "custom" && drawerTitle.trim().length === 0)
                      }
                      onClick={commitSelection}
                    >
                      Add to section
                    </button>
                  </div>
                  {drawerSection === "custom" ? (
                    <input
                      type="text"
                      className="dasti-select dasti-select--sm"
                      aria-label={`Custom destination for uncertain section ${index + 1}`}
                      placeholder="Name this section"
                      value={drawerTitle}
                      onChange={(event) => {
                        const nextTitle = event.currentTarget.value;
                        setDrawerSelection((current) =>
                          current && current.blockId === item.blockId
                            ? { ...current, targetSectionTitle: nextTitle }
                            : current,
                        );
                        setLastSelectedDestinations((current) => ({
                          ...current,
                          [item.blockId]: {
                            targetSection: drawerSection,
                            targetSectionTitle: nextTitle,
                          },
                        }));
                      }}
                    />
                  ) : null}
                </section>
              ) : (
                <button
                  type="button"
                  className="dasti-import-recovery__drawer-open"
                  onClick={() => {
                    setOpenDrawerBlockId(item.blockId);
                    setShowShortcutHelp(false);
                    setDrawerSelection((current) =>
                        current && current.blockId === item.blockId
                          ? current
                          : {
                              blockId: item.blockId,
                              range: { start: 0, end: 0 },
                              text: "",
                              selectionSource: item.displayTextSource,
                              targetSection:
                                lastSelectedDestinations[item.blockId]?.targetSection ??
                                item.predictedSection,
                              targetSectionTitle:
                                lastSelectedDestinations[item.blockId]?.targetSectionTitle ?? "",
                            },
                    );
                    setSelectedFragmentId(null);
                  }}
                >
                  Open recovery drawer
                </button>
              )}

              <div
                ref={(node) => {
                  blockRefs.current[item.blockId] = node;
                }}
                className="dasti-import-recovery__text"
                onMouseUp={() => readSelectionForBlock(item)}
                onKeyUp={() => readSelectionForBlock(item)}
              >
                {segments.map((segment) => {
                  if (!segment.assigned) {
                    return <React.Fragment key={segment.key}>{segment.text}</React.Fragment>;
                  }
                  const isSelected = selectedFragmentId === segment.fragment?.fragmentId;
                  return (
                    <span key={segment.key} className="dasti-import-recovery__highlight-shell">
                      <mark
                        ref={(node) => {
                          if (segment.fragment?.fragmentId) {
                            fragmentHighlightRefs.current[segment.fragment.fragmentId] = node;
                          }
                        }}
                        className="dasti-import-recovery__highlight"
                        data-target-section={segment.fragment?.targetSection}
                        data-selected={isSelected ? "true" : "false"}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        title={getRecoverySectionDisplayLabel(
                          segment.fragment?.targetSection ?? item.predictedSection,
                          segment.fragment?.targetSectionTitle,
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseUp={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (segment.fragment) {
                            setSelectedFragmentId(segment.fragment.fragmentId);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            segment.fragment &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setSelectedFragmentId(segment.fragment.fragmentId);
                          }
                        }}
                      >
                        {segment.text}
                      </mark>
                    </span>
                  );
                })}
              </div>

              {activeFragmentAssignments.length > 0 ? (
                <div className="dasti-import-recovery__chips">
                  {activeFragmentAssignments.map((fragment) => {
                    const isSelected = selectedFragmentId === fragment.fragmentId;

                    return (
                      <div
                        key={fragment.fragmentId}
                        className="dasti-import-recovery__chip-group"
                        data-selected={isSelected ? "true" : "false"}
                      >
                        <button
                          type="button"
                          ref={(node) => {
                            fragmentChipRefs.current[fragment.fragmentId] = node;
                          }}
                          className="dasti-import-recovery__chip"
                          aria-pressed={isSelected}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedFragmentId(fragment.fragmentId);
                          }}
                        >
                          <span>
                            Added to {getRecoverySectionDisplayLabel(
                              fragment.targetSection,
                              fragment.targetSectionTitle,
                            )}
                          </span>
                        </button>
                        {isSelected ? (
                          <button
                            type="button"
                            data-recovery-decorative="true"
                            className="dasti-import-recovery__chip-remove"
                            aria-label={`Remove fragment from ${getRecoverySectionDisplayLabel(fragment.targetSection, fragment.targetSectionTitle)}`}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={() => {
                              onRemoveFragment(item.blockId, fragment.fragmentId);
                              setSelectedFragmentId(null);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {activeFragmentAssignments.length > 0 ? (
                <div className="dasti-import-recovery__remaining">
                  <div className="dasti-import-recovery__remaining-label">Remaining block</div>
                  <div className="dasti-import-recovery__residue-hint">
                    Applies to remaining unassigned text.
                  </div>
                  <div className="dasti-import-recovery__residue-hint">
                    {getAcceptDecisionHelp(item)}
                  </div>
                </div>
              ) : (
                <div className="dasti-import-recovery__remaining">
                  <div className="dasti-import-recovery__residue-hint">
                    {getAcceptDecisionHelp(item)}
                  </div>
                </div>
              )}
              <div className="dasti-import-recovery__remaining-controls">
                <label className="dasti-import-recovery__remaining-field">
                  <span className="dasti-import-recovery__remaining-label">
                    Remaining text goes to
                  </span>
                  <select
                    className="dasti-select dasti-select--sm"
                    aria-label={`Choose destination for remaining text from uncertain section ${index + 1}`}
                    value={remainingTargetSection}
                    onChange={(event) => {
                      const nextSection =
                        event.currentTarget.value as ImportRecoverySectionType;
                      onUpdateRemainingTarget({
                        blockId: item.blockId,
                        targetSection: nextSection,
                        targetSectionTitle:
                          nextSection === "custom" ? remainingTargetTitle : null,
                      });
                    }}
                  >
                    {IMPORT_RECOVERY_SECTION_OPTIONS.map((option) => (
                      <option key={`remaining-${item.blockId}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {remainingTargetSection === "custom" ? (
                  <input
                    type="text"
                    className="dasti-select dasti-select--sm"
                    aria-label={`Custom destination for remaining text from uncertain section ${index + 1}`}
                    placeholder="Name this section"
                    value={remainingTargetTitle}
                    onChange={(event) => {
                      onUpdateRemainingTarget({
                        blockId: item.blockId,
                        targetSection: remainingTargetSection,
                        targetSectionTitle: event.currentTarget.value,
                      });
                    }}
                  />
                ) : null}
              </div>

              <div className="dasti-import-recovery__actions">
                <button
                  type="button"
                  className={[
                    "dasti-button",
                    "dasti-button--pill",
                    "dasti-button--sm",
                    actionState === "accepted"
                      ? "dasti-button--success"
                      : "dasti-button--secondary",
                  ].join(" ")}
                  onClick={() => onAccept(item.blockId)}
                  disabled={!canAcceptRemaining}
                  aria-label={
                    activeFragmentAssignments.length > 0
                      ? "Accept remaining text"
                      : "Accept block"
                  }
                >
                  {actionState === "accepted" ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  {activeFragmentAssignments.length > 0 ? "Accept remaining" : "Accept block"}
                </button>

                <button
                  type="button"
                  className={[
                    "dasti-button",
                    "dasti-button--pill",
                    "dasti-button--sm",
                    actionState === "ignored"
                      ? "dasti-button--warning"
                      : "dasti-button--secondary",
                  ].join(" ")}
                  onClick={() => onIgnore(item.blockId)}
                  aria-label={
                    activeFragmentAssignments.length > 0
                      ? "Ignore remaining unassigned text"
                      : actionState === "ignored"
                        ? "Ignored"
                        : "Ignore"
                  }
                >
                  {actionState === "ignored" ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  Ignore
                </button>
              </div>
              {activeFragmentAssignments.length > 0 ? (
                <div className="dasti-import-recovery__ignore-note">
                  Ignore affects unassigned text. Saved fragments stay.
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="dasti-import-recovery__footer">
        {outcomeSummaryText ? (
          <div className="dasti-import-recovery__footer-summary">{outcomeSummaryText}</div>
        ) : null}
        <button
          type="button"
          className="dasti-button dasti-button--primary dasti-button--pill"
          onClick={onApply}
        >
          Save reviewed work
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill"
          onClick={onImportAsIs}
        >
          Import as-is
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill"
          onClick={onDiscardRecovery}
        >
          Discard recovery
        </button>
      </div>
    </section>
  );
}

export default ImportRecoveryPanel;
