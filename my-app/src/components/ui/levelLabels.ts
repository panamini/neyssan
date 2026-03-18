import type { Level } from "../../types/cvDocument";

/**
 * Centralized level definitions and UI label mapping.
 *
 * Data values remain stable (for persistence/tests) while labels shown to users
 * can be adapted here without touching storage types.
 */

export const LEVELS: Level[] = ["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"];

export const UI_LABEL_MAP: Record<Level, string> = {
  Beginner: "Beginner",
  Elementary: "Intermediate",
  Intermediate: "Advanced",
  Advanced: "Expert",
  Fluent: "Master",
};

export function levelLabel(level: Level): string {
  return UI_LABEL_MAP[level] ?? String(level);
}

export function levelOptions(): Array<{ value: Level; label: string }> {
  return LEVELS.map((lvl) => ({ value: lvl, label: levelLabel(lvl) }));
}