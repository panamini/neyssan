import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dsCss = readFileSync(
  resolve(process.cwd(), "src/styles/ds-v2.css"),
  "utf8",
);
const libraryFilterSource = readFileSync(
  resolve(process.cwd(), "src/components/LibraryFilterMenu.tsx"),
  "utf8",
);

describe("DS-10 menu primitive", () => {
  it("defines the portal menu shell, items, section labels, and reduced motion", () => {
    expect(dsCss).toContain(".ds-menu {");
    expect(dsCss).toContain("position: fixed;");
    expect(dsCss).toContain("z-index: var(--z-popover);");
    expect(dsCss).toContain(".ds-menu__item {");
    expect(dsCss).toContain(".ds-menu__label {");
    expect(dsCss).toContain(".ds-menu__separator {");
    expect(dsCss).toContain(".ds-menu__item--danger");
    expect(dsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-menu/,
    );
  });

  it("migrates the shared library filter dropdown to the DS menu", () => {
    expect(libraryFilterSource).toContain("<Menu");
    expect(libraryFilterSource).not.toContain(
      "dasti-proposal-library-filter-menu__drawer",
    );
    expect(libraryFilterSource).not.toContain("dasti-proposal-chrome-drawer");
  });
});
