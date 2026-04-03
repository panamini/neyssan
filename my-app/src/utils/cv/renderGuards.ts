const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasArrayEntries = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

const hasNonEmptyRichTextObject = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const queue: unknown[] = [value];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    if (typeof record.text === "string" && record.text.trim().length > 0) return true;
    const content = record.content;
    if (Array.isArray(content)) queue.push(...content);
    const items = record.items;
    if (Array.isArray(items)) queue.push(...items);
  }
  return false;
};

export const isExperienceRenderable = (entry: any): boolean => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  if (hasNonEmptyString(entry.company)) return true;
  if (hasNonEmptyString(entry.position)) return true;
  if (hasNonEmptyString(entry.responsibilities)) return true;
  if (hasNonEmptyRichTextObject(entry.responsibilities)) return true;
  if (hasArrayEntries(entry?.responsibilityBullets)) return true;
  if (hasArrayEntries(entry?.achievements)) return true;
  return false;
};

export const isEducationRenderable = (entry: any): boolean => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  if (hasNonEmptyString(entry.institution)) return true;
  if (hasNonEmptyString(entry.degree)) return true;
  if (hasNonEmptyString(entry.fieldOfStudy)) return true;
  const description = entry?.description;
  if (hasNonEmptyRichTextObject(description)) return true;
  if (hasNonEmptyString(description)) return true;
  return false;
};

export default {
  isExperienceRenderable,
  isEducationRenderable,
};
