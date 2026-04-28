import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCss = readFileSync(
  resolve(process.cwd(), "src/styles/product.css"),
  "utf8",
);
const proposalsLibrarySource = readFileSync(
  resolve(process.cwd(), "src/pages/ProposalsLibrary.tsx"),
  "utf8",
);
const cvsLibrarySource = readFileSync(
  resolve(process.cwd(), "src/pages/CvsLibrary.tsx"),
  "utf8",
);
const proposalsListSource = readFileSync(
  resolve(process.cwd(), "src/components/ProposalsList.tsx"),
  "utf8",
);

describe("DS-6 rollout contracts", () => {
  it("uses the subtle-fill input primitive in library search rows", () => {
    expect(proposalsLibrarySource).toContain(
      'import { Input, ToneBadge, type ToneBadgeTone } from "../components/ui";',
    );
    expect(proposalsLibrarySource).toContain("<Input");
    expect(cvsLibrarySource).toContain('import { Input } from "../components/ui";');
    expect(cvsLibrarySource).toContain("<Input");
  });

  it("uses tone badges for proposal tone labels", () => {
    expect(proposalsLibrarySource).toContain("<ToneBadge");
    expect(proposalsListSource).toContain("<ToneBadge");
    expect(proposalsListSource).toContain("toneBadgeTone(");
  });

  it("uses the DS sidebar active gradient and stripe", () => {
    expect(productCss).toMatch(
      /\.sb-section__action--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*box-shadow:\s*inset 2px 0 0 var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*box-shadow:\s*inset 2px 0 0 var\(--ac\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*box-shadow:\s*inset 2px 0 0 var\(--ac\);/,
    );
  });
});
