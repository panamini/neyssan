import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cvForgeSource = readFileSync(
  resolve(process.cwd(), "src/pages/CvForge.tsx"),
  "utf8",
);

describe("CvForge page-size contract", () => {
  it("propagates the selected page size into CV preview and exports", () => {
    expect(cvForgeSource).toContain("documentPageSizePreference");
    expect(cvForgeSource).toContain("pageSize: resolvedDocumentPageSize");
    expect(cvForgeSource).toContain("pageSize={resolvedDocumentPageSize}");
    expect(cvForgeSource).toContain(
      "onPageSizePreferenceChange: setDocumentPageSizePreference",
    );
  });
});
