import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const proposalForgeSource = readFileSync(
  resolve(process.cwd(), "src/pages/ProposalForge.tsx"),
  "utf8",
);

describe("ProposalForge export contract", () => {
  it("routes proposal exports through the unified direct-download API", () => {
    expect(proposalForgeSource).toContain("exportDocumentFile");
  });

  it("does not retain mounted preview export selectors or preview-settle retries", () => {
    expect(proposalForgeSource).not.toContain(
      'from "../lib/document-export"',
    );
    expect(proposalForgeSource).not.toContain('".dasti-proposal-document"');
    expect(proposalForgeSource).not.toContain("pendingExportTarget");
    expect(proposalForgeSource).not.toContain("downloadProposalFromMountedPreview");
  });

  it("registers proposal share and export actions for the global topbar", () => {
    expect(proposalForgeSource).toContain("onExportPdf");
    expect(proposalForgeSource).toContain("onExportDocx");
    expect(proposalForgeSource).toContain("onShareSavedProposal");
  });
});
