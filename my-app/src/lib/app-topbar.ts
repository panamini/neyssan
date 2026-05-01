export function resolveCommandShortcutLabel(platform: string | undefined): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform ?? "") ? "⌘K" : "Ctrl K";
}
