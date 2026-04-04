import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const proposalForgeSource = readFileSync(
  resolve(process.cwd(), "src/pages/ProposalForge.tsx"),
  "utf8",
);

describe("ProposalForge export contract", () => {
  it("targets the mounted proposal document root for PDF export", () => {
    expect(proposalForgeSource).toContain('".dasti-proposal-document"');
  });

  it("forces preview mode before exporting from compose or saved edit views", () => {
    expect(proposalForgeSource).toContain('setProposalOutputMode("preview")');
    expect(proposalForgeSource).toContain('setSavedProposalOutputMode("preview")');
  });

  it("does not retain legacy print-window export logic", () => {
    expect(proposalForgeSource).not.toContain("preparePdfPrintWindow");
    expect(proposalForgeSource).not.toContain("printFirstMatchingNodeAsPdf");
  });
});
