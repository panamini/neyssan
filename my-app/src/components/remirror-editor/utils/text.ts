import type { RemirrorJSON } from "remirror";

/**
 * docToPlainText
 * - Walks a Remirror JSON document and extracts readable plain text.
 * - Preserves minimal spacing between paragraphs and list items.
 * - Safe against malformed nodes.
 */
export function docToPlainText(json: RemirrorJSON | undefined | null): string {
  if (!json || typeof json !== "object") return "";
  const parts: string[] = [];

  function pushText(t: unknown): void {
    const s = typeof t === "string" ? t : "";
    if (s) parts.push(s);
  }

  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;

    // Text node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n: any = node;

    if (n.type === "text") {
      pushText(n.text);
      return;
    }

    // Paragraph: collect children then add a space separator
    if (n.type === "paragraph") {
      if (Array.isArray(n.content)) {
        for (const c of n.content) walk(c);
      }
      parts.push(" ");
      return;
    }

    // List structures: walk items and add separators
    if (n.type === "bulletList" || n.type === "orderedList") {
      if (Array.isArray(n.content)) {
        for (const c of n.content) walk(c);
      }
      parts.push(" ");
      return;
    }

    // listItem: walk its content; add a space at the end of the item
    if (n.type === "listItem") {
      if (Array.isArray(n.content)) {
        for (const c of n.content) walk(c);
      }
      parts.push(" ");
      return;
    }

    // Generic container with content
    if (Array.isArray(n.content)) {
      for (const c of n.content) walk(c);
    }
  }

  try {
    walk(json as unknown);
  } catch {
    // ignore malformed structures and return what we have
  }

  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * getFirstParagraphText
 * - Returns the text content of the first paragraph node, if present.
 * - Falls back to the first non-empty text span if no paragraph exists.
 */
export function getFirstParagraphText(json: RemirrorJSON | undefined | null): string {
  if (!json || typeof json !== "object") return "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = json;
  const content = Array.isArray(doc?.content) ? doc.content : [];

  // Try first paragraph
  for (const node of content) {
    if (node?.type === "paragraph") {
      const paraText = docToPlainText({ type: "doc", content: [node] } as RemirrorJSON);
      if (paraText) return paraText;
    }
  }

  // Fallback: first non-empty text encountered in the doc
  const full = docToPlainText(json);
  return full.split(/\s{2,}/)[0] ?? full;
}