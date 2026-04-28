import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useImperativeHandle,
  useRef,
  forwardRef,
} from "react";
import { useAction } from "convex/react";
import type { IExperienceItem, IEducationItem } from "../../types/cvDocument";
import { v4 as uuidv4 } from "uuid";
import { parseIsoToParts, composeIsoFromParts } from "../../lib/date-utils";
import { mapAiExperience, mapAiEducation } from "../../lib/ai-mapping";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  BulletListExtension,
  OrderedListExtension,
  ListItemExtension,
  ParagraphExtension,
  HistoryExtension,
  HardBreakExtension,
} from "remirror/extensions";
import type { RemirrorJSON } from "remirror";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { api } from "../../../convex/_generated/api";
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { Loader2, TrashSimple, Wand2, X } from "@/lib/icons";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { CvModalShell } from "./CvModalShell";
import { useCvAiCapabilities } from "../../hooks/use-cv-ai-capabilities";
import { AI_UNAVAILABLE_TOAST } from "../../lib/toast-copy";
import FloatingAiToolbar, { type InlineAiActionId } from "../FloatingAiToolbar";
import AiSuggestionCard from "../ai/AiSuggestionCard";
import {
  createAiUndoSnapshot,
  normalizeEditorAiTextResult,
  restoreAiUndoSnapshot,
  type AiUndoSnapshot,
} from "../../lib/ai/applyAiSuggestion";
import {
  createAiInteractionId,
  recordAiInteractionEvent,
} from "../../lib/ai/aiInteractionTelemetry";
import type { AiApplyMode, AiOutputMode } from "../../lib/ai/interactionRulebook";
import { deriveResponsibilityBullets } from "../../lib/resumeResponsibilityAuthority";
import {
  getDomSelectionState,
  isInlineAiToolbarActiveElement,
  isPrimaryPointerPressed,
} from "../../lib/editor-ai-selection";

type UiPatch = Partial<{
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  startShowDay: boolean;
  endShowDay: boolean;
  isCurrent: boolean;
}>;

type UiState = {
  startYear: string;
  startMonth: string;
  startDay: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  startShowDay: boolean;
  endShowDay: boolean;
  isCurrent: boolean;
};

interface BaseModalProps {
  open: boolean;
  onClose: () => void;
}

interface ExperienceModalProps extends BaseModalProps {
  items: IExperienceItem[];
  initialItemId?: string;
  recoveryNotesByItemId?: Record<string, string[]>;
  onDismissRecoveryNotesByItemId?: (itemId: string) => void;
  onSave: (next: IExperienceItem[]) => void;
}

interface EducationModalProps extends BaseModalProps {
  items: IEducationItem[];
  initialItemId?: string;
  recoveryNotesByItemId?: Record<string, string[]>;
  onDismissRecoveryNotesByItemId?: (itemId: string) => void;
  onSave: (next: IEducationItem[]) => void;
}

/**
 * Shared UI helpers
 */
function getYearOptions(): number[] {
  const now = new Date().getUTCFullYear();
  const start = 1950;
  const end = now + 5;
  const years: number[] = [];
  for (let y = end; y >= start; y--) years.push(y);
  return years;
}

function normalizeMonthYearDateFields<
  T extends {
    startDate?: string;
    endDate?: string | null;
    startDatePrecision?: "year" | "month" | "day";
    endDatePrecision?: "year" | "month" | "day";
    isCurrent?: boolean;
    currentlyWorking?: boolean;
  },
>(item: T): T {
  const startParts = parseIsoToParts(item.startDate);
  const endParts = parseIsoToParts(item.endDate ?? undefined);
  const startPrecision = startParts.month
    ? "month"
    : startParts.year
      ? "year"
      : undefined;
  const endPrecision = endParts.month
    ? "month"
    : endParts.year
      ? "year"
      : undefined;
  const startComposed = composeIsoFromParts({
    year: startParts.year,
    month: startParts.month,
    precision: startPrecision,
  });
  const endComposed = composeIsoFromParts({
    year: endParts.year,
    month: endParts.month,
    precision: endPrecision,
  });

  return {
    ...item,
    startDate: startComposed.iso,
    startDatePrecision: startComposed.precision,
    endDate:
      item.isCurrent || item.currentlyWorking ? null : endComposed.iso ?? null,
    endDatePrecision:
      item.isCurrent || item.currentlyWorking
        ? undefined
        : endComposed.precision,
  };
}

// Build a bullet list Remirror doc from an achievements[] array (legacy migration)
function achievementsToBulletDoc(
  list: string[] | undefined | null,
): RemirrorJSON {
  const items = Array.isArray(list)
    ? list.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];
  if (items.length === 0) return ensureRemirrorDoc(undefined as any);
  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: items.map((txt) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: txt }],
            },
          ],
        })),
      },
    ],
  } as RemirrorJSON;
}

// Lightweight embedded Remirror editor used inside the Experience modal per entry
type RichEditorHandle = { flush: () => void };

function hasNonEmptyDocText(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const queue: unknown[] = [value];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const rec = node as Record<string, unknown>;
    if (typeof rec.text === "string" && rec.text.trim().length > 0) return true;
    if (Array.isArray(rec.content)) queue.push(...rec.content);
    if (Array.isArray(rec.items)) queue.push(...rec.items);
  }
  return false;
}

function plainTextFromValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const queue: unknown[] = [value];
  const parts: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim()) {
      parts.push(record.text.trim());
    }
    if (Array.isArray(record.content)) queue.push(...record.content);
    if (Array.isArray(record.items)) queue.push(...record.items);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function splitPlainTextIntoLines(text: string): string[] {
  return text
    .replace(/[•\u2022]/g, "\n")
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[\-\s]+/, "").trim())
    .filter(Boolean);
}

function formatDiffLines(value: string[]): string {
  return value.length > 0
    ? value.map((line) => `• ${line}`).join("\n")
    : "No existing content.";
}

function ModalAiDiffCard({
  label,
  before,
  after,
  onAccept,
  onDiscard,
}: {
  label: string;
  before: string[];
  after: string[];
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <AiSuggestionCard
      compact
      actionLabel={label}
      title={label}
      beforeText={formatDiffLines(before)}
      afterText={formatDiffLines(after)}
      onAccept={onAccept}
      onDiscard={onDiscard}
    />
  );
}

type InlineAiSuggestionState = {
  actionId: InlineAiActionId;
  actionLabel: string;
  interactionId: string;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  beforeText: string;
  afterText: string;
  from: number;
  to: number;
  status: "preview" | "accepted";
  undoSnapshot?: AiUndoSnapshot<RemirrorJSON>;
};

const RichEditor = forwardRef<
  RichEditorHandle,
  {
    initialContent: RemirrorJSON;
    onChangeDoc: (doc: RemirrorJSON) => void;
  }
>(({ initialContent, onChangeDoc }, ref) => {
  const transformEditorSelectionAction = useAction(
    (api.functions as any).transformEditorSelection,
  );
  const extensions = useMemo(
    () => [
      // Core text + history
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      // Inline marks
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      // Lists
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
    ],
    [],
  );

  // Initialize with provided content; keep internal state stable
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialContent as any,
  });
  const [inlineSelectionState, setInlineSelectionState] = useState<{
    text: string;
    anchor: { left: number; top: number; bottom: number };
    from: number;
    to: number;
  } | null>(null);
  const [isApplyingInlineAi, setIsApplyingInlineAi] = useState(false);
  const [pendingInlineAiActionId, setPendingInlineAiActionId] =
    useState<InlineAiActionId | null>(null);
  const [inlineAiSuggestion, setInlineAiSuggestion] =
    useState<InlineAiSuggestionState | null>(null);
  const selectionDebounceRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    try {
      const view = (manager as any)?.view;
      const doc: RemirrorJSON =
        (view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
        ensureRemirrorDoc(undefined as any);
      onChangeDoc(ensureRemirrorDoc(doc as any));
    } catch {
      /* noop */
    }
  }, [manager, onChangeDoc]);

  useImperativeHandle(ref, () => ({ flush }), [flush]);

  const handleChange = useCallback(
    (param: any) => {
      try {
        onChange(param);
        const view = (manager as any)?.view;
        const doc: RemirrorJSON =
          (view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
          ensureRemirrorDoc(undefined as any);
        onChangeDoc(ensureRemirrorDoc(doc as any));
      } catch {
        /* noop */
      }
    },
    [manager, onChange, onChangeDoc],
  );

  useEffect(() => {
    return () => {
      if (selectionDebounceRef.current !== null) {
        window.clearTimeout(selectionDebounceRef.current);
      }
    };
  }, []);

  const runSelectionCheck = useCallback(() => {
    if (isPrimaryPointerPressed()) {
      return;
    }
    const view = (manager as any)?.view;
    const selection = view?.state?.selection;
    const nextSelection = getDomSelectionState(
      view?.dom as HTMLElement | null,
    );

    if (!nextSelection || !selection || selection.empty) {
      if (isInlineAiToolbarActiveElement()) {
        return;
      }
      setInlineSelectionState(null);
      return;
    }

    setInlineSelectionState({
      ...nextSelection,
      from: selection.from,
      to: selection.to,
    });
  }, [manager]);

  const scheduleSelectionCheck = useCallback((immediate = false) => {
    if (selectionDebounceRef.current !== null) {
      window.clearTimeout(selectionDebounceRef.current);
    }

    if (immediate) {
      runSelectionCheck();
      return;
    }

    selectionDebounceRef.current = window.setTimeout(() => {
      selectionDebounceRef.current = null;
      runSelectionCheck();
    }, 90);
  }, [runSelectionCheck]);

  useEffect(() => {
    const handleSelectionChange = () => {
      scheduleSelectionCheck();
    };
    const handlePointerUp = () => {
      scheduleSelectionCheck();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [scheduleSelectionCheck]);

  useEffect(() => {
    if (!inlineSelectionState) {
      return undefined;
    }

    const view = (manager as any)?.view;
    const root = view?.dom as HTMLElement | null;
    const handleReposition = () => {
      scheduleSelectionCheck(true);
    };
    const resizeObserver =
      root && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleReposition)
        : null;

    if (root) {
      resizeObserver?.observe(root);
    }

    window.addEventListener("resize", handleReposition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleReposition);
    };
  }, [inlineSelectionState, manager, scheduleSelectionCheck]);

  const handleRunInlineAiAction = useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!inlineSelectionState) return;

      const view = (manager as any)?.view;
      if (!view) return;

      const interactionId = createAiInteractionId();
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "experience_education_modal",
        actionId,
      });

      try {
        setPendingInlineAiActionId(actionId);
        setIsApplyingInlineAi(true);
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: inlineSelectionState.text,
        });
        const normalizedResult = normalizeEditorAiTextResult(result, actionId);

        if (!normalizedResult) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "experience_education_modal",
            actionId,
            errorKind: "empty_result",
          });
          return;
        }

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "experience_education_modal",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });

        const suggestionBase = {
          actionId: normalizedResult.actionId,
          actionLabel: normalizedResult.actionLabel,
          interactionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
          beforeText: inlineSelectionState.text,
          afterText: normalizedResult.text,
          from: inlineSelectionState.from,
          to: inlineSelectionState.to,
        };

        if (normalizedResult.applyMode === "preview_required") {
          setInlineAiSuggestion({
            ...suggestionBase,
            status: "preview",
          });
          setInlineSelectionState(null);
          return;
        }

        const beforeDoc = view.state.doc.toJSON() as RemirrorJSON;
        const tr = view.state.tr.insertText(
          normalizedResult.text,
          inlineSelectionState.from,
          inlineSelectionState.to,
        );
        view.dispatch(tr);
        view.focus();
        setInlineSelectionState(null);
        const afterDoc = ensureRemirrorDoc(view.state.doc.toJSON() as any);
        setInlineAiSuggestion({
          ...suggestionBase,
          status: "accepted",
          undoSnapshot: createAiUndoSnapshot(beforeDoc, afterDoc),
        });
        onChangeDoc(afterDoc);
        recordAiInteractionEvent({
          name: "ai_accepted",
          interactionId,
          surface: "experience_education_modal",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "experience_education_modal",
          actionId,
          errorKind: "request_failed",
        });
        throw error;
      } finally {
        setIsApplyingInlineAi(false);
        setPendingInlineAiActionId(null);
      }
    },
    [
      inlineSelectionState,
      manager,
      onChangeDoc,
      transformEditorSelectionAction,
    ],
  );

  const handleAcceptInlineAiSuggestion = useCallback(() => {
    if (!inlineAiSuggestion) return;

    const view = (manager as any)?.view;
    if (!view) return;

    const beforeDoc = view.state.doc.toJSON() as RemirrorJSON;
    const tr = view.state.tr.insertText(
      inlineAiSuggestion.afterText,
      inlineAiSuggestion.from,
      inlineAiSuggestion.to,
    );
    view.dispatch(tr);
    view.focus();
    const afterDoc = ensureRemirrorDoc(view.state.doc.toJSON() as any);
    setInlineAiSuggestion({
      ...inlineAiSuggestion,
      status: "accepted",
      undoSnapshot: createAiUndoSnapshot(beforeDoc, afterDoc),
    });
    onChangeDoc(afterDoc);
    recordAiInteractionEvent({
      name: "ai_accepted",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "experience_education_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
  }, [inlineAiSuggestion, manager, onChangeDoc]);

  const handleUndoInlineAiSuggestion = useCallback(() => {
    if (!inlineAiSuggestion?.undoSnapshot) return;

    const view = (manager as any)?.view;
    const restoredDoc = restoreAiUndoSnapshot(inlineAiSuggestion.undoSnapshot);
    const nextState =
      (manager as any)?.createState?.({ content: restoredDoc as any }) ??
      undefined;

    if (view && nextState && typeof view.updateState === "function") {
      view.updateState(nextState);
      view.focus();
    }

    onChangeDoc(ensureRemirrorDoc(restoredDoc as any));
    recordAiInteractionEvent({
      name: "ai_undone",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "experience_education_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
    setInlineAiSuggestion(null);
  }, [inlineAiSuggestion, manager, onChangeDoc]);

  const handleDiscardInlineAiSuggestion = useCallback(() => {
    if (!inlineAiSuggestion) return;
    recordAiInteractionEvent({
      name: "ai_discarded",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "experience_education_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
    setInlineAiSuggestion(null);
  }, [inlineAiSuggestion]);

  return (
    <div className="dasti-rich dasti-rich--cv-reading-measure">
      {inlineSelectionState ? (
        <FloatingAiToolbar
          open
          anchor={inlineSelectionState.anchor}
          isLoading={isApplyingInlineAi}
          pendingActionId={pendingInlineAiActionId}
          onClose={() => setInlineSelectionState(null)}
          onRunAction={handleRunInlineAiAction}
        />
      ) : null}
      {inlineAiSuggestion ? (
        <AiSuggestionCard
          compact
          actionLabel={inlineAiSuggestion.actionLabel}
          beforeText={inlineAiSuggestion.beforeText}
          afterText={inlineAiSuggestion.afterText}
          status={inlineAiSuggestion.status}
          onAccept={handleAcceptInlineAiSuggestion}
          onDiscard={handleDiscardInlineAiSuggestion}
          onUndo={handleUndoInlineAiSuggestion}
        />
      ) : null}
      <Remirror
        manager={manager}
        initialContent={state}
        onChange={handleChange}
      >
        <div
          className="rich-content"
          onPointerUp={scheduleSelectionCheck}
          onKeyUp={scheduleSelectionCheck}
        >
          <EditorToolbar position="top" />
          <EditorComponent />
        </div>
      </Remirror>
    </div>
  );
});

RichEditor.displayName = "RichEditor";

function ModalShell({
  title,
  subtitle,
  open,
  onClose,
  children,
  primaryAction,
  footerNote,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  footerNote?: string;
}) {
  return (
    <CvModalShell open={open} onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dasti-modal-header">
          <div className="dasti-modal-heading">
            <h2 className="dasti-modal-title">{title}</h2>
            {subtitle ? (
              <p className="dasti-modal-subtitle">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="dasti-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="dasti-modal-body">{children}</div>

        <div className="dasti-modal-footer">
          <div className="dasti-modal-footer-note">
            {footerNote ?? "Applied to the active resume."}
          </div>
          <div className="dasti-modal-actions">
            {primaryAction ? (
              <Button
                type="button"
                variant="primary"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

/**
 * ExperienceModal
 * - Edits a list of Experience entries with precision-aware dates and Present toggle
 * - Minimal v1: company, position, location, dates, achievements (simple textarea)
 */
export function ExperienceModal({
  open,
  onClose,
  items,
  initialItemId,
  recoveryNotesByItemId = {},
  onDismissRecoveryNotesByItemId,
  onSave,
}: ExperienceModalProps) {
  const runCvSectionAiAction = useAction(
    (api.functions as any).runCvSectionAiAction,
  );
  const cvAiCapabilities = useCvAiCapabilities();
  const { showToast } = useToast();
  const [local, setLocal] = useState<IExperienceItem[]>(() => {
    if (Array.isArray(items)) return items.map((it) => ({ ...it }));
    return [];
  });

  // Local UI state decoupled from ISO composition to avoid select resets
  const deriveUi = useCallback((it: IExperienceItem): UiState => {
    const sp = parseIsoToParts(it.startDate);
    const ep = parseIsoToParts(it.endDate ?? undefined);
    return {
      startYear: sp.year ?? "",
      startMonth: sp.month ?? "",
      startDay: "",
      endYear: ep.year ?? "",
      endMonth: ep.month ?? "",
      endDay: "",
      isCurrent: Boolean(it.isCurrent || it.currentlyWorking),
      startShowDay: false,
      endShowDay: false,
    };
  }, []);

  const [uiState, setUiState] = useState<UiState[]>(() => {
    if (Array.isArray(items)) return items.map((it) => deriveUi(it));
    return [];
  });
  const localRef = React.useRef<IExperienceItem[]>([]);
  const editorRefs = useRef<Array<RichEditorHandle | null>>([]);
  const responsibilitiesDocRef = useRef<Record<string, RemirrorJSON>>({});
  const [experienceAiLoadingId, setExperienceAiLoadingId] = useState<
    string | null
  >(null);
  const [experienceAiDiffs, setExperienceAiDiffs] = useState<
    Record<string, { before: string[]; after: string[] }>
  >({});
  const [editorRevisionMap, setEditorRevisionMap] = useState<
    Record<string, number>
  >({});
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const handledInitialFocusRef = useRef<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const canImproveResponsibilities = cvAiCapabilities.isSupported(
    "improve_experience_responsibilities",
  );

  // Sync local + UI state when the modal opens or items change to avoid stale/empty selects
  useEffect(() => {
    if (open) {
      const copied = Array.isArray(items)
        ? (items.map((it) => ({ ...it })) as IExperienceItem[])
        : [];
      setLocal(copied);
      setExperienceAiDiffs({});
      setExperienceAiLoadingId(null);
      setEditorRevisionMap({});
      localRef.current = copied;
      setUiState(copied.map((it) => deriveUi(it)));
      responsibilitiesDocRef.current = Object.fromEntries(
        copied.map((it) => [
          String(it.id),
          ensureRemirrorDoc(
            typeof it.responsibilities !== "undefined" &&
              it.responsibilities !== null
              ? (it.responsibilities as any)
              : achievementsToBulletDoc(
                  Array.isArray(it.achievements) ? it.achievements : [],
                ),
          ),
        ]),
      );
    }
  }, [open, items, deriveUi]);

  useEffect(() => {
    if (!open) {
      handledInitialFocusRef.current = null;
      return;
    }

    if (!initialItemId) return;

    const focusRequestKey = String(initialItemId);
    if (handledInitialFocusRef.current === focusRequestKey) {
      return;
    }

    const escapedId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(initialItemId)
        : initialItemId;

    const timeoutId = window.setTimeout(() => {
      const entryNode = dialogRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${escapedId}"]`,
      );
      entryNode?.scrollIntoView?.({
        block: "nearest",
        inline: "nearest",
      });
      setActiveEntryId(initialItemId);
      const node = dialogRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${escapedId}"] input, [data-entry-id="${escapedId}"] textarea, [data-entry-id="${escapedId}"] select, [data-entry-id="${escapedId}"] [contenteditable="true"]`,
      );
      if (node) {
        handledInitialFocusRef.current = focusRequestKey;
        node.focus();
      }
    }, 40);

    const clearHighlightId = window.setTimeout(() => {
      setActiveEntryId((current) =>
        current === initialItemId ? null : current,
      );
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(clearHighlightId);
    };
  }, [initialItemId, local, open]);

  const setField = useCallback(
    (idx: number, key: keyof IExperienceItem, value: unknown) => {
      setLocal((prev) => {
        const next = prev.map((it, i) =>
          i === idx ? ({ ...it, [key]: value } as IExperienceItem) : it,
        );
        localRef.current = next;
        return next;
      });
    },
    [],
  );

  const setUiField = useCallback(
    (idx: number, patch: UiPatch) => {
      // Update UI state first to keep dropdowns stable even if ISO can't be composed yet
      const currentUi: UiState = uiState[idx] ?? {
        startYear: "",
        startMonth: "",
        startDay: "",
        endYear: "",
        endMonth: "",
        endDay: "",
        startShowDay: false,
        endShowDay: false,
        isCurrent: false,
      };
      const merged: UiState = { ...currentUi, ...patch };

      setUiState((prev) => {
        const nu = [...prev];
        nu[idx] = merged;
        return nu;
      });

      // Apply to model by composing back into ISO + precision fields
      setLocal((prev) => {
        const next = [...prev];
        const base = next[idx] ?? {};

        // start: persist intended precision even if iso can't be composed yet
        const intendedStartPrecision: "year" | "month" | undefined =
          merged.startMonth ? "month" : merged.startYear ? "year" : undefined;

        (base as IExperienceItem).startDatePrecision = intendedStartPrecision;

        const startComposed = composeIsoFromParts({
          year: String(merged.startYear ?? "").trim() || undefined,
          month: String(merged.startMonth ?? "").trim() || undefined,
          precision: intendedStartPrecision,
        });

        if (startComposed.iso) {
          (base as IExperienceItem).startDate = startComposed.iso;
        } else {
          (base as IExperienceItem).startDate = "";
        }

        // end with Present
        const isCurrent = Boolean(merged.isCurrent);
        if (isCurrent) {
          (base as IExperienceItem).isCurrent = true;
          (base as IExperienceItem).currentlyWorking = true;
          (base as IExperienceItem).endDate = null;
          (base as IExperienceItem).endDatePrecision = undefined;
        } else {
          const intendedEndPrecision: "year" | "month" | undefined =
            merged.endMonth ? "month" : merged.endYear ? "year" : undefined;

          (base as IExperienceItem).isCurrent = undefined;
          (base as IExperienceItem).currentlyWorking = undefined;
          (base as IExperienceItem).endDatePrecision = intendedEndPrecision;

          const endComposed = composeIsoFromParts({
            year: String(merged.endYear ?? "").trim() || undefined,
            month: String(merged.endMonth ?? "").trim() || undefined,
            precision: intendedEndPrecision,
          });

          (base as IExperienceItem).endDate = endComposed.iso ?? null;
        }

        next[idx] = base as IExperienceItem;
        localRef.current = next;
        return next;
      });
    },
    [uiState],
  );

  const addRow = useCallback(() => {
    const newItem: IExperienceItem = {
      id: uuidv4(),
      company: "",
      position: "",
      startDate: "",
      endDate: null,
      isCurrent: false,
      currentlyWorking: false,
      location: "",
      responsibilities: undefined,
      achievements: [],
    };
    setLocal((prev) => {
      const next = [...prev, newItem];
      localRef.current = next;
      return next;
    });
    setUiState((prev) => [...prev, deriveUi(newItem)]);
    responsibilitiesDocRef.current[String(newItem.id)] = ensureRemirrorDoc(
      undefined as any,
    );
  }, [deriveUi]);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      localRef.current = next;
      if (removed?.id) {
        delete responsibilitiesDocRef.current[String(removed.id)];
      }
      return next;
    });
    setUiState((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  function getResponsibilityLines(
    item: IExperienceItem,
    doc: RemirrorJSON | undefined,
  ): string[] {
    return deriveResponsibilityBullets({
      responsibilities: doc ?? item.responsibilities,
      hasResponsibilitiesField:
        doc !== undefined ||
        Object.prototype.hasOwnProperty.call(item, "responsibilities"),
      responsibilityBullets: item.responsibilityBullets,
      achievements: item.achievements,
      fallbackToAchievements: true,
    });
  }

  function buildExperienceAiSource(
    item: IExperienceItem,
    doc: RemirrorJSON | undefined,
  ): string {
    const lines = [
      item.position ? `Role: ${item.position}` : null,
      item.company ? `Company: ${item.company}` : null,
      item.location ? `Location: ${item.location}` : null,
      item.description
        ? `Description: ${plainTextFromValue(item.description)}`
        : null,
    ].filter(Boolean) as string[];
    const bullets = getResponsibilityLines(item, doc);
    if (bullets.length > 0) {
      lines.push(`Responsibilities:\n- ${bullets.join("\n- ")}`);
    }
    return lines.join("\n");
  }

  async function handleRunResponsibilitiesAi(idx: number) {
    if (!cvAiCapabilities.isSupported("improve_experience_responsibilities")) {
      showToast(AI_UNAVAILABLE_TOAST, {
        variant: "warning",
        description: cvAiCapabilities.staleMessage,
      });
      return;
    }

    const row = localRef.current[idx];
    const rowId = String(row?.id ?? "");
    if (!rowId) return;

    try {
      setExperienceAiLoadingId(rowId);
      const result = await runCvSectionAiAction({
        action: "improve_experience_responsibilities",
        existingText: buildExperienceAiSource(
          row,
          responsibilitiesDocRef.current[rowId],
        ),
      });

      if (!result || result.kind !== "list" || !Array.isArray(result.items)) {
        return;
      }

      const nextLines = result.items
        .map((item: unknown) => String(item ?? "").trim())
        .filter(Boolean);
      if (nextLines.length === 0) return;

      setExperienceAiDiffs((current) => ({
        ...current,
        [rowId]: {
          before: getResponsibilityLines(
            row,
            responsibilitiesDocRef.current[rowId],
          ),
          after: nextLines,
        },
      }));
    } catch (error) {
      console.error(
        "[ExperienceModal] improve_experience_responsibilities failed",
        error,
      );
      const rawMessage =
        error instanceof Error ? error.message : String(error ?? "");
      showToast(AI_UNAVAILABLE_TOAST, {
        variant: "error",
        description: /ArgumentValidationError/i.test(rawMessage)
          ? "The CV AI backend schema is stale. Run `npx convex codegen` or restart `npx convex dev`, then reload the page."
          : "These responsibilities could not be improved right now.",
      });
    } finally {
      setExperienceAiLoadingId(null);
    }
  }

  function handleAcceptResponsibilitiesDiff(rowId: string) {
    const diff = experienceAiDiffs[rowId];
    if (!diff) return;
    const nextDoc = achievementsToBulletDoc(diff.after);
    responsibilitiesDocRef.current[rowId] = nextDoc;
    setEditorRevisionMap((current) => ({
      ...current,
      [rowId]: (current[rowId] ?? 0) + 1,
    }));
    setLocal((prev) => {
      const next = prev.map((item) =>
        String(item.id ?? "") === rowId
          ? {
              ...item,
              responsibilities: nextDoc,
              responsibilityBullets: diff.after,
              achievements: [],
            }
          : item,
      );
      localRef.current = next;
      return next;
    });
    setExperienceAiDiffs((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  // Import from AI (clipboard/prompt) and map to typed Experience
  const importFromClipboardExp = useCallback(async () => {
    try {
      let text = "";
      try {
        // Try clipboard first (user can copy JSON payload from AI output)
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          navigator.clipboard.readText
        ) {
          text = await navigator.clipboard.readText();
        }
      } catch {
        /* clipboard not available */
      }
      if (!text) {
        const promptText =
          typeof window !== "undefined"
            ? window.prompt(
                "Paste AI JSON for experience (array or { experience: [...] }):",
                "",
              )
            : null;
        if (!promptText) return;
        text = promptText;
      }
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j)
        ? j
        : Array.isArray((j as any)?.experience)
          ? (j as any).experience
          : [];
      if (!Array.isArray(arr) || arr.length === 0) return;
      const mapped = mapAiExperience(arr);
      setLocal(mapped);
      localRef.current = mapped;
      setUiState(mapped.map((it) => deriveUi(it)));
      responsibilitiesDocRef.current = Object.fromEntries(
        mapped.map((it) => [
          String(it.id),
          ensureRemirrorDoc(
            typeof it.responsibilities !== "undefined" &&
              it.responsibilities !== null
              ? (it.responsibilities as any)
              : achievementsToBulletDoc(
                  Array.isArray(it.achievements) ? it.achievements : [],
                ),
          ),
        ]),
      );
    } catch {
      // best-effort; ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit experience"
      subtitle="Roles and responsibilities"
      open={open}
      onClose={onClose}
      primaryAction={{
        label: "Save",
        onClick: () => {
          try {
            editorRefs.current.forEach((editor) => editor?.flush?.());
          } catch {
            /* noop */
          }
          const next = localRef.current.map((rawItem) => {
            const item = normalizeMonthYearDateFields(rawItem);
            const doc = responsibilitiesDocRef.current[String(item.id)];
            if (!doc) return item;
            const normalizedDoc = ensureRemirrorDoc(doc as any);
            if (!hasNonEmptyDocText(normalizedDoc)) {
              return {
                ...item,
                responsibilities: undefined,
                responsibilityBullets: undefined,
              } as IExperienceItem;
            }
            const responsibilityBullets = deriveResponsibilityBullets({
              responsibilities: normalizedDoc,
              hasResponsibilitiesField: true,
            });
            return {
              ...item,
              responsibilities: normalizedDoc,
              responsibilityBullets:
                responsibilityBullets.length > 0
                  ? responsibilityBullets
                  : undefined,
              achievements: [],
            } as IExperienceItem;
          });
          localRef.current = next;
          onSave(next);
        },
      }}
      footerNote="Order follows your resume."
    >
      <div ref={dialogRef} className="space-y-5">
        {local.length === 0 && (
          <div className="dasti-hint">
            No experience yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = uiState[idx] ?? {
            startYear: "",
            startMonth: "",
            startDay: "",
            endYear: "",
            endMonth: "",
            endDay: "",
            startShowDay: false,
            endShowDay: false,
            isCurrent: false,
          };
          return (
            <section
              key={String(row.id ?? idx)}
              data-entry-id={String(row.id ?? idx)}
              className="dasti-zone"
              data-targeted={
                activeEntryId === String(row.id ?? idx) ? "true" : undefined
              }
              style={
                activeEntryId === String(row.id ?? idx)
                  ? {
                      borderColor: "var(--primary)",
                      boxShadow: "0 0 0 1px var(--primary)",
                    }
                  : undefined
              }
            >
              <div className="dasti-zone-header">
                <h3 className="dasti-zone-title">Entry {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="dasti-icon-button"
                  aria-label="Remove entry"
                >
                  <TrashSimple className="h-4 w-4" />
                </button>
              </div>
              {(recoveryNotesByItemId[String(row.id ?? "")] ?? []).length > 0 ? (
                <div className="dasti-recovery-note-stack">
                  <div className="dasti-recovery-note-stack__header">
                    <span className="dasti-recovery-note__label">Recovered note</span>
                    {onDismissRecoveryNotesByItemId ? (
                      <button
                        type="button"
                        className="dasti-recovery-inline__dismiss"
                        aria-label="Dismiss recovered notes"
                        onClick={() => onDismissRecoveryNotesByItemId(String(row.id ?? ""))}
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <div className="dasti-recovery-note-list">
                  {(recoveryNotesByItemId[String(row.id ?? "")] ?? []).map((note) => (
                    <div key={`${String(row.id ?? idx)}-${note}`} className="dasti-recovery-note">
                      <p className="cv-entry-body">{note}</p>
                    </div>
                  ))}
                  </div>
                </div>
              ) : null}

              <div className="dasti-grid-2">
                <label className="dasti-field-group">
                  <span className="dasti-label">Company</span>
                  <input
                    value={row.company}
                    onChange={(e) => setField(idx, "company", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Position</span>
                  <input
                    value={row.position}
                    onChange={(e) => setField(idx, "position", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label
                  className="dasti-field-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <span className="dasti-label">Location</span>
                  <input
                    value={row.location ?? ""}
                    onChange={(e) => setField(idx, "location", e.target.value)}
                    className="dasti-field"
                    placeholder="City, Country"
                  />
                </label>

                <div className="dasti-field-group">
                  <span className="dasti-label">Start date</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--s2)",
                    }}
                  >
                    <select
                      className="dasti-select"
                      value={ui.startMonth}
                      onChange={(e) =>
                        setUiField(idx, { startMonth: e.target.value })
                      }
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="dasti-select"
                      value={ui.startYear}
                      onChange={(e) =>
                        setUiField(idx, { startYear: e.target.value })
                      }
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="dasti-field-group">
                  <span className="dasti-label">End date</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--s2)",
                    }}
                  >
                    <select
                      className="dasti-select"
                      value={ui.endMonth}
                      disabled={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, { endMonth: e.target.value })
                      }
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="dasti-select"
                      value={ui.endYear}
                      disabled={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, { endYear: e.target.value })
                      }
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{ marginTop: "var(--s2)" }}
                  >
                    <input
                      id={`exp-present-${idx}`}
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, {
                          isCurrent: e.target.checked,
                          endYear: "",
                          endMonth: "",
                        })
                      }
                    />
                    <label
                      htmlFor={`exp-present-${idx}`}
                      className="dasti-hint"
                    >
                      Current role
                    </label>
                  </div>
                </div>

                <div
                  className="dasti-field-group"
                  style={{ gridColumn: "1 / -1" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--s2)",
                      marginBottom: "var(--s2)",
                    }}
                  >
                    <span className="dasti-label" style={{ marginBottom: 0 }}>
                      Responsibilities
                    </span>
                    <button
                      type="button"
                      className="dasti-icon-button"
                      onClick={() => void handleRunResponsibilitiesAi(idx)}
                      disabled={
                        !canImproveResponsibilities ||
                        experienceAiLoadingId === String(row.id ?? "")
                      }
                      aria-label="Improve responsibilities with AI"
                      title="Improve responsibilities with AI"
                    >
                      {experienceAiLoadingId === String(row.id ?? "") ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {cvAiCapabilities.status === "stale" &&
                  !canImproveResponsibilities ? (
                    <div className="dasti-hint" role="status">
                      {cvAiCapabilities.staleMessage}
                    </div>
                  ) : null}
                  <RichEditor
                    key={`${String(row.id ?? idx)}:${editorRevisionMap[String(row.id ?? "")] ?? 0}`}
                    ref={(node) => {
                      editorRefs.current[idx] = node;
                    }}
                    initialContent={(() => {
                      const existing = (row as IExperienceItem)
                        .responsibilities as RemirrorJSON | string | undefined;
                      if (existing) return ensureRemirrorDoc(existing as any);
                      const legacy = Array.isArray(row.achievements)
                        ? row.achievements
                        : [];
                      return achievementsToBulletDoc(legacy);
                    })()}
                    onChangeDoc={(doc) => {
                      responsibilitiesDocRef.current[String(row.id)] = doc;
                      setField(idx, "responsibilities", doc);
                      setField(idx, "achievements", []);
                    }}
                  />
                  {experienceAiDiffs[String(row.id ?? "")] ? (
                    <ModalAiDiffCard
                      label={`Entry ${idx + 1} suggestion`}
                      before={experienceAiDiffs[String(row.id ?? "")].before}
                      after={experienceAiDiffs[String(row.id ?? "")].after}
                      onAccept={() =>
                        handleAcceptResponsibilitiesDiff(String(row.id ?? ""))
                      }
                      onDiscard={() =>
                        setExperienceAiDiffs((current) => {
                          const next = { ...current };
                          delete next[String(row.id ?? "")];
                          return next;
                        })
                      }
                    />
                  ) : null}
                  <div className="dasti-hint">
                    Describe scope, output, and notable outcomes.
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <div>
          <Button type="button" variant="secondary" onClick={addRow}>
            Add entry
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * EducationModal
 * - Edits a list of Education entries with precision-aware dates and Present toggle
 * - Minimal v1: institution, degree, fieldOfStudy, grade, dates
 */
export function EducationModal({
  open,
  onClose,
  items,
  initialItemId,
  recoveryNotesByItemId = {},
  onDismissRecoveryNotesByItemId,
  onSave,
}: EducationModalProps) {
  const [local, setLocal] = useState<IEducationItem[]>(() => {
    if (Array.isArray(items)) return items.map((it) => ({ ...it }));
    return [];
  });

  const deriveUiEdu = useCallback((it: IEducationItem): UiState => {
    const sp = parseIsoToParts(it.startDate);
    const ep = parseIsoToParts(it.endDate ?? undefined);
    return {
      startYear: sp.year ?? "",
      startMonth: sp.month ?? "",
      startDay: "",
      endYear: ep.year ?? "",
      endMonth: ep.month ?? "",
      endDay: "",
      isCurrent: Boolean(it.isCurrent),
      startShowDay: false,
      endShowDay: false,
    };
  }, []);

  const [uiState, setUiState] = useState<UiState[]>(() => {
    if (Array.isArray(items)) return items.map((it) => deriveUiEdu(it));
    return [];
  });
  const localRef = React.useRef<IEducationItem[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const handledInitialFocusRef = useRef<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // Sync local + UI state for Education on open/items change
  useEffect(() => {
    if (open) {
      const copied = Array.isArray(items)
        ? (items.map((it) => ({ ...it })) as IEducationItem[])
        : [];
      setLocal(copied);
      localRef.current = copied;
      setUiState(copied.map((it) => deriveUiEdu(it)));
    }
  }, [open, items, deriveUiEdu]);

  useEffect(() => {
    if (!open) {
      handledInitialFocusRef.current = null;
      return;
    }

    if (!initialItemId) return;

    const focusRequestKey = String(initialItemId);
    if (handledInitialFocusRef.current === focusRequestKey) {
      return;
    }

    const escapedId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(initialItemId)
        : initialItemId;

    const timeoutId = window.setTimeout(() => {
      const entryNode = dialogRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${escapedId}"]`,
      );
      entryNode?.scrollIntoView?.({
        block: "nearest",
        inline: "nearest",
      });
      setActiveEntryId(initialItemId);
      const node = dialogRef.current?.querySelector<HTMLElement>(
        `[data-entry-id="${escapedId}"] input, [data-entry-id="${escapedId}"] textarea, [data-entry-id="${escapedId}"] select, [data-entry-id="${escapedId}"] [contenteditable="true"]`,
      );
      if (node) {
        handledInitialFocusRef.current = focusRequestKey;
        node.focus();
      }
    }, 40);

    const clearHighlightId = window.setTimeout(() => {
      setActiveEntryId((current) =>
        current === initialItemId ? null : current,
      );
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(clearHighlightId);
    };
  }, [initialItemId, local, open]);

  const setField = useCallback(
    (idx: number, key: keyof IEducationItem, value: unknown) => {
      setLocal((prev) => {
        const next = prev.map((it, i) =>
          i === idx ? ({ ...it, [key]: value } as IEducationItem) : it,
        );
        localRef.current = next;
        return next;
      });
    },
    [],
  );

  const setUiField = useCallback(
    (idx: number, patch: UiPatch) => {
      // Keep UI responsive and stable first
      const currentUi: UiState = uiState[idx] ?? {
        startYear: "",
        startMonth: "",
        startDay: "",
        endYear: "",
        endMonth: "",
        endDay: "",
        startShowDay: false,
        endShowDay: false,
        isCurrent: false,
      };
      const merged: UiState = { ...currentUi, ...patch };

      setUiState((prev) => {
        const nu = [...prev];
        nu[idx] = merged;
        return nu;
      });

      // Then apply to the underlying model (local)
      setLocal((prev) => {
        const next = [...prev];
        const base = next[idx] ?? {};

        // start: persist intended precision even if a full ISO isn't available yet
        const intendedStartPrecision: "year" | "month" | undefined =
          merged.startMonth ? "month" : merged.startYear ? "year" : undefined;

        (base as IEducationItem).startDatePrecision = intendedStartPrecision;

        const startComposed = composeIsoFromParts({
          year: String(merged.startYear ?? "").trim() || undefined,
          month: String(merged.startMonth ?? "").trim() || undefined,
          precision: intendedStartPrecision,
        });

        (base as IEducationItem).startDate = startComposed.iso ?? undefined;

        // end with Present
        const isCurrent = Boolean(merged.isCurrent);
        if (isCurrent) {
          (base as IEducationItem).isCurrent = true;
          (base as IEducationItem).endDate = null;
          (base as IEducationItem).endDatePrecision = undefined;
        } else {
          const intendedEndPrecision: "year" | "month" | undefined =
            merged.endMonth ? "month" : merged.endYear ? "year" : undefined;

          (base as IEducationItem).isCurrent = undefined;
          (base as IEducationItem).endDatePrecision = intendedEndPrecision;

          const endComposed = composeIsoFromParts({
            year: String(merged.endYear ?? "").trim() || undefined,
            month: String(merged.endMonth ?? "").trim() || undefined,
            precision: intendedEndPrecision,
          });

          (base as IEducationItem).endDate = endComposed.iso ?? undefined;
        }

        next[idx] = base as IEducationItem;
        localRef.current = next;
        return next;
      });
    },
    [uiState],
  );

  const addRow = useCallback(() => {
    const newItem: IEducationItem = {
      id: uuidv4(),
      institution: "",
      degree: "",
      fieldOfStudy: "",
      startDate: undefined,
      endDate: undefined,
      isCurrent: false,
      grade: "",
      description: undefined,
    };
    setLocal((prev) => {
      const next = [...prev, newItem];
      localRef.current = next;
      return next;
    });
    setUiState((prev) => [...prev, deriveUiEdu(newItem)]);
  }, [deriveUiEdu]);

  const removeRow = useCallback((idx: number) => {
    setLocal((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      localRef.current = next;
      return next;
    });
    setUiState((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Import from AI (clipboard/prompt) and map to typed Education
  const importFromClipboardEdu = useCallback(async () => {
    try {
      let text = "";
      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard &&
          navigator.clipboard.readText
        ) {
          text = await navigator.clipboard.readText();
        }
      } catch {
        /* clipboard not available */
      }
      if (!text) {
        const promptText =
          typeof window !== "undefined"
            ? window.prompt(
                "Paste AI JSON for education (array or { education: [...] }):",
                "",
              )
            : null;
        if (!promptText) return;
        text = promptText;
      }
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j)
        ? j
        : Array.isArray((j as any)?.education)
          ? (j as any).education
          : [];
      if (!Array.isArray(arr) || arr.length === 0) return;
      const mapped = mapAiEducation(arr);
      setLocal(mapped);
      localRef.current = mapped;
      setUiState(mapped.map((it) => deriveUiEdu(it)));
    } catch {
      // ignore parse errors
    }
  }, []);

  return (
    <ModalShell
      title="Edit education"
      subtitle="Study and qualifications"
      open={open}
      onClose={onClose}
      primaryAction={{
        label: "Save",
        onClick: () =>
          onSave(
            localRef.current.map((item) => normalizeMonthYearDateFields(item)),
          ),
      }}
      footerNote="Order follows your resume."
    >
      <div ref={dialogRef} className="space-y-5">
        {local.length === 0 && (
          <div className="dasti-hint">
            No education yet. Use “Add entry” to create one.
          </div>
        )}

        {local.map((row, idx) => {
          const ui = uiState[idx] ?? {
            startYear: "",
            startMonth: "",
            startDay: "",
            endYear: "",
            endMonth: "",
            endDay: "",
            startShowDay: false,
            endShowDay: false,
            isCurrent: false,
          };
          return (
            <section
              key={String(row.id ?? idx)}
              data-entry-id={String(row.id ?? idx)}
              className="dasti-zone"
              data-targeted={
                activeEntryId === String(row.id ?? idx) ? "true" : undefined
              }
              style={
                activeEntryId === String(row.id ?? idx)
                  ? {
                      borderColor: "var(--primary)",
                      boxShadow: "0 0 0 1px var(--primary)",
                    }
                  : undefined
              }
            >
              <div className="dasti-zone-header">
                <h3 className="dasti-zone-title">Entry {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="dasti-icon-button"
                  aria-label="Remove entry"
                >
                  <TrashSimple className="h-4 w-4" />
                </button>
              </div>
              {(recoveryNotesByItemId[String(row.id ?? "")] ?? []).length > 0 ? (
                <div className="dasti-recovery-note-stack">
                  <div className="dasti-recovery-note-stack__header">
                    <span className="dasti-recovery-note__label">Recovered note</span>
                    {onDismissRecoveryNotesByItemId ? (
                      <button
                        type="button"
                        className="dasti-recovery-inline__dismiss"
                        aria-label="Dismiss recovered notes"
                        onClick={() => onDismissRecoveryNotesByItemId(String(row.id ?? ""))}
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <div className="dasti-recovery-note-list">
                  {(recoveryNotesByItemId[String(row.id ?? "")] ?? []).map((note) => (
                    <div key={`${String(row.id ?? idx)}-${note}`} className="dasti-recovery-note">
                      <p className="cv-entry-body">{note}</p>
                    </div>
                  ))}
                  </div>
                </div>
              ) : null}

              <div className="dasti-grid-2">
                <label className="dasti-field-group">
                  <span className="dasti-label">Institution</span>
                  <input
                    value={row.institution}
                    onChange={(e) =>
                      setField(idx, "institution", e.target.value)
                    }
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Degree</span>
                  <input
                    value={row.degree ?? ""}
                    onChange={(e) => setField(idx, "degree", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Field of study</span>
                  <input
                    value={row.fieldOfStudy ?? ""}
                    onChange={(e) =>
                      setField(idx, "fieldOfStudy", e.target.value)
                    }
                    className="dasti-field"
                  />
                </label>

                <label className="dasti-field-group">
                  <span className="dasti-label">Grade</span>
                  <input
                    value={row.grade ?? ""}
                    onChange={(e) => setField(idx, "grade", e.target.value)}
                    className="dasti-field"
                  />
                </label>

                <div className="dasti-field-group">
                  <span className="dasti-label">Start date</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--s2)",
                    }}
                  >
                    <select
                      className="dasti-select"
                      value={ui.startMonth}
                      onChange={(e) =>
                        setUiField(idx, { startMonth: e.target.value })
                      }
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="dasti-select"
                      value={ui.startYear}
                      onChange={(e) =>
                        setUiField(idx, { startYear: e.target.value })
                      }
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="dasti-field-group">
                  <span className="dasti-label">End date</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--s2)",
                    }}
                  >
                    <select
                      className="dasti-select"
                      value={ui.endMonth}
                      disabled={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, { endMonth: e.target.value })
                      }
                    >
                      <option value="">Month</option>
                      <option value="01">Jan</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Apr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Aug</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dec</option>
                    </select>
                    <select
                      className="dasti-select"
                      value={ui.endYear}
                      disabled={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, { endYear: e.target.value })
                      }
                    >
                      <option value="">Year</option>
                      {getYearOptions().map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{ marginTop: "var(--s2)" }}
                  >
                    <input
                      id={`edu-present-${idx}`}
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={ui.isCurrent}
                      onChange={(e) =>
                        setUiField(idx, {
                          isCurrent: e.target.checked,
                          endYear: "",
                          endMonth: "",
                        })
                      }
                    />
                    <label
                      htmlFor={`edu-present-${idx}`}
                      className="dasti-hint"
                    >
                      Current study
                    </label>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <div>
          <Button type="button" variant="secondary" onClick={addRow}>
            Add entry
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

export default ExperienceModal;
