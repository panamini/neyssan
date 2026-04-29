import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productCssPaths = [
  "src/styles/product.css",
  "src/styles/product-proposal.css",
  "src/styles/product-libraries.css",
  "src/styles/product-jobs.css",
  "src/styles/product-cv.css",
  "src/styles/product-settings.css",
];
const productCss = productCssPaths
  .map((stylePath) => readFileSync(resolve(process.cwd(), stylePath), "utf8"))
  .join("\n");
const dsCss = readFileSync(resolve(process.cwd(), "src/styles/ds-v2.css"), "utf8");
const foundationCss = readFileSync(
  resolve(process.cwd(), "src/styles/foundation.css"),
  "utf8",
);
const primitivesCss = readFileSync(
  resolve(process.cwd(), "src/styles/primitives.css"),
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
const proposalInputFormSource = readFileSync(
  resolve(process.cwd(), "src/components/ProposalInputForm.tsx"),
  "utf8",
);
const proposalComposeToolbarSource = readFileSync(
  resolve(process.cwd(), "src/components/ProposalComposeToolbar.tsx"),
  "utf8",
);
const libraryFilterMenuSource = readFileSync(
  resolve(process.cwd(), "src/components/LibraryFilterMenu.tsx"),
  "utf8",
);
const toneBadgeSource = readFileSync(
  resolve(process.cwd(), "src/components/ui/tone-badge.tsx"),
  "utf8",
);
const migratedInlineFieldSources = [
  "src/components/ProfileEditors.tsx",
  "src/components/SelectedBlockInspector.tsx",
  "src/components/structured-blocks/HobbiesModal.tsx",
  "src/components/structured-blocks/LanguagesModal.tsx",
  "src/components/structured-blocks/SkillsBlock.tsx",
  "src/components/structured-blocks/SkillsModal.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));

describe("DS-6 rollout contracts", () => {
  it("uses the subtle-fill input primitive in library search rows", () => {
    expect(proposalsLibrarySource).toContain(
      'import { Input, ToneBadge, type ToneBadgeTone } from "../components/ui";',
    );
    expect(proposalsLibrarySource).toContain("<Input");
    expect(cvsLibrarySource).toContain('import { Input } from "../components/ui";');
    expect(cvsLibrarySource).toContain("<Input");
    expect(foundationCss).toContain("--sf3: #F5F4EF;");
    expect(foundationCss).toContain("--sf3: #161616;");
    expect(foundationCss).toContain("--field-focus-shadow: none;");
    expect(dsCss).toMatch(
      /\.ds-field:hover:not\(:disabled,\s*:focus\)\s*\{[\s\S]*background:\s*var\(--sf3\);/,
    );
    expect(dsCss).toMatch(
      /\.ds-field:focus\s*\{[\s\S]*border-color:\s*var\(--ti\);[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(foundationCss).toContain("--er: hsl(10, 30%, 58%);");
    expect(primitivesCss).toMatch(
      /\.dasti-field,\s*\.dasti-select\s*\{[\s\S]*border:\s*2px solid transparent;[\s\S]*background:\s*var\(--sf2\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-field:hover:not\(:focus\):not\(:disabled\),\s*\.dasti-select:hover:not\(:focus\):not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--sf3\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-field:focus,\s*\.dasti-select:focus\s*\{[\s\S]*border-color:\s*var\(--ti\);[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-field--error,\s*\.dasti-select--error\s*\{[\s\S]*border-color:\s*var\(--color-danger\);[\s\S]*var\(--color-danger-soft\) 35%,[\s\S]*var\(--sf2\)/,
    );
    expect(productCss).toMatch(
      /\.dasti-proposal-library-utility-row__input:hover\s*\{[\s\S]*background:\s*var\(--sf3\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-field-no-glow:focus\s*\{[\s\S]*border-color:\s*var\(--ti\) !important;[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-rich\s*\{[\s\S]*border:\s*2px solid transparent;[\s\S]*background:\s*var\(--sf2\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-rich:focus-within\s*\{[\s\S]*border-color:\s*var\(--ti\);[\s\S]*box-shadow:\s*var\(--field-focus-shadow\) !important;/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-rich \.ProseMirror:focus,[\s\S]*\.dasti-rich \.ProseMirror:focus-visible\s*\{[\s\S]*box-shadow:\s*none !important;/,
    );
    for (const source of migratedInlineFieldSources) {
      expect(source).not.toContain("focus:border-[color:var(--ac)]");
      expect(source).not.toContain("focus:[box-shadow:0_0_0_3px_var(--fr)]");
    }
  });

  it("uses tone badges for proposal tone labels", () => {
    expect(proposalsLibrarySource).toContain("<ToneBadge");
    expect(proposalsListSource).toContain("<ToneBadge");
    expect(proposalsListSource).toContain("toneBadgeTone(");
    expect(proposalInputFormSource).toContain("<ToneBadge");
    expect(proposalComposeToolbarSource).toContain("<ToneBadge");
    expect(libraryFilterMenuSource).toContain("<ToneBadge");
    expect(toneBadgeSource).toContain('"auto" | "warm" | "formal" | "natural"');
    expect(proposalInputFormSource).toContain('tone: "auto"');
    expect(proposalComposeToolbarSource).toContain('tone: "auto"');
    expect(proposalsLibrarySource).toContain('tone: "warm"');
    expect(proposalsLibrarySource).toContain('tone: "natural"');
    expect(proposalsLibrarySource).toContain('tone: "formal"');
    expect(foundationCss).toContain("--tone-auto-bg: var(--sf2);");
    expect(foundationCss).toContain("--tone-warm-bg: hsl(30deg 40% 93%);");
    expect(dsCss).toContain(".ds-tone--warm");
    expect(dsCss).toContain(".ds-tone--auto");
    expect(dsCss).toContain("background: var(--tone-warm-bg);");
    expect(dsCss).toContain("background: var(--tone-auto-bg);");
    expect(productCss).toMatch(
      /\.dasti-count-pill,\s*\.dasti-proposal-tone-badge\s*\{[\s\S]*min-height:\s*28px;[\s\S]*letter-spacing:\s*0;[\s\S]*text-transform:\s*none;/,
    );
    expect(dsCss).toMatch(
      /\.ds-pill--info\s*\{[\s\S]*background:\s*var\(--info-bg/,
    );
    expect(dsCss).toMatch(
      /\.ds-status--accent\s+\.ds-status__dot\s*\{[\s\S]*--ds-status-dot-color:\s*var\(--ac\);/,
    );
    expect(dsCss).toMatch(
      /\.ds-status--success\s+\.ds-status__dot\s*\{[\s\S]*--ds-status-dot-color:\s*var\(--ok\);/,
    );
  });

  it("keeps legacy dasti buttons aligned with DS button tokens", () => {
    expect(primitivesCss).toMatch(
      /\.dasti-button\s*\{[\s\S]*border:\s*1px solid transparent;[\s\S]*background:\s*var\(--sfr\);[\s\S]*font-size:\s*var\(--ts\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-button--primary\s*\{[\s\S]*background:\s*var\(--ac\);[\s\S]*color:\s*var\(--op\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-button--secondary\s*\{[\s\S]*background:\s*var\(--sfr\);[\s\S]*border-color:\s*var\(--border-stronger,\s*var\(--border-strong\)\);/,
    );
    expect(primitivesCss).toMatch(
      /\.dasti-button--sm\s*\{[\s\S]*min-height:\s*var\(--hs\);[\s\S]*font-size:\s*var\(--tx\);/,
    );
  });

  it("keeps DS-2 open visual notes fixed", () => {
    expect(foundationCss).toContain("--border-stronger: #B6B5B1;");
    expect(foundationCss).toContain("--border-stronger: #6E6D69;");
    expect(foundationCss).toContain("--paper-dark-heading-ink: #0F0C08;");
    expect(foundationCss).toContain("--paper-dark-body-ink: #2F2D29;");
    expect(dsCss).toMatch(
      /\.ds-btn--secondary\s*\{[\s\S]*border-color:\s*var\(--border-stronger,\s*var\(--border-strong\)\);/,
    );
    expect(dsCss).toMatch(
      /\.dark \.ds-paper,[\s\S]*\[data-theme="dark"\] \.ds-paper\s*\{[\s\S]*color:\s*var\(--paper-dark-heading-ink\);/,
    );
    expect(dsCss).toMatch(
      /\.dark \.ds-paper p,[\s\S]*\[data-theme="dark"\] \.ds-paper p\s*\{[\s\S]*color:\s*var\(--paper-dark-body-ink\);/,
    );
  });

  it("uses the DS sidebar active gradient and stripe", () => {
    expect(productCss).toMatch(
      /\.sb-section__action--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*color:\s*var\(--sidebar-active-ink\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__action--active::before\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleY\(1\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*color:\s*var\(--ti\);/,
    );
    expect(productCss).toMatch(
      /\.sb-section__document--active::before\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*scaleY\(1\);/,
    );
    expect(productCss).toMatch(
      /\.sb-rail-button--active\s*\{[\s\S]*background:\s*linear-gradient\(90deg,\s*var\(--ap\),\s*transparent\);[\s\S]*box-shadow:\s*inset 2px 0 0 var\(--ac\);/,
    );
  });
});
