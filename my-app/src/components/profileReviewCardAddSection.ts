const CORE_V1_SECTION_TYPES = new Set([
  "profile",
  "summary",
  "experience",
  "education",
  "skills",
]);

const OPTIONAL_TEMPLATE_SECTION_TYPES = new Set([
  "achievements",
  "languages",
  "projects",
  "certifications",
]);

export function shouldUseV1TemplateForAddSection(
  sectionType: string,
  _v1Enabled: boolean,
): boolean {
  const normalizedSectionType = String(sectionType ?? "").trim();
  if (!normalizedSectionType) {
    return false;
  }

  if (CORE_V1_SECTION_TYPES.has(normalizedSectionType)) {
    return true;
  }

  if (OPTIONAL_TEMPLATE_SECTION_TYPES.has(normalizedSectionType)) {
    return false;
  }

  return false;
}
