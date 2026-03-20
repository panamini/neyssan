import { v4 as uuidv4 } from "uuid";
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useMemo, useState, useCallback } from "react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import { BoldExtension, ItalicExtension, UnderlineExtension, ParagraphExtension } from "remirror/extensions";
import { TextSelection } from "prosemirror-state";
import { EditorToolbar } from "./remirror-editor/components/EditorToolbar";
import { ensureRemirrorDoc, remirrorDocToSection } from "./remirror-editor/utils/conversion";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { makeExperienceItem, makeEducationItem } from "../lib/cv-template";
import { SummaryBlock } from "./structured-blocks/SummaryBlock";
import { SkillsBlock } from "./structured-blocks/SkillsBlock";
import { ProfileModal } from "./structured-blocks/ProfileModal";
import { SummaryModal } from "./structured-blocks/SummaryModal";
import { SkillsModal } from "./structured-blocks/SkillsModal";
import { SkillsDrawer } from "./structured-blocks/SkillsDrawer";
import BlockRenderer from "./cv-editor/BlockRenderer";
import AchievementsBlock from "./structured-blocks/AchievementsBlock";
import { useSectionFlushSubscription } from "../hooks/use-flush-subscription";
import { Pen, Trash, X, Pin, PinOff, Plus, UserRound } from "lucide-react";
import { ExperienceModal, EducationModal } from "./structured-blocks/ExperienceEducationModal";

import { formatRangeFromItem } from "../lib/date-utils";
import { splitResponsibilitiesIntoBullets } from "../utils/cv/mapping-utils";
import { isExperienceRenderable, isEducationRenderable } from "../utils/cv/renderGuards";

/**
 * Simple uid helper used for generating new block/entry ids locally.
 * Matches the lightweight uid pattern used elsewhere in the project.
 */

import type { RemirrorJSON } from 'remirror';
import type { CvSection, IExperienceItem, IEducationItem, IProfileItem, ISummaryItem, ISkillItem, ILanguageItem, Level } from '../types/cvDocument';

const SKILL_DOT_LEVELS: Array<{ value: Level; label: string }> = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Expert" },
];

const LANGUAGE_DOT_LEVELS: Array<{ value: Level; label: string }> = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Fluent", label: "Advanced" },
];

function getDotIndex(value: Level, kind: "skill" | "language"): number {
  if (kind === "skill") {
    if (value === "Beginner" || value === "Elementary") return 0;
    if (value === "Intermediate") return 1;
    return 2;
  }

  if (value === "Beginner" || value === "Elementary") return 0;
  if (value === "Intermediate" || value === "Advanced") return 1;
  return 2;
}

function LevelDots({
  value,
  levels,
  kind,
  onChange,
  readOnly = false,
  ariaLabel,
}: {
  value: Level;
  levels: Array<{ value: Level; label: string }>;
  kind: "skill" | "language";
  onChange?: (value: Level) => void;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const activeIndex = getDotIndex(value, kind);
  const activeLabel = levels[activeIndex]?.label ?? levels[0]?.label ?? "";

  const dotStyle = (filled: boolean): React.CSSProperties => ({
    display: "block",
    width: 10,
    height: 10,
    borderRadius: "var(--rp)",
    border: "1px solid",
    borderColor: filled ? "var(--ac)" : "var(--bm)",
    background: filled ? "var(--ac)" : "transparent",
    flexShrink: 0,
    pointerEvents: "none",
  });

  return (
    <div className="inline-flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-0" role={readOnly ? undefined : "group"} aria-label={ariaLabel}>
        {levels.map((level, index) => {
          const filled = index <= activeIndex;

          if (readOnly) {
            return (
              <span
                key={level.label}
                aria-hidden
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, flexShrink: 0 }}
              >
                <span style={dotStyle(filled)} />
              </span>
            );
          }

          return (
            <button
              key={level.label}
              type="button"
              aria-label={`${ariaLabel}: ${level.label}`}
              title={level.label}
              onClick={() => onChange?.(level.value)}
              className="focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)] group/dot"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                padding: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <span
                style={dotStyle(filled)}
                className="group-hover/dot:scale-[1.25] transition-transform"
              />
            </button>
          );
        })}
      </div>
      <span style={{ fontSize: "var(--tx)", color: "var(--tg2)", minWidth: 48, whiteSpace: "nowrap" }}>
        {activeLabel}
      </span>
    </div>
  );
}

interface SectionEditorProps {
  section: CvSection;
  index: number;
  onChange: (index: number, updated: CvSection) => void;
  onBlur?: (sectionId: string) => void;
  onFocus?: (sectionId: string) => void;
  onTitleChange?: (sectionId: string, newTitle: string) => void;
  onContentChange?: (sectionId: string, json: RemirrorJSON) => void;
  // Controlled collapse support (optional)
  collapsed?: boolean;
  onCollapseChange?: () => void;
  // When true, this SectionEditor is used as an embedded/inline editor (e.g., inside BlockRenderer).
  // In this mode, legacy migration side-effects must be disabled to avoid infinite remount loops.
  embedded?: boolean;
}

/**
 * Small ErrorBoundary to render fallback when Remirror fails.
 */
class ErrorBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[SectionEditor][ErrorBoundary]", error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const createExtensions = () => [
  new ParagraphExtension(),
  new BoldExtension({}),
  new ItalicExtension({}),
  new UnderlineExtension({}),
];

type EntryRemirrorHandle = { flush: () => void };

const EntryRemirror = forwardRef<EntryRemirrorHandle, { initialContent?: RemirrorJSON | undefined; onPersist?: (json: RemirrorJSON) => void }>(
  ({ initialContent, onPersist }, ref) => {
    const extensions = useMemo(() => createExtensions(), []);
    const initial = useRef<RemirrorJSON>(ensureRemirrorDoc(initialContent as any)).current;
  
    const { manager: localManager, state: localState, onChange: localOnChange } = useRemirror({
      extensions: () => extensions as any,
      content: initial as any,
      onError: () => initial as any,
    });
  
    // removed unused mountedRef used for previous mount-guard logic
  
    // Keep a ref to the underlying prosemirror view so we can flush imperatively.
    const viewRef = useRef<any>(null);
    useEffect(() => {
      viewRef.current = (localManager as any)?.view;
    }, [localManager]);
  
    const flush = useCallback(() => {
      try {
        const view = viewRef.current;
        const json = view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined;
        if (json && typeof onPersist === "function") {
          onPersist(json);
        }
      } catch {
        /* noop */
      }
    }, [onPersist]);
  
    // Expose flush via imperative handle so parents can call it before structural changes.
    useImperativeHandle(ref, () => ({ flush }), [flush]);
  
    // Persist on editor blur (focusout) to avoid keystroke-level persistence — still supported.
    useEffect(() => {
      const viewDom = (localManager as any)?.view?.dom as HTMLElement | undefined;
      if (!viewDom) return;
      const handleFocusOut = () => {
        try {
          flush();
        } catch {
          /* noop */
        }
      };
      viewDom.addEventListener("focusout", handleFocusOut);
      return () => {
        try {
          viewDom.removeEventListener("focusout", handleFocusOut);
        } catch {
          /* noop */
        }
      };
    }, [localManager, flush]);
  
    const handleChange = useCallback(
      (param: any) => {
        localOnChange(param);
        // Intentionally avoid calling onPersist on every keystroke.
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [localOnChange]
    );
  
    return (
      <div className="p-2 [background:var(--sfr)] border border-bo rounded">
        <Remirror manager={localManager} initialContent={localState} onChange={handleChange}>
          <EditorComponent />
        </Remirror>
      </div>
    );
  }
);

/**
 * Controlled SectionEditor that renders Remirror and emits changes up to parent.
 * Important: Remirror's initial content is set once at mount to avoid stomping caret
 * when parent updates the prop frequently. The parent is authoritative for state,
 * and must manage debouncing/patching.
 */
export default function SectionEditor({
  section,
  index,
  onChange,
  onBlur,
  onFocus,
  onTitleChange,
  onContentChange,
  collapsed = false,
  onCollapseChange,
  embedded = false,
}: SectionEditorProps) {
  // Add logging to track re-renders (debug gated)
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
        // eslint-disable-next-line no-console
        console.log("[SectionEditor] render", { sectionId: section.id, title: section.title });
      }
    } catch {
      /* noop */
    }
  });

  // Mount/unmount diagnostics with stable mount id to correlate with register/unregister churn
  const mountIdRef = useRef<string>(uuidv4());
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
      // eslint-disable-next-line no-console
      console.debug("[SectionEditor] mount", { mountId: mountIdRef.current, sectionId: section.id });
    }
    return () => {
      if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
        // eslint-disable-next-line no-console
        console.debug("[SectionEditor] unmount", { mountId: mountIdRef.current, sectionId: section.id });
      }
    };
  // we intentionally leave deps empty to log physical mount/unmounts only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extensions = useMemo(() => createExtensions(), []);
  const titleInputId = useMemo(() => `section-title-${section.id}`, [section.id]);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize safe JSON content once at mount to avoid remounts stomping caret.
  const initialContentRef = useRef<RemirrorJSON>(ensureRemirrorDoc((section as any).content as any));
  function sanitizeRemirrorDoc(doc: RemirrorJSON | undefined): RemirrorJSON {
    if (!doc || typeof doc !== "object" || !Array.isArray((doc as any).content)) {
      return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }] } as RemirrorJSON;
    }
    function sanitizeNode(node: any): any {
      if (!node || typeof node !== "object") return node;
      if (node.type === "text") {
        const text = String(node.text ?? "").replace(/\u0000/g, "");
        return { ...node, text: text.length === 0 ? " " : text };
      }
      const cloned: any = { ...node };
      if (Array.isArray(node.content)) {
        cloned.content = node.content.map(sanitizeNode).filter(Boolean);
        if (cloned.content.length === 0 && typeof cloned.type === "string") {
          if (cloned.type === "paragraph" || cloned.type === "heading") cloned.content = [{ type: "text", text: " " }];
        }
      }
      return cloned;
    }
    try {
      return { ...doc, content: (doc as any).content.map(sanitizeNode) } as RemirrorJSON;
    } catch {
      return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }] } as RemirrorJSON;
    }
  }

  // Extract plain text from a Remirror JSON document (single-line preview)
  function extractPlainTextLocal(json: RemirrorJSON | undefined | null): string {
    if (!json || typeof json !== "object") return "";
    try {
      const parts: string[] = [];
      function walk(node: any) {
        if (!node) return;
        if (typeof node.text === "string") parts.push(node.text);
        if (Array.isArray(node.content)) node.content.forEach(walk);
        if (Array.isArray(node.items)) node.items.forEach(walk);
      }
      walk(json as any);
      return parts.join(" ").replace(/\s+/g, " ").trim();
    } catch {
      return "";
    }
  }

  const safeContent = useRef<RemirrorJSON>(sanitizeRemirrorDoc(initialContentRef.current)).current;

  const { manager, state, onChange: remirrorOnChange } = useRemirror({
    extensions: () => extensions as any,
    content: safeContent as any,
    onError: (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[SectionEditor] remirror onError", err);
      return safeContent as any;
    },
  });

  // Local title buffer to avoid stomping while typing.
  // Parent remains the source of truth; we only emit onTitleChange on blur (or explicit flush)
  // to avoid frequent context updates causing re-renders while typing.
  const [localTitle, setLocalTitle] = useState<string>(section.title ?? "");
  const titleFocusedRef = useRef<boolean>(false);
  // removed unused mountedRef guard (no longer required after synchronization refactor)
  // Flush guard prevents the syncing effect from overwriting our local buffer while we are
  // actively flushing the buffer into the parent/context (e.g., on collapse). It's set
  // briefly when we call onTitleChange to avoid a race where the parent updates cause
  // section.title to be read as empty before the update completes.
  const flushGuardRef = useRef<boolean>(false);
  
  useEffect(() => {
    // If we are in the middle of an intentional flush, skip syncing to avoid stomping the local buffer.
    if (flushGuardRef.current) return;
    try {
      const el = titleInputRef.current;
      if (el && document && document.activeElement === el) return;
    } catch {
      // fallback to syncing
    }
    setLocalTitle(section.title ?? "");
    // Only log when debug mode is enabled to reduce console spam
    if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
      // eslint-disable-next-line no-console
      console.log("[SectionEditor] section.title changed", section.title, collapsed);
    }
  }, [section.title, collapsed]);

  // Nested editor refs and flush plumbing are handled locally; section-level flush
  // registration uses useSectionFlushSubscription to avoid register/unregister churn.

  // Refs for nested EntryRemirror editors so we can flush them imperatively.
  const remirrorRefs = useRef<Array<EntryRemirrorHandle | null>>([]);

  /**
   * Debounced scheduler for calling flushPendingEdits().
   * Many callers request a flush rapidly; scheduleFlushPendingEdits
   * prevents repeated immediate calls and reduces CPU/log churn.
   */


  /**
   * Flush all nested EntryRemirror editors without scheduling a global flush.
   * Important: this is invoked from the central flushPendingEdits callback; do not
   * schedule another global flush from here to avoid re-entrant flush loops.
   */
  const flushAllNestedEditors = useCallback(() => {
    try {
      for (const r of remirrorRefs.current) {
        try {
          r?.flush?.();
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  // Register a stable section-level flush using the shared hook (latest-ref pattern).
  const onSectionFlush = useCallback(() => {
    try {
      const view = (manager as any)?.view;
      if (view?.state?.doc?.toJSON) {
        onContentChange?.(String(section.id), view.state.doc.toJSON());
      }
      if (localTitle !== section.title) {
        onTitleChange?.(String(section.id), localTitle);
      }
      flushAllNestedEditors();
    } catch {
      /* noop */
    }
  }, [manager, onContentChange, onTitleChange, section.id, section.title, localTitle, flushAllNestedEditors]);
  useSectionFlushSubscription({
    sectionId: String(section.id),
    onFlush: onSectionFlush,
    enabled: true,
  });

  // Forward Remirror internal changes to its handler only.
  // Do NOT forward keystroke-level updates to the parent here — that was causing
  // synchronous nested React updates when the parent persisted (setState) during Remirror's mount/update.
  // Persistence is handled by flush callbacks and onBlur to avoid stomping the editor/caret.
  const handleRemirrorChange = useCallback(
    (parameter: any) => {
      remirrorOnChange(parameter);
      // For embedded editors (e.g., SelectedBlockInspector modal), emit content on every change
      // so the inspector can persist the block content live and on Save.
      try {
        if (embedded && typeof onContentChange === "function" && section?.id) {
          const view = (manager as any)?.view;
          const json = view?.state?.doc?.toJSON?.();
          if (json) {
            onContentChange(String(section.id), json as RemirrorJSON);
          }
        }
      } catch {
        /* noop */
      }
    },
    [remirrorOnChange, embedded, onContentChange, manager, section?.id]
  );

  const focusEditorAtEnd = useCallback(() => {
    try {
      const view = (manager as any)?.view;
      // If the section title input currently has focus, do not steal focus for the editor.
      try {
        const titleEl = titleInputRef.current;
        if (titleEl && typeof document !== "undefined" && document.activeElement === titleEl) return;
      } catch {
        /* ignore focus detection failures */
      }
      if (view && !view.hasFocus()) {
        const { state: s, dispatch } = view;
        const tr = s.tr.setSelection(TextSelection.atEnd(s.doc));
        dispatch(tr);
        view.focus();
      }
    } catch {
      // noop
    }
  }, [manager]);

  const remirrorViewAvailable = Boolean((manager as any)?.view && state);

  // Wire editor focus/blur to parent for accessibility and undo/save tracking.
  useEffect(() => {
    const viewDom = (manager as any)?.view?.dom as HTMLElement | undefined;
    if (!viewDom) return;
    const handleFocusIn = () => {
      onFocus?.(String(section.id));
    };
    const handleFocusOut = () => {
      onBlur?.(String(section.id));
    };
    viewDom.addEventListener("focusin", handleFocusIn);
    viewDom.addEventListener("focusout", handleFocusOut);
    return () => {
      try {
        viewDom.removeEventListener("focusin", handleFocusIn);
        viewDom.removeEventListener("focusout", handleFocusOut);
      } catch {
        /* ignore */
      }
    };
  }, [manager, section.id, onFocus, onBlur]);

  // Keep editor content in sync when parent updates section.content,
  // but avoid overwriting local edits while the editor has focus.
  useEffect(() => {
    try {
      const view = (manager as any)?.view;
      if (!view) return;
      // If the editor currently has focus, prefer local state (do not stomp the caret)
      if (view.hasFocus && view.hasFocus()) return;
      // Build a normalized Remirror doc from incoming content
      const externalDoc = sanitizeRemirrorDoc(ensureRemirrorDoc((section as any).content as any));
      // Create a new EditorState via manager and update the view atomically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newState = (manager as any).createState ? (manager as any).createState({ content: externalDoc as any }) : undefined;
      if (newState && typeof view.updateState === "function") {
        view.updateState(newState);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug("[SectionEditor] sync external content failed", err);
    }
  // Depend only on the section's content (use any-cast to avoid TS error on CvSection type)
  }, [(section as any).content, manager]);

  // No local title buffer — parent is authoritative. titleInputRef remains for focus checks if needed.

  // Fallback content handling for non-Remirror view (or conversion to HTML)
  // removed fallbackRef and fallbackContentRef - compute fallback content on demand instead

  // If this section contains structuredContent for typed sections, render a fine-grained editor
  // instead of the generic Remirror editor. This provides UI-ready inputs for company/position/dates/achievements.
  const structured = section.structuredContent;
  let sectionType = String(section.type);
    // Backwards-compat: treat legacy text section titled "achievements" as an achievements section
    try {
      if (sectionType === "text" && typeof section.title === "string" && section.title.trim().toLowerCase() === "achievements")
        sectionType = "achievements";
    } catch {
      /* noop */
    }

  // Determine whether v1 rendering should be active for this document.
  // Use the canonical runtime detector from CvLibraryContext.
  const { isV1Active, selectedInspector, closeInspector, updateStructuredItem } = useCvLibrary();

  // Dev-only runtime diagnostics: log which branch we will render for this section.

  // Hybrid profile editor: collapsed card + dedicated modal for structured fields
  const [isProfileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  // Summary modal editor (Remirror)
  const [isSummaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);
  // Skills modal editor
  const [isSkillsModalOpen, setSkillsModalOpen] = useState<boolean>(false);
  // Experience/Education modals (typed v1)
  const [isExperienceModalOpen, setExperienceModalOpen] = useState<boolean>(false);
  const [isEducationModalOpen, setEducationModalOpen] = useState<boolean>(false);
  // Skills drawer (Phase 2 skeleton)
  const [isSkillsDrawerOpen, setSkillsDrawerOpen] = useState<boolean>(false);
  const [isClearConfirming, setClearConfirming] = useState<boolean>(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  
  // (moved) The flush-related hooks and refs were moved higher up in the component
  // to resolve TypeScript declaration errors and to support the stable-ref pattern for registration.

  /**
   * Migrate legacy section.content -> section.blocks[0] when blocks are empty.
   * Also migrate structuredContent (experience/education/achievements) into
   * representative blocks when blocks are empty so BlockRenderer remains the
   * single source of truth for rendering and inspectors/popups continue to work.
   */

  /**
   * Universal addBlock for non-structured sections (creates an empty block).
   */
  const addBlock = useCallback(async () => {
    try {
      // Ensure nested editors and any registered block-level inspectors flush before mutating.
      try {
        await new Promise<void>((resolve) => {
          try {
            flushAllNestedEditors();
            // Allow microtasks (registered callbacks via flushPendingEdits) to run.
            queueMicrotask(() => resolve());
          } catch {
            resolve();
          }
        });
      } catch {
        /* noop */
      }
      const newBlock = {
        id: uuidv4(),
        title: 'New block',
        type: 'text' as const,
        content: ensureRemirrorDoc(''),
      };
      const nextBlocks = [...(Array.isArray(section.blocks) ? section.blocks : []), newBlock];
      const updatedSection = { ...section, blocks: nextBlocks as any };
      onChange(index, updatedSection as any);
    } catch {
      /* noop */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, index, onChange, flushAllNestedEditors]);

  /**
   * Universal delete handler for a block.
   * If the block links to a structured item (attributes.linkedStructuredId),
   * remove the structured item and all blocks linked to it (consistent with existing behavior).
   */
  const handleDeleteBlock = useCallback(async (blockId: string) => {
    try {
      try {
        await new Promise<void>((resolve) => {
          try {
            flushAllNestedEditors();
            queueMicrotask(() => resolve());
          } catch {
            resolve();
          }
        });
      } catch {
        /* noop */
      }
      const target = Array.isArray(section.blocks) ? section.blocks.find((b: any) => String(b.id) === String(blockId)) : null;
      const linkedId = (target as any)?.attributes?.linkedStructuredId ?? (target as any)?.attributes?.linkedstructuredid;
      const nextBlocks = (Array.isArray(section.blocks) ? section.blocks : []).filter((b: any) => {
        if (linkedId) {
          const linked = (b as any).attributes?.linkedStructuredId ?? (b as any).attributes?.linkedstructuredid;
          return String(linked) !== String(linkedId);
        }
        return String(b.id) !== String(blockId);
      });
      const nextStructured = linkedId && Array.isArray(section.structuredContent)
        ? (section.structuredContent as any[]).filter((it) => String(it.id) !== String(linkedId))
        : section.structuredContent;
      const updatedSection = { ...section, blocks: nextBlocks as any, structuredContent: nextStructured as any };
      onChange(index, updatedSection as any);
    } catch {
      /* noop */
    }
  }, [section, index, onChange, flushAllNestedEditors]);
  
  if (sectionType === "summary") {
    // Always render the structured SummaryBlock UI and ignore any legacy blocks.
    // Persist changes via context-level structured update to avoid relying on parent onChange.
    function handleSummaryPersist(updatedSection: CvSection) {
      try {
        const scFirst = Array.isArray(updatedSection.structuredContent) ? (updatedSection.structuredContent as any[])[0] : null;
        const itemId = String(scFirst?.id ?? `sum-${String(section.id)}-0`);
        // Patch all summary-related fields through structured update
        const { name, email, linkedin, address, summary, ...rest } = (scFirst ?? {}) as Record<string, any>;
        const patch: Record<string, any> = { name, email, linkedin, address };
        if (typeof onContentChange === "function" && updatedSection.id) {
          try {
            onContentChange(String(updatedSection.id), ensureRemirrorDoc(summary as any));
          } catch {
            /* noop */
          }
        }
        updateStructuredItem(String(section.id), itemId, patch);
      } catch {
        /* noop */
      }
    }

    return (
      <div className="mb-4 border border-bo rounded-rm section-container">
        <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            {!isClearConfirming && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSummaryModalOpen(true);
                }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label="Edit summary"
                title="Edit summary"
              >
                <Pen className="w-4 h-4" aria-hidden />
              </button>
            )}
            {isClearConfirming ? (
              <span className="sb-doc-confirm">
                <span className="sb-doc-confirm__label">Clear?</span>
                <button
                  type="button"
                  className="sb-doc-confirm__yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClearConfirming(false);
                    try { onContentChange?.(String(section.id), ensureRemirrorDoc(undefined as any)); } catch { /* noop */ }
                    try { onChange(index, { ...section, structuredContent: [] as any } as any); } catch { /* noop */ }
                  }}
                >Clear</button>
                <button type="button" className="sb-doc-confirm__no" onClick={(e) => { e.stopPropagation(); setClearConfirming(false); }}>Cancel</button>
              </span>
            ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setClearConfirming(true); }}
              className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--danger"
              aria-label="Clear summary"
              title="Clear summary"
            >
              <Trash className="w-4 h-4" aria-hidden />
            </button>
            )}
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {collapsed && (
          <div
            className="px-4 pb-3 cursor-text"
            role="button"
            tabIndex={0}
            aria-label="Edit summary"
            onClick={(e) => {
              e.stopPropagation();
              try {
                const sel = typeof window !== "undefined" ? window.getSelection() : null;
                if (sel && typeof sel.toString === "function" && sel.toString().length > 0) return;
              } catch {
                /* noop */
              }
              setSummaryModalOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                setSummaryModalOpen(true);
              }
            }}
          >
            <p className="text-sm truncate [color:var(--tm2)]">
              {(() => {
                try {
                  const sumItem = (Array.isArray(section.structuredContent) && section.structuredContent.length > 0
                    ? (section.structuredContent[0] as ISummaryItem)
                    : null);
                  const doc = ensureRemirrorDoc((sumItem as any)?.summary as any);
                  const txt = extractPlainTextLocal(doc);
                  return txt || "Start typing here";
                } catch {
                  return "Start typing here";
                }
              })()}
            </p>

            {/* Collapsed summary: preview-only; representative blocks removed to avoid duplication */}
          </div>
        )}

        {!collapsed && (
          <div className="p-4 space-y-4">
            <SummaryBlock
              section={section as any}
              onChange={(updatedSection) => {
                // Persist via context; do not depend on parent onChange (which may be a noop in Preview)
                handleSummaryPersist(updatedSection as any);
              }}
              onContentChange={onContentChange}
              onOpenEditor={() => setSummaryModalOpen(true)}
            />

            {/* Expanded summary: preview-only; representative blocks removed to avoid duplication */}
          </div>
        )}

        {isSummaryModalOpen ? (
          <SummaryModal
            open={isSummaryModalOpen}
            sectionId={String(section.id)}
            item={(Array.isArray(section.structuredContent) && section.structuredContent.length > 0 ? (section.structuredContent[0] as ISummaryItem) : null)}
            onClose={() => setSummaryModalOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  // Structured "skills" section: collapsed chips + SkillsModal + full block editor when expanded
  if (sectionType === "skills") {
    // Memoize to avoid new array identity on each parent render (prevents modal typing resets)
    const items: ISkillItem[] = useMemo(() => {
      if (!Array.isArray(section.structuredContent)) return [];
      return (section.structuredContent as any[]).map((it, idx) => {
        if (typeof it === "string") {
          return { id: `sk-${idx}-${String(section.id)}`, name: String(it), level: "Intermediate" };
        }
        const o = it as Partial<ISkillItem>;
        const name = typeof o.name === "string" ? o.name : "";
        const level = (o.level as ISkillItem["level"]) ?? "Intermediate";
        return { id: String(o.id ?? `sk-${idx}-${String(section.id)}`), name, level };
      });
    }, [section.structuredContent, section.id]);

    // Inline-first editing state for Skills (seed when items actually change)
    const [skillRows, setSkillRows] = useState<ISkillItem[]>([]);
    const lastSkillsSeedRef = useRef<string | null>(null);
    useEffect(() => {
      try {
        const nextStr = JSON.stringify(items ?? []);
        if (lastSkillsSeedRef.current === nextStr) return;
        lastSkillsSeedRef.current = nextStr;
        setSkillRows(JSON.parse(nextStr) as ISkillItem[]);
      } catch {
        setSkillRows(items);
      }
    }, [items]);

    function newSkillRow(): ISkillItem {
      const id = `sk-${uuidv4()}`;
      return { id, name: "", level: "Intermediate" };
    }

    const [savedTick, setSavedTick] = useState<string | null>(null);
    function persistRows(next: ISkillItem[], tickId?: string) {
      try {
        const sanitized = next
          .map((r) => ({ ...r, name: String(r.name ?? "").trim() }))
          .filter((r) => r.name.length > 0);
        const updatedSection = { ...section, structuredContent: sanitized as any };
        onChange(index, updatedSection as any);
        if (tickId) {
          setSavedTick(tickId);
          window.setTimeout(() => setSavedTick(null), 1200);
        }
      } catch {
        /* noop */
      }
    }

    function handleAddSkillInline() {
      setSkillRows((prev) => {
        const next = [...prev, newSkillRow()];
        return next;
      });
    }

    function handleRemoveSkillInline(skillId: string) {
      try {
        const next = skillRows.filter((r) => String(r.id) !== String(skillId));
        setSkillRows(next);
        persistRows(next, skillId);
      } catch {
        /* noop */
      }
    }

    function handleNameChangeInline(idx: number, name: string) {
      setSkillRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name } : r)));
    }

    function handleNameBlurInline(idx: number) {
      const row = skillRows[idx];
      if (!row) return;
      const name = String(row.name ?? "").trim();
      // Do not persist/clear an empty draft row on accidental blur — keep it editable.
      if (name.length === 0) return;
      persistRows(skillRows, String(row.id ?? idx));
    }

    function handleNameKeyDownInline(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
      if (e.key === "Enter") {
        e.preventDefault();
        const row = skillRows[idx];
        persistRows(skillRows, String(row?.id ?? idx));
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
    }

    function handleLevelChangeInline(idx: number, lvl: Level) {
      setSkillRows((prev) => {
        const next = prev.map((r, i) => (i === idx ? { ...r, level: lvl } : r));
        const row = next[idx];
        // If the skill name is still empty, do not persist on level change to avoid
        // unintentionally removing the draft row (persist requires a name).
        if (String(row?.name ?? "").trim().length === 0) return next;
        // Persist immediately on level change when the row has a name.
        persistRows(next, String(row?.id ?? idx));
        return next;
      });
    }

    const LEVEL_PRIORITY: Record<Level, number> = {
      Beginner: 1,
      Elementary: 2,
      Intermediate: 3,
      Advanced: 4,
      Fluent: 5,
    };

    function handleSortByLevel() {
      try {
        const next = [...skillRows].sort((a, b) => {
          const pB = LEVEL_PRIORITY[b.level] ?? 0;
          const pA = LEVEL_PRIORITY[a.level] ?? 0;
          if (pB !== pA) return pB - pA; // desc by level
          const nameA = String(a.name ?? "").toLocaleLowerCase();
          const nameB = String(b.name ?? "").toLocaleLowerCase();
          if (nameA !== nameB) return nameA.localeCompare(nameB);
          return String(a.id ?? "").localeCompare(String(b.id ?? ""));
        });
        setSkillRows(next);
        persistRows(next, "sort-level");
      } catch {
        /* noop */
      }
    }

    function handleSortAZ() {
      try {
        const next = [...skillRows].sort((a, b) => {
          const nameA = String(a.name ?? "").toLocaleLowerCase();
          const nameB = String(b.name ?? "").toLocaleLowerCase();
          if (nameA !== nameB) return nameA.localeCompare(nameB);
          const pB = LEVEL_PRIORITY[b.level] ?? 0;
          const pA = LEVEL_PRIORITY[a.level] ?? 0;
          if (pB !== pA) return pB - pA; // tie-break by level desc
          return String(a.id ?? "").localeCompare(String(b.id ?? ""));
        });
        setSkillRows(next);
        persistRows(next, "sort-az");
      } catch {
        /* noop */
      }
    }

    function handlePinToCoreInline(skillId: string) {
      try {
        const idx = skillRows.findIndex((r) => String(r.id) === String(skillId));
        if (idx < 0) return;
        const row = skillRows[idx];
        // If the row is an empty draft (no name yet), avoid pinning/removing it.
        if (!row || String(row.name ?? "").trim().length === 0) return;
        const next = [...skillRows];
        const [removed] = next.splice(idx, 1);
        next.unshift(removed);
        setSkillRows(next);
        persistRows(next, skillId);
      } catch {
        /* noop */
      }
    }
    function handleRemoveSkill(skillId: string): void {
      try {
        const sc = Array.isArray(section.structuredContent) ? section.structuredContent : [];
        if (sc.length === 0) return;
        let nextStructured: any[];
        if (typeof sc[0] === "string") {
          const idx = items.findIndex((it) => String(it.id) === String(skillId));
          nextStructured = (sc as any[]).filter((_, i) => i !== idx);
        } else {
          nextStructured = (sc as any[]).filter((it) => String((it as any).id ?? "") !== String(skillId));
        }
        const updatedSection = { ...section, structuredContent: nextStructured as any };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    return (
      <div className="mb-4 border border-bo rounded-rm section-container">
        <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            {/* Edit button stays hidden — inline editing uses the dot control below.
                SkillsModal component remains in place and can be re-enabled in future by restoring this button. */}
            <div aria-hidden className="w-6" />
            {/* Manage button intentionally hidden to avoid accidental usage of Phase 2 drawer.
                SkillsDrawer and its logic remain in the codebase for future enablement. */}
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {collapsed && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {items.length === 0 ? (
                <span className="text-sm [color:var(--tg2)]">No skills yet</span>
              ) : (
                items.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]"
                    aria-label={`${s.name} ${s.level}`}
                  >
                    <span className="font-medium [color:var(--ti)]">{s.name}</span>
                    <LevelDots
                      value={s.level}
                      levels={SKILL_DOT_LEVELS}
                      kind="skill"
                      readOnly={true}
                      ariaLabel={`${s.name} level`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          handleRemoveSkill(String(s.id));
                        } catch {
                          /* noop */
                        }
                      }}
                      className="dasti-icon-button dasti-icon-button--compact ml-1"
                      aria-label={`Remove ${s.name || "skill"}`}
                      title="Remove skill"
                    >
                      <X className="w-3 h-3" aria-hidden />
                      <span className="sr-only">Remove</span>
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Collapsed skills: also render representative blocks via BlockRenderer (diagnostic + parity with v1 cards) */}
            <div className="mt-2 space-y-2">
              {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
                <>
                  {section.blocks.map((b: any) => (
                    <div key={String(b.id)} className="p-0">
                      <BlockRenderer
                        sectionId={String(section.id)}
                        block={b as any}
                        onDelete={() => handleDeleteBlock(String(b.id))}
                        disableChevron={true}
                      />
                    </div>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="px-3 pb-2">
            {/* Add button */}
            <div className="flex items-center justify-end py-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAddSkillInline(); }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label="Add skill"
                title="Add skill"
              >
                <Plus className="h-3 w-3" aria-hidden />
              </button>
            </div>

            {skillRows.length === 0 ? (
              <div className="py-2 text-xs" style={{ color: "var(--tg2)" }}>
                Click + to add your first skill
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--bo)]">
                {skillRows.map((row, idx) => (
                  <div key={row.id ?? `row-${idx}`} className="group flex items-center gap-2 py-1.5">
                    {/* Level dots — LEFT */}
                    <div style={{ flexShrink: 0 }}>
                      <LevelDots
                        value={row.level}
                        levels={SKILL_DOT_LEVELS}
                        kind="skill"
                        onChange={(lvl) => handleLevelChangeInline(idx, lvl)}
                        ariaLabel={`Skill level for ${row.name || `row ${idx + 1}`}`}
                      />
                    </div>
                    {/* Name — CENTER (flex-1) */}
                    <label className="sr-only" htmlFor={`skill-name-inline-${idx}`}>Skill name</label>
                    <input
                      id={`skill-name-inline-${idx}`}
                      className="flex-1 min-w-0 bg-transparent border-0 text-sm focus:outline-none"
                      style={{ color: "var(--ti)" }}
                      placeholder="Skill name"
                      value={row.name ?? ""}
                      onChange={(e) => handleNameChangeInline(idx, e.target.value)}
                      onBlur={() => handleNameBlurInline(idx)}
                      onKeyDown={(e) => handleNameKeyDownInline(e, idx)}
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handlePinToCoreInline(String(row.id ?? idx))}
                        className="dasti-icon-button dasti-icon-button--compact"
                        aria-label={idx === 0 ? `${row.name || "skill"} is pinned to top` : `Pin ${row.name || "skill"} to top`}
                        title={idx === 0 ? "Pinned to top" : "Pin to top"}
                        style={idx === 0 ? { color: "var(--ac)" } : undefined}
                      >
                        {idx === 0
                          ? <PinOff className="w-3 h-3" aria-hidden />
                          : <Pin className="w-3 h-3" aria-hidden />
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkillInline(String(row.id ?? idx))}
                        className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--danger"
                        aria-label={`Remove ${row.name || "skill"}`}
                        title="Remove skill"
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Representative blocks (kept for parity/debug) */}
            {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
              <div className="mt-2 space-y-2">
                {section.blocks.map((b: any) => (
                  <div key={String(b.id)} className="p-0">
                    <BlockRenderer
                      sectionId={String(section.id)}
                      block={b as any}
                      onDelete={() => handleDeleteBlock(String(b.id))}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <SkillsModal
          open={isSkillsModalOpen}
          items={items}
          onClose={() => setSkillsModalOpen(false)}
          onSave={(next) => {
            try {
              const updatedSection = { ...section, structuredContent: next as any };
              onChange(index, updatedSection as any);
            } catch {
              /* noop */
            }
          }}
        />
        <SkillsDrawer
          open={isSkillsDrawerOpen}
          items={items}
          onClose={() => setSkillsDrawerOpen(false)}
          onApply={(next) => {
            try {
              const updatedSection = { ...section, structuredContent: next as any };
              onChange(index, updatedSection as any);
            } catch {
              /* noop */
            }
          }}
        />
      </div>
    );
  }

  // Structured "languages" section: collapsed chips + LanguagesModal (no Remirror block)
  if (sectionType === "languages") {
    // Memoize to avoid new array identity on each parent render (prevents modal typing resets)
    const items: ILanguageItem[] = useMemo(() => {
      if (!Array.isArray(section.structuredContent)) return [];
      return (section.structuredContent as any[]).map((it, idx) => {
        if (typeof it === "string") {
          return { id: `lang-${idx}-${String(section.id)}`, name: String(it), level: "Intermediate" };
        }
        const o = it as Partial<ILanguageItem>;
        const name = typeof o.name === "string" ? o.name : "";
        const level = (o.level as ILanguageItem["level"]) ?? "Intermediate";
        return { id: String(o.id ?? `lang-${idx}-${String(section.id)}`), name, level };
      });
    }, [section.structuredContent, section.id]);
 
    // Inline-first editing for Languages (parity with Skills but without buckets/pinning/sort)
    const [languageRows, setLanguageRows] = useState<ILanguageItem[]>([]);
    const lastLanguagesSeedRef = useRef<string | null>(null);
    // Keep a ref to the latest local rows so the seeding effect can merge drafts safely.
    const languageRowsRef = useRef<ILanguageItem[]>([]);
    useEffect(() => {
      languageRowsRef.current = languageRows;
    }, [languageRows]);

    useEffect(() => {
      try {
        const nextStr = JSON.stringify(items ?? []);
        // If the seed hasn't changed, no-op.
        if (lastLanguagesSeedRef.current === nextStr) return;
        // If user is currently focused inside a language input, skip reseeding to avoid stomping edits.
        try {
          const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
          if (active && active.id && active.id.startsWith("language-name-inline-")) {
            return;
          }
        } catch {
          // ignore focus detection errors
        }
        lastLanguagesSeedRef.current = nextStr;

        // Parse server items and merge any local draft rows that contain non-empty names
        const parsed = JSON.parse(nextStr) as ILanguageItem[];
        const localDrafts = (languageRowsRef.current ?? []).filter((r) => String(r.name ?? "").trim().length > 0);

        const merged: ILanguageItem[] = [...parsed];
        for (const d of localDrafts) {
          const exists = merged.some(
            (p) =>
              String(p.id ?? "") === String(d.id ?? "") ||
              (String(p.name ?? "").trim().toLowerCase() === String(d.name ?? "").trim().toLowerCase())
          );
          if (!exists) merged.push(d);
        }

        setLanguageRows(merged);
      } catch {
        setLanguageRows(items);
      }
    }, [items]);
 
    function newLanguageRow(): ILanguageItem {
      const id = `lang-${uuidv4()}`;
      return { id, name: "", level: "Intermediate" };
    }
 
    const [savedTick, setSavedTick] = useState<string | null>(null);
    function persistLanguageRows(next: ILanguageItem[], tickId?: string) {
      try {
        const sanitized = next
          .map((r) => ({ ...r, name: String(r.name ?? "").trim() }))
          .filter((r) => r.name.length > 0);
        const updatedSection = { ...section, structuredContent: sanitized as any };
        onChange(index, updatedSection as any);
        if (tickId) {
          setSavedTick(tickId);
          window.setTimeout(() => setSavedTick(null), 1200);
        }
      } catch {
        /* noop */
      }
    }
 
    function handleAddLanguageInline() {
      setLanguageRows((prev) => [...prev, newLanguageRow()]);
    }
 
    function handleRemoveLanguageInline(langId: string) {
      try {
        const next = languageRows.filter((r) => String(r.id) !== String(langId));
        setLanguageRows(next);
        persistLanguageRows(next, langId);
      } catch {
        /* noop */
      }
    }
 
    function handleNameChangeLanguage(idx: number, name: string) {
      setLanguageRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name } : r)));
    }
 
    function handleNameBlurLanguage(idx: number) {
      const row = languageRows[idx];
      if (!row) return;
      const name = String(row.name ?? "").trim();
      // Do not persist/clear an empty draft row on accidental blur — keep it editable.
      if (name.length === 0) return;
      persistLanguageRows(languageRows, String(row.id ?? idx));
    }
 
    function handleNameKeyDownLanguage(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
      if (e.key === "Enter") {
        e.preventDefault();
        const row = languageRows[idx];
        persistLanguageRows(languageRows, String(row?.id ?? idx));
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
    }
 
    function handleLevelChangeLanguage(idx: number, lvl: Level) {
      // Update local row immediately.
      setLanguageRows((prev) => {
        const next = prev.map((r, i) => (i === idx ? { ...r, level: lvl } : r));
        const row = next[idx];
        // If the row has a non-empty name we can persist; otherwise try to read the latest
        // value from the DOM input to avoid losing a freshly-typed name when user clicks level.
        const currentName = String(row?.name ?? "").trim();
        if (currentName.length === 0) {
          try {
            const input = typeof document !== "undefined" ? (document.getElementById(`language-name-inline-${idx}`) as HTMLInputElement | null) : null;
            const domVal = input?.value ?? "";
            if (domVal.trim().length > 0) {
              next[idx] = { ...next[idx], name: domVal.trim() };
              // Persist now (deferred slightly to let React settle)
              setTimeout(() => {
                try {
                  persistLanguageRows(next, String(next[idx].id ?? idx));
                } catch {
                  /* noop */
                }
              }, 30);
            }
          } catch {
            /* noop */
          }
          return next;
        }
        // Row already has a name; persist after a short delay to allow any pending input handlers to finish.
        setTimeout(() => {
          try {
            persistLanguageRows(next, String(row?.id ?? idx));
          } catch {
            /* noop */
          }
        }, 30);
        return next;
      });
    }
 
    // Collapsed view remove handler (chip remove)
    function handleRemoveLanguage(langId: string): void {
      try {
        const sc = Array.isArray(section.structuredContent) ? section.structuredContent : [];
        if (sc.length === 0) return;
        let nextStructured: any[];
        if (typeof sc[0] === "string") {
          const idx = items.findIndex((it) => String(it.id) === String(langId));
          nextStructured = (sc as any[]).filter((_, i) => i !== idx);
        } else {
          nextStructured = (sc as any[]).filter((it) => String((it as any).id ?? "") !== String(langId));
        }
        const updatedSection = { ...section, structuredContent: nextStructured as any };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }
 
    return (
      <div className="mb-4 border border-bo rounded-rm section-container">
        <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            {/* Edit button stays hidden; languages use the inline dot control below. */}
            <div aria-hidden className="w-6" />
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {collapsed && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {items.length === 0 ? (
                <span className="text-sm [color:var(--tg2)]">No languages yet</span>
              ) : (
                items.map((lng) => (
                  <span
                    key={lng.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]"
                    aria-label={`${lng.name} ${lng.level}`}
                  >
                    <span className="font-medium [color:var(--ti)]">{lng.name}</span>
                    <LevelDots
                      value={lng.level}
                      levels={LANGUAGE_DOT_LEVELS}
                      kind="language"
                      readOnly={true}
                      ariaLabel={`${lng.name} level`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          handleRemoveLanguage(String(lng.id));
                        } catch {
                          /* noop */
                        }
                      }}
                      className="dasti-icon-button dasti-icon-button--compact ml-1"
                      aria-label={`Remove ${lng.name || "language"}`}
                      title="Remove language"
                    >
                      <X className="w-3 h-3" aria-hidden />
                      <span className="sr-only">Remove</span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {!collapsed && (
          <div className="px-3 pb-2">
            {/* Add button */}
            <div className="flex items-center justify-end py-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAddLanguageInline(); }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label="Add language"
                title="Add language"
              >
                <Plus className="h-3 w-3" aria-hidden />
              </button>
            </div>

            {languageRows.length === 0 ? (
              <div className="py-2 text-xs" style={{ color: "var(--tg2)" }}>
                Click + to add your first language
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--bo)]">
                {languageRows.map((row, idx) => (
                  <div key={row.id ?? `row-${idx}`} className="group flex items-center gap-2 py-1.5">
                    {/* Level dots — LEFT */}
                    <div style={{ flexShrink: 0 }}>
                      <LevelDots
                        value={row.level}
                        levels={LANGUAGE_DOT_LEVELS}
                        kind="language"
                        onChange={(lvl) => handleLevelChangeLanguage(idx, lvl)}
                        ariaLabel={`Language level for ${row.name || `row ${idx + 1}`}`}
                      />
                    </div>
                    {/* Name — CENTER (flex-1) */}
                    <label className="sr-only" htmlFor={`language-name-inline-${idx}`}>Language name</label>
                    <input
                      id={`language-name-inline-${idx}`}
                      className="flex-1 min-w-0 bg-transparent border-0 text-sm focus:outline-none"
                      style={{ color: "var(--ti)" }}
                      placeholder="Language name"
                      value={row.name ?? ""}
                      onChange={(e) => handleNameChangeLanguage(idx, e.target.value)}
                      onBlur={() => handleNameBlurLanguage(idx)}
                      onKeyDown={(e) => handleNameKeyDownLanguage(e, idx)}
                    />
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveLanguageInline(String(row.id ?? idx))}
                        className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--danger"
                        aria-label={`Remove ${row.name || "language"}`}
                        title="Remove language"
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Structured "achievements" section: preview + AchievementsModal (like Summary)
  if (sectionType === "achievements") {
    return (
      <div className="mb-4">
        <AchievementsBlock
          section={section as any}
          onChange={(updatedSection) => {
            try {
              onChange(index, updatedSection as any);
            } catch {
              /* noop */
            }
          }}
        />
      </div>
    );
  }

  // Structured "profile" section: collapsed card + ProfileModal (no Remirror)
  if (sectionType === "profile") {
    const item = (Array.isArray(structured) && structured.length > 0 ? structured[0] : null) as IProfileItem | null;
    const itemId = String(item?.id ?? "");
    const name = String(item?.name ?? "");
    const desiredPosition = String(item?.desiredPosition ?? "");
    const email = String(item?.email ?? "");
    const phone = String(item?.phone ?? "");
    const linkedin = String(item?.linkedin ?? "");
    const website = String(item?.website ?? "");
    const location = String(item?.location ?? "");
    const photoUrl = String(item?.photoUrl ?? "");

    function openProfilePhotoPicker() {
      profilePhotoInputRef.current?.click();
    }

    function handleProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";

      if (!file || !itemId) return;

      const reader = new FileReader();
      reader.onload = () => {
        const nextPhotoUrl = typeof reader.result === "string" ? reader.result : "";
        if (!nextPhotoUrl) return;
        updateStructuredItem(String(section.id), itemId, { photoUrl: nextPhotoUrl });
      };
      reader.readAsDataURL(file);
    }

    function Chip({ icon, text, href, ariaLabel }: { icon: React.ReactNode; text: string; href?: string; ariaLabel: string }) {
      if (!text) return null;
      const content = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]">
          {icon}
          <span className="truncate max-w-[160px]">{text}</span>
        </span>
      );
      return href ? (
        <a className="rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]" href={href} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
          {content}
        </a>
      ) : (
        <span aria-label={ariaLabel}>{content}</span>
      );
    }

    return (
      <div className="mb-4 border border-bo rounded-rm section-container">
        <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            {!isClearConfirming && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileModalOpen(true);
                }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label="Edit profile"
                title="Edit profile"
              >
                <Pen className="w-4 h-4" aria-hidden />
              </button>
            )}
            {isClearConfirming ? (
              <span className="sb-doc-confirm">
                <span className="sb-doc-confirm__label">Clear?</span>
                <button
                  type="button"
                  className="sb-doc-confirm__yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClearConfirming(false);
                    try { onChange(index, { ...section, structuredContent: [] as any } as any); } catch { /* noop */ }
                  }}
                >Clear</button>
                <button type="button" className="sb-doc-confirm__no" onClick={(e) => { e.stopPropagation(); setClearConfirming(false); }}>Cancel</button>
              </span>
            ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setClearConfirming(true); }}
              className="dasti-icon-button dasti-icon-button--compact dasti-icon-button--danger"
              aria-label="Clear profile"
              title="Clear profile"
            >
              <Trash className="w-4 h-4" aria-hidden />
            </button>
            )}
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div>
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleProfilePhotoChange}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={openProfilePhotoPicker}
                  className="relative flex items-center justify-center overflow-hidden text-sm font-semibold border rounded-rm focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
                  style={{
                    width: "var(--s8)",
                    height: "calc(var(--s8) + var(--s4))",
                    background: "var(--sf2)",
                    borderColor: "var(--bo)",
                    color: "var(--ti)",
                    cursor: "pointer",
                  }}
                  aria-label={photoUrl ? "Change profile photo" : "Upload profile photo"}
                  title={photoUrl ? "Change profile photo" : "Upload profile photo"}
                >
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={name ? `${name} portrait` : "Profile portrait"} className="object-cover w-full h-full" />
                  ) : (
                    <UserRound aria-hidden strokeWidth={1.75} className="[color:var(--tm2)]" style={{ width: "var(--s7)", height: "var(--s7)" }} />
                  )}
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <div className="text-base font-semibold truncate [color:var(--ti)]">{name || "Your name"}</div>
                  <div className="text-sm truncate [color:var(--tg2)]">{desiredPosition || "Desired position"}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 rounded-full bg-emerald-500" />} text={email} href={email ? `mailto:${email}` : undefined} ariaLabel="Email" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />} text={phone} href={phone ? `tel:${phone}` : undefined} ariaLabel="Phone" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 [background:var(--ac)] rounded-full" />} text={linkedin} href={linkedin || undefined} ariaLabel="LinkedIn" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 bg-indigo-500 rounded-full" />} text={website} href={website || undefined} ariaLabel="Website" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 rounded-full bg-amber-500" />} text={location} ariaLabel="Location" />
                </div>
              </div>
            </div>
          </div>
        )}

        <ProfileModal
          open={isProfileModalOpen}
          sectionId={String(section.id)}
          item={item}
          onClose={() => setProfileModalOpen(false)}
        />
      </div>
    );
  }

  if (Array.isArray(structured) && (sectionType === "experience" || sectionType === "education")) {
    // Use block-based rendering (compact cards + inspector) for typed structured sections.
    // This delegates detailed editing to BlockRenderer + SelectedBlockInspector which rely on
    // blocks with attributes.linkedStructuredId.
    // deduplicated flushAllNestedEditors - using the top-level remirrorRefs-based implementation

    async function addEntry() {
      try {
        try {
          await new Promise<void>((resolve) => {
            try {
              flushAllNestedEditors();
              queueMicrotask(() => resolve());
            } catch {
              resolve();
            }
          });
        } catch {
          /* noop */
        }
        const newEntry = sectionType === "experience"
          ? makeExperienceItem()
          : makeEducationItem();
 
        const nextStructured = Array.isArray(section.structuredContent) ? [...(section.structuredContent as any), newEntry] : [newEntry];
        const titleBase =
          sectionType === "experience"
            ? String((newEntry as IExperienceItem).company ?? "") || `Experience`
            : String((newEntry as IEducationItem).institution ?? "") || `Education`;
        const newBlock = {
          id: uuidv4(),
          title: titleBase,
          type: "text" as const,
          content: ensureRemirrorDoc(undefined as any),
          attributes: { linkedStructuredId: (newEntry as any).id },
        };
 
        const nextBlocks = [...(Array.isArray(section.blocks) ? section.blocks : []), newBlock];
        const updatedSection = { ...section, structuredContent: nextStructured as any, blocks: nextBlocks as any };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    /**
     * Remove an entry from structuredContent.
     * Supports both object-based structured items (experience/education) and
     * string-based items (achievements). Accepts either the item or its index.
     */
    async function removeEntry(item: any, idx: number) {
      try {
        try {
          await new Promise<void>((resolve) => {
            try {
              flushAllNestedEditors();
              queueMicrotask(() => resolve());
            } catch {
              resolve();
            }
          });
        } catch {
          /* noop */
        }
 
        if (sectionType === "achievements") {
          // structuredContent is string[]
          const nextStructured = Array.isArray(section.structuredContent)
            ? (section.structuredContent as any[]).filter((_, i) => i !== idx)
            : [];
          // Remove the corresponding representative block at the same index if present
          const nextBlocks = (Array.isArray(section.blocks) ? section.blocks : []).filter((_, i) => i !== idx);
          const updatedSection = { ...section, structuredContent: nextStructured as any, blocks: nextBlocks as any };
          onChange(index, updatedSection as any);
          return;
        }
 
        // For object-structured entries (experience/education), item is expected to be an object with `id`
        const itemId = String(item?.id ?? "");
        const nextStructured = Array.isArray(section.structuredContent)
          ? (section.structuredContent as any[]).filter((it) => String(it.id) !== itemId)
          : [];
        const nextBlocks = (Array.isArray(section.blocks) ? section.blocks : []).filter((b: any) => {
          const linked = (b as any).attributes?.linkedStructuredId ?? (b as any).attributes?.linkedstructuredid;
          return String(linked) !== itemId;
        });
        const updatedSection = { ...section, structuredContent: nextStructured as any, blocks: nextBlocks as any };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    const structuredList = Array.isArray(section.structuredContent)
      ? (section.structuredContent as any[])
      : [];
    const guard = sectionType === "experience" ? isExperienceRenderable : isEducationRenderable;
    const renderableStructured = structuredList.filter((item) => guard(item));
    const hasRenderableStructured = renderableStructured.length > 0;
    const hasBlocks = Array.isArray(section.blocks) && section.blocks.length > 0;

    const renderStructuredPreview = (rawItem: any, idx: number, variant: "compact" | "detailed") => {
      const structuredId = String(rawItem?.id ?? idx);
      const isExp = sectionType === "experience";
      const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      const dates = formatRangeFromItem(rawItem as any);

      if (isExp) {
        const company = trim(rawItem?.company);
        const position = trim(rawItem?.position);
        const location = trim(rawItem?.location);
        const title = position || company || "Experience entry";
        const subtitle = [company, location].filter(Boolean).join(" • ") || undefined;

        const responsibilityBullets = Array.isArray(rawItem?.responsibilityBullets)
          ? (rawItem.responsibilityBullets as unknown[])
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean)
          : splitResponsibilitiesIntoBullets(typeof rawItem?.responsibilities === "string" ? rawItem.responsibilities : undefined);

        const achievements = Array.isArray(rawItem?.achievements)
          ? (rawItem.achievements as unknown[])
              .map((value) =>
                typeof value === "string"
                  ? value.trim()
                  : typeof (value as any)?.text === "string"
                  ? (value as any).text.trim()
                  : ""
              )
              .filter(Boolean)
          : [];

        const bulletSource = responsibilityBullets.length > 0 ? responsibilityBullets : achievements;
        const bulletLimit = variant === "compact" ? 3 : bulletSource.length;
        const bulletList = bulletSource.slice(0, bulletLimit);
        const hasMoreBullets = variant === "compact" && bulletSource.length > bulletList.length;

        return (
          <div key={structuredId} className="space-y-1 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate [color:var(--ti)]">{title}</div>
                {subtitle ? (
                  <div className="text-xs truncate [color:var(--tm2)]">{subtitle}</div>
                ) : null}
              </div>
              <div className="text-xs shrink-0 [color:var(--tm2)]">{dates}</div>
            </div>
            {bulletList.length > 0 ? (
              <ul className="ml-4 space-y-1 text-xs list-disc [color:var(--ti)]">
                {bulletList.map((line, bulletIdx) => (
                  <li key={`${structuredId}-bullet-${bulletIdx}`} className="leading-snug">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            {hasMoreBullets ? (
              <div className="ml-4 text-[11px] [color:var(--tm2)]">Expand to view more details.</div>
            ) : null}
          </div>
        );
      }

      const institution = trim(rawItem?.institution);
      const degree = trim(rawItem?.degree);
      const fieldOfStudy = trim(rawItem?.fieldOfStudy);
      const descriptionRaw = rawItem?.description;
      const description = typeof descriptionRaw === "string" ? descriptionRaw.trim() : "";
      const hasObjectDescription = descriptionRaw && typeof descriptionRaw === "object";
      const title = degree || institution || fieldOfStudy || "Education entry";
      const subtitle = [institution, fieldOfStudy].filter(Boolean).join(" • ");
      const truncatedDescription =
        variant === "compact" && description.length > 160
          ? `${description.slice(0, 157).trimEnd()}…`
          : description;

      return (
        <div key={structuredId} className="space-y-1 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate [color:var(--ti)]">{title}</div>
              {subtitle ? (
                <div className="text-xs truncate [color:var(--tm2)]">{subtitle}</div>
              ) : null}
            </div>
            <div className="text-xs shrink-0 [color:var(--tm2)]">{dates}</div>
          </div>
          {truncatedDescription ? (
            <p className="ml-0 text-xs leading-snug [color:var(--ti)]">{truncatedDescription}</p>
          ) : null}
          {!truncatedDescription && hasObjectDescription ? (
            <p className="ml-0 text-xs italic [color:var(--tm2)]">Detailed description available.</p>
          ) : null}
        </div>
      );
    };

    return (
      <div className="mb-4 border border-bo rounded-rm section-container">
        <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center space-x-2">
            {isV1Active ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    if (sectionType === "experience") setExperienceModalOpen(true);
                    else if (sectionType === "education") setEducationModalOpen(true);
                  } catch { /* noop */ }
                }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label={`Edit ${sectionType}`}
                title={`Edit ${sectionType}`}
              >
                <Pen className="w-4 h-4" aria-hidden />
              </button>
            ) : null}
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>
        
        

        {collapsed && (
          <div className="px-4 pb-3">
            {hasRenderableStructured ? (
              <div className="cv-entry-stack">
                {renderableStructured.map((it, i) => renderStructuredPreview(it, i, "compact"))}
              </div>
            ) : hasBlocks ? (
              <div className="text-sm [color:var(--tg2)]">Entries stored in rich text. Expand to view.</div>
            ) : (
              <div className="text-sm [color:var(--tg2)]">No entries</div>
            )}
          </div>
        )}

        {!collapsed && (
          <div className="p-4 space-y-4">
            {hasBlocks ? (
              <div className="cv-entry-stack">
                {section.blocks.map((block) => (
                  <div key={String(block.id)} className="p-0">
                    <BlockRenderer
                      sectionId={String(section.id)}
                      block={block as any}
                      onDelete={() => handleDeleteBlock(String(block.id))}
                      disableChevron={true}
                    />
                  </div>
                ))}
              </div>
            ) : hasRenderableStructured ? (
              <div className="cv-entry-stack">
                {renderableStructured.map((it, i) => renderStructuredPreview(it, i, "detailed"))}
              </div>
            ) : (
              <div className="p-3 text-sm [color:var(--tg2)]">No entries</div>
            )}
          </div>
        )}
        {/* Typed v1 modals for Experience/Education */}
        {isV1Active && sectionType === "experience" && isExperienceModalOpen ? (
          <ExperienceModal
            open={isExperienceModalOpen}
            onClose={() => setExperienceModalOpen(false)}
            items={(Array.isArray(section.structuredContent) ? (section.structuredContent as any) : []) as IExperienceItem[]}
            onSave={(next) => {
              try {
                // Sync blocks with structured items by linkedStructuredId
                const keepIds = new Set(next.map((it) => String(it.id)));
                const existingBlocks = Array.isArray(section.blocks) ? section.blocks : [];
                const keptBlocks = existingBlocks.filter((b: any) => {
                  const linked = (b as any)?.attributes?.linkedStructuredId ?? (b as any)?.attributes?.linkedstructuredid;
                  return keepIds.has(String(linked));
                });
                const hasBlockByLinked = (id: string) =>
                  keptBlocks.some((b: any) => String((b as any)?.attributes?.linkedStructuredId ?? (b as any)?.attributes?.linkedstructuredid) === String(id));

                const createdBlocks = next
                  .filter((it) => it && it.id && !hasBlockByLinked(String(it.id)))
                  .map((it) => ({
                    id: uuidv4(),
                    title: String(it.position || it.company || "Experience"),
                    type: "text" as const,
                    content: ensureRemirrorDoc(undefined as any),
                    attributes: { linkedStructuredId: String(it.id) },
                  }));

                const updatedSection = {
                  ...section,
                  structuredContent: next as any,
                  blocks: [...keptBlocks, ...createdBlocks] as any,
                } as CvSection;

                onChange(index, updatedSection as any);
                setExperienceModalOpen(false);
              } catch { /* noop */ }
            }}
          />
        ) : null}
        {isV1Active && sectionType === "education" && isEducationModalOpen ? (
          <EducationModal
            open={isEducationModalOpen}
            onClose={() => setEducationModalOpen(false)}
            items={(Array.isArray(section.structuredContent) ? (section.structuredContent as any) : []) as IEducationItem[]}
            onSave={(next) => {
              try {
                const keepIds = new Set(next.map((it) => String(it.id)));
                const existingBlocks = Array.isArray(section.blocks) ? section.blocks : [];
                const keptBlocks = existingBlocks.filter((b: any) => {
                  const linked = (b as any)?.attributes?.linkedStructuredId ?? (b as any)?.attributes?.linkedstructuredid;
                  return keepIds.has(String(linked));
                });
                const hasBlockByLinked = (id: string) =>
                  keptBlocks.some((b: any) => String((b as any)?.attributes?.linkedStructuredId ?? (b as any)?.attributes?.linkedstructuredid) === String(id));

                const createdBlocks = next
                  .filter((it) => it && it.id && !hasBlockByLinked(String(it.id)))
                  .map((it) => ({
                    id: uuidv4(),
                    title: String(it.institution || it.degree || "Education"),
                    type: "text" as const,
                    content: ensureRemirrorDoc(undefined as any),
                    attributes: { linkedStructuredId: String(it.id) },
                  }));

                const updatedSection = {
                  ...section,
                  structuredContent: next as any,
                  blocks: [...keptBlocks, ...createdBlocks] as any,
                } as CvSection;

                onChange(index, updatedSection as any);
                setEducationModalOpen(false);
              } catch { /* noop */ }
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mb-4 border border-bo rounded-rm section-container">
      <div className="flex items-center justify-between p-3 [background:var(--sf1)]">
        <label htmlFor={titleInputId} className="sr-only">
          Section title
        </label>
        <input
          id={titleInputId}
          aria-label="Section title"
          ref={titleInputRef}
          value={localTitle}
          onChange={(e) => {
            const v = e.target.value;
            setLocalTitle(v);
          }}
          onBlur={() => {
            try {
              // Emit final title to parent
              if (localTitle !== section.title) onTitleChange?.(String(section.id), localTitle);
            } catch {
              /* noop */
            }
            titleFocusedRef.current = false;
            onBlur?.(String(section.id));
          }}
          onFocus={() => {
            titleFocusedRef.current = true;
            onFocus?.(String(section.id));
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-grow text-lg font-semibold bg-transparent focus:outline-none"
          placeholder="Section Title"
        />
       {typeof onCollapseChange === "function" && (
         <button
           type="button"
           onClick={(e) => {
             e.stopPropagation();
             if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
               // eslint-disable-next-line no-console
               console.log("[SectionEditor] onCollapseChange clicked");
             }
             try {
               // Protect against racing with the local title buffer.
               // Use a brief flushGuard to prevent the syncing effect from overwriting the buffer.
               flushGuardRef.current = true;
               // Flush nested EntryRemirror editors first to ensure their buffered content is persisted.
               try {
                 remirrorRefs.current.forEach((r: { flush?: () => void } | null) => {
                   try {
                     r?.flush?.();
                   } catch {
                     /* noop */
                   }
                 });
               } catch {
                 /* noop */
               }
               // Persist title first (synchronous) to avoid it being cleared by deferred content updates.
               try {
                 if (localTitle !== section.title) onTitleChange?.(String(section.id), localTitle);
               } catch {
                 /* noop */
               }
               // Persist content asynchronously to avoid nested synchronous updates during Remirror lifecycle.
               try {
                 const view = (manager as any)?.view;
                 if (view) {
                   const docJson = view.state.doc.toJSON();
                   setTimeout(() => {
                     try {
                       onContentChange?.(String(section.id), docJson);
                     } catch {
                       /* noop */
                     }
                   }, 0);
                 } else {
                   const fallbackHtml = (() => {
                     try {
                       if (section && typeof (section as any).content === "object" && (section as any).content !== null) {
                         const sec = remirrorDocToSection(ensureRemirrorDoc((section as any).content as any), String(section.id), section.title ?? "");
                         return String((sec as any)?.content ?? "") || "";
                       }
                       return String((section as any).content ?? "") || "";
                     } catch {
                       return String((section as any).content ?? "") || "";
                     }
                   })();
                   const doc = ensureRemirrorDoc(fallbackHtml ?? "");
                   setTimeout(() => {
                     try {
                       onContentChange?.(String(section.id), doc);
                     } catch {
                       /* noop */
                     }
                   }, 0);
                 }
               } catch (err) {
                 // eslint-disable-next-line no-console
                 console.warn("[SectionEditor] deferredContentFlush failed", err);
               }
             } catch (err) {
               // eslint-disable-next-line no-console
               console.warn("[SectionEditor] flushBeforeCollapse failed", err);
             } finally {
               // Release the guard on the next macrotask so the syncing effect can run again.
               setTimeout(() => {
                 flushGuardRef.current = false;
               }, 0);
             }
             onCollapseChange();
           }}
           aria-expanded={!collapsed}
           aria-label={collapsed ? "Expand section" : "Collapse section"}
           className="p-1 ml-2 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
         >
           <span className="[color:var(--tg2)]" aria-hidden>
               {collapsed ? "▶" : "▼"}
             </span>
         </button>
       )}
      </div>

      {!collapsed && (
        <div
          className="p-1 editor-wrapper"
          onPointerDown={() => {
            if (remirrorViewAvailable) focusEditorAtEnd();
          }}
        >
          <Remirror manager={manager} initialContent={state} onChange={handleRemirrorChange}>
            <div className="mb-2">
              <EditorToolbar />
            </div>

            <ErrorBoundary
              fallback={
                <div
                  role="textbox"
                  aria-live="polite"
                  aria-label={localTitle ? `${localTitle} editor` : "Section editor"}
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => {
                    // Keep uncontrolled fallback buffer; don't emit here (parent controls)
                  }}
                  onBlur={() => {
                    try {
                      const view = (manager as any)?.view;
                      const json = view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined;
                      if (json) {
                        // Emit atomic updates only — content and title separately.
                        onContentChange?.(String(section.id), json);
                        onTitleChange?.(String(section.id), localTitle);
                      } else {
                        // Fallback: compute fallback HTML from section.content and convert to RemirrorJSON
                        const fallbackHtml = (() => {
                          try {
                            if (section && typeof (section as any).content === "object" && (section as any).content !== null) {
                              const sec = remirrorDocToSection(ensureRemirrorDoc((section as any).content as any), String(section.id), section.title ?? "");
                              return String((sec as any)?.content ?? "") || "";
                            }
                            return String((section as any).content ?? "") || "";
                          } catch {
                            return String((section as any).content ?? "") || "";
                          }
                        })();
                        const doc = ensureRemirrorDoc(fallbackHtml ?? "");
                        onContentChange?.(String(section.id), doc);
                        onTitleChange?.(String(section.id), localTitle);
                      }
                    } catch {
                      /* noop */
                    }
                    onBlur?.(String(section.id));
                  }}
                  className="min-h-[80px] p-3 border border-dashed border-bo rounded prose max-w-none [background:var(--sfr)] [color:var(--ti)]"
                />
              }
            >
              <div className="rich-content">
                <EditorComponent />
              </div>
            </ErrorBoundary>
          </Remirror>
        </div>
      )}
    </div>
  );
}
