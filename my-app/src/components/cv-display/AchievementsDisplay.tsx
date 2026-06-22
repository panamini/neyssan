import React, { useMemo } from "react";
import type { RemirrorJSON } from "remirror";
import { docToPlainText } from "../remirror-editor/utils/text";
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

interface AchievementsDisplayProps {
  itemId: string;
  items: unknown[] | undefined | null;
  maxItems?: number | null; // when provided, render only first N items (collapsed preview)
  truncateChars?: number; // when maxItems is set and there is only one long item, truncate to this length
  className?: string;
  separatedItems?: boolean;
}

/**
 * AchievementsDisplay
 * - Renders a read-only Remirror view of achievements.
 * - Use maxItems (e.g., 2) for collapsed preview; omit for full expanded view.
 * - No internal toggle UI; parent controls any "Read more/less" buttons.
 */
export function AchievementsDisplay({
  itemId,
  items,
  maxItems = null,
  truncateChars = 200,
  className,
  separatedItems = false,
}: AchievementsDisplayProps): JSX.Element | null {
  const DEBUG = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;

  // For non-array inputs, build a string array fallback so we can still render something.
  const texts: string[] = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((it) => coerceToString(it)).map((s) => s.trim()).filter(Boolean);
  }, [items]);

  if (DEBUG) {

    console.debug("[AchievementsDisplay] render", { itemId, rawItems: items, texts });
  }

  const rawItems: unknown[] = Array.isArray(items) ? items : texts;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;

  // Build the Remirror doc based on collapsed/expanded mode.
  const doc: RemirrorJSON = useMemo(() => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return { type: "doc", content: [] } as RemirrorJSON;
    }
    // Collapsed preview: limit items; if only one item, render truncated paragraph for readability.
    if (maxItems !== null) {
      if (rawItems.length === 1) {
        return buildTruncatedSingleDoc(rawItems[0], truncateChars);
      }
      return buildDocFromItems(rawItems.slice(0, Math.max(0, maxItems ?? 0)));
    }
    // Expanded view: render all items preserving structure where possible.
    return buildDocFromItems(rawItems);
  }, [rawItems, maxItems, truncateChars]);

  const docKey = `${itemId}:${stableStringify(doc)}`;

  return (
    <div
      className={[
        "rich-content achievements-display [color:var(--ti)]",
        separatedItems ? "achievements-display--separated" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      key={docKey}
    >
      <ReadOnlyAchievements doc={doc} />
    </div>
  );
}

/* Helpers */

function coerceToString(input: unknown): string {
  // Strings may be either plain text or JSON-encoded Remirror docs/nodes.
  if (typeof input === "string") {
    const raw = input.trim();
    // If it looks like JSON, attempt to parse and treat as a Remirror doc/node.
    if ((raw.startsWith("{") || raw.startsWith("[")) && raw.includes('"type"')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // If parsed appears like a Remirror doc/node, extract plain text.
          if (Array.isArray((parsed).content) || typeof (parsed).type === "string") {
            try {
              return docToPlainText(parsed as RemirrorJSON);
            } catch {
              // fallthrough to return raw string if parsing fails
            }
          }
        }
      } catch {
        // not JSON — continue to return raw string
      }
    }
    return input;
  }

  // If input is an object, attempt to detect structured achievements or Remirror-like structures.
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;

    // Structured achievements object: { id?, text }
    if (typeof (obj as any).text === "string") {
      return String((obj as any).text);
    }

    // Common Remirror patterns:
    // - { type: 'doc'|'paragraph'|..., content: [...] }
    // - { content: [...] }
    // - { doc: { type: 'doc', content: [...] } }
    if (Array.isArray(obj.content) || typeof obj.type === "string") {
      try {
        return docToPlainText(obj as unknown as RemirrorJSON);
      } catch {
        // noop
      }
    }
    if ((obj as { doc?: unknown }).doc && typeof (obj as { doc?: unknown }).doc === "object" && Array.isArray(((obj as { doc?: unknown }).doc as any).content)) {
      try {
        return docToPlainText((obj as { doc?: unknown }).doc as RemirrorJSON);
      } catch {
        // noop
      }
    }
  }

  // Fallback: string coercion but avoid "[object Object]"
  try {
    const s = String(input ?? "");
    return s === "[object Object]" ? "" : s;
  } catch {
    return "";
  }
}

function looksLikeRemirrorNode(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && typeof (x as Record<string, unknown>).type === "string";
}

function parseMaybeRemirror(input: unknown): RemirrorJSON | null {
  // String: maybe JSON-encoded Remirror
  if (typeof input === "string") {
    const raw = input.trim();
    if ((raw.startsWith("{") || raw.startsWith("[")) && raw.includes('"type"')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          return parsed as RemirrorJSON;
        }
      } catch {
        // not JSON — fall through
      }
    }
    return null;
  }
  // Object-like
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (
      looksLikeRemirrorNode(obj) ||
      Array.isArray((obj as any).content) ||
      ((obj as { doc?: unknown }).doc && typeof (obj as { doc?: unknown }).doc === "object" && Array.isArray(((obj as { doc?: unknown }).doc as any).content))
    ) {
      // Normalize { doc: {...} } to its doc
      if ((obj as { doc?: unknown }).doc && typeof (obj as { doc?: unknown }).doc === "object") return ((obj as { doc?: unknown }).doc) as RemirrorJSON;
      return (obj as unknown) as RemirrorJSON;
    }
  }
  return null;
}

/**
 * Build a Remirror JSON doc combining items. For string items we create list items;
 * for Remirror-like nodes we inline their content/nodes to preserve formatting.
 */
function buildDocFromItems(items: unknown[]): RemirrorJSON {
  const content: any[] = [];
  let pendingListItems: any[] = [];

  function flushList(): void {
    if (pendingListItems.length > 0) {
      content.push({ type: "bulletList", content: pendingListItems });
      pendingListItems = [];
    }
  }

  for (const it of items) {
    const rem = parseMaybeRemirror(it);
    if (rem) {
      flushList();
      const node = rem as any;
      if (node.type === "doc" && Array.isArray(node.content)) {
        content.push(...node.content);
      } else {
        content.push(node);
      }
      continue;
    }
    // Not a Remirror node: treat as plain text list item
    const txt = coerceToString(it);
    pendingListItems.push({
      type: "listItem",
      content: [{ type: "paragraph", content: txt ? [{ type: "text", text: txt }] : [] }],
    });
  }

  flushList();
  return { type: "doc", content } as unknown as RemirrorJSON;
}

/**
 * Build a Remirror doc from a single item, truncating to ~N chars for collapsed mode.
 */
function buildTruncatedSingleDoc(item: unknown, limit = 200): RemirrorJSON {
  const text = coerceToString(item);
  const cut = text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
  return {
    type: "doc",
    content: [{ type: "paragraph", content: cut ? [{ type: "text", text: cut }] : [] }],
  } as unknown as RemirrorJSON;
}

/**
 * Read-only Remirror renderer that matches our extension stack.
 * Mirrors SummaryBlock's approach to ensure visual parity (lists, marks, line-height).
 */
interface ReadOnlyAchievementsProps {
  doc: RemirrorJSON;
}
function ReadOnlyAchievements({ doc }: ReadOnlyAchievementsProps): JSX.Element {
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
    []
  );

  const initialDoc: RemirrorJSON =
    doc && typeof doc === "object" ? (doc) : ({ type: "doc", content: [] } as RemirrorJSON);

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

export default AchievementsDisplay;
