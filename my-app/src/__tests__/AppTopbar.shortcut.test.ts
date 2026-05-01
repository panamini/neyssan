import { describe, expect, it } from "vitest";

import { resolveCommandShortcutLabel } from "../lib/app-topbar";

describe("App topbar shortcut label", () => {
  it("uses the macOS command glyph on Apple platforms", () => {
    expect(resolveCommandShortcutLabel("MacIntel")).toBe("⌘K");
    expect(resolveCommandShortcutLabel("iPhone")).toBe("⌘K");
  });

  it("uses Ctrl K on non-Apple platforms", () => {
    expect(resolveCommandShortcutLabel("Win32")).toBe("Ctrl K");
    expect(resolveCommandShortcutLabel("Linux x86_64")).toBe("Ctrl K");
  });
});
