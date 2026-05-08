import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-settings.css"),
  "utf8",
);

function exactRuleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = settingsCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("SettingsPage document style CSS contracts", () => {
  it("anchors the active default badge to every style slot card", () => {
    expect(exactRuleBlock(".dasti-settings-slot-card")).toContain(
      "position: relative;",
    );
  });
});
