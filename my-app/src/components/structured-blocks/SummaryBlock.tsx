import React, { useMemo, useState } from "react";
import type { CvSection } from "../../schemas/cvDocument.schema";
import type { RemirrorJSON } from "remirror";
import {
  docToPlainText,
  getFirstParagraphText,
} from "../remirror-editor/utils/text";
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
import { stableStringify } from "@/utils/stableStringify";
import { ChevronDown, ChevronUp } from "@/lib/icons";

/**
 * SummaryBlock (v1, display-only)
 *
 * - Read-only progressive disclosure preview of structuredContent[0].summary (Remirror JSON)
 * - Collapsed: plain-text truncated preview
 * - Expanded: read-only Remirror rendering for full-fidelity formatting (lists, marks, etc.)
 * - No inline editing or persistence here (modal is the single editing surface)
 *
 * Accessibility:
 * - role="region" with aria-expanded reflecting expanded state
 * - Buttons have proper aria-labels and are keyboard accessible
 */
export interface SummaryBlockProps {
  section: CvSection;
  onChange: (updatedSection: CvSection) => void; // kept for API compatibility; unused here
  onContentChange?: (sectionId: string, json: RemirrorJSON) => void; // kept for API compatibility; unused here
  // Called when user activates the empty/collapsed summary to open the modal editor.
  onOpenEditor?: () => void;
}
interface ReadOnlySummaryProps {
  doc?: RemirrorJSON;
}

function ReadOnlySummary({ doc }: ReadOnlySummaryProps) {
  const extensions = useMemo(
    () => [
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
    ],
    [],
  );

  const initialDoc: RemirrorJSON = useMemo<RemirrorJSON>(
    () =>
      doc && typeof doc === "object"
        ? (doc)
        : ({ type: "doc", content: [] } as RemirrorJSON),
    [doc],
  );

  const { manager, state } = useRemirror({
    extensions: () => extensions as any,
    content: initialDoc as any,
  });

  return (
    <Remirror manager={manager} initialContent={state} editable={false}>
      <EditorComponent />
    </Remirror>
  );
}

export function SummaryBlock({ section, onOpenEditor }: SummaryBlockProps) {
  const summaryDoc: RemirrorJSON | undefined = useMemo(() => {
    try {
      const first =
        Array.isArray(section.structuredContent) &&
        section.structuredContent.length > 0
          ? (section.structuredContent[0] as unknown as {
              summary?: RemirrorJSON;
            })
          : null;
      return (first?.summary) ?? undefined;
    } catch {
      return undefined;
    }
  }, [section.structuredContent]);

  // Read-only collapsed/expanded via Remirror for visual parity (like Achievements)
  const fullText = useMemo(() => docToPlainText(summaryDoc), [summaryDoc]);

  // Decide if toggle is needed (too long or too many nodes)
  const tooLong = useMemo(() => {
    try {
      const len = (fullText || "").replace(/\s+/g, " ").trim().length;
      if (len > 200) return true;
      const c = (summaryDoc as any)?.content;
      if (Array.isArray(c)) {
        if (c.length > 2) return true;
        const first = c[0];
        if (
          first &&
          (first.type === "bulletList" || first.type === "orderedList")
        ) {
          const li = first.content;
          if (Array.isArray(li) && li.length > 2) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }, [summaryDoc, fullText]);

  // Build a collapsed Remirror doc (first two blocks or first two list items or ~200 chars)
  function buildCollapsedDocFromDoc(doc?: RemirrorJSON): RemirrorJSON {
    const fallback: RemirrorJSON = { type: "doc", content: [] } as RemirrorJSON;
    if (!doc || typeof doc !== "object") return fallback;
    const d: any = doc;
    const nodes: any[] = Array.isArray(d.content) ? d.content : [];

    if (nodes.length === 0) return fallback;

    const first = nodes[0];
    if (
      (first?.type === "bulletList" || first?.type === "orderedList") &&
      Array.isArray(first?.content)
    ) {
      const firstTwo = first.content.slice(0, 2);
      return {
        type: "doc",
        content: [{ ...first, content: firstTwo }],
      } as RemirrorJSON;
    }

    const keep = nodes.slice(0, 2);

    if (
      keep.length === 1 &&
      keep[0]?.type === "paragraph" &&
      Array.isArray(keep[0]?.content) &&
      keep[0].content.some(
        (n: any) =>
          n?.type === "text" &&
          typeof n?.text === "string" &&
          n.text.length > 200,
      )
    ) {
      let remaining = 200;
      const newContent: any[] = [];
      for (const n of keep[0].content) {
        if (remaining <= 0) break;
        if (n.type === "text" && typeof n.text === "string") {
          if (n.text.length <= remaining) {
            newContent.push(n);
            remaining -= n.text.length;
          } else {
            const truncated =
              n.text.slice(0, Math.max(0, remaining)).trimEnd() + "…";
            newContent.push({ ...n, text: truncated });
            remaining = 0;
            break;
          }
        } else {
          newContent.push(n);
        }
      }
      keep[0] = { ...keep[0], content: newContent };
    }

    return { type: "doc", content: keep } as RemirrorJSON;
  }

  // Helpers to ensure collapsed view differs from expanded when a toggle is shown
  function docsDeepEqual(a?: RemirrorJSON, b?: RemirrorJSON): boolean {
    try {
      return stableStringify(a ?? null) === stableStringify(b ?? null);
    } catch {
      return false;
    }
  }
  function buildParagraphDoc(text: string): RemirrorJSON {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: text ? [{ type: "text", text }] : [],
        },
      ],
    } as unknown as RemirrorJSON;
  }

  // Build collapsed doc; if it ends up identical to the expanded doc but we decided a toggle is needed,
  // force a truncated paragraph to guarantee visible change on toggle.
  const rawCollapsedDoc = useMemo<RemirrorJSON>(
    () => buildCollapsedDocFromDoc(summaryDoc),
    [summaryDoc],
  );
  const collapsedDoc = useMemo<RemirrorJSON>(() => {
    if (!tooLong) return rawCollapsedDoc;
    if (docsDeepEqual(rawCollapsedDoc, summaryDoc)) {
      const t = fullText || "";
      const cut = t.length > 200 ? `${t.slice(0, 200).trim()}…` : t;
      return buildParagraphDoc(cut);
    }
    return rawCollapsedDoc;
  }, [rawCollapsedDoc, summaryDoc, tooLong, fullText]);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const regionId = `summary-preview-${section.id}`;
  const isEmpty = useMemo(() => {
    try {
      const t = String(fullText || "").trim();
      if (t.length === 0) return true;
      const norm = t
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[.…!]/g, "")
        .trim();
      // Treat seeded placeholder content as empty so the block opens the modal.
      return norm === "start typing here" || norm === "start typing";
    } catch {
      return false;
    }
  }, [fullText]);

  return (
    <div
      className={onOpenEditor ? "py-1 cursor-pointer" : "py-1"}
      onClick={(e) => {
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
        e.stopPropagation();
        onOpenEditor?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpenEditor?.();
        }
      }}
      role={onOpenEditor ? "button" : undefined}
      tabIndex={onOpenEditor ? 0 : -1}
      aria-label={
        isEmpty ? "Add summary. Press Enter to edit." : "Edit summary"
      }
    >
      <div
        className="text-sm [color:var(--ti)] cv-reading-measure"
        role="region"
        aria-expanded={isExpanded}
        aria-labelledby={tooLong ? `${regionId}-toggle` : undefined}
        id={regionId}
      >
        {isExpanded ? (
          summaryDoc && !isEmpty ? (
            <div
              className="rich-content"
              key={`summary-expanded-${stableStringify(summaryDoc)}`}
            >
              <ReadOnlySummary doc={summaryDoc} />
            </div>
          ) : (
            <p className="text-sm italic [color:var(--tg2)]">
              Start typing here
            </p>
          )
        ) : isEmpty ? (
          <p className="text-sm italic [color:var(--tg2)]">Start typing here</p>
        ) : (
          <div
            className="rich-content"
            key={`summary-collapsed-${stableStringify(collapsedDoc)}`}
          >
            <ReadOnlySummary doc={collapsedDoc} />
          </div>
        )}
      </div>

      {tooLong ? (
        <div className="cv-disclosure-row">
          <button
            type="button"
            id={`${regionId}-toggle`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
            className="dasti-icon-button dasti-icon-button--compact"
            aria-controls={regionId}
            aria-label={isExpanded ? "Collapse summary" : "Expand summary"}
            title={isExpanded ? "Show less" : "Show more"}
          >
            {isExpanded ? (
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
