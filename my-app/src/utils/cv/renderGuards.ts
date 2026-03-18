const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasArrayEntries = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

export const isExperienceRenderable = (entry: any): boolean => {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  if (hasNonEmptyString(entry.company)) return true;
  if (hasNonEmptyString(entry.position)) return true;
  if (hasNonEmptyString(entry.responsibilities)) return true;
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
  if (description && typeof description === "object") return true;
  if (hasNonEmptyString(description)) return true;
  return false;
};

export default {
  isExperienceRenderable,
  isEducationRenderable,
};
