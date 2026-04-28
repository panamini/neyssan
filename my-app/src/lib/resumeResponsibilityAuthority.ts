import type { RemirrorJSON } from "remirror";

import type {
  WorkshopResponsibilitiesRichContent,
  WorkshopResponsibilityBulletListBlock,
  WorkshopResponsibilityRichBlock,
  WorkshopResponsibilityTextRun,
} from "../features/verbati/resume/resume.types";
import { remirrorJsonToString } from "./utils";

export type WorkshopResponsibilityProjection = {
  prose: string;
  bullets: string[];
  rich: WorkshopResponsibilitiesRichContent;
};

function isRemirrorLike(value: unknown): value is RemirrorJSON {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in (value as Record<string, unknown>),
  );
}

function isListNode(node: RemirrorJSON): boolean {
  return (
    node.type === "bulletList" ||
    node.type === "orderedList" ||
    node.type === "bullet_list" ||
    node.type === "ordered_list"
  );
}

function isListItemNode(node: RemirrorJSON): boolean {
  return node.type === "listItem" || node.type === "list_item";
}

function normalizeLine(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(normalizeLine).filter(Boolean)
    : [];
}

function parseRemirrorString(value: string): string | RemirrorJSON | string[] {
  try {
    const parsed = JSON.parse(value);
    const parsedArray = normalizeStringArray(parsed);
    if (parsedArray.length > 0) {
      return parsedArray;
    }
    return isRemirrorLike(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

function toResponsibilitySource(
  value: unknown,
): string | RemirrorJSON | string[] | null | undefined {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof value === "string") {
    return parseRemirrorString(value);
  }

  if (value == null || isRemirrorLike(value)) {
    return value;
  }

  return undefined;
}

function pushUnique(target: string[], value: string) {
  const clean = value.trim();
  if (!clean || target.includes(clean)) {
    return;
  }
  target.push(clean);
}

function appendRun(target: WorkshopResponsibilityTextRun[], run: WorkshopResponsibilityTextRun) {
  if (!run.text) {
    return;
  }

  const previous = target[target.length - 1];
  if (
    previous &&
    previous.bold === run.bold &&
    previous.italic === run.italic &&
    previous.underline === run.underline
  ) {
    previous.text += run.text;
    return;
  }

  target.push(run);
}

function trimRuns(
  runs: WorkshopResponsibilityTextRun[],
): WorkshopResponsibilityTextRun[] {
  const next = runs.map((run) => ({ ...run }));

  while (next.length > 0) {
    const [first] = next;
    const trimmed = first.text.replace(/^\s+/, "");
    if (!trimmed) {
      next.shift();
      continue;
    }
    if (trimmed !== first.text) {
      next[0] = { ...first, text: trimmed };
    }
    break;
  }

  while (next.length > 0) {
    const lastIndex = next.length - 1;
    const last = next[lastIndex];
    const trimmed = last.text.replace(/\s+$/, "");
    if (!trimmed) {
      next.pop();
      continue;
    }
    if (trimmed !== last.text) {
      next[lastIndex] = { ...last, text: trimmed };
    }
    break;
  }

  return next;
}

function runsToPlainText(runs: WorkshopResponsibilityTextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function runMarks(node: RemirrorJSON): Omit<WorkshopResponsibilityTextRun, "text"> {
  const marks = Array.isArray((node as { marks?: unknown }).marks)
    ? ((node as { marks: Array<{ type?: unknown }> }).marks ?? [])
    : [];

  return {
    ...(marks.some((mark) => mark?.type === "bold") ? { bold: true } : {}),
    ...(marks.some((mark) => mark?.type === "italic") ? { italic: true } : {}),
    ...(marks.some((mark) => mark?.type === "underline")
      ? { underline: true }
      : {}),
  };
}

function collectInlineRuns(
  node: RemirrorJSON,
  target: WorkshopResponsibilityTextRun[],
  options?: { excludeLists?: boolean },
) {
  if (node.type === "text") {
    appendRun(target, {
      text: typeof node.text === "string" ? node.text : "",
      ...runMarks(node),
    });
    return;
  }

  if (node.type === "hardBreak") {
    appendRun(target, { text: "\n" });
    return;
  }

  if (
    options?.excludeLists === true &&
    isListNode(node)
  ) {
    return;
  }

  (node.content ?? []).forEach((child) => collectInlineRuns(child, target, options));
}

function paragraphBlockFromRuns(
  runs: WorkshopResponsibilityTextRun[],
): WorkshopResponsibilityRichBlock | null {
  const trimmed = trimRuns(runs);
  return trimmed.length > 0
    ? {
        kind: "paragraph",
        runs: trimmed,
      }
    : null;
}

function bulletListBlockToPlainBullets(block: WorkshopResponsibilityBulletListBlock): string[] {
  return block.items
    .map((item) => normalizeMultilineText(runsToPlainText(item.runs)))
    .filter(Boolean);
}

function projectionFromRichContent(
  rich: WorkshopResponsibilitiesRichContent,
): WorkshopResponsibilityProjection {
  const prose: string[] = [];
  const bullets: string[] = [];

  rich.blocks.forEach((block) => {
    if (block.kind === "paragraph") {
      pushUnique(prose, normalizeMultilineText(runsToPlainText(block.runs)));
      return;
    }

    bulletListBlockToPlainBullets(block).forEach((bullet) => pushUnique(bullets, bullet));
  });

  return {
    prose: prose.join("\n\n"),
    bullets,
    rich,
  };
}

function projectStringArrayResponsibilities(
  value: string[],
): WorkshopResponsibilityProjection {
  const items = value
    .map(normalizeLine)
    .filter(Boolean)
    .map((text) => ({
      runs: [{ text }],
    }));

  return projectionFromRichContent({
    blocks:
      items.length > 0
        ? [
            {
              kind: "bullet_list",
              items,
            },
          ]
        : [],
  });
}

function projectStringToRichContent(value: string): WorkshopResponsibilitiesRichContent {
  const blocks: WorkshopResponsibilityRichBlock[] = [];
  const lines = value.replace(/\r/g, "\n").split("\n");

  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    const text = normalizeMultilineText(paragraphLines.join("\n"));
    paragraphLines = [];
    if (!text) {
      return;
    }
    blocks.push({
      kind: "paragraph",
      runs: [{ text }],
    });
  };

  const flushBullets = () => {
    const items = bulletItems
      .map((item) => item.trim())
      .filter(Boolean)
      .map((text) => ({
        runs: [{ text }],
      }));
    bulletItems = [];
    if (items.length === 0) {
      return;
    }
    blocks.push({
      kind: "bullet_list",
      items,
    });
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
      return;
    }

    const bullet = line.replace(/^[•·●◦◆\-\u2013\u2014*+]\s*/, "").trim();
    const isBullet = bullet.length > 0 && bullet !== line;

    if (isBullet) {
      flushParagraph();
      bulletItems.push(bullet);
      return;
    }

    flushBullets();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushBullets();

  return { blocks };
}

function bulletItemFromListItem(
  node: RemirrorJSON,
): WorkshopResponsibilityBulletListBlock["items"][number] | null {
  const runs: WorkshopResponsibilityTextRun[] = [];

  (node.content ?? []).forEach((child) => {
    if (isListNode(child)) {
      return;
    }
    collectInlineRuns(child, runs, { excludeLists: true });
  });

  const trimmed = trimRuns(runs);
  return trimmed.length > 0 ? { runs: trimmed } : null;
}

function projectRemirrorResponsibilities(
  value: RemirrorJSON,
): WorkshopResponsibilityProjection {
  const blocks: WorkshopResponsibilityRichBlock[] = [];

  const visitNode = (node: RemirrorJSON) => {
    if (isListNode(node)) {
      const items: WorkshopResponsibilityBulletListBlock["items"] = [];
      const nestedLists: RemirrorJSON[] = [];

      (node.content ?? []).forEach((child) => {
        if (isListItemNode(child)) {
          const item = bulletItemFromListItem(child);
          if (item) {
            items.push(item);
          }
          (child.content ?? []).forEach((grandchild) => {
            if (
              isListNode(grandchild)
            ) {
              nestedLists.push(grandchild);
            }
          });
          return;
        }

        visitNode(child);
      });

      if (items.length > 0) {
        blocks.push({
          kind: "bullet_list",
          items,
        });
      }

      nestedLists.forEach((list) => visitNode(list));

      return;
    }

    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "codeBlock"
    ) {
      const runs: WorkshopResponsibilityTextRun[] = [];
      collectInlineRuns(node, runs, { excludeLists: true });
      const block = paragraphBlockFromRuns(runs);
      if (block) {
        blocks.push(block);
      }
      return;
    }

    if (isListItemNode(node)) {
      const item = bulletItemFromListItem(node);
      if (item) {
        blocks.push({
          kind: "bullet_list",
          items: [item],
        });
      }
      return;
    }

    (node.content ?? []).forEach((child) => visitNode(child));
  };

  (value.content ?? []).forEach((node) => visitNode(node));

  return projectionFromRichContent({ blocks });
}

function projectStringResponsibilities(
  value: string,
): WorkshopResponsibilityProjection {
  return projectionFromRichContent(projectStringToRichContent(value));
}

export function projectResponsibilitiesForWorkshop(
  value: unknown,
): WorkshopResponsibilityProjection {
  const source = toResponsibilitySource(value);

  if (Array.isArray(source)) {
    return projectStringArrayResponsibilities(source);
  }

  if (typeof source === "string") {
    return projectStringResponsibilities(source);
  }

  if (source && isRemirrorLike(source)) {
    return projectRemirrorResponsibilities(source);
  }

  return {
    prose: "",
    bullets: [],
    rich: { blocks: [] },
  };
}

export function responsibilityValueToPlainText(value: unknown): string {
  const lines = responsibilityValueToDisplayLines(value);
  if (lines.length > 0) {
    return lines.join("\n");
  }

  const source: string | RemirrorJSON | null | undefined =
    typeof value === "string" || value == null || isRemirrorLike(value)
      ? value
      : undefined;
  return remirrorJsonToString(source)
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function responsibilityValueToDisplayLines(value: unknown): string[] {
  const projection = projectResponsibilitiesForWorkshop(value);
  const lines: string[] = [];

  projection.rich.blocks.forEach((block) => {
    if (block.kind === "paragraph") {
      const text = normalizeMultilineText(runsToPlainText(block.runs));
      if (text) {
        pushUnique(lines, text);
      }
      return;
    }

    bulletListBlockToPlainBullets(block).forEach((bullet) => {
      pushUnique(lines, bullet);
    });
  });

  return lines;
}

export function splitResponsibilitiesIntoBullets(
  input: string | null | undefined,
): string[] {
  const raw = String(input ?? "");
  if (!raw.trim()) {
    return [];
  }

  const normalized = raw.replace(/\r/g, "\n").replace(/[•·●◦◆]+/g, "\n").trim();
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.replace(/^[-\u2013\u2014*+]\s*/, "").trim())
    .filter(Boolean);

  const bullets: string[] = [];
  const seen = new Set<string>();

  const pushBullet = (value: string) => {
    const clean = value.replace(/\s*[.]+$/, "").trim();
    const key = clean.toLocaleLowerCase();
    if (!clean || seen.has(key)) {
      return;
    }
    seen.add(key);
    bullets.push(clean);
  };

  for (const line of lines) {
    if (/[.?!]\s*[A-Z]/.test(line)) {
      const sentences = line
        .split(/(?<=[.!?])\s*(?=[A-Z])/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 3);
      if (sentences.length > 1) {
        sentences.forEach(pushBullet);
        continue;
      }
    }

    pushBullet(line);
  }

  if (bullets.length === 0 && lines.length === 1) {
    lines[0]
      .split(/(?<=[.!?])\s*(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 3)
      .forEach(pushBullet);
  }

  return bullets;
}

const normalizeCachedBullets = normalizeStringArray;

function normalizeAchievementBullets(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) =>
          typeof entry === "string"
            ? entry.trim()
            : typeof (entry as { text?: unknown })?.text === "string"
              ? String((entry as { text: string }).text).trim()
              : "",
        )
        .filter(Boolean)
    : [];
}

export function deriveResponsibilityBullets(args: {
  responsibilities?: unknown;
  hasResponsibilitiesField?: boolean;
  responsibilityBullets?: unknown;
  achievements?: unknown;
  fallbackToAchievements?: boolean;
}): string[] {
  const hasResponsibilitiesField =
    args.hasResponsibilitiesField === true ||
    (args.hasResponsibilitiesField !== false &&
      args.responsibilities !== undefined &&
      args.responsibilities !== null);

  if (hasResponsibilitiesField) {
    const derived = projectResponsibilitiesForWorkshop(args.responsibilities).bullets;
    if (derived.length > 0 || args.fallbackToAchievements !== true) {
      return derived;
    }
  }

  const cached = normalizeCachedBullets(args.responsibilityBullets);
  if (cached.length > 0) {
    return cached;
  }

  if (args.fallbackToAchievements === true) {
    return normalizeAchievementBullets(args.achievements);
  }

  return [];
}
