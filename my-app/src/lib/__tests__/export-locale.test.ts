import { describe, expect, it } from "vitest";
import { normalizeExportDocumentLanguage } from "../export-locale";

describe("export locale helpers", () => {
  it("normalizes document language codes for export sources", () => {
    expect(normalizeExportDocumentLanguage("pt-BR")).toBe("pt");
    expect(normalizeExportDocumentLanguage("ru")).toBe("ru");
    expect(normalizeExportDocumentLanguage("auto")).toBeNull();
    expect(normalizeExportDocumentLanguage(null)).toBeNull();
  });
});
