import {
  collectBrowserStorageDiagnostics,
  installStorageDiagnostics,
} from "../storage-diagnostics";

describe("storage diagnostics", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete window.__DASTI_STORAGE_DIAGNOSTICS__;
  });

  it("reports storage usage and prioritizes relevant proposal and cv keys", () => {
    window.localStorage.setItem("dasti:proposal-output-draft:v1", "x".repeat(64));
    window.localStorage.setItem("cv:123", "y".repeat(32));
    window.localStorage.setItem("unrelated", "z".repeat(8));
    window.sessionStorage.setItem(
      "dasti:proposal-output-draft:session:v1",
      "q".repeat(16),
    );

    const report = collectBrowserStorageDiagnostics();

    expect(report.combinedBytes).toBeGreaterThan(0);
    expect(report.localStorage.entries[0]?.key).toBe("dasti:proposal-output-draft:v1");
    expect(
      report.relevantEntries.some((entry) => entry.key === "cv:123"),
    ).toBe(true);
    expect(
      report.relevantEntries.some(
        (entry) => entry.key === "dasti:proposal-output-draft:session:v1",
      ),
    ).toBe(true);
  });

  it("installs a dev-console helper on window", () => {
    installStorageDiagnostics();

    expect(typeof window.__DASTI_STORAGE_DIAGNOSTICS__?.collect).toBe("function");
    expect(typeof window.__DASTI_STORAGE_DIAGNOSTICS__?.logSummary).toBe("function");
  });
});
