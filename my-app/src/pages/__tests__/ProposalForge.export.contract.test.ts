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

  it("enables document zoom on the preview ProposalDisplay branch", () => {
    expect(proposalForgeSource).toContain("showZoomControls={true}");
  });

  it("keeps the Proposal Ask drawer on the shared stage island position", () => {
    expect(proposalForgeSource).toContain(
      'className="dasti-composer-drawer--stage dasti-composer-drawer--proposal"',
    );
  });

  it("keeps the automatic tone helper compact", () => {
    expect(proposalForgeSource).toContain('description: "Auto from job + CV."');
    expect(proposalForgeSource).not.toContain(
      "Chooses from the job and selected CV at generation time.",
    );
  });
});
