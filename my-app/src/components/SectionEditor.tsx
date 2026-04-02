import { v4 as uuidv4 } from "uuid";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useAction } from "convex/react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  ParagraphExtension,
} from "remirror/extensions";
import { TextSelection } from "prosemirror-state";
import { EditorToolbar } from "./remirror-editor/components/EditorToolbar";
import {
  ensureRemirrorDoc,
  remirrorDocToSection,
} from "./remirror-editor/utils/conversion";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { useCvAiCapabilities } from "../hooks/use-cv-ai-capabilities";
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
import {
  Pencil,
  Trash,
  X,
  Pin,
  PinOff,
  Plus,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wand2,
} from "@/lib/icons";
import {
  ExperienceModal,
  EducationModal,
} from "./structured-blocks/ExperienceEducationModal";
import FloatingAiToolbar, {
  type InlineAiActionId,
} from "./FloatingAiToolbar";

import { formatRangeFromItem } from "../lib/date-utils";
import { splitResponsibilitiesIntoBullets } from "../utils/cv/mapping-utils";
import {
  isExperienceRenderable,
  isEducationRenderable,
} from "../utils/cv/renderGuards";
import { docToPlainText } from "./remirror-editor/utils/text";
import { deepEqual } from "../utils/deepEqual";
import {
  getDomSelectionState,
  isInlineAiToolbarActiveElement,
} from "../lib/editor-ai-selection";
import { useToast } from "./ui/toast";

/**
 * Simple uid helper used for generating new block/entry ids locally.
 * Matches the lightweight uid pattern used elsewhere in the project.
 */

import type { RemirrorJSON } from "remirror";
import type {
  CvSection,
  IExperienceItem,
  IEducationItem,
  IProfileItem,
  ISummaryItem,
  ISkillItem,
  ILanguageItem,
  Level,
} from "../types/cvDocument";

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

type InlineEditorSelectionState = {
  text: string;
  anchor: { left: number; top: number; bottom: number };
  from: number;
  to: number;
};

type SectionAiMenuState =
  | { type: "summary" }
  | { type: "skills" }
  | { type: "languages" }
  | { type: "experience"; itemId: string }
  | null;

type TextDiffState = {
  oldText: string;
  newText: string;
};

type ExperienceDiffState = {
  itemId: string;
  title: string;
  oldItems: string[];
  newItems: string[];
};

function plainTextFromStructuredValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value && typeof value === "object") {
    try {
      return docToPlainText(value as any).trim();
    } catch {
      return "";
    }
  }

  return "";
}

function buildBulletListDoc(items: string[]): RemirrorJSON {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);

  if (cleanItems.length === 0) {
    return ensureRemirrorDoc(undefined as any);
  }

  return {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: cleanItems.map((item) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: item }],
            },
          ],
        })),
      },
    ],
  } as RemirrorJSON;
}

function getExperienceBulletLines(item: any): string[] {
  const responsibilitiesText = plainTextFromStructuredValue(
    item?.responsibilities,
  );
  const responsibilityBullets = Array.isArray(item?.responsibilityBullets)
    ? (item.responsibilityBullets as unknown[])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    : splitResponsibilitiesIntoBullets(responsibilitiesText);
  const achievements = Array.isArray(item?.achievements)
    ? (item.achievements as unknown[])
        .map((value) =>
          typeof value === "string"
            ? value.trim()
            : typeof (value as any)?.text === "string"
              ? (value as any).text.trim()
              : "",
        )
        .filter(Boolean)
    : [];

  return responsibilityBullets.length > 0 ? responsibilityBullets : achievements;
}

function buildExperienceAiSourceText(item: any): string {
  const bits = [
    typeof item?.position === "string" && item.position.trim()
      ? `Role: ${item.position.trim()}`
      : null,
    typeof item?.company === "string" && item.company.trim()
      ? `Company: ${item.company.trim()}`
      : null,
    typeof item?.location === "string" && item.location.trim()
      ? `Location: ${item.location.trim()}`
      : null,
    typeof item?.description === "string" && item.description.trim()
      ? `Description: ${item.description.trim()}`
      : null,
    plainTextFromStructuredValue(item?.responsibilities)
      ? `Responsibilities: ${plainTextFromStructuredValue(item?.responsibilities)}`
      : null,
  ].filter(Boolean);
  const bullets = getExperienceBulletLines(item);

  if (bullets.length > 0) {
    bits.push(`Bullets:\n- ${bullets.join("\n- ")}`);
  }

  return bits.join("\n");
}

function normalizeSkillName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function dedupeStringList(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    const clean = item.trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }

  return next;
}

function formatDiffValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.map((line) => `• ${line}`).join("\n");
  }

  return value.trim();
}

function CvAiDiffCard({
  label,
  before,
  after,
  onAccept,
  onDiscard,
  isApplying = false,
}: {
  label: string;
  before: string | string[];
  after: string | string[];
  onAccept: () => void;
  onDiscard: () => void;
  isApplying?: boolean;
}) {
  return (
    <div
      style={{
        margin: "0 var(--s3) var(--s3)",
        padding: "var(--s3)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
        background: "var(--sfr)",
        display: "grid",
        gap: "var(--s2)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "var(--tx)",
          fontWeight: 600,
          color: "var(--ti)",
        }}
      >
        {label}
      </p>
      <div
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          fontSize: "var(--tx)",
          lineHeight: "var(--lx)",
          color: "var(--tm2)",
          textDecoration: "line-through",
        }}
      >
        {formatDiffValue(before) || "No existing content."}
      </div>
      <div
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          fontSize: "var(--tx)",
          lineHeight: "var(--lx)",
          color: "var(--ti)",
        }}
      >
        {formatDiffValue(after)}
      </div>
      <div
        style={{
          display: "flex",
          gap: "var(--s2)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="dasti-button dasti-button--accent dasti-button--sm"
          onClick={onAccept}
          disabled={isApplying}
        >
          Accept
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--sm"
          onClick={onDiscard}
          disabled={isApplying}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

function CvSuggestionRow({
  label,
  items,
  isLoading,
  hasRequested,
  emptyLabel,
  onAccept,
  onDismiss,
}: {
  label: string;
  items: string[];
  isLoading: boolean;
  hasRequested: boolean;
  emptyLabel: string;
  onAccept: (value: string) => void;
  onDismiss: (value: string) => void;
}) {
  if (!isLoading && !hasRequested && items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        padding: "0 var(--s3) var(--s3)",
        display: "grid",
        gap: "var(--s2)",
      }}
    >
      <div
        style={{
          fontSize: "var(--tx)",
          color: "var(--tm2)",
          lineHeight: "var(--lx)",
        }}
      >
        {label}
      </div>
      {isLoading ? (
        <div
          className="dasti-pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s2)",
            width: "fit-content",
          }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          <span>Generating suggestions…</span>
        </div>
      ) : items.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--s2)",
          }}
        >
          {items.map((item) => (
            <div
              key={item}
              className="dasti-pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s1)",
                background:
                  "color-mix(in srgb, var(--sf1) 88%, transparent)",
                borderStyle: "dashed",
              }}
            >
              <span style={{ color: "var(--ti)" }}>{item}</span>
              <button
                type="button"
                onClick={() => onAccept(item)}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label={`Add suggested item ${item}`}
                title={`Add ${item}`}
              >
                <Plus className="w-3 h-3" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onDismiss(item)}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label={`Dismiss suggested item ${item}`}
                title={`Dismiss ${item}`}
              >
                <X className="w-3 h-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: "var(--tx)",
            color: "var(--tg2)",
            lineHeight: "var(--lx)",
          }}
        >
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

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
    borderRadius: "var(--radius-pill)",
    border: "1px solid",
    borderColor: filled ? "var(--ac)" : "var(--color-border-strong)",
    background: filled ? "var(--ac)" : "transparent",
    flexShrink: 0,
    pointerEvents: "none",
  });

  return (
    <div className="inline-flex items-center gap-2 min-w-0">
      <div
        className="flex items-center gap-0"
        role={readOnly ? undefined : "group"}
        aria-label={ariaLabel}
      >
        {levels.map((level, index) => {
          const filled = index <= activeIndex;

          if (readOnly) {
            return (
              <span
                key={level.label}
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                }}
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
      <span
        style={{
          fontSize: "var(--tx)",
          color: "var(--tm2)",
          whiteSpace: "nowrap",
          lineHeight: "var(--lx)",
        }}
      >
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
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
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

const EntryRemirror = forwardRef<
  EntryRemirrorHandle,
  {
    initialContent?: RemirrorJSON | undefined;
    onPersist?: (json: RemirrorJSON) => void;
  }
>(({ initialContent, onPersist }, ref) => {
  const extensions = useMemo(() => createExtensions(), []);
  const initial = useRef<RemirrorJSON>(
    ensureRemirrorDoc(initialContent as any),
  ).current;

  const {
    manager: localManager,
    state: localState,
    onChange: localOnChange,
  } = useRemirror({
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
    [localOnChange],
  );

  return (
    <div className="p-2 [background:var(--sfr)] border [border-color:var(--color-border)] rounded">
      <Remirror
        manager={localManager}
        initialContent={localState}
        onChange={handleChange}
      >
        <EditorComponent />
      </Remirror>
    </div>
  );
});

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
  const { showToast } = useToast();
  const cvAiCapabilities = useCvAiCapabilities();
  // Add logging to track re-renders (debug gated)
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        (window as any).__CV_EDITOR_DEBUG__ === true
      ) {
        // eslint-disable-next-line no-console
        console.log("[SectionEditor] render", {
          sectionId: section.id,
          title: section.title,
        });
      }
    } catch {
      /* noop */
    }
  });

  // Mount/unmount diagnostics with stable mount id to correlate with register/unregister churn
  const mountIdRef = useRef<string>(uuidv4());
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true
    ) {
      // eslint-disable-next-line no-console
      console.debug("[SectionEditor] mount", {
        mountId: mountIdRef.current,
        sectionId: section.id,
      });
    }
    return () => {
      if (
        typeof window !== "undefined" &&
        (window as any).__CV_EDITOR_DEBUG__ === true
      ) {
        // eslint-disable-next-line no-console
        console.debug("[SectionEditor] unmount", {
          mountId: mountIdRef.current,
          sectionId: section.id,
        });
      }
    };
    // we intentionally leave deps empty to log physical mount/unmounts only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extensions = useMemo(() => createExtensions(), []);
  const titleInputId = useMemo(
    () => `section-title-${section.id}`,
    [section.id],
  );
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const showCvAiActionError = useCallback(
    (actionLabel: string, error: unknown) => {
      console.error(`[SectionEditor] ${actionLabel} failed`, error);
      const rawMessage =
        error instanceof Error ? error.message : String(error ?? "");
      showToast("CV AI unavailable", {
        variant: "error",
        description: /ArgumentValidationError/i.test(rawMessage)
          ? "The CV AI backend schema is stale. Run `npx convex codegen` or restart `npx convex dev`, then reload the page."
          : `The ${actionLabel} action failed.`,
      });
    },
    [showToast],
  );
  const showCvAiRefreshToast = useCallback(() => {
    showToast("CV AI unavailable", {
      variant: "warning",
      description: cvAiCapabilities.staleMessage,
    });
  }, [cvAiCapabilities.staleMessage, showToast]);

  // Initialize safe JSON content once at mount to avoid remounts stomping caret.
  const initialContentRef = useRef<RemirrorJSON>(
    ensureRemirrorDoc((section as any).content as any),
  );
  function sanitizeRemirrorDoc(doc: RemirrorJSON | undefined): RemirrorJSON {
    if (
      !doc ||
      typeof doc !== "object" ||
      !Array.isArray((doc as any).content)
    ) {
      return {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: " " }] },
        ],
      } as RemirrorJSON;
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
          if (cloned.type === "paragraph" || cloned.type === "heading")
            cloned.content = [{ type: "text", text: " " }];
        }
      }
      return cloned;
    }
    try {
      return {
        ...doc,
        content: (doc as any).content.map(sanitizeNode),
      } as RemirrorJSON;
    } catch {
      return {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: " " }] },
        ],
      } as RemirrorJSON;
    }
  }

  // Extract plain text from a Remirror JSON document (single-line preview)
  function extractPlainTextLocal(
    json: RemirrorJSON | undefined | null,
  ): string {
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

  const safeContent = useRef<RemirrorJSON>(
    sanitizeRemirrorDoc(initialContentRef.current),
  ).current;

  const {
    manager,
    state,
    onChange: remirrorOnChange,
  } = useRemirror({
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
    if (
      typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true
    ) {
      // eslint-disable-next-line no-console
      console.log(
        "[SectionEditor] section.title changed",
        section.title,
        collapsed,
      );
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
  }, [
    manager,
    onContentChange,
    onTitleChange,
    section.id,
    section.title,
    localTitle,
    flushAllNestedEditors,
  ]);
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
    [remirrorOnChange, embedded, onContentChange, manager, section?.id],
  );

  const focusEditorAtEnd = useCallback(() => {
    try {
      const view = (manager as any)?.view;
      // If the section title input currently has focus, do not steal focus for the editor.
      try {
        const titleEl = titleInputRef.current;
        if (
          titleEl &&
          typeof document !== "undefined" &&
          document.activeElement === titleEl
        )
          return;
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
      const externalDoc = sanitizeRemirrorDoc(
        ensureRemirrorDoc((section as any).content as any),
      );
      // Create a new EditorState via manager and update the view atomically
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newState = (manager as any).createState
        ? (manager as any).createState({ content: externalDoc as any })
        : undefined;
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
    if (
      sectionType === "text" &&
      typeof section.title === "string" &&
      section.title.trim().toLowerCase() === "achievements"
    )
      sectionType = "achievements";
  } catch {
    /* noop */
  }

  // Determine whether v1 rendering should be active for this document.
  // Use the canonical runtime detector from CvLibraryContext.
  const {
    isV1Active,
    selectedInspector,
    closeInspector,
    updateStructuredItem,
    currentCv,
    reorderSections,
  } = useCvLibrary();
  const transformEditorSelectionAction = useAction(
    (api.functions as any).transformEditorSelection,
  );
  const runCvSectionAiAction = useAction(
    (api.functions as any).runCvSectionAiAction,
  );
  const [inlineSelectionState, setInlineSelectionState] =
    useState<InlineEditorSelectionState | null>(null);
  const [isApplyingInlineAi, setIsApplyingInlineAi] = useState(false);
  const [pendingInlineAiActionId, setPendingInlineAiActionId] =
    useState<InlineAiActionId | null>(null);
  const inlineSelectionDebounceRef = useRef<number | null>(null);
  const [sectionAiMenu, setSectionAiMenu] = useState<SectionAiMenuState>(null);
  const sectionAiMenuRef = useRef<HTMLDivElement | null>(null);
  const [sectionAiLoadingKey, setSectionAiLoadingKey] = useState<string | null>(
    null,
  );
  const [summaryAiDiff, setSummaryAiDiff] = useState<TextDiffState | null>(
    null,
  );
  const [skillsAiSuggestions, setSkillsAiSuggestions] = useState<string[]>([]);
  const [skillsAiExcluded, setSkillsAiExcluded] = useState<string[]>([]);
  const [skillsAiRefillCount, setSkillsAiRefillCount] = useState(0);
  const [skillsAiRequested, setSkillsAiRequested] = useState(false);
  const [languagesAiSuggestions, setLanguagesAiSuggestions] = useState<
    string[]
  >([]);
  const [languagesAiExcluded, setLanguagesAiExcluded] = useState<string[]>([]);
  const [languagesAiRefillCount, setLanguagesAiRefillCount] = useState(0);
  const [languagesAiRequested, setLanguagesAiRequested] = useState(false);
  const [experienceAiDiff, setExperienceAiDiff] =
    useState<ExperienceDiffState | null>(null);

  useEffect(() => {
    return () => {
      if (inlineSelectionDebounceRef.current !== null) {
        window.clearTimeout(inlineSelectionDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sectionAiMenu) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (sectionAiMenuRef.current?.contains(event.target as Node)) return;
      setSectionAiMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSectionAiMenu(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sectionAiMenu]);

  useEffect(() => {
    setSkillsAiSuggestions([]);
    setSkillsAiExcluded([]);
    setSkillsAiRefillCount(0);
    setSkillsAiRequested(false);
    setLanguagesAiSuggestions([]);
    setLanguagesAiExcluded([]);
    setLanguagesAiRefillCount(0);
    setLanguagesAiRequested(false);
  }, [section.id]);

  const scheduleInlineSelectionCheck = useCallback(() => {
    if (inlineSelectionDebounceRef.current !== null) {
      window.clearTimeout(inlineSelectionDebounceRef.current);
    }

    inlineSelectionDebounceRef.current = window.setTimeout(() => {
      inlineSelectionDebounceRef.current = null;
      const view = (manager as any)?.view;
      const selection = view?.state?.selection;
      const nextSelection = getDomSelectionState(view?.dom as HTMLElement | null);

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
    }, 90);
  }, [manager]);

  useEffect(() => {
    const handleSelectionChange = () => {
      scheduleInlineSelectionCheck();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [scheduleInlineSelectionCheck]);

  const handleRunInlineAiAction = useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!inlineSelectionState) return;

      const view = (manager as any)?.view;
      if (!view) return;

      try {
        setPendingInlineAiActionId(actionId);
        setIsApplyingInlineAi(true);
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: inlineSelectionState.text,
        });
        const replacementText =
          typeof result?.text === "string" ? result.text.trim() : "";

        if (!replacementText) {
          return;
        }

        const tr = view.state.tr.insertText(
          replacementText,
          inlineSelectionState.from,
          inlineSelectionState.to,
        );
        view.dispatch(tr);
        view.focus();
        setInlineSelectionState(null);
        onContentChange?.(String(section.id), view.state.doc.toJSON());
      } finally {
        setIsApplyingInlineAi(false);
        setPendingInlineAiActionId(null);
      }
    },
    [
      inlineSelectionState,
      manager,
      onContentChange,
      section.id,
      transformEditorSelectionAction,
    ],
  );

  const currentCvSkills = useMemo(() => {
    if (!currentCv) return [] as string[];

    const names = currentCv.sections.flatMap((candidate) => {
      if (String(candidate.type) !== "skills") return [] as string[];
      if (!Array.isArray(candidate.structuredContent)) return [] as string[];

      return (candidate.structuredContent as any[])
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : typeof item?.name === "string"
              ? item.name.trim()
              : "",
        )
        .filter(Boolean);
    });

    return dedupeStringList(names);
  }, [currentCv]);

  const currentCvExperiences = useMemo(() => {
    if (!currentCv) {
      return [] as Array<{
        company?: string;
        position?: string;
        description?: string;
        bullets?: string[];
      }>;
    }

    return currentCv.sections.flatMap((candidate) => {
      if (String(candidate.type) !== "experience") return [];
      if (!Array.isArray(candidate.structuredContent)) return [];

      return (candidate.structuredContent as any[])
        .filter((item) => isExperienceRenderable(item))
        .map((item) => ({
          company:
            typeof item?.company === "string" ? item.company.trim() : undefined,
          position:
            typeof item?.position === "string"
              ? item.position.trim()
              : undefined,
          description:
            plainTextFromStructuredValue(item?.responsibilities) ||
            plainTextFromStructuredValue(item?.description) ||
            undefined,
          bullets: getExperienceBulletLines(item),
        }));
    });
  }, [currentCv]);

  const currentCvEducations = useMemo(() => {
    if (!currentCv) {
      return [] as Array<{
        institution?: string;
        degree?: string;
        fieldOfStudy?: string;
        description?: string;
      }>;
    }

    return currentCv.sections.flatMap((candidate) => {
      if (String(candidate.type) !== "education") return [];
      if (!Array.isArray(candidate.structuredContent)) return [];

      return (candidate.structuredContent as any[])
        .filter((item) => isEducationRenderable(item))
        .map((item) => ({
          institution:
            typeof item?.institution === "string"
              ? item.institution.trim()
              : undefined,
          degree:
            typeof item?.degree === "string" ? item.degree.trim() : undefined,
          fieldOfStudy:
            typeof item?.fieldOfStudy === "string"
              ? item.fieldOfStudy.trim()
              : undefined,
          description:
            plainTextFromStructuredValue(item?.description) || undefined,
        }));
    });
  }, [currentCv]);

  const currentCvLanguages = useMemo(() => {
    if (!currentCv) {
      return [] as Array<{ name?: string; level?: string }>;
    }

    return currentCv.sections.flatMap((candidate) => {
      if (String(candidate.type) !== "languages") return [];
      if (!Array.isArray(candidate.structuredContent)) return [];

      return (candidate.structuredContent as any[])
        .map((item) => ({
          name: typeof item?.name === "string" ? item.name.trim() : undefined,
          level: typeof item?.level === "string" ? item.level.trim() : undefined,
        }))
        .filter((item) => item.name || item.level);
    });
  }, [currentCv]);

  const currentCvSummaryText = useMemo(() => {
    if (!currentCv) return "";

    for (const candidate of currentCv.sections) {
      if (String(candidate.type) !== "summary") continue;
      if (!Array.isArray(candidate.structuredContent)) continue;
      const first = candidate.structuredContent[0] as
        | { summary?: unknown }
        | undefined;
      return plainTextFromStructuredValue(first?.summary);
    }

    return "";
  }, [currentCv]);

  const handleRemoveSection = useCallback(() => {
    if (!currentCv || typeof reorderSections !== "function") return;
    const nextSections = (currentCv.sections ?? []).filter(
      (candidate) => String(candidate.id) !== String(section.id),
    );
    closeInspector?.();
    reorderSections(nextSections as CvSection[]);
  }, [closeInspector, currentCv, reorderSections, section.id]);

  const renderAiMenuTrigger = useCallback(
    (args: {
      menu: Exclude<SectionAiMenuState, null>;
      isLoading: boolean;
      title: string;
      items: Array<{
        label: string;
        onClick: () => void;
        disabled?: boolean;
      }>;
    }) => {
      const isOpen =
        sectionAiMenu?.type === args.menu.type &&
        ("itemId" in args.menu
          ? (sectionAiMenu as any)?.itemId === args.menu.itemId
          : true);

      return (
        <div
          style={{ position: "relative" }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="dasti-icon-button cv-section-edit-trigger"
            aria-label={args.title}
            title={args.title}
            onClick={(event) => {
              event.stopPropagation();
              setSectionAiMenu(isOpen ? null : args.menu);
            }}
            disabled={args.isLoading}
          >
            {args.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="w-4 h-4" strokeWidth={1.6} aria-hidden />
            )}
          </button>

          {isOpen ? (
            <div
              ref={sectionAiMenuRef}
              style={{
                position: "absolute",
                top: "calc(100% + var(--s2))",
                right: 0,
                zIndex: 40,
                minWidth: 220,
                display: "grid",
                gap: "var(--s1)",
                padding: "var(--s2)",
                borderRadius: "var(--rm, var(--radius-control))",
                border: "1px solid var(--color-border)",
                background: "var(--sfr)",
                boxShadow: "var(--shb, var(--shc))",
              }}
            >
              {args.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="dasti-button dasti-button--secondary dasti-button--sm"
                  style={{ justifyContent: "flex-start" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onClick();
                  }}
                  disabled={args.isLoading || item.disabled}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );
    },
    [sectionAiMenu],
  );

  // Dev-only runtime diagnostics: log which branch we will render for this section.

  // Hybrid profile editor: collapsed card + dedicated modal for structured fields
  const [isProfileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  // Summary modal editor (Remirror)
  const [isSummaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);
  // Skills modal editor
  const [isSkillsModalOpen, setSkillsModalOpen] = useState<boolean>(false);
  // Experience/Education modals (typed v1)
  const [isExperienceModalOpen, setExperienceModalOpen] =
    useState<boolean>(false);
  const [isEducationModalOpen, setEducationModalOpen] =
    useState<boolean>(false);
  const [expandedStructuredPreviewIds, setExpandedStructuredPreviewIds] =
    useState<Record<string, boolean>>({});
  const [expandedStructuredSectionIds, setExpandedStructuredSectionIds] =
    useState<Record<string, boolean>>({});
  const [structuredPreviewOverride, setStructuredPreviewOverride] =
    useState<CvSection | null>(null);
  // Skills drawer (Phase 2 skeleton)
  const [isSkillsDrawerOpen, setSkillsDrawerOpen] = useState<boolean>(false);
  const [isProfilePhotoDragActive, setIsProfilePhotoDragActive] =
    useState<boolean>(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // (moved) The flush-related hooks and refs were moved higher up in the component
  // to resolve TypeScript declaration errors and to support the stable-ref pattern for registration.

  useEffect(() => {
    if (!structuredPreviewOverride) return;
    if (String(structuredPreviewOverride.id) !== String(section.id)) {
      setStructuredPreviewOverride(null);
      return;
    }
    if (
      deepEqual(
        structuredPreviewOverride.structuredContent,
        section.structuredContent,
      ) &&
      deepEqual(structuredPreviewOverride.blocks, section.blocks)
    ) {
      setStructuredPreviewOverride(null);
    }
  }, [section, structuredPreviewOverride]);

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
        title: "New block",
        type: "text" as const,
        content: ensureRemirrorDoc(""),
      };
      const nextBlocks = [
        ...(Array.isArray(section.blocks) ? section.blocks : []),
        newBlock,
      ];
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
  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
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
        const target = Array.isArray(section.blocks)
          ? section.blocks.find((b: any) => String(b.id) === String(blockId))
          : null;
        const linkedId =
          (target as any)?.attributes?.linkedStructuredId ??
          (target as any)?.attributes?.linkedstructuredid;
        const nextBlocks = (
          Array.isArray(section.blocks) ? section.blocks : []
        ).filter((b: any) => {
          if (linkedId) {
            const linked =
              (b as any).attributes?.linkedStructuredId ??
              (b as any).attributes?.linkedstructuredid;
            return String(linked) !== String(linkedId);
          }
          return String(b.id) !== String(blockId);
        });
        const nextStructured =
          linkedId && Array.isArray(section.structuredContent)
            ? (section.structuredContent as any[]).filter(
                (it) => String(it.id) !== String(linkedId),
              )
            : section.structuredContent;
        const updatedSection = {
          ...section,
          blocks: nextBlocks as any,
          structuredContent: nextStructured as any,
        };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    },
    [section, index, onChange, flushAllNestedEditors],
  );

  if (sectionType === "summary") {
    // Always render the structured SummaryBlock UI and ignore any legacy blocks.
    // Persist changes via context-level structured update to avoid relying on parent onChange.
    const summaryItem =
      Array.isArray(section.structuredContent) && section.structuredContent.length > 0
        ? (section.structuredContent[0] as ISummaryItem)
        : null;
    const summaryText = plainTextFromStructuredValue(summaryItem?.summary);

    function handleSummaryPersist(updatedSection: CvSection) {
      try {
        const scFirst = Array.isArray(updatedSection.structuredContent)
          ? (updatedSection.structuredContent as any[])[0]
          : null;
        const itemId = String(scFirst?.id ?? `sum-${String(section.id)}-0`);
        // Patch all summary-related fields through structured update
        const { name, email, linkedin, address, summary } = (scFirst ??
          {}) as Record<string, any>;
        const patch: Record<string, any> = { name, email, linkedin, address };
        if (typeof onContentChange === "function" && updatedSection.id) {
          try {
            onContentChange(
              String(updatedSection.id),
              ensureRemirrorDoc(summary as any),
            );
          } catch {
            /* noop */
          }
        }
        updateStructuredItem(String(section.id), itemId, patch);
      } catch {
        /* noop */
      }
    }

    async function handleRunSummaryAi(
      action: "rewrite_summary_from_profile" | "improve_summary_text",
    ) {
      try {
        setSectionAiMenu(null);
        setSectionAiLoadingKey(`summary:${action}`);
        const result = await runCvSectionAiAction({
          action,
          existingText: summaryText,
          summary: summaryText,
          skills: currentCvSkills,
          experiences: currentCvExperiences,
          educations: currentCvEducations,
          languages: currentCvLanguages,
        });

        if (result?.kind !== "text" || typeof result?.text !== "string") {
          return;
        }

        const nextText = result.text.trim();
        if (!nextText) return;

        setSummaryAiDiff({
          oldText: summaryText,
          newText: nextText,
        });
      } finally {
        setSectionAiLoadingKey(null);
      }
    }

    return (
      <div className="mb-4 border [border-color:var(--color-border)] [border-radius:var(--radius-card)] section-container">
        <div className="section-container-header flex items-center justify-between">
          <h3 className="cv-section-heading">{section.title}</h3>
          <div className="dasti-icon-cluster dasti-icon-cluster--tight">
            {renderAiMenuTrigger({
              menu: { type: "summary" },
              isLoading: sectionAiLoadingKey?.startsWith("summary:") ?? false,
              title: "Summary AI actions",
              items: [
                {
                  label: "Draft from full profile",
                  onClick: () =>
                    void handleRunSummaryAi("rewrite_summary_from_profile"),
                },
                {
                  label: "Improve existing text",
                  onClick: () =>
                    void handleRunSummaryAi("improve_summary_text"),
                  disabled: summaryText.length === 0,
                },
              ],
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSummaryModalOpen(true);
              }}
              className="dasti-icon-button cv-section-edit-trigger"
              aria-label="Edit summary"
              title="Edit summary"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </button>
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

        {summaryAiDiff ? (
          <CvAiDiffCard
            label="Summary suggestion"
            before={summaryAiDiff.oldText}
            after={summaryAiDiff.newText}
            onAccept={() => {
              const itemId = String(
                summaryItem?.id ?? `sum-${String(section.id)}-0`,
              );
              const nextDoc = ensureRemirrorDoc(summaryAiDiff.newText);
              updateStructuredItem(String(section.id), itemId, {
                summary: nextDoc,
              });
              onContentChange?.(String(section.id), nextDoc);
              setSummaryAiDiff(null);
            }}
            onDiscard={() => setSummaryAiDiff(null)}
            isApplying={Boolean(sectionAiLoadingKey)}
          />
        ) : null}

        {collapsed && (
          <div
            className="cv-section-preview cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label="Edit summary"
            onClick={(e) => {
              e.stopPropagation();
              try {
                const sel =
                  typeof window !== "undefined" ? window.getSelection() : null;
                if (
                  sel &&
                  typeof sel.toString === "function" &&
                  sel.toString().length > 0
                )
                  return;
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
            <p className="cv-preview-empty cv-preview-text cv-preview-text--truncate cv-preview-text--muted">
              {(() => {
                try {
                  const sumItem =
                    Array.isArray(section.structuredContent) &&
                    section.structuredContent.length > 0
                      ? (section.structuredContent[0] as ISummaryItem)
                      : null;
                  const doc = ensureRemirrorDoc(
                    (sumItem as any)?.summary as any,
                  );
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
          <div className="cv-section-body cv-section-body--stack">
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
            item={summaryItem}
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
          return {
            id: `sk-${idx}-${String(section.id)}`,
            name: String(it),
            level: "Intermediate",
          };
        }
        const o = it as Partial<ISkillItem>;
        const name = typeof o.name === "string" ? o.name : "";
        const level = (o.level as ISkillItem["level"]) ?? "Intermediate";
        return {
          id: String(o.id ?? `sk-${idx}-${String(section.id)}`),
          name,
          level,
        };
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
        const updatedSection = {
          ...section,
          structuredContent: sanitized as any,
        };
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
      setSkillRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, name } : r)),
      );
    }

    function handleNameBlurInline(idx: number) {
      const row = skillRows[idx];
      if (!row) return;
      const name = String(row.name ?? "").trim();
      // Do not persist/clear an empty draft row on accidental blur — keep it editable.
      if (name.length === 0) return;
      persistRows(skillRows, String(row.id ?? idx));
    }

    function handleNameKeyDownInline(
      e: React.KeyboardEvent<HTMLInputElement>,
      idx: number,
    ) {
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
      const next = skillRows.map((r, i) =>
        i === idx ? { ...r, level: lvl } : r,
      );
      const row = next[idx];
      setSkillRows(next);
      // If the skill name is still empty, do not persist on level change to avoid
      // unintentionally removing the draft row (persist requires a name).
      if (String(row?.name ?? "").trim().length === 0) return;
      window.setTimeout(() => {
        persistRows(next, String(row?.id ?? idx));
      }, 0);
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
        const idx = skillRows.findIndex(
          (r) => String(r.id) === String(skillId),
        );
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
        const sc = Array.isArray(section.structuredContent)
          ? section.structuredContent
          : [];
        if (sc.length === 0) return;
        let nextStructured: any[];
        if (typeof sc[0] === "string") {
          const idx = items.findIndex(
            (it) => String(it.id) === String(skillId),
          );
          nextStructured = (sc as any[]).filter((_, i) => i !== idx);
        } else {
          nextStructured = (sc as any[]).filter(
            (it) => String((it as any).id ?? "") !== String(skillId),
          );
        }
        const updatedSection = {
          ...section,
          structuredContent: nextStructured as any,
        };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    async function requestSkillsSuggestions(excludeItems: string[] = []) {
      if (!cvAiCapabilities.isSupported("generate_skills_suggestions")) {
        setSkillsAiSuggestions([]);
        showCvAiRefreshToast();
        return;
      }

      try {
        setSectionAiMenu(null);
        setSectionAiLoadingKey("skills:generate");
        setSkillsAiRequested(true);
        const result = await runCvSectionAiAction({
          action: "generate_skills_suggestions",
          experiences: currentCvExperiences,
          educations: currentCvEducations,
          existingItems: dedupeStringList(
            skillRows.map((item) => String(item.name ?? "").trim()),
          ),
          excludeItems,
          maxItems: 6,
        });

        if (!result || result.kind !== "list" || !Array.isArray(result.items)) {
          setSkillsAiSuggestions([]);
          return;
        }

        const nextItems = dedupeStringList(
          result.items.map((item: unknown) => String(item ?? "").trim()),
        );
        const existingNames = new Set(
          skillRows
            .map((item) => normalizeSkillName(String(item.name ?? "")))
            .filter(Boolean),
        );
        const nextSuggestions = nextItems.filter(
          (item) =>
            !existingNames.has(normalizeSkillName(item)) &&
            !excludeItems.some(
              (candidate) =>
                normalizeSkillName(candidate) === normalizeSkillName(item),
            ),
        );
        setSkillsAiSuggestions(nextSuggestions);
      } catch (error) {
        setSkillsAiSuggestions([]);
        showCvAiActionError("skills suggestion", error);
      } finally {
        setSectionAiLoadingKey(null);
      }
    }

    function appendSuggestedSkill(name: string) {
      const cleanName = String(name ?? "").trim();
      if (!cleanName) return;
      const exists = skillRows.some(
        (row) =>
          normalizeSkillName(String(row.name ?? "")) ===
          normalizeSkillName(cleanName),
      );
      if (exists) return;

      const next = [
        ...skillRows,
        {
          id: `sk-${uuidv4()}`,
          name: cleanName,
          level: "Intermediate" as Level,
        },
      ];
      setSkillRows(next);
      persistRows(next, cleanName);
    }

    function handleAcceptSkillSuggestion(name: string) {
      const nextExcluded = dedupeStringList([...skillsAiExcluded, name]);
      setSkillsAiExcluded(nextExcluded);
      setSkillsAiSuggestions((current) =>
        current.filter(
          (candidate) =>
            normalizeSkillName(candidate) !== normalizeSkillName(name),
        ),
      );
      appendSuggestedSkill(name);
    }

    function handleDismissSkillSuggestion(name: string) {
      const remaining = skillsAiSuggestions.filter(
        (candidate) => normalizeSkillName(candidate) !== normalizeSkillName(name),
      );
      const nextExcluded = dedupeStringList([...skillsAiExcluded, name]);
      setSkillsAiExcluded(nextExcluded);
      setSkillsAiSuggestions(remaining);

      if (remaining.length === 0 && skillsAiRefillCount < 1) {
        setSkillsAiRefillCount(1);
        void requestSkillsSuggestions(nextExcluded);
      }
    }

    const canSuggestSkills = cvAiCapabilities.isSupported(
      "generate_skills_suggestions",
    );

    return (
      <div className="mb-4 section-container">
        <div className="section-container-header flex items-center justify-between">
          <h3 className="cv-section-heading">{section.title}</h3>
          <div className="flex items-center gap-1">
            {renderAiMenuTrigger({
              menu: { type: "skills" },
              isLoading: sectionAiLoadingKey === "skills:generate",
              title: "Skills AI actions",
              items: [
                {
                  label: "Suggest skills",
                  onClick: () => {
                    setSkillsAiExcluded([]);
                    setSkillsAiRefillCount(0);
                    void requestSkillsSuggestions([]);
                  },
                  disabled:
                    !canSuggestSkills ||
                    currentCvExperiences.length === 0 &&
                    currentCvEducations.length === 0,
                },
              ],
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddSkillInline();
              }}
              className="dasti-icon-button cv-section-edit-trigger"
              aria-label="Add skill"
              title="Add skill"
            >
              <Plus size={16} strokeWidth={1.7} aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {cvAiCapabilities.status === "stale" && !canSuggestSkills ? (
          <div
            className="dasti-hint"
            role="status"
            style={{ marginBottom: "var(--s2)" }}
          >
            {cvAiCapabilities.staleMessage}
          </div>
        ) : null}

        <CvSuggestionRow
          label="Suggested from experience and education"
          items={skillsAiSuggestions}
          isLoading={sectionAiLoadingKey === "skills:generate"}
          hasRequested={skillsAiRequested}
          emptyLabel="No new skill suggestions yet."
          onAccept={handleAcceptSkillSuggestion}
          onDismiss={handleDismissSkillSuggestion}
        />

        {collapsed && (
          <div className="cv-section-preview">
            <div className="flex flex-wrap gap-2">
              {items.length === 0 ? (
                <span className="cv-preview-empty cv-preview-text cv-preview-text--muted">
                  No skills yet
                </span>
              ) : (
                items.map((s) => (
                  <span
                    key={s.id}
                    className="card-group inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]"
                    aria-label={`${s.name} ${s.level}`}
                  >
                    <span className="font-medium [color:var(--ti)]">
                      {s.name}
                    </span>
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
                      className="card-delete-btn dasti-icon-button dasti-icon-button--compact ml-1"
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
            {skillRows.length === 0 ? (
              <div className="py-2 text-xs" style={{ color: "var(--tg2)" }}>
                Click + to add your first skill
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--color-border)]">
                {skillRows.map((row, idx) => (
                  <div
                    key={row.id ?? `row-${idx}`}
                    className="group grid items-center gap-3 py-2 min-w-0"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) calc(var(--s8) + var(--s8) + var(--s2)) calc(var(--s4) + var(--s4) + var(--s3))",
                    }}
                  >
                    <div className="min-w-0">
                      <label
                        className="sr-only"
                        htmlFor={`skill-name-inline-${idx}`}
                      >
                        Skill name
                      </label>
                      <input
                        id={`skill-name-inline-${idx}`}
                        className="w-full min-w-0 bg-transparent border-0 text-sm font-medium focus:outline-none"
                        style={{
                          color: "var(--ti)",
                          lineHeight: "var(--ls)",
                        }}
                        placeholder="Skill name"
                        value={row.name ?? ""}
                        onChange={(e) =>
                          handleNameChangeInline(idx, e.target.value)
                        }
                        onBlur={() => handleNameBlurInline(idx)}
                        onKeyDown={(e) => handleNameKeyDownInline(e, idx)}
                      />
                    </div>
                    <div className="min-w-0">
                      <LevelDots
                        value={row.level}
                        levels={SKILL_DOT_LEVELS}
                        kind="skill"
                        onChange={(lvl) => handleLevelChangeInline(idx, lvl)}
                        ariaLabel={`Skill level for ${row.name || `row ${idx + 1}`}`}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() =>
                          handlePinToCoreInline(String(row.id ?? idx))
                        }
                        className="dasti-icon-button dasti-icon-button--compact"
                        aria-label={
                          idx === 0
                            ? `${row.name || "skill"} is pinned to top`
                            : `Pin ${row.name || "skill"} to top`
                        }
                        title={idx === 0 ? "Pinned to top" : "Pin to top"}
                        style={idx === 0 ? { color: "var(--ac)" } : undefined}
                      >
                        {idx === 0 ? (
                          <PinOff className="w-3 h-3" aria-hidden />
                        ) : (
                          <Pin className="w-3 h-3" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveSkillInline(String(row.id ?? idx))
                        }
                        className="dasti-icon-button dasti-icon-button--compact"
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
          suggestedItems={skillsAiSuggestions}
          onAcceptSuggestion={(name) => {
            setSkillsAiSuggestions((current) =>
              current.filter(
                (candidate) =>
                  normalizeSkillName(candidate) !== normalizeSkillName(name),
              ),
            );
          }}
          onDismissSuggestion={(name) => {
            setSkillsAiSuggestions((current) =>
              current.filter(
                (candidate) =>
                  normalizeSkillName(candidate) !== normalizeSkillName(name),
              ),
            );
          }}
          onClose={() => setSkillsModalOpen(false)}
          onSave={(next) => {
            try {
              const updatedSection = {
                ...section,
                structuredContent: next as any,
              };
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
              const updatedSection = {
                ...section,
                structuredContent: next as any,
              };
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
          return {
            id: `lang-${idx}-${String(section.id)}`,
            name: String(it),
            level: "Intermediate",
          };
        }
        const o = it as Partial<ILanguageItem>;
        const name = typeof o.name === "string" ? o.name : "";
        const level = (o.level as ILanguageItem["level"]) ?? "Intermediate";
        return {
          id: String(o.id ?? `lang-${idx}-${String(section.id)}`),
          name,
          level,
        };
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
          const active =
            typeof document !== "undefined"
              ? (document.activeElement as HTMLElement | null)
              : null;
          if (
            active &&
            active.id &&
            active.id.startsWith("language-name-inline-")
          ) {
            return;
          }
        } catch {
          // ignore focus detection errors
        }
        lastLanguagesSeedRef.current = nextStr;

        // Parse server items and merge any local draft rows that contain non-empty names
        const parsed = JSON.parse(nextStr) as ILanguageItem[];
        const localDrafts = (languageRowsRef.current ?? []).filter(
          (r) => String(r.name ?? "").trim().length > 0,
        );

        const merged: ILanguageItem[] = [...parsed];
        for (const d of localDrafts) {
          const exists = merged.some(
            (p) =>
              String(p.id ?? "") === String(d.id ?? "") ||
              String(p.name ?? "")
                .trim()
                .toLowerCase() ===
                String(d.name ?? "")
                  .trim()
                  .toLowerCase(),
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
        const updatedSection = {
          ...section,
          structuredContent: sanitized as any,
        };
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
        const next = languageRows.filter(
          (r) => String(r.id) !== String(langId),
        );
        setLanguageRows(next);
        persistLanguageRows(next, langId);
      } catch {
        /* noop */
      }
    }

    function handleNameChangeLanguage(idx: number, name: string) {
      setLanguageRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, name } : r)),
      );
    }

    function handleNameBlurLanguage(idx: number) {
      const row = languageRows[idx];
      if (!row) return;
      const name = String(row.name ?? "").trim();
      // Do not persist/clear an empty draft row on accidental blur — keep it editable.
      if (name.length === 0) return;
      persistLanguageRows(languageRows, String(row.id ?? idx));
    }

    function handleNameKeyDownLanguage(
      e: React.KeyboardEvent<HTMLInputElement>,
      idx: number,
    ) {
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
      const next = languageRows.map((r, i) =>
        i === idx ? { ...r, level: lvl } : r,
      );
      const row = next[idx];
      setLanguageRows(next);

      // If the row has a non-empty name we can persist; otherwise try to read the latest
      // value from the DOM input to avoid losing a freshly-typed name when user clicks level.
      const currentName = String(row?.name ?? "").trim();
      if (currentName.length === 0) {
        try {
          const input =
            typeof document !== "undefined"
              ? (document.getElementById(
                  `language-name-inline-${idx}`,
                ) as HTMLInputElement | null)
              : null;
          const domVal = input?.value ?? "";
          if (domVal.trim().length > 0) {
            next[idx] = { ...next[idx], name: domVal.trim() };
            window.setTimeout(() => {
              persistLanguageRows(next, String(next[idx].id ?? idx));
            }, 30);
          }
        } catch {
          /* noop */
        }
        return;
      }

      // Row already has a name; persist after a short delay to allow any pending input handlers to finish.
      window.setTimeout(() => {
        persistLanguageRows(next, String(row?.id ?? idx));
      }, 30);
    }

    // Collapsed view remove handler (chip remove)
    function handleRemoveLanguage(langId: string): void {
      try {
        const sc = Array.isArray(section.structuredContent)
          ? section.structuredContent
          : [];
        if (sc.length === 0) return;
        let nextStructured: any[];
        if (typeof sc[0] === "string") {
          const idx = items.findIndex((it) => String(it.id) === String(langId));
          nextStructured = (sc as any[]).filter((_, i) => i !== idx);
        } else {
          nextStructured = (sc as any[]).filter(
            (it) => String((it as any).id ?? "") !== String(langId),
          );
        }
        const updatedSection = {
          ...section,
          structuredContent: nextStructured as any,
        };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    async function requestLanguageSuggestions(excludeItems: string[] = []) {
      if (!cvAiCapabilities.isSupported("generate_language_suggestions")) {
        setLanguagesAiSuggestions([]);
        showCvAiRefreshToast();
        return;
      }

      try {
        setSectionAiMenu(null);
        setSectionAiLoadingKey("languages:generate");
        setLanguagesAiRequested(true);
        const result = await runCvSectionAiAction({
          action: "generate_language_suggestions",
          summary: currentCvSummaryText,
          experiences: currentCvExperiences,
          educations: currentCvEducations,
          existingItems: dedupeStringList(
            languageRows.map((item) => String(item.name ?? "").trim()),
          ),
          excludeItems,
          maxItems: 5,
        });

        if (!result || result.kind !== "list" || !Array.isArray(result.items)) {
          setLanguagesAiSuggestions([]);
          return;
        }

        const nextItems = dedupeStringList(
          result.items.map((item: unknown) => String(item ?? "").trim()),
        );
        const existingNames = new Set(
          languageRows
            .map((item) => normalizeSkillName(String(item.name ?? "")))
            .filter(Boolean),
        );
        const nextSuggestions = nextItems.filter(
          (item) =>
            !existingNames.has(normalizeSkillName(item)) &&
            !excludeItems.some(
              (candidate) =>
                normalizeSkillName(candidate) === normalizeSkillName(item),
            ),
        );
        setLanguagesAiSuggestions(nextSuggestions);
      } catch (error) {
        setLanguagesAiSuggestions([]);
        showCvAiActionError("language suggestion", error);
      } finally {
        setSectionAiLoadingKey(null);
      }
    }

    function appendSuggestedLanguage(name: string) {
      const cleanName = String(name ?? "").trim();
      if (!cleanName) return;
      const exists = languageRows.some(
        (row) =>
          normalizeSkillName(String(row.name ?? "")) ===
          normalizeSkillName(cleanName),
      );
      if (exists) return;

      const next = [
        ...languageRows,
        {
          id: `lang-${uuidv4()}`,
          name: cleanName,
          level: "Intermediate" as Level,
        },
      ];
      setLanguageRows(next);
      persistLanguageRows(next, cleanName);
    }

    function handleAcceptLanguageSuggestion(name: string) {
      const nextExcluded = dedupeStringList([...languagesAiExcluded, name]);
      setLanguagesAiExcluded(nextExcluded);
      setLanguagesAiSuggestions((current) =>
        current.filter(
          (candidate) =>
            normalizeSkillName(candidate) !== normalizeSkillName(name),
        ),
      );
      appendSuggestedLanguage(name);
    }

    function handleDismissLanguageSuggestion(name: string) {
      const remaining = languagesAiSuggestions.filter(
        (candidate) => normalizeSkillName(candidate) !== normalizeSkillName(name),
      );
      const nextExcluded = dedupeStringList([...languagesAiExcluded, name]);
      setLanguagesAiExcluded(nextExcluded);
      setLanguagesAiSuggestions(remaining);

      if (remaining.length === 0 && languagesAiRefillCount < 1) {
        setLanguagesAiRefillCount(1);
        void requestLanguageSuggestions(nextExcluded);
      }
    }

    const canSuggestLanguages = cvAiCapabilities.isSupported(
      "generate_language_suggestions",
    );

    return (
      <div className="mb-4 section-container section-container--dismissable">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveSection();
          }}
          className="dasti-section-dismiss-pill"
          aria-label="Delete language section"
          title="Delete language section"
        >
          <X size={13} strokeWidth={2.1} aria-hidden />
        </button>
        <div className="section-container-header flex items-center justify-between">
          <h3 className="cv-section-heading">{section.title}</h3>
          <div className="flex items-center gap-1">
            {renderAiMenuTrigger({
              menu: { type: "languages" },
              isLoading: sectionAiLoadingKey === "languages:generate",
              title: "Languages AI actions",
              items: [
                {
                  label: "Suggest languages",
                  onClick: () => {
                    setLanguagesAiExcluded([]);
                    setLanguagesAiRefillCount(0);
                    void requestLanguageSuggestions([]);
                  },
                  disabled:
                    !canSuggestLanguages ||
                    currentCvExperiences.length === 0 &&
                    currentCvEducations.length === 0 &&
                    currentCvSummaryText.length === 0,
                },
              ],
            })}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddLanguageInline();
              }}
              className="dasti-icon-button cv-section-edit-trigger"
              aria-label="Add language"
              title="Add language"
            >
              <Plus size={16} strokeWidth={1.7} aria-hidden />
            </button>
            {typeof onCollapseChange === "function" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollapseChange();
                }}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                className="p-1 rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                <span className="[color:var(--tg2)]" aria-hidden>
                  {collapsed ? "▶" : "▼"}
                </span>
              </button>
            )}
          </div>
        </div>

        {cvAiCapabilities.status === "stale" && !canSuggestLanguages ? (
          <div
            className="dasti-hint"
            role="status"
            style={{ marginBottom: "var(--s2)" }}
          >
            {cvAiCapabilities.staleMessage}
          </div>
        ) : null}

        <CvSuggestionRow
          label="Suggested from profile, experience, and education"
          items={languagesAiSuggestions}
          isLoading={sectionAiLoadingKey === "languages:generate"}
          hasRequested={languagesAiRequested}
          emptyLabel="No new language suggestions yet."
          onAccept={handleAcceptLanguageSuggestion}
          onDismiss={handleDismissLanguageSuggestion}
        />

        {collapsed && (
          <div className="cv-section-preview">
            <div className="flex flex-wrap gap-2">
              {items.length === 0 ? (
                <span className="cv-preview-empty cv-preview-text cv-preview-text--muted">
                  No languages yet
                </span>
              ) : (
                items.map((lng) => (
                  <span
                    key={lng.id}
                    className="card-group inline-flex items-center gap-2 px-2.5 py-1 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]"
                    aria-label={`${lng.name} ${lng.level}`}
                  >
                    <span className="font-medium [color:var(--ti)]">
                      {lng.name}
                    </span>
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
                      className="card-delete-btn dasti-icon-button dasti-icon-button--compact ml-1"
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
            {languageRows.length === 0 ? (
              <div className="py-2 text-xs" style={{ color: "var(--tg2)" }}>
                Click + to add your first language
              </div>
            ) : (
              <div className="divide-y divide-[color:var(--color-border)]">
                {languageRows.map((row, idx) => (
                  <div
                    key={row.id ?? `row-${idx}`}
                    className="group grid items-center gap-3 py-2 min-w-0"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) calc(var(--s8) + var(--s8) + var(--s2)) calc(var(--s4) + var(--s4))",
                    }}
                  >
                    <div className="min-w-0">
                      <label
                        className="sr-only"
                        htmlFor={`language-name-inline-${idx}`}
                      >
                        Language name
                      </label>
                      <input
                        id={`language-name-inline-${idx}`}
                        className="w-full min-w-0 bg-transparent border-0 text-sm font-medium focus:outline-none"
                        style={{
                          color: "var(--ti)",
                          lineHeight: "var(--ls)",
                        }}
                        placeholder="Language name"
                        value={row.name ?? ""}
                        onChange={(e) =>
                          handleNameChangeLanguage(idx, e.target.value)
                        }
                        onBlur={() => handleNameBlurLanguage(idx)}
                        onKeyDown={(e) => handleNameKeyDownLanguage(e, idx)}
                      />
                    </div>
                    <div className="min-w-0">
                      <LevelDots
                        value={row.level}
                        levels={LANGUAGE_DOT_LEVELS}
                        kind="language"
                        onChange={(lvl) => handleLevelChangeLanguage(idx, lvl)}
                        ariaLabel={`Language level for ${row.name || `row ${idx + 1}`}`}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveLanguageInline(String(row.id ?? idx))
                        }
                        className="dasti-icon-button dasti-icon-button--compact"
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
          onDeleteSection={handleRemoveSection}
        />
      </div>
    );
  }

  // Structured "profile" section: collapsed card + ProfileModal (no Remirror)
  if (sectionType === "profile") {
    const item = (
      Array.isArray(structured) && structured.length > 0 ? structured[0] : null
    ) as IProfileItem | null;
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

    function openProfileModal() {
      setProfileModalOpen(true);
    }

    function handleProfilePhotoFile(file: File) {
      if (!file || !itemId) return;
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const nextPhotoUrl =
          typeof reader.result === "string" ? reader.result : "";
        if (!nextPhotoUrl) return;
        updateStructuredItem(String(section.id), itemId, {
          photoUrl: nextPhotoUrl,
        });
      };
      reader.readAsDataURL(file);
    }

    function handleProfilePhotoChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;
      handleProfilePhotoFile(file);
    }

    function Chip({
      icon,
      text,
      href,
      ariaLabel,
    }: {
      icon: React.ReactNode;
      text: string;
      href?: string;
      ariaLabel: string;
    }) {
      if (!text) return null;
      const content = (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full [background:var(--sf2)] [color:var(--tm2)]">
          {icon}
          <span className="truncate max-w-[160px]">{text}</span>
        </span>
      );
      return href ? (
        <a
          className="rounded focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </a>
      ) : (
        <span aria-label={ariaLabel}>{content}</span>
      );
    }

    return (
      <div className="mb-4 border [border-color:var(--color-border)] [border-radius:var(--radius-card)] section-container">
        <div className="section-container-header flex items-center justify-between">
          <h3 className="cv-section-heading">{section.title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openProfileModal();
              }}
              className="dasti-icon-button cv-section-edit-trigger"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.5} aria-hidden />
            </button>
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
          <div
            className="cv-section-body cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label="Edit profile"
            onClick={(e) => {
              const target = e.target as HTMLElement | null;
              if (
                target &&
                target !== e.currentTarget &&
                target.closest("a, button, input, textarea, select")
              ) {
                return;
              }
              openProfileModal();
            }}
            onKeyDown={(e) => {
              const target = e.target as HTMLElement | null;
              if (
                target &&
                target !== e.currentTarget &&
                target.closest("a, button, input, textarea, select")
              ) {
                return;
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openProfileModal();
              }
            }}
          >
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
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfilePhotoPicker();
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsProfilePhotoDragActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "copy";
                    setIsProfilePhotoDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    ) {
                      setIsProfilePhotoDragActive(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsProfilePhotoDragActive(false);
                    const file = event.dataTransfer.files?.[0] ?? null;
                    if (file) {
                      handleProfilePhotoFile(file);
                    }
                  }}
                  className={`cv-photo-upload-trigger${isProfilePhotoDragActive ? " cv-photo-upload-trigger--drag" : ""} relative flex items-center justify-center overflow-hidden text-sm font-semibold border [border-radius:var(--radius-card)] focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]`}
                  style={{
                    width: "var(--s8)",
                    height: "calc(var(--s8) + var(--s4))",
                  }}
                  aria-label={
                    photoUrl ? "Change profile photo" : "Upload profile photo"
                  }
                >
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={name ? `${name} portrait` : "Profile portrait"}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="cv-photo-upload-trigger__empty">
                      <User
                        aria-hidden
                        strokeWidth={1.75}
                        className="cv-photo-upload-trigger__avatar"
                        style={{ width: "var(--s7)", height: "var(--s7)" }}
                      />
                    </span>
                  )}
                  <span
                    className="dasti-photo-upload-trigger__tooltip"
                    aria-hidden="true"
                  >
                    <strong>{photoUrl ? "Replace photo" : "Drop photo"}</strong>
                  </span>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="cv-preview-stack">
                  <div className="cv-profile-name cv-preview-text--truncate">
                    {name || "Your name"}
                  </div>
                  <div className="cv-profile-role cv-preview-text--truncate">
                    {desiredPosition || "Desired position"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Chip
                    icon={
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full [background:var(--ac)]"
                      />
                    }
                    text={email}
                    href={email ? `mailto:${email}` : undefined}
                    ariaLabel="Email"
                  />
                  <Chip
                    icon={
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full [background:var(--am)]"
                      />
                    }
                    text={phone}
                    href={phone ? `tel:${phone}` : undefined}
                    ariaLabel="Phone"
                  />
                  <Chip
                    icon={
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full [background:var(--ac)]"
                      />
                    }
                    text={linkedin}
                    href={linkedin || undefined}
                    ariaLabel="LinkedIn"
                  />
                  <Chip
                    icon={
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full [background:var(--ok)]"
                      />
                    }
                    text={website}
                    href={website || undefined}
                    ariaLabel="Website"
                  />
                  <Chip
                    icon={
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full [background:var(--tm2)]"
                      />
                    }
                    text={location}
                    ariaLabel="Location"
                  />
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

  if (
    Array.isArray(structured) &&
    (sectionType === "experience" || sectionType === "education")
  ) {
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
        const newEntry =
          sectionType === "experience"
            ? makeExperienceItem()
            : makeEducationItem();

        const nextStructured = Array.isArray(section.structuredContent)
          ? [...(section.structuredContent as any), newEntry]
          : [newEntry];
        const titleBase =
          sectionType === "experience"
            ? String((newEntry as IExperienceItem).company ?? "") ||
              `Experience`
            : String((newEntry as IEducationItem).institution ?? "") ||
              `Education`;
        const newBlock = {
          id: uuidv4(),
          title: titleBase,
          type: "text" as const,
          content: ensureRemirrorDoc(undefined as any),
          attributes: { linkedStructuredId: (newEntry as any).id },
        };

        const nextBlocks = [
          ...(Array.isArray(section.blocks) ? section.blocks : []),
          newBlock,
        ];
        const updatedSection = {
          ...section,
          structuredContent: nextStructured as any,
          blocks: nextBlocks as any,
        };
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
          const nextBlocks = (
            Array.isArray(section.blocks) ? section.blocks : []
          ).filter((_, i) => i !== idx);
          const updatedSection = {
            ...section,
            structuredContent: nextStructured as any,
            blocks: nextBlocks as any,
          };
          onChange(index, updatedSection as any);
          return;
        }

        // For object-structured entries (experience/education), item is expected to be an object with `id`
        const itemId = String(item?.id ?? "");
        const nextStructured = Array.isArray(section.structuredContent)
          ? (section.structuredContent as any[]).filter(
              (it) => String(it.id) !== itemId,
            )
          : [];
        const nextBlocks = (
          Array.isArray(section.blocks) ? section.blocks : []
        ).filter((b: any) => {
          const linked =
            (b as any).attributes?.linkedStructuredId ??
            (b as any).attributes?.linkedstructuredid;
          return String(linked) !== itemId;
        });
        const updatedSection = {
          ...section,
          structuredContent: nextStructured as any,
          blocks: nextBlocks as any,
        };
        onChange(index, updatedSection as any);
      } catch {
        /* noop */
      }
    }

    const structuredSection =
      structuredPreviewOverride &&
      String(structuredPreviewOverride.id) === String(section.id)
        ? structuredPreviewOverride
        : section;
    const usingStructuredPreviewOverride =
      Boolean(structuredPreviewOverride) &&
      String(structuredSection.id) === String(section.id);

    const structuredList = Array.isArray(structuredSection.structuredContent)
      ? (structuredSection.structuredContent as any[])
      : [];
    const guard =
      sectionType === "experience"
        ? isExperienceRenderable
        : isEducationRenderable;
    const renderableStructured = structuredList.filter((item) => guard(item));
    const hasRenderableStructured = renderableStructured.length > 0;
    const hasBlocks =
      Array.isArray(structuredSection.blocks) &&
      structuredSection.blocks.length > 0;
    const collapsedListExpanded = Boolean(
      expandedStructuredSectionIds[String(section.id)],
    );
    const sectionCanToggleEntries = hasBlocks
      ? structuredSection.blocks.length > 3
      : renderableStructured.length > 3;
    const visibleBlocks = hasBlocks
      ? collapsedListExpanded
        ? structuredSection.blocks
        : structuredSection.blocks.slice(0, 3)
      : [];
    const collapsedVisibleStructured = collapsedListExpanded
      ? renderableStructured
      : renderableStructured.slice(0, 3);

    function openStructuredModal() {
      try {
        if (sectionType === "experience") setExperienceModalOpen(true);
        else if (sectionType === "education") setEducationModalOpen(true);
      } catch {
        /* noop */
      }
    }

    function hasActiveSelection() {
      try {
        const selection =
          typeof window !== "undefined" ? window.getSelection() : null;
        return Boolean(
          selection &&
            typeof selection.toString === "function" &&
            selection.toString().length > 0,
        );
      } catch {
        return false;
      }
    }

    function commitStructuredSection(updatedSection: CvSection) {
      try {
        if (currentCv && typeof reorderSections === "function") {
          const nextSections = (currentCv.sections ?? []).map((s) =>
            String(s.id) === String(updatedSection.id)
              ? (updatedSection as CvSection)
              : s,
          );
          reorderSections(nextSections as CvSection[]);
          return;
        }
      } catch {
        /* noop */
      }
      onChange(index, updatedSection as any);
    }

    async function handleRunExperienceAi(rawItem: any) {
      const structuredId = String(rawItem?.id ?? "");
      if (!structuredId) return;

      try {
        setSectionAiMenu(null);
        setSectionAiLoadingKey(`experience:${structuredId}`);
        const result = await runCvSectionAiAction({
          action: "improve_experience_bullets",
          existingText: buildExperienceAiSourceText(rawItem),
        });

        if (!result || result.kind !== "list" || !Array.isArray(result.items)) {
          return;
        }

        const nextItems = dedupeStringList(
          result.items.map((item: unknown) => String(item ?? "").trim()),
        );
        if (nextItems.length === 0) return;

        setExperienceAiDiff({
          itemId: structuredId,
          title:
            String(rawItem?.position ?? "").trim() ||
            String(rawItem?.company ?? "").trim() ||
            "Experience entry",
          oldItems: getExperienceBulletLines(rawItem),
          newItems: nextItems,
        });
      } finally {
        setSectionAiLoadingKey(null);
      }
    }

    function applyExperienceAiDiff(diff: ExperienceDiffState) {
      const nextDoc = buildBulletListDoc(diff.newItems);
      const nextStructured = structuredList.map((item) =>
        String(item?.id ?? "") === diff.itemId
          ? {
              ...item,
              responsibilities: nextDoc,
              responsibilityBullets: diff.newItems,
              achievements: [],
            }
          : item,
      );

      let matchedBlock = false;
      const nextBlocks = (
        Array.isArray(structuredSection.blocks) ? structuredSection.blocks : []
      ).map((block: any) => {
        const linkedId =
          (block as any)?.attributes?.linkedStructuredId ??
          (block as any)?.attributes?.linkedstructuredid;

        if (String(linkedId) !== diff.itemId) {
          return block;
        }

        matchedBlock = true;
        const targetItem = nextStructured.find(
          (candidate) => String(candidate?.id ?? "") === diff.itemId,
        );
        return {
          ...block,
          title: String(
            targetItem?.position || targetItem?.company || "Experience",
          ),
          content: nextDoc,
          attributes: {
            ...((block as any)?.attributes ?? {}),
            linkedStructuredId: diff.itemId,
          },
        };
      });

      if (!matchedBlock) {
        const targetItem = nextStructured.find(
          (candidate) => String(candidate?.id ?? "") === diff.itemId,
        );
        nextBlocks.push({
          id: uuidv4(),
          title: String(
            targetItem?.position || targetItem?.company || "Experience",
          ),
          type: "text" as const,
          content: nextDoc,
          attributes: { linkedStructuredId: diff.itemId },
        });
      }

      const updatedSection = {
        ...structuredSection,
        structuredContent: nextStructured as any,
        blocks: nextBlocks as any,
      } as CvSection;

      setStructuredPreviewOverride(updatedSection);
      commitStructuredSection(updatedSection);
      setExperienceAiDiff(null);
    }

    const renderStructuredPreview = (
      rawItem: any,
      idx: number,
      variant: "compact" | "detailed",
    ) => {
      const structuredId = String(rawItem?.id ?? idx);
      const isExp = sectionType === "experience";
      const previewExpanded =
        variant === "detailed" ||
        Boolean(expandedStructuredPreviewIds[structuredId]);
      const trim = (value: unknown) =>
        typeof value === "string" ? value.trim() : "";
      const dates = formatRangeFromItem(rawItem as any);

      if (isExp) {
        const company = trim(rawItem?.company);
        const position = trim(rawItem?.position);
        const location = trim(rawItem?.location);
        const title = position || company || "Experience entry";
        const subtitle =
          [company, location].filter(Boolean).join(" • ") || undefined;
        const bulletSource = getExperienceBulletLines(rawItem);
        const bulletLimit =
          variant === "compact" && !previewExpanded ? 3 : bulletSource.length;
        const bulletList = bulletSource.slice(0, bulletLimit);
        const canToggleBullets =
          variant === "compact" && bulletSource.length > 3;

        return (
          <div key={structuredId} className="py-3">
            <div className="cv-entry-summary">
              <div className="cv-entry-summary__main">
                <p className="cv-entry-title cv-entry-title--truncate">
                  {title}
                </p>
                {subtitle ? (
                  <p className="cv-entry-subtitle cv-entry-subtitle--truncate">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s2)",
                }}
              >
                {dates ? <p className="cv-entry-date">{dates}</p> : null}
                {renderAiMenuTrigger({
                  menu: { type: "experience", itemId: structuredId },
                  isLoading:
                    sectionAiLoadingKey === `experience:${structuredId}`,
                  title: `Experience AI actions for ${title}`,
                  items: [
                    {
                      label: "Improve bullet points",
                      onClick: () => void handleRunExperienceAi(rawItem),
                    },
                  ],
                })}
              </div>
            </div>
            {bulletList.length > 0 ? (
              <ul className="cv-entry-bullets">
                {bulletList.map((line, bulletIdx) => (
                  <li key={`${structuredId}-bullet-${bulletIdx}`}>{line}</li>
                ))}
              </ul>
            ) : null}
            {experienceAiDiff?.itemId === structuredId ? (
              <CvAiDiffCard
                label={`${experienceAiDiff.title} suggestion`}
                before={experienceAiDiff.oldItems}
                after={experienceAiDiff.newItems}
                onAccept={() => applyExperienceAiDiff(experienceAiDiff)}
                onDiscard={() => setExperienceAiDiff(null)}
                isApplying={Boolean(sectionAiLoadingKey)}
              />
            ) : null}
            {canToggleBullets ? (
              <div className="cv-disclosure-row">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedStructuredPreviewIds((prev) => ({
                      ...prev,
                      [structuredId]: !prev[structuredId],
                    }));
                  }}
                  className="dasti-icon-button dasti-icon-button--compact"
                  aria-label={
                    previewExpanded ? "Show fewer details" : "Show more details"
                  }
                  title={previewExpanded ? "Show less" : "Show more"}
                >
                  {previewExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                  )}
                </button>
              </div>
            ) : null}
          </div>
        );
      }

      const institution = trim(rawItem?.institution);
      const degree = trim(rawItem?.degree);
      const fieldOfStudy = trim(rawItem?.fieldOfStudy);
      const descriptionRaw = rawItem?.description;
      const description =
        typeof descriptionRaw === "string"
          ? descriptionRaw.trim()
          : descriptionRaw && typeof descriptionRaw === "object"
            ? docToPlainText(descriptionRaw as any).trim()
            : "";
      const title = degree || institution || fieldOfStudy || "Education entry";
      const subtitle = [institution, fieldOfStudy].filter(Boolean).join(" • ");
      const truncatedDescription =
        variant === "compact" && !previewExpanded && description.length > 160
          ? `${description.slice(0, 157).trimEnd()}…`
          : description;
      const canToggleDescription =
        variant === "compact" && description.length > 160;

      return (
        <div key={structuredId} className="py-3">
          <div className="cv-entry-summary">
            <div className="cv-entry-summary__main">
              <p className="cv-entry-title cv-entry-title--truncate">{title}</p>
              {subtitle ? (
                <p className="cv-entry-subtitle cv-entry-subtitle--truncate">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {dates ? <p className="cv-entry-date">{dates}</p> : null}
          </div>
          {truncatedDescription ? (
            <p className="cv-entry-body">{truncatedDescription}</p>
          ) : null}
          {canToggleDescription ? (
            <div className="cv-disclosure-row">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedStructuredPreviewIds((prev) => ({
                    ...prev,
                    [structuredId]: !prev[structuredId],
                  }));
                }}
                className="dasti-icon-button dasti-icon-button--compact"
                aria-label={
                  previewExpanded ? "Show fewer details" : "Show more details"
                }
                title={previewExpanded ? "Show less" : "Show more"}
              >
                {previewExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                )}
              </button>
            </div>
          ) : !truncatedDescription &&
            descriptionRaw &&
            typeof descriptionRaw === "object" ? (
            <p className="cv-entry-note">Detailed description available.</p>
          ) : null}
        </div>
      );
    };

    return (
      <div className="mb-4 border [border-color:var(--color-border)] [border-radius:var(--radius-card)] section-container">
        <div className="section-container-header flex items-center justify-between">
          <h3 className="cv-section-heading">{section.title}</h3>
          <div className="dasti-icon-cluster dasti-icon-cluster--tight">
            {isV1Active ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openStructuredModal();
                }}
                className="dasti-icon-button cv-section-edit-trigger"
                aria-label={`Edit ${sectionType}`}
                title={`Edit ${sectionType}`}
              >
                <Pencil className="w-4 h-4" strokeWidth={1.5} aria-hidden />
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
          <div
            className="cv-section-preview cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Edit ${sectionType}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasActiveSelection()) return;
              openStructuredModal();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                openStructuredModal();
              }
            }}
          >
            {hasRenderableStructured ? (
              <>
                <div className="cv-entry-stack">
                  {collapsedVisibleStructured.map((it, i) =>
                    renderStructuredPreview(it, i, "compact"),
                  )}
                </div>
                {sectionCanToggleEntries ? (
                  <div className="cv-disclosure-row cv-disclosure-row--section">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedStructuredSectionIds((prev) => ({
                          ...prev,
                          [String(section.id)]: !prev[String(section.id)],
                        }));
                      }}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={
                        collapsedListExpanded
                          ? `Show fewer ${sectionType} entries`
                          : `Show more ${sectionType} entries`
                      }
                      title={collapsedListExpanded ? "Show less" : "Show more"}
                    >
                      {collapsedListExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
              </>
            ) : hasBlocks ? (
              <>
                <p className="cv-preview-empty cv-preview-text cv-preview-text--muted">
                  Entries stored in rich text. Expand to view.
                </p>
                {sectionCanToggleEntries ? (
                  <div className="cv-disclosure-row cv-disclosure-row--section">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedStructuredSectionIds((prev) => ({
                          ...prev,
                          [String(section.id)]: !prev[String(section.id)],
                        }));
                      }}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={
                        collapsedListExpanded
                          ? `Show fewer ${sectionType} entries`
                          : `Show more ${sectionType} entries`
                      }
                      title={collapsedListExpanded ? "Show less" : "Show more"}
                    >
                      {collapsedListExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="cv-preview-empty cv-preview-text cv-preview-text--muted">
                No entries
              </p>
            )}
          </div>
        )}

        {!collapsed && (
          <div
            className="cv-section-body cv-section-body--stack cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Edit ${sectionType}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasActiveSelection()) return;
              openStructuredModal();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                openStructuredModal();
              }
            }}
          >
            {hasBlocks && !usingStructuredPreviewOverride ? (
              <>
                <div className="cv-entry-stack">
                  {visibleBlocks.map((block) => (
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
                {sectionCanToggleEntries ? (
                  <div className="cv-disclosure-row cv-disclosure-row--section">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedStructuredSectionIds((prev) => ({
                          ...prev,
                          [String(section.id)]: !prev[String(section.id)],
                        }));
                      }}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={
                        collapsedListExpanded
                          ? `Show fewer ${sectionType} entries`
                          : `Show more ${sectionType} entries`
                      }
                      title={collapsedListExpanded ? "Show less" : "Show more"}
                    >
                      {collapsedListExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
              </>
            ) : hasRenderableStructured ? (
              <>
                <div className="cv-entry-stack">
                  {collapsedVisibleStructured.map((it, i) =>
                    renderStructuredPreview(it, i, "detailed"),
                  )}
                </div>
                {sectionCanToggleEntries ? (
                  <div className="cv-disclosure-row cv-disclosure-row--section">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedStructuredSectionIds((prev) => ({
                          ...prev,
                          [String(section.id)]: !prev[String(section.id)],
                        }));
                      }}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={
                        collapsedListExpanded
                          ? `Show fewer ${sectionType} entries`
                          : `Show more ${sectionType} entries`
                      }
                      title={collapsedListExpanded ? "Show less" : "Show more"}
                    >
                      {collapsedListExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="p-3 cv-preview-empty cv-preview-text cv-preview-text--muted">
                No entries
              </p>
            )}
          </div>
        )}
        {/* Typed v1 modals for Experience/Education */}
        {isV1Active && sectionType === "experience" && isExperienceModalOpen ? (
          <ExperienceModal
            open={isExperienceModalOpen}
            onClose={() => setExperienceModalOpen(false)}
            items={
              (Array.isArray(structuredSection.structuredContent)
                ? (structuredSection.structuredContent as any)
                : []) as IExperienceItem[]
            }
            onSave={(next) => {
              try {
                const existingBlocks = Array.isArray(structuredSection.blocks)
                  ? structuredSection.blocks
                  : [];
                const linkedEntries = existingBlocks
                  .map((b: any): [string, any] => [
                    String(
                      (b as any)?.attributes?.linkedStructuredId ??
                        (b as any)?.attributes?.linkedstructuredid ??
                        "",
                    ),
                    b,
                  ])
                  .filter(([id]) => id.length > 0);
                const blockByLinkedId = new Map<string, any>(linkedEntries);

                const syncedBlocks = next.map((it) => {
                  const linkedId = String(it.id);
                  const existing = blockByLinkedId.get(linkedId);
                  const title = String(
                    it.position || it.company || "Experience",
                  );
                  const content =
                    typeof it.responsibilities !== "undefined" &&
                    it.responsibilities !== null
                      ? ensureRemirrorDoc(it.responsibilities as any)
                      : existing
                        ? ensureRemirrorDoc((existing as any).content as any)
                        : ensureRemirrorDoc(undefined as any);

                  return {
                    ...(existing ?? {}),
                    id: String((existing as any)?.id ?? uuidv4()),
                    title,
                    type: "text" as const,
                    content,
                    attributes: {
                      ...((existing as any)?.attributes ?? {}),
                      linkedStructuredId: linkedId,
                    },
                  };
                });

                const updatedSection = {
                  ...structuredSection,
                  structuredContent: next as any,
                  blocks: syncedBlocks as any,
                } as CvSection;

                setStructuredPreviewOverride(updatedSection);
                commitStructuredSection(updatedSection);
                setExperienceModalOpen(false);
              } catch {
                /* noop */
              }
            }}
          />
        ) : null}
        {isV1Active && sectionType === "education" && isEducationModalOpen ? (
          <EducationModal
            open={isEducationModalOpen}
            onClose={() => setEducationModalOpen(false)}
            items={
              (Array.isArray(structuredSection.structuredContent)
                ? (structuredSection.structuredContent as any)
                : []) as IEducationItem[]
            }
            onSave={(next) => {
              try {
                const existingBlocks = Array.isArray(structuredSection.blocks)
                  ? structuredSection.blocks
                  : [];
                const linkedEntries = existingBlocks
                  .map((b: any): [string, any] => [
                    String(
                      (b as any)?.attributes?.linkedStructuredId ??
                        (b as any)?.attributes?.linkedstructuredid ??
                        "",
                    ),
                    b,
                  ])
                  .filter(([id]) => id.length > 0);
                const blockByLinkedId = new Map<string, any>(linkedEntries);

                const syncedBlocks = next.map((it) => {
                  const linkedId = String(it.id);
                  const existing = blockByLinkedId.get(linkedId);
                  const title = String(
                    it.institution || it.degree || "Education",
                  );
                  const content =
                    typeof it.description !== "undefined" &&
                    it.description !== null
                      ? ensureRemirrorDoc(it.description as any)
                      : existing
                        ? ensureRemirrorDoc((existing as any).content as any)
                        : ensureRemirrorDoc(undefined as any);

                  return {
                    ...(existing ?? {}),
                    id: String((existing as any)?.id ?? uuidv4()),
                    title,
                    type: "text" as const,
                    content,
                    attributes: {
                      ...((existing as any)?.attributes ?? {}),
                      linkedStructuredId: linkedId,
                    },
                  };
                });

                const updatedSection = {
                  ...structuredSection,
                  structuredContent: next as any,
                  blocks: syncedBlocks as any,
                } as CvSection;

                setStructuredPreviewOverride(updatedSection);
                commitStructuredSection(updatedSection);
                setEducationModalOpen(false);
              } catch {
                /* noop */
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mb-4 border [border-color:var(--color-border)] [border-radius:var(--radius-card)] section-container">
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
      <div className="section-container-header flex items-center justify-between">
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
              if (localTitle !== section.title)
                onTitleChange?.(String(section.id), localTitle);
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
          className="cv-section-title-input"
          placeholder="Section Title"
        />
        {typeof onCollapseChange === "function" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (
                typeof window !== "undefined" &&
                (window as any).__CV_EDITOR_DEBUG__ === true
              ) {
                // eslint-disable-next-line no-console
                console.log("[SectionEditor] onCollapseChange clicked");
              }
              try {
                // Protect against racing with the local title buffer.
                // Use a brief flushGuard to prevent the syncing effect from overwriting the buffer.
                flushGuardRef.current = true;
                // Flush nested EntryRemirror editors first to ensure their buffered content is persisted.
                try {
                  remirrorRefs.current.forEach(
                    (r: { flush?: () => void } | null) => {
                      try {
                        r?.flush?.();
                      } catch {
                        /* noop */
                      }
                    },
                  );
                } catch {
                  /* noop */
                }
                // Persist title first (synchronous) to avoid it being cleared by deferred content updates.
                try {
                  if (localTitle !== section.title)
                    onTitleChange?.(String(section.id), localTitle);
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
                        if (
                          section &&
                          typeof (section as any).content === "object" &&
                          (section as any).content !== null
                        ) {
                          const sec = remirrorDocToSection(
                            ensureRemirrorDoc((section as any).content as any),
                            String(section.id),
                            section.title ?? "",
                          );
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
                  console.warn(
                    "[SectionEditor] deferredContentFlush failed",
                    err,
                  );
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
          onPointerUp={scheduleInlineSelectionCheck}
          onKeyUp={scheduleInlineSelectionCheck}
        >
          <Remirror
            manager={manager}
            initialContent={state}
            onChange={handleRemirrorChange}
          >
            <div className="mb-2">
              <EditorToolbar />
            </div>

            <ErrorBoundary
              fallback={
                <div
                  role="textbox"
                  aria-live="polite"
                  aria-label={
                    localTitle ? `${localTitle} editor` : "Section editor"
                  }
                  tabIndex={0}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => {
                    // Keep uncontrolled fallback buffer; don't emit here (parent controls)
                  }}
                  onBlur={() => {
                    try {
                      const view = (manager as any)?.view;
                      const json = view?.state?.doc?.toJSON?.() as
                        | RemirrorJSON
                        | undefined;
                      if (json) {
                        // Emit atomic updates only — content and title separately.
                        onContentChange?.(String(section.id), json);
                        onTitleChange?.(String(section.id), localTitle);
                      } else {
                        // Fallback: compute fallback HTML from section.content and convert to RemirrorJSON
                        const fallbackHtml = (() => {
                          try {
                            if (
                              section &&
                              typeof (section as any).content === "object" &&
                              (section as any).content !== null
                            ) {
                              const sec = remirrorDocToSection(
                                ensureRemirrorDoc(
                                  (section as any).content as any,
                                ),
                                String(section.id),
                                section.title ?? "",
                              );
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
                  className="min-h-[80px] p-3 border border-dashed [border-color:var(--color-border)] rounded prose max-w-none [background:var(--sfr)] [color:var(--ti)]"
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
