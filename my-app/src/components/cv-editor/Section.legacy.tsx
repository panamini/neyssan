/**
 * REMOVED: Legacy Section implementation
 *
 * This file was retained as a backup during a refactor but you requested removal.
 * Keeping a runtime-safe sentinel here so any accidental imports fail loudly and
 * guide developers to the canonical editor at src/components/SectionEditor.tsx.
 *
 * If you truly want the file deleted from git history, remove it from the repo
 * with `git rm` locally; this repository action cannot be fully undone by the
 * runtime sentinel.
 */

export default function SectionLegacyRemoved(): never {
  throw new Error(
    'src/components/cv-editor/Section.legacy.tsx has been removed. Use src/components/SectionEditor.tsx instead.'
  );
}