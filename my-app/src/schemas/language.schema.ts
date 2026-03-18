import { z } from "zod";

/**
 * Runtime validation for Language items.
 * Note: Compatible with ILanguageItem from ../../types/cvDocument (structurally).
 * We keep levels aligned with the project-wide Level union (no "Native").
 */

export const languageLevelValues = [
  "Beginner",
  "Elementary",
  "Intermediate",
  "Advanced",
  "Fluent",
] as const;

export const LanguageLevelSchema = z.union([
  z.literal("Beginner"),
  z.literal("Elementary"),
  z.literal("Intermediate"),
  z.literal("Advanced"),
  z.literal("Fluent"),
]);

export const LanguageItemSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, "Language name is required"),
  level: LanguageLevelSchema.default("Intermediate"),
});

export type LanguageLevel = z.infer<typeof LanguageLevelSchema>;
export type LanguageItemZ = z.infer<typeof LanguageItemSchema>;

/**
 * Helper to sanitize/parse unknown input into a validated Language item.
 * This ensures we never produce an invalid level and trims the name.
 */
export function parseLanguageItem(input: unknown): LanguageItemZ {
  const base =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const name = typeof base.name === "string" ? base.name.trim() : "";
  const level = typeof base.level === "string" ? base.level : undefined;

  const candidate = {
    ...(typeof base.id === "string" ? { id: base.id } : {}),
    name,
    level,
  };

  return LanguageItemSchema.parse(candidate);
}

/**
 * Helper for arrays of languages.
 */
export const LanguageItemsArraySchema = z.array(LanguageItemSchema);
export function parseLanguageItemsArray(input: unknown): LanguageItemZ[] {
  if (!Array.isArray(input)) return [];
  return LanguageItemsArraySchema.parse(
    input.map((it) => parseLanguageItem(it))
  );
}