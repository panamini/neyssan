import { v4 as uuidv4 } from "uuid";
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useMemo, useState, useCallback } from "react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import { BoldExtension, ItalicExtension, UnderlineExtension } from "remirror/extensions";
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
import { LanguagesModal } from "./structured-blocks/LanguagesModal";
import BlockRenderer from "./cv-editor/BlockRenderer";
import { useSectionFlushSubscription } from "../hooks/use-flush-subscription";
import { Pencil, Trash2, X } from "lucide-react";
import { ExperienceModal, EducationModal } from "./structured-blocks/ExperienceEducationModal";
import { isV1SectionsEnabled } from "../lib/flags";
import { formatRangeFromItem } from "../lib/date-utils";

/**
 * Simple uid helper used for generating new block/entry ids locally.
 * Matches the lightweight uid pattern used elsewhere in the project.
 */

import type { RemirrorJSON } from 'remirror';
import type { CvSection, IExperienceItem, IEducationItem, IProfileItem, ISummaryItem, ISkillItem, ILanguageItem } from '../types/cvDocument';

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

const createExtensions = () => [new BoldExtension({}), new ItalicExtension({}), new UnderlineExtension({})];

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
      <div className="p-2 bg-white border rounded dark:bg-slate-900">
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
    // eslint-disable-next-line no-console
    console.debug("[SectionEditor] mount", { mountId: mountIdRef.current, sectionId: section.id });
    return () => {
      // eslint-disable-next-line no-console
      console.debug("[SectionEditor] unmount", { mountId: mountIdRef.current, sectionId: section.id });
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
      console.log("[SectionEditor] editor focused", { sectionId: section.id });
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
  const sectionType = section.type;

  // Hybrid profile editor: collapsed card + dedicated modal for structured fields
  const [isProfileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  // Summary modal editor (Remirror)
  const [isSummaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);
  // Skills modal editor
  const [isSkillsModalOpen, setSkillsModalOpen] = useState<boolean>(false);
  // Languages modal editor
  const [isLanguagesModalOpen, setLanguagesModalOpen] = useState<boolean>(false);
  // Experience/Education modals (typed v1)
  const [isExperienceModalOpen, setExperienceModalOpen] = useState<boolean>(false);
  const [isEducationModalOpen, setEducationModalOpen] = useState<boolean>(false);
  
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
    const { updateStructuredItem } = useCvLibrary();

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
      <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryModalOpen(true);
              }}
              className="p-1 rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Edit summary"
              title="Edit summary"
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const confirmClear =
                    typeof window !== "undefined"
                      ? window.confirm("Clear Summary? This will remove your summary text.")
                      : true;
                  if (!confirmClear) return;
                } catch {
                  /* noop */
                }
                try {
                  onContentChange?.(String(section.id), ensureRemirrorDoc(undefined as any));
                } catch {
                  /* noop */
                }
                try {
                  const updated = { ...section, structuredContent: [] as any };
                  onChange(index, updated as any);
                } catch {
                  /* noop */
                }
              }}
              className="p-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Clear summary"
              title="Clear summary"
            >
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <span className="text-gray-400" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {collapsed && (
          <div className="px-4 pb-3">
            <p className="text-sm truncate text-neutral-600 dark:text-slate-300">
              {(() => {
                try {
                  const sumItem = (Array.isArray(section.structuredContent) && section.structuredContent.length > 0
                    ? (section.structuredContent[0] as ISummaryItem)
                    : null);
                  const doc = ensureRemirrorDoc((sumItem as any)?.summary as any);
                  const txt = extractPlainTextLocal(doc);
                  return txt || "No summary yet";
                } catch {
                  return "No summary yet";
                }
              })()}
            </p>
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
            />
          </div>
        )}

        <SummaryModal
          open={isSummaryModalOpen}
          sectionId={String(section.id)}
          item={(Array.isArray(section.structuredContent) && section.structuredContent.length > 0 ? (section.structuredContent[0] as ISummaryItem) : null)}
          onClose={() => setSummaryModalOpen(false)}
        />
      </div>
    );
  }

  // Structured "skills" section: collapsed chips + SkillsModal + full block editor when expanded
  if (sectionType === "skills") {
    const items: ISkillItem[] = Array.isArray(section.structuredContent)
      ? (section.structuredContent as any[]).map((it, idx) => {
          if (typeof it === "string") {
            return { id: `sk-${idx}-${String(section.id)}`, name: String(it), level: "Intermediate" };
          }
          const o = it as Partial<ISkillItem>;
          const name = typeof o.name === "string" ? o.name : "";
          const level = (o.level as ISkillItem["level"]) ?? "Intermediate";
          return { id: String(o.id ?? `sk-${idx}-${String(section.id)}`), name, level };
        })
      : [];

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
      <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSkillsModalOpen(true);
              }}
              className="p-1 rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Edit skills"
              title="Edit skills"
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <span className="text-gray-400" aria-hidden>
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
                <span className="text-sm text-neutral-500">No skills yet</span>
              ) : (
                items.map((s, i) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-slate-200"
                    aria-label={`${s.name} ${s.level}`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="opacity-70">•</span>
                    <span className="opacity-80">{s.level}</span>
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
                      className="inline-flex p-0.5 ml-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
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
          </div>
        )}

        {!collapsed && (
          <div className="p-4">
            <SkillsBlock
              section={section as any}
              onChange={(updatedSection) => {
                try {
                  onChange(index, updatedSection as any);
                } catch {
                  /* noop */
                }
              }}
            />
            <div className="mt-4 space-y-2">
              {Array.isArray(section.blocks) && section.blocks.length > 0
                ? section.blocks.map((b: any) => (
                    <div key={String(b.id)} className="p-0">
                      <BlockRenderer
                        sectionId={String(section.id)}
                        block={b as any}
                        onDelete={() => handleDeleteBlock(String(b.id))}
                      />
                    </div>
                  ))
                : null}
            </div>
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
      </div>
    );
  }

  // Structured "languages" section: collapsed chips + LanguagesModal (no Remirror block)
  if (sectionType === "languages") {
    const items: ILanguageItem[] = Array.isArray(section.structuredContent)
      ? (section.structuredContent as any[]).map((it, idx) => {
          if (typeof it === "string") {
            return { id: `lang-${idx}-${String(section.id)}`, name: String(it), level: "Intermediate" };
          }
          const o = it as Partial<ILanguageItem>;
          const name = typeof o.name === "string" ? o.name : "";
          const level = (o.level as ILanguageItem["level"]) ?? "Intermediate";
          return { id: String(o.id ?? `lang-${idx}-${String(section.id)}`), name, level };
        })
      : [];

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
      <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLanguagesModalOpen(true);
              }}
              className="p-1 rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Edit languages"
              title="Edit languages"
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <span className="text-gray-400" aria-hidden>
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
                <span className="text-sm text-neutral-500">No languages yet</span>
              ) : (
                items.map((lng) => (
                  <span
                    key={lng.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-slate-200"
                    aria-label={`${lng.name} ${lng.level}`}
                  >
                    <span className="font-medium">{lng.name}</span>
                    <span className="opacity-70">•</span>
                    <span className="opacity-80">{lng.level}</span>
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
                      className="inline-flex p-0.5 ml-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
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
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {items.length === 0 ? (
                <div className="px-3 py-2 text-sm rounded text-neutral-500 bg-neutral-50 dark:bg-slate-800">No languages yet. Use Edit to add some.</div>
              ) : (
                items.map((lng) => (
                  <span
                    key={lng.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-slate-200"
                    aria-label={`${lng.name} ${lng.level}`}
                  >
                    <span className="font-medium">{lng.name}</span>
                    <span className="opacity-70">•</span>
                    <span className="opacity-80">{lng.level}</span>
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
                      className="inline-flex p-0.5 ml-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-0"
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

        <LanguagesModal
          open={isLanguagesModalOpen}
          items={items}
          onClose={() => setLanguagesModalOpen(false)}
          onSave={(next) => {
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
  // Structured "profile" section: collapsed card + ProfileModal (no Remirror)
  if (sectionType === "profile") {
    const item = (Array.isArray(structured) && structured.length > 0 ? structured[0] : null) as IProfileItem | null;
    const name = String(item?.name ?? "");
    const desiredPosition = String(item?.desiredPosition ?? "");
    const email = String(item?.email ?? "");
    const phone = String(item?.phone ?? "");
    const linkedin = String(item?.linkedin ?? "");
    const website = String(item?.website ?? "");
    const location = String(item?.location ?? "");
    const photoUrl = String(item?.photoUrl ?? "");

    const initials = name
      ? name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("")
      : "";

    function Chip({ icon, text, href, ariaLabel }: { icon: React.ReactNode; text: string; href?: string; ariaLabel: string }) {
      if (!text) return null;
      const content = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700 dark:bg-slate-800 dark:text-slate-200">
          {icon}
          <span className="truncate max-w-[160px]">{text}</span>
        </span>
      );
      return href ? (
        <a className="rounded focus:outline-none focus:ring-2 focus:ring-offset-1" href={href} target="_blank" rel="noreferrer" aria-label={ariaLabel}>
          {content}
        </a>
      ) : (
        <span aria-label={ariaLabel}>{content}</span>
      );
    }

    return (
      <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setProfileModalOpen(true);
              }}
              className="p-1 rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                try {
                  const confirmClear =
                    typeof window !== "undefined"
                      ? window.confirm("Clear Profile? This will remove all profile information.")
                      : true;
                  if (!confirmClear) return;
                } catch {
                  /* noop */
                }
                try {
                  const updated = { ...section, structuredContent: [] as any };
                  onChange(index, updated as any);
                } catch {
                  /* noop */
                }
              }}
              className="p-1 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
              aria-label="Clear profile"
              title="Clear profile"
            >
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <span className="text-gray-400" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="relative flex items-center justify-center w-16 h-16 overflow-hidden text-sm font-semibold rounded-full bg-neutral-200 dark:bg-slate-800 text-neutral-700 dark:text-slate-200">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={name ? `${name} avatar` : "Profile avatar"} className="object-cover w-full h-full" />
                ) : (
                  <span aria-hidden="true">{initials || " "}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col">
                  <div className="text-base font-semibold truncate text-neutral-900 dark:text-slate-100">{name || "Your name"}</div>
                  <div className="text-sm truncate text-neutral-500 dark:text-slate-400">{desiredPosition || "Desired position"}</div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 rounded-full bg-emerald-500" />} text={email} href={email ? `mailto:${email}` : undefined} ariaLabel="Email" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />} text={phone} href={phone ? `tel:${phone}` : undefined} ariaLabel="Phone" />
                  <Chip icon={<span aria-hidden className="inline-block w-2 h-2 bg-blue-600 rounded-full" />} text={linkedin} href={linkedin || undefined} ariaLabel="LinkedIn" />
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

    return (
      <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <div className="flex items-center space-x-2">
            {isV1SectionsEnabled() ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    if (sectionType === "experience") setExperienceModalOpen(true);
                    else if (sectionType === "education") setEducationModalOpen(true);
                  } catch { /* noop */ }
                }}
                className="p-1 rounded bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
                aria-label={`Edit ${sectionType}`}
                title={`Edit ${sectionType}`}
              >
                <Pencil className="w-4 h-4" aria-hidden />
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
                className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
              >
                <span className="text-gray-400" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>
        
        

        {collapsed && (
          <div className="px-4 pb-3">
            {Array.isArray(section.structuredContent) && section.structuredContent.length > 0 ? (
              <div className="space-y-2">
                {(section.structuredContent as any[]).map((it, i) => {
                  const isExp = sectionType === "experience";
                  const title = isExp
                    ? String((it as any)?.position ?? (it as any)?.company ?? "—")
                    : String((it as any)?.degree ?? (it as any)?.institution ?? "—");
                  const org = isExp
                    ? String((it as any)?.company ?? "")
                    : String((it as any)?.institution ?? "");
                  const location = String((it as any)?.location ?? "");
                  const subtitle = [org, location].filter(Boolean).join(" • ");
                  const dates = formatRangeFromItem(it as any);
                  return (
                    <div key={String((it as any)?.id ?? i)} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-neutral-900 dark:text-slate-100">{title || "—"}</div>
                        <div className="text-xs truncate text-neutral-500 dark:text-slate-400">{subtitle || "\u00A0"}</div>
                      </div>
                      <div className="text-xs shrink-0 text-neutral-500 dark:text-slate-400">{dates}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-neutral-500">No entries</div>
            )}
          </div>
        )}

        {!collapsed && (
          <div className="p-4 space-y-4">
            {Array.isArray(section.blocks) && section.blocks.length > 0 ? (
              section.blocks.map((block) => (
                <div key={String(block.id)} className="p-0">
                  <BlockRenderer
                    sectionId={String(section.id)}
                    block={block as any}
                    onDelete={() => handleDeleteBlock(String(block.id))}
                    disableChevron={true}
                  />
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-neutral-500">No entries</div>
            )}
          </div>
        )}
        {/* Typed v1 modals for Experience/Education */}
        {isV1SectionsEnabled() && sectionType === "experience" ? (
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
        {isV1SectionsEnabled() && sectionType === "education" ? (
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
    <div className="mb-4 border border-gray-200 rounded-lg section-container dark:border-gray-700">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
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
           className="p-1 ml-2 rounded focus:outline-none focus:ring-2 focus:ring-offset-1"
         >
           <span className="text-gray-400" aria-hidden>
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
                  className="min-h-[80px] p-3 border border-dashed rounded prose max-w-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              }
            >
              <div>
                <EditorComponent />
              </div>
            </ErrorBoundary>
          </Remirror>
        </div>
      )}
    </div>
  );
}