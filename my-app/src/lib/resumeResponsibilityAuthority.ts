import type { RemirrorJSON } from "remirror";

import { remirrorJsonToString } from "./utils";

function isRemirrorLike(value: unknown): value is RemirrorJSON {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in (value as Record<string, unknown>),
  );
}

function normalizeLine(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function responsibilityValueToPlainText(value: unknown): string {
  const source: string | RemirrorJSON | null | undefined =
    typeof value === "string" || value == null || isRemirrorLike(value)
      ? value
      : undefined;
  const text = remirrorJsonToString(source);
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function normalizeCachedBullets(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(normalizeLine).filter(Boolean)
    : [];
}

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
    const derived = splitResponsibilitiesIntoBullets(
      responsibilityValueToPlainText(args.responsibilities),
    );
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
