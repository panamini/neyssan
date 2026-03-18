import { RemirrorJSON } from "remirror";

/**
 * Traverses a RemirrorJSON document and extracts all text content into a single string.
 * This is a naive implementation that recursively walks the content tree.
 * @param doc The RemirrorJSON document to convert.
 * @returns A plain string representation of the document's text nodes.
 */
export function remirrorJsonToString(doc: RemirrorJSON | string | undefined | null): string {
  if (!doc) {
    return "";
  }

  if (typeof doc === "string") {
    try {
      // Attempt to parse the string as JSON. If it fails, treat it as a plain string.
      const parsed = JSON.parse(doc);
      if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
        return remirrorJsonToString(parsed);
      }
      return doc;
    } catch (e) {
      return doc;
    }
  }

  if (!doc.content) {
    return "";
  }

  let text = "";
  
  function traverse(nodes: RemirrorJSON[]) {
    for (const node of nodes) {
      if (node.type === "text" && typeof node.text === "string") {
        text += node.text;
      }
      
      if (node.content) {
        traverse(node.content);
      }
    }
  }

  traverse(doc.content);
  return text;
}