import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/pages/ProposalForge.tsx"),
  "utf8",
);

describe("ProposalForge page-size preference contract", () => {
  it("restores the user preference without coupling it to template selection", () => {
    expect(source).toContain('new URLSearchParams(search).get("pageSize")');
    expect(source).toContain("readStoredDocumentPageSizePreference()");
    expect(source).toContain(
      "writeStoredDocumentPageSizePreference(preference)",
    );
    expect(source).not.toContain("getProposalTemplateCanonicalPageSizeId");
  });

  it("keeps layout selection independent from page-size state", () => {
    const layoutHandler = source.slice(
      source.indexOf("const handleProposalLayoutSelect"),
      source.indexOf("const handleProposalTypographySelect"),
    );

    expect(layoutHandler).toContain("setProposalTemplateId(templateId)");
    expect(layoutHandler).not.toContain("setProposalPageSizePreference");
    expect(layoutHandler).not.toContain(
      "writeStoredDocumentPageSizePreference",
    );
  });

  it("applies and persists layout changes on an opened saved proposal", () => {
    const layoutHandler = source.slice(
      source.indexOf("const handleProposalLayoutSelect"),
      source.indexOf("const handleProposalTypographySelect"),
    );

    expect(layoutHandler).toContain(
      "if (isSavedView && openedSavedProposal && savedProposalRenderMetadata)",
    );
    expect(layoutHandler).toContain("setSavedProposalTemplateId(templateId)");
    expect(layoutHandler).toContain("persistOpenedSavedProposal({");
    expect(layoutHandler).toContain("templateId,");
  });

  it("renders and selects the saved proposal's active template", () => {
    expect(source).toMatch(
      /activeItemId:\s*isSavedView\s*\? effectiveSavedProposalTemplateId\s*:\s*effectiveProposalTemplateId/,
    );
    expect(source).toMatch(
      /templateId=\{\s*isSavedView\s*\? effectiveSavedProposalTemplateId\s*:/,
    );
  });
});
