export type ProposalTextareaListTransform = {
  nextText: string;
  nextSelectionStart: number;
  nextSelectionEnd: number;
};

const LIST_LINE_PATTERN = /^(\s*)[-*•]\s+/u;

function detectLineEnding(text: string): string {
  const match = text.match(/\r\n|\n|\r/u);
  return match?.[0] ?? "\n";
}

function isLineBreakAt(text: string, index: number): boolean {
  return text[index] === "\n" || text[index] === "\r";
}

function getSelectionLineRange(text: string, selectionStart: number, selectionEnd: number) {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const effectiveEnd = end > start && isLineBreakAt(text, end - 1) ? end - 1 : end;
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextLineBreak = text.indexOf("\n", effectiveEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;

  return { lineStart, lineEnd };
}

function addListMarker(line: string): string {
  if (!line.trim() || LIST_LINE_PATTERN.test(line)) return line;
  return line.replace(/^(\s*)/u, "$1- ");
}

function removeListMarker(line: string): string {
  return line.replace(LIST_LINE_PATTERN, "$1");
}

export function toggleMarkdownListForSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): ProposalTextareaListTransform {
  const normalizedStart = Math.max(0, Math.min(selectionStart, text.length));
  const normalizedEnd = Math.max(normalizedStart, Math.min(selectionEnd, text.length));

  if (normalizedStart === normalizedEnd) {
    const starter = `- First item${detectLineEnding(text)}- Second item`;
    return {
      nextText: `${text.slice(0, normalizedStart)}${starter}${text.slice(normalizedEnd)}`,
      nextSelectionStart: normalizedStart + 2,
      nextSelectionEnd: normalizedStart + "First item".length + 2,
    };
  }

  const { lineStart, lineEnd } = getSelectionLineRange(
    text,
    normalizedStart,
    normalizedEnd,
  );
  const selectedBlock = text.slice(lineStart, lineEnd);
  const lines = selectedBlock.split(/\r\n|\n|\r/u);
  const nonEmptyLines = lines.filter((line) => line.trim());
  const shouldRemoveMarkers =
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((line) => LIST_LINE_PATTERN.test(line));
  const nextBlock = lines
    .map((line) => (shouldRemoveMarkers ? removeListMarker(line) : addListMarker(line)))
    .join(detectLineEnding(selectedBlock || text));

  return {
    nextText: `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`,
    nextSelectionStart: lineStart,
    nextSelectionEnd: lineStart + nextBlock.length,
  };
}

export function continueMarkdownListOnEnter(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): ProposalTextareaListTransform | null {
  if (selectionStart !== selectionEnd) return null;

  const cursor = Math.max(0, Math.min(selectionStart, text.length));
  const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
  const nextLineBreak = text.indexOf("\n", cursor);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const line = text.slice(lineStart, lineEnd);
  const markerMatch = line.match(/^(\s*)[-*•]\s*(.*)$/u);
  if (!markerMatch) return null;

  const indent = markerMatch[1] ?? "";
  const markerText = markerMatch[2] ?? "";

  if (!markerText.trim()) {
    const nextText = `${text.slice(0, lineStart)}${indent}${text.slice(lineEnd)}`;
    const nextCursor = lineStart + indent.length;
    return {
      nextText,
      nextSelectionStart: nextCursor,
      nextSelectionEnd: nextCursor,
    };
  }

  const insertion = `${detectLineEnding(text)}${indent}- `;
  const nextCursor = cursor + insertion.length;

  return {
    nextText: `${text.slice(0, cursor)}${insertion}${text.slice(cursor)}`,
    nextSelectionStart: nextCursor,
    nextSelectionEnd: nextCursor,
  };
}
